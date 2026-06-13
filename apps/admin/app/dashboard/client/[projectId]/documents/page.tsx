"use client";

import { collection, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { getDb$, getStorage$ } from "@/lib/firebase-client";
import { useEffect, useState, useCallback } from "react";
import { use } from "react";

export default function ClientDocumentsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [docs, setDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(getDb$()!, "documents"), (snap) => {
      setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((d: any) => d.projectId === projectId));
    });
    return unsub;
  }, [projectId]);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", projectId);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
    } finally { setUploading(false); }
  };

  const remove = useCallback(async (d: any) => {
    if (!confirm(`Delete "${d.fileName}"?`)) return;
    try { await deleteObject(ref(getStorage$()!, d.fileUrl)); } catch {}
    await deleteDoc(doc(getDb$()!, "documents", d.id));
  }, []);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Documents</h1>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 transition">
        {uploading ? "Uploading…" : "+ Upload Document"}
        <input type="file" accept=".pdf,.docx,.txt,.md,.csv" className="hidden" onChange={upload} disabled={uploading} />
      </label>
      <div className="mt-6 space-y-2">
        {docs.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-3">
            <div className="flex items-center gap-3">
              <span className="text-lg">📄</span>
              <div><p className="text-sm font-medium">{d.fileName}</p><p className="text-xs text-neutral-500">{d.uploadedAt?.toDate().toLocaleDateString()}</p></div>
            </div>
            <div className="flex items-center gap-3">
              <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline">View</a>
              <button onClick={() => remove(d)} className="text-xs text-red-400 hover:underline">Delete</button>
            </div>
          </div>
        ))}
        {docs.length === 0 && <p className="text-sm text-neutral-500">No documents uploaded yet.</p>}
      </div>
    </div>
  );
}
