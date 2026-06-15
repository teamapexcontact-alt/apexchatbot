import { NextRequest, NextResponse } from "next/server";
import { firebaseConfig } from "@apex/config";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp, writeBatch, doc, deleteDoc, updateDoc, query, where, getDocs } from "firebase/firestore";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
function r(body: any, s = 200) { return NextResponse.json(body, { status: s, headers: CORS }); }
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }
function getDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getFirestore(app);
}

// ── Text extraction ──
async function extractText(buf: ArrayBuffer, name: string, mime: string): Promise<string> {
  const lower = name.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    try {
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "";
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
      let text = "";
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(" ") + "\n";
      }
      return text.trim();
    } catch { return ""; }
  }
  if (mime.includes("wordprocessingml") || lower.endsWith(".docx")) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
      return result.value || "";
    } catch { return ""; }
  }
  try { return new TextDecoder().decode(buf); } catch { return ""; }
}

// ── Q&A extraction ──
const QWORDS = ["what", "how", "why", "do", "does", "can", "will", "is", "are", "was", "were", "when", "where", "who", "which", "could", "would", "should", "have", "has", "did", "doesn't", "don't", "can't", "won't", "isn't", "aren't"];

function isQuestion(line: string): boolean {
  const t = line.trim();
  if (t.endsWith("?") && t.split(/\s+/).length <= 25) return true;
  if (/^(q\.|q:|question\s*\d*[:.)])\s*/i.test(t)) return true;
  if (/^\d+[.)]\s+/.test(t) && t.replace(/^\d+[.)]\s+/, "").split(/\s+/).length <= 20) {
    const rest = t.replace(/^\d+[.)]\s+/, "").toLowerCase();
    if (QWORDS.some((w) => rest.startsWith(w + " ") || rest.startsWith(w + "?"))) return true;
  }
  const lower = t.toLowerCase();
  if (QWORDS.some((w) => lower.startsWith(w + " ") || lower.startsWith(w + "?"))) return true;
  return false;
}

function extractQAPairs(text: string): Array<{ question: string; answer: string }> {
  const pairs: Array<{ question: string; answer: string }> = [];
  const lines = text.split("\n");
  let q = "", a = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (q && a) { pairs.push({ question: q, answer: a.trim() }); q = ""; a = ""; }
      continue;
    }
    if (/^a[.:)]\s*/i.test(line)) { a += (a ? " " : "") + line.replace(/^a[.:)]\s*/i, "").trim(); continue; }
    if (isQuestion(line)) {
      if (q && a) pairs.push({ question: q, answer: a.trim() });
      q = line.replace(/^(q\.|q:|question\s*\d*[:.)])\s*/i, "").replace(/^\d+[.)]\s+/, "").replace(/\s*\?*\s*$/, "").trim() + "?";
      a = "";
    } else if (q) { a += (a ? " " : "") + line; }
  }
  if (q && a) pairs.push({ question: q, answer: a.trim() });
  return pairs;
}

// ── Paragraph/section chunking ──
function chunkByParagraphs(text: string, maxLen = 800): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let current = "";
  for (const p of paragraphs) {
    const t = p.trim();
    if (!t) continue;
    if ((current + "\n\n" + t).length > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = t;
    } else {
      current += (current ? "\n\n" : "") + t;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 30);
}

// ── POST ──
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const projectId = (form.get("projectId") as string) || "default";
    if (!file) return r({ error: "No file provided" }, 400);

    const buf = await file.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    if (base64.length > 850_000) return r({ error: `File too large (${(base64.length / 1024).toFixed(0)} KB).` }, 413);

    const db = getDb();
    const text = await extractText(buf, file.name, file.type || "");

    // Store document
    const docRef = await addDoc(collection(db, "documents"), {
      fileName: file.name, fileType: file.type || "application/octet-stream",
      fileData: base64, fileSize: buf.byteLength,
      content: text.slice(0, 100000),
      projectId, tags: [], uploadedAt: serverTimestamp(),
    });
    const downloadUrl = `/api/download/${docRef.id}`;
    await updateDoc(doc(db, "documents", docRef.id), { fileUrl: downloadUrl });

    let qaCreated = 0;
    let chunksCreated = 0;

    // ── Extract Q&A pairs → create flows ──
    const qaPairs = extractQAPairs(text);
    if (qaPairs.length > 0) {
      const batch = writeBatch(db);
      for (const pair of qaPairs) {
        const triggers = normalizeText(pair.question).split(/\s+/).filter((w) => w.length > 2).slice(0, 8);
        const ref = doc(collection(db, "flows"));
        batch.set(ref, {
          projectId,
          name: pair.question.slice(0, 100),
          triggers,
          priority: 0,
          steps: [{ type: "message", message: pair.answer }],
          enabled: true,
          source: `document:${docRef.id}`,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        qaCreated++;
      }
      await batch.commit();
    }

    // ── Create document chunks for fallback ──
    const paragraphs = chunkByParagraphs(text);
    if (paragraphs.length > 0) {
      const batch = writeBatch(db);
      for (let i = 0; i < paragraphs.length; i++) {
        const ref = doc(collection(db, "document_chunks"));
        batch.set(ref, {
          projectId, documentId: docRef.id,
          content: paragraphs[i].slice(0, 1000),
          index: i, createdAt: serverTimestamp(),
        });
        chunksCreated++;
      }
      await batch.commit();
    }

    return r({ success: true, fileUrl: downloadUrl, id: docRef.id, qaCreated, chunksCreated });
  } catch (err: any) {
    console.error("Upload error:", err);
    return r({ error: err.message }, 500);
  }
}

function normalizeText(t: string) { return t.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim(); }

// ── DELETE ──
export async function DELETE(req: NextRequest) {
  try {
    const { docId } = await req.json();
    if (!docId) return r({ error: "docId required" }, 400);
    const db = getDb();
    const [flowSnap, chunkSnap] = await Promise.all([
      getDocs(query(collection(db, "flows"), where("source", "==", `document:${docId}`))),
      getDocs(query(collection(db, "document_chunks"), where("documentId", "==", docId))),
    ]);
    const batch = writeBatch(db);
    flowSnap.docs.forEach((d) => batch.delete(d.ref));
    chunkSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, "documents", docId));
    await batch.commit();
    return r({ success: true });
  } catch (err: any) { return r({ error: err.message }, 500); }
}
