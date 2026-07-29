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
  const indoorish = tags.indoor === 'yes'
    || tags.amenity === 'library'
    || tags.tourism === 'museum'
    || /indoor|kids|children|museum|library|gym|play/i.test(name) && tags.leisure !== 'park';
  if (indoorish) {
    if (tags.amenity === 'library') return 'Indoor library';
    if (tags.tourism === 'museum') return 'Indoor museum';
    return 'Indoor play';
  }
  if (tags.leisure === 'park') return 'Outdoor park';
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
  return `nearby-${Number(latitude).toFixed(3)}-${Number(longitude).toFixed(3)}`;
}

export async function fetchNearbyPlaygrounds({ latitude, longitude }) {
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'content-type': 'text/plain;charset=UTF-8' },
    body: overpassQuery(latitude, longitude),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error('Nearby place lookup failed.');
  const data = await response.json();
  const origin = { latitude, longitude };
  const seen = new Set();
  return (data.elements || [])
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
        imageUrl: imageUrlFromTags(element.tags) || fallbackImageUrl(type),
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
}
