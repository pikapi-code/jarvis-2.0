import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; isExistingUser?: boolean }>;
  signUp: (email: string, password: string, username?: string) => Promise<{ success: boolean; error?: string; isExistingUser?: boolean }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  username: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const isVerifyingUserRef = useRef(false);

  // Get username from user metadata or email
  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || null;

  useEffect(() => {
    if (!supabase) {
      // Fallback to fake auth if Supabase not configured
      const storedAuth = localStorage.getItem('jarvis-auth');
      if (storedAuth === 'true') {
        setUser({ id: 'local-user', email: localStorage.getItem('jarvis-username') || undefined } as User);
      }
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Ignore auth state changes when we're verifying if a user exists during signup
      // This prevents the brief flash of authenticated state
      if (!isVerifyingUserRef.current) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string; isExistingUser?: boolean }> => {
    if (!supabase) {
      // Fallback to fake auth
      if (email.trim() && password.trim()) {
        setUser({ id: 'local-user', email } as User);
        localStorage.setItem('jarvis-auth', 'true');
        localStorage.setItem('jarvis-username', email);
        return { success: true, isExistingUser: true };
      }
      return { success: false, error: 'Invalid credentials' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user && data.session) {
        setUser(data.user);
        setSession(data.session);
        // Check if this is an existing user by checking if they have any data
        // For now, we'll assume if they can log in, they're an existing user
        return { success: true, isExistingUser: true };
      }

      return { success: false, error: 'Login failed' };
    } catch (error: any) {
      return { success: false, error: error.message || 'An error occurred during login' };
    }
  };

  const signUp = async (email: string, password: string, username?: string): Promise<{ success: boolean; error?: string; isExistingUser?: boolean }> => {
    if (!supabase) {
      // Fallback to fake auth
      if (email.trim() && password.trim()) {
        setUser({ id: 'local-user', email, user_metadata: { username } } as User);
        localStorage.setItem('jarvis-auth', 'true');
        localStorage.setItem('jarvis-username', email);
        return { success: true, isExistingUser: false };
      }
      return { success: false, error: 'Invalid credentials' };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username || email.split('@')[0],
          },
        },
      });

      if (error) {
        // Check if error is because user already exists
        const errorMsg = error.message.toLowerCase();
        const errorStatus = error.status || error.code || '';
        
        // Common Supabase error codes/messages for existing users
        if (errorMsg.includes('already registered') || 
            errorMsg.includes('already exists') || 
            errorMsg.includes('user already registered') ||
            errorMsg.includes('email address is already registered') ||
            errorMsg.includes('user with this email already exists') ||
            errorStatus === '422' || // Unprocessable Entity often means user exists
            errorStatus === '409') { // Conflict
          return { success: false, error: 'An account with this email already exists. Please sign in instead.', isExistingUser: true };
        }
        return { success: false, error: error.message };
      }

      // If we have a user, check if it's actually a new user or existing
      // Supabase sometimes returns user object even for existing users (security)
      if (data.user) {
        // Check if user needs email confirmation
        const needsEmailConfirmation = !data.session && data.user.email && !data.user.email_confirmed_at;
        
        // If we have a session, email confirmation is disabled
        // But don't auto-login - let user sign in manually after seeing success message
        // This gives better UX and prevents immediate redirect
        if (data.session) {
          // Verify this is actually a new user by checking created_at timestamp
          const userCreatedAt = new Date(data.user.created_at);
          const now = new Date();
          const secondsSinceCreation = (now.getTime() - userCreatedAt.getTime()) / 1000;
          
          // If user was created more than 10 seconds ago, it might be an existing user
          // Try to sign in to verify (but don't actually log them in)
          if (secondsSinceCreation > 10) {
            try {
              // Set flag to prevent auth state changes from updating UI
              isVerifyingUserRef.current = true;
              const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                email,
                password,
              });

              if (loginData?.user && loginData?.session && !loginError) {
                // User already existed - manually reset auth state and sign out
                setUser(null);
                setSession(null);
                await supabase.auth.signOut();
                isVerifyingUserRef.current = false;
                return { success: false, error: 'An account with this email already exists. Please sign in instead.', isExistingUser: true };
              }
              isVerifyingUserRef.current = false;
            } catch {
              // Sign in failed, proceed with new user
              isVerifyingUserRef.current = false;
            }
          }
          
          // New user created successfully
          // Don't auto-login - sign out and let them sign in manually
          // This prevents immediate redirect and shows success message first
          await supabase.auth.signOut();
          return { success: true, isExistingUser: false };
        }

        // If no session, it might be:
        // 1. New user needing email confirmation
        // 2. Existing user (Supabase doesn't always error for security)
        
        // Try to sign in to verify if user already exists
        // If sign in succeeds immediately, user already existed
        try {
          // Set flag to prevent auth state changes from updating UI
          isVerifyingUserRef.current = true;
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (loginData?.user && loginData?.session && !loginError) {
            // User already existed - manually reset auth state and sign out
            setUser(null);
            setSession(null);
            await supabase.auth.signOut();
            isVerifyingUserRef.current = false;
            return { success: false, error: 'An account with this email already exists. Please sign in instead.', isExistingUser: true };
          }
          isVerifyingUserRef.current = false;
        } catch {
          // Sign in failed, so this is likely a new user needing email confirmation
          // Return success but don't set session (user needs to confirm email)
          isVerifyingUserRef.current = false;
        }

        // New user created, but needs email confirmation
        // Don't log them in - they need to confirm email first
        return { success: true, isExistingUser: false };
      }

      return { success: false, error: 'Sign up failed' };
    } catch (error: any) {
      // Check if error indicates existing user
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorMsg.includes('already registered') || 
          errorMsg.includes('already exists') || 
          errorMsg.includes('user already registered') ||
          errorMsg.includes('email address is already registered')) {
        return { success: false, error: 'An account with this email already exists. Please sign in instead.', isExistingUser: true };
      }
      return { success: false, error: error.message || 'An error occurred during sign up' };
    }
  };

  const forgotPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    if (!supabase) {
      return { success: false, error: 'Password reset is not available in development mode. Please configure Supabase.' };
    }

    try {
      // Use the current origin for redirect - Supabase will handle the password reset flow
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}`,
      });

      if (error) {
        // Check for common errors
        if (error.message.includes('not found') || error.message.includes('does not exist')) {
          // Don't reveal if email exists or not for security
          return { success: true }; // Return success even if email doesn't exist (security best practice)
        }
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'An error occurred while sending password reset email' };
    }
  };

  const logout = async (): Promise<void> => {
    if (!supabase) {
      // Fallback to fake auth
      setUser(null);
      setSession(null);
      localStorage.removeItem('jarvis-auth');
      localStorage.removeItem('jarvis-username');
      return;
    }

    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        session,
        login,
        signUp,
        forgotPassword,
        logout,
        username,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
