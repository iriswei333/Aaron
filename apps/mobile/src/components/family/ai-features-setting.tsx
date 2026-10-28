import { aiConsentCopy } from '@sproutcue/shared/ai-consent';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { Colors, Spacing, Type } from '@/constants/theme';
import { useAiConsent } from '@/lib/ai-consent';
import { useSession } from '@/lib/session';

type Props = {
  /** Allowing opens the consent sheet; the account sheet closes first so the two don't stack. */
  onAllow: () => void;
};

// Account sheet → "AI features": shows whether AI consent is on, and turns it on or off.
export function AiFeaturesSetting({ onAllow }: Props) {
  const { user } = useSession();
  const consent = useAiConsent();
  const copy = aiConsentCopy(consent.language);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const grantedAt = (user?.aiConsent as { grantedAt?: string } | null)?.grantedAt;
  const date = grantedAt ? new Date(grantedAt).toLocaleDateString(consent.language === 'zh-CN' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  const turnOff = async () => {
    setBusy(true);
    setMessage('');
    try {
      await consent.revoke();
      setMessage(copy.revoked);
    } catch (error: any) {
      setMessage(error?.message || 'Could not turn off AI features. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmTurnOff = () => {
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(copy.turnOffConfirm)) turnOff();
      return;
    }
    Alert.alert(copy.turnOff, copy.turnOffConfirm, [
      { text: copy.decline, style: 'cancel' },
      { text: copy.turnOff, style: 'destructive', onPress: turnOff },
    ]);
  };

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={Type.label}>{copy.settingsTitle}</Text>
      <Text style={[Type.small, styles.center]}>{consent.allowed ? copy.statusOn(date) : copy.statusOff}</Text>
      {consent.allowed ? (
        <Button label={copy.turnOff} variant="secondary" fullWidth loading={busy} onPress={confirmTurnOff} />
      ) : (
        <Button label={copy.allow} variant="secondary" fullWidth onPress={onAllow} />
      )}
      {message ? <Text accessibilityLiveRegion="polite" style={[Type.small, styles.center, styles.message]}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two, marginTop: Spacing.two, paddingTop: Spacing.three, borderTopWidth: 1, borderTopColor: Colors.line },
  center: { textAlign: 'center' },
  message: { fontWeight: '700' },
});
