import { TODAY_STORY_GOALS } from '@sproutcue/shared/today';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Sheet } from '@/components/ui';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { createTodayStory, saveTodayStory, type TodayStoryResult } from '@/lib/today-data';

type Props = { visible: boolean; childName: string; ageLabel: string; onClose: () => void; onSaved?: () => void };

// Web todayStoryModal: choose a playground moment → create a ~2-minute story → read → save to family assets.
export function StoryMakerSheet({ visible, childName, ageLabel, onClose, onSaved }: Props) {
  const [goalId, setGoalId] = useState(TODAY_STORY_GOALS[0].id);
  const [result, setResult] = useState<TodayStoryResult | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState<'' | 'create' | 'save'>('');
  const [saved, setSaved] = useState(false);

  function reset() {
    setResult(null);
    setStatus('');
    setSaved(false);
    setBusy('');
  }

  function close() {
    reset();
    onClose();
  }

  async function create() {
    setBusy('create');
    setSaved(false);
    setResult(null);
    setStatus('Writing a two-minute playground story…');
    try {
      setResult(await createTodayStory(goalId));
      setStatus('Story ready. Read it together or save it for later.');
      haptics.success();
    } catch (error) {
      haptics.error();
      setStatus(`Could not create the story: ${error instanceof Error ? error.message : 'please try again.'}`);
    }
    setBusy('');
  }

  async function save() {
    if (!result || saved) return;
    setBusy('save');
    setStatus('Saving to Family AI Assets…');
    try {
      await saveTodayStory(result);
      setSaved(true);
      setStatus('Saved to Family AI Assets.');
      haptics.success();
      onSaved?.();
    } catch (error) {
      haptics.error();
      setStatus(`Could not save the story: ${error instanceof Error ? error.message : 'please try again.'}`);
    }
    setBusy('');
  }

  const story = result?.story;
  return (
    <Sheet visible={visible} onClose={close} closeLabel="Close story maker">
      <View style={styles.header}>
        <Text style={Type.eyebrow}>Playground practice story</Text>
        <Text accessibilityRole="header" style={styles.title}>{`Get ${childName} ready through a story`}</Text>
        <Text style={styles.lede}>{`Choose one moment to practice. The story uses ${childName}’s name and age from the family profile.`}</Text>
        <View style={styles.childPill}>
          <Text style={styles.childPillText}>{`${childName} · ${ageLabel || 'age saved in profile'}`}</Text>
        </View>
      </View>

      {story ? (
        <View style={styles.preview}>
          <View style={styles.previewHeading}>
            <Text style={Type.eyebrow}>{`About 2 minutes · ${result?.goal || ''}`}</Text>
            <Text style={styles.storyTitle}>{story.title}</Text>
            {story.summary ? <Text style={styles.lede}>{story.summary}</Text> : null}
          </View>
          <View style={styles.scenes}>
            {(story.scenes || []).map((scene, index) => (
              <View key={index} style={styles.scene}>
                <View style={styles.sceneNumber}>
                  <Text style={styles.sceneNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.sceneBody}>
                  <Text style={styles.sceneHeading}>{scene.heading}</Text>
                  <Text style={styles.sceneText}>{scene.storyText}</Text>
                  {scene.practiceCue ? <Text style={styles.sceneCue}>Try together: {scene.practiceCue}</Text> : null}
                </View>
              </View>
            ))}
          </View>
          {story.celebration ? (
            <View style={styles.quote}>
              <Text style={styles.quoteText}>{story.celebration}</Text>
            </View>
          ) : null}
          <View style={styles.actions}>
            <Button label="Choose another goal" variant="secondary" onPress={reset} disabled={busy === 'save'} fullWidth />
            <Button
              label={saved ? '✓ Saved to family assets' : busy === 'save' ? 'Saving…' : 'Save to family assets'}
              onPress={save}
              disabled={saved || busy === 'save'}
              fullWidth
            />
          </View>
        </View>
      ) : (
        <View style={styles.form}>
          <View style={styles.goals}>
            {TODAY_STORY_GOALS.map((goal) => {
              const selected = goal.id === goalId;
              return (
                <Pressable
                  key={goal.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: busy === 'create' }}
                  disabled={busy === 'create'}
                  onPress={() => {
                    if (goal.id !== goalId) haptics.select();
                    setGoalId(goal.id);
                    setStatus('');
                  }}
                  style={({ pressed }) => [styles.goal, (selected || pressed) && styles.goalSelected]}>
                  <View style={styles.goalIcon}>
                    <Text style={styles.goalIconText}>{goal.icon}</Text>
                  </View>
                  <View style={styles.goalBody}>
                    <Text style={styles.goalLabel}>{goal.label}</Text>
                    <Text style={styles.goalDetail}>{goal.detail}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Button label={busy === 'create' ? 'Creating the story…' : `Create ${childName}’s story →`} onPress={create} loading={busy === 'create'} fullWidth />
        </View>
      )}

      {status ? (
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {status}
        </Text>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: Colors.line },
  title: { color: Colors.ink, fontSize: 32, fontWeight: '800', letterSpacing: -1.6, lineHeight: 33 },
  lede: { color: Colors.muted, fontSize: 15, lineHeight: 23 },
  childPill: { alignSelf: 'flex-start', backgroundColor: Colors.storyGreenBg, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 7, marginTop: 5 },
  childPillText: { color: Colors.storyGreenInk, fontSize: 12, fontWeight: '800' },
  form: { gap: 20, paddingTop: 6 },
  goals: { gap: 11 },
  goal: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 17, backgroundColor: '#fff', borderWidth: 2, borderColor: Colors.line, borderRadius: Radius.md },
  goalSelected: { backgroundColor: Colors.intentActiveBg, borderColor: Colors.intentActiveBorder },
  goalIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  goalIconText: { fontSize: 20 },
  goalBody: { flex: 1, gap: 4 },
  goalLabel: { color: Colors.ink, fontSize: 15, fontWeight: '800' },
  goalDetail: { color: Colors.muted, fontSize: 12, lineHeight: 17 },
  preview: { gap: 18, paddingTop: 6 },
  previewHeading: { gap: 6 },
  storyTitle: { color: Colors.ink, fontSize: 29, fontWeight: '800', letterSpacing: -1.2, lineHeight: 30 },
  scenes: { gap: 10 },
  scene: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: Colors.sceneBg, borderRadius: 15, padding: 14 },
  sceneNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.storyGreenBg, alignItems: 'center', justifyContent: 'center' },
  sceneNumberText: { color: Colors.storyGreenInk, fontSize: 11, fontWeight: '900' },
  sceneBody: { flex: 1, gap: 4 },
  sceneHeading: { color: Colors.ink, fontSize: 15, fontWeight: '800' },
  sceneText: { color: Colors.sceneText, fontSize: 15, lineHeight: 23 },
  sceneCue: { color: Colors.sceneCue, fontSize: 12, lineHeight: 17 },
  quote: { backgroundColor: Colors.quoteBg, borderLeftWidth: 4, borderLeftColor: Colors.brand, borderRadius: 12, paddingHorizontal: 17, paddingVertical: 15 },
  quoteText: { color: Colors.ink, fontSize: 15, lineHeight: 22 },
  actions: { gap: 10 },
  status: { color: Colors.muted, fontSize: 13, fontWeight: '700', marginTop: Spacing.two },
});
