import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Command, Lock, User, LogIn, AlertCircle } from 'lucide-react';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { theme, getThemeClasses } = useTheme();
  const themeClasses = getThemeClasses();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Get theme color values for ambient glows
  const getThemeColor = (opacity: number = 1) => {
    const colorMap: Record<string, string> = {
      indigo: `rgba(99, 102, 241, ${opacity})`,
      cyan: `rgba(6, 182, 212, ${opacity})`,
      emerald: `rgba(16, 185, 129, ${opacity})`,
      rose: `rgba(244, 63, 94, ${opacity})`,
      amber: `rgba(245, 158, 11, ${opacity})`,
      blue: `rgba(59, 130, 246, ${opacity})`,
      teal: `rgba(20, 184, 166, ${opacity})`,
      purple: `rgba(168, 85, 247, ${opacity})`,
      fuchsia: `rgba(217, 70, 239, ${opacity})`,
      lime: `rgba(132, 204, 22, ${opacity})`,
      yellow: `rgba(234, 179, 8, ${opacity})`,
      red: `rgba(239, 68, 68, ${opacity})`,
      slate: `rgba(100, 116, 139, ${opacity})`,
    };
    return colorMap[theme.primary.split('-')[0]] || colorMap.indigo;
  };

  const getThemeGlowColor = () => getThemeColor(0.1);
  const getThemeGlowColorSecondary = () => {
    const colorMap: Record<string, string> = {
      indigo: 'rgba(147, 51, 234, 0.05)',
      cyan: 'rgba(37, 99, 235, 0.05)',
      emerald: 'rgba(22, 163, 74, 0.05)',
      rose: 'rgba(219, 39, 119, 0.05)',
      amber: 'rgba(234, 88, 12, 0.05)',
      blue: 'rgba(99, 102, 241, 0.05)',
      teal: 'rgba(6, 182, 212, 0.05)',
      purple: 'rgba(99, 102, 241, 0.05)',
      fuchsia: 'rgba(219, 39, 119, 0.05)',
      lime: 'rgba(22, 163, 74, 0.05)',
      yellow: 'rgba(245, 158, 11, 0.05)',
      red: 'rgba(244, 63, 94, 0.05)',
      slate: 'rgba(71, 85, 105, 0.05)',
    };
    return colorMap[theme.secondary.split('-')[0]] || colorMap.indigo;
  };

  const getThemeGlowColorForLogo = () => {
    const colorMap: Record<string, string> = {
      indigo: 'rgba(99, 102, 241, 0.2)',
      cyan: 'rgba(6, 182, 212, 0.2)',
      emerald: 'rgba(16, 185, 129, 0.2)',
      rose: 'rgba(244, 63, 94, 0.2)',
      amber: `rgba(245, 158, 11, 0.2)`,
      violet: 'rgba(139, 92, 246, 0.2)',
    };
    return colorMap[theme.primary.split('-')[0]] || colorMap.indigo;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(username, password);
      if (!success) {
        setError('Invalid credentials. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-space-950 text-slate-200 font-sans overflow-hidden relative">
      <style>{`
        ::selection {
          background-color: ${getThemeColor(0.3)};
          color: ${getThemeColor(1)};
        }
      `}</style>

      {/* Cinematic Ambient Glow */}
      <div 
        className="absolute top-[-20%] left-[20%] w-[60%] h-[60%] rounded-full blur-[150px] pointer-events-none z-0" 
        style={{ backgroundColor: getThemeGlowColor() }}
      />
      <div 
        className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none z-0" 
        style={{ backgroundColor: getThemeGlowColorSecondary() }}
      />

      {/* Login Container */}
      <div className="flex-1 flex items-center justify-center relative z-10 p-4">
        <div className="w-full max-w-md">
          {/* Logo Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative w-16 h-16 flex items-center justify-center mb-4">
              <div 
                className="absolute inset-0 rounded-xl blur-lg" 
                style={{ backgroundColor: getThemeGlowColorForLogo() }}
              />
              <div className={`relative w-full h-full bg-gradient-to-br ${themeClasses.logoGradient} rounded-xl flex items-center justify-center text-white border border-white/10 shadow-lg`}>
                <Command size={32} />
              </div>
            </div>
            <div className="text-center">
              <div className="font-sans font-bold text-2xl text-white tracking-wide mb-1">JARVIS</div>
              <div className={`text-xs ${themeClasses.text} font-mono tracking-wider`}>OS V2.0</div>
            </div>
          </div>

          {/* Login Card */}
          <div className="glass-panel rounded-2xl p-8 border border-white/10 shadow-2xl">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white mb-2">System Access</h2>
              <p className="text-sm text-slate-400">Enter your credentials to access the neural interface</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username Field */}
              <div>
                <label htmlFor="username" className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <User size={18} />
                  </div>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-space-900/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10 transition-all"
                    placeholder="Enter username"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <Lock size={18} />
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-space-900/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10 transition-all"
                    placeholder="Enter password"
                    required
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full ${themeClasses.button} py-3 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                style={!isLoading ? { boxShadow: `0 0 20px ${getThemeColor(0.3)}` } : {}}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    <span>Access System</span>
                  </>
                )}
              </button>
            </form>

            {/* Footer Note */}
            <div className="mt-6 pt-6 border-t border-white/5 text-center">
              <p className="text-xs text-slate-500 font-mono">
                Neural interface protected
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

