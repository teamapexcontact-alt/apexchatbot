import { NextRequest, NextResponse } from "next/server";
import { firebaseConfig } from "@apex/config";
import { initializeApp, getApps } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getFirestore, collection, addDoc, serverTimestamp, writeBatch, doc, deleteDoc } from "firebase/firestore";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function getServerApp() {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

function chunkContent(text: string, size = 500, overlap = 50): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size - overlap;
  }
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

    const app = getServerApp();
    const storage = getStorage(app);
    const db = getFirestore(app);

    const fileName = `${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `documents/${fileName}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadBytes(storageRef, buffer);
    const fileUrl = await getDownloadURL(storageRef);

    const text = await file.text();

    const docRef = await addDoc(collection(db, "documents"), {
      fileName: file.name,
      fileUrl,
      content: text.slice(0, 50000),
      projectId,
      tags: [],
      uploadedAt: serverTimestamp(),
    });

    const chunks = chunkContent(text.slice(0, 50000));
    const batch = writeBatch(db);
    for (let i = 0; i < chunks.length; i++) {
      const chunkRef = doc(collection(db, "document_chunks"));
      batch.set(chunkRef, {
        documentId: docRef.id,
        projectId,
        content: chunks[i],
        index: i,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();

    return NextResponse.json({ success: true, fileUrl, id: docRef.id }, { headers: corsHeaders });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { fileUrl, docId } = await req.json();
    const app = getServerApp();
    const storage = getStorage(app);
    const db = getFirestore(app);

    try { await deleteObject(ref(storage, fileUrl)); } catch {}
    if (docId) await deleteDoc(doc(db, "documents", docId));

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
