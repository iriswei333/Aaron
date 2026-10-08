import { deleteAssetPrompt, familyPlayDates, recentFamilyAssets } from '@sproutcue/shared/family-profile';
import { STORY_LANGUAGE_OPTIONS, childAgeLabel, childDisplayName, getChildProfile } from '@sproutcue/shared/profile-defaults';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { AssetRow } from '@/components/family/asset-row';
import { AssetsEmpty } from '@/components/family/assets-empty';
import { ChildProfileCard } from '@/components/family/child-profile-card';
import { PlaydateRow } from '@/components/family/playdate-row';
import { ToyPlaySheet } from '@/components/family/toy-play-sheet';
import { Button, Card, CountBadge, Screen, SectionHeading } from '@/components/ui';
import { Colors, Spacing, Type } from '@/constants/theme';
import { useFamilyData, type PracticeStoryAsset, type ToyPlayAsset } from '@/lib/family-data';
import { rememberPlaydate } from '@/lib/playdates';
import { useSession } from '@/lib/session';

// Mirrors the web Family tab (apps/web/src/tabs/profile.js), minus family chat:
// heading → child card → your playdates → AI creations (+ detail sheets) → account.
export default function FamilyScreen() {
  const { user, session, signOut, previewMode } = useSession();
  const family = useFamilyData();
  const [selectedToyId, setSelectedToyId] = useState('');
  // Finished toy play ideas open here (web /family?toyPlay=<id>); stories open in the reader.
  const params = useLocalSearchParams<{ toyPlay?: string; practiceStory?: string }>();
  useEffect(() => {
    if (params.toyPlay && family.toyPlayAssets.some((asset) => asset.id === params.toyPlay)) {
      setSelectedToyId(params.toyPlay);
      router.setParams({ toyPlay: undefined });
    }
    if (params.practiceStory) {
      router.setParams({ practiceStory: undefined });
      router.push({ pathname: '/create/stories/[id]', params: { id: params.practiceStory } });
    }
  }, [params.toyPlay, params.practiceStory, family.toyPlayAssets]);

  const child = getChildProfile(user);
  const childName = childDisplayName(child, 'your child');
  const storyLanguage = STORY_LANGUAGE_OPTIONS.find(([value]) => value === child.storyLanguage)?.[1] || 'English';
  const playDates = familyPlayDates(family.playDates);
  const assets = recentFamilyAssets(family);
  const totalAssets = family.pictureBooks.length + family.toyPlayAssets.length + family.practiceStoryAssets.length;
  const selectedToy = family.toyPlayAssets.find((asset) => asset.id === selectedToyId) || null;
  const deleteMessage = family.assetsStatus && (family.deletingId || family.assetsStatus.startsWith('Could not delete')) ? family.assetsStatus : '';

  function confirmDelete(kind: 'toy' | 'story', asset: ToyPlayAsset | PracticeStoryAsset) {
    const prompt = deleteAssetPrompt(kind, asset);
    const run = async () => {
      const ok = await family.deleteAsset(kind, asset);
      if (ok) setSelectedToyId('');
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`${prompt.title} ${prompt.message}`)) run();
      return;
    }
    Alert.alert(prompt.title, prompt.message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  }

  function confirmSignOut() {
    if (Platform.OS === 'web') return void signOut();
    Alert.alert('Sign out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <Screen
      eyebrow="Your family, your pace"
      title={user?.displayName || 'Your family'}
      lede={`One private home for ${childName}’s profile, play plans, and family conversations.`}
      refreshing={family.refreshing}
      onRefresh={previewMode ? undefined : family.refresh}>
      <Button label="Edit family details" variant="secondary" fullWidth onPress={() => router.push('/welcome')} />

      <ChildProfileCard
        name={childDisplayName(child, 'Add your kid')}
        ageLabel={childAgeLabel(child)}
        storyLanguage={storyLanguage}
        favorites={child.favoriteActivities || []}
        practicing={child.practicingSteps || []}
      />

      <Card>
        <SectionHeading eyebrow="Your playdates" title={`${playDates.length} ${playDates.length === 1 ? 'playdate' : 'playdates'}`} />
        {family.loading ? (
          <ActivityIndicator color={Colors.brand} style={styles.loader} />
        ) : playDates.length ? (
          <View style={styles.list}>
            {playDates.map((playDate) => (
              <PlaydateRow
                key={playDate.id}
                playDate={playDate}
                onPress={() => {
                  rememberPlaydate(playDate);
                  router.push({ pathname: '/playdate/[id]', params: { id: playDate.id } });
                }}
              />
            ))}
          </View>
        ) : (
          <Text style={Type.bodyMuted}>Playdates you create or join will appear here.</Text>
        )}
      </Card>

      <Card>
        <SectionHeading
          eyebrow="Family AI assets"
          title="AI creations"
          subtitle="Private picture books, practice stories, and saved ways to play."
          action={<CountBadge count={totalAssets} />}
        />
        {family.loading ? (
          <Text style={Type.bodyMuted}>Loading family assets…</Text>
        ) : assets.length ? (
          <View style={styles.list}>
            {assets.map((entry) => (
              <AssetRow
                key={`${entry.kind}-${entry.item.id}`}
                entry={entry}
                childName={childDisplayName(child, 'Your child')}
                onPress={() => {
                  if (entry.kind === 'story') router.push({ pathname: '/create/stories/[id]', params: { id: entry.item.id } });
                  else if (entry.kind === 'toy') setSelectedToyId(entry.item.id);
                  else router.push({ pathname: '/create/books/[id]', params: { id: entry.item.id } });
                }}
              />
            ))}
          </View>
        ) : (
          <AssetsEmpty />
        )}
        {family.assetsStatus && !deleteMessage ? (
          <Text accessibilityLiveRegion="polite" style={styles.status}>{family.assetsStatus}</Text>
        ) : null}
        <Button label="Open Play Studio →" variant="secondary" fullWidth onPress={() => router.push('/studio')} />
      </Card>

      <Card>
        <SectionHeading eyebrow="Account" title="Signed in" />
        <Text style={Type.bodyMuted}>{previewMode ? 'Preview mode — sign-in is not configured for this build.' : session?.user?.email || ''}</Text>
        {!previewMode ? <Button label="Sign out" variant="danger" size="sm" onPress={confirmSignOut} /> : null}
      </Card>

      <ToyPlaySheet
        asset={selectedToy}
        deleting={Boolean(selectedToy && family.deletingId === selectedToy.id)}
        status={deleteMessage}
        onClose={() => setSelectedToyId('')}
        onDelete={(asset) => confirmDelete('toy', asset)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 9, marginTop: Spacing.two },
  loader: { marginVertical: Spacing.four },
  status: { color: Colors.muted, fontSize: 13, fontWeight: '700' },
});
