import { Colors } from '@/constants/theme';
import { TODAY_IMAGES } from '@/components/today/images';
import type { DiscoverItem, DiscoverKind } from '@/lib/discover-data';

/** Pin / tile background per kind (web .discover-map-pin.kind-*). */
export const KIND_TINT: Record<DiscoverKind, string> = {
  playground: Colors.surface,
  playdate: Colors.pinPlaydate,
  family_event: Colors.pinEvent,
  story_time: Colors.pinStory,
};

/** Photo for a result: the provider's own image, or the bundled defaults the web uses. */
export function discoverImage(item: DiscoverItem) {
  if (item.imageUrl) return { uri: item.imageUrl };
  if (item.kind === 'playground') return TODAY_IMAGES.playground;
  if (item.kind === 'story_time') return TODAY_IMAGES.home;
  return null;
}

/** Hero image for the event detail sheet (always has a picture). */
export function discoverHeroImage(item: DiscoverItem) {
  return discoverImage(item) ?? TODAY_IMAGES.playground;
}
