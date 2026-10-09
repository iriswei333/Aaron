import { aiJobIsDone, aiJobRemainingSeconds, aiJobTimeLabel, STUDIO_FEATURES } from '@sproutcue/shared/studio';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BookChooserSheet } from '@/components/studio/book-chooser-sheet';
import { Button, Screen, Sheet } from '@/components/ui';
import { Colors, Radius, Shadow, Type } from '@/constants/theme';
import { useAiJobs } from '@/lib/ai-jobs';
import { usePictureBooks } from '@/lib/studio-data';

const FEATURE_TINT: Record<string, string> = { book: '#f7e8d8', toy: '#eaf1da', story: '#eceaf7', voice: '#e3f0ef' };

// Mirrors the web Play Studio landing (apps/web/src/tabs/studio.js studioLanding):
// four creation cards → recent creations → privacy note (no hero header on mobile).
export default function StudioScreen() {
  const ai = useAiJobs();
  const books = usePictureBooks();
  const [chooserOpen, setChooserOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const running = ai.job && !aiJobIsDone(ai.job.status) ? ai.job : null;

  useFocusEffect(
    useCallback(() => {
      ai.refreshNotifications();
    }, [ai.refreshNotifications]),
  );

  const open = (id: string) => {
    if (id === 'book') setChooserOpen(true);
    else if (id === 'toy') router.push('/create/toy');
    else if (id === 'story') router.push('/create/story');
    else setVoiceOpen(true);
  };

  return (
    <Screen refreshing={books.refreshing} onRefresh={() => { books.refresh(); ai.refreshNotifications(); }}>
      {running ? (
        <Pressable accessibilityRole="button" accessibilityHint="Shows the progress of your creation" onPress={ai.showSheet} style={({ pressed }) => [styles.running, pressed && styles.pressed]}>
          <View style={styles.runningDot} />
          <View style={styles.flex}>
            <Text style={styles.runningTitle}>AI is creating…</Text>
            <Text style={styles.runningMeta}>About {aiJobTimeLabel(aiJobRemainingSeconds(running))} left · tap to see progress</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ) : null}

      <View style={styles.section}>
        <Text style={Type.eyebrow}>Four ways to make something together</Text>
        <Text style={styles.sectionTitle}>What shall we create?</Text>
        <View style={styles.grid}>
          {STUDIO_FEATURES.map((feature) => (
            <Pressable
              key={feature.id}
              accessibilityRole="button"
              accessibilityLabel={`${feature.title}. ${feature.copy}`}
              onPress={() => open(feature.id)}
              style={({ pressed }) => [styles.feature, { backgroundColor: FEATURE_TINT[feature.id] }, pressed && styles.featurePressed]}>
              <Text style={styles.featureIcon}>{feature.icon}</Text>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureCopy}>{feature.copy}</Text>
              <Text style={styles.featureOpen}>{feature.id === 'voice' ? 'Coming soon' : 'Open →'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {ai.notifications.length ? (
        <View style={styles.card}>
          <View style={styles.cardHeading}>
            <View style={styles.flex}>
              <Text style={Type.eyebrow}>AI creations</Text>
              <Text style={styles.cardTitle}>Recently made</Text>
            </View>
            {ai.unreadCount ? <Text style={styles.unread}>{ai.unreadCount} new</Text> : null}
          </View>
          {ai.notifications.slice(0, 5).map((item) => {
            const failed = item.type === 'ai_asset_failed';
            return (
              <Pressable key={item.id} accessibilityRole="button" onPress={() => ai.openNotification(item)} style={({ pressed }) => [styles.note, pressed && styles.pressed]}>
                <View style={[styles.noteIcon, failed && styles.noteIconFailed]}>
                  <Text style={[styles.noteIconText, failed && styles.noteIconTextFailed]}>{failed ? '!' : '✓'}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.noteTitle} numberOfLines={1}>{item.title}</Text>
                  {item.message ? <Text style={styles.noteText} numberOfLines={2}>{item.message}</Text> : null}
                </View>
                {!item.readAt ? <View style={styles.unreadDot} accessibilityLabel="New" /> : null}
              </Pressable>
            );
          })}
          <Button label="See everything in Family →" variant="ghost" size="sm" onPress={() => router.push('/family')} />
        </View>
      ) : null}

      <View style={styles.trust}>
        <View style={styles.trustIcon}>
          <Text style={styles.trustIconText}>♡</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.trustTitle}>Your ideas. A little AI help.</Text>
          <Text style={styles.trustText}>You choose what to make and review it before sharing. Family photos and creations stay private to your account.</Text>
        </View>
      </View>

      <BookChooserSheet
        visible={chooserOpen}
        templates={books.templates}
        loading={books.loading}
        bookCount={books.books.length}
        onUse={(slug) => {
          setChooserOpen(false);
          router.push({ pathname: '/create/books/new', params: { template: slug } });
        }}
        onViewBooks={() => {
          setChooserOpen(false);
          router.push('/create/books');
        }}
        onClose={() => setChooserOpen(false)}
      />
      <Sheet visible={voiceOpen} onClose={() => setVoiceOpen(false)} footer={<Button label="Got it" fullWidth onPress={() => setVoiceOpen(false)} />}>
        <Text style={styles.noticeIcon}>✦</Text>
        <Text style={Type.eyebrow}>Play Studio preview</Text>
        <Text style={styles.sectionTitle}>Read in your voice</Text>
        <Text style={Type.bodyMuted}>This feature will pair reviewed stories with a private family recording.</Text>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.75 },
  running: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#edf3e5', borderWidth: 1, borderColor: '#d6e3c8', borderRadius: 18, padding: 14 },
  runningDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.sun },
  runningTitle: { color: Colors.greenInk, fontSize: 15, fontWeight: '800' },
  runningMeta: { color: Colors.muted, fontSize: 13 },
  chevron: { color: Colors.muted, fontSize: 24 },
  section: { gap: 4 },
  sectionTitle: { color: Colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -1.2, marginTop: 4, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  feature: { flexGrow: 1, flexBasis: '45%', minHeight: 200, borderRadius: 24, padding: 18, gap: 8 },
  featurePressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  featureIcon: { fontSize: 30, color: Colors.ink },
  featureTitle: { color: Colors.ink, fontSize: 17, fontWeight: '800', lineHeight: 21 },
  featureCopy: { color: '#52645b', fontSize: 13, lineHeight: 19 },
  featureOpen: { color: Colors.brandStrong, fontSize: 13, fontWeight: '800', marginTop: 'auto' },
  card: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.line, borderRadius: 22, padding: 18, gap: 10, ...Shadow.card },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { color: Colors.ink, fontSize: 20, fontWeight: '800', marginTop: 4 },
  unread: { backgroundColor: Colors.brandSoft, color: Colors.brandStrong, fontSize: 12, fontWeight: '800', borderRadius: Radius.pill, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, paddingVertical: 8 },
  noteIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e7f4e8', alignItems: 'center', justifyContent: 'center' },
  noteIconFailed: { backgroundColor: '#fff0e8' },
  noteIconText: { color: '#39724d', fontSize: 16, fontWeight: '800' },
  noteIconTextFailed: { color: '#b9512f' },
  noteTitle: { color: Colors.ink, fontSize: 15, fontWeight: '800' },
  noteText: { color: Colors.muted, fontSize: 13, lineHeight: 18 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.brand },
  trust: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.line, borderRadius: 22, padding: 18 },
  trustIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  trustIconText: { color: Colors.brandStrong, fontSize: 22 },
  trustTitle: { color: Colors.ink, fontSize: 16, fontWeight: '800', marginBottom: 3 },
  trustText: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
  noticeIcon: { fontSize: 34, color: Colors.brandStrong },
});
