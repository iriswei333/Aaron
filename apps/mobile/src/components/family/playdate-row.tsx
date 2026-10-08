import { playDateSummary, profilePlayDateTime } from '@sproutcue/shared/family-profile';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { PlayDate } from '@/lib/family-data';

// Web .profile-playdate: green date pin, playground name, role · visibility · families, notes.
// Tapping opens the playdate (share, edit, cancel, calendar).
export function PlaydateRow({ playDate, onPress }: { playDate: PlayDate; onPress?: () => void }) {
  const timing = profilePlayDateTime(playDate);
  const cancelled = playDate.status === 'cancelled';
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityHint={onPress ? 'Opens the playdate' : undefined}
      accessibilityLabel={`${playDate.playgroundName || 'Playdate'}, ${timing.date} ${timing.time}, ${playDateSummary(playDate)}`}
      style={({ pressed }) => [styles.row, cancelled && styles.cancelled, pressed && styles.pressed]}>
      <View style={styles.pin}>
        <Text style={styles.pinDate}>{timing.date}</Text>
        {timing.time ? <Text style={styles.pinTime}>{timing.time}</Text> : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{playDate.playgroundName || 'Playdate'}</Text>
        <Text style={styles.meta}>{playDateSummary(playDate)}</Text>
        {playDate.notes ? <Text style={styles.note} numberOfLines={1}>{playDate.notes}</Text> : null}
      </View>
      {onPress ? <Text style={styles.chevron}>›</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    backgroundColor: Colors.rowBg,
    borderWidth: 1,
    borderColor: Colors.rowBorder,
    borderRadius: 16,
  },
  cancelled: { opacity: 0.68 },
  pressed: { borderColor: Colors.rowBorderPressed },
  chevron: { color: Colors.rowMeta, fontSize: 24, paddingHorizontal: 2 },
  pin: { width: 76, minHeight: 58, borderRadius: 11, backgroundColor: Colors.pinBg, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, paddingHorizontal: 5 },
  pinDate: { color: Colors.pinInk, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  pinTime: { color: Colors.pinInk, fontSize: 11, marginTop: 3, textAlign: 'center' },
  body: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: Colors.rowTitle, fontSize: 16, fontWeight: '800' },
  meta: { color: Colors.rowMeta, fontSize: 12 },
  note: { color: Colors.rowNote, fontSize: 12 },
});
