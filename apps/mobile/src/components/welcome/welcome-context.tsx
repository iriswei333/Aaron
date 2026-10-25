import { welcomeDraftFromUser } from '@sproutcue/shared/onboarding';
import { createContext, useContext, useState, type ReactNode } from 'react';

import { useSession } from '@/lib/session';

export type WelcomeDraft = ReturnType<typeof welcomeDraftFromUser>;

type WelcomeContextValue = {
  draft: WelcomeDraft;
  update: (changes: Partial<WelcomeDraft>) => void;
};

const WelcomeContext = createContext<WelcomeContextValue | null>(null);

// Holds the answers while the parent moves between the welcome screens.
export function WelcomeProvider({ children }: { children: ReactNode }) {
  const { user, session } = useSession();
  const [draft, setDraft] = useState<WelcomeDraft>(() => {
    const initial = welcomeDraftFromUser(user);
    // Sign in with Apple shares the parent's name once (saved to auth metadata); start from it.
    const meta = session?.user?.user_metadata as { given_name?: string; full_name?: string } | undefined;
    const signInName = meta?.given_name || meta?.full_name?.split(' ')[0] || '';
    return initial.displayName?.trim() || !signInName ? initial : { ...initial, displayName: signInName };
  });
  const update = (changes: Partial<WelcomeDraft>) => setDraft((current) => ({ ...current, ...changes }));
  return <WelcomeContext.Provider value={{ draft, update }}>{children}</WelcomeContext.Provider>;
}

export function useWelcome() {
  const value = useContext(WelcomeContext);
  if (!value) throw new Error('useWelcome must be used inside <WelcomeProvider>.');
  return value;
}
