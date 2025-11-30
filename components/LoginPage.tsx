import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Command, Lock, User, LogIn, AlertCircle, Mail, ArrowLeft } from 'lucide-react';
import Notification, { NotificationType } from './Notification';

const LoginPage: React.FC = () => {
  const { login, signUp, forgotPassword } = useAuth();
  const { theme, getThemeClasses } = useTheme();
  const themeClasses = getThemeClasses();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);

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
      const result = isSignUp
        ? await signUp(email, password, username || undefined)
        : await login(email, password);
      
      if (!result.success) {
        // If user already exists during signup, show info notification
        if (result.isExistingUser && isSignUp) {
          setNotification({ 
            message: 'An account with this email already exists. Please sign in instead.', 
            type: 'info' 
          });
          setIsSignUp(false);
        } else {
          setError(result.error || (isSignUp ? 'Sign up failed. Please try again.' : 'Invalid credentials. Please try again.'));
        }
      } else {
        // Success - show notification
        if (result.isExistingUser) {
          setNotification({ 
            message: `Welcome back! You've successfully logged in.`, 
            type: 'success' 
          });
        } else {
          setNotification({ 
            message: `Account created successfully! Please sign in to continue.`, 
            type: 'success' 
          });
          // Switch to login mode after successful signup
          setIsSignUp(false);
          setEmail(email); // Keep email filled in
          setPassword(''); // Clear password
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSendingReset(true);

    try {
      const result = await forgotPassword(forgotPasswordEmail);
      
      if (result.success) {
        setNotification({ 
          message: 'Password reset email sent! Please check your inbox and follow the instructions.', 
          type: 'success' 
        });
        setShowForgotPassword(false);
        setForgotPasswordEmail('');
      } else {
        setError(result.error || 'Failed to send password reset email. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsSendingReset(false);
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
              <h2 className="text-xl font-semibold text-white mb-2">
                {isSignUp ? 'Create Account' : 'System Access'}
              </h2>
              <p className="text-sm text-slate-400">
                {isSignUp ? 'Sign up to start using Jarvis' : 'Enter your credentials to access the neural interface'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <User size={18} />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-space-900/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10 transition-all"
                    placeholder="Enter email"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Username Field (only for sign up) */}
              {isSignUp && (
                <div>
                  <label htmlFor="username" className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                    Username (optional)
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
                      placeholder="Enter username (optional)"
                    />
                  </div>
                </div>
              )}

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="password" className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Password
                  </label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(true);
                        setError('');
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
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
                    <span>{isSignUp ? 'Creating account...' : 'Authenticating...'}</span>
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    <span>{isSignUp ? 'Create Account' : 'Access System'}</span>
                  </>
                )}
              </button>
            </form>

            {/* Toggle Sign Up/Login */}
            {!showForgotPassword && (
              <div className="mt-6 pt-6 border-t border-white/5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError('');
                  }}
                  className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {isSignUp ? (
                    <>Already have an account? <span className="text-white font-medium">Sign in</span></>
                  ) : (
                    <>Don't have an account? <span className="text-white font-medium">Sign up</span></>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Forgot Password Card */}
          {showForgotPassword && (
            <div className="glass-panel rounded-2xl p-8 border border-white/10 shadow-2xl mt-4">
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotPasswordEmail('');
                    setError('');
                  }}
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-4"
                >
                  <ArrowLeft size={16} />
                  Back to login
                </button>
                <h2 className="text-xl font-semibold text-white mb-2">
                  Reset Password
                </h2>
                <p className="text-sm text-slate-400">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-5">
                {/* Email Field */}
                <div>
                  <label htmlFor="forgot-email" className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                    Email
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                      <Mail size={18} />
                    </div>
                    <input
                      id="forgot-email"
                      type="email"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-space-900/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10 transition-all"
                      placeholder="Enter your email"
                      required
                      autoFocus
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
                  disabled={isSendingReset}
                  className={`w-full ${themeClasses.button} py-3 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                  style={!isSendingReset ? { boxShadow: `0 0 20px ${getThemeColor(0.3)}` } : {}}
                >
                  {isSendingReset ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Mail size={18} />
                      <span>Send Reset Link</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
          duration={5000}
        />
      )}
    </div>
  );
};

export default LoginPage;

