"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getDb$ } from "@/lib/firebase-client";
import type { Project } from "@apex/shared";

export default function WidgetPreviewPage() {
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
    <div className="h-full">
      <h1 className="mb-4 text-2xl font-bold">Widget Preview</h1>

      <div className="mb-6">
        <select
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">Select a project to preview…</option>
          {projects.map((p) => (
            <option key={p.projectId} value={p.projectId}>{p.projectName}</option>
          ))}
        </select>
      </div>

      {selectedId && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <p className="mb-3 text-sm text-neutral-400">
            Preview for <span className="text-white">{project?.projectName}</span> (ID: {selectedId})
          </p>

          <div className="overflow-hidden rounded-lg border border-neutral-800" style={{ height: 500 }}>
            <iframe
              src={`/widget-embed?projectId=${selectedId}`}
              className="h-full w-full border-0"
              title="Widget Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}
