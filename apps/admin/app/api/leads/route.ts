import { NextRequest, NextResponse } from "next/server";
import { firebaseConfig } from "@apex/config";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, name, email, phone, company, source } = body;
    if (!projectId || !name || !email || !phone) {
      return NextResponse.json({ error: "projectId, name, email, phone required" }, { status: 400 });
    }

    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const db = getFirestore(app);

    await addDoc(collection(db, "leads"), {
      projectId,
      name,
      email,
      phone,
      company: company || "",
      source: source || "widget",
      contacted: false,
      createdAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Leads API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
