import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect, useCallback } from "react";
import { useChatStore } from "../store/chatStore";
import { useConfigStore } from "../store/configStore";
import { useChat } from "../hooks/useChat";
import { useAnalytics } from "../hooks/useAnalytics";
import { MessageBubble } from "./MessageBubble";
import { CategoryCards } from "./CategoryCards";

export function ChatWindow() {
  const { open, closeChat, isTyping, isListening, messages, pendingButtons, pendingInput, setPendingButtons, setPendingInput } = useChatStore();
  const { project, faqs, loading, theme } = useConfigStore();
  const { sendMessage, sendVoiceInput, sendFile } = useChat();
  const { track } = useAnalytics();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);
  useEffect(() => { if (open) track("chat_open"); if (open) setTimeout(() => inputRef.current?.focus(), 300); }, [open, track]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    track("message_sent", { text: text.slice(0, 100) });
    sendMessage(text);
  }, [input, track, sendMessage]);

  const handleButtonClick = useCallback((label: string) => {
    track("button_click", { label });
    setPendingButtons(null);
    sendMessage(label, label);
  }, [track, sendMessage, setPendingButtons]);

  const handleInputSubmit = useCallback((value: string) => {
    setPendingInput(null);
    sendMessage(value);
  }, [sendMessage, setPendingInput]);

  const handleCategorySelect = useCallback((category: string) => {
    const catFaqs = faqs.filter((f) => f.category === category);
    if (catFaqs.length > 0) sendMessage(`Tell me about ${category}`);
  }, [faqs, sendMessage]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) sendFile(file);
    if (fileRef.current) fileRef.current.value = "";
  }, [sendFile]);

  const hasVoiceSupport = typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const primaryColor = project?.primaryColor ?? theme.primaryColor;
  const position = theme.position;
  const borderRadius = theme.borderRadius === "full" ? "50px" : theme.borderRadius === "lg" ? "20px" : theme.borderRadius === "md" ? "16px" : "12px";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 340, damping: 28 }}
          className="apex-chat-widget fixed bottom-20 z-[9998] flex h-[540px] w-[380px] flex-col overflow-hidden border border-white/[0.08] bg-neutral-950 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.6)] max-sm:inset-0 max-sm:h-dvh max-sm:w-full max-sm:rounded-none max-sm:bottom-0"
          style={{
            [position]: "20px",
            borderRadius,
            fontFamily: theme.fontFamily || undefined,
          }}
        >
          <header className="relative shrink-0 overflow-hidden">
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }} />
            <div className="absolute inset-0 bg-gradient-to-b from-black/[0.06] to-transparent" />
            <div className="relative flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  {project?.logoUrl ? (
                    <img src={project.logoUrl} alt="" className="h-10 w-10 rounded-xl object-cover ring-2 ring-white/20" />
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
                  <p className="text-[15px] font-semibold text-white truncate leading-tight">{project?.projectName ?? "APEX Chat"}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/70">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />Online now
                  </p>
                </div>
              </div>
              <button onClick={closeChat} className="group flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.1] text-white/70 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white hover:scale-105 active:scale-95 shrink-0">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          </header>

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
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-2">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-xl" style={{ backgroundColor: `${primaryColor}20` }}>💬</div>
                  <p className="text-[15px] font-medium text-neutral-200">{project?.welcomeMessage ?? "Hi! How can I help you?"}</p>
                  <p className="mt-1 text-xs text-neutral-500">Choose a topic or type below</p>
                </div>
                <CategoryCards faqs={faqs} onSelect={handleCategorySelect} />
              </motion.div>
            )}
            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                <MessageBubble message={msg} primaryColor={primaryColor} />
              </motion.div>
            ))}

            {/* Buttons */}
            {pendingButtons && !isTyping && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-2 ml-1">
                {pendingButtons.map((btn) => (
                  <button
                    key={btn.label}
                    onClick={() => handleButtonClick(btn.label)}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-200 transition-all hover:bg-white/10 hover:border-white/20 active:scale-95"
                  >
                    {btn.label}
                  </button>
                ))}
              </motion.div>
            )}

            {/* Collect Input */}
            {pendingInput && !isTyping && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="ml-1">
                <p className="text-xs text-neutral-500 mb-1.5">{pendingInput.label}</p>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none focus:border-white/20"
                    placeholder={pendingInput.label || "Type here..."}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) handleInputSubmit(val);
                      }
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      const el = document.activeElement as HTMLInputElement;
                      if (el?.value?.trim()) handleInputSubmit(el.value.trim());
                    }}
                    className="rounded-xl bg-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-white/15"
                  >Send</button>
                </div>
              </motion.div>
            )}

            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 ml-1">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs ring-1 ring-white/10" style={{ backgroundColor: `${primaryColor}30` }}>🤖</div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-neutral-800/80 px-4 py-3 ring-1 ring-white/[0.04]">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" style={{ animationDelay: "0.15s" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" style={{ animationDelay: "0.3s" }} />
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input — hidden when collect input is active */}
          {!pendingInput && (
            <div className="border-t border-white/[0.06] bg-neutral-950/80 backdrop-blur-md p-3.5 shrink-0">
              <div className="flex items-center gap-1.5">
                {/* File Upload */}
                <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition-all hover:bg-white/10 hover:text-neutral-300"
                  title="Attach file"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>

                <input
                  ref={inputRef}
                  className="flex-1 rounded-2xl border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-all focus:border-[var(--apex-accent)] focus:ring-2 focus:ring-[var(--apex-accent)]/20"
                  style={{ ["--apex-accent" as string]: primaryColor }}
                  placeholder="Type a message…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  disabled={!!pendingButtons}
                />

                {/* Voice Input */}
                {hasVoiceSupport && (
                  <motion.button
                    onClick={sendVoiceInput}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all"
                    style={{ backgroundColor: isListening ? "#ef4444" : "transparent", color: isListening ? "white" : "#888" }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.92 }}
                    title="Voice input"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="22" />
                    </svg>
                  </motion.button>
                )}

                <motion.button
                  onClick={handleSend}
                  disabled={!input.trim() || !!pendingButtons}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-white transition-all disabled:opacity-30 disabled:scale-95"
                  style={{ backgroundColor: primaryColor }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.92 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4 20-7z" />
                  </svg>
                </motion.button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
