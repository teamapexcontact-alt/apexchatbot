import { NextRequest, NextResponse } from "next/server";
import { firebaseConfig } from "@apex/config";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const db = getFirestore(app);

    const snap = await getDocs(query(collection(db, "faqs"), where("projectId", "==", projectId)));
    const faqs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ faqs });
  } catch (err: any) {
    console.error("FAQs API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
