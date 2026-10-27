import { create } from 'zustand';

export interface ModelOption {
  id: string;
  name: string;
  family: string;
  accuracy: number;
  f1: number;
  rocAuc: number;
  threshold: number;
  isBest?: boolean;
}

interface ModelStoreState {
  selectedModel: string;
  threshold: number;
  isOperationalMode: boolean;
  theme: 'dark' | 'light';
  setSelectedModel: (modelName: string) => void;
  setThreshold: (threshold: number) => void;
  toggleOperationalMode: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
}

const initialTheme = (localStorage.getItem('cybershield_theme') as 'dark' | 'light') || 'dark';
if (typeof document !== 'undefined') {
  if (initialTheme === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  } else {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
  }
}

export const useModelStore = create<ModelStoreState>((set) => ({
  selectedModel: 'Decision Tree',
  threshold: 0.5,
  isOperationalMode: true,
  theme: initialTheme,

  setSelectedModel: (modelName: string) => set({ selectedModel: modelName }),
  setThreshold: (threshold: number) => set({ threshold }),
  toggleOperationalMode: () => set((state) => ({ isOperationalMode: !state.isOperationalMode })),

  setTheme: (theme: 'dark' | 'light') => {
    localStorage.setItem('cybershield_theme', theme);
    if (typeof document !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      }
    }
    set({ theme });
  },

  toggleTheme: () => {
    set((state) => {
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('cybershield_theme', nextTheme);
      if (typeof document !== 'undefined') {
        if (nextTheme === 'dark') {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
        } else {
          document.documentElement.classList.add('light');
          document.documentElement.classList.remove('dark');
        }
      }
      return { theme: nextTheme };
    });
  },
}));
