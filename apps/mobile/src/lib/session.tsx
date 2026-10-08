import type { Session } from '@supabase/supabase-js';
import { getChildProfileState } from '@sproutcue/shared/profile-defaults';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { apiRequest } from './api';
import { isSupabaseConfigured } from './config';
import { supabase } from './supabase';

export type SproutCueUser = {
  id?: string;
  displayName?: string;
  email?: string;
  childProfile?: unknown;
  playPreferences?: unknown;
  location?: { address?: string; label?: string } | null;
  socialLinks?: { avatarUrl?: string } | null;
  [key: string]: unknown;
};

type SessionState = {
  /** True until the stored session (and profile, when signed in) has been read. */
  loading: boolean;
  session: Session | null;
  user: SproutCueUser | null;
  /** Child profile is complete → show the tabs; otherwise the welcome flow. */
  onboarded: boolean;
  /** No Supabase keys configured: browse the UI without signing in (nothing saves). */
  previewMode: boolean;
  profileError: string;
  refreshProfile: () => Promise<void>;
  setUser: (user: SproutCueUser) => void;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const previewMode = !isSupabaseConfigured;
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(previewMode);
  const [user, setUser] = useState<SproutCueUser | null>(null);
  const [profileError, setProfileError] = useState('');

  // Restore the session from secure storage and follow sign-in / sign-out / refresh events.
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id ?? '';

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    setProfileError('');
    try {
      const result = await apiRequest<{ user: SproutCueUser }>('/profile');
      setUser(result.user);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not load your family profile.');
    }
  }, [userId]);

  // Load the family profile whenever a different person signs in.
  useEffect(() => {
    if (userId) refreshProfile();
    else {
      setUser(null);
      setProfileError('');
    }
  }, [userId, refreshProfile]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Sign-in is not configured for this build.');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Sign-in is not configured for this build.');
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) throw error;
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo<SessionState>(() => {
    const onboarded = previewMode || Boolean(user && getChildProfileState(user).onboardingComplete);
    return {
      // Stay on the splash until the profile arrives (or fails). Without this there's one render
      // where a signed-in family looks "not set up", and the router drops deep links like /playdate/<id>.
      loading: !sessionLoaded || (Boolean(userId) && !user && !profileError),
      session,
      user,
      onboarded,
      previewMode,
      profileError,
      refreshProfile,
      setUser,
      signInWithPassword,
      signUpWithPassword,
      signOut,
    };
  }, [previewMode, sessionLoaded, userId, user, session, profileError, refreshProfile, signInWithPassword, signUpWithPassword, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>.');
  return value;
}
