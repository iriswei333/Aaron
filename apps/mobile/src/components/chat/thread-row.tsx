import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { threadEmoji, threadKindLabel, threadPreview, threadTime, type ChatThread } from '@/lib/chat';

/** Topic tile for a thread: a playdate glyph, or the other parent's initial for a direct chat. */
export function ThreadIcon({ thread, index = 0, size = 46 }: { thread: ChatThread; index?: number; size?: number }) {
  if (thread.type !== 'playdate') return <Avatar name={thread.participants?.[0]?.displayName || thread.title || ''} size={size} />;
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.3 }]} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={{ fontSize: size * 0.48 }}>{threadEmoji(thread, index)}</Text>
    </View>
  );
}

// One conversation in the Family tab card and the Chats screen: icon, title + time,
// latest message (bold with a count when unread), and what kind of chat it is.
export function ThreadRow({ thread, index = 0, meId, onPress }: { thread: ChatThread; index?: number; meId?: string; onPress: () => void }) {
  const unread = Number(thread.unreadCount) || 0;
  const preview = threadPreview(thread, meId);
  const time = threadTime(thread.lastMessageAt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${thread.title || 'Chat'}. ${unread ? `${unread} unread. ` : ''}${preview}`}
      accessibilityHint="Opens the conversation"
      onPress={onPress}
      style={({ pressed }) => [styles.row, unread > 0 && styles.rowUnread, pressed && styles.pressed]}>
      <ThreadIcon thread={thread} index={index} />
      <View style={styles.body}>
        <View style={styles.line}>
          <Text style={styles.title} numberOfLines={1}>{thread.title || 'Chat'}</Text>
          {time ? <Text style={[styles.time, unread > 0 && styles.timeUnread]}>{time}</Text> : null}
        </View>
        <View style={styles.line}>
          <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>{preview}</Text>
          {unread > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.kind}>{threadKindLabel(thread)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 11,
    paddingHorizontal: Spacing.three,
    backgroundColor: Colors.rowBg,
    borderWidth: 1,
    borderColor: Colors.rowBorder,
    borderRadius: 16,
  },
  rowUnread: { borderColor: Colors.rowBorderPressed },
  pressed: { backgroundColor: Colors.previewPanel, borderColor: Colors.rowBorderPressed },
  tile: { backgroundColor: Colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  title: { flex: 1, color: Colors.rowTitle, fontSize: 16, fontWeight: '800' },
  time: { color: Colors.rowMeta, fontSize: 12, fontWeight: '600' },
  timeUnread: { color: Colors.brandStrong, fontWeight: '800' },
  preview: { flex: 1, color: Colors.rowMeta, fontSize: 14 },
  previewUnread: { color: Colors.ink, fontWeight: '700' },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: Colors.brandStrong, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  kind: { color: Colors.rowMeta, fontSize: 12, fontWeight: '600' },
});
