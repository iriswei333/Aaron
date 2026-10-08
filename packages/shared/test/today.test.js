import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fallbackPlayOptions, firstName, loadTodayWeather, locationCoords, selectedFamilyPlans, shortLocation, summarizeWeather,
  todayPlanView, todayRecommendation, upcomingTodayPlans, userLocation, weatherIcon, weatherIsIndoorDay, WEATHER_NEEDS_LOCATION, WEATHER_UNAVAILABLE,
} from '../src/today.js';

test('names and locations', () => {
  assert.equal(firstName('Priya Patel'), 'Priya');
  assert.equal(firstName('', 'there'), 'there');
  assert.deepEqual(locationCoords({ latitude: '47.6', longitude: -122.3 }), { latitude: 47.6, longitude: -122.3 });
  assert.equal(locationCoords({ latitude: null, longitude: 1 }), null);
  assert.equal(userLocation(null, 'Greenwood').source, 'child-profile');
  assert.equal(userLocation(null, ''), null);
  assert.equal(shortLocation({ address: 'Greenwood, Seattle, WA, USA' }), 'Greenwood, Seattle');
});

test('weather summary and indoor detection', async () => {
  const sunny = summarizeWeather({ current: { temperature_2m: 61.6, precipitation: 0, wind_speed_10m: 4.2, weather_code: 1 } });
  assert.deepEqual(sunny, { label: 'Outdoor play looks possible', temperature: '62°F', precipitation: '0 mm', wind: '4 mph' });
  const rainy = summarizeWeather({ current: { temperature_2m: 50, precipitation: 0, wind_speed_10m: 9, weather_code: 61 } });
  assert.equal(rainy.label, 'Rainy backup recommended');
  assert.equal(weatherIsIndoorDay(rainy), true);
  assert.equal(weatherIsIndoorDay(sunny), false);
  assert.equal(weatherIcon(rainy), '☔');
  assert.equal(await loadTodayWeather(null), WEATHER_NEEDS_LOCATION);
  assert.equal(await loadTodayWeather({ latitude: 1, longitude: 2 }, async () => { throw new Error('offline'); }), WEATHER_UNAVAILABLE);
  const ok = await loadTodayWeather({ latitude: 1, longitude: 2 }, async (url) => ({ ok: true, json: async () => ({ current: { temperature_2m: 70, precipitation: 0, wind_speed_10m: 1, weather_code: 0, url } }) }));
  assert.equal(ok.temperature, '70°F');
});

test('recommendation picks indoor on rainy days and falls back without options', () => {
  const options = fallbackPlayOptions({ address: 'Greenwood, Seattle' });
  const rainy = todayRecommendation({ weather: { label: 'Rainy backup recommended' }, options, childName: 'Aaron' });
  assert.match(rainy.title, /^Indoor play spaces near Greenwood/);
  assert.equal(rainy.imageKey, 'home');
  const sunny = todayRecommendation({ weather: { label: 'Outdoor play looks possible' }, options, childName: 'Aaron' });
  assert.match(sunny.title, /^Outdoor playgrounds/);
  const none = todayRecommendation({ weather: {}, options: [], childName: 'Aaron' });
  assert.equal(none.title, 'Fresh air and big little discoveries');
  assert.equal(none.description, 'A playground morning made for Aaron’s curious pace.');
  assert.equal(fallbackPlayOptions(null)[0].name, 'Seattle Center Artists at Play');
});

test('plans: future only, soonest first, with views', () => {
  const now = new Date('2026-10-07T12:00:00Z').getTime();
  const plans = upcomingTodayPlans({
    now,
    playDates: [
      { id: 'past', startsAt: '2026-10-01T17:00:00Z', endsAt: '2026-10-01T18:00:00Z', playgroundName: 'Old' },
      { id: 'soon', startsAt: '2026-10-10T17:00:00Z', endsAt: '2026-10-10T18:30:00Z', playgroundName: 'Licton Springs', isHost: true, playgroundKey: 'k1' },
      { id: 'cancel', status: 'cancelled', startsAt: '2026-10-09T17:00:00Z', playgroundName: 'Nope' },
    ],
    familyPlans: [
      { id: 'e1', kind: 'external_event', title: 'Pumpkin patch', dueDate: '2026-10-12', venue: 'Oxbow Farm', metadata: { imageUrl: 'https://img/p.jpg', timeLabel: '10 AM' } },
      { id: 'e0', kind: 'story_time', title: 'Toddler story time', dueDate: '2026-10-08' },
      { id: 'other', kind: 'errand', title: 'Ignore', dueDate: '2026-10-08' },
    ],
    playgrounds: [{ key: 'k1', imageUrl: 'https://img/park.jpg' }],
  });
  assert.deepEqual(plans.map((plan) => plan.id), ['e0', 'soon', 'e1']);
  const story = todayPlanView(plans[0]);
  assert.equal(story.type, 'Story time');
  assert.equal(story.icon, '📖');
  assert.equal(story.imageKey, 'home');
  const playdate = todayPlanView(plans[1]);
  assert.equal(playdate.type, 'Your playdate');
  assert.equal(playdate.image, 'https://img/park.jpg');
  const event = todayPlanView(plans[2]);
  assert.equal(event.image, 'https://img/p.jpg');
  assert.match(event.when, /10 AM$/);
  assert.equal(selectedFamilyPlans([{ kind: 'external_event', title: 'Undated' }]).length, 1);
});
