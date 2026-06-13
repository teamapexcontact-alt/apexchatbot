"use client";

import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getDb$, getStorage$ } from "@/lib/firebase-client";
import { useEffect, useState, useCallback } from "react";

interface Doc {
  id: string;
  fileName: string;
  fileUrl: string;
  tags: string[];
  projectId: string;
  uploadedAt: { toDate: () => Date };
}

function chunkContent(text: string, size = 500, overlap = 50): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size - overlap;
  }
  return chunks.filter((c) => c.trim().length > 20);
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [projectFilter, setProjectFilter] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(getDb$()!, "documents"), (snap) => {
      setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Doc)));
    });
    return unsub;
  }, []);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const storageRef = ref(getStorage$()!, `documents/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(storageRef);
      const text = await file.text();
      const projectId = projectFilter || "default";

      const docRef = await addDoc(collection(getDb$()!, "documents"), {
        fileName: file.name,
        fileUrl,
        content: text.slice(0, 50000),
        projectId,
        tags: [],
        uploadedAt: serverTimestamp(),
      });

      const chunks = chunkContent(text.slice(0, 50000));
      const batch = writeBatch(getDb$()!);
      for (let i = 0; i < chunks.length; i++) {
        const chunkRef = doc(collection(getDb$()!, "document_chunks"));
        batch.set(chunkRef, {
          documentId: docRef.id,
          projectId,
          content: chunks[i],
          index: i,
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } finally {
      setUploading(false);
    }
  };

  const remove = useCallback(async (d: Doc) => {
    if (!confirm(`Delete "${d.fileName}"?`)) return;
    try { await deleteObject(ref(getStorage$()!, d.fileUrl)); } catch {}
    await deleteDoc(doc(getDb$()!, "documents", d.id));
  }, []);

  const filtered = projectFilter ? docs.filter((d) => d.projectId === projectFilter) : docs;
  const projects = [...new Set(docs.map((d) => d.projectId).filter(Boolean))];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Documents</h1>
        <select
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm outline-none"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 transition">
        {uploading ? "Uploading…" : "+ Upload Document"}
        <input type="file" accept=".pdf,.docx,.txt,.md,.csv" className="hidden" onChange={upload} disabled={uploading} />
      </label>

      <div className="mt-6 space-y-2">
        {filtered.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-3">
            <div className="flex items-center gap-3">
              <span className="text-lg">📄</span>
              <div>
                <p className="text-sm font-medium">{d.fileName}</p>
                <p className="text-xs text-neutral-500">{d.projectId} · {d.uploadedAt?.toDate().toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline">View</a>
              <button onClick={() => remove(d)} className="text-xs text-red-400 hover:underline">Delete</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-neutral-500">No documents uploaded yet.</p>}
      </div>
    </div>
  );
}
