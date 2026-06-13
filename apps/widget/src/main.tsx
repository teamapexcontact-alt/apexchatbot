import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db, ensureAuth } from "./firebase/client";
import { useConfigStore } from "./store/configStore";
import { useChatStore } from "./store/chatStore";
import { ChatButton } from "./components/ChatButton";
import { ChatWindow } from "./components/ChatWindow";
import type { Project, FAQ } from "@apex/shared";

function rgbToHex(rgb: string): string | null {
  const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!m) return null;
  const [_, r, g, b] = m;
  return `#${(+r).toString(16).padStart(2, "0")}${(+g).toString(16).padStart(2, "0")}${(+b).toString(16).padStart(2, "0")}`;
}

function detectSiteColor(): string | null {
  try {
    const root = document.documentElement;
    const styles = getComputedStyle(root);
    const cssVars = ["--primary", "--primary-color", "--accent", "--brand", "--color-primary", "--theme-primary", "--btn-primary"];
    for (const v of cssVars) {
      const val = styles.getPropertyValue(v).trim();
      if (val && /^#/.test(val)) return val;
    }
    const firstLink = document.querySelector("a");
    if (firstLink) {
      const color = getComputedStyle(firstLink).color;
      if (color && !["rgb(0, 0, 0)", "rgb(255, 255, 255)", "rgba(0, 0, 0, 0)"].includes(color)) {
        const hex = rgbToHex(color);
        if (hex && hex !== "#000000" && hex !== "#ffffff") return hex;
      }
    }
    const firstBtn = document.querySelector("button, .btn, [class*=btn]");
    if (firstBtn) {
      const bg = getComputedStyle(firstBtn).backgroundColor;
      if (bg && !["transparent", "rgba(0, 0, 0, 0)"].includes(bg)) {
        const hex = rgbToHex(bg);
        if (hex && hex !== "#000000" && hex !== "#ffffff") return hex;
      }
    }
  } catch {}
  return null;
}

function Widget() {
  const project = useConfigStore((s) => s.project);
  const { toggle, open } = useChatStore();
  const color = project?.primaryColor || detectSiteColor() || "#6366f1";

  return (
    <>
      {!open && <ChatButton onClick={toggle} color={color} />}
      <ChatWindow />
    </>
  );
}

async function init(projectId: string) {
  await ensureAuth();

  const projSnap = await getDoc(doc(db, "projects", projectId));
  if (projSnap.exists()) {
    useConfigStore.getState().setProject({
      projectId: projSnap.id,
      ...projSnap.data(),
    } as Project);
  }

  const faqQ = query(collection(db, "faqs"), where("projectId", "==", projectId));
  const faqSnap = await getDocs(faqQ);
  const faqs: FAQ[] = faqSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as FAQ);
  useConfigStore.getState().setFaqs(faqs);
  useConfigStore.getState().setLoading(false);

  const root = document.createElement("div");
  root.id = "apex-chat-root";
  document.body.appendChild(root);

  ReactDOM.createRoot(root).render(
    React.createElement(React.StrictMode, null, React.createElement(Widget)),
  );
}

const scriptTag = document.currentScript as HTMLScriptElement | null;
const projectId =
  scriptTag?.getAttribute("data-project-id") ??
  scriptTag?.dataset?.projectId ??
  new URLSearchParams(window.location.search).get("projectId") ??
  (window as any).__APEX_PROJECT_ID;

const apiUrl =
  scriptTag?.getAttribute("data-api-url") ??
  scriptTag?.dataset?.apiUrl ??
  (window as any).__APEX_API_URL;

if (apiUrl) {
  useConfigStore.getState().setApiUrl(apiUrl);
}

if (projectId) {
  init(projectId);
}
