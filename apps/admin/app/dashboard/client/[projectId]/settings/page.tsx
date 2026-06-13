"use client";

import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { getDb$ } from "@/lib/firebase-client";
import { useEffect, useState } from "react";
import type { Project } from "@apex/shared";
import { use } from "react";

export default function ClientSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(getDb$()!, "projects", projectId), (snap) => {
      if (snap.exists()) setProject({ projectId: snap.id, ...snap.data() } as Project);
    });
    return unsub;
  }, [projectId]);

  const save = async () => {
    if (!project) return;
    setSaving(true);
    await updateDoc(doc(getDb$()!, "projects", projectId), {
      projectName: project.projectName,
      primaryColor: project.primaryColor,
      welcomeMessage: project.welcomeMessage,
      whatsappLink: project.whatsappLink,
      logoUrl: project.logoUrl,
      ctaConfig: project.ctaConfig,
      updatedAt: serverTimestamp(),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!project) return <div className="text-sm text-neutral-500 py-8">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-xl font-bold">Chatbot Settings</h1>

      <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Project Name</label>
          <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" value={project.projectName} onChange={(e) => setProject({ ...project, projectName: e.target.value })} />
        </div>
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Primary Color</label>
            <div className="flex items-center gap-2">
              <input type="color" className="h-9 w-9 cursor-pointer rounded border border-neutral-700" value={project.primaryColor} onChange={(e) => setProject({ ...project, primaryColor: e.target.value })} />
              <span className="text-xs text-neutral-500">{project.primaryColor}</span>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-sm text-neutral-400 mb-1">Logo URL</label>
            <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="https://..." value={project.logoUrl || ""} onChange={(e) => setProject({ ...project, logoUrl: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Welcome Message</label>
          <textarea className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" rows={2} value={project.welcomeMessage || ""} onChange={(e) => setProject({ ...project, welcomeMessage: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1">WhatsApp Link</label>
          <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="https://wa.me/..." value={project.whatsappLink || ""} onChange={(e) => setProject({ ...project, whatsappLink: e.target.value })} />
        </div>
        <div className="border-t border-neutral-800 pt-4">
          <h3 className="text-sm font-medium mb-3">CTA Buttons</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">View Pricing URL</label>
              <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" value={project.ctaConfig?.viewPricingUrl || ""} onChange={(e) => setProject({ ...project, ctaConfig: { ...project.ctaConfig, viewPricingUrl: e.target.value } })} />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Enroll Now URL</label>
              <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" value={project.ctaConfig?.enrollNowUrl || ""} onChange={(e) => setProject({ ...project, ctaConfig: { ...project.ctaConfig, enrollNowUrl: e.target.value } })} />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Book a Call URL</label>
              <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="https://calendly.com/..." value={project.ctaConfig?.bookCallUrl || ""} onChange={(e) => setProject({ ...project, ctaConfig: { ...project.ctaConfig, bookCallUrl: e.target.value } })} />
            </div>
          </div>
        </div>
        <button onClick={save} disabled={saving} className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium hover:bg-indigo-500 transition disabled:opacity-50">
          {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-sm font-medium mb-3">Embed Code</h2>
        <code className="block select-all break-all rounded bg-neutral-950 p-3 text-xs text-indigo-300 leading-relaxed">
          {`<script src="https://your-cdn.com/widget.js" data-project-id="${projectId}"></script>`}
        </code>
        <p className="mt-2 text-xs text-neutral-500">Place this just before &lt;/body&gt; on your website.</p>
      </div>
    </div>
  );
}
