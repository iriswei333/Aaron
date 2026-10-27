import { CHAT_REPORT_DETAILS_MAX, CHAT_REPORT_REASONS, normalizeChatReport } from '@sproutcue/shared/chat-report';
import { blockActionLabel } from '@sproutcue/shared/user-blocks';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Sheet, TextField } from '@/components/ui';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { reportChatMessage, type ChatMessage } from '@/lib/chat';
import { haptics } from '@/lib/haptics';

type Props = {
  /** The message being reported; null keeps the sheet closed. */
  message: ChatMessage | null;
  senderName: string;
  onClose: () => void;
  /** Called once the server has the report (also when it was already reported). */
  onReported: (messageId: string) => void;
  /** Offered on the thank-you step ("Also block Priya"); leave out when already blocked. */
  onBlock?: () => void;
};

type ReasonOption = { id: string; label: string };
const REASONS = CHAT_REPORT_REASONS as ReasonOption[];

function preview(message: ChatMessage) {
  const text = message.text?.trim();
  if (text) return text.length > 160 ? `${text.slice(0, 160)}…` : text;
  return message.mediaType === 'video' ? 'Shared a video' : 'Shared a photo';
}

// Chat safety (Apple 1.2 / Play UGC): long-press a message → Report → this sheet.
// Same reasons and endpoint as the web chat (POST /api/chat/report).
// Render with key={message?.id} so each message gets a fresh form.
export function ReportMessageSheet({ message, senderName, onClose, onReported, onBlock }: Props) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<null | { alreadyReported: boolean }>(null);

  if (!message) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;

  const submit = async () => {
    const checked = normalizeChatReport({ messageId: message.id, reason, details });
    if (checked.error) {
      setError(checked.error);
      haptics.error();
      return;
    }
    setSending(true);
    setError('');
    try {
      const result = await reportChatMessage(message.id, checked.reason || reason, checked.details || '');
      setDone({ alreadyReported: result.alreadyReported });
      onReported(message.id);
      haptics.success();
    } catch (err) {
      setError(`Couldn’t send the report: ${err instanceof Error ? err.message : 'please try again.'}`);
      haptics.error();
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <Sheet
        visible
        onClose={onClose}
        closeLabel="Close"
        footer={
          <>
            {onBlock ? <Button label={blockActionLabel(senderName).replace('Block', 'Also block')} variant="secondary" onPress={onBlock} fullWidth /> : null}
            <Button label="Done" onPress={onClose} fullWidth />
          </>
        }
      >
        <View style={styles.done}>
          <View style={styles.doneIcon}>
            <Text style={styles.doneGlyph}>✓</Text>
          </View>
          <Text accessibilityRole="header" style={[Type.title, styles.center]}>Thanks for letting us know</Text>
          <Text style={[Type.bodyMuted, styles.center]}>
            {done.alreadyReported
              ? 'You already reported this message. Our team has it.'
              : 'Our team will review this message. The family won’t know who reported it.'}
          </Text>
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet
      visible
      onClose={onClose}
      closeLabel="Cancel report"
      footer={
        <>
          <Button label={sending ? 'Sending…' : 'Send report'} variant="danger" onPress={submit} loading={sending} disabled={sending} haptic={false} fullWidth />
          <Button label="Cancel" variant="ghost" onPress={onClose} disabled={sending} fullWidth />
        </>
      }
    >
      <Text style={Type.eyebrow}>Chat safety</Text>
      <Text accessibilityRole="header" style={Type.title}>Report message</Text>

      <View style={styles.quote}>
        <Text style={styles.quoteName}>{senderName}</Text>
        <Text style={styles.quoteText}>{preview(message)}</Text>
      </View>

      <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="What’s wrong with this message?">
        <Text style={Type.label}>What’s wrong with this message?</Text>
        {REASONS.map((option) => {
          const selected = reason === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => {
                haptics.select();
                setReason(option.id);
                setError('');
              }}
              style={({ pressed }) => [styles.reason, selected && styles.reasonSelected, pressed && styles.reasonPressed]}
            >
              <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
              <Text style={styles.reasonText}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextField
        label={reason === 'other' ? 'Tell us what’s wrong' : 'Anything else we should know? (optional)'}
        value={details}
        onChangeText={setDetails}
        maxLength={CHAT_REPORT_DETAILS_MAX}
        multiline
        textAlignVertical="top"
        style={styles.details}
        placeholder="Add details for our team"
      />

      <Text style={Type.small}>Reports are private. If anyone is in immediate danger, call 911 or your local emergency number.</Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  quote: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.rowBorder,
    borderLeftWidth: 4,
    borderLeftColor: Colors.brandBorder,
    borderRadius: Radius.control,
    padding: Spacing.three,
    gap: 2,
  },
  quoteName: { color: Colors.muted, fontSize: 12, fontWeight: '800' },
  quoteText: { color: Colors.ink, fontSize: 15, lineHeight: 21 },
  group: { gap: Spacing.two },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: Colors.rowBorder,
    backgroundColor: Colors.surface,
  },
  reasonSelected: { borderColor: Colors.brand, backgroundColor: Colors.brandSoft },
  reasonPressed: { borderColor: Colors.rowBorderPressed },
  reasonText: { flex: 1, color: Colors.ink, fontSize: 16, fontWeight: '600' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.brandBorder, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: Colors.brandStrong },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.brandStrong },
  details: { minHeight: 88, paddingTop: Spacing.three },
  error: { color: Colors.danger, fontSize: 14, fontWeight: '700' },
  done: { alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.six },
  doneIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  doneGlyph: { color: Colors.success, fontSize: 30, fontWeight: '800' },
});
