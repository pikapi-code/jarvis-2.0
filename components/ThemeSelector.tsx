import React, { useRef, useEffect, useState } from 'react';
import { themes } from '../config/themes';
import { Palette, Check } from 'lucide-react';

interface ThemeSelectorProps {
    currentTheme: string;
    onThemeChange: (themeId: string) => void;
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({ currentTheme, onThemeChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0, right: 0, useLeft: false });
    const [isOpening, setIsOpening] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const clickOutsideHandlerRef = useRef<((event: MouseEvent) => void) | null>(null);

    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            // Detect if button is on the right side of screen
            const isOnRightSide = rect.right > window.innerWidth / 2;
            const gap = 8; // Gap between button and dropdown
            const dropdownWidth = 224; // w-56 = 14rem = 224px
            
            if (isOnRightSide) {
                // Open to the left of button
                // Position dropdown's right edge at button's left edge - gap
                // left = button.left - gap - dropdownWidth
                setPosition({
                    top: rect.bottom + gap,
                    left: rect.left - gap - dropdownWidth,
                    right: 0,
                    useLeft: true,
                });
            } else {
                // Open to the right of button  
                // Position dropdown's left edge at button's right edge + gap
                // right = window.innerWidth - (button.right + gap)
                setPosition({
                    top: rect.bottom + gap,
                    left: 0,
                    right: window.innerWidth - rect.right - gap,
                    useLeft: false,
                });
            }
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            // Clean up listener when closed
            if (clickOutsideHandlerRef.current) {
                document.removeEventListener('mousedown', clickOutsideHandlerRef.current);
                clickOutsideHandlerRef.current = null;
            }
            return;
        }

        // Small delay to prevent immediate closure from the opening click
        const timeoutId = setTimeout(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (
                    dropdownRef.current &&
                    !dropdownRef.current.contains(event.target as Node) &&
                    buttonRef.current &&
                    !buttonRef.current.contains(event.target as Node)
                ) {
                    setIsOpen(false);
                }
            };

            clickOutsideHandlerRef.current = handleClickOutside;
            document.addEventListener('mousedown', handleClickOutside);
        }, 10);

        return () => {
            clearTimeout(timeoutId);
            if (clickOutsideHandlerRef.current) {
                document.removeEventListener('mousedown', clickOutsideHandlerRef.current);
                clickOutsideHandlerRef.current = null;
            }
        };
    }, [isOpen]);

    return (
        <div data-theme-selector>
            {/* Theme Button */}
            <button
                ref={buttonRef}
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const newState = !isOpen;
                    setIsOpening(true);
                    setIsOpen(newState);
                    // Reset opening flag after a delay
                    setTimeout(() => {
                        setIsOpening(false);
                    }, 200);
                }}
                onMouseDown={(e) => {
                    e.stopPropagation();
                }}
                className="p-2 rounded-full bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all relative z-10"
                title="Change Theme"
            >
                <Palette size={18} />
            </button>

            {/* Dropdown - Fixed positioning to escape overflow */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-[100] bg-transparent"
                        style={{ pointerEvents: isOpening ? 'none' : 'auto' }}
                        onClick={(e) => {
                            // Don't close if we're in the opening process
                            if (isOpening) {
                                return;
                            }
                            // Only close if clicking directly on backdrop
                            if (e.target === e.currentTarget) {
                                setIsOpen(false);
                            }
                        }}
                        onMouseDown={(e) => {
                            if (isOpening) {
                                e.stopPropagation();
                            }
                        }}
                    />

                    {/* Menu */}
                    <div
                        ref={dropdownRef}
                        className="fixed w-56 bg-space-900 rounded-xl border border-white/10 shadow-2xl z-[101] overflow-hidden"
                        style={{
                            top: `${position.top}px`,
                            ...(position.useLeft ? { left: `${position.left}px` } : { right: `${position.right}px` }),
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div className="p-3 border-b border-white/10">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Color Theme</p>
                        </div>
                        <div className="p-2 space-y-1">
                            {Object.entries(themes).map(([id, theme]) => (
                                <button
                                    key={id}
                                    onClick={() => {
                                        onThemeChange(id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${currentTheme === id
                                            ? 'bg-white/10 text-white'
                                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${theme.gradient} shadow-lg`} />
                                        <span className="text-sm font-medium">{theme.name}</span>
                                    </div>
                                    {currentTheme === id && (
                                        <Check size={16} className="text-emerald-400" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ThemeSelector;
