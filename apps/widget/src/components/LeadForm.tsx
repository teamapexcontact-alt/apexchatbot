import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/client";
import { useConfigStore } from "../store/configStore";

interface Props {
  onClose: () => void;
  triggerSource: string;
}

export function LeadForm({ onClose, triggerSource }: Props) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const project = useConfigStore((s) => s.project);

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "leads"), {
        projectId: project?.projectId ?? "default",
        name: form.name,
        email: form.email,
        phone: form.phone,
        company: form.company || "",
        source: triggerSource,
        contacted: false,
        createdAt: serverTimestamp(),
      });
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-center">
        <p className="text-sm font-medium text-green-400">Thanks! We'll get back to you shortly.</p>
        <button onClick={onClose} className="mt-2 text-xs text-neutral-500 hover:text-white transition">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="mb-3 text-sm font-medium">Leave your details</p>
      <div className="space-y-2">
        <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="Phone *" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="Company (optional)" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        <button
          onClick={submit}
          disabled={submitting}
          className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </div>
    </div>
  );
}
