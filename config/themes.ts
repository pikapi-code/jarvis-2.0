export interface Theme {
    name: string;
    primary: string;
    secondary: string;
    gradient: string;
    shadow: string;
    shadowHover: string;
    accent: string;
    accentLight: string;
}

export const themes: Record<string, Theme> = {
    indigo: {
        name: 'Indigo Purple',
        primary: 'indigo-500',
        secondary: 'purple-600',
        gradient: 'from-indigo-500 to-purple-600',
        shadow: 'shadow-indigo-500/30',
        shadowHover: 'hover:shadow-indigo-500/50',
        accent: 'indigo-400',
        accentLight: 'indigo-500/10'
    },
    cyan: {
        name: 'Cyan Blue',
        primary: 'cyan-500',
        secondary: 'blue-600',
        gradient: 'from-cyan-500 to-blue-600',
        shadow: 'shadow-cyan-500/30',
        shadowHover: 'hover:shadow-cyan-500/50',
        accent: 'cyan-400',
        accentLight: 'cyan-500/10'
    },
    emerald: {
        name: 'Emerald Green',
        primary: 'emerald-500',
        secondary: 'green-600',
        gradient: 'from-emerald-500 to-green-600',
        shadow: 'shadow-emerald-500/30',
        shadowHover: 'hover:shadow-emerald-500/50',
        accent: 'emerald-400',
        accentLight: 'emerald-500/10'
    },
    rose: {
        name: 'Rose Pink',
        primary: 'rose-500',
        secondary: 'pink-600',
        gradient: 'from-rose-500 to-pink-600',
        shadow: 'shadow-rose-500/30',
        shadowHover: 'hover:shadow-rose-500/50',
        accent: 'rose-400',
        accentLight: 'rose-500/10'
    },
    amber: {
        name: 'Amber Orange',
        primary: 'amber-500',
        secondary: 'orange-600',
        gradient: 'from-amber-500 to-orange-600',
        shadow: 'shadow-amber-500/30',
        shadowHover: 'hover:shadow-amber-500/50',
        accent: 'amber-400',
        accentLight: 'amber-500/10'
    },
    blue: {
        name: 'Ocean Blue',
        primary: 'blue-500',
        secondary: 'indigo-600',
        gradient: 'from-blue-500 to-indigo-600',
        shadow: 'shadow-blue-500/30',
        shadowHover: 'hover:shadow-blue-500/50',
        accent: 'blue-400',
        accentLight: 'blue-500/10'
    },
    teal: {
        name: 'Teal Turquoise',
        primary: 'teal-500',
        secondary: 'cyan-600',
        gradient: 'from-teal-500 to-cyan-600',
        shadow: 'shadow-teal-500/30',
        shadowHover: 'hover:shadow-teal-500/50',
        accent: 'teal-400',
        accentLight: 'teal-500/10'
    },
    purple: {
        name: 'Deep Purple',
        primary: 'purple-500',
        secondary: 'indigo-600',
        gradient: 'from-purple-500 to-indigo-600',
        shadow: 'shadow-purple-500/30',
        shadowHover: 'hover:shadow-purple-500/50',
        accent: 'purple-400',
        accentLight: 'purple-500/10'
    },
    fuchsia: {
        name: 'Fuchsia Pink',
        primary: 'fuchsia-500',
        secondary: 'pink-600',
        gradient: 'from-fuchsia-500 to-pink-600',
        shadow: 'shadow-fuchsia-500/30',
        shadowHover: 'hover:shadow-fuchsia-500/50',
        accent: 'fuchsia-400',
        accentLight: 'fuchsia-500/10'
    },
    lime: {
        name: 'Lime Green',
        primary: 'lime-500',
        secondary: 'green-600',
        gradient: 'from-lime-500 to-green-600',
        shadow: 'shadow-lime-500/30',
        shadowHover: 'hover:shadow-lime-500/50',
        accent: 'lime-400',
        accentLight: 'lime-500/10'
    },
    yellow: {
        name: 'Golden Yellow',
        primary: 'yellow-500',
        secondary: 'amber-600',
        gradient: 'from-yellow-500 to-amber-600',
        shadow: 'shadow-yellow-500/30',
        shadowHover: 'hover:shadow-yellow-500/50',
        accent: 'yellow-400',
        accentLight: 'yellow-500/10'
    },
    red: {
        name: 'Crimson Red',
        primary: 'red-500',
        secondary: 'rose-600',
        gradient: 'from-red-500 to-rose-600',
        shadow: 'shadow-red-500/30',
        shadowHover: 'hover:shadow-red-500/50',
        accent: 'red-400',
        accentLight: 'red-500/10'
    },
    slate: {
        name: 'Slate Gray',
        primary: 'slate-500',
        secondary: 'gray-600',
        gradient: 'from-slate-500 to-gray-600',
        shadow: 'shadow-slate-500/30',
        shadowHover: 'hover:shadow-slate-500/50',
        accent: 'slate-400',
        accentLight: 'slate-500/10'
    }
};

// Note: getThemeClasses is now provided by ThemeContext
// This file only exports theme definitions
