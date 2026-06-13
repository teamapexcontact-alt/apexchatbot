import { NextRequest, NextResponse } from "next/server";
import { firebaseConfig } from "@apex/config";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const db = getFirestore(app);

    const snap = await getDoc(doc(db, "documents", id));
    if (!snap.exists()) {
      return new NextResponse("Not found", { status: 404 });
    }

    const data = snap.data();
    if (!data.fileData) {
      return new NextResponse("No file data", { status: 404 });
    }

    const buf = Buffer.from(data.fileData, "base64");
    return new NextResponse(buf, {
      headers: {
        "Content-Type": data.fileType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${data.fileName || "download"}"`,
        "Content-Length": buf.length.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err: any) {
    console.error("Download error:", err);
    return new NextResponse(err.message, { status: 500 });
  }
}
