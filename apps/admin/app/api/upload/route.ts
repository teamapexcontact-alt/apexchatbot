import { NextRequest, NextResponse } from "next/server";
import { firebaseConfig } from "@apex/config";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp, writeBatch, doc, deleteDoc, updateDoc } from "firebase/firestore";

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

    const text = await file.text();

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

    return NextResponse.json({ success: true, fileUrl: downloadUrl, id: docRef.id }, { headers: corsHeaders });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { docId } = await req.json();
    const db = getServerDb();

    if (docId) await deleteDoc(doc(db, "documents", docId));
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
