import { create } from "zustand";
import type { Project, FAQ } from "@apex/shared";

interface ConfigState {
  project: Project | null;
  projectId: string;
  faqs: FAQ[];
  loading: boolean;
  apiUrl: string;
  setProject: (p: Project) => void;
  setProjectId: (id: string) => void;
  setFaqs: (faqs: FAQ[]) => void;
  setLoading: (v: boolean) => void;
  setApiUrl: (url: string) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  project: null,
  projectId: "",
  faqs: [],
  loading: true,
  apiUrl: "",
  setProject: (project) => set({ project }),
  setProjectId: (projectId) => set({ projectId }),
  setFaqs: (faqs) => set({ faqs }),
  setLoading: (loading) => set({ loading }),
  setApiUrl: (apiUrl) => set({ apiUrl }),
}));
