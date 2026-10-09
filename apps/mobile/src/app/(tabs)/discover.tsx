import { childAgeLabel, getChildProfile } from '@sproutcue/shared/profile-defaults';
import { weatherIsIndoorDay } from '@sproutcue/shared/today';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DiscoverHeading } from '@/components/discover/discover-heading';
import { DiscoverMap } from '@/components/discover/discover-map';
import { EventDetailSheet } from '@/components/discover/event-detail-sheet';
import { FilterBar, type DiscoverView } from '@/components/discover/filter-bar';
import type { ItemHandlers } from '@/components/discover/item-actions';
import { PlaygroundDetailSheet } from '@/components/discover/playground-detail-sheet';
import { ProviderFooter } from '@/components/discover/provider-footer';
import { ResultCard } from '@/components/discover/result-card';
import { PlaydateFormSheet } from '@/components/playdates/playdate-form-sheet';
import { EmptyResults, SelectionCard } from '@/components/discover/selection-card';
import { Button, Screen } from '@/components/ui';
import { Colors, Radius } from '@/constants/theme';
import { useDiscoverData, type DiscoverItem, type Playground } from '@/lib/discover-data';
import type { PlayDate } from '@/lib/family-data';
import { rememberPlaydate } from '@/lib/playdates';
import { useSession } from '@/lib/session';

// Mirrors the web Discover tab (apps/web/src/tabs/play.js renderPlay):
// heading → filters + Map/List → map with selection card, or result cards.
// The family's location (Family details / Today chip) limits playgrounds and playdates only.
export default function DiscoverScreen() {
  const { user } = useSession();
  const data = useDiscoverData();
  const child = getChildProfile(user);
  const [view, setView] = useState<DiscoverView>('map');
  const [selectedId, setSelectedId] = useState('');
  const [detailId, setDetailId] = useState('');
  const [createFor, setCreateFor] = useState<Playground | null>(null);

  const selected = data.items.find((item) => item.id === selectedId) ?? data.items[0] ?? null;
  const detail = useMemo(
    () => data.items.find((item) => item.id === detailId) ?? data.allItems.find((item) => item.id === detailId) ?? null,
    [data.items, data.allItems, detailId],
  );
  const searchLabel = data.location?.address || data.location?.label || child.homeCity || 'Choose a search location';
  // Playground for "+ New playdate" from the Playdates filter: the selected one, else the nearest live one.
  const livePlayground = (item: DiscoverItem | null) => (item?.kind === 'playground' && !['starter', 'map-search'].includes(item.detail.source) ? item : null);
  const contextPlayground = livePlayground(selected) ?? data.items.map(livePlayground).find(Boolean) ?? data.allItems.map(livePlayground).find(Boolean) ?? null;

  const openPlaydate = (playDate: PlayDate) => {
    rememberPlaydate(playDate);
    router.push({ pathname: '/playdate/[id]', params: { id: playDate.id } });
  };

  const handlers: ItemHandlers = {
    isSaved: data.isSaved,
    onDetails: (item) => {
      if (item.kind === 'playdate') openPlaydate(item.detail as PlayDate);
      else setDetailId(item.id);
    },
    onSelectPlayground: (item) => {
      setSelectedId(item.id);
      setView('map');
    },
    onNewPlaydate: (item) => {
      setDetailId('');
      setCreateFor(item.detail as Playground);
    },
    onJoin: data.join,
    onToggleSave: data.toggleSave,
  };

  return (
    <Screen refreshing={data.refreshing} onRefresh={data.refresh}>
      <DiscoverHeading />
      <FilterBar filter={data.filter} onChoose={data.choose} count={data.items.length} view={view} onView={setView} />

      {data.message ? (
        <Text style={styles.message} accessibilityLiveRegion="polite" onPress={data.clearMessage}>
          {data.message}
        </Text>
      ) : null}

      {data.filter.kinds.includes('playdate') && contextPlayground ? (
        <View style={styles.context}>
          <Text style={styles.contextText}>Want to invite nearby families?</Text>
          <Button label="＋ New playdate" size="sm" onPress={() => setCreateFor(contextPlayground.detail as Playground)} />
        </View>
      ) : null}

      {view === 'map' ? (
        <>
          <DiscoverMap items={data.items} selectedId={selected?.id ?? ''} onSelect={setSelectedId} center={data.coords} radiusMiles={data.radiusMiles} placing={data.geocoding} />
          <SelectionCard item={selected} handlers={handlers} filter={data.filter} loading={data.loading || data.todayLoading} />
        </>
      ) : data.items.length ? (
        <View style={styles.list}>
          {data.items.map((item) => (
            <ResultCard key={item.id} item={item} handlers={handlers} />
          ))}
        </View>
      ) : (
        <EmptyResults filter={data.filter} loading={data.loading || data.todayLoading} />
      )}

      <ProviderFooter loading={data.loading || data.refreshing} status={data.providerStatus} onRefresh={data.refresh} />

      <EventDetailSheet
        item={detail && detail.kind !== 'playground' && detail.kind !== 'playdate' ? detail : null}
        saved={detail ? data.isSaved(detail) : false}
        searchLabel={searchLabel}
        onToggleSave={data.toggleSave}
        onClose={() => setDetailId('')}
      />
      <PlaygroundDetailSheet
        item={detail?.kind === 'playground' ? detail : null}
        indoorWeather={weatherIsIndoorDay(data.weather)}
        onNewPlaydate={handlers.onNewPlaydate}
        onClose={() => setDetailId('')}
      />
      <PlaydateFormSheet
        placeName={createFor?.name ?? null}
        ageLabel={childAgeLabel(child)}
        onSubmit={async (form) => {
          if (!createFor) return false;
          const created = await data.createPlaydate(createFor, form);
          // Land on the new playdate so the host can share the invite right away (web: share from the card).
          if (created?.id) setTimeout(() => openPlaydate({ ...created, isHost: true, isJoined: true }), 350);
        }}
        onClose={() => setCreateFor(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: { backgroundColor: Colors.noticeBg, borderWidth: 1, borderColor: Colors.noticeBorder, borderRadius: Radius.md, padding: 12, color: Colors.ink, fontSize: 14, lineHeight: 20 },
  context: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: Colors.contextBg, borderWidth: 1, borderColor: Colors.contextBorder, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  contextText: { flex: 1, color: Colors.contextInk, fontSize: 14, fontWeight: '800' },
  list: { gap: 12 },
});
