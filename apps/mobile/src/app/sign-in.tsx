import { isEmailCodeComplete, isLikelyEmail, normalizeEmailCode } from '@sproutcue/shared/auth-email';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { GoogleButton } from '@/components/auth/google-button';
import { BrandMark } from '@/components/brand/brand-mark';
import { Button, Card, Screen, TextField } from '@/components/ui';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { config } from '@/lib/config';
import { sendMagicLink, signInWithGoogle, verifyEmailCode } from '@/lib/oauth';
import { useSession } from '@/lib/session';

type Status = { tone: 'error' | 'info'; text: string } | null;

const RESEND_SECONDS = 60;

// Sign in with Google, an emailed magic link (the default email option, like the web app),
// or an email + password. Facebook and Sign in with Apple arrive in the sign-in phase.
export default function SignInScreen() {
  const { signInWithPassword, signUpWithPassword } = useSession();
  const [method, setMethod] = useState<'link' | 'password'>('link');
  const [passwordMode, setPasswordMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [linkSentTo, setLinkSentTo] = useState('');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState<'' | 'google' | 'link' | 'password' | 'code'>('');
  const [status, setStatus] = useState<Status>(null);
  const passwordRef = useRef<TextInput>(null);

  // Resend countdown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function emailLink(target = email) {
    if (!isLikelyEmail(target)) {
      setStatus({ tone: 'error', text: 'Enter the email address you use for SproutCue.' });
      return;
    }
    setBusy('link');
    setStatus(null);
    const result = await sendMagicLink(target);
    setBusy('');
    if (result.status === 'sent') {
      setLinkSentTo(target.trim());
      setCode('');
      setCooldown(RESEND_SECONDS);
    } else if (result.status === 'error') {
      setStatus({ tone: 'error', text: result.message });
      if (result.retryAfter) setCooldown(result.retryAfter);
    }
  }

  async function submitCode() {
    setBusy('code');
    setStatus(null);
    const result = await verifyEmailCode(linkSentTo, code);
    setBusy('');
    // On success the session listener moves the app on by itself.
    if (result.status === 'error') setStatus({ tone: 'error', text: result.message });
  }

  async function submitPassword() {
    if (!isLikelyEmail(email) || password.length < 6) {
      setStatus({ tone: 'error', text: 'Enter your email and a password of at least 6 characters.' });
      return;
    }
    setBusy('password');
    setStatus(null);
    try {
      if (passwordMode === 'sign-in') {
        await signInWithPassword(email, password);
      } else {
        const { needsConfirmation } = await signUpWithPassword(email, password);
        if (needsConfirmation) setStatus({ tone: 'info', text: 'Check your email to confirm your account, then sign in here.' });
      }
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : 'Could not sign in. Please try again.' });
    } finally {
      setBusy('');
    }
  }

  async function continueWithGoogle() {
    setBusy('google');
    setStatus(null);
    try {
      const result = await signInWithGoogle();
      if (result.status === 'error') setStatus({ tone: 'error', text: result.message });
    } finally {
      setBusy('');
    }
  }

  function useDifferentEmail() {
    setLinkSentTo('');
    setCode('');
    setStatus(null);
  }

  const privacyUrl = config.apiBaseUrl ? config.apiBaseUrl.replace(/\/api\/?$/, '/privacy') : '';
  const working = busy !== '';
  const creating = method === 'password' && passwordMode === 'sign-up';

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <BrandMark />
      <Image source={require('@/assets/images/playdates.jpg')} style={styles.hero} contentFit="cover" accessibilityLabel="Families meeting at a neighborhood playground" />
      <View style={styles.copy}>
        <Text style={Type.eyebrow}>For parents of little ones</Text>
        <Text style={Type.display}>{creating ? 'Create your family space' : 'Welcome to your family space'}</Text>
        <Text style={Type.bodyMuted}>One child profile turns nearby discoveries, stories, and small daily steps into ideas that fit your family.</Text>
      </View>

      <Card>
        {linkSentTo ? (
          <>
            <Text style={styles.mail} accessibilityElementsHidden>✉️</Text>
            <Text accessibilityRole="header" style={Type.heading}>Check your email</Text>
            <Text style={Type.bodyMuted}>
              We sent a sign-in link to <Text style={styles.strong}>{linkSentTo}</Text>. Open it on this device to finish signing in.
            </Text>
            <TextField
              label="Or enter the code from the email"
              value={code}
              onChangeText={(value) => setCode(normalizeEmailCode(value))}
              placeholder="123456"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              hint="Handy if you opened the email on another device."
              returnKeyType="go"
              onSubmitEditing={() => isEmailCodeComplete(code) && submitCode()}
            />
            {status ? <StatusText status={status} /> : null}
            <Button label="Sign in with code" onPress={submitCode} loading={busy === 'code'} disabled={!isEmailCodeComplete(code) || working} fullWidth />
            <Button
              label={cooldown > 0 ? `Resend link in ${cooldown}s` : 'Resend link'}
              variant="secondary"
              onPress={() => emailLink(linkSentTo)}
              loading={busy === 'link'}
              disabled={cooldown > 0 || working}
              fullWidth
            />
            <Button label="Use a different email" variant="ghost" size="sm" fullWidth onPress={useDifferentEmail} />
          </>
        ) : (
          <>
            <GoogleButton onPress={continueWithGoogle} loading={busy === 'google'} disabled={working && busy !== 'google'} />
            <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={styles.rule} />
              <Text style={Type.small}>or use email</Text>
              <View style={styles.rule} />
            </View>
            <TextField
              label="Parent email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType={method === 'link' ? 'send' : 'next'}
              onSubmitEditing={() => (method === 'link' ? emailLink() : passwordRef.current?.focus())}
              placeholder="you@example.com"
            />
            {method === 'password' ? (
              <TextField
                ref={passwordRef}
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={passwordMode === 'sign-in' ? 'current-password' : 'new-password'}
                textContentType={passwordMode === 'sign-in' ? 'password' : 'newPassword'}
                returnKeyType="go"
                onSubmitEditing={submitPassword}
              />
            ) : null}
            {status ? <StatusText status={status} /> : null}
            {method === 'link' ? (
              <>
                <Button
                  label={cooldown > 0 ? `Email me a link in ${cooldown}s` : 'Email me a sign-in link'}
                  onPress={() => emailLink()}
                  loading={busy === 'link'}
                  disabled={cooldown > 0 || (working && busy !== 'link')}
                  fullWidth
                />
                <Text style={[Type.small, styles.center]}>No password needed. New here? The link creates your account.</Text>
                <Button label="Sign in with a password instead" variant="ghost" size="sm" fullWidth onPress={() => { setMethod('password'); setStatus(null); }} />
              </>
            ) : (
              <>
                <Button label={passwordMode === 'sign-in' ? 'Sign in' : 'Create account'} onPress={submitPassword} loading={busy === 'password'} disabled={working && busy !== 'password'} fullWidth />
                <Button
                  label={passwordMode === 'sign-in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
                  variant="ghost"
                  size="sm"
                  fullWidth
                  onPress={() => { setPasswordMode(passwordMode === 'sign-in' ? 'sign-up' : 'sign-in'); setStatus(null); }}
                />
                <Button label="Email me a sign-in link instead" variant="ghost" size="sm" fullWidth onPress={() => { setMethod('link'); setStatus(null); }} />
              </>
            )}
          </>
        )}
      </Card>

      <View style={styles.note}>
        <Text style={styles.heart}>♡</Text>
        <Text style={[Type.small, styles.noteText]}>A grown-up account. Your child never needs an email or login.</Text>
      </View>
      {privacyUrl ? (
        <Link href={privacyUrl as any} style={styles.link}>
          Read the Privacy Policy
        </Link>
      ) : null}
    </Screen>
  );
}

function StatusText({ status }: { status: NonNullable<Status> }) {
  return (
    <Text accessibilityLiveRegion="polite" style={[styles.status, status.tone === 'error' ? styles.error : styles.info]}>
      {status.text}
    </Text>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', aspectRatio: 3 / 2, borderRadius: Radius.card, marginTop: Spacing.two },
  copy: { gap: Spacing.three },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginVertical: Spacing.one },
  rule: { flex: 1, height: 1, backgroundColor: Colors.line },
  mail: { fontSize: 32 },
  strong: { fontWeight: '800', color: Colors.ink },
  center: { textAlign: 'center' },
  status: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  error: { color: Colors.danger },
  info: { color: Colors.success },
  note: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  heart: { color: Colors.brand, fontSize: 16 },
  noteText: { flex: 1 },
  link: { color: Colors.brandStrong, fontWeight: '800', fontSize: 14 },
});
