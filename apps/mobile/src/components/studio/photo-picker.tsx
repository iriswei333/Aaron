import { photoSelectionSummary } from '@sproutcue/shared/studio';
import { Image } from 'expo-image';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';
import { PhotoPermissionError, pickPhotos, takePhoto, type PhotoProblem, type PickedPhoto } from '@/lib/photo-upload';

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
  /** Child-photo check results by photo uri: rejected photos get a red frame and a reason. */
  problems?: Record<string, PhotoProblem>;
};

// Pick from the library (several at once) or take a photo; thumbnails with remove buttons.
export function PhotoPicker({ photos, onChange, max, hint, disabled, onError, reserved = 0, problems = {} }: Props) {
  const room = Math.max(0, max - reserved - photos.length);
  const flagged = photos.map((photo, index) => ({ index, problem: problems[photo.uri] })).filter((item) => item.problem);

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
            <Image
              source={{ uri: photo.uri }}
              style={[styles.thumb, problems[photo.uri] && (problems[photo.uri].severity === 'warning' ? styles.thumbWarning : styles.thumbBlocked)]}
              contentFit="cover"
              accessibilityLabel={`Selected photo ${index + 1}${problems[photo.uri] ? `: ${problems[photo.uri].label}` : ''}`}
            />
            {problems[photo.uri] ? (
              <View style={[styles.flag, problems[photo.uri].severity === 'warning' ? styles.flagWarning : styles.flagBlocked]}>
                <Text style={styles.flagText} numberOfLines={1}>{problems[photo.uri].label}</Text>
              </View>
            ) : null}
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
      {flagged.map(({ index, problem }) => (
        <Text key={`problem-${index}`} style={[styles.problem, problem!.severity === 'warning' && styles.problemWarning]}>
          Photo {index + 1} · {problem!.message}
        </Text>
      ))}
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
  thumbBlocked: { borderWidth: 3, borderColor: Colors.danger, opacity: 0.7 },
  thumbWarning: { borderWidth: 3, borderColor: '#d9a420' },
  flag: { position: 'absolute', left: 4, right: 4, bottom: 4, borderRadius: 8, paddingHorizontal: 4, paddingVertical: 2 },
  flagBlocked: { backgroundColor: Colors.danger },
  flagWarning: { backgroundColor: '#8a6312' },
  flagText: { color: '#fff', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  problem: { color: Colors.danger, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  problemWarning: { color: '#8a6312' },
  remove: { position: 'absolute', top: -6, right: -6, width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  removeText: { color: '#fff', fontSize: 16, lineHeight: 18, fontWeight: '800' },
  add: { width: SIZE, height: SIZE, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.brandBorder, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pressed: { backgroundColor: Colors.brandSoft },
  disabled: { opacity: 0.5 },
  addIcon: { color: Colors.brandStrong, fontSize: 22, fontWeight: '800' },
  addText: { color: Colors.brandStrong, fontSize: 12, fontWeight: '800' },
  help: { color: Colors.muted, fontSize: 12, lineHeight: 17 },
});
