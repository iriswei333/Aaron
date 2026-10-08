import { pictureBookPages, pictureBookProgress, pictureBookStatusLabel } from '@sproutcue/shared/studio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthorizedImage } from '@/components/studio/authorized-image';
import { BackLink } from '@/components/studio/back-link';
import { PageViewer, type ViewerPage } from '@/components/studio/page-viewer';
import { Button, Screen } from '@/components/ui';
import { Colors, Type } from '@/constants/theme';
import { sharePictureBookPdf, usePictureBooks } from '@/lib/studio-data';

// One picture book (web bookCard): make the whole book or one page at a time, read the finished
// pages full screen, share the PDF, delete the project.
export default function PictureBookScreen() {
  const params = useLocalSearchParams<{ id: string; page?: string; created?: string }>();
  const data = usePictureBooks();
  const book = data.books.find((item) => item.id === params.id) || null;
  const [viewerKey, setViewerKey] = useState<string | null>(null);
  const [message, setMessage] = useState(params.created ? 'Book created. You can make the whole book or work one page at a time.' : '');
  const [pdfBusy, setPdfBusy] = useState(false);

  const pages = pictureBookPages(book);
  const progress = pictureBookProgress(book);
  const readyPages: ViewerPage[] = pages.filter((page) => page.status === 'ready' && page.url).map((page) => ({ key: page.key, label: page.label, url: page.url as string }));

  // Opened from "Open creation" for a single page: show it straight away.
  useEffect(() => {
    if (params.page && readyPages.some((page) => page.key === params.page)) setViewerKey(params.page);
  }, [params.page, readyPages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const sharePdf = async () => {
    if (!book) return;
    setPdfBusy(true);
    setMessage('Preparing the complete PDF…');
    try {
      await sharePictureBookPdf(book);
      setMessage('');
    } catch (error: any) {
      setMessage(`Could not open the PDF: ${error?.message || error}`);
    } finally {
      setPdfBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!book) return;
    const text = `Delete “${book.title || 'this picture book'}”? This removes its photos and generated pages and cannot be undone.`;
    const run = async () => {
      try {
        await data.deleteBook(book.id);
        router.replace('/create/books');
      } catch (error: any) {
        setMessage(`Could not delete the book: ${error?.message || error}`);
      }
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(text)) run();
      return;
    }
    Alert.alert('Delete picture book?', text, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  };

  if (!book) {
    return (
      <Screen>
        <BackLink label="All picture books" fallback="/create/books" />
        {data.loading ? <ActivityIndicator color={Colors.brand} /> : <Text style={Type.bodyMuted}>We couldn’t find this picture book. It may have been deleted.</Text>}
      </Screen>
    );
  }

  return (
    <Screen refreshing={data.refreshing} onRefresh={data.refresh}>
      <BackLink label="All picture books" fallback="/create/books" />
      <View>
        <Text style={Type.eyebrow}>{book.template?.name || 'Picture book'}</Text>
        <Text accessibilityRole="header" style={styles.title}>{book.title || 'Picture book'}</Text>
        <Text style={styles.meta}>{book.childName || 'Your child'} · {progress.ready}/{progress.total} pages ready</Text>
      </View>

      <View style={styles.actions}>
        {readyPages.length ? <Button label={`Read the book (${readyPages.length} ${readyPages.length === 1 ? 'page' : 'pages'})`} onPress={() => setViewerKey(readyPages[0].key)} fullWidth /> : null}
        <Button
          label={progress.complete ? 'Whole book ready' : progress.generating ? 'Making pages…' : 'Make whole book'}
          variant={readyPages.length ? 'secondary' : 'primary'}
          disabled={progress.complete || progress.generating}
          onPress={() => data.makeWholeBook(book.id)}
          fullWidth
        />
        <View style={styles.row}>
          <Button label="Share PDF" variant="secondary" disabled={!progress.complete} loading={pdfBusy} onPress={sharePdf} style={styles.flex} />
          <Button label="Delete project" variant="danger" disabled={progress.generating} onPress={confirmDelete} style={styles.flex} />
        </View>
        {!progress.complete ? <Text style={styles.hint}>The PDF is ready once every page is made.</Text> : null}
      </View>
      {message || data.status ? <Text style={styles.status} accessibilityLiveRegion="polite">{message || data.status}</Text> : null}

      <View style={styles.grid}>
        {pages.map((page) => {
          const ready = page.status === 'ready' && page.url;
          return (
            <Pressable
              key={page.key}
              accessibilityRole="button"
              accessibilityLabel={`${page.label}: ${pictureBookStatusLabel(page.status)}`}
              disabled={!ready}
              onPress={() => setViewerKey(page.key)}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
              {ready ? (
                <AuthorizedImage path={page.url} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  {page.status === 'generating' ? <ActivityIndicator color={Colors.brand} /> : <Text style={styles.thumbIcon}>{page.status === 'failed' ? '!' : '✦'}</Text>}
                </View>
              )}
              <Text style={styles.tileTitle} numberOfLines={2}>{page.label}</Text>
              <Text style={styles.tileStatus}>{pictureBookStatusLabel(page.status)}</Text>
              {ready ? null : (
                <Button
                  label={page.status === 'failed' ? 'Try again' : 'Make page'}
                  variant="secondary"
                  size="sm"
                  disabled={page.status === 'generating' || progress.generating}
                  onPress={() => data.makePage(book.id, page.key)}
                  fullWidth
                />
              )}
            </Pressable>
          );
        })}
      </View>

      <PageViewer pages={readyPages} startKey={viewerKey} title={book.title || 'Picture book'} onClose={() => setViewerKey(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, alignSelf: 'stretch' },
  pressed: { opacity: 0.8 },
  title: { color: Colors.ink, fontSize: 34, fontWeight: '800', letterSpacing: -1.6, lineHeight: 36, marginTop: 8, marginBottom: 8 },
  meta: { color: Colors.muted, fontSize: 15 },
  actions: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  hint: { color: Colors.faint, fontSize: 12 },
  status: { color: Colors.muted, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexGrow: 1, flexBasis: '45%', maxWidth: '48.5%', backgroundColor: '#fffaf2', borderWidth: 1, borderColor: '#f0dfcc', borderRadius: 16, padding: 10, gap: 5 },
  thumb: { width: '100%', aspectRatio: 1, borderRadius: 12 },
  thumbEmpty: { backgroundColor: '#f7e8d8', alignItems: 'center', justifyContent: 'center' },
  thumbIcon: { color: Colors.assetInk, fontSize: 24 },
  tileTitle: { color: Colors.ink, fontSize: 14, fontWeight: '800', lineHeight: 17, marginTop: 2 },
  tileStatus: { color: Colors.muted, fontSize: 12, marginBottom: 4 },
});
