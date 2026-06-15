import { useChatStore } from "../store/chatStore";
import { useConfigStore } from "../store/configStore";
import { searchFaqs } from "../engine/faqSearch";
import type { Message } from "@apex/shared";

let sessionId: string;
function getSessionId(): string {
  if (!sessionId) sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return sessionId;
}

export function useChat() {
  const { addMessage, setTyping, setPendingButtons, setPendingInput } = useChatStore();
  const { faqs, project, apiUrl, projectId } = useConfigStore();

  const sendMessage = async (text: string, buttonLabel?: string) => {
    const userMsg: Message = { role: "user", content: text, timestamp: new Date() };
    addMessage(userMsg);
    setTyping(true);
    setPendingButtons(null);
    setPendingInput(null);

    await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));

    try {
      let botReply = "";
      let matched = false;

      if (apiUrl && projectId) {
        const body: any = { projectId, message: text, sessionId: getSessionId() };
        if (buttonLabel) body.buttonLabel = buttonLabel;

        const res = await fetch(`${apiUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          matched = data.matched;
          botReply = data.answer || "";
          if (data.sessionId) sessionId = data.sessionId;
          if (data.buttons) setPendingButtons(data.buttons);
          if (data.input) setPendingInput(data.input);
        }
      }

      if (!botReply && !buttonLabel) {
        const results = searchFaqs(faqs, text);
        if (results.length > 0 && results[0].score >= 0.3) {
          botReply = results[0].faq.answer;
          matched = true;
        }
      }

      if (!botReply) {
        botReply = "I didn't quite understand that.";
      }

      setTyping(false);
      const botMsg: Message = { role: "bot", content: botReply, timestamp: new Date() };
      addMessage(botMsg);
    } catch {
      setTyping(false);
      setPendingButtons(null);
      setPendingInput(null);
      const botMsg: Message = { role: "bot", content: "Sorry, I'm having trouble connecting. Please try again.", timestamp: new Date() };
      addMessage(botMsg);
    }
  };

  return { sendMessage };
}
