"use client";

import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getDb$ } from "@/lib/firebase-client";
import { useEffect, useState, useCallback } from "react";
import type { FAQ } from "@apex/shared";
import { use } from "react";

const defaultForm = { question: "", answer: "", category: "general", keywords: "" };

export default function ClientFaqsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [editing, setEditing] = useState<FAQ | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(getDb$()!, "faqs"), (snap) => {
      setFaqs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FAQ)).filter((f) => f.projectId === projectId));
    });
    return unsub;
  }, [projectId]);

  const create = useCallback(async () => {
    if (!form.question.trim() || !form.answer.trim()) return;
    await addDoc(collection(getDb$()!, "faqs"), {
      projectId, question: form.question, answer: form.answer, category: form.category,
      keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
      createdAt: serverTimestamp(),
    });
    setForm(defaultForm);
  }, [form, projectId]);

  const saveEdit = useCallback(async () => {
    if (!editing || !form.question.trim() || !form.answer.trim()) return;
    await updateDoc(doc(getDb$()!, "faqs", editing.id!), { question: form.question, answer: form.answer, category: form.category, keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean) });
    setEditing(null);
    setForm(defaultForm);
  }, [editing, form]);

  const remove = useCallback(async (id: string) => {
    if (!confirm("Delete this FAQ?")) return;
    await deleteDoc(doc(getDb$()!, "faqs", id));
  }, []);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">FAQs</h1>
      <div className="mb-6 grid gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4 sm:grid-cols-2">
        <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="Question" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
        <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="Answer" value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} />
        <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="Keywords (comma-separated)" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
        <button onClick={editing ? saveEdit : create} className="sm:col-span-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 transition">
          {editing ? "Save Changes" : "Add FAQ"}
        </button>
        {editing && <button onClick={() => { setEditing(null); setForm(defaultForm); }} className="sm:col-span-2 rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:text-white transition">Cancel</button>}
      </div>
      <div className="space-y-2">
        {faqs.map((faq) => (
          <div key={faq.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium">{faq.question}</p>
                <p className="mt-1 text-sm text-neutral-400 line-clamp-2">{faq.answer}</p>
                <p className="mt-1 text-xs text-neutral-500">{faq.category} · {faq.keywords?.join(", ") || "no keywords"}</p>
              </div>
              <div className="ml-4 flex gap-2 shrink-0">
                <button onClick={() => { setEditing(faq); setForm({ question: faq.question, answer: faq.answer, category: faq.category ?? "general", keywords: (faq.keywords ?? []).join(", ") }); }} className="text-xs text-indigo-400 hover:underline">Edit</button>
                <button onClick={() => remove(faq.id!)} className="text-xs text-red-400 hover:underline">Delete</button>
              </div>
            </div>
          </div>
        ))}
        {faqs.length === 0 && <p className="text-sm text-neutral-500">No FAQs yet.</p>}
      </div>
    </div>
  );
}
