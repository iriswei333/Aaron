import {
  DEFAULT_PRACTICE_STORY_LENGTH,
  MAX_PRACTICE_STORY_PARENT_GOALS,
  PRACTICE_STORY_CHALLENGES,
  PRACTICE_STORY_LENGTHS,
  PRACTICE_STORY_PARENT_GOALS,
  PRACTICE_STORY_THEMES,
  challengeFromPracticingStep,
} from '@sproutcue/shared/practice-story-options';
import { FAVORITE_INTEREST_OPTIONS, childDisplayName, getChildProfile } from '@sproutcue/shared/profile-defaults';
import { PRACTICE_STORY_MAX_PHOTOS, toggleInterest, validateAiPhotos } from '@sproutcue/shared/studio';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthorizedImage } from '@/components/studio/authorized-image';
import { BackLink } from '@/components/studio/back-link';
import { PhotoPicker } from '@/components/studio/photo-picker';
import { ChoiceCards, TagChips, TagGroup } from '@/components/studio/tag-group';
import { Button, Screen, TextField } from '@/components/ui';
import { Colors, Radius, Type } from '@/constants/theme';
import type { PickedPhoto } from '@/lib/photo-upload';
import { useSession } from '@/lib/session';
import { useCreatePracticeStory, useSavedPhotos } from '@/lib/studio-data';

// Web practiceStoryModal: challenge → favorite things → parent goals → theme → length → language
// → optional photos → background AI job → story reader.
export default function StoryMakerScreen() {
  const { user } = useSession();
  const child = getChildProfile(user);
  const childName = childDisplayName(child);
  const months = Number(child?.ageMonths) || 30;
  const create = useCreatePracticeStory();
  const saved = useSavedPhotos(true);

  const [challenge, setChallenge] = useState<string>(() => {
    const match = challengeFromPracticingStep(child?.practicingSteps?.[0]);
    return typeof match === 'string' ? match : match?.id || '';
  });
  const [goal, setGoal] = useState('');
  const [interests, setInterests] = useState<string>(() => (child?.favoriteActivities || []).slice(0, 5).join(', '));
  const [parentGoals, setParentGoals] = useState<string[]>([]);
  const [theme, setTheme] = useState('');
  const [length, setLength] = useState(DEFAULT_PRACTICE_STORY_LENGTH);
  const [language, setLanguage] = useState<'en' | 'zh-CN'>(child?.storyLanguage === 'zh-CN' ? 'zh-CN' : 'en');
  const [newPhotos, setNewPhotos] = useState<PickedPhoto[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const interestOptions = useMemo(() => {
    const known = new Set(FAVORITE_INTEREST_OPTIONS.map(([value]) => value));
    const extra: string[] = (child?.favoriteActivities || []).filter((value: string) => value && !known.has(value.toLowerCase()));
    return [...FAVORITE_INTEREST_OPTIONS.map(([id, label]) => ({ id, label })), ...extra.map((value) => ({ id: value, label: value }))];
  }, [child?.favoriteActivities]);
  const chosen = interests.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  const photoCount = newPhotos.length + savedIds.length;
  const mandarin = language === 'zh-CN';

  const submit = async () => {
    if (newPhotos.length) {
      const problem = validateAiPhotos(newPhotos, { min: 1, max: PRACTICE_STORY_MAX_PHOTOS });
      if (problem) return setStatus(problem);
    }
    setBusy(true);
    try {
      await create({ goal, challenge, interests, parentGoals, storyTheme: theme, adventureLength: length, language, savedPhotoIds: savedIds, newPhotos }, setStatus);
      setStatus('Story queued. We’ll let you know when it is ready.');
    } catch (error: any) {
      setStatus(/challenge/.test(error?.message || '') ? error.message : `Could not create the story: ${error?.message || error}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Text style={styles.private}>♡ Your story is private and will be saved to Family AI Assets.</Text>
          <Button label={busy ? (mandarin ? '正在生成故事…' : 'Creating the story…') : mandarin ? '生成普通话故事 →' : 'Create my story →'} fullWidth loading={busy} onPress={submit} />
        </View>
      }>
      <BackLink />
      <View>
        <Text style={Type.eyebrow}>Little stories, big steps</Text>
        <Text accessibilityRole="header" style={styles.title}>A story made for {childName}</Text>
        <Text style={styles.lede}>Pick the challenge, their favorite things, and how you’d like them to grow — we’ll turn practice into a step-by-step adventure.</Text>
        <Text style={styles.age}>{months} months · suggestions matched to age</Text>
      </View>

      <View style={styles.form}>
        <TagGroup legend="1 · Current challenge">
          <TagChips options={PRACTICE_STORY_CHALLENGES} isSelected={(id) => challenge === id} onToggle={(id) => setChallenge(challenge === id ? '' : id)} disabled={busy} />
          <TextField label="Or describe a specific step (optional)" labelVariant="caps" value={goal} onChangeText={setGoal} maxLength={120} placeholder="e.g. Wash hands before dinner" editable={!busy} />
        </TagGroup>

        <TagGroup legend={`2 · What does ${childName} love?`}>
          <TagChips options={interestOptions} isSelected={(id) => chosen.includes(id.toLowerCase())} onToggle={(id) => setInterests(toggleInterest(interests, id))} disabled={busy} />
          <TextField label="Favorite things" labelVariant="caps" value={interests} onChangeText={setInterests} maxLength={300} placeholder="Tap tags above or type, e.g. cars, animals, music" hint="Up to five favorite things, separated by commas." editable={!busy} />
        </TagGroup>

        <TagGroup legend="3 · Parent goal" note={`Choose up to ${MAX_PRACTICE_STORY_PARENT_GOALS}`}>
          <TagChips
            options={PRACTICE_STORY_PARENT_GOALS}
            isSelected={(id) => parentGoals.includes(id)}
            onToggle={(id) => setParentGoals(parentGoals.includes(id) ? parentGoals.filter((item) => item !== id) : [...parentGoals, id].slice(-MAX_PRACTICE_STORY_PARENT_GOALS))}
            disabled={busy}
          />
        </TagGroup>

        <TagGroup legend="4 · Story theme" note="Optional — we’ll pick one if you skip">
          <TagChips options={PRACTICE_STORY_THEMES} isSelected={(id) => theme === id} onToggle={(id) => setTheme(theme === id ? '' : id)} disabled={busy} />
        </TagGroup>

        <TagGroup legend="5 · Adventure length">
          <ChoiceCards value={length} onChange={setLength} disabled={busy} options={PRACTICE_STORY_LENGTHS.map((item: any) => ({ id: item.id, label: item.label, detail: item.detail }))} />
        </TagGroup>

        <TagGroup legend="6 · Story language">
          <ChoiceCards
            value={language}
            onChange={setLanguage}
            disabled={busy}
            options={[
              { id: 'en', label: 'English', detail: 'Generate the full story in English' },
              { id: 'zh-CN', label: '中文（普通话）', detail: '生成简体中文故事' },
            ]}
          />
        </TagGroup>

        <TagGroup legend="7 · Add an illustration" note="Optional">
          <Text style={styles.help}>Use 1–5 new or saved photos from different angles to keep {childName} recognizable. The story also works without photos.</Text>
          <PhotoPicker
            photos={newPhotos}
            onChange={setNewPhotos}
            max={PRACTICE_STORY_MAX_PHOTOS}
            reserved={savedIds.length}
            hint="JPEG, PNG, WebP, or HEIC · up to 5 photos · 20 MB each · uploaded privately"
            disabled={busy}
            onError={setStatus}
          />
          {saved.photos.length ? (
            <View style={styles.saved}>
              <Text style={styles.savedLabel}>Or choose saved photos ({photoCount}/{PRACTICE_STORY_MAX_PHOTOS} selected)</Text>
              <View style={styles.savedGrid}>
                {saved.photos.slice(0, 12).map((photo) => {
                  const selected = savedIds.includes(photo.id);
                  const full = !selected && photoCount >= PRACTICE_STORY_MAX_PHOTOS;
                  return (
                    <Pressable
                      key={photo.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected, disabled: busy || full }}
                      accessibilityLabel={photo.label || 'Saved photo'}
                      disabled={busy || full}
                      onPress={() => setSavedIds(selected ? savedIds.filter((id) => id !== photo.id) : [...savedIds, photo.id])}
                      style={[styles.savedItem, selected && styles.savedItemOn, full && styles.dim]}>
                      <AuthorizedImage path={photo.contentUrl} style={styles.savedImage} />
                      {selected ? (
                        <View style={styles.check}>
                          <Text style={styles.checkText}>✓</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : saved.loaded ? null : (
            <Text style={styles.help}>Loading saved photos…</Text>
          )}
          {photoCount ? <Button label="Use story without photos" variant="ghost" size="sm" onPress={() => { setNewPhotos([]); setSavedIds([]); }} disabled={busy} /> : null}
        </TagGroup>
        {status ? <Text style={styles.status} accessibilityLiveRegion="polite">{status}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: Colors.ink, fontSize: 36, fontWeight: '800', letterSpacing: -1.8, lineHeight: 38, marginTop: 8, marginBottom: 12 },
  lede: { color: Colors.muted, fontSize: 16, lineHeight: 23 },
  age: { alignSelf: 'flex-start', backgroundColor: Colors.storyTile, color: Colors.storyInk, fontSize: 12, fontWeight: '800', borderRadius: Radius.pill, overflow: 'hidden', paddingHorizontal: 11, paddingVertical: 6, marginTop: 12 },
  form: { backgroundColor: '#fffdf9', borderWidth: 1, borderColor: Colors.line, borderRadius: 24, padding: 18, gap: 24 },
  help: { color: Colors.muted, fontSize: 13, lineHeight: 19 },
  saved: { gap: 8 },
  savedLabel: { color: Colors.ink, fontSize: 13, fontWeight: '700' },
  savedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  savedItem: { width: 72, height: 72, borderRadius: 12, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  savedItemOn: { borderColor: Colors.storyAccent },
  savedImage: { width: '100%', height: '100%' },
  dim: { opacity: 0.4 },
  check: { position: 'absolute', right: 4, top: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.storyAccent, alignItems: 'center', justifyContent: 'center' },
  checkText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  status: { color: Colors.muted, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  footer: { gap: 8 },
  private: { color: Colors.muted, fontSize: 12, textAlign: 'center' },
});
