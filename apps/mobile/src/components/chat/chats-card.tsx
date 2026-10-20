import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button, Card, SectionHeading } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useChat } from '@/lib/chat';
import { useSession } from '@/lib/session';

import { ThreadRow } from './thread-row';

const PREVIEW_COUNT = 3;

// Family tab: the three most recent conversations, with "See all chats" when there are more.
export function ChatsCard() {
  const { user, previewMode } = useSession();
  const chat = useChat();
  const recent = chat.threads.slice(0, PREVIEW_COUNT);
  const openThread = (threadId: string) => router.push({ pathname: '/chat/thread', params: { threadId } });

  return (
    <Card>
      <SectionHeading
        eyebrow="Family conversations"
        title="Chats"
        action={
          chat.unreadTotal > 0 ? (
            <View style={styles.newPill}>
              <Text style={styles.newText}>{chat.unreadTotal} new</Text>
            </View>
          ) : undefined
        }
      />
      {!chat.loaded && chat.loading ? (
        <ActivityIndicator color={Colors.brand} style={styles.loader} />
      ) : recent.length ? (
        <View style={styles.list}>
          {recent.map((thread, index) => (
            <ThreadRow key={thread.id} thread={thread} index={index} meId={user?.id} onPress={() => openThread(thread.id)} />
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No chats yet</Text>
          <Text style={styles.emptyText}>
            {previewMode ? 'Chats need a signed-in family.' : 'Join a playdate and its family thread opens here, so hellos and meetup details stay with the plan.'}
          </Text>
        </View>
      )}
      {chat.error ? <Text accessibilityLiveRegion="polite" style={styles.status}>{chat.error}</Text> : null}
      {chat.threads.length > PREVIEW_COUNT ? (
        <Button label={`See all ${chat.threads.length} chats`} variant="secondary" fullWidth onPress={() => router.push('/chat')} style={styles.more} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  newPill: { height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: Colors.countBg, justifyContent: 'center' },
  newText: { color: Colors.countInk, fontSize: 13, fontWeight: '800' },
  loader: { marginVertical: Spacing.four },
  list: { gap: Spacing.two, marginTop: Spacing.two },
  empty: { marginTop: Spacing.two, padding: Spacing.five, gap: Spacing.one, borderRadius: Radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.brandBorder, backgroundColor: Colors.surfaceSoft, alignItems: 'center' },
  emptyTitle: { color: Colors.ink, fontSize: 16, fontWeight: '800' },
  emptyText: { color: Colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  status: { color: Colors.muted, fontSize: 13, fontWeight: '700' },
  more: { marginTop: Spacing.two },
});
