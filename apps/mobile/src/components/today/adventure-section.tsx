import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { Colors, Radius, Shadow, Spacing, Type } from '@/constants/theme';

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

      <View style={styles.journey}>
        <Text style={Type.eyebrow}>More than a place to go</Text>
        <Text accessibilityRole="header" style={styles.journeyTitle}>Make a little day of it</Text>
        <View style={styles.steps}>
          {[
            ['Get ready together', `Talk about one thing ${childName} might see or try.`],
            ['Bring one familiar toy', 'Use it to start a simple game while you explore.'],
            ['Keep one small memory', 'Name a favorite moment on the way home.'],
          ].map(([title, text], index) => (
            <View key={title} style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>{title}</Text>
                <Text style={styles.stepText}>{text}</Text>
              </View>
            </View>
          ))}
        </View>
        <Button label="Find a getting-ready story" variant="secondary" fullWidth onPress={onOpenStory} style={styles.storyButton} />
      </View>
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
  journey: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.line, borderRadius: 28, padding: 24, ...Shadow.card },
  journeyTitle: { color: Colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -1.2, lineHeight: 30, marginTop: 7, marginBottom: 25 },
  steps: { gap: 21 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: Colors.brandStrong, fontSize: 13, fontWeight: '900' },
  stepBody: { flex: 1 },
  stepTitle: { color: Colors.ink, fontSize: 15, fontWeight: '800' },
  stepText: { color: Colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  storyButton: { marginTop: 28 },
});
