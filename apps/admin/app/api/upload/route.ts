import { NextRequest, NextResponse } from "next/server";
import { firebaseConfig } from "@apex/config";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp, writeBatch, doc, deleteDoc, updateDoc, query, where, getDocs } from "firebase/firestore";
import { logAudit } from "@/lib/audit-logger";

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
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
      let text = "";
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(" ") + "\n";
      }
      return text.trim();
    } catch (e) { console.error("Server PDF extraction failed:", e); return ""; }
  }
  if (mime.includes("wordprocessingml") || lower.endsWith(".docx")) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
      return result.value || "";
    } catch (e) { console.error("Server DOCX extraction failed:", e); return ""; }
  }
  try { return new TextDecoder().decode(buf); } catch (e) { console.error("Server text extraction failed:", e); return ""; }
}

// ── Advanced Document Structure Extraction ──

interface DocumentSection {
  heading: string;
  level: number;
  content: string;
  items: string[];
}

interface KnowledgeItem {
  type: "faq" | "section" | "heading" | "list_item" | "table";
  question?: string;
  answer: string;
  category?: string;
  heading?: string;
  keywords: string[];
  order: number;
}

function detectHeadings(lines: string[]): { index: number; text: string; level: number }[] {
  const headings: { index: number; text: string; level: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    // Markdown headings
    const md = t.match(/^(#{1,6})\s+(.+)/);
    if (md) { headings.push({ index: i, text: md[2].trim(), level: md[1].length }); continue; }
    // ALL CAPS heading (2+ words, >60% uppercase)
    const words = t.split(/\s+/);
    const upper = words.filter((w) => w === w.toUpperCase() && w.length > 1).length;
    if (words.length >= 2 && words.length <= 10 && upper >= words.length * 0.6 && t.length < 80) {
      headings.push({ index: i, text: t, level: 1 }); continue;
    }
    // Title Case heading (short line, each word capitalized)
    if (words.length >= 2 && words.length <= 8 && t.length < 60) {
      const titled = words.filter((w) => /^[A-Z][a-z]/.test(w)).length;
      if (titled >= words.length * 0.6 && !t.endsWith(".") && !t.endsWith("?")) {
        headings.push({ index: i, text: t, level: 2 });
      }
    }
  }
  return headings;
}

function isTableRow(line: string): boolean {
  return line.includes("|") && line.split("|").length >= 3;
}

function isListItem(line: string): boolean {
  return /^\s*[-*•]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line);
}

function extractKnowledge(text: string): KnowledgeItem[] {
  const items: KnowledgeItem[] = [];
  const lines = text.split("\n");
  const headings = detectHeadings(lines);
  let currentHeading = "";
  let order = 0;

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;

    // Check if this line is a heading
    const h = headings.find((h) => h.index === i);
    if (h) { currentHeading = h.text; continue; }

    // A. Detect FAQ-style lines (from headings)
    if (currentHeading.toLowerCase().includes("faq") || currentHeading.toLowerCase().includes("question")) {
      // Lines ending with ? under an FAQ heading
      if (t.endsWith("?") && t.split(/\s+/).length <= 25) {
        // Gather answer from following lines until next question or blank
        let answer = "";
        for (let j = i + 1; j < lines.length; j++) {
          const nl = lines[j].trim();
          if (!nl) break;
          if (nl.endsWith("?") && nl.split(/\s+/).length <= 25) break;
          if (detectHeadings([nl]).length > 0) break;
          answer += (answer ? " " : "") + nl;
        }
        if (answer) {
          items.push({
            type: "faq", question: t, answer,
            category: currentHeading, heading: currentHeading,
            keywords: normalizeText(t).split(/\s+/).filter((w) => w.length > 2),
            order: order++,
          });
        }
      }
      continue;
    }

    // B. Table rows
    if (isTableRow(t)) {
      const cells = t.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 2) {
        items.push({
          type: "table", answer: cells.join(" | "),
          category: currentHeading || "table", heading: currentHeading,
          keywords: cells.flatMap((c) => normalizeText(c).split(/\s+/).filter((w) => w.length > 2)),
          order: order++,
        });
      }
      continue;
    }

    // C. List items
    if (isListItem(t)) {
      const clean = t.replace(/^\s*[-*•]\s+/, "").replace(/^\s*\d+[.)]\s+/, "");
      items.push({
        type: "list_item", answer: clean,
        category: currentHeading || "list", heading: currentHeading,
        keywords: normalizeText(clean).split(/\s+/).filter((w) => w.length > 2),
        order: order++,
      });
      continue;
    }

    // D. Lines ending with ? → treat as potential Q&A (from any section)
    if (t.endsWith("?") && t.split(/\s+/).length <= 25) {
      let answer = "";
      for (let j = i + 1; j < lines.length; j++) {
        const nl = lines[j].trim();
        if (!nl) break;
        if (nl.endsWith("?") && nl.split(/\s+/).length <= 25) break;
        if (detectHeadings([nl]).length > 0) break;
        if (isTableRow(nl)) break;
        answer += (answer ? " " : "") + nl;
      }
      if (answer) {
        items.push({
          type: "faq", question: t, answer,
          category: currentHeading || "general", heading: currentHeading,
          keywords: normalizeText(t).split(/\s+/).filter((w) => w.length > 2),
          order: order++,
        });
      }
      continue;
    }

    // E. Remaining content → section knowledge
    // Group paragraphs of content under a heading
    if (t.length > 40 && currentHeading) {
      let para = t;
      for (let j = i + 1; j < lines.length; j++) {
        const nl = lines[j].trim();
        if (!nl) break;
        if (nl.endsWith("?") && nl.split(/\s+/).length <= 25) break;
        if (detectHeadings([nl]).length > 0) break;
        if (isListItem(nl) || isTableRow(nl)) break;
        para += " " + nl;
        i = j;
      }
      items.push({
        type: "section", answer: para,
        category: currentHeading, heading: currentHeading,
        keywords: normalizeText(para).split(/\s+/).filter((w) => w.length > 2),
        order: order++,
      });
    }
  }

  return items;
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
    const providedText = form.get("extractedText") as string | null;
    const text = providedText || await extractText(buf, file.name, file.type || "");

    // Store document
    const docRef = await addDoc(collection(db, "documents"), {
      fileName: file.name, fileType: file.type || "application/octet-stream",
      fileData: base64, fileSize: buf.byteLength,
      content: text.slice(0, 100000),
      projectId, tags: [], uploadedAt: serverTimestamp(),
    });
    const downloadUrl = `/api/download/${docRef.id}`;
    await updateDoc(doc(db, "documents", docRef.id), { fileUrl: downloadUrl });

    // ── Extract knowledge from document ──
    const knowledge = extractKnowledge(text);
    let flowsCreated = 0;
    let chunksCreated = 0;

    // Batch create flows from FAQs
    const faqItems = knowledge.filter((k) => k.type === "faq" && k.question);
    if (faqItems.length > 0) {
      const batch = writeBatch(db);
      for (const item of faqItems) {
        const ref = doc(collection(db, "flows"));
        batch.set(ref, {
          projectId,
          name: item.question!.slice(0, 100),
          triggers: item.keywords.slice(0, 8),
          priority: 0, enabled: true,
          steps: [{ type: "message", message: item.answer }],
          category: item.category || "general",
          source: `document:${docRef.id}`,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        flowsCreated++;
      }
      await batch.commit();
    }

    // Batch create document chunks from all knowledge items (for fallback)
    const chunkItems = knowledge.filter((k) => k.type !== "faq");
    if (chunkItems.length > 0 || faqItems.length > 0) {
      const batch = writeBatch(db);
      const allForChunks = knowledge.map((k, i) => ({
        content: k.question ? `Q: ${k.question}\nA: ${k.answer}` : k.answer,
        category: k.category || "general",
        heading: k.heading || "",
        index: i,
      }));
      for (const item of allForChunks) {
        const ref = doc(collection(db, "document_chunks"));
        batch.set(ref, {
          projectId, documentId: docRef.id,
          content: item.content.slice(0, 1000),
          category: item.category,
          heading: item.heading,
          index: item.index,
          createdAt: serverTimestamp(),
        });
        chunksCreated++;
      }
      await batch.commit();
    }

    logAudit({ action: "upload_document", resource: "document", resourceId: docRef.id, projectId, details: `"${file.name}" uploaded (${file.size}B, ${flowsCreated} flows, ${chunksCreated} chunks)` });

    return r({
      success: true, fileUrl: downloadUrl, id: docRef.id,
      flowsCreated, chunksCreated, knowledgeItems: knowledge.length,
      textLength: text.length, usedProvided: !!providedText,
    });
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
    logAudit({ action: "delete_document", resource: "document", resourceId: docId, details: `Document ${docId} deleted` });
    return r({ success: true });
  } catch (err: any) { return r({ error: err.message }, 500); }
}
