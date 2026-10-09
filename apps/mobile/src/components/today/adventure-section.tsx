import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { Radius } from '@/constants/theme';

import { DayOfItCard } from './day-of-it-card';
import { ImageHero } from './image-hero';
import { TODAY_IMAGES } from './images';

type Recommendation = { title: string; description: string; detail: string; imageKey: string };

// Web todayAdventureMarkup (phone layout): the recommended adventure as a photo card,
// then "Make a little day of it" with three small steps and the getting-ready story button.
export function AdventureSection({ recommendation, childName, onExplore, onOpenStory }: { recommendation: Recommendation; childName: string; onExplore: () => void; onOpenStory: () => void }) {
  return (
    <View style={styles.stack}>
      <ImageHero source={recommendation.imageKey === 'home' ? TODAY_IMAGES.home : TODAY_IMAGES.playground} shade="left" minHeight={430} radius={28} style={styles.hero}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Your next little adventure</Text>
        </View>
        <Text accessibilityRole="header" style={styles.title}>{recommendation.title}</Text>
        <Text style={styles.description}>{recommendation.description}</Text>
        <Text style={styles.detail}>{recommendation.detail}</Text>
        <Button label="Explore this adventure ↗" onPress={onExplore} style={styles.explore} />
      </ImageHero>

      <DayOfItCard childName={childName} onOpenStory={onOpenStory} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 18 },
  hero: { shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 18 } },
  badge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  title: { color: '#fff', fontSize: 35, fontWeight: '800', letterSpacing: -1.6, lineHeight: 35, marginTop: 18, marginBottom: 13 },
  description: { color: 'rgba(255,255,255,0.92)', fontSize: 16, lineHeight: 25, marginBottom: 7 },
  detail: { color: 'rgba(255,255,255,0.72)', fontSize: 13 },
  explore: { marginTop: 24 },
});
