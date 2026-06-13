import { NextRequest, NextResponse } from "next/server";
import { firebaseConfig } from "@apex/config";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, question, answer, helpful, messageIndex } = body;
    if (!projectId || question === undefined || answer === undefined) {
      return NextResponse.json({ error: "projectId, question, answer required" }, { status: 400 });
    }

    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const db = getFirestore(app);

    await addDoc(collection(db, "feedback"), {
      projectId,
      question,
      answer,
      helpful,
      messageIndex,
      createdAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Feedback API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
