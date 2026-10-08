import { todayPlanView } from '@sproutcue/shared/today';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { Colors, Radius, Shadow, Spacing, Type } from '@/constants/theme';

import { ImageHero } from './image-hero';
import { todayImageSource } from './images';

type Props = { plans: any[]; onOpenPlans: () => void };

// Web renderTodayPlans (phone layout): section title + "View all", the next plan as a photo card,
// then "Coming up next" with up to three more plans (or a friendly empty state).
export function FamilyPlansSection({ plans, onOpenPlans }: Props) {
  const featured = todayPlanView(plans[0]);
  const remaining = plans.slice(1, 4).map(todayPlanView);
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

      <View style={styles.sidebar}>
        <Text style={Type.eyebrow}>Coming up next</Text>
        <Text style={styles.sidebarTitle}>More family plans</Text>
        {remaining.length ? (
          <View style={styles.list}>
            {remaining.map((view, index) => (
              <Pressable
                key={`${view.title}-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`${view.title}. ${view.type}, ${view.when}. ${view.where}`}
                onPress={onOpenPlans}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                <Text style={styles.rowIcon}>{view.icon}</Text>
                <View style={styles.rowBody}>
                  <Text style={styles.rowMeta} numberOfLines={1}>{`${view.type} · ${view.when}`}</Text>
                  <Text style={styles.rowTitle} numberOfLines={1}>{view.title}</Text>
                  <Text style={styles.rowWhere} numberOfLines={1}>{view.where}</Text>
                </View>
                <Text style={styles.rowArrow}>→</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>＋</Text>
            <Text style={styles.emptyTitle}>Room for another little adventure</Text>
            <Text style={styles.emptyText}>Find a playdate, family event, or story time to add here.</Text>
          </View>
        )}
        <Button label="Explore more plans" variant="secondary" fullWidth onPress={onOpenPlans} style={styles.explore} />
      </View>
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
  sidebar: { backgroundColor: 'rgba(255,255,255,0.78)', borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.card, padding: 20 },
  sidebarTitle: { color: Colors.ink, fontSize: 23, fontWeight: '800', letterSpacing: -0.8, marginTop: 5, marginBottom: 17 },
  list: { gap: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 82, padding: 13, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.control },
  rowPressed: { backgroundColor: Colors.intentActiveBg },
  rowIcon: { fontSize: 18 },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  rowMeta: { color: Colors.brandStrong, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  rowTitle: { color: Colors.ink, fontSize: 15, fontWeight: '800' },
  rowWhere: { color: Colors.muted, fontSize: 11 },
  rowArrow: { color: Colors.brandStrong, fontSize: 16, fontWeight: '800' },
  empty: { minHeight: 190, alignItems: 'center', justifyContent: 'center', gap: 7, padding: 20 },
  emptyIcon: { color: Colors.brand, fontSize: 27 },
  emptyTitle: { color: Colors.ink, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: Colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  explore: { marginTop: Spacing.four },
});
