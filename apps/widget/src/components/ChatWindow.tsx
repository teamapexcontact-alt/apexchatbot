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

  const primaryColor = project?.primaryColor ?? "#6366f1";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 340, damping: 28 }}
          className="apex-chat-widget fixed bottom-20 right-5 z-[9998] flex h-[540px] w-[380px] flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-neutral-950 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.6)] max-sm:inset-0 max-sm:h-dvh max-sm:w-full max-sm:rounded-none max-sm:bottom-0 max-sm:right-0"
        >
          {/* ─── Header ─── */}
          <header className="relative shrink-0 overflow-hidden">
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }} />
            <div className="absolute inset-0 bg-gradient-to-b from-black/[0.06] to-transparent" />
            <div className="relative flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  {project?.logoUrl ? (
                    <img
                      src={project.logoUrl}
                      alt=""
                      className="h-10 w-10 rounded-xl object-cover ring-2 ring-white/20"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.15] text-base font-semibold text-white ring-2 ring-white/10 backdrop-blur-sm">
                      {project?.projectName?.charAt(0)?.toUpperCase() ?? "A"}
                    </div>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-[2.5px] ring-white/30">
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60" />
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-white truncate leading-tight">
                    {project?.projectName ?? "APEX Chat"}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/70">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    Online now
                  </p>
                </div>
              </div>
              <button
                onClick={closeChat}
                className="group flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.1] text-white/70 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white hover:scale-105 active:scale-95 shrink-0"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="transition-transform group-hover:rotate-90"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </header>

          {/* ─── Messages ─── */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3 scroll-smooth">
            {loading && messages.length === 0 && (
              <div className="flex items-center justify-center pt-20">
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: primaryColor, animationDelay: "0s" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: primaryColor, animationDelay: "0.1s" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: primaryColor, animationDelay: "0.2s" }} />
                </div>
              </div>
            )}
            {!loading && messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4 pt-2"
              >
                <div className="text-center">
                  <div
                    className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-xl"
                    style={{ backgroundColor: `${primaryColor}20` }}
                  >
                    💬
                  </div>
                  <p className="text-[15px] font-medium text-neutral-200">
                    {project?.welcomeMessage ?? "Hi! How can I help you?"}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">Choose a topic or type below</p>
                </div>
                <CategoryCards faqs={faqs} onSelect={handleCategorySelect} />
              </motion.div>
            )}
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <MessageBubble message={msg} primaryColor={primaryColor} />
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
                className="flex items-center gap-2 ml-1"
              >
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs ring-1 ring-white/10"
                  style={{ backgroundColor: `${primaryColor}30` }}
                >
                  🤖
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-neutral-800/80 px-4 py-3 ring-1 ring-white/[0.04]">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" style={{ animationDelay: "0s" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" style={{ animationDelay: "0.15s" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" style={{ animationDelay: "0.3s" }} />
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

          {/* ─── Input ─── */}
          <div className="border-t border-white/[0.06] bg-neutral-950/80 backdrop-blur-md p-3.5 shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                className="flex-1 rounded-2xl border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-all focus:border-[var(--apex-accent)] focus:ring-2 focus:ring-[var(--apex-accent)]/20"
                style={{ ["--apex-accent" as string]: primaryColor }}
                placeholder="Type a message…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <motion.button
                onClick={handleSend}
                disabled={!input.trim()}
                className="flex h-11 w-11 items-center justify-center rounded-2xl text-white transition-all disabled:opacity-30 disabled:scale-95 shrink-0"
                style={{ backgroundColor: primaryColor }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2 11 13" />
                  <path d="m22 2-7 20-4-9-9-4 20-7z" />
                </svg>
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
