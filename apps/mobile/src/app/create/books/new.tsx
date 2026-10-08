import { childDisplayName, getChildProfile } from '@sproutcue/shared/profile-defaults';
import { PICTURE_BOOK_PHOTOS, pictureBookTemplateIcon, validateAiPhotos } from '@sproutcue/shared/studio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackLink } from '@/components/studio/back-link';
import { PhotoPicker } from '@/components/studio/photo-picker';
import { ChoiceCards, TagGroup } from '@/components/studio/tag-group';
import { Button, Screen, TextField } from '@/components/ui';
import { Colors, Type } from '@/constants/theme';
import type { PickedPhoto } from '@/lib/photo-upload';
import { useSession } from '@/lib/session';
import { usePictureBooks } from '@/lib/studio-data';

// Web studioCreate: template, child's name, 2–5 private reference photos → new book.
export default function NewPictureBook() {
  const params = useLocalSearchParams<{ template?: string }>();
  const { user } = useSession();
  const data = usePictureBooks();
  const [slug, setSlug] = useState(params.template || '');
  const [childName, setChildName] = useState(childDisplayName(getChildProfile(user)));
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!slug && data.templates[0]) setSlug(data.templates[0].slug);
  }, [slug, data.templates]);
  const selected = data.templates.find((template) => template.slug === slug) || data.templates[0];

  const submit = async () => {
    const problem = validateAiPhotos(photos, PICTURE_BOOK_PHOTOS);
    if (problem) return setStatus(problem);
    if (!selected) return setStatus('Templates are still loading.');
    setBusy(true);
    try {
      const book = await data.createBook({ childName: childName.trim(), templateSlug: selected.slug, photos }, setStatus);
      setStatus('');
      router.replace({ pathname: '/create/books/[id]', params: { id: book.id, created: '1' } });
    } catch (error: any) {
      setStatus(`Could not create the book: ${error?.message || error}`);
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Create private book →" fullWidth loading={busy} disabled={!selected} onPress={submit} />}>
      <BackLink label="Back" fallback="/create/books" />
      <View>
        <Text style={Type.eyebrow}>A book starring them</Text>
        <Text accessibilityRole="header" style={styles.title}>Start a picture book</Text>
        <Text style={styles.lede}>{selected?.description || 'Choose a private picture-book template for your family.'}</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.templateHead}>
          <Text style={styles.icon}>{pictureBookTemplateIcon(selected?.slug)}</Text>
          <Text style={styles.templateName}>{selected?.name || 'Loading templates…'}</Text>
        </View>
        {data.templates.length > 1 ? (
          <TagGroup legend="Picture-book template">
            <ChoiceCards value={selected?.slug || ''} onChange={setSlug} disabled={busy} options={data.templates.map((template) => ({ id: template.slug, label: template.name, detail: template.pageCount ? `${template.pageCount} pages` : undefined }))} />
          </TagGroup>
        ) : null}
        <TextField label="Child’s name" labelVariant="caps" value={childName} onChangeText={setChildName} maxLength={80} editable={!busy} />
        <TagGroup legend="Reference photos" note="2–5 photos">
          <Text style={styles.help}>Use clear photos from different angles to help keep {childName || 'your child'} recognizable across the story.</Text>
          <PhotoPicker photos={photos} onChange={setPhotos} max={PICTURE_BOOK_PHOTOS.max} hint="JPEG, PNG, WebP, or HEIC · 2–5 photos · up to 20 MB each · uploaded privately one at a time" disabled={busy} onError={setStatus} />
        </TagGroup>
        {status ? <Text style={styles.status} accessibilityLiveRegion="polite">{status}</Text> : null}
      </View>
      <Text style={styles.privacy}>♡ Photos stay private to your family account and are only used to illustrate this book.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: Colors.ink, fontSize: 36, fontWeight: '800', letterSpacing: -1.8, marginTop: 8, marginBottom: 10 },
  lede: { color: Colors.muted, fontSize: 16, lineHeight: 23 },
  card: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.line, borderRadius: 24, padding: 18, gap: 20 },
  templateHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { fontSize: 30 },
  templateName: { flex: 1, color: Colors.ink, fontSize: 20, fontWeight: '800' },
  help: { color: Colors.muted, fontSize: 13, lineHeight: 19 },
  status: { color: Colors.muted, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  privacy: { color: Colors.muted, fontSize: 13, lineHeight: 19 },
});
