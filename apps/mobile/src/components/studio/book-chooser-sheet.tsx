import { pictureBookTemplateIcon } from '@sproutcue/shared/studio';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Sheet } from '@/components/ui';
import { Colors, Type } from '@/constants/theme';
import type { PictureBookTemplate } from '@/lib/studio-data';

type Props = {
  visible: boolean;
  templates: PictureBookTemplate[];
  loading: boolean;
  bookCount: number;
  onUse: (slug: string) => void;
  onViewBooks: () => void;
  onClose: () => void;
};

// Web pictureBookChooser: pick a template, or go to the books you already made.
export function BookChooserSheet({ visible, templates, loading, bookCount, onUse, onViewBooks, onClose }: Props) {
  const [slug, setSlug] = useState('');
  useEffect(() => {
    if (visible && !templates.some((template) => template.slug === slug)) setSlug(templates[0]?.slug || '');
  }, [visible, templates, slug]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      closeLabel="Close picture book choices"
      footer={
        <>
          <Button label="Use this template" fullWidth disabled={!slug} onPress={() => onUse(slug)} />
          <Button label={`View existing picture books${bookCount ? ` (${bookCount})` : ''}`} variant="secondary" fullWidth onPress={onViewBooks} />
        </>
      }>
      <View>
        <Text style={Type.eyebrow}>A book starring them</Text>
        <Text accessibilityRole="header" style={styles.title}>Choose a book template</Text>
        <Text style={styles.lede}>Pick a starting story now, or return to books you already made.</Text>
      </View>
      {loading && !templates.length ? <ActivityIndicator color={Colors.brand} /> : null}
      <View style={styles.list} accessibilityRole="radiogroup">
        {templates.map((template) => {
          const selected = template.slug === slug;
          return (
            <Pressable
              key={template.slug}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => setSlug(template.slug)}
              style={({ pressed }) => [styles.option, selected && styles.optionOn, pressed && !selected && styles.pressed]}>
              <Text style={styles.icon}>{pictureBookTemplateIcon(template.slug)}</Text>
              <View style={styles.copy}>
                <Text style={styles.name}>{template.name}</Text>
                {template.description ? <Text style={styles.description}>{template.description}</Text> : null}
                <Text style={styles.meta}>{template.pageCount ? `${template.pageCount} pages` : 'Picture book'}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { color: Colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -1, marginTop: 6 },
  lede: { color: Colors.muted, fontSize: 15, lineHeight: 21, marginTop: 6 },
  list: { gap: 10 },
  option: { flexDirection: 'row', gap: 12, borderWidth: 1.5, borderColor: Colors.line, borderRadius: 18, backgroundColor: Colors.surface, padding: 14 },
  optionOn: { borderColor: Colors.brand, backgroundColor: Colors.brandSoft },
  pressed: { backgroundColor: Colors.surfaceSoft },
  icon: { fontSize: 28 },
  copy: { flex: 1, gap: 3 },
  name: { color: Colors.ink, fontSize: 16, fontWeight: '800' },
  description: { color: Colors.muted, fontSize: 13, lineHeight: 18 },
  meta: { color: Colors.brandStrong, fontSize: 12, fontWeight: '800', marginTop: 2 },
});
