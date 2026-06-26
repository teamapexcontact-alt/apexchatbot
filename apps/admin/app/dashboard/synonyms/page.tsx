"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getDb$ } from "@/lib/firebase-client";
import { useEffect, useState } from "react";

interface SynonymDict {
  id: string;
  word: string;
  synonyms: string[];
}

export default function SynonymsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [dicts, setDicts] = useState<SynonymDict[]>([]);
  const [word, setWord] = useState("");
  const [syns, setSyns] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const db = getDb$();
    if (!db) return;
    const unsub = onSnapshot(collection(db, "projects"), (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, name: d.data().projectName || d.id })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!selected) { setDicts([]); return; }
    const db = getDb$();
    if (!db) return;
    const unsub = onSnapshot(query(collection(db, "synonyms"), where("projectId", "==", selected)), (snap) => {
      setDicts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SynonymDict)));
    });
    return unsub;
  }, [selected]);

  const save = async () => {
    if (!word.trim() || !selected) return;
    setLoading(true);
    try {
      const body: any = { projectId: selected, word: word.trim(), synonyms: syns.split(",").map((s) => s.trim()).filter(Boolean) };
      if (editing) {
        await fetch("/api/synonyms", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing, ...body }) });
      } else {
        await fetch("/api/synonyms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      setWord(""); setSyns(""); setEditing(null);
    } finally { setLoading(false); }
  };

  const remove = async (d: SynonymDict) => {
    if (!confirm(`Delete synonym "${d.word}"?`)) return;
    await fetch("/api/synonyms", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: d.id, projectId: selected }) });
  };

  const edit = (d: SynonymDict) => {
    setEditing(d.id); setWord(d.word); setSyns(d.synonyms.join(", "));
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Synonym Dictionary</h1>
        <select value={selected} onChange={(e) => { setSelected(e.target.value); setDicts([]); }}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm outline-none">
          <option value="">Select a project…</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {selected && (
        <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="mb-3 text-sm font-medium">{editing ? "Edit" : "Add"} Synonym</h2>
          <div className="flex flex-wrap gap-3">
            <input value={word} onChange={(e) => setWord(e.target.value)}
              placeholder="Word (e.g. admission)" className="flex-1 min-w-[150px] rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
            <input value={syns} onChange={(e) => setSyns(e.target.value)}
              placeholder="Synonyms, comma-separated (e.g. enroll, join, register)"
              className="flex-[2] min-w-[250px] rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
            <button onClick={save} disabled={loading || !word.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40">
              {editing ? "Update" : "Add"}
            </button>
            {editing && <button onClick={() => { setEditing(null); setWord(""); setSyns(""); }}
              className="rounded-lg border border-neutral-600 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800">Cancel</button>}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {dicts.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-3">
            <div>
              <span className="font-medium text-sm">{d.word}</span>
              <span className="ml-3 text-xs text-neutral-500">→ {d.synonyms.join(", ")}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => edit(d)} className="text-xs text-indigo-400 hover:underline">Edit</button>
              <button onClick={() => remove(d)} className="text-xs text-red-400 hover:underline">Delete</button>
            </div>
          </div>
        ))}
        {dicts.length === 0 && selected && (
          <p className="text-sm text-neutral-500">No synonyms defined yet. Add your first one above.</p>
        )}
      </div>
    </div>
  );
}
