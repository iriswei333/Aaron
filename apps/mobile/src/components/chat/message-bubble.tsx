import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { messageTime, type ChatMessage } from '@/lib/chat';

type MessageBubbleProps = {
  message: ChatMessage;
  mine: boolean;
  senderName: string;
  /** Group chats show who's talking at the start of each run of messages. */
  showName: boolean;
  /** Avatar and time go on the last message of a run. */
  endsGroup: boolean;
  onRetry?: () => void;
  onDiscard?: () => void;
};

const AVATAR = 30;

// Mine: clay bubble on the right. Theirs: white bubble with the sender's initial on the left.
export function MessageBubble({ message, mine, senderName, showName, endsGroup, onRetry, onDiscard }: MessageBubbleProps) {
  const failed = message.localState === 'failed';
  const sending = message.localState === 'sending';
  const photo = message.mediaType === 'photo' && message.mediaUrl ? message.mediaUrl : '';
  const video = message.mediaType === 'video';
  const time = messageTime(message.createdAt);

  const media = photo ? (
    <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" accessibilityLabel={`Photo from ${mine ? 'you' : senderName}`} />
  ) : video ? (
    <View style={[styles.video, mine && styles.videoMine]}>
      <Text style={[styles.videoText, mine && styles.textMine]}>▶ Video shared — open SproutCue on the web to watch it.</Text>
    </View>
  ) : null;

  if (mine) {
    return (
      <View style={[styles.mineWrap, endsGroup ? styles.groupEnd : styles.groupContinue]}>
        <View style={[styles.bubble, styles.bubbleMine, failed && styles.bubbleFailed, sending && styles.sending, endsGroup && styles.tailMine]}>
          {media}
          {message.text ? <Text style={[styles.text, failed ? styles.textFailed : styles.textMine]}>{message.text}</Text> : null}
        </View>
        {failed ? (
          <View style={styles.failedRow}>
            <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={8} style={styles.metaButton}>
              <Text style={styles.failedText}>Not sent · Tap to retry</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onDiscard} hitSlop={8} style={styles.metaButton}>
              <Text style={styles.discardText}>Delete</Text>
            </Pressable>
          </View>
        ) : sending ? (
          <Text style={styles.meta}>Sending…</Text>
        ) : endsGroup && time ? (
          <Text style={styles.meta}>{time}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.theirsWrap, endsGroup ? styles.groupEnd : styles.groupContinue]}>
      <View style={styles.avatarSlot}>{endsGroup ? <Avatar name={senderName} size={AVATAR} /> : null}</View>
      <View style={styles.theirsColumn}>
        {showName ? <Text style={styles.name}>{senderName}</Text> : null}
        <View style={[styles.bubble, styles.bubbleTheirs, endsGroup && styles.tailTheirs]}>
          {media}
          {message.text ? <Text style={styles.text}>{message.text}</Text> : null}
        </View>
        {endsGroup && time ? <Text style={[styles.meta, styles.metaTheirs]}>{time}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  groupEnd: { marginBottom: Spacing.three },
  groupContinue: { marginBottom: 3 },
  mineWrap: { alignItems: 'flex-end', gap: 3 },
  theirsWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  avatarSlot: { width: AVATAR, marginBottom: 20 },
  theirsColumn: { flexShrink: 1, maxWidth: '80%', gap: 3 },
  name: { color: Colors.muted, fontSize: 12, fontWeight: '800', paddingLeft: Spacing.three },
  bubble: { borderRadius: 18, overflow: 'hidden', maxWidth: '80%' },
  bubbleMine: { backgroundColor: Colors.brandStrong },
  bubbleTheirs: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.line, maxWidth: '100%' },
  bubbleFailed: { backgroundColor: Colors.surface, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.dangerWeb },
  sending: { opacity: 0.6 },
  tailMine: { borderBottomRightRadius: 6 },
  tailTheirs: { borderBottomLeftRadius: 6 },
  text: { color: Colors.ink, fontSize: 16, lineHeight: 22, paddingHorizontal: 13, paddingVertical: 9 },
  textMine: { color: '#fff' },
  textFailed: { color: Colors.ink },
  photo: { width: 240, height: 180, backgroundColor: Colors.mapBg },
  video: { width: 240, padding: Spacing.three, backgroundColor: Colors.mapBg },
  videoMine: { backgroundColor: Colors.brandDeep },
  videoText: { color: Colors.greenInk, fontSize: 13, fontWeight: '700' },
  meta: { color: Colors.rowMeta, fontSize: 11, fontWeight: '600', paddingHorizontal: 6 },
  metaTheirs: { paddingLeft: Spacing.three },
  failedRow: { flexDirection: 'row', gap: Spacing.three },
  metaButton: { minHeight: 32, justifyContent: 'center' },
  failedText: { color: Colors.danger, fontSize: 13, fontWeight: '800' },
  discardText: { color: Colors.muted, fontSize: 13, fontWeight: '700' },
});
