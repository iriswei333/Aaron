import { childAgeLabel, childDisplayName, getChildProfile } from '@sproutcue/shared/profile-defaults';
import { normalizeFamilyEvent, normalizeStoryTime } from '@sproutcue/shared/discover-normalizers';
import { savedPlanEvent } from '@sproutcue/shared/discover-view';
import { firstName, todayRecommendation, upcomingTodayPlans, weatherIcon } from '@sproutcue/shared/today';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import { EventDetailSheet } from '@/components/discover/event-detail-sheet';
import { AdventureSection } from '@/components/today/adventure-section';
import { FamilyPlansSection } from '@/components/today/family-plans-section';
import { TodayGreeting } from '@/components/today/greeting';
import { IntentTiles } from '@/components/today/intent-tiles';
import { StoryMakerSheet } from '@/components/today/story-maker-sheet';
import { LocationSheet } from '@/components/location/location-sheet';
import { Screen } from '@/components/ui';
import { useAiConsent } from '@/lib/ai-consent';
import { familyPlans } from '@/lib/api';
import type { DiscoverItem } from '@/lib/discover-data';
import type { PlayDate } from '@/lib/family-data';
import { haptics } from '@/lib/haptics';
import { useLocationEditor } from '@/lib/location-editor';
import { rememberPlaydate } from '@/lib/playdates';
import { useSession } from '@/lib/session';
import { useTodayData, type FamilyPlan } from '@/lib/today-data';

// Mirrors the web Today tab (apps/web/src/tabs/home.js):
// greeting + weather → your family's plans, or the next little adventure → three intent shortcuts.
export default function TodayScreen() {
  const { user } = useSession();
  const today = useTodayData();
  const [storyOpen, setStoryOpen] = useState(false);
  const consent = useAiConsent();
  // The playground story is written by OpenAI: ask for AI consent before opening the story maker.
  const openStory = async () => {
    if (await consent.requestConsent()) setStoryOpen(true);
  };
  const [locationOpen, setLocationOpen] = useState(false);
  const locationEditor = useLocationEditor();

  const child = getChildProfile(user);
  const childName = childDisplayName(child);
  const parent = firstName(user?.displayName, 'there');
  const locationLabel = user?.location?.address || user?.location?.label || 'Set your neighborhood';
  const plans = useMemo(
    () => upcomingTodayPlans({ playDates: today.playDates, familyPlans: today.plans, playgrounds: today.options }),
    [today.playDates, today.plans, today.options],
  );
  const recommendation = todayRecommendation({ weather: today.weather, options: today.options, childName });
  const goDiscover = () => router.push('/discover');

  // "View plan": a playdate opens its own page; a saved family event / story time opens its
  // event detail right here (the same detail Discover shows), not the Discover tab.
  const [openPlan, setOpenPlan] = useState<{ plan: FamilyPlan; item: DiscoverItem; saved: boolean } | null>(null);
  const viewPlan = (plan: any) => {
    if (!plan) return goDiscover();
    if (plan.homeKind === 'playdate') {
      rememberPlaydate(plan as PlayDate);
      router.push({ pathname: '/playdate/details', params: { playDateId: plan.id } });
      return;
    }
    const event = savedPlanEvent(plan);
    const item = (plan.kind === 'story_time' ? normalizeStoryTime(event) : normalizeFamilyEvent(event)) as DiscoverItem;
    setOpenPlan({ plan, item, saved: true });
  };
  // Saved ↔ unsaved from the detail: remove the saved plan, or save it back.
  const togglePlanSaved = async () => {
    if (!openPlan) return;
    const { plan, saved } = openPlan;
    try {
      if (saved) {
        await familyPlans.removeFamilyPlan(plan.id);
        setOpenPlan({ ...openPlan, saved: false });
      } else {
        const { id, userId, createdAt, updatedAt, homeKind, date, dateLabel, timeLabel, imageUrl, ...payload } = plan;
        const response: any = await familyPlans.saveFamilyPlan(payload);
        setOpenPlan({ ...openPlan, plan: response?.item ?? plan, saved: true });
        haptics.success();
      }
      today.refresh();
    } catch {
      haptics.error();
    }
  };

  return (
    <Screen refreshing={today.refreshing} onRefresh={today.refresh}>
      <TodayGreeting
        locationLabel={locationLabel}
        childName={childName}
        parentName={parent}
        weather={today.weather}
        weatherIcon={weatherIcon(today.weather)}
        onLocationPress={() => setLocationOpen(true)}
      />
      {plans.length ? (
        <FamilyPlansSection plans={plans} childName={childName} onOpenPlans={goDiscover} onOpenPlan={viewPlan} onOpenStory={openStory} />
      ) : (
        <AdventureSection recommendation={recommendation} childName={childName} onExplore={goDiscover} onOpenStory={openStory} />
      )}
      <IntentTiles
        intents={[
          { key: 'go', icon: '☀', label: 'Go somewhere', detail: 'Places and events nearby', onPress: goDiscover },
          { key: 'meet', icon: '☺', label: 'Meet playmates', detail: 'Find a nearby playdate', onPress: goDiscover },
          { key: 'home', icon: '✦', label: 'Play at home', detail: 'Make something together', onPress: () => router.push('/studio') },
        ]}
      />
      <LocationSheet
        visible={locationOpen}
        currentLabel={locationLabel}
        initialAddress={user?.location?.address || ''}
        status={locationEditor.status}
        locating={locationEditor.locating}
        onLocate={locationEditor.locateMe}
        onSubmit={locationEditor.searchAddress}
        onClose={() => {
          setLocationOpen(false);
          locationEditor.setStatus('');
        }}
      />
      <EventDetailSheet
        item={openPlan?.item ?? null}
        saved={Boolean(openPlan?.saved)}
        searchLabel={locationLabel}
        onToggleSave={togglePlanSaved}
        onClose={() => setOpenPlan(null)}
      />
      <StoryMakerSheet visible={storyOpen} childName={childName} ageLabel={childAgeLabel(child)} onClose={() => setStoryOpen(false)} />
    </Screen>
  );
}
