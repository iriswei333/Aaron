import { photoSelectionSummary } from '@sproutcue/shared/studio';
import { Image } from 'expo-image';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';
import { PhotoPermissionError, pickPhotos, takePhoto, type PickedPhoto } from '@/lib/photo-upload';

type Props = {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  max: number;
  /** Shown before any photo is picked. */
  hint: string;
  disabled?: boolean;
  onError: (message: string) => void;
  /** Extra already-saved photos counted against `max` (story maker). */
  reserved?: number;
};

// Pick from the library (several at once) or take a photo; thumbnails with remove buttons.
export function PhotoPicker({ photos, onChange, max, hint, disabled, onError, reserved = 0 }: Props) {
  const room = Math.max(0, max - reserved - photos.length);

  const add = async (source: 'library' | 'camera') => {
    try {
      const picked = source === 'camera' ? [await takePhoto()].filter(Boolean) as PickedPhoto[] : await pickPhotos(room);
      if (picked.length) onChange([...photos, ...picked].slice(0, max - reserved));
    } catch (error: any) {
      onError(error instanceof PhotoPermissionError ? error.message : `Could not open your photos: ${error?.message || error}`);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {photos.map((photo, index) => (
          <View key={`${photo.uri}-${index}`} style={styles.thumbWrap}>
            <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" accessibilityLabel={`Selected photo ${index + 1}`} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${index + 1}`}
              disabled={disabled}
              onPress={() => onChange(photos.filter((_, i) => i !== index))}
              hitSlop={6}
              style={styles.remove}>
              <Text style={styles.removeText}>×</Text>
            </Pressable>
          </View>
        ))}
        {room > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Choose photos" disabled={disabled} onPress={() => add('library')} style={({ pressed }) => [styles.add, pressed && styles.pressed, disabled && styles.disabled]}>
            <Text style={styles.addIcon}>＋</Text>
            <Text style={styles.addText}>Choose</Text>
          </Pressable>
        ) : null}
        {room > 0 && Platform.OS !== 'web' ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Take a photo" disabled={disabled} onPress={() => add('camera')} style={({ pressed }) => [styles.add, pressed && styles.pressed, disabled && styles.disabled]}>
            <Text style={styles.addIcon}>◉</Text>
            <Text style={styles.addText}>Camera</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.help} accessibilityLiveRegion="polite">{photos.length ? photoSelectionSummary(photos) : hint}</Text>
    </View>
  );
}

const SIZE = 84;
const styles = StyleSheet.create({
  wrap: { gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbWrap: { width: SIZE, height: SIZE },
  thumb: { width: SIZE, height: SIZE, borderRadius: 14, backgroundColor: Colors.heroBg },
  remove: { position: 'absolute', top: -6, right: -6, width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  removeText: { color: '#fff', fontSize: 16, lineHeight: 18, fontWeight: '800' },
  add: { width: SIZE, height: SIZE, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.brandBorder, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pressed: { backgroundColor: Colors.brandSoft },
  disabled: { opacity: 0.5 },
  addIcon: { color: Colors.brandStrong, fontSize: 22, fontWeight: '800' },
  addText: { color: Colors.brandStrong, fontSize: 12, fontWeight: '800' },
  help: { color: Colors.muted, fontSize: 12, lineHeight: 17 },
});
