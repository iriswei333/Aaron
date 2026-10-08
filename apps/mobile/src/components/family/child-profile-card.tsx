import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Shadow, Spacing, Type } from '@/constants/theme';

type ChildProfileCardProps = {
  name: string;
  ageLabel: string;
  storyLanguage: string;
  favorites: string[];
  practicing: string[];
};

// Web .family-child-card: warm gradient panel, rounded orange avatar, Favorites + Practicing now.
export function ChildProfileCard({ name, ageLabel, storyLanguage, favorites, practicing }: ChildProfileCardProps) {
  return (
    <LinearGradient
      colors={[Colors.childCardFrom, Colors.childCardMid, Colors.childCardTo]}
      locations={[0, 0.55, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}>
      <View style={styles.orb} />
      <View style={styles.header}>
        <View style={styles.avatar} accessibilityRole="image" accessibilityLabel={`${name || 'Child'} avatar`}>
          <Text style={styles.avatarText}>{(name || 'K').slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.intro}>
          <Text style={Type.eyebrow}>Your little explorer</Text>
          <Text accessibilityRole="header" style={styles.name}>{name || 'Add your kid'}</Text>
          <Text style={styles.meta}>{`${ageLabel || 'Age not set'} · Stories in ${storyLanguage}`}</Text>
        </View>
      </View>
      <TagGroup label="Favorites" items={favorites} empty="Add a few favorite things to personalize play and stories." />
      <TagGroup label="Practicing now" items={practicing} empty="Add a little step such as brushing teeth or meeting new friends." />
    </LinearGradient>
  );
}

function TagGroup({ label, items, empty }: { label: string; items: string[]; empty: string }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      {items.length ? (
        <View style={styles.chips}>
          {items.map((item) => (
            <View key={item} style={styles.chip}>
              <Text style={styles.chipText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>{empty}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: Spacing.five,
    gap: Spacing.five - 2,
    overflow: 'hidden',
    ...Shadow.card,
  },
  orb: { position: 'absolute', right: -50, top: -70, width: 150, height: 150, borderRadius: 75, backgroundColor: Colors.orb, opacity: 0.18 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.five - 2 },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: Radius.card,
    borderWidth: 5,
    borderColor: '#fff',
    backgroundColor: Colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6f452b',
    shadowOpacity: 0.16,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 9 },
    elevation: 3,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  intro: { flex: 1, gap: 3 },
  name: { color: Colors.ink, fontSize: 23, fontWeight: '800', letterSpacing: -0.3 },
  meta: { color: '#756b62', fontSize: 15 },
  group: { gap: 9 },
  groupLabel: { color: Colors.groupLabel, fontSize: 11, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { backgroundColor: '#fff', borderColor: Colors.chipBorder, borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 7 },
  chipText: { color: Colors.chipInk, fontSize: 12, fontWeight: '700' },
  empty: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
});
