import { NextRequest, NextResponse } from "next/server";
import { firebaseConfig } from "@apex/config";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp, writeBatch, doc, deleteDoc, updateDoc, query, where, getDocs } from "firebase/firestore";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function getServerDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getFirestore(app);
}

function chunkContent(text: string, size = 500, overlap = 50): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) { chunks.push(text.slice(i, i + size)); i += size - overlap; }
  return chunks.filter((c) => c.trim().length > 20);
}

const QUESTION_WORDS = ["what", "how", "why", "do", "does", "can", "will", "is", "are", "was", "were", "when", "where", "who", "which", "could", "would", "should", "have", "has", "did", "doesn't", "don't", "can't", "won't", "isn't", "aren't"];

function isQuestionLine(line: string): boolean {
  const t = line.trim();
  if (t.endsWith("?") && t.split(/\s+/).length <= 25) return true;
  const lower = t.toLowerCase();
  if (/^[({]?\s*(?:q\.|q:|question\s*\d*[:.)])\s*/i.test(t)) return true;
  if (QUESTION_WORDS.some((w) => {
    const re = new RegExp(`^\\d+[\\.\\)]\\s*${w}\\b`, "i");
    return lower.startsWith(w + " ") || lower.startsWith(w + "?") || re.test(t);
  })) return true;
  return false;
}

function extractQAPairs(text: string): Array<{ question: string; answer: string }> {
  const pairs: Array<{ question: string; answer: string }> = [];
  const lines = text.split("\n");
  let q = "", a = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { if (q && a) { pairs.push({ question: q, answer: a.trim() }); q = ""; a = ""; } continue; }
    if (/^a[.:)]\s*/i.test(line)) { a += (a ? " " : "") + line.replace(/^a[.:)]\s*/i, "").trim(); continue; }
    if (isQuestionLine(line)) {
      if (q && a) pairs.push({ question: q, answer: a.trim() });
      q = line.replace(/^[({]?\s*(?:q\.|q:|question\s*\d*[:.)])\s*/i, "").replace(/\s*\?*\s*$/, "").trim() + "?";
      a = "";
    } else if (q) { a += (a ? " " : "") + line; }
  }
  if (q && a) pairs.push({ question: q, answer: a.trim() });
  return pairs;
}

async function extractText(buf: ArrayBuffer, name: string, mime: string): Promise<string> {
  const lower = name.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    try {
      const pdfjsLib = await import("pdfjs-dist");
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
  try {
    return new TextDecoder().decode(buf);
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const projectId = (form.get("projectId") as string) || "default";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400, headers: corsHeaders });
    }

    const db = getServerDb();

    const buf = await file.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");

    const MAX_BASE64 = 850_000;
    if (base64.length > MAX_BASE64) {
      return NextResponse.json(
        { error: `File too large (${(base64.length / 1024).toFixed(0)} KB base64). Max ~650 KB file.` },
        { status: 413, headers: corsHeaders }
      );
    }

    const text = await extractText(buf, file.name, file.type || "");

    const docRef = await addDoc(collection(db, "documents"), {
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileData: base64,
      fileSize: buf.byteLength,
      content: text.slice(0, 50000),
      projectId,
      tags: [],
      uploadedAt: serverTimestamp(),
    });

    const downloadUrl = `/api/download/${docRef.id}`;
    await updateDoc(doc(db, "documents", docRef.id), { fileUrl: downloadUrl });

    const chunks = chunkContent(text.slice(0, 50000));
    const batch = writeBatch(db);
    for (let i = 0; i < chunks.length; i++) {
      const ref = doc(collection(db, "document_chunks"));
      batch.set(ref, {
        documentId: docRef.id,
        projectId,
        content: chunks[i],
        index: i,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();

    const qaPairs = extractQAPairs(text.slice(0, 50000));
    for (const pair of qaPairs) {
      try {
        await addDoc(collection(db, "faqs"), {
          projectId,
          question: pair.question,
          answer: pair.answer,
          category: "document",
          keywords: pair.question.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean),
          source: `document:${docRef.id}`,
          createdAt: serverTimestamp(),
        });
      } catch { /* skip individual QA failure */ }
    }

    return NextResponse.json({ success: true, fileUrl: downloadUrl, id: docRef.id, qaCount: qaPairs.length }, { headers: corsHeaders });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { docId } = await req.json();
    const db = getServerDb();

    if (docId) {
      const faqSnap = await getDocs(query(collection(db, "faqs"), where("source", "==", `document:${docId}`)));
      const batch = writeBatch(db);
      faqSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      await deleteDoc(doc(db, "documents", docId));
    }
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
