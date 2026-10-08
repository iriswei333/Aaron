import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { Colors, Type } from '@/constants/theme';

type Props = { capacity: string; ageRange: string; onCalendar?: () => void; calendarBusy?: boolean };

// Web .shared-playdate-side: illustration, "Less coordination. More play.", two stats, Add to calendar.
export function PlanCard({ capacity, ageRange, onCalendar, calendarBusy }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.art}>
        <Image source={require('@/assets/images/playdates.jpg')} style={styles.image} contentFit="cover" accessibilityLabel="Families meeting at a neighborhood playground" />
      </View>
      <Text style={[Type.eyebrow, styles.eyebrow]}>A simple plan</Text>
      <Text style={styles.title}>Less coordination. More play.</Text>
      <Text style={styles.copy}>SproutCue keeps the time, place, and family connection together so you can show up without a long group chat.</Text>
      <View style={styles.stats}>
        <Stat value={capacity} label="Community momentum" />
        <Stat value={ageRange || 'Family-friendly'} label="Suggested fit" />
      </View>
      {onCalendar ? (
        <Button label="＋ Add to calendar" variant="secondary" fullWidth loading={calendarBusy} onPress={onCalendar} accessibilityHint="Opens the share sheet with a calendar invite" style={styles.calendar} />
      ) : null}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.planBg, borderWidth: 1, borderColor: Colors.planBorder, borderRadius: 24, padding: 18 },
  art: { height: 190, borderRadius: 18, overflow: 'hidden', backgroundColor: Colors.planArt, marginBottom: 22 },
  image: { width: '100%', height: '100%' },
  eyebrow: { color: Colors.inviteKicker },
  title: { color: Colors.planTitle, fontSize: 30, fontWeight: '800', letterSpacing: -1.4, lineHeight: 31, marginTop: 8, marginBottom: 10 },
  copy: { color: Colors.muted, fontSize: 15, lineHeight: 22 },
  stats: { borderTopWidth: 1, borderTopColor: 'rgba(52,111,75,0.16)', marginTop: 22, paddingTop: 16, gap: 14 },
  stat: { gap: 2 },
  statValue: { color: Colors.planStat, fontSize: 17, fontWeight: '800' },
  statLabel: { color: Colors.planStatLabel, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  calendar: { marginTop: 22 },
});
