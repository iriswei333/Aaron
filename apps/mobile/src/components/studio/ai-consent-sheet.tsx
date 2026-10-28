import { aiConsentCopy } from '@sproutcue/shared/ai-consent';
import { privacyUrl } from '@sproutcue/shared/terms';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Sheet } from '@/components/ui';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { config } from '@/lib/config';

type Props = {
  visible: boolean;
  language: 'en' | 'zh-CN';
  saving: boolean;
  error: string;
  onAllow: () => void;
  onDecline: () => void;
};

// Asked before the first AI creation (and again if the text changes or consent was turned off).
// Same text as the web dialog: @sproutcue/shared/ai-consent.
export function AiConsentSheet({ visible, language, saving, error, onAllow, onDecline }: Props) {
  const copy = aiConsentCopy(language);
  const policy = privacyUrl(config.apiBaseUrl);
  return (
    <Sheet
      visible={visible}
      onClose={onDecline}
      closeLabel={copy.decline}
      footer={
        <>
          <Button label={copy.allow} fullWidth loading={saving} onPress={onAllow} />
          <Button label={copy.decline} variant="ghost" fullWidth disabled={saving} onPress={onDecline} />
        </>
      }
    >
      <View style={styles.head}>
        <View style={styles.badge}>
          <Text style={styles.badgeGlyph} accessibilityElementsHidden importantForAccessibility="no">✦</Text>
        </View>
        <Text style={Type.eyebrow}>{copy.eyebrow}</Text>
        <Text accessibilityRole="header" style={Type.title}>{copy.title}</Text>
      </View>
      <Text style={Type.body}>{copy.intro}</Text>
      <View style={styles.card}>
        {copy.sends.map((line) => (
          <View key={line} style={styles.row}>
            <Text style={styles.bullet} accessibilityElementsHidden importantForAccessibility="no">•</Text>
            <Text style={[Type.body, styles.flex]}>{line}</Text>
          </View>
        ))}
      </View>
      <Text style={[Type.body, styles.strong]}>{copy.neverSends}</Text>
      <Text style={Type.bodyMuted}>{copy.provider}</Text>
      <Text style={Type.bodyMuted}>{copy.control}</Text>
      {policy ? <Link href={policy as any} style={styles.link}>{copy.privacyLink}</Link> : null}
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { gap: Spacing.two },
  badge: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
  badgeGlyph: { color: Colors.brandStrong, fontSize: 22, fontWeight: '800' },
  card: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.card, padding: Spacing.four, gap: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.two },
  bullet: { color: Colors.brandStrong, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  flex: { flex: 1 },
  strong: { fontWeight: '800' },
  link: { color: Colors.brandStrong, fontSize: 15, fontWeight: '800', paddingVertical: Spacing.two },
  error: { ...Type.small, color: Colors.danger, fontWeight: '700' },
});
