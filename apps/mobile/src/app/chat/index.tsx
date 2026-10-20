import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ThreadRow } from '@/components/chat/thread-row';
import { BackLink } from '@/components/studio/back-link';
import { Screen } from '@/components/ui';
import { Colors, Spacing, Type } from '@/constants/theme';
import { useChat } from '@/lib/chat';
import { useSession } from '@/lib/session';

// Every family conversation, newest first (opened from "See all chats" on the Family tab).
export default function ChatsScreen() {
  const { user } = useSession();
  const chat = useChat();
  return (
    <Screen
      header={<BackLink label="Back to Family" fallback="/family" />}
      eyebrow="Family conversations"
      title="Chats"
      refreshing={chat.loading && chat.loaded}
      onRefresh={chat.refresh}>
      {!chat.loaded && chat.loading ? (
        <ActivityIndicator color={Colors.brand} style={styles.loader} />
      ) : chat.threads.length ? (
        <View style={styles.list}>
          {chat.threads.map((thread, index) => (
            <ThreadRow key={thread.id} thread={thread} index={index} meId={user?.id} onPress={() => router.push({ pathname: '/chat/thread', params: { threadId: thread.id } })} />
          ))}
        </View>
      ) : (
        <Text style={Type.bodyMuted}>Join a playdate to open its family thread, or start a direct chat from a connected family.</Text>
      )}
      {chat.error ? <Text accessibilityLiveRegion="polite" style={styles.status}>{chat.error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: Spacing.six },
  list: { gap: Spacing.two },
  status: { color: Colors.muted, fontSize: 13, fontWeight: '700' },
});
