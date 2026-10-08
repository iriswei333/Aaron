import { Image, type ImageContentFit } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ImageStyle } from 'react-native';

import { Colors } from '@/constants/theme';
import { authorizedSource } from '@/lib/api';

type Props = { path: string | null | undefined; style: StyleProp<ImageStyle>; contentFit?: ImageContentFit; accessibilityLabel?: string; placeholder?: React.ReactNode };

// Private family images (photos, story covers, picture-book pages) need the session token,
// so expo-image gets it as a header. Cached on disk per URL.
export function AuthorizedImage({ path, style, contentFit = 'cover', accessibilityLabel, placeholder }: Props) {
  const [source, setSource] = useState<{ uri: string; headers?: Record<string, string> } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setSource(null);
    setFailed(false);
    if (path) authorizedSource(path).then((next) => active && setSource(next)).catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [path]);

  if (!path || failed) return <View style={[style, styles.empty]}>{placeholder}</View>;
  if (!source) {
    return (
      <View style={[style, styles.empty]}>
        <ActivityIndicator color={Colors.brand} />
      </View>
    );
  }
  return (
    <Image
      source={{ ...source, cacheKey: path }}
      style={style}
      contentFit={contentFit}
      transition={150}
      cachePolicy="disk"
      accessibilityLabel={accessibilityLabel}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  empty: { backgroundColor: Colors.heroBg, alignItems: 'center', justifyContent: 'center' },
});
