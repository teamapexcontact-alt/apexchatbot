import { NextRequest, NextResponse } from "next/server";
import { firebaseConfig } from "@apex/config";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp, doc, deleteDoc, updateDoc } from "firebase/firestore";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function getDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getFirestore(app);
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const projectId = (form.get("projectId") as string) || "default";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400, headers: corsHeaders });
    }

    const buf = await file.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");

    if (base64.length > 850_000) {
      return NextResponse.json(
        { error: `File too large (${(base64.length / 1024).toFixed(0)} KB base64). Max ~650 KB file.` },
        { status: 413, headers: corsHeaders }
      );
    }

    const db = getDb();
    const docRef = await addDoc(collection(db, "documents"), {
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileData: base64,
      fileSize: buf.byteLength,
      projectId,
      tags: [],
      uploadedAt: serverTimestamp(),
    });

    const downloadUrl = `/api/download/${docRef.id}`;
    await updateDoc(doc(db, "documents", docRef.id), { fileUrl: downloadUrl });

    return NextResponse.json({ success: true, fileUrl: downloadUrl, id: docRef.id }, { headers: corsHeaders });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { docId } = await req.json();
    if (docId) {
      await deleteDoc(doc(getDb(), "documents", docId));
    }
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
