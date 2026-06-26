import { create } from "zustand";
import type { Project, FAQ } from "@apex/shared";

export interface WidgetTheme {
  primaryColor: string;
  position: "right" | "left";
  fontFamily?: string;
  borderRadius?: "sm" | "md" | "lg" | "xl" | "full";
  darkMode?: boolean;
}

export interface ConfigState {
  project: Project | null;
  projectId: string;
  faqs: FAQ[];
  loading: boolean;
  apiUrl: string;
  theme: WidgetTheme;
  browserLang: string;
  setProject: (p: Project) => void;
  setProjectId: (id: string) => void;
  setFaqs: (faqs: FAQ[]) => void;
  setLoading: (v: boolean) => void;
  setApiUrl: (url: string) => void;
  setTheme: (t: Partial<WidgetTheme>) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  project: null,
  projectId: "",
  faqs: [],
  loading: true,
  apiUrl: "",
  browserLang: (navigator?.language || "en").slice(0, 2),
  theme: {
    primaryColor: "#6366f1",
    position: "right",
    borderRadius: "xl",
    darkMode: true,
  },
  setProject: (project) => set((s) => ({
    project,
    theme: {
      ...s.theme,
      primaryColor: project.primaryColor || s.theme.primaryColor,
      position: (project as any).widgetPosition || s.theme.position,
    },
  })),
  setProjectId: (projectId) => set({ projectId }),
  setFaqs: (faqs) => set({ faqs }),
  setLoading: (loading) => set({ loading }),
  setApiUrl: (apiUrl) => set({ apiUrl }),
  setTheme: (t) => set((s) => ({ theme: { ...s.theme, ...t } })),
}));
