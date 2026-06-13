"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { getDb$ } from "@/lib/firebase-client";
import { useEffect, useState } from "react";
import type { Project } from "@apex/shared";

export default function IntegrationPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(getDb$()!, "projects"), (snap) => {
      setProjects(snap.docs.map((d) => ({ ...d.data(), projectId: d.id } as Project)));
    });
    return unsub;
  }, []);

  const project = projects.find((p) => p.projectId === selectedId);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">Integration Guide</h1>

      <div className="mb-6">
        <label className="block text-sm text-neutral-400 mb-2">Select a project:</label>
        <select
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">Choose a project…</option>
          {projects.map((p) => (
            <option key={p.projectId} value={p.projectId}>{p.projectName}</option>
          ))}
        </select>
      </div>

      {project && (
        <div className="space-y-6">
          <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-lg font-semibold mb-1">1. Deploy the Widget</h2>
            <p className="text-sm text-neutral-400 mb-3">
              Upload <code className="text-indigo-300">widget.js</code> and <code className="text-indigo-300">widget.css</code> to a CDN or your server.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-lg font-semibold mb-1">2. Add to Your Website</h2>
            <p className="text-sm text-neutral-400 mb-3">
              Paste this tag just before <code className="text-indigo-300">&lt;/body&gt;</code> on any page:
            </p>
            <div className="rounded-lg bg-neutral-950 p-3 text-sm font-mono text-indigo-300 select-all break-all mb-3">
              {`<script src="https://your-cdn.com/widget.js" data-project-id="${project.projectId}"></script>`}
            </div>
            <p className="text-sm text-neutral-400">
              That&apos;s it. The widget will appear as a floating chat bubble at the bottom-right corner.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-lg font-semibold mb-1">3. With AI Q&A (Optional)</h2>
            <p className="text-sm text-neutral-400 mb-3">
              For document search and AI-powered answers, add the <code className="text-indigo-300">data-api-url</code> attribute:
            </p>
            <div className="rounded-lg bg-neutral-950 p-3 text-sm font-mono text-indigo-300 select-all break-all mb-3">
              {`<script src="https://your-cdn.com/widget.js" data-project-id="${project.projectId}" data-api-url="https://your-api.com"></script>`}
            </div>
          </section>

          <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-lg font-semibold mb-1">4. Customization</h2>
            <div className="space-y-2 text-sm text-neutral-400">
              <p><span className="text-neutral-200">Colors:</span> Set in Admin → Projects → edit the primary color.</p>
              <p><span className="text-neutral-200">FAQs:</span> Add questions and answers in Admin → FAQs.</p>
              <p><span className="text-neutral-200">Documents:</span> Upload files in Admin → Documents for content Q&A.</p>
              <p><span className="text-neutral-200">CTA Links:</span> Configure WhatsApp, pricing, booking links in the project settings.</p>
            </div>
          </section>

          <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-lg font-semibold mb-1">5. Attributes Reference</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm mt-3">
                <thead>
                  <tr className="border-b border-neutral-800 text-left text-neutral-400">
                    <th className="pb-2 pr-4 font-medium">Attribute</th>
                    <th className="pb-2 pr-4 font-medium">Required</th>
                    <th className="pb-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-neutral-800/50">
                    <td className="py-2 pr-4 text-indigo-300 font-mono text-xs">data-project-id</td>
                    <td className="py-2 pr-4">Yes</td>
                    <td className="py-2">Your project ID from Firebase</td>
                  </tr>
                  <tr className="border-b border-neutral-800/50">
                    <td className="py-2 pr-4 text-indigo-300 font-mono text-xs">data-api-url</td>
                    <td className="py-2 pr-4">No</td>
                    <td className="py-2">API base URL for AI/doc search</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {!selectedId && (
        <div className="text-center py-12 text-neutral-500">
          <p className="text-lg mb-2">Select a project to see its integration guide</p>
        </div>
      )}
    </div>
  );
}
