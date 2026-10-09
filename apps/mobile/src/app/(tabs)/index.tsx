import { childAgeLabel, childDisplayName, getChildProfile } from '@sproutcue/shared/profile-defaults';
import { firstName, todayRecommendation, upcomingTodayPlans, weatherIcon } from '@sproutcue/shared/today';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import { AdventureSection } from '@/components/today/adventure-section';
import { FamilyPlansSection } from '@/components/today/family-plans-section';
import { TodayGreeting } from '@/components/today/greeting';
import { IntentTiles } from '@/components/today/intent-tiles';
import { StoryMakerSheet } from '@/components/today/story-maker-sheet';
import { LocationSheet } from '@/components/location/location-sheet';
import { Screen } from '@/components/ui';
import { useLocationEditor } from '@/lib/location-editor';
import { useSession } from '@/lib/session';
import { useTodayData } from '@/lib/today-data';

// Mirrors the web Today tab (apps/web/src/tabs/home.js):
// greeting + weather → your family's plans, or the next little adventure → three intent shortcuts.
export default function TodayScreen() {
  const { user } = useSession();
  const today = useTodayData();
  const [storyOpen, setStoryOpen] = useState(false);
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
        <FamilyPlansSection plans={plans} childName={childName} onOpenPlans={goDiscover} onOpenStory={() => setStoryOpen(true)} />
      ) : (
        <AdventureSection recommendation={recommendation} childName={childName} onExplore={goDiscover} onOpenStory={() => setStoryOpen(true)} />
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
      <StoryMakerSheet visible={storyOpen} childName={childName} ageLabel={childAgeLabel(child)} onClose={() => setStoryOpen(false)} />
    </Screen>
  );
}
