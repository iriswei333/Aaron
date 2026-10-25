import type { OAuthResult } from '@/lib/oauth';

export type AppleButtonProps = { onPress: () => void; loading?: boolean; disabled?: boolean };

// Sign in with Apple is iOS only (see apple-button.ios.tsx); nothing shows on Android or web.
export function AppleButton(_props: AppleButtonProps) {
  return null;
}

export async function signInWithApple(): Promise<OAuthResult> {
  return { status: 'error', message: 'Sign in with Apple is only available on iPhone and iPad.' };
}
