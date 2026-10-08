import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthorizedImage } from '@/components/studio/authorized-image';
import { Button } from '@/components/ui';
import { Colors, Layout, Radius, Type } from '@/constants/theme';
import { usePracticeStory } from '@/lib/studio-data';

type StoryPage =
  | { kind: 'cover' }
  | { kind: 'scene'; index: number; heading?: string; storyText?: string; sayTogether?: string; practiceCue?: string }
  | { kind: 'end' };

// Practice story reader: a cover, one scene per page (swipe or tap ‹ ›), and a celebration page
// with "Talk about it" questions — the web story preview, paced for reading aloud.
export default function StoryReader() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { story: asset, status, remove } = usePracticeStory(String(id));
  const { width } = useWindowDimensions();
  const list = useRef<FlatList<StoryPage>>(null);
  const [index, setIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const story = asset?.story || {};
  const pages: StoryPage[] = asset
    ? [{ kind: 'cover' }, ...(story.scenes || []).map((scene, i) => ({ kind: 'scene' as const, index: i, ...scene })), { kind: 'end' }]
    : [];

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;
  const go = (next: number) => {
    const target = Math.max(0, Math.min(pages.length - 1, next));
    list.current?.scrollToIndex({ index: target, animated: true });
    setIndex(target);
  };
  const close = () => (router.canGoBack() ? router.back() : router.replace('/family'));

  const confirmDelete = () => {
    const run = async () => {
      setDeleting(true);
      try {
        await remove();
        close();
      } catch {
        setDeleting(false);
      }
    };
    const text = `Delete “${story.title || asset?.title || 'this story'}”? This cannot be undone.`;
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(text)) run();
      return;
    }
    Alert.alert('Delete story?', text, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" onPress={close} hitSlop={8} style={styles.barButton}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.barTitle} numberOfLines={1}>{story.title || asset?.title || 'Story'}</Text>
        {asset ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Delete story" disabled={deleting} onPress={confirmDelete} hitSlop={8} style={styles.barButton}>
            <Text style={styles.delete}>{deleting ? '…' : 'Delete'}</Text>
          </Pressable>
        ) : <View style={styles.barButton} />}
      </View>

      {!asset ? (
        <View style={styles.center}>
          {status === 'loading' ? <ActivityIndicator color={Colors.brand} /> : <Text style={Type.bodyMuted}>We couldn’t find this story. It may have been deleted.</Text>}
        </View>
      ) : (
        <>
          <FlatList
            ref={list}
            data={pages}
            keyExtractor={(_, i) => String(i)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onViewableItemsChanged={onViewable}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            renderItem={({ item }) => (
              <ScrollView style={{ width }} contentContainerStyle={styles.page}>
                {item.kind === 'cover' ? (
                  <>
                    <AuthorizedImage path={asset.coverUrl} style={styles.cover} accessibilityLabel={`Illustration for ${story.title || asset.title}`} placeholder={<Text style={styles.coverIcon}>✦</Text>} />
                    <Text style={Type.eyebrow}>Little stories, big steps</Text>
                    <Text accessibilityRole="header" style={styles.title}>{story.title || asset.title}</Text>
                    {story.summary ? <Text style={styles.body}>{story.summary}</Text> : null}
                    {story.mission ? <Text style={styles.mission}>{story.mission}</Text> : null}
                    <View style={styles.pills}>
                      <Text style={styles.pill}>{story.readAloudMinutes || 3} minute read</Text>
                      {asset.goal || story.goal ? <Text style={styles.pill}>{asset.goal || story.goal}</Text> : null}
                    </View>
                    <Text style={styles.swipe}>Swipe or tap › to start reading</Text>
                  </>
                ) : item.kind === 'scene' ? (
                  <>
                    <View style={styles.sceneNumber}>
                      <Text style={styles.sceneNumberText}>{item.index + 1}</Text>
                    </View>
                    {item.heading ? <Text style={styles.sceneHeading}>{item.heading}</Text> : null}
                    {item.storyText ? <Text style={styles.sceneText}>{item.storyText}</Text> : null}
                    {item.sayTogether ? (
                      <View style={styles.say}>
                        <Text style={styles.sayLabel}>Say it together</Text>
                        <Text style={styles.sayText}>“{item.sayTogether}”</Text>
                      </View>
                    ) : null}
                    {item.practiceCue ? (
                      <View style={styles.cue}>
                        <Text style={styles.cueLabel}>Try together</Text>
                        <Text style={styles.cueText}>{item.practiceCue}</Text>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Text style={styles.endIcon}>🎉</Text>
                    {story.celebration ? <Text style={styles.celebration}>{story.celebration}</Text> : null}
                    {story.reflectionQuestions?.length ? (
                      <View style={styles.box}>
                        <Text style={styles.boxTitle}>Talk about it</Text>
                        {story.reflectionQuestions.map((question, i) => <Text key={i} style={styles.boxItem}>• {question}</Text>)}
                      </View>
                    ) : null}
                    {story.caregiverTips?.length ? (
                      <View style={[styles.box, styles.tips]}>
                        <Text style={styles.boxTitle}>For the grown-up</Text>
                        {story.caregiverTips.map((tip, i) => <Text key={i} style={styles.boxItem}>• {tip}</Text>)}
                      </View>
                    ) : null}
                    <Button label="Read again" variant="secondary" onPress={() => go(0)} fullWidth />
                    <Button label="Make another story" onPress={() => router.push('/create/story')} fullWidth />
                  </>
                )}
              </ScrollView>
            )}
          />
          <View style={styles.controls}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous page" disabled={index === 0} onPress={() => go(index - 1)} style={[styles.nav, index === 0 && styles.navOff]}>
              <Text style={styles.navText}>‹</Text>
            </Pressable>
            <View style={styles.dots} accessible accessibilityLabel={`Page ${index + 1} of ${pages.length}`}>
              {pages.map((_, i) => <View key={i} style={[styles.dot, i === index && styles.dotOn]} />)}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Next page" disabled={index >= pages.length - 1} onPress={() => go(index + 1)} style={[styles.nav, index >= pages.length - 1 && styles.navOff]}>
              <Text style={styles.navText}>›</Text>
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fffdf9' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: Colors.line },
  barButton: { minWidth: 64, minHeight: Layout.minTouch, justifyContent: 'center' },
  back: { color: Colors.brandStrong, fontSize: 15, fontWeight: '800' },
  barTitle: { flex: 1, textAlign: 'center', color: Colors.ink, fontSize: 15, fontWeight: '800' },
  delete: { color: Colors.dangerWeb, fontSize: 15, fontWeight: '800', textAlign: 'right' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  page: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 32, gap: 14 },
  cover: { width: '100%', aspectRatio: 1.2, borderRadius: 22, marginBottom: 6 },
  coverIcon: { fontSize: 40, color: Colors.storyInk },
  title: { color: Colors.ink, fontSize: 34, fontWeight: '800', letterSpacing: -1.5, lineHeight: 36 },
  body: { color: Colors.muted, fontSize: 17, lineHeight: 26 },
  mission: { color: Colors.storyAccent, fontSize: 16, fontWeight: '700', lineHeight: 23 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { backgroundColor: Colors.storyTile, color: Colors.storyInk, fontSize: 12, fontWeight: '800', borderRadius: Radius.pill, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 6 },
  swipe: { color: Colors.faint, fontSize: 13, marginTop: 8 },
  sceneNumber: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.storyTile, alignItems: 'center', justifyContent: 'center' },
  sceneNumberText: { color: Colors.storyInk, fontSize: 18, fontWeight: '800' },
  sceneHeading: { color: Colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -1, lineHeight: 31 },
  sceneText: { color: Colors.ink, fontSize: 21, lineHeight: 33 },
  say: { backgroundColor: '#f2f0fa', borderRadius: 16, padding: 16, gap: 4 },
  sayLabel: { color: Colors.storyAccent, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  sayText: { color: Colors.storyAccent, fontSize: 19, fontStyle: 'italic', fontWeight: '700', lineHeight: 27 },
  cue: { backgroundColor: Colors.sceneBg, borderRadius: 16, padding: 16, gap: 4 },
  cueLabel: { color: Colors.sceneCue, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  cueText: { color: Colors.sceneText, fontSize: 16, lineHeight: 23 },
  endIcon: { fontSize: 44 },
  celebration: { color: Colors.ink, fontSize: 24, fontWeight: '800', lineHeight: 31, letterSpacing: -0.6 },
  box: { backgroundColor: Colors.sceneBg, borderWidth: 1, borderColor: Colors.line, borderRadius: 16, padding: 16, gap: 6 },
  tips: { backgroundColor: Colors.tipsBg },
  boxTitle: { color: Colors.ink, fontSize: 15, fontWeight: '800' },
  boxItem: { color: Colors.muted, fontSize: 15, lineHeight: 22 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.line },
  nav: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.storyTile, alignItems: 'center', justifyContent: 'center' },
  navOff: { opacity: 0.35 },
  navText: { color: Colors.storyInk, fontSize: 30, lineHeight: 32 },
  dots: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, flex: 1, paddingHorizontal: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#d9d4ec' },
  dotOn: { width: 20, backgroundColor: Colors.storyAccent },
});
