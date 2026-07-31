const PLAYGROUND_RADIUS_METERS = 4500;

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanText(value, maxLength = 180) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function slugify(value) {
  return cleanText(value, 180)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

function playgroundKey(name, coords, sourceId = '') {
  const coordPart = coords ? `${Number(coords.latitude).toFixed(4)}-${Number(coords.longitude).toFixed(4)}` : '';
  return slugify([sourceId, name, coordPart].filter(Boolean).join(' ')) || slugify(name);
}

function distanceMiles(origin, destination) {
  const earthRadiusMiles = 3958.8;
  const radians = (degrees) => degrees * (Math.PI / 180);
  const dLat = radians(destination.latitude - origin.latitude);
  const dLon = radians(destination.longitude - origin.longitude);
  const lat1 = radians(origin.latitude);
  const lat2 = radians(destination.latitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(miles) {
  if (!Number.isFinite(miles)) return 'Nearby';
  if (miles < 0.1) return '<0.1 mi';
  return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

function playOptionType(tags = {}) {
  const name = tags.name || '';
  if (tags.leisure === 'playground') return 'Outdoor playground';
  if (tags.leisure === 'park') return 'Outdoor park';
  const indoorish = tags.indoor === 'yes'
    || tags.amenity === 'library'
    || tags.tourism === 'museum'
    || /indoor|museum|library|gym/i.test(name);
  if (indoorish) {
    if (tags.amenity === 'library') return 'Indoor library';
    if (tags.tourism === 'museum') return 'Indoor museum';
    return 'Indoor play';
  }
  return 'Outdoor playground';
}

function playOptionBest(type) {
  if (type === 'Indoor library') return 'books, story time, and a quiet weather backup';
  if (type === 'Indoor museum') return 'hands-on exhibits and rainy-day exploration';
  if (type.includes('Indoor')) return 'big-energy play when outside is wet or cold';
  if (type === 'Outdoor park') return 'open space, stroller loops, and snack breaks';
  return 'slides, climbing, and toddler gross-motor play';
}

function playOptionWeather(type) {
  if (type.includes('Indoor')) return 'rain, wind, cold';
  if (type === 'Outdoor park') return 'dry afternoons';
  return 'dry or light drizzle';
}

function playgroundOverview(type, name = '') {
  if (type === 'Outdoor playground') return `${name} is an outdoor playground for climbing, sliding, and toddler gross-motor play.`;
  if (type === 'Outdoor park') return `${name} offers open space, stroller-friendly paths, and room for a relaxed family break.`;
  if (type === 'Indoor library') return `${name} is a quieter indoor option for books, story time, and a weather backup.`;
  if (type === 'Indoor museum') return `${name} offers hands-on exhibits and indoor exploration for curious young visitors.`;
  return `${name} is an indoor play option for movement and pretend play when outdoor weather is not ideal.`;
}

function playgroundHighlights(type) {
  if (type === 'Outdoor playground') return ['Climbing and slides', 'Outdoor play', 'Toddler movement'];
  if (type === 'Outdoor park') return ['Open space', 'Stroller-friendly', 'Snack break'];
  if (type === 'Indoor library') return ['Books and stories', 'Quiet backup', 'Indoor'];
  if (type === 'Indoor museum') return ['Hands-on exhibits', 'Indoor exploration', 'Family-friendly'];
  return ['Indoor movement', 'Pretend play', 'Rainy-day backup'];
}

function imageUrlFromTags(tags = {}) {
  const directImage = cleanText(tags.image, 500);
  if (directImage) return directImage;
  const commonsFile = cleanText(tags.wikimedia_commons, 300);
  if (!commonsFile) return '';
  const file = commonsFile.replace(/^File:/i, '');
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=640`;
}

function fallbackImageUrl(type) {
  return type.includes('Indoor')
    ? 'https://images.unsplash.com/photo-1560185008-b033106af5c3?auto=format&fit=crop&w=480&q=80'
    : 'https://images.unsplash.com/photo-1596464716127-f2a82984de30?auto=format&fit=crop&w=480&q=80';
}

function googlePlayOptionType(place = {}) {
  const types = new Set([place.primaryType, ...(place.types || [])].filter(Boolean));
  if (types.has('playground')) return 'Outdoor playground';
  if (types.has('park')) return 'Outdoor park';
  if (types.has('library')) return 'Indoor library';
  if (types.has('museum')) return 'Indoor museum';
  if (types.has('childrens_amusement_center') || types.has('amusement_center')) return 'Indoor play';
  return /indoor|play/i.test(place.displayName?.text || '') ? 'Indoor play' : 'Outdoor playground';
}

async function googlePhotoUri(photoName, apiKey) {
  if (!photoName) return '';
  try {
    const url = new URL(`https://places.googleapis.com/v1/${photoName}/media`);
    url.searchParams.set('maxWidthPx', '640');
    url.searchParams.set('maxHeightPx', '480');
    url.searchParams.set('skipHttpRedirect', 'true');
    url.searchParams.set('key', apiKey);
    const response = await fetch(url.toString(), { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return '';
    const data = await response.json();
    return data.photoUri || '';
  } catch {
    return '';
  }
}

async function fetchGoogleNearbyPlaygrounds({ latitude, longitude }) {
  const apiKey = String(process.env.GOOGLE_PLACES_API_KEY || '').trim();
  if (!apiKey) return null;
  const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
      'x-goog-fieldmask': 'places.id,places.displayName,places.editorialSummary,places.formattedAddress,places.location,places.types,places.primaryType,places.googleMapsUri,places.photos',
    },
    body: JSON.stringify({
      includedTypes: ['playground', 'park'],
      maxResultCount: 20,
      rankPreference: 'DISTANCE',
      locationRestriction: {
        circle: { center: { latitude, longitude }, radius: PLAYGROUND_RADIUS_METERS },
      },
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const error = new Error(`Google Places returned HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  const origin = { latitude, longitude };
  const seen = new Set();
  const places = (data.places || [])
    .map((place) => {
      const placeLatitude = toNumber(place.location?.latitude);
      const placeLongitude = toNumber(place.location?.longitude);
      const name = cleanText(place.displayName?.text, 140);
      if (!name || placeLatitude === null || placeLongitude === null) return null;
      const key = name.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      const type = googlePlayOptionType(place);
      const miles = distanceMiles(origin, { latitude: placeLatitude, longitude: placeLongitude });
      return {
        key: `google-${cleanText(place.id, 180) || slugify(name)}`,
        name,
        type,
        distance: formatDistance(miles),
        sortDistance: miles,
        latitude: placeLatitude,
        longitude: placeLongitude,
        address: cleanText(place.formattedAddress, 180),
        overview: cleanText(place.editorialSummary?.text, 320) || playgroundOverview(type, name),
        highlights: playgroundHighlights(type),
        imageUrl: '',
        photoAttributions: place.photos?.[0]?.authorAttributions || [],
        best: playOptionBest(type),
        weather: playOptionWeather(type),
        preference: type.includes('Indoor') ? 'indoor' : 'outdoor',
        href: place.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(place.id || '')}`,
        source: 'google-places',
        photoName: place.photos?.[0]?.name || '',
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortDistance - b.sortDistance)
    .slice(0, 12);
  const withPhotos = await Promise.all(places.map(async (place) => ({
    ...place,
    imageUrl: await googlePhotoUri(place.photoName, apiKey) || fallbackImageUrl(place.type),
  })));
  return withPhotos.map(({ photoName, ...place }) => place);
}

async function wikimediaThumbnail(name) {
  try {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');
    url.searchParams.set('generator', 'search');
    url.searchParams.set('gsrsearch', `${name} playground`);
    url.searchParams.set('gsrnamespace', '6');
    url.searchParams.set('gsrlimit', '1');
    url.searchParams.set('prop', 'imageinfo');
    url.searchParams.set('iiprop', 'url');
    url.searchParams.set('iiurlwidth', '640');
    const response = await fetch(url.toString(), { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return '';
    const data = await response.json();
    return Object.values(data.query?.pages || {})[0]?.imageinfo?.[0]?.thumburl || '';
  } catch {
    return '';
  }
}

function overpassQuery(latitude, longitude) {
  const selectors = [
    '["leisure"="playground"]',
    '["leisure"="park"]',
    '["amenity"="library"]',
    '["tourism"="museum"]',
  ];
  const clauses = selectors.flatMap((selector) => [
    `node${selector}(around:${PLAYGROUND_RADIUS_METERS},${latitude},${longitude});`,
    `way${selector}(around:${PLAYGROUND_RADIUS_METERS},${latitude},${longitude});`,
    `relation${selector}(around:${PLAYGROUND_RADIUS_METERS},${latitude},${longitude});`,
  ]).join('\n');
  return `[out:json][timeout:12];(${clauses});out center tags 40;`;
}

export function playgroundCacheKey({ latitude, longitude }) {
  return `nearby-v4-${Number(latitude).toFixed(3)}-${Number(longitude).toFixed(3)}`;
}

async function fetchNearbyPlaygroundsFromOverpass({ latitude, longitude }) {
  const query = overpassQuery(latitude, longitude);
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  let lastStatus = 502;
  for (const endpoint of endpoints) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'user-agent': 'SproutCue nearby playgrounds/1.0',
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: AbortSignal.timeout(12000),
    });
    if (response.ok) {
      const data = await response.json();
      return normalizePlaygroundResults(data, { latitude, longitude });
    }
    lastStatus = response.status;
  }
  const error = new Error(`Nearby place lookup failed: Overpass returned HTTP ${lastStatus}.`);
  error.status = 502;
  throw error;
}

async function enrichPlaygroundImages(playgrounds) {
  const imageCandidates = playgrounds.filter((place) => !place.imageUrl).slice(0, 8);
  const imageResults = await Promise.all(imageCandidates.map(async (place) => [place.key, await wikimediaThumbnail(place.name)]));
  const imageByKey = new Map(imageResults.filter(([, imageUrl]) => imageUrl));
  return playgrounds.map((place) => ({
    ...place,
    imageUrl: place.imageUrl || imageByKey.get(place.key) || fallbackImageUrl(place.type),
  }));
}

async function normalizePlaygroundResults(data, coords) {
  const origin = coords;
  const seen = new Set();
  const playgrounds = (data.elements || [])
    .map((element) => {
      const placeLatitude = toNumber(element.lat ?? element.center?.lat);
      const placeLongitude = toNumber(element.lon ?? element.center?.lon);
      const name = cleanText(element.tags?.name, 140);
      if (!name || placeLatitude === null || placeLongitude === null || element.tags?.access === 'private') return null;
      const nameKey = name.toLowerCase();
      if (seen.has(nameKey)) return null;
      seen.add(nameKey);
      const type = playOptionType(element.tags);
      const miles = distanceMiles(origin, { latitude: placeLatitude, longitude: placeLongitude });
      return {
        key: playgroundKey(name, { latitude: placeLatitude, longitude: placeLongitude }, element.id ? `osm-${element.type}-${element.id}` : ''),
        name,
        type,
        distance: formatDistance(miles),
        sortDistance: miles,
        latitude: placeLatitude,
        longitude: placeLongitude,
        address: cleanText(element.tags?.['addr:full'] || element.tags?.['addr:street'], 180),
        overview: playgroundOverview(type, name),
        highlights: playgroundHighlights(type),
        imageUrl: imageUrlFromTags(element.tags),
        best: playOptionBest(type),
        weather: playOptionWeather(type),
        preference: type.includes('Indoor') ? 'indoor' : 'outdoor',
        href: `https://www.google.com/maps/search/${encodeURIComponent(name)}/@${placeLatitude},${placeLongitude},14z`,
        source: 'nearby',
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortDistance - b.sortDistance)
    .slice(0, 12);

  return enrichPlaygroundImages(playgrounds);
}

export async function fetchNearbyPlaygrounds(coords) {
  if (process.env.GOOGLE_PLACES_API_KEY) {
    try {
      const googleResults = await fetchGoogleNearbyPlaygrounds(coords);
      if (googleResults) return googleResults;
    } catch {
      // Keep nearby play available when Google Places is disabled or unavailable.
    }
  }
  return fetchNearbyPlaygroundsFromOverpass(coords);
}
