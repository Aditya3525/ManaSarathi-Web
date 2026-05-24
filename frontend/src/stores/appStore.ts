/**
 * Application State Store
 * 
 * Manages global application state like theme, sidebar, modals, etc.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Page } from '../utils/appRouting';

type Theme = 'light' | 'dark' | 'system';

interface Modal {
  id: string;
  type: string;
  data?: any;
}

interface AppState {
  // UI State
  theme: Theme;
  sidebarOpen: boolean;
  currentPage: Page;
  previousPage: Page | null;
  modals: Modal[];
  isOnline: boolean;

  // Loading states
  globalLoading: boolean;
  loadingMessage: string | null;

  // Actions
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setCurrentPage: (page: Page) => void;
  navigateTo: (page: Page) => void;
  goBack: () => void;
  
  // Modal management
  openModal: (type: string, data?: any) => void;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
  
  // Connection status
  setOnlineStatus: (online: boolean) => void;
  
  // Global loading
  setGlobalLoading: (loading: boolean, message?: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      theme: 'system',
      sidebarOpen: true,
      currentPage: 'landing',
      previousPage: null,
      modals: [],
      isOnline: navigator.onLine,
      globalLoading: false,
      loadingMessage: null,

      // Actions
      setTheme: (theme) => set({ theme }),

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      setCurrentPage: (page) =>
        set((state) => ({
          currentPage: page,
          previousPage: state.currentPage,
        })),

      navigateTo: (page) =>
        set((state) => ({
          currentPage: page,
          previousPage: state.currentPage,
        })),

      goBack: () => {
        const { previousPage } = get();
        if (previousPage) {
          set((state) => ({
            currentPage: previousPage,
            previousPage: state.previousPage,
          }));
        }
      },

      // Modal management
      openModal: (type, data) => {
        const id = `modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        set((state) => ({
          modals: [...state.modals, { id, type, data }],
        }));
      },

      closeModal: (id) =>
        set((state) => ({
          modals: state.modals.filter((m) => m.id !== id),
        })),

      closeAllModals: () => set({ modals: [] }),

      // Connection status
      setOnlineStatus: (online) => set({ isOnline: online }),

      // Global loading
      setGlobalLoading: (loading, message = null) =>
        set({ globalLoading: loading, loadingMessage: message }),
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);

/**
 * Selectors
 */
export const selectTheme = (state: AppState) => state.theme;
export const selectSidebarOpen = (state: AppState) => state.sidebarOpen;
export const selectCurrentPage = (state: AppState) => state.currentPage;
export const selectIsOnline = (state: AppState) => state.isOnline;
export const selectGlobalLoading = (state: AppState) => state.globalLoading;
export const selectModals = (state: AppState) => state.modals;

/**
 * Hook to listen to online/offline status
 */
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useAppStore.getState().setOnlineStatus(true);
  });

  window.addEventListener('offline', () => {
    useAppStore.getState().setOnlineStatus(false);
  });
}
