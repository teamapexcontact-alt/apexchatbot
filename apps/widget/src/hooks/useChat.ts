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
  const { faqs, project, apiUrl, projectId, browserLang } = useConfigStore();

  const sendMessage = async (text: string, buttonLabel?: string, fileBase64?: string, fileName?: string) => {
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
        const body: any = { projectId, message: text, sessionId: getSessionId(), lang: browserLang };
        if (buttonLabel) body.buttonLabel = buttonLabel;
        if (fileBase64) { body.fileBase64 = fileBase64; body.fileName = fileName; }

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
        const fallbacks: Record<string, string> = {
          es: "No entendí bien. ¿Puedes reformular?",
          fr: "Je n'ai pas bien compris. Pouvez-vous reformuler?",
          de: "Ich habe das nicht verstanden. Können Sie es umformulieren?",
          pt: "Não entendi. Pode reformular?",
          hi: "मैं समझा नहीं। कृपया दोबारा कहें।",
        };
        botReply = fallbacks[browserLang] || "I didn't quite understand that.";
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

  const sendVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      sendMessage("voice input not supported");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = browserLang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.start();
    useChatStore.getState().setListening(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      useChatStore.getState().setListening(false);
      sendMessage(transcript);
    };

    recognition.onerror = () => {
      useChatStore.getState().setListening(false);
    };

    recognition.onend = () => {
      useChatStore.getState().setListening(false);
    };
  };

  const sendFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      addMessage({ role: "bot", content: "File too large (max 5MB)", timestamp: new Date() });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      sendMessage(`[File: ${file.name}]`, undefined, base64, file.name);
    };
    reader.readAsDataURL(file);
  };

  return { sendMessage, sendVoiceInput, sendFile };
}
