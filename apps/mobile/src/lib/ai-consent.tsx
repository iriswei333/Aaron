import { AI_CONSENT_VERSION, hasAiConsent, isAiConsentError } from '@sproutcue/shared/ai-consent';
import { getChildProfile } from '@sproutcue/shared/profile-defaults';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import { AiConsentSheet } from '@/components/studio/ai-consent-sheet';

import { apiRequest } from './api';
import { useSession, type SproutCueUser } from './session';

// AI consent (Apple Guideline 5.1.2(i)). AI creations send photos and child details to OpenAI,
// so the parent must allow it first. Every AI action calls `requestConsent()` before it uploads
// or queues anything: it resolves true right away when consent exists, otherwise it opens the
// consent sheet and resolves with the parent's answer. The server refuses AI requests without
// consent (403 AI_CONSENT_REQUIRED); `handleError` turns that into the same sheet.

type AiConsentState = {
  /** The parent agreed to the current AI consent text. */
  allowed: boolean;
  /** 'en' or 'zh-CN', from the child's story language; used for the sheet text. */
  language: 'en' | 'zh-CN';
  /** Resolves true when AI features may be used; asks the parent first when needed. */
  requestConsent: () => Promise<boolean>;
  /** Turns AI features off (the server also cancels creations that haven't started). */
  revoke: () => Promise<void>;
  /** True (and asks for consent again) when `error` is the server's AI_CONSENT_REQUIRED. */
  handleError: (error: unknown) => boolean;
};

const AiConsentContext = createContext<AiConsentState | null>(null);

type ConsentResponse = { user: SproutCueUser; allowed: boolean };

export function AiConsentProvider({ children }: { children: ReactNode }) {
  const { user, setUser, previewMode } = useSession();
  const allowed = previewMode || hasAiConsent(user as any);
  const language = (getChildProfile(user) as any)?.storyLanguage === 'zh-CN' ? 'zh-CN' : 'en';
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const waiting = useRef<((value: boolean) => void)[]>([]);
  const allowedRef = useRef(allowed);
  allowedRef.current = allowed;

  const settle = useCallback((value: boolean) => {
    const resolvers = waiting.current;
    waiting.current = [];
    resolvers.forEach((resolve) => resolve(value));
  }, []);

  const requestConsent = useCallback(() => {
    if (allowedRef.current) return Promise.resolve(true);
    setError('');
    setOpen(true);
    return new Promise<boolean>((resolve) => waiting.current.push(resolve));
  }, []);

  const allow = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      const result = await apiRequest<ConsentResponse>('/ai-consent', { method: 'PUT', body: { version: AI_CONSENT_VERSION } });
      setUser(result.user);
      allowedRef.current = result.allowed;
      setOpen(false);
      settle(result.allowed);
    } catch (err: any) {
      setError(err?.message || 'Could not save your choice. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [setUser, settle]);

  const decline = useCallback(() => {
    setOpen(false);
    settle(false);
  }, [settle]);

  const revoke = useCallback(async () => {
    const result = await apiRequest<ConsentResponse>('/ai-consent', { method: 'DELETE' });
    allowedRef.current = false;
    setUser(result.user);
  }, [setUser]);

  const handleError = useCallback((err: unknown) => {
    if (!isAiConsentError(err)) return false;
    // The server has no consent on record (turned off on another device, or a new version).
    allowedRef.current = false;
    if (user) setUser({ ...user, aiConsent: null });
    requestConsent();
    return true;
  }, [user, setUser, requestConsent]);

  const value = useMemo<AiConsentState>(
    () => ({ allowed, language, requestConsent, revoke, handleError }),
    [allowed, language, requestConsent, revoke, handleError],
  );

  return (
    <AiConsentContext.Provider value={value}>
      {children}
      <AiConsentSheet visible={open} language={language} saving={saving} error={error} onAllow={allow} onDecline={decline} />
    </AiConsentContext.Provider>
  );
}

export function useAiConsent() {
  const value = useContext(AiConsentContext);
  if (!value) throw new Error('useAiConsent must be used inside <AiConsentProvider>.');
  return value;
}
