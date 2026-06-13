"use client";

import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getDb$ } from "@/lib/firebase-client";
import { useEffect, useState, useCallback } from "react";
import type { FAQ } from "@apex/shared";
const defaultForm = { question: "", answer: "", category: "general", keywords: "" };

export default function FAQsPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [editing, setEditing] = useState<FAQ | null>(null);
  const [projectFilter, setProjectFilter] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(getDb$()!, "faqs"), (snap) => {
      setFaqs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FAQ)));
    });
    return unsub;
  }, []);

  const create = useCallback(async () => {
    if (!form.question.trim() || !form.answer.trim()) return;
    await addDoc(collection(getDb$()!, "faqs"), {
      projectId: projectFilter || "default",
      question: form.question,
      answer: form.answer,
      category: form.category,
      keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
      createdAt: serverTimestamp(),
    });
    setForm(defaultForm);
  }, [form, projectFilter]);

  const saveEdit = useCallback(async () => {
    if (!editing || !form.question.trim() || !form.answer.trim()) return;
    await updateDoc(doc(getDb$()!, "faqs", editing.id!), {
      question: form.question,
      answer: form.answer,
      category: form.category,
      keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
    });
    setEditing(null);
    setForm(defaultForm);
  }, [editing, form]);

  const remove = useCallback(async (id: string) => {
    if (!confirm("Delete this FAQ?")) return;
    await deleteDoc(doc(getDb$()!, "faqs", id));
  }, []);

  const startEdit = useCallback((faq: FAQ) => {
    setEditing(faq);
    setForm({
      question: faq.question,
      answer: faq.answer,
      category: faq.category ?? "general",
      keywords: (faq.keywords ?? []).join(", "),
    });
  }, []);

  const filtered = projectFilter
    ? faqs.filter((f) => f.projectId === projectFilter)
    : faqs;

  const projects = [...new Set(faqs.map((f) => f.projectId).filter(Boolean))];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">FAQs</h1>
        <select
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm outline-none"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="mb-6 grid gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4 sm:grid-cols-2">
        <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="Question" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
        <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="Answer" value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} />
        <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="Keywords (comma-separated)" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
        <button onClick={editing ? saveEdit : create} className="sm:col-span-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 transition">
          {editing ? "Save Changes" : "Add FAQ"}
        </button>
        {editing && (
          <button onClick={() => { setEditing(null); setForm(defaultForm); }} className="sm:col-span-2 rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:text-white transition">
            Cancel
          </button>
        )}
      </div>

      <div className="space-y-2">
        {filtered.map((faq) => (
          <div key={faq.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium">{faq.question}</p>
                <p className="mt-1 text-sm text-neutral-400 line-clamp-2">{faq.answer}</p>
                <p className="mt-1 text-xs text-neutral-500">{faq.category} · {faq.keywords?.join(", ") || "no keywords"} · {faq.projectId}</p>
              </div>
              <div className="ml-4 flex gap-2">
                <button onClick={() => startEdit(faq)} className="text-xs text-indigo-400 hover:underline">Edit</button>
                <button onClick={() => remove(faq.id!)} className="text-xs text-red-400 hover:underline">Delete</button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-neutral-500">No FAQs yet. Create one above.</p>}
      </div>
    </div>
  );
}
