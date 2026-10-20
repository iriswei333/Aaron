import { deleteAssetPrompt, familyPlayDates, recentFamilyAssets } from '@sproutcue/shared/family-profile';
import { STORY_LANGUAGE_OPTIONS, childAgeLabel, childDisplayName, getChildProfile } from '@sproutcue/shared/profile-defaults';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ChatsCard } from '@/components/chat/chats-card';
import { AssetRow } from '@/components/family/asset-row';
import { AssetsEmpty } from '@/components/family/assets-empty';
import { ChildProfileCard } from '@/components/family/child-profile-card';
import { PlaydateRow } from '@/components/family/playdate-row';
import { ToyPlaySheet } from '@/components/family/toy-play-sheet';
import { Avatar, Button, Card, CountBadge, Screen, SectionHeading, Sheet } from '@/components/ui';
import { Colors, Layout, Spacing, Type } from '@/constants/theme';
import { useChat } from '@/lib/chat';
import { useFamilyData, type PracticeStoryAsset, type ToyPlayAsset } from '@/lib/family-data';
import { rememberPlaydate } from '@/lib/playdates';
import { useSession } from '@/lib/session';

// The web Family tab (apps/web/src/tabs/profile.js), arranged for a phone:
// heading (+ account sheet) → family card (with Edit) → coming-up playdates → chats → AI creations.
export default function FamilyScreen() {
  const { user, session, signOut, previewMode } = useSession();
  const family = useFamilyData();
  const chat = useChat();
  const [selectedToyId, setSelectedToyId] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const refreshChats = chat.refresh;
  // Fresh unread counts whenever the Family tab comes into view.
  useFocusEffect(
    useCallback(() => {
      refreshChats();
    }, [refreshChats]),
  );
  // Finished toy play ideas open here (web /family?toyPlay=<id>); stories open in the reader.
  const params = useLocalSearchParams<{ toyPlay?: string; practiceStory?: string }>();
  useEffect(() => {
    if (params.toyPlay && family.toyPlayAssets.some((asset) => asset.id === params.toyPlay)) {
      setSelectedToyId(params.toyPlay);
      router.setParams({ toyPlay: undefined });
    }
    if (params.practiceStory) {
      router.setParams({ practiceStory: undefined });
      router.push({ pathname: '/create/stories/reader', params: { storyId: params.practiceStory } });
    }
  }, [params.toyPlay, params.practiceStory, family.toyPlayAssets]);

  const child = getChildProfile(user);
  const childName = childDisplayName(child, 'your child');
  const storyLanguage = STORY_LANGUAGE_OPTIONS.find(([value]) => value === child.storyLanguage)?.[1] || 'English';
  const playDates = familyPlayDates(family.playDates);
  // Coming up = hasn't ended yet (undated ones stay here too); past ones sit behind a toggle, newest first.
  const now = Date.now();
  const hasEnded = (playDate: (typeof playDates)[number]) => {
    const end = new Date(playDate.endsAt || playDate.startsAt || '').getTime();
    return Number.isFinite(end) && end < now;
  };
  const upcoming = playDates.filter((playDate) => !hasEnded(playDate));
  const past = playDates.filter(hasEnded).reverse();
  const openPlaydate = (playDate: (typeof playDates)[number]) => {
    rememberPlaydate(playDate);
    router.push({ pathname: '/playdate/details', params: { playDateId: playDate.id } });
  };
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
    setAccountOpen(false);
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
      headerAction={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Account and settings"
          onPress={() => setAccountOpen(true)}
          hitSlop={6}
          style={({ pressed }) => [styles.account, pressed && styles.accountPressed]}>
          <Avatar name={user?.displayName || session?.user?.email || ''} size={40} />
        </Pressable>
      }
      refreshing={family.refreshing}
      onRefresh={
        previewMode
          ? undefined
          : () => {
              family.refresh();
              chat.refresh();
            }
      }>
      <ChildProfileCard
        name={childDisplayName(child, 'Add your kid')}
        ageLabel={childAgeLabel(child)}
        storyLanguage={storyLanguage}
        favorites={child.favoriteActivities || []}
        practicing={child.practicingSteps || []}
        onEdit={() => router.push('/welcome')}
      />

      <Card>
        <SectionHeading eyebrow="Your playdates" title="Coming up" action={upcoming.length ? <CountBadge count={upcoming.length} /> : undefined} />
        {family.loading ? (
          <ActivityIndicator color={Colors.brand} style={styles.loader} />
        ) : upcoming.length ? (
          <View style={styles.list}>
            {upcoming.map((playDate) => (
              <PlaydateRow key={playDate.id} playDate={playDate} onPress={() => openPlaydate(playDate)} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyPlaydates}>
            <Text style={Type.bodyMuted}>{past.length ? 'Nothing on the calendar right now.' : 'Playdates you create or join will appear here.'}</Text>
            <Button label="Find a playdate nearby" variant="secondary" size="sm" onPress={() => router.push('/discover')} />
          </View>
        )}
        {!family.loading && past.length ? (
          <>
            <Button
              label={showPast ? 'Hide past playdates' : `Past playdates (${past.length})`}
              variant="ghost"
              size="sm"
              onPress={() => setShowPast((open) => !open)}
              style={styles.pastToggle}
            />
            {showPast ? (
              <View style={styles.list}>
                {past.map((playDate) => (
                  <PlaydateRow key={playDate.id} playDate={playDate} onPress={() => openPlaydate(playDate)} />
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </Card>

      <ChatsCard />

      <Card>
        <SectionHeading
          eyebrow="Family AI assets"
          title="AI creations"
          subtitle="Picture books, practice stories, and saved ways to play."
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
                  if (entry.kind === 'story') router.push({ pathname: '/create/stories/reader', params: { storyId: entry.item.id } });
                  else if (entry.kind === 'toy') setSelectedToyId(entry.item.id);
                  else router.push({ pathname: '/create/books/book', params: { bookId: entry.item.id } });
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

      <ToyPlaySheet
        asset={selectedToy}
        deleting={Boolean(selectedToy && family.deletingId === selectedToy.id)}
        status={deleteMessage}
        onClose={() => setSelectedToyId('')}
        onDelete={(asset) => confirmDelete('toy', asset)}
      />

      <Sheet visible={accountOpen} onClose={() => setAccountOpen(false)}>
        <View style={styles.accountHead}>
          <Avatar name={user?.displayName || session?.user?.email || ''} size={64} />
          <Text style={Type.title}>{user?.displayName || 'Your family'}</Text>
          <Text style={Type.bodyMuted}>{previewMode ? 'Preview mode — sign-in is not configured for this build.' : session?.user?.email || ''}</Text>
        </View>
        <Button
          label="Edit family details"
          variant="secondary"
          fullWidth
          onPress={() => {
            setAccountOpen(false);
            router.push('/welcome');
          }}
        />
        {!previewMode ? <Button label="Sign out" variant="danger" fullWidth onPress={confirmSignOut} /> : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 9, marginTop: Spacing.two },
  loader: { marginVertical: Spacing.four },
  status: { color: Colors.muted, fontSize: 13, fontWeight: '700' },
  account: { width: Layout.minTouch, height: Layout.minTouch, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  accountPressed: { opacity: 0.7 },
  emptyPlaydates: { gap: Spacing.three, marginTop: Spacing.one },
  pastToggle: { alignSelf: 'center' },
  accountHead: { alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.four },
});
