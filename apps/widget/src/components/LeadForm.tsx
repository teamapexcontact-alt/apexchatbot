import { useState } from "react";
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
  const { apiUrl, projectId } = useConfigStore();
  const primaryColor = project?.primaryColor ?? "#6366f1";

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`${apiUrl}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          name: form.name,
          email: form.email,
          phone: form.phone,
          company: form.company,
          source: triggerSource,
        }),
      });
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 text-center ring-1 ring-white/[0.04]">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-lg">
          ✓
        </div>
        <p className="text-sm font-medium text-emerald-400">Thanks! We'll get back to you shortly.</p>
        <button
          onClick={onClose}
          className="mt-3 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 ring-1 ring-white/[0.04]">
      <p className="mb-4 text-sm font-semibold text-neutral-200">Leave your details</p>
      <div className="space-y-2.5">
        <input
          className="w-full rounded-xl border border-neutral-800 bg-neutral-950/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-all focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600/30"
          placeholder="Name *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="w-full rounded-xl border border-neutral-800 bg-neutral-950/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-all focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600/30"
          placeholder="Email *"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className="w-full rounded-xl border border-neutral-800 bg-neutral-950/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-all focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600/30"
          placeholder="Phone *"
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <input
          className="w-full rounded-xl border border-neutral-800 bg-neutral-950/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-all focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600/30"
          placeholder="Company (optional)"
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
        />
        <button
          onClick={submit}
          disabled={submitting}
          className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
          style={{ backgroundColor: primaryColor }}
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </div>
    </div>
  );
}
