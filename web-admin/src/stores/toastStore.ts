import { create } from 'zustand';

interface PendingToast {
  type: 'success' | 'error' | 'warning';
  message: string;
  id: string;
}

interface ToastStore {
  pendingToasts: PendingToast[];
  addPendingToast: (toast: Omit<PendingToast, 'id'>) => void;
  consumePendingToasts: () => PendingToast[];
}

export const useToastStore = create<ToastStore>((set, get) => ({
  pendingToasts: [],
  
  addPendingToast: (toast) => set((state) => ({
    pendingToasts: [...state.pendingToasts, {
      ...toast,
      id: Math.random().toString(36).substring(2, 9)
    }]
  })),
  
  consumePendingToasts: () => {
    const toasts = get().pendingToasts;
    set({ pendingToasts: [] }); // Limpa após consumir
    return toasts;
  }
}));