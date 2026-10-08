import { pictureBookPages, pictureBookProgress, pictureBookStatusLabel, pictureBookTemplateIcon } from '@sproutcue/shared/studio';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Shadow, Type } from '@/constants/theme';
import type { PictureBook } from '@/lib/studio-data';

import { AuthorizedImage } from './authorized-image';

// Web .studio-book-card, compact: cover (once made), title, progress, status pill.
export function BookCard({ book, onPress }: { book: PictureBook; onPress: () => void }) {
  const progress = pictureBookProgress(book);
  const cover = pictureBookPages(book).find((page) => page.status === 'ready' && page.url);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${book.title || 'Picture book'}, ${progress.ready} of ${progress.total} pages ready`} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <AuthorizedImage path={cover?.url} style={styles.cover} placeholder={<Text style={styles.coverIcon}>{pictureBookTemplateIcon(book.template?.slug)}</Text>} />
      <View style={styles.copy}>
        <Text style={Type.eyebrow} numberOfLines={1}>{book.template?.name || 'Picture book'}</Text>
        <Text style={styles.title} numberOfLines={2}>{book.title || 'Picture book'}</Text>
        <Text style={styles.meta}>{book.childName || 'Your child'} · {progress.ready}/{progress.total} pages ready</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress.total ? Math.max(4, (progress.ready / progress.total) * 100) : 4}%` }]} />
        </View>
      </View>
      <StatusPill status={progress.complete ? 'ready' : progress.generating ? 'generating' : book.status} />
    </Pressable>
  );
}

export function StatusPill({ status }: { status?: string }) {
  const tone = status === 'ready' ? styles.ready : status === 'failed' ? styles.failed : null;
  return (
    <View style={[styles.pill, tone]}>
      <Text style={[styles.pillText, status === 'ready' && styles.readyText, status === 'failed' && styles.failedText]}>{pictureBookStatusLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.line, borderRadius: 22, padding: 12, ...Shadow.card },
  pressed: { opacity: 0.8 },
  cover: { width: 76, height: 96, borderRadius: 14 },
  coverIcon: { fontSize: 30 },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: Colors.ink, fontSize: 17, fontWeight: '800', lineHeight: 21 },
  meta: { color: Colors.muted, fontSize: 13 },
  track: { height: 6, borderRadius: Radius.pill, backgroundColor: '#eee9df', overflow: 'hidden', marginTop: 6 },
  fill: { height: '100%', borderRadius: Radius.pill, backgroundColor: '#86a26e' },
  pill: { position: 'absolute', top: 10, right: 10, backgroundColor: Colors.brandSoft, borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 5 },
  pillText: { color: Colors.brandStrong, fontSize: 11, fontWeight: '800' },
  ready: { backgroundColor: '#e2f1e5' },
  readyText: { color: '#27633b' },
  failed: { backgroundColor: '#fff0ea' },
  failedText: { color: '#a44522' },
});
