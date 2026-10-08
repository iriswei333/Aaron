import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BackLink } from '@/components/studio/back-link';
import { BookCard } from '@/components/studio/book-card';
import { BookChooserSheet } from '@/components/studio/book-chooser-sheet';
import { Button, Screen } from '@/components/ui';
import { Colors, Type } from '@/constants/theme';
import { usePictureBooks } from '@/lib/studio-data';

// Web studioLibrary: every picture-book project, newest first.
export default function PictureBookLibrary() {
  const data = usePictureBooks();
  const [chooserOpen, setChooserOpen] = useState(false);

  return (
    <Screen refreshing={data.refreshing} onRefresh={data.refresh}>
      <BackLink />
      <View>
        <Text style={Type.eyebrow}>Your family library</Text>
        <Text accessibilityRole="header" style={styles.title}>Picture books</Text>
        <Text style={styles.lede}>Create every page in one action, revisit individual pages, or open a completed book as a PDF.</Text>
      </View>
      <Button label="+ New picture book" onPress={() => setChooserOpen(true)} fullWidth />
      {data.status ? <Text style={styles.status}>{data.status}</Text> : null}
      <View style={styles.heading}>
        <Text style={styles.headingTitle}>All projects</Text>
        <Text style={styles.count}>{data.books.length} {data.books.length === 1 ? 'book' : 'books'}</Text>
      </View>
      {data.loading ? (
        <ActivityIndicator color={Colors.brand} />
      ) : data.books.length ? (
        <View style={styles.list}>
          {data.books.map((book) => (
            <BookCard key={book.id} book={book} onPress={() => router.push({ pathname: '/create/books/[id]', params: { id: book.id } })} />
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>▦</Text>
          <Text style={styles.emptyTitle}>Your first book can start here.</Text>
          <Text style={styles.emptyText}>Choose a template and add 2–5 private reference photos.</Text>
        </View>
      )}
      <BookChooserSheet
        visible={chooserOpen}
        templates={data.templates}
        loading={data.loading}
        bookCount={data.books.length}
        onUse={(slug) => {
          setChooserOpen(false);
          router.push({ pathname: '/create/books/new', params: { template: slug } });
        }}
        onViewBooks={() => setChooserOpen(false)}
        onClose={() => setChooserOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: Colors.ink, fontSize: 40, fontWeight: '800', letterSpacing: -2, marginTop: 8, marginBottom: 10 },
  lede: { color: Colors.muted, fontSize: 16, lineHeight: 23 },
  status: { color: Colors.muted, fontSize: 14, fontWeight: '700' },
  heading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  headingTitle: { color: Colors.ink, fontSize: 20, fontWeight: '800' },
  count: { color: Colors.muted, fontSize: 13 },
  list: { gap: 12 },
  empty: { alignItems: 'center', gap: 6, backgroundColor: Colors.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.line, borderRadius: 20, padding: 28 },
  emptyIcon: { fontSize: 28, color: Colors.brandStrong },
  emptyTitle: { color: Colors.ink, fontSize: 16, fontWeight: '800' },
  emptyText: { color: Colors.muted, fontSize: 14, textAlign: 'center' },
});
