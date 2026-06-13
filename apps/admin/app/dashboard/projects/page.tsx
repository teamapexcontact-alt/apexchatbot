"use client";

import { collection, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { getDb$ } from "@/lib/firebase-client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Project } from "@apex/shared";

const defaultForm = { projectName: "", primaryColor: "#6366f1", welcomeMessage: "", whatsappLink: "" };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(getDb$()!, "projects"), (snap) => {
      setProjects(snap.docs.map((d) => ({ ...d.data(), projectId: d.id } as Project)));
    });
    return unsub;
  }, []);

  const create = useCallback(async () => {
    if (!form.projectName.trim()) return;
    await addDoc(collection(getDb$()!, "projects"), {
      projectName: form.projectName,
      domains: [],
      primaryColor: form.primaryColor,
      logoUrl: "",
      welcomeMessage: form.welcomeMessage || "Hi! How can I help you?",
      whatsappLink: form.whatsappLink,
      ctaConfig: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setForm(defaultForm);
  }, [form]);

  const remove = useCallback(async (id: string) => {
    if (!confirm("Delete this project and ALL its FAQs, documents, leads, analytics, and conversations? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert("Delete failed: " + (data.error || "Unknown error"));
      }
    } catch (e: any) {
      alert("Delete failed: " + e.message);
    }
  }, []);

  const copyEmbed = useCallback(async (projectId: string) => {
    const code = `<script src="https://your-cdn.com/widget.js" data-project-id="${projectId}"></script>`;
    await navigator.clipboard.writeText(code);
    setCopiedId(projectId);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const copyApiEmbed = useCallback(async (projectId: string, apiUrl: string) => {
    const code = `<script src="https://your-cdn.com/widget.js" data-project-id="${projectId}" data-api-url="${apiUrl}"></script>`;
    await navigator.clipboard.writeText(code);
    setCopiedId(`api-${projectId}`);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
      </div>

      <details className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-neutral-300 hover:text-white select-none">
          + New Project
        </summary>
        <div className="grid gap-3 border-t border-neutral-800 p-4 sm:grid-cols-2">
          <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="Project name" value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} />
          <div className="flex items-center gap-2">
            <input type="color" className="h-8 w-8 cursor-pointer rounded border border-neutral-700" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
            <span className="text-xs text-neutral-500">{form.primaryColor}</span>
          </div>
          <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500 sm:col-span-2" placeholder="WhatsApp link (optional)" value={form.whatsappLink} onChange={(e) => setForm({ ...form, whatsappLink: e.target.value })} />
          <textarea className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500 sm:col-span-2" placeholder="Welcome message" rows={2} value={form.welcomeMessage} onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })} />
          <button onClick={create} className="sm:col-span-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 transition">Create Project</button>
        </div>
      </details>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => (
          <div key={p.projectId} className="group rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition hover:border-neutral-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full ring-2 ring-offset-1 ring-offset-neutral-900" style={{ backgroundColor: p.primaryColor }} />
                <p className="font-medium truncate">{p.projectName}</p>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                <Link href={`/dashboard/client/${p.projectId}/faqs`} className="text-xs text-indigo-400 hover:underline">Manage</Link>
                <button onClick={() => remove(p.projectId!)} className="text-xs text-red-400 hover:underline">Delete</button>
              </div>
            </div>
            <p className="text-[11px] text-neutral-500 font-mono mb-3">ID: {p.projectId}</p>

            <div className="space-y-2 border-t border-neutral-800 pt-3">
              <p className="text-xs text-neutral-400 font-medium">Embed code (basic):</p>
              <code className="block select-all break-all rounded bg-neutral-950 p-2 text-[11px] text-indigo-300 leading-relaxed">
                {`<script src="https://your-cdn.com/widget.js" data-project-id="${p.projectId}"></script>`}
              </code>
              <button onClick={() => copyEmbed(p.projectId!)} className="w-full rounded-lg border border-neutral-700 py-1.5 text-xs text-neutral-400 hover:text-white hover:border-neutral-600 transition">
                {copiedId === p.projectId ? "Copied!" : "Copy embed code"}
              </button>

              <p className="text-xs text-neutral-400 font-medium mt-2">With API (AI Q&A):</p>
              <code className="block select-all break-all rounded bg-neutral-950 p-2 text-[11px] text-indigo-300 leading-relaxed">
                {`<script src="https://your-cdn.com/widget.js" data-project-id="${p.projectId}" data-api-url="https://your-api.com"></script>`}
              </code>
              <button onClick={() => copyApiEmbed(p.projectId!, "https://your-api.com")} className="w-full rounded-lg border border-neutral-700 py-1.5 text-xs text-neutral-400 hover:text-white hover:border-neutral-600 transition">
                {copiedId === `api-${p.projectId}` ? "Copied!" : "Copy with API"}
              </button>
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <div className="col-span-full text-center py-12 text-neutral-500">
            <p className="text-lg mb-2">No projects yet</p>
            <p className="text-sm">Click "New Project" above to create one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
