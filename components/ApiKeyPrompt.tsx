import React, { useEffect } from 'react';
import { Key, X, Settings } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ApiKeyPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToSettings?: () => void;
  message?: string;
  autoDismissDuration?: number; // Duration in milliseconds, default 10000 (10 seconds)
}

const ApiKeyPrompt: React.FC<ApiKeyPromptProps> = ({
  isOpen,
  onClose,
  onNavigateToSettings,
  message = 'Please add your Gemini API key to use this feature.',
  autoDismissDuration = 10000
}) => {
  const { theme, getThemeClasses } = useTheme();
  const themeClasses = getThemeClasses();

  // Auto-dismiss after specified duration
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      onClose();
    }, autoDismissDuration);

    return () => clearTimeout(timer);
  }, [isOpen, onClose, autoDismissDuration]);

  // Get theme color for background and borders
  // Uses darker shades for backgrounds (like -950 in Tailwind)
  const getThemeColor = (opacity: number = 1, isDark: boolean = false) => {
    const colorMap: Record<string, { light: string; dark: string }> = {
      indigo: { light: 'rgba(99, 102, 241, ', dark: 'rgba(30, 27, 75, ' },
      cyan: { light: 'rgba(6, 182, 212, ', dark: 'rgba(22, 78, 99, ' },
      emerald: { light: 'rgba(16, 185, 129, ', dark: 'rgba(6, 78, 59, ' },
      rose: { light: 'rgba(244, 63, 94, ', dark: 'rgba(76, 29, 55, ' },
      amber: { light: 'rgba(245, 158, 11, ', dark: 'rgba(69, 26, 3, ' },
      blue: { light: 'rgba(59, 130, 246, ', dark: 'rgba(30, 58, 138, ' },
      teal: { light: 'rgba(20, 184, 166, ', dark: 'rgba(19, 78, 74, ' },
      purple: { light: 'rgba(168, 85, 247, ', dark: 'rgba(59, 7, 100, ' },
      fuchsia: { light: 'rgba(217, 70, 239, ', dark: 'rgba(74, 29, 110, ' },
      lime: { light: 'rgba(132, 204, 22, ', dark: 'rgba(54, 83, 20, ' },
      yellow: { light: 'rgba(234, 179, 8, ', dark: 'rgba(66, 32, 6, ' },
      red: { light: 'rgba(239, 68, 68, ', dark: 'rgba(69, 10, 10, ' },
      slate: { light: 'rgba(100, 116, 139, ', dark: 'rgba(15, 23, 42, ' },
    };
    const colors = colorMap[theme.primary.split('-')[0]] || colorMap.indigo;
    const baseColor = isDark ? colors.dark : colors.light;
    return `${baseColor}${opacity})`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-2xl w-full mx-4 animate-in slide-in-from-top">
      <div 
        className="rounded-xl shadow-lg backdrop-blur-md p-4 border"
        style={{
          backgroundColor: `${getThemeColor(0.9, true)}`,
          borderColor: `${getThemeColor(0.3, false)}`,
        }}
      >
        <div className="flex items-start gap-3">
          <div 
            className="flex-shrink-0 p-2 rounded-lg"
            style={{ backgroundColor: `${getThemeColor(0.2, false)}` }}
          >
            <Key size={20} className={themeClasses.text} />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-semibold ${themeClasses.text} mb-1`}>
              API Key Required
            </h3>
            <p 
              className="text-xs mb-3"
              style={{ color: `${getThemeColor(0.8, false)}` }}
            >
              {message}
            </p>
            
            <div className="flex items-center gap-2">
              {onNavigateToSettings && (
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToSettings();
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${themeClasses.button} hover:shadow-lg`}
                >
                  <Settings size={14} />
                  Go to Settings
                </button>
              )}
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                style={{ 
                  color: `${getThemeColor(0.7, false)}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = getThemeColor(0.9, false);
                  e.currentTarget.style.backgroundColor = getThemeColor(0.1, false);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = getThemeColor(0.7, false);
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="flex-shrink-0 transition-colors p-1 rounded"
            style={{ 
              color: `${getThemeColor(0.6, false)}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = getThemeColor(0.9, false);
              e.currentTarget.style.backgroundColor = getThemeColor(0.1, false);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = getThemeColor(0.6, false);
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyPrompt;

