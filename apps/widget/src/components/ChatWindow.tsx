import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect, useCallback } from "react";
import { useChatStore } from "../store/chatStore";
import { useConfigStore } from "../store/configStore";
import { useChat } from "../hooks/useChat";
import { useAnalytics } from "../hooks/useAnalytics";
import { MessageBubble } from "./MessageBubble";
import { LeadForm } from "./LeadForm";
import { CTACard } from "./CTACard";
import { CategoryCards } from "./CategoryCards";
import { FeedbackButtons } from "./FeedbackButtons";

export function ChatWindow() {
  const { open, closeChat, isTyping, messages } = useChatStore();
  const { project, faqs, loading } = useConfigStore();
  const { sendMessage } = useChat();
  const { track } = useAnalytics();
  const [input, setInput] = useState("");
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [lastBotCtas, setLastBotCtas] = useState<Array<{ label: string; url: string }>>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, showLeadForm]);

  useEffect(() => {
    if (open) track("chat_open");
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open, track]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    track("message_sent", { text: text.slice(0, 100) });

    const pricingKeywords = ["price", "cost", "pricing", "fee", "charges", "how much", "₹", "$"];
    const isPricingIntent = pricingKeywords.some((kw) => text.toLowerCase().includes(kw));

    sendMessage(text);

    if (isPricingIntent) {
      const ctas = [];
      if (project?.ctaConfig?.viewPricingUrl) ctas.push({ label: "View Pricing", url: project.ctaConfig.viewPricingUrl });
      if (project?.ctaConfig?.enrollNowUrl) ctas.push({ label: "Enroll Now", url: project.ctaConfig.enrollNowUrl });
      if (project?.whatsappLink) ctas.push({ label: "Join WhatsApp", url: project.whatsappLink });
      if (project?.ctaConfig?.bookCallUrl) ctas.push({ label: "Book Call", url: project.ctaConfig.bookCallUrl });
      setLastBotCtas(ctas);
      setShowLeadForm(true);
    }
  }, [input, track, sendMessage, project]);

  const handleCategorySelect = useCallback((category: string) => {
    const catFaqs = faqs.filter((f) => f.category === category);
    if (catFaqs.length > 0) {
      sendMessage(`Tell me about ${category}`);
    }
  }, [faqs, sendMessage]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed bottom-20 right-5 z-[9998] flex h-[520px] w-[360px] flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl max-sm:inset-0 max-sm:h-dvh max-sm:w-full max-sm:rounded-none max-sm:bottom-0 max-sm:right-0"
        >
          <header
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ backgroundColor: project?.primaryColor ?? "#6366f1" }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative">
                {project?.logoUrl ? (
                  <img src={project.logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm">💬</div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-400 border-2 border-transparent" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {project?.projectName ?? "APEX Chat"}
                </p>
                <p className="text-[10px] text-white/70">We usually reply in minutes</p>
              </div>
            </div>
            <button onClick={closeChat} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
            {loading && messages.length === 0 && (
              <div className="flex items-center justify-center pt-16">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-500" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-500 [animation-delay:0.1s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-500 [animation-delay:0.2s]" />
                </div>
              </div>
            )}
            {!loading && messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4 pt-4"
              >
                <p className="text-center text-sm text-neutral-400">
                  {project?.welcomeMessage ?? "Hi! How can I help you?"}
                </p>
                <CategoryCards faqs={faqs} onSelect={handleCategorySelect} />
              </motion.div>
            )}
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <MessageBubble message={msg} />
                {msg.role === "bot" && lastBotCtas.length > 0 && i === messages.length - 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 ml-9"
                  >
                    <CTACard ctas={lastBotCtas} />
                  </motion.div>
                )}
                {msg.role === "bot" && i === messages.length - 1 && (
                  <FeedbackButtons messageIndex={i} question={messages[i - 1]?.content || ""} answer={msg.content} />
                )}
              </motion.div>
            ))}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 ml-9"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-xs">🤖</div>
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-neutral-800 px-4 py-2.5">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:0.3s]" />
                </div>
              </motion.div>
            )}
            {showLeadForm && messages.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <LeadForm onClose={() => setShowLeadForm(false)} triggerSource="pricing_intent" />
              </motion.div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-neutral-800 p-3 shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                className="flex-1 rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
                placeholder="Type a message…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-white transition disabled:opacity-40"
                style={{ backgroundColor: project?.primaryColor ?? "#6366f1" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
