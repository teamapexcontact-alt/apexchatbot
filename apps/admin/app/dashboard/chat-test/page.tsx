"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { getDb$ } from "@/lib/firebase-client";
import { useEffect, useState, useRef } from "react";

interface ChatMessage {
  role: "user" | "bot";
  content: string;
}

interface DebugInfo {
  type?: string;
  matched?: boolean;
  intent?: string | null;
  score?: number;
  source?: string;
}

export default function ChatTestPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [debug, setDebug] = useState<DebugInfo | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const db = getDb$();
    if (!db) return;
    const unsub = onSnapshot(collection(db, "projects"), (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, name: d.data().projectName || d.id })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || !selected || waiting) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setWaiting(true);
    setDebug(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selected, message: text, sessionId: "admin-test" }),
      });
      const data = await res.json();
      setDebug({ type: data.type, matched: data.matched, intent: data.intent, score: data.score, source: data.source });
      setMessages((prev) => [...prev, { role: "bot", content: data.answer || data.error || "No response" }]);
    } catch {
      setMessages((prev) => [...prev, { role: "bot", content: "Request failed" }]);
    }
    setWaiting(false);
  };

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-4">
      {/* ─── Chat Panel ─── */}
      <div className="flex flex-1 flex-col rounded-xl border border-neutral-800 bg-neutral-900/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-neutral-800 px-5 py-3.5">
          <select
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
            value={selected}
            onChange={(e) => { setSelected(e.target.value); setMessages([]); setDebug(null); }}
          >
            <option value="">Select a project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
          </select>
          {selected && (
            <span className="rounded-full bg-green-900/50 px-2.5 py-0.5 text-[11px] text-green-300 font-medium">
              Testing {selected}
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!selected && (
            <div className="flex items-center justify-center pt-20 text-sm text-neutral-500">
              Select a project above to start testing
            </div>
          )}
          {selected && messages.length === 0 && (
            <div className="flex items-center justify-center pt-20 text-sm text-neutral-500">
              Type a message below to test the chatbot
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user" ? "rounded-br-md bg-indigo-600 text-white" : "rounded-bl-md bg-neutral-800 text-neutral-100"
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {waiting && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-neutral-800 px-4 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" style={{ animationDelay: "0.15s" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" style={{ animationDelay: "0.3s" }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-neutral-800 p-3">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
              placeholder={selected ? "Type a test message…" : "Select a project first"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              disabled={!selected || waiting}
            />
            <button
              onClick={send}
              disabled={!input.trim() || !selected || waiting}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* ─── Debug Panel ─── */}
      <div className="w-72 shrink-0 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 overflow-y-auto hidden lg:block">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Response Info</h3>
        {debug ? (
          <div className="space-y-2.5 text-sm">
            <div className="rounded-lg bg-neutral-950 p-3">
              <p className="text-[10px] uppercase text-neutral-500 mb-1">Type</p>
              <span className={`font-medium ${
                debug.type === "faq" ? "text-cyan-400" :
                debug.type === "document" ? "text-amber-400" :
                debug.type === "order" ? "text-green-400" :
                debug.type === "fallback" ? "text-red-400" : "text-neutral-300"
              }`}>
                {debug.type || "—"}
              </span>
            </div>
            <div className="rounded-lg bg-neutral-950 p-3">
              <p className="text-[10px] uppercase text-neutral-500 mb-1">Matched</p>
              <span className={`font-medium ${debug.matched ? "text-green-400" : "text-red-400"}`}>
                {debug.matched ? "✅ Yes" : "❌ No"}
              </span>
            </div>
            {debug.intent !== undefined && (
              <div className="rounded-lg bg-neutral-950 p-3">
                <p className="text-[10px] uppercase text-neutral-500 mb-1">Intent</p>
                <p className="font-mono text-xs text-neutral-300">{debug.intent || "null"}</p>
              </div>
            )}
            {debug.score !== undefined && (
              <div className="rounded-lg bg-neutral-950 p-3">
                <p className="text-[10px] uppercase text-neutral-500 mb-1">Score</p>
                <p className="font-mono text-xs text-neutral-300">{debug.score?.toFixed(4)}</p>
              </div>
            )}
            {debug.source && (
              <div className="rounded-lg bg-neutral-950 p-3">
                <p className="text-[10px] uppercase text-neutral-500 mb-1">Source</p>
                <p className="text-xs text-neutral-300 break-words">{debug.source}</p>
              </div>
            )}
            <div className="rounded-lg bg-neutral-950 p-3">
              <p className="text-[10px] uppercase text-neutral-500 mb-1">Raw</p>
              <pre className="text-[10px] text-neutral-400 break-all whitespace-pre-wrap">{JSON.stringify(debug, null, 2)}</pre>
            </div>
          </div>
        ) : (
          <p className="text-xs text-neutral-600">Send a message to see response details</p>
        )}
      </div>
    </div>
  );
}
