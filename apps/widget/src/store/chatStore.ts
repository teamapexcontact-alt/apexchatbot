import { create } from "zustand";
import type { Message } from "@apex/shared";

interface ChatState {
  open: boolean;
  messages: Message[];
  isTyping: boolean;
  toggle: () => void;
  openChat: () => void;
  closeChat: () => void;
  addMessage: (msg: Message) => void;
  setTyping: (v: boolean) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  open: false,
  messages: [],
  isTyping: false,
  toggle: () => set((s) => ({ open: !s.open })),
  openChat: () => set({ open: true }),
  closeChat: () => set({ open: false }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setTyping: (isTyping) => set({ isTyping }),
  clear: () => set({ messages: [] }),
}));
