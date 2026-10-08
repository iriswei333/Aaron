import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View, type ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Layout, Radius } from '@/constants/theme';

import { AuthorizedImage } from './authorized-image';

export type ViewerPage = { key: string; label: string; url: string };

type Props = { pages: ViewerPage[]; startKey: string | null; title: string; onClose: () => void };

// Full-screen picture-book reader: swipe between finished pages (web studio-preview, one page at a time).
export function PageViewer({ pages, startKey, title, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<ViewerPage>>(null);
  const startIndex = Math.max(0, pages.findIndex((page) => page.key === startKey));
  const [index, setIndex] = useState(startIndex);
  const [listHeight, setListHeight] = useState(0);
  const visible = startKey !== null && pages.length > 0;

  useEffect(() => {
    if (visible) setIndex(startIndex);
  }, [visible, startIndex]);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  const go = (next: number) => {
    const target = Math.max(0, Math.min(pages.length - 1, next));
    list.current?.scrollToIndex({ index: target, animated: true });
    setIndex(target);
  };

  const imageHeight = Math.min(listHeight ? listHeight - 16 : height - insets.top - insets.bottom - 190, (width - 32) * 1.4);
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.bar}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow} numberOfLines={1}>{title}</Text>
            <Text style={styles.pageTitle} numberOfLines={1}>{pages[index]?.label}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close book" onPress={onClose} hitSlop={8} style={styles.close}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>
        <FlatList
          ref={list}
          style={styles.flex}
          onLayout={(event) => setListHeight(event.nativeEvent.layout.height)}
          data={pages}
          keyExtractor={(page) => page.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          renderItem={({ item }) => (
            <View style={[styles.page, { width, height: listHeight || undefined }]}>
              <AuthorizedImage path={item.url} style={{ width: width - 32, height: imageHeight, borderRadius: 18 }} contentFit="contain" accessibilityLabel={`Picture-book page: ${item.label}`} />
            </View>
          )}
        />
        <View style={styles.controls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous page" disabled={index === 0} onPress={() => go(index - 1)} style={[styles.nav, index === 0 && styles.navOff]}>
            <Text style={styles.navText}>‹</Text>
          </Pressable>
          <Text style={styles.counter} accessibilityLiveRegion="polite">{index + 1} / {pages.length}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Next page" disabled={index >= pages.length - 1} onPress={() => go(index + 1)} style={[styles.nav, index >= pages.length - 1 && styles.navOff]}>
            <Text style={styles.navText}>›</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  screen: { flex: 1, backgroundColor: '#241914' },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 12, gap: 12 },
  eyebrow: { color: '#e9c9a8', fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  pageTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 2 },
  close: { width: Layout.minTouch, height: Layout.minTouch, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 26, lineHeight: 28 },
  page: { alignItems: 'center', justifyContent: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingTop: 12 },
  nav: { width: 52, height: 52, borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  navOff: { opacity: 0.3 },
  navText: { color: '#fff', fontSize: 30, lineHeight: 32 },
  counter: { color: '#fff', fontSize: 15, fontWeight: '800', minWidth: 64, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
