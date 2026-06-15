import { create } from "zustand";
import type { Message } from "@apex/shared";

interface PendingButton {
  label: string;
  action: string;
  flowId?: string;
}

interface PendingInput {
  key: string;
  label: string;
  validation?: string;
}

interface ChatState {
  open: boolean;
  messages: Message[];
  isTyping: boolean;
  pendingButtons: PendingButton[] | null;
  pendingInput: PendingInput | null;
  toggle: () => void;
  openChat: () => void;
  closeChat: () => void;
  addMessage: (msg: Message) => void;
  setTyping: (v: boolean) => void;
  setPendingButtons: (v: PendingButton[] | null) => void;
  setPendingInput: (v: PendingInput | null) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  open: false,
  messages: [],
  isTyping: false,
  pendingButtons: null,
  pendingInput: null,
  toggle: () => set((s) => ({ open: !s.open })),
  openChat: () => set({ open: true }),
  closeChat: () => set({ open: false }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setTyping: (isTyping) => set({ isTyping }),
  setPendingButtons: (v) => set({ pendingButtons: v }),
  setPendingInput: (v) => set({ pendingInput: v }),
  clear: () => set({ messages: [], pendingButtons: null, pendingInput: null }),
}));
