import { FlowDoc, Session, ExecuteResult, StepDoc } from "./types";
import { applyVars } from "./session-manager";
import { setCurrentTopic, markFlowCompleted, incrementInput } from "./context-tracker";

export async function executeFlow(
  flow: FlowDoc,
  session: Session,
  userInput: string,
  execDeps?: {
    httpFetch?: (url: string, opts: any) => Promise<any>;
    sendEmail?: (opts: any) => Promise<any>;
    dbQuery?: (query: string, params?: string[]) => Promise<any[]>;
    sendWhatsApp?: (opts: any) => Promise<any>;
    processPayment?: (opts: any) => Promise<any>;
    sendNotification?: (opts: any) => Promise<any>;
  }
): Promise<ExecuteResult> {
  session.flowId = flow.id;
  const messages: ExecuteResult["messages"] = [];
  let done = false;
  let lead = false;

  if (session.context) {
    setCurrentTopic(session.context, flow);
  }

  // Start from beginning if not continuing
  if (!session.stepIndex || userInput === "__start") {
    session.stepIndex = 0;
  }

  while (session.stepIndex < flow.steps.length) {
    const step = flow.steps[session.stepIndex];

    const { msgs, shouldStop, shouldLead } = await processStep(
      step, flow, session, userInput, execDeps
    );
    messages.push(...msgs);

    if (shouldLead) lead = true;
    if (shouldStop) { done = true; break; }

    // If not a blocking step, advance
    if (!isBlockingStep(step.type)) {
      if (step.gotoStep !== undefined) {
        session.stepIndex = step.gotoStep;
      } else {
        session.stepIndex++;
      }
    } else {
      done = true;
      break;
    }
  }

  if (session.stepIndex >= flow.steps.length) {
    session.completed = true;
    done = true;
    lead = true;
    if (session.context) markFlowCompleted(session.context, flow.id);
  }

  return { messages, session, done, lead };
}

function isBlockingStep(type: string): boolean {
  return ["buttons", "collect_input"].includes(type);
}

async function processStep(
  step: StepDoc,
  flow: FlowDoc,
  session: Session,
  userInput: string,
  execDeps?: any
): Promise<{ msgs: ExecuteResult["messages"]; shouldStop: boolean; shouldLead: boolean }> {
  let shouldStop = false;
  let shouldLead = false;
  const msgs: ExecuteResult["messages"] = [];

  switch (step.type) {
    case "message": {
      const text = applyVars(step.message || "", session.vars);
      msgs.push({ text });
      session.history.push({ role: "bot", message: text, ts: Date.now() });
      break;
    }

    case "buttons": {
      const text = applyVars(step.message || "", session.vars);
      const btns = (step.buttons || []).map((b) => ({
        label: b.label,
        action: b.action,
        flowId: b.action === "goto_flow" ? b.flowId : undefined,
      }));
      msgs.push({ text, buttons: btns });
      session.history.push({ role: "bot", message: text, ts: Date.now() });
      shouldStop = true;
      break;
    }

    case "collect_input": {
      const text = applyVars(step.message || "", session.vars);
      const inputDef = step.collect;
      msgs.push({
        text,
        input: { key: inputDef?.key || "response", label: inputDef?.label || "", validation: inputDef?.validation },
      });
      session.history.push({ role: "bot", message: text, ts: Date.now() });
      shouldStop = true;
      break;
    }

    case "condition": {
      const cond = step.condition!;
      const val = session.vars[cond.variable] || "";
      session.stepIndex = val === cond.equals
        ? (cond.gotoStep ?? session.stepIndex + 1)
        : (cond.elseStep ?? session.stepIndex + 1);
      // Don't push a message, just jump
      return { msgs, shouldStop: false, shouldLead: false };
    }

    case "transfer": {
      const text = applyVars(step.message || "Let me connect you with our team.", session.vars);
      msgs.push({ text, transfer: true });
      session.history.push({ role: "bot", message: text, ts: Date.now() });
      shouldLead = true;
      session.completed = true;
      shouldStop = true;
      break;
    }

    case "end": {
      const text = applyVars(step.message || "Thank you! Is there anything else I can help with?", session.vars);
      msgs.push({ text });
      session.history.push({ role: "bot", message: text, ts: Date.now() });
      shouldLead = true;
      session.completed = true;
      shouldStop = true;
      break;
    }

    // ── New step types ──
    case "api_call": {
      if (!execDeps?.httpFetch || !step.apiCall) {
        msgs.push({ text: "API call failed: missing configuration." });
        break;
      }
      try {
        const resp = await execDeps.httpFetch(step.apiCall.url, {
          method: step.apiCall.method || "GET",
          headers: { "Content-Type": "application/json", ...step.apiCall.headers },
          body: step.apiCall.body ? applyVars(step.apiCall.body, session.vars) : undefined,
        });
        const data = typeof resp === "string" ? resp : JSON.stringify(resp);
        if (step.apiCall.responseVar) {
          session.vars[step.apiCall.responseVar] = data;
        }
      } catch (e: any) {
        console.error("API call failed:", e);
        msgs.push({ text: `API call failed: ${e.message}` });
      }
      break;
    }

    case "webhook": {
      if (!execDeps?.httpFetch || !step.webhook) {
        msgs.push({ text: "Webhook failed: missing configuration." });
        break;
      }
      try {
        const payload = step.webhook.payload ? applyVars(step.webhook.payload, session.vars) : "{}";
        const resp = await execDeps.httpFetch(step.webhook.url, {
          method: step.webhook.method || "POST",
          headers: { "Content-Type": "application/json", ...step.webhook.headers },
          body: payload,
        });
        const data = typeof resp === "string" ? resp : JSON.stringify(resp);
        if (step.webhook.responseVar) {
          session.vars[step.webhook.responseVar] = data;
        }
      } catch (e: any) {
        console.error("Webhook failed:", e);
      }
      break;
    }

    case "delay": {
      const sec = step.delay?.seconds || 1;
      await new Promise((r) => setTimeout(r, sec * 1000));
      break;
    }

    case "email": {
      if (!execDeps?.sendEmail || !step.email) {
        msgs.push({ text: "Email step failed: missing configuration." });
        break;
      }
      try {
        await execDeps.sendEmail({
          to: applyVars(step.email.to, session.vars),
          subject: applyVars(step.email.subject, session.vars),
          body: applyVars(step.email.body, session.vars),
          cc: step.email.cc ? applyVars(step.email.cc, session.vars) : undefined,
        });
      } catch (e: any) {
        console.error("Email failed:", e);
      }
      break;
    }

    case "db_query": {
      if (!execDeps?.dbQuery || !step.dbQuery) {
        msgs.push({ text: "Database query failed: missing configuration." });
        break;
      }
      try {
        const query = applyVars(step.dbQuery.query, session.vars);
        const params = step.dbQuery.params?.map((p) => applyVars(p, session.vars));
        const results = await execDeps.dbQuery(query, params);
        if (step.dbQuery.responseVar) {
          session.vars[step.dbQuery.responseVar] = JSON.stringify(results);
        }
      } catch (e: any) {
        console.error("DB query failed:", e);
      }
      break;
    }

    case "whatsapp": {
      if (!execDeps?.sendWhatsApp || !step.whatsapp) {
        msgs.push({ text: "WhatsApp step failed: missing configuration." });
        break;
      }
      try {
        await execDeps.sendWhatsApp({
          templateName: step.whatsapp.templateName,
          to: applyVars(step.whatsapp.to, session.vars),
          params: step.whatsapp.params?.map((p) => applyVars(p, session.vars)),
        });
      } catch (e: any) {
        console.error("WhatsApp failed:", e);
      }
      break;
    }

    case "payment": {
      if (!execDeps?.processPayment || !step.payment) {
        msgs.push({ text: "Payment step failed: missing configuration." });
        break;
      }
      try {
        const result = await execDeps.processPayment({
          amount: step.payment.amount,
          currency: step.payment.currency,
          description: applyVars(step.payment.description, session.vars),
        });
        if (step.payment.responseVar) {
          session.vars[step.payment.responseVar] = JSON.stringify(result);
        }
      } catch (e: any) {
        console.error("Payment failed:", e);
      }
      break;
    }

    case "notification": {
      if (!execDeps?.sendNotification || !step.notification) {
        msgs.push({ text: "Notification step failed: missing configuration." });
        break;
      }
      try {
        await execDeps.sendNotification({
          type: step.notification.type,
          to: applyVars(step.notification.to, session.vars),
          title: step.notification.title ? applyVars(step.notification.title, session.vars) : undefined,
          body: applyVars(step.notification.body, session.vars),
        });
      } catch (e: any) {
        console.error("Notification failed:", e);
      }
      break;
    }

    case "custom_function": {
      if (!step.customFn) {
        msgs.push({ text: "Custom function step failed: missing configuration." });
        break;
      }
      // This is a hook point for plugin-provided functions
      try {
        const fnName = step.customFn.functionName;
        const params = step.customFn.params
          ? Object.fromEntries(
              Object.entries(step.customFn.params).map(([k, v]) => [k, applyVars(v, session.vars)])
            )
          : {};
        // The fnRegistry is expected on the session for plugin functions
        const fnRegistry = (session as any).__fnRegistry || {};
        if (fnRegistry[fnName]) {
          const result = await fnRegistry[fnName](params, session);
          if (step.customFn.responseVar && result !== undefined) {
            session.vars[step.customFn.responseVar] = JSON.stringify(result);
          }
        } else {
          console.warn(`Custom function "${fnName}" not registered`);
        }
      } catch (e: any) {
        console.error("Custom function failed:", e);
      }
      break;
    }
  }

  return { msgs, shouldStop, shouldLead };
}

// ── Collect input handler ──
export function handleCollectInput(session: Session, input: string, step: StepDoc): string | null {
  const key = step.collect?.key || "response";
  const validation = step.collect?.validation;
  const val = input.trim();

  if (validation === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "Please enter a valid email address.";
  } else if (validation === "phone") {
    if (!/^[\d\s\+\-\(\)]{7,15}$/.test(val)) return "Please enter a valid phone number.";
  } else if (validation === "number") {
    if (isNaN(Number(val))) return "Please enter a valid number.";
  }

  session.vars[key] = val;
  if (session.context) incrementInput(session.context);
  session.stepIndex++;
  return null;
}

// ── Button click handler ──
export function handleButtonClick(
  session: Session,
  buttonLabel: string,
  flow: FlowDoc,
  allFlows: FlowDoc[]
): { newFlow?: FlowDoc; resetStep?: boolean } {
  const step = flow.steps[session.stepIndex];
  if (!step || step.type !== "buttons") return { resetStep: true };

  const btn = (step.buttons || []).find((b) => b.label === buttonLabel);
  if (!btn) return { resetStep: true };

  if (btn.action === "goto_flow" && btn.flowId) {
    const target = allFlows.find((f) => f.id === btn.flowId);
    if (target) {
      session.flowId = target.id;
      session.stepIndex = 0;
      return { newFlow: target };
    }
  }

  // "next" action — advance
  session.stepIndex++;
  return { resetStep: true };
}

// ── Lead capture ──
export async function captureLead(session: Session, projectId: string, leadStore: (data: any) => Promise<void>) {
  const name = session.vars["user_name"] || session.vars["name"] || "";
  const email = session.vars["user_email"] || session.vars["email"] || "";
  const phone = session.vars["user_phone"] || session.vars["phone"] || "";
  if (!name && !email && !phone) return;
  try {
    await leadStore({
      projectId,
      name, email, phone,
      sessionId: session.id,
      vars: session.vars,
      context: session.context,
      createdAt: new Date(),
    });
  } catch { /* silent */ }
}
