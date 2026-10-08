import type { DiscoverItem } from '@/lib/discover-data';

export type DiscoverMapProps = {
  items: DiscoverItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** The family's search location (saved or current). */
  center: { latitude: number; longitude: number } | null;
  radiusMiles: number;
};

export function hasPoint(item: DiscoverItem) {
  const { latitude, longitude } = item.location;
  return latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude) && !(latitude === 0 && longitude === 0);
}
