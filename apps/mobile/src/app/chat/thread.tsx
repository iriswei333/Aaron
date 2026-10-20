import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Composer } from '@/components/chat/composer';
import { MessageBubble } from '@/components/chat/message-bubble';
import { ThreadIcon } from '@/components/chat/thread-row';
import { Button } from '@/components/ui';
import { Colors, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { chatRows, participantName, quickReplies, threadSubtitle, useChatThread, type ChatRow } from '@/lib/chat';
import { useSession } from '@/lib/session';

// One family conversation (web renderChat's thread pane), full screen above the tabs:
// header, playdate strip, messages (newest at the bottom), quick replies and the chat box.
//
// Opened as /chat/thread?threadId=<chat_threads.id>. The thread (title, members, playdate time)
// comes from chat_threads and its messages from chat_messages, both via GET /api/chat?threadId=….
export default function ChatThreadScreen() {
  const { threadId = '' } = useLocalSearchParams<{ threadId: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const chat = useChatThread(String(threadId));
  const thread = chat.thread;
  const isGroup = thread?.type === 'playdate';
  // Inverted list: newest first in data, drawn at the bottom.
  const rows = useMemo(() => chatRows(chat.messages, user?.id).reverse(), [chat.messages, user?.id]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/family'));
  const openPlaydate = () => {
    if (thread?.playDateId) router.push({ pathname: '/playdate/details', params: { playDateId: thread.playDateId } });
  };

  const renderRow = ({ item }: { item: ChatRow }) => {
    if (item.kind === 'day') {
      return (
        <View style={styles.dayWrap}>
          <Text style={styles.day}>{item.label}</Text>
        </View>
      );
    }
    const senderName = participantName(thread, item.message.senderId, user?.id);
    return (
      <MessageBubble
        message={item.message}
        mine={item.mine}
        senderName={senderName}
        showName={isGroup && !item.mine && item.startsGroup}
        endsGroup={item.endsGroup}
        onRetry={() => chat.retry(item.message.id)}
        onDiscard={() => chat.discard(item.message.id)}
      />
    );
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.one }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} hitSlop={6} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        {thread ? <ThreadIcon thread={thread} size={40} /> : null}
        <View style={styles.headerText}>
          <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>{thread?.title || 'Chat'}</Text>
          {thread ? <Text style={styles.subtitle} numberOfLines={1}>{threadSubtitle(thread)}</Text> : null}
        </View>
        {thread?.playDateId ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Playdate details" onPress={openPlaydate} hitSlop={6} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Text style={styles.infoText}>ⓘ</Text>
          </Pressable>
        ) : null}
      </View>

      {isGroup ? (
        <View style={styles.strip}>
          <Text style={styles.stripText}>Everyone who joined this playdate is in this chat.</Text>
          <Pressable accessibilityRole="link" onPress={openPlaydate} hitSlop={8}>
            <Text style={styles.stripLink}>View plan</Text>
          </Pressable>
        </View>
      ) : null}

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={styles.flex}>
          {chat.status === 'loading' && !chat.messages.length ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.brand} />
            </View>
          ) : chat.status === 'error' && !chat.messages.length ? (
            <View style={styles.center}>
              <Text style={[Type.bodyMuted, styles.centerText]}>{`Chat unavailable: ${chat.error}`}</Text>
              <Button label="Try again" variant="secondary" size="sm" onPress={chat.reload} style={styles.centerButton} />
            </View>
          ) : rows.length ? (
            <FlatList
              data={rows}
              inverted
              keyExtractor={(row) => row.key}
              renderItem={renderRow}
              contentContainerStyle={styles.messages}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            />
          ) : (
            <View style={styles.center}>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyGlyph}>💬</Text>
              </View>
              <Text style={styles.emptyTitle}>Say hello</Text>
              <Text style={[Type.bodyMuted, styles.centerText]}>Make the meetup easy: a quick hello, timing, or what you’re bringing.</Text>
            </View>
          )}
        </View>
        <Composer quickReplies={quickReplies(thread)} onSend={chat.send} bottomInset={insets.bottom} />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.paper },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  iconButton: { width: Layout.minTouch, height: Layout.minTouch, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: Colors.brandSoft },
  backText: { color: Colors.brandStrong, fontSize: 34, lineHeight: 36, fontWeight: '500', marginTop: -3 },
  infoText: { color: Colors.muted, fontSize: 22 },
  headerText: { flex: 1, minWidth: 0, gap: 1, paddingLeft: Spacing.one },
  title: { color: Colors.rowTitle, fontSize: 17, fontWeight: '800' },
  subtitle: { color: Colors.rowMeta, fontSize: 13, fontWeight: '600' },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: 9,
    backgroundColor: Colors.updateBg,
    borderBottomWidth: 1,
    borderBottomColor: '#f3dfb4',
  },
  stripText: { flex: 1, color: Colors.updateInk, fontSize: 13, fontWeight: '600' },
  stripLink: { color: Colors.updateTitle, fontSize: 13, fontWeight: '800' },
  messages: { paddingHorizontal: 14, paddingTop: Spacing.three, paddingBottom: Spacing.two },
  dayWrap: { alignItems: 'center', marginVertical: Spacing.two },
  day: { color: Colors.rowMeta, fontSize: 12, fontWeight: '700', backgroundColor: Colors.viewSwitchBg, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Radius.pill, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.six },
  centerText: { textAlign: 'center' },
  centerButton: { alignSelf: 'center' },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: Colors.countBg, alignItems: 'center', justifyContent: 'center' },
  emptyGlyph: { fontSize: 26 },
  emptyTitle: { color: Colors.ink, fontSize: 18, fontWeight: '800' },
});
