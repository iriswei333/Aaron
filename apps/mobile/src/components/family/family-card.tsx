import { AVAILABILITY_DAY_OPTIONS } from '@sproutcue/shared/profile-defaults';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Layout, Radius, Spacing } from '@/constants/theme';

type FamilyCardProps = {
  parentName: string;
  childName: string;
  ageMonths: number | null;
  neighborhood: string;
  days: string[];
};

// What another parent sees (web .welcome-family-card): first names and kid ages only.
export function FamilyCard({ parentName, childName, ageMonths, neighborhood, days }: FamilyCardProps) {
  const initial = (name: string) => (name.trim().slice(0, 1) || '?').toUpperCase();
  return (
    <LinearGradient
      colors={[Colors.familyCardFrom, Colors.familyCardTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
      accessibilityLabel={`Family card preview: ${parentName || 'Your name'}, ${childName || 'your kid'}`}>
      <View style={styles.orb} />
      <View style={styles.avatars}>
        <View style={[styles.avatar, { backgroundColor: Colors.familyCardParent }]}>
          <Text style={styles.avatarText}>{initial(parentName)}</Text>
        </View>
        <View style={[styles.avatar, styles.avatarKid]}>
          <Text style={[styles.avatarText, { color: Colors.familyCardKidInk }]}>{initial(childName)}</Text>
        </View>
      </View>
      <Text style={styles.name}>{parentName || 'Your name'}</Text>
      <Text style={styles.meta}>{neighborhood || 'Your neighborhood'} · new this week 🌱</Text>
      <View style={[styles.kid, !childName && styles.kidMuted]}>
        <Text style={styles.kidText}>
          {childName ? `🧒 ${childName}${ageMonths !== null ? ` · ${ageMonths} months` : ''}` : '🧒 Add your kid'}
        </Text>
      </View>
      <View style={styles.days}>
        {AVAILABILITY_DAY_OPTIONS.map(([value, label]) => {
          const on = days.includes(value);
          return (
            <View key={value} style={[styles.day, on && styles.dayOn]}>
              <Text style={[styles.dayText, on && styles.dayTextOn]}>{label}</Text>
            </View>
          );
        })}
      </View>
    </LinearGradient>
  );
}

/** Web .welcome-preview: label, live card, privacy note and illustration under each welcome step. */
export function FamilyCardPreview(props: FamilyCardProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelLabel}>Your family card · live preview</Text>
      <FamilyCard {...props} />
      <Text style={styles.note}>This is exactly what another parent sees. First names and kid ages only — nothing more.</Text>
      <Image source={require('@/assets/images/playdates.jpg')} style={styles.art} contentFit="cover" accessibilityLabel="Families meeting at a neighborhood playground" />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: Spacing.seven,
    marginHorizontal: -Layout.gutter,
    paddingHorizontal: Layout.gutter + 2,
    paddingTop: Spacing.seven - 4,
    paddingBottom: Spacing.seven + 2,
    backgroundColor: Colors.previewPanel,
    borderTopWidth: 1,
    borderTopColor: Colors.inputBorder,
    alignItems: 'center',
  },
  panelLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase', color: Colors.sprout, marginBottom: 14 },
  card: {
    width: '100%',
    maxWidth: 330,
    borderRadius: Radius.card,
    padding: 22,
    overflow: 'hidden',
    shadowColor: '#1f4a36',
    shadowOpacity: 0.25,
    shadowRadius: 17,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  orb: { position: 'absolute', right: -50, top: -55, width: 150, height: 150, borderRadius: 75, backgroundColor: Colors.sprout, opacity: 0.3 },
  avatars: { flexDirection: 'row' },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  avatarKid: { backgroundColor: Colors.familyCardKid, marginLeft: -9 },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  name: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 12, marginBottom: 2 },
  meta: { color: '#fff', fontSize: 12, opacity: 0.85 },
  kid: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  kidMuted: { opacity: 0.75 },
  kidText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  days: { flexDirection: 'row', gap: 5, marginTop: 13 },
  day: { width: 26, height: 26, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: Colors.dayActive, borderColor: Colors.dayActive },
  dayText: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '800' },
  dayTextOn: { color: Colors.dayActiveInk },
  note: { color: Colors.sprout, fontSize: 12, lineHeight: 19, marginTop: 17, maxWidth: 280, textAlign: 'center' },
  art: { width: '100%', maxWidth: 330, height: 132, borderRadius: 14, marginTop: 23, opacity: 0.85 },
});
