import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { Colors, Shadow, Type } from '@/constants/theme';

// Web .today-journey-card: "Make a little day of it" — three small steps and the
// getting-ready story button (opens StoryMakerSheet → POST /family-assets/practice-stories/playground).
// Shown under the next adventure, or under the next family plan.
export function DayOfItCard({ childName, onOpenStory }: { childName: string; onOpenStory: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={Type.eyebrow}>More than a place to go</Text>
      <Text accessibilityRole="header" style={styles.title}>Make a little day of it</Text>
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
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.line, borderRadius: 28, padding: 24, ...Shadow.card },
  title: { color: Colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -1.2, lineHeight: 30, marginTop: 7, marginBottom: 25 },
  steps: { gap: 21 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: Colors.brandStrong, fontSize: 13, fontWeight: '900' },
  stepBody: { flex: 1 },
  stepTitle: { color: Colors.ink, fontSize: 15, fontWeight: '800' },
  stepText: { color: Colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  storyButton: { marginTop: 28 },
});
