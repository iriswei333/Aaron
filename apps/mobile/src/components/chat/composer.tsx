import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, Layout, Radius, Shadow, Spacing } from '@/constants/theme';
import { CHAT_COUNTER_FROM, CHAT_MESSAGE_MAX, type ChatPhoto } from '@/lib/chat';
import { ChatPhotoTooLargeError, pickChatPhoto } from '@/lib/chat-photo';
import { haptics } from '@/lib/haptics';
import { PhotoPermissionError } from '@/lib/photo-upload';

type ComposerProps = {
  quickReplies: string[];
  onSend: (text: string, photo: ChatPhoto | null) => void;
  /** Bottom safe-area inset, so the bar clears the home indicator. */
  bottomInset: number;
};

const LINE = 22;
const MAX_LINES = 5;

// The chat box: quick replies (while the box is empty), an attached-photo tray,
// ＋ for a photo, a growing text field and the send button.
export function Composer({ quickReplies, onSend, bottomInset }: ComposerProps) {
  const [draft, setDraft] = useState('');
  const [photo, setPhoto] = useState<ChatPhoto | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [notice, setNotice] = useState('');
  const [keyboardUp, setKeyboardUp] = useState(false);
  const canSend = (draft.trim().length > 0 || Boolean(photo)) && !preparing;

  // The home-indicator inset only matters while the keyboard is down.
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const attach = async (source: 'camera' | 'library') => {
    setNotice('');
    setPreparing(true);
    try {
      const picked = await pickChatPhoto(source);
      if (picked) setPhoto(picked);
    } catch (error) {
      haptics.error();
      setNotice(
        error instanceof PhotoPermissionError || error instanceof ChatPhotoTooLargeError
          ? error.message
          : 'Could not add that photo. Please try another one.',
      );
    } finally {
      setPreparing(false);
    }
  };

  const chooseSource = () => {
    haptics.select();
    if (Platform.OS === 'web') return void attach('library');
    const footnote = 'Only families in this chat can see it.';
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Take a photo', 'Choose a photo', 'Cancel'], cancelButtonIndex: 2, message: footnote },
        (index) => {
          if (index === 0) attach('camera');
          if (index === 1) attach('library');
        },
      );
      return;
    }
    Alert.alert('Add a photo', footnote, [
      { text: 'Take a photo', onPress: () => attach('camera') },
      { text: 'Choose a photo', onPress: () => attach('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const send = () => {
    if (!canSend) return;
    haptics.tap();
    onSend(draft, photo);
    setDraft('');
    setPhoto(null);
    setNotice('');
  };

  const showReplies = !draft && !photo && quickReplies.length > 0;
  const showCounter = draft.length >= CHAT_COUNTER_FROM;

  return (
    <View style={styles.wrap}>
      {showReplies ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.replies} accessibilityLabel="Quick replies">
          {quickReplies.map((reply) => (
            <Pressable
              key={reply}
              accessibilityRole="button"
              accessibilityHint="Puts this in the message box"
              onPress={() => {
                haptics.select();
                setDraft(reply);
              }}
              style={({ pressed }) => [styles.reply, pressed && styles.replyPressed]}>
              <Text style={styles.replyText}>{reply}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={[styles.bar, { paddingBottom: (keyboardUp ? Spacing.two : Math.max(bottomInset, Spacing.two)) + Spacing.one }]}>
        {photo ? (
          <View style={styles.tray}>
            <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" accessibilityLabel="Photo to send" />
            <View style={styles.trayBody}>
              <Text style={styles.trayTitle}>Photo ready to send</Text>
              <Text style={styles.trayMeta}>Add a note if you like</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Remove photo" onPress={() => setPhoto(null)} hitSlop={6} style={styles.trayRemove}>
              <Text style={styles.trayRemoveText}>×</Text>
            </Pressable>
          </View>
        ) : null}
        {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}

        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a photo"
            accessibilityState={{ busy: preparing, disabled: preparing }}
            disabled={preparing}
            onPress={chooseSource}
            style={({ pressed }) => [styles.attach, pressed && styles.attachPressed]}>
            {preparing ? <ActivityIndicator color={Colors.brandStrong} /> : <Text style={styles.attachText}>＋</Text>}
          </Pressable>
          <View style={styles.field}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={photo ? 'Add a note…' : 'Message or meetup note…'}
              placeholderTextColor={Colors.faint}
              multiline
              maxLength={CHAT_MESSAGE_MAX}
              accessibilityLabel="Message"
              style={styles.input}
              textAlignVertical="center"
            />
            {showCounter ? <Text style={styles.counter}>{draft.length.toLocaleString()} / {CHAT_MESSAGE_MAX.toLocaleString()}</Text> : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={send}
            style={({ pressed }) => [styles.send, canSend ? styles.sendOn : styles.sendOff, pressed && canSend && styles.sendPressed]}>
            <Text style={[styles.sendText, !canSend && styles.sendTextOff]}>↑</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: Colors.paper },
  replies: { gap: Spacing.two, paddingHorizontal: 14, paddingVertical: Spacing.two },
  reply: { minHeight: 36, paddingHorizontal: 14, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.chipBorder, backgroundColor: Colors.surface, justifyContent: 'center' },
  replyPressed: { backgroundColor: Colors.brandSoft },
  replyText: { color: Colors.chipInk, fontSize: 14, fontWeight: '700' },
  bar: { backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: Spacing.two, paddingHorizontal: Spacing.three, gap: Spacing.two },
  tray: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: Spacing.two, backgroundColor: Colors.surfaceSoft, borderWidth: 1, borderColor: Colors.rowBorder, borderRadius: Radius.control },
  thumb: { width: 54, height: 54, borderRadius: 10, backgroundColor: Colors.mapBg },
  trayBody: { flex: 1, gap: 2 },
  trayTitle: { color: Colors.ink, fontSize: 14, fontWeight: '800' },
  trayMeta: { color: Colors.rowMeta, fontSize: 12, fontWeight: '600' },
  trayRemove: { width: Layout.minTouch, height: Layout.minTouch, alignItems: 'center', justifyContent: 'center' },
  trayRemoveText: { color: Colors.muted, fontSize: 24, lineHeight: 26 },
  notice: { color: Colors.danger, fontSize: 13, fontWeight: '700', paddingHorizontal: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  attach: { width: Layout.minTouch, height: Layout.minTouch, borderRadius: 22, borderWidth: 1, borderColor: Colors.brandBorder, backgroundColor: Colors.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  attachPressed: { backgroundColor: Colors.brandSoft },
  attachText: { color: Colors.brandStrong, fontSize: 22, fontWeight: '700', lineHeight: 24 },
  field: { flex: 1, minWidth: 0, gap: 2 },
  input: {
    minHeight: Layout.minTouch,
    maxHeight: LINE * MAX_LINES + 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.paper,
    paddingHorizontal: Spacing.four,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 16,
    lineHeight: LINE,
    color: Colors.ink,
  },
  counter: { alignSelf: 'flex-end', color: Colors.rowMeta, fontSize: 11, fontWeight: '700', paddingRight: Spacing.two },
  send: { width: Layout.minTouch, height: Layout.minTouch, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sendOn: { backgroundColor: Colors.brandStrong, ...Shadow.button },
  sendOff: { backgroundColor: Colors.viewSwitchBg },
  sendPressed: { backgroundColor: Colors.brandDeep },
  sendText: { color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 24 },
  sendTextOff: { color: Colors.faint },
});
