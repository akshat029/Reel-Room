import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
    isDark: boolean;
    toggle: () => void;
    setDark: (isDark: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            isDark: window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
            toggle: () => set((state) => ({ isDark: !state.isDark })),
            setDark: (isDark: boolean) => set({ isDark }),
        }),
        {
            name: 'reelroom-theme',
        }
    )
);
