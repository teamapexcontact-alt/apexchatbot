import { useChatStore } from "../store/chatStore";
import { useConfigStore } from "../store/configStore";
import { searchFaqs } from "../engine/faqSearch";
import type { Message } from "@apex/shared";

let sessionId: string;
function getSessionId(): string {
  if (!sessionId) sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return sessionId;
}

function buildFallback(project: any): string {
  const parts = ["I'm not completely sure about that."];
  if (project?.whatsappLink) parts.push(`💬 WhatsApp: ${project.whatsappLink}`);
  if (project?.ctaConfig?.bookCallUrl) parts.push(`📅 Book a call: ${project.ctaConfig.bookCallUrl}`);
  if (project?.ctaConfig?.viewPricingUrl) parts.push(`💰 Pricing: ${project.ctaConfig.viewPricingUrl}`);
  parts.push("Please ask another question or contact our team for help!");
  return parts.join("\n");
}

export function useChat() {
  const { addMessage, setTyping, messages } = useChatStore();
  const { faqs, project, apiUrl } = useConfigStore();

  const sendMessage = async (text: string) => {
    const userMsg: Message = {
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    addMessage(userMsg);
    setTyping(true);

    await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));

    try {
      let botReply = "";
      let matched = false;

      if (apiUrl) {
        const res = await fetch(`${apiUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project?.projectId,
            message: text,
            sessionId: getSessionId(),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          matched = data.matched;
          botReply = data.answer || "";
        }
      }

      if (!botReply) {
        const results = searchFaqs(faqs, text);
        if (results.length > 0 && results[0].score >= 0.3) {
          botReply = results[0].faq.answer;
          matched = true;
        }
      }

      if (!botReply) {
        botReply = buildFallback(project);
      }

      setTyping(false);
      const botMsg: Message = {
        role: "bot",
        content: botReply,
        timestamp: new Date(),
      };
      addMessage(botMsg);
    } catch {
      setTyping(false);
      const botMsg: Message = {
        role: "bot",
        content: "Sorry, I'm having trouble connecting. Please try again.",
        timestamp: new Date(),
      };
      addMessage(botMsg);
    }
  };

  return { sendMessage, messages };
}
