"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { getDb$ } from "@/lib/firebase-client";
import { useEffect, useState, useCallback } from "react";

interface Step {
  type: "message" | "buttons" | "collect_input" | "condition" | "transfer" | "end";
  message?: string;
  buttons?: { label: string; action: "next" | "goto_flow"; flowId?: string }[];
  collect?: { key: string; label: string; validation?: "text" | "email" | "phone" | "number" };
  condition?: { variable: string; equals: string; gotoStep?: number; elseStep?: number };
  gotoStep?: number;
}

interface Flow {
  id: string;
  name: string;
  triggers: string[];
  priority: number;
  steps: Step[];
  enabled: boolean;
  projectId: string;
}

const STEP_TYPES = ["message", "buttons", "collect_input", "condition", "transfer", "end"] as const;

function emptyStep(type: Step["type"]): Step {
  const base: Step = { type };
  if (type === "message") base.message = "";
  if (type === "buttons") { base.message = ""; base.buttons = []; }
  if (type === "collect_input") base.collect = { key: "", label: "" };
  if (type === "condition") base.condition = { variable: "", equals: "", gotoStep: 0, elseStep: 0 };
  if (type === "end") base.message = "Thank you!";
  if (type === "transfer") base.message = "Let me connect you with our team.";
  return base;
}

export default function FlowsPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [editing, setEditing] = useState<Flow | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const db = getDb$();
    if (!db) return;
    const unsub = onSnapshot(collection(db, "flows"), (snap) => {
      setFlows(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Flow)));
    });
    return unsub;
  }, []);

  const projects = [...new Set(flows.map((f) => f.projectId).filter(Boolean))];
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
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(flow),
    });
    setSaving(false);
    setEditing(null);
  };

  const deleteFlow = async (id: string) => {
    if (!confirm("Delete this flow?")) return;
    await fetch("/api/flows", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  const addStep = (flow: Flow, type: Step["type"]) => {
    const updated = { ...flow, steps: [...flow.steps, emptyStep(type)] };
    setEditing(updated);
  };

  const removeStep = (flow: Flow, idx: number) => {
    const updated = { ...flow, steps: flow.steps.filter((_, i) => i !== idx) };
    setEditing(updated);
  };

  const updateStep = (flow: Flow, idx: number, step: Step) => {
    const steps = [...flow.steps];
    steps[idx] = step;
    setEditing({ ...flow, steps });
  };

  const moveStep = (flow: Flow, idx: number, dir: "up" | "down") => {
    const steps = [...flow.steps];
    const target = idx + (dir === "up" ? -1 : 1);
    if (target < 0 || target >= steps.length) return;
    [steps[idx], steps[target]] = [steps[target], steps[idx]];
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
            <h2 className="text-sm font-semibold uppercase text-neutral-500">Steps</h2>
            <div className="flex gap-1">
              {STEP_TYPES.map((t) => (
                <button key={t} onClick={() => addStep(flow, t)} className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700">
                  + {t.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {flow.steps.map((step, i) => (
              <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-mono text-cyan-400">Step {i + 1}: {step.type}</span>
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
            {projects.map((p) => <option key={p} value={p}>{p}</option>)}
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

function StepEditor({ step, onChange, flowId, allFlows }: { step: Step; onChange: (s: Step) => void; flowId: string; allFlows: Flow[] }) {
  if (step.type === "message") {
    return (
      <div className="space-y-2">
        <textarea className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" rows={2} value={step.message || ""}
          onChange={(e) => onChange({ ...step, message: e.target.value })}
          placeholder="Message text (use {{variable}} for personalization)"
        />
        <div>
          <label className="text-xs text-neutral-500">Auto-advance to step (leave empty for next)</label>
          <input type="number" className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" value={step.gotoStep ?? ""}
            onChange={(e) => onChange({ ...step, gotoStep: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
      </div>
    );
  }

  if (step.type === "buttons") {
    return (
      <div className="space-y-2">
        <textarea className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" rows={2} value={step.message || ""}
          onChange={(e) => onChange({ ...step, message: e.target.value })}
          placeholder="Message text"
        />
        <p className="text-xs text-neutral-500">Buttons:</p>
        {(step.buttons || []).map((btn, bi) => (
          <div key={bi} className="flex gap-2 items-center">
            <input className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Label" value={btn.label}
              onChange={(e) => {
                const btns = [...(step.buttons || [])];
                btns[bi] = { ...btns[bi], label: e.target.value };
                onChange({ ...step, buttons: btns });
              }}
            />
            <select className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" value={btn.action}
              onChange={(e) => {
                const btns = [...(step.buttons || [])];
                btns[bi] = { ...btns[bi], action: e.target.value as any };
                onChange({ ...step, buttons: btns });
              }}
            >
              <option value="next">Next step</option>
              <option value="goto_flow">Go to flow</option>
            </select>
            {btn.action === "goto_flow" && (
              <select className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" value={btn.flowId || ""}
                onChange={(e) => {
                  const btns = [...(step.buttons || [])];
                  btns[bi] = { ...btns[bi], flowId: e.target.value };
                  onChange({ ...step, buttons: btns });
                }}
              >
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
        <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Variable key (e.g. user_name)" value={step.collect?.key || ""}
          onChange={(e) => onChange({ ...step, collect: { ...step.collect!, key: e.target.value, label: step.collect?.label || "", validation: step.collect?.validation } })}
        />
        <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Label for input" value={step.collect?.label || ""}
          onChange={(e) => onChange({ ...step, collect: { ...step.collect!, key: step.collect?.key || "", label: e.target.value, validation: step.collect?.validation } })}
        />
        <select className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" value={step.collect?.validation || ""}
          onChange={(e) => onChange({ ...step, collect: { ...step.collect!, key: step.collect?.key || "", label: step.collect?.label || "", validation: e.target.value as any } })}
        >
          <option value="">Any text</option>
          <option value="email">Email</option>
          <option value="phone">Phone</option>
          <option value="number">Number</option>
        </select>
        <div className="col-span-3">
          <textarea className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" rows={2} value={step.message || ""}
            onChange={(e) => onChange({ ...step, message: e.target.value })}
            placeholder="Message asking for this input"
          />
        </div>
      </div>
    );
  }

  if (step.type === "condition") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Variable name" value={step.condition?.variable || ""}
          onChange={(e) => onChange({ ...step, condition: { ...step.condition!, variable: e.target.value, equals: step.condition?.equals || "" } })}
        />
        <input className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" placeholder="Equals value" value={step.condition?.equals || ""}
          onChange={(e) => onChange({ ...step, condition: { ...step.condition!, variable: step.condition?.variable || "", equals: e.target.value } })}
        />
        <div>
          <label className="text-xs text-neutral-500">If match → go to step</label>
          <input type="number" className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" value={step.condition?.gotoStep ?? ""}
            onChange={(e) => onChange({ ...step, condition: { ...step.condition!, gotoStep: e.target.value ? Number(e.target.value) : undefined } })}
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500">Else → go to step</label>
          <input type="number" className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs" value={step.condition?.elseStep ?? ""}
            onChange={(e) => onChange({ ...step, condition: { ...step.condition!, elseStep: e.target.value ? Number(e.target.value) : undefined } })}
          />
        </div>
      </div>
    );
  }

  if (step.type === "transfer") {
    return (
      <textarea className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" rows={2} value={step.message || ""}
        onChange={(e) => onChange({ ...step, message: e.target.value })}
        placeholder="Transfer message"
      />
    );
  }

  if (step.type === "end") {
    return (
      <textarea className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" rows={2} value={step.message || ""}
        onChange={(e) => onChange({ ...step, message: e.target.value })}
        placeholder="Ending message"
      />
    );
  }

  return null;
}
