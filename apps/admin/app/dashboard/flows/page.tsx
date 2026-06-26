"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { getDb$ } from "@/lib/firebase-client";
import { useEffect, useState } from "react";

interface Step {
  type: "message" | "buttons" | "collect_input" | "condition" | "transfer" | "end"
    | "api_call" | "webhook" | "email" | "delay" | "db_query"
    | "whatsapp" | "payment" | "notification" | "custom_function";
  message?: string;
  buttons?: { label: string; action: "next" | "goto_flow"; flowId?: string }[];
  collect?: { key: string; label: string; validation?: "text" | "email" | "phone" | "number" };
  condition?: { variable: string; equals: string; gotoStep?: number; elseStep?: number };
  gotoStep?: number;
  apiCall?: { url: string; method: "GET" | "POST"; headers?: string; body?: string; responseVar?: string };
  webhook?: { url: string; method: string; headers?: string; payload?: string; responseVar?: string };
  email?: { to: string; subject: string; body: string; cc?: string };
  delay?: { seconds: number };
  dbQuery?: { query: string; params?: string; responseVar?: string };
  whatsapp?: { templateName: string; to: string; params?: string };
  payment?: { amount: number; currency: string; description: string; responseVar?: string };
  notification?: { type: "email" | "sms" | "push"; to: string; title?: string; body: string };
  customFn?: { functionName: string; params?: string; responseVar?: string };
}

interface Flow {
  id: string; name: string; triggers: string[]; priority: number;
  steps: Step[]; enabled: boolean; projectId: string;
}

const STEP_TYPES = [
  "message", "buttons", "collect_input", "condition", "transfer", "end",
  "api_call", "webhook", "email", "delay", "db_query",
  "whatsapp", "payment", "notification", "custom_function",
] as const;

function emptyStep(type: Step["type"]): Step {
  const base: Step = { type } as Step;
  if (type === "message") base.message = "";
  if (type === "buttons") { base.message = ""; base.buttons = []; }
  if (type === "collect_input") base.collect = { key: "", label: "" };
  if (type === "condition") base.condition = { variable: "", equals: "", gotoStep: 0, elseStep: 0 };
  if (type === "end") base.message = "Thank you!";
  if (type === "transfer") base.message = "Let me connect you with our team.";
  if (type === "api_call") base.apiCall = { url: "", method: "GET" };
  if (type === "webhook") base.webhook = { url: "", method: "POST" };
  if (type === "email") base.email = { to: "", subject: "", body: "" };
  if (type === "delay") base.delay = { seconds: 2 };
  if (type === "db_query") base.dbQuery = { query: "" };
  if (type === "whatsapp") base.whatsapp = { templateName: "", to: "" };
  if (type === "payment") base.payment = { amount: 0, currency: "USD", description: "" };
  if (type === "notification") base.notification = { type: "email", to: "", body: "" };
  if (type === "custom_function") base.customFn = { functionName: "" };
  return base;
}

export default function FlowsPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [editing, setEditing] = useState<Flow | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const db = getDb$();
    if (!db) return;
    const unsubFlows = onSnapshot(collection(db, "flows"), (snap) => {
      setFlows(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Flow)));
    });
    const unsubProjects = onSnapshot(collection(db, "projects"), (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, name: d.data().projectName || d.id })));
    });
    return () => { unsubFlows(); unsubProjects(); };
  }, []);

  const filtered = projectFilter ? flows.filter((f) => f.projectId === projectFilter) : flows;

  const createFlow = async () => {
    if (!projectFilter) return alert("Select a project first");
    const name = prompt("Flow name:");
    if (!name) return;
    setSaving(true);
    await fetch("/api/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: projectFilter, name, triggers: [], priority: 0, steps: [emptyStep("message")] }),
    });
    setSaving(false);
  };

  const saveFlow = async (flow: Flow) => {
    setSaving(true);
    await fetch("/api/flows", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(flow),
    });
    setSaving(false);
    setEditing(null);
  };

  const deleteFlow = async (id: string) => {
    if (!confirm("Delete this flow?")) return;
    await fetch("/api/flows", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  };

  const addStep = (flow: Flow, type: Step["type"]) => setEditing({ ...flow, steps: [...flow.steps, emptyStep(type)] });
  const removeStep = (flow: Flow, idx: number) => setEditing({ ...flow, steps: flow.steps.filter((_, i) => i !== idx) });
  const updateStep = (flow: Flow, idx: number, step: Step) => { const s = [...flow.steps]; s[idx] = step; setEditing({ ...flow, steps: s }); };
  const moveStep = (flow: Flow, idx: number, dir: "up" | "down") => {
    const steps = [...flow.steps];
    const t = idx + (dir === "up" ? -1 : 1);
    if (t < 0 || t >= steps.length) return;
    [steps[idx], steps[t]] = [steps[t], steps[idx]];
    setEditing({ ...flow, steps });
  };

  if (editing) {
    const flow = editing;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Edit: {flow.name}</h1>
          <div className="flex gap-2">
            <button onClick={() => setEditing(null)} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm">Cancel</button>
            <button onClick={() => saveFlow(flow)} disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase text-neutral-500">Name</label>
            <input className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm" value={flow.name} onChange={(e) => setEditing({ ...flow, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs uppercase text-neutral-500">Priority (higher = wins)</label>
            <input type="number" className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm" value={flow.priority} onChange={(e) => setEditing({ ...flow, priority: Number(e.target.value) })} />
          </div>
        </div>

        <div>
          <label className="text-xs uppercase text-neutral-500">Trigger keywords (one per line)</label>
          <textarea className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm" rows={3}
            value={flow.triggers.join("\n")}
            onChange={(e) => setEditing({ ...flow, triggers: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase text-neutral-500">Steps ({flow.steps.length})</h2>
            <div className="flex flex-wrap gap-1 max-w-3xl justify-end">
              {STEP_TYPES.map((t) => (
                <button key={t} onClick={() => addStep(flow, t)} className="rounded-lg bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-700 whitespace-nowrap">
                  + {t.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {flow.steps.map((step, i) => (
              <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-mono text-cyan-400">Step {i + 1}: {step.type.replace(/_/g, " ")}</span>
                  <div className="flex gap-1">
                    <button onClick={() => moveStep(flow, i, "up")} disabled={i === 0} className="text-xs text-neutral-500 hover:text-white disabled:opacity-30">▲</button>
                    <button onClick={() => moveStep(flow, i, "down")} disabled={i === flow.steps.length - 1} className="text-xs text-neutral-500 hover:text-white disabled:opacity-30">▼</button>
                    <button onClick={() => removeStep(flow, i)} className="text-xs text-red-500 hover:text-red-400">✕</button>
                  </div>
                </div>
                <StepEditor step={step} onChange={(s) => updateStep(flow, i, s)} flowId={flow.id} allFlows={flows} />
              </div>
            ))}
            {flow.steps.length === 0 && <p className="text-sm text-neutral-500">No steps. Add one above.</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Flows</h1>
        <div className="flex gap-2">
          <select className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="">All Projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
          </select>
          <button onClick={createFlow} disabled={!projectFilter || saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50">
            + New Flow
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-3">
            <div>
              <p className="text-sm font-medium">{f.name}</p>
              <p className="text-xs text-neutral-500">
                {f.triggers.length} triggers · {f.steps.length} steps · priority {f.priority} · {f.enabled ? "enabled" : "disabled"}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing({ ...f })} className="text-xs text-indigo-400 hover:underline">Edit</button>
              <button onClick={() => deleteFlow(f.id)} className="text-xs text-red-400 hover:underline">Delete</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-neutral-500">No flows yet. Select a project and create one.</p>}
      </div>
    </div>
  );
}

// ── Step Editor ──
function StepEditor({ step, onChange, flowId, allFlows }: { step: Step; onChange: (s: Step) => void; flowId: string; allFlows: Flow[] }) {
  if (step.type === "message") {
    return (
      <div className="space-y-2">
        <textarea className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" rows={2} value={step.message || ""}
          onChange={(e) => onChange({ ...step, message: e.target.value })} placeholder="Message text (use {{variable}} for personalization)" />
        <div>
          <label className="text-xs text-neutral-500">Auto-advance to step (leave empty for next)</label>
          <input type="number" className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" value={step.gotoStep ?? ""}
            onChange={(e) => onChange({ ...step, gotoStep: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
      </div>
    );
  }

  if (step.type === "buttons") {
    return (
      <div className="space-y-2">
        <textarea className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" rows={2} value={step.message || ""}
          onChange={(e) => onChange({ ...step, message: e.target.value })} placeholder="Message text" />
        <p className="text-xs text-neutral-500">Buttons:</p>
        {(step.buttons || []).map((btn, bi) => (
          <div key={bi} className="flex gap-2 items-center">
            <input className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Label" value={btn.label}
              onChange={(e) => { const b = [...(step.buttons || [])]; b[bi] = { ...b[bi], label: e.target.value }; onChange({ ...step, buttons: b }); }} />
            <select className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" value={btn.action}
              onChange={(e) => { const b = [...(step.buttons || [])]; b[bi] = { ...b[bi], action: e.target.value as any }; onChange({ ...step, buttons: b }); }}>
              <option value="next">Next step</option>
              <option value="goto_flow">Go to flow</option>
            </select>
            {btn.action === "goto_flow" && (
              <select className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" value={btn.flowId || ""}
                onChange={(e) => { const b = [...(step.buttons || [])]; b[bi] = { ...b[bi], flowId: e.target.value }; onChange({ ...step, buttons: b }); }}>
                <option value="">Select flow...</option>
                {allFlows.filter((f) => f.id !== flowId).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            )}
            <button onClick={() => onChange({ ...step, buttons: (step.buttons || []).filter((_, i) => i !== bi) })} className="text-xs text-red-500">✕</button>
          </div>
        ))}
        <button onClick={() => onChange({ ...step, buttons: [...(step.buttons || []), { label: "", action: "next" }] })} className="text-xs text-indigo-400 hover:underline">+ Add button</button>
      </div>
    );
  }

  if (step.type === "collect_input") {
    return (
      <div className="grid grid-cols-3 gap-2">
        <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Variable key" value={step.collect?.key || ""}
          onChange={(e) => onChange({ ...step, collect: { ...step.collect!, key: e.target.value, label: step.collect?.label || "", validation: step.collect?.validation } })} />
        <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Label" value={step.collect?.label || ""}
          onChange={(e) => onChange({ ...step, collect: { ...step.collect!, key: step.collect?.key || "", label: e.target.value, validation: step.collect?.validation } })} />
        <select className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" value={step.collect?.validation || ""}
          onChange={(e) => onChange({ ...step, collect: { ...step.collect!, key: step.collect?.key || "", label: step.collect?.label || "", validation: e.target.value as any } })}>
          <option value="">Any text</option>
          <option value="email">Email</option>
          <option value="phone">Phone</option>
          <option value="number">Number</option>
        </select>
        <div className="col-span-3">
          <textarea className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" rows={2} value={step.message || ""}
            onChange={(e) => onChange({ ...step, message: e.target.value })} placeholder="Message asking for this input" />
        </div>
      </div>
    );
  }

  if (step.type === "condition") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Variable name" value={step.condition?.variable || ""}
          onChange={(e) => onChange({ ...step, condition: { ...step.condition!, variable: e.target.value, equals: step.condition?.equals || "" } })} />
        <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Equals value" value={step.condition?.equals || ""}
          onChange={(e) => onChange({ ...step, condition: { ...step.condition!, variable: step.condition?.variable || "", equals: e.target.value } })} />
        <div><label className="text-xs text-neutral-500">If match → step</label>
          <input type="number" className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" value={step.condition?.gotoStep ?? ""}
            onChange={(e) => onChange({ ...step, condition: { ...step.condition!, gotoStep: e.target.value ? Number(e.target.value) : undefined } })} /></div>
        <div><label className="text-xs text-neutral-500">Else → step</label>
          <input type="number" className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" value={step.condition?.elseStep ?? ""}
            onChange={(e) => onChange({ ...step, condition: { ...step.condition!, elseStep: e.target.value ? Number(e.target.value) : undefined } })} /></div>
      </div>
    );
  }

  if (step.type === "transfer") {
    return <textarea className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" rows={2} value={step.message || ""}
      onChange={(e) => onChange({ ...step, message: e.target.value })} placeholder="Transfer message" />;
  }

  if (step.type === "end") {
    return <textarea className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" rows={2} value={step.message || ""}
      onChange={(e) => onChange({ ...step, message: e.target.value })} placeholder="Ending message" />;
  }

  // ── New Step Types ──

  if (step.type === "api_call") {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <select className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" value={step.apiCall?.method || "GET"}
            onChange={(e) => onChange({ ...step, apiCall: { ...step.apiCall!, method: e.target.value as any } })}>
            <option value="GET">GET</option><option value="POST">POST</option>
          </select>
          <input className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="URL" value={step.apiCall?.url || ""}
            onChange={(e) => onChange({ ...step, apiCall: { ...step.apiCall!, url: e.target.value } })} />
        </div>
        <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Headers (JSON)" value={step.apiCall?.headers || ""}
          onChange={(e) => onChange({ ...step, apiCall: { ...step.apiCall!, headers: e.target.value } })} />
        <textarea className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" rows={2} placeholder="Body (JSON, supports {{variables}})" value={step.apiCall?.body || ""}
          onChange={(e) => onChange({ ...step, apiCall: { ...step.apiCall!, body: e.target.value } })} />
        <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Store response in variable (e.g. api_result)" value={step.apiCall?.responseVar || ""}
          onChange={(e) => onChange({ ...step, apiCall: { ...step.apiCall!, responseVar: e.target.value } })} />
      </div>
    );
  }

  if (step.type === "webhook") {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <input className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Webhook URL" value={step.webhook?.url || ""}
            onChange={(e) => onChange({ ...step, webhook: { ...step.webhook!, url: e.target.value } })} />
          <input className="w-20 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Method" value={step.webhook?.method || "POST"}
            onChange={(e) => onChange({ ...step, webhook: { ...step.webhook!, method: e.target.value } })} />
        </div>
        <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Headers (JSON)" value={step.webhook?.headers || ""}
          onChange={(e) => onChange({ ...step, webhook: { ...step.webhook!, headers: e.target.value } })} />
        <textarea className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" rows={2} placeholder="Payload (JSON, supports {{variables}})" value={step.webhook?.payload || ""}
          onChange={(e) => onChange({ ...step, webhook: { ...step.webhook!, payload: e.target.value } })} />
        <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Store response in variable" value={step.webhook?.responseVar || ""}
          onChange={(e) => onChange({ ...step, webhook: { ...step.webhook!, responseVar: e.target.value } })} />
      </div>
    );
  }

  if (step.type === "email") {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="To ({{variable}})" value={step.email?.to || ""}
            onChange={(e) => onChange({ ...step, email: { ...step.email!, to: e.target.value } })} />
          <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="CC" value={step.email?.cc || ""}
            onChange={(e) => onChange({ ...step, email: { ...step.email!, cc: e.target.value } })} />
        </div>
        <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Subject" value={step.email?.subject || ""}
          onChange={(e) => onChange({ ...step, email: { ...step.email!, subject: e.target.value } })} />
        <textarea className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" rows={3} placeholder="Email body" value={step.email?.body || ""}
          onChange={(e) => onChange({ ...step, email: { ...step.email!, body: e.target.value } })} />
      </div>
    );
  }

  if (step.type === "delay") {
    return (
      <div>
        <input type="number" className="w-32 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Seconds" value={step.delay?.seconds || 1}
          onChange={(e) => onChange({ ...step, delay: { seconds: Number(e.target.value) || 1 } })} />
        <p className="mt-1 text-xs text-neutral-500">Pauses execution for this many seconds</p>
      </div>
    );
  }

  if (step.type === "db_query") {
    return (
      <div className="space-y-2">
        <textarea className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" rows={2} placeholder="Database query (SQL or API query)" value={step.dbQuery?.query || ""}
          onChange={(e) => onChange({ ...step, dbQuery: { ...step.dbQuery!, query: e.target.value } })} />
        <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Params (comma-separated, supports {{variables}})" value={step.dbQuery?.params || ""}
          onChange={(e) => onChange({ ...step, dbQuery: { ...step.dbQuery!, params: e.target.value } })} />
        <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Store result in variable" value={step.dbQuery?.responseVar || ""}
          onChange={(e) => onChange({ ...step, dbQuery: { ...step.dbQuery!, responseVar: e.target.value } })} />
      </div>
    );
  }

  if (step.type === "whatsapp") {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Template name" value={step.whatsapp?.templateName || ""}
            onChange={(e) => onChange({ ...step, whatsapp: { ...step.whatsapp!, templateName: e.target.value } })} />
          <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="To (phone, {{variable}})" value={step.whatsapp?.to || ""}
            onChange={(e) => onChange({ ...step, whatsapp: { ...step.whatsapp!, to: e.target.value } })} />
        </div>
        <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Template params (comma-separated)" value={step.whatsapp?.params || ""}
          onChange={(e) => onChange({ ...step, whatsapp: { ...step.whatsapp!, params: e.target.value } })} />
      </div>
    );
  }

  if (step.type === "payment") {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <input type="number" className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Amount" value={step.payment?.amount || ""}
            onChange={(e) => onChange({ ...step, payment: { ...step.payment!, amount: Number(e.target.value) || 0 } })} />
          <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Currency (USD)" value={step.payment?.currency || "USD"}
            onChange={(e) => onChange({ ...step, payment: { ...step.payment!, currency: e.target.value } })} />
          <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Response variable" value={step.payment?.responseVar || ""}
            onChange={(e) => onChange({ ...step, payment: { ...step.payment!, responseVar: e.target.value } })} />
        </div>
        <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Description" value={step.payment?.description || ""}
          onChange={(e) => onChange({ ...step, payment: { ...step.payment!, description: e.target.value } })} />
      </div>
    );
  }

  if (step.type === "notification") {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <select className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" value={step.notification?.type || "email"}
            onChange={(e) => onChange({ ...step, notification: { ...step.notification!, type: e.target.value as any } })}>
            <option value="email">Email</option><option value="sms">SMS</option><option value="push">Push</option>
          </select>
          <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="To" value={step.notification?.to || ""}
            onChange={(e) => onChange({ ...step, notification: { ...step.notification!, to: e.target.value } })} />
          <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Title" value={step.notification?.title || ""}
            onChange={(e) => onChange({ ...step, notification: { ...step.notification!, title: e.target.value } })} />
        </div>
        <textarea className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" rows={2} placeholder="Body" value={step.notification?.body || ""}
          onChange={(e) => onChange({ ...step, notification: { ...step.notification!, body: e.target.value } })} />
      </div>
    );
  }

  if (step.type === "custom_function") {
    return (
      <div className="space-y-2">
        <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Function name (registered via plugin)" value={step.customFn?.functionName || ""}
          onChange={(e) => onChange({ ...step, customFn: { ...step.customFn!, functionName: e.target.value } })} />
        <textarea className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" rows={2} placeholder='Params (JSON, e.g. {"key":"{{variable}}"})' value={step.customFn?.params || ""}
          onChange={(e) => onChange({ ...step, customFn: { ...step.customFn!, params: e.target.value } })} />
        <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Store result in variable" value={step.customFn?.responseVar || ""}
          onChange={(e) => onChange({ ...step, customFn: { ...step.customFn!, responseVar: e.target.value } })} />
      </div>
    );
  }

  return null;
}
