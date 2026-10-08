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
  const { user } = useSession();
  const [draft, setDraft] = useState<WelcomeDraft>(() => welcomeDraftFromUser(user));
  const update = (changes: Partial<WelcomeDraft>) => setDraft((current) => ({ ...current, ...changes }));
  return <WelcomeContext.Provider value={{ draft, update }}>{children}</WelcomeContext.Provider>;
}

export function useWelcome() {
  const value = useContext(WelcomeContext);
  if (!value) throw new Error('useWelcome must be used inside <WelcomeProvider>.');
  return value;
}
