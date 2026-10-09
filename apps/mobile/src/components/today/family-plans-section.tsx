import { todayPlanView } from '@sproutcue/shared/today';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Shadow, Type } from '@/constants/theme';

import { DayOfItCard } from './day-of-it-card';
import { ImageHero } from './image-hero';
import { todayImageSource } from './images';

type Props = { plans: any[]; childName: string; onOpenPlans: () => void; onOpenStory: () => void };

// Web renderTodayPlans (phone layout): section title + "View all", the next plan as a photo card,
// then "Make a little day of it" with the getting-ready story button (all plans: "View all").
export function FamilyPlansSection({ plans, childName, onOpenPlans, onOpenStory }: Props) {
  const featured = todayPlanView(plans[0]);
  return (
    <LinearGradient colors={[Colors.plansFrom, Colors.plansTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.section}>
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Text style={Type.eyebrow}>Something to look forward to</Text>
          <Text accessibilityRole="header" style={styles.title}>Your family’s plans</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onOpenPlans} hitSlop={10} style={styles.viewAll}>
          <Text style={styles.viewAllText}>View all →</Text>
        </Pressable>
      </View>

      <ImageHero
        source={todayImageSource(featured.image, featured.imageKey)}
        shade="up"
        minHeight={360}
        radius={20}
        onPress={onOpenPlans}
        accessibilityLabel={`Open ${featured.title}`}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{featured.icon} Your next plan</Text>
        </View>
        <Text style={styles.featureMeta}>{`${featured.type} · ${featured.when}`}</Text>
        <Text style={styles.featureTitle}>{featured.title}</Text>
        <Text style={styles.featureWhere}>{featured.where}</Text>
        {featured.detail && featured.detail !== featured.where ? <Text style={styles.featureDetail}>{featured.detail}</Text> : null}
        <View style={styles.open}>
          <Text style={styles.openText}>View plan ↗</Text>
        </View>
      </ImageHero>

      <DayOfItCard childName={childName} onOpenStory={onOpenStory} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.line, padding: 18, gap: 14, marginHorizontal: -4, ...Shadow.card },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  titleCopy: { flex: 1 },
  title: { color: Colors.ink, fontSize: 24, fontWeight: '800', letterSpacing: -1, marginTop: 3 },
  viewAll: { minHeight: 32, justifyContent: 'center' },
  viewAllText: { color: Colors.brandStrong, fontSize: 12, fontWeight: '800' },
  badge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.17)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)', borderRadius: Radius.pill, paddingHorizontal: 13, paddingVertical: 9, marginBottom: 13 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase' },
  featureMeta: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 7 },
  featureTitle: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: -1.4, lineHeight: 32, marginBottom: 7 },
  featureWhere: { color: 'rgba(255,255,255,0.9)', fontSize: 15 },
  featureDetail: { color: 'rgba(255,255,255,0.76)', fontSize: 13, marginTop: 7 },
  open: { alignSelf: 'flex-start', backgroundColor: Colors.brand, borderRadius: Radius.control, paddingHorizontal: 16, paddingVertical: 12, marginTop: 19 },
  openText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
