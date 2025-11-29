import React, { createContext, useContext, useState, ReactNode } from 'react';
import { themes, Theme } from '../config/themes';

interface ThemeContextType {
  currentTheme: string;
  theme: Theme;
  setTheme: (themeId: string) => void;
  getThemeClasses: () => {
    button: string;
    icon: string;
    badge: string;
    text: string;
    glow: string;
    activeIndicator: string;
    logoGradient: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'jarvis-theme';

// Map theme IDs to actual Tailwind classes (for JIT compilation)
const themeClassMap: Record<string, {
  button: string;
  icon: string;
  badge: string;
  text: string;
  glow: string;
  activeIndicator: string;
  logoGradient: string;
}> = {
  indigo: {
    button: 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50',
    icon: 'bg-gradient-to-br from-indigo-500 to-purple-600',
    badge: 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400',
    text: 'text-indigo-400',
    glow: 'shadow-[0_0_10px_rgba(99,102,241,0.5)]',
    activeIndicator: 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]',
    logoGradient: 'from-indigo-600 to-purple-800',
  },
  cyan: {
    button: 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50',
    icon: 'bg-gradient-to-br from-cyan-500 to-blue-600',
    badge: 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400',
    text: 'text-cyan-400',
    glow: 'shadow-[0_0_10px_rgba(6,182,212,0.5)]',
    activeIndicator: 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]',
    logoGradient: 'from-cyan-600 to-blue-800',
  },
  emerald: {
    button: 'bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50',
    icon: 'bg-gradient-to-br from-emerald-500 to-green-600',
    badge: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400',
    text: 'text-emerald-400',
    glow: 'shadow-[0_0_10px_rgba(16,185,129,0.5)]',
    activeIndicator: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
    logoGradient: 'from-emerald-600 to-green-800',
  },
  rose: {
    button: 'bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/30 hover:shadow-rose-500/50',
    icon: 'bg-gradient-to-br from-rose-500 to-pink-600',
    badge: 'bg-rose-500/10 border border-rose-500/20 text-rose-400',
    text: 'text-rose-400',
    glow: 'shadow-[0_0_10px_rgba(244,63,94,0.5)]',
    activeIndicator: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]',
    logoGradient: 'from-rose-600 to-pink-800',
  },
  amber: {
    button: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50',
    icon: 'bg-gradient-to-br from-amber-500 to-orange-600',
    badge: 'bg-amber-500/10 border border-amber-500/20 text-amber-400',
    text: 'text-amber-400',
    glow: 'shadow-[0_0_10px_rgba(245,158,11,0.5)]',
    activeIndicator: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]',
    logoGradient: 'from-amber-600 to-orange-800',
  },
  blue: {
    button: 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50',
    icon: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    badge: 'bg-blue-500/10 border border-blue-500/20 text-blue-400',
    text: 'text-blue-400',
    glow: 'shadow-[0_0_10px_rgba(59,130,246,0.5)]',
    activeIndicator: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]',
    logoGradient: 'from-blue-600 to-indigo-800',
  },
  teal: {
    button: 'bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50',
    icon: 'bg-gradient-to-br from-teal-500 to-cyan-600',
    badge: 'bg-teal-500/10 border border-teal-500/20 text-teal-400',
    text: 'text-teal-400',
    glow: 'shadow-[0_0_10px_rgba(20,184,166,0.5)]',
    activeIndicator: 'bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.8)]',
    logoGradient: 'from-teal-600 to-cyan-800',
  },
  purple: {
    button: 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50',
    icon: 'bg-gradient-to-br from-purple-500 to-indigo-600',
    badge: 'bg-purple-500/10 border border-purple-500/20 text-purple-400',
    text: 'text-purple-400',
    glow: 'shadow-[0_0_10px_rgba(168,85,247,0.5)]',
    activeIndicator: 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]',
    logoGradient: 'from-purple-600 to-indigo-800',
  },
  fuchsia: {
    button: 'bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white shadow-lg shadow-fuchsia-500/30 hover:shadow-fuchsia-500/50',
    icon: 'bg-gradient-to-br from-fuchsia-500 to-pink-600',
    badge: 'bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400',
    text: 'text-fuchsia-400',
    glow: 'shadow-[0_0_10px_rgba(217,70,239,0.5)]',
    activeIndicator: 'bg-fuchsia-500 shadow-[0_0_8px_rgba(217,70,239,0.8)]',
    logoGradient: 'from-fuchsia-600 to-pink-800',
  },
  lime: {
    button: 'bg-gradient-to-br from-lime-500 to-green-600 text-white shadow-lg shadow-lime-500/30 hover:shadow-lime-500/50',
    icon: 'bg-gradient-to-br from-lime-500 to-green-600',
    badge: 'bg-lime-500/10 border border-lime-500/20 text-lime-400',
    text: 'text-lime-400',
    glow: 'shadow-[0_0_10px_rgba(132,204,22,0.5)]',
    activeIndicator: 'bg-lime-500 shadow-[0_0_8px_rgba(132,204,22,0.8)]',
    logoGradient: 'from-lime-600 to-green-800',
  },
  yellow: {
    button: 'bg-gradient-to-br from-yellow-500 to-amber-600 text-white shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50',
    icon: 'bg-gradient-to-br from-yellow-500 to-amber-600',
    badge: 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400',
    text: 'text-yellow-400',
    glow: 'shadow-[0_0_10px_rgba(234,179,8,0.5)]',
    activeIndicator: 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]',
    logoGradient: 'from-yellow-600 to-amber-800',
  },
  red: {
    button: 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/30 hover:shadow-red-500/50',
    icon: 'bg-gradient-to-br from-red-500 to-rose-600',
    badge: 'bg-red-500/10 border border-red-500/20 text-red-400',
    text: 'text-red-400',
    glow: 'shadow-[0_0_10px_rgba(239,68,68,0.5)]',
    activeIndicator: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]',
    logoGradient: 'from-red-600 to-rose-800',
  },
  slate: {
    button: 'bg-gradient-to-br from-slate-500 to-gray-600 text-white shadow-lg shadow-slate-500/30 hover:shadow-slate-500/50',
    icon: 'bg-gradient-to-br from-slate-500 to-gray-600',
    badge: 'bg-slate-500/10 border border-slate-500/20 text-slate-400',
    text: 'text-slate-400',
    glow: 'shadow-[0_0_10px_rgba(100,116,139,0.5)]',
    activeIndicator: 'bg-slate-500 shadow-[0_0_8px_rgba(100,116,139,0.8)]',
    logoGradient: 'from-slate-600 to-gray-800',
  },
};

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    // Load from localStorage or default to 'indigo'
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved && themes[saved]) {
        return saved;
      }
    }
    return 'indigo';
  });

  const theme = themes[currentTheme] || themes.indigo;

  const setTheme = (themeId: string) => {
    if (themes[themeId]) {
      setCurrentTheme(themeId);
      if (typeof window !== 'undefined') {
        localStorage.setItem(THEME_STORAGE_KEY, themeId);
      }
    }
  };

  const getThemeClasses = () => {
    return themeClassMap[currentTheme] || themeClassMap.indigo;
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, theme, setTheme, getThemeClasses }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

