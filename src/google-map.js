import { apiRequest } from './shared.js';

let mapsApiPromise;
let activeMapElement;
let activeMap;
let activeMarkers = [];
let activeMapRadiusMeters = 0;
let activeRadiusCircle;
let activeDiscoverRenderToken = 0;

const discoverGeocodeCache = new Map();

const browserMapsKey = String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim();

const sproutMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#f7f1e8' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5c6b60' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#fffdf8' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#e7e0d2' }] },
  { featureType: 'landscape.natural', elementType: 'geometry.fill', stylers: [{ color: '#e4efe6' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#edf3e9' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#d9eadb' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#2f6b4e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#fffdf8' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e7e0d2' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#fdf3dc' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f6d58b' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#e8dfcf' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#cfe5ec' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a8fa8' }] },
];

export function hasGoogleMapsKey() {
  return Boolean(browserMapsKey);
}

async function loadGoogleMaps() {
  if (globalThis.google?.maps?.Map || globalThis.google?.maps?.importLibrary) return globalThis.google.maps;
  if (!mapsApiPromise) {
    mapsApiPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-google-maps-js]');
      if (existing) {
        existing.addEventListener('load', () => resolve(globalThis.google.maps), { once: true });
        existing.addEventListener('error', () => reject(new Error('Google Maps JavaScript API failed to load.')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.async = true;
      script.defer = true;
      script.dataset.googleMapsJs = 'true';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(browserMapsKey)}&v=weekly&loading=async&libraries=marker`;
      script.onload = () => resolve(globalThis.google.maps);
      script.onerror = () => reject(new Error('Google Maps JavaScript API failed to load.'));
      document.head.appendChild(script);
    });
  }
  return mapsApiPromise;
}

function markerContent(className, text = '') {
  const element = document.createElement('div');
  element.className = className;
  element.textContent = text;
  return element;
}

function coordinates(place) {
  const latitude = Number(place?.latitude);
  const longitude = Number(place?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { lat: latitude, lng: longitude };
}

function clearMarkers() {
  activeMarkers.forEach((marker) => {
    if ('map' in marker) marker.map = null;
    else marker.setMap?.(null);
  });
  activeMarkers = [];
}

function discoverCoordinates(item) {
  const latitude = Number(item?.location?.latitude);
  const longitude = Number(item?.location?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) return null;
  return { lat: latitude, lng: longitude };
}

function distanceInMeters(origin, destination) {
  const toRadians = (degrees) => degrees * (Math.PI / 180);
  const latitudeDelta = toRadians(destination.lat - origin.lat);
  const longitudeDelta = toRadians(destination.lng - origin.lng);
  const originLatitude = toRadians(origin.lat);
  const destinationLatitude = toRadians(destination.lat);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function discoverMarkerLabel(kind) {
  if (kind === 'playground') return '🛝';
  if (kind === 'playdate') return '☺';
  if (kind === 'weekend_event') return '🎟';
  return '▤';
}

function discoverGeocodeQuery(item, searchLocationLabel = '') {
  if (!['weekend_event', 'story_time'].includes(item?.kind)) return '';
  const place = String(item?.location?.address || item?.location?.venue || '').trim();
  if (!place) return '';
  const searchArea = String(searchLocationLabel || '').trim();
  if (!searchArea || place.toLocaleLowerCase().includes(searchArea.toLocaleLowerCase())) return place;
  return `${place}, ${searchArea}`;
}

function geocodeDiscoverItem({ maps, geocoder, item, searchLocationLabel }) {
  const knownPosition = discoverCoordinates(item);
  if (knownPosition) return Promise.resolve(knownPosition);
  const query = discoverGeocodeQuery(item, searchLocationLabel);
  if (!query || !geocoder) return Promise.resolve(null);

  const cacheKey = query.toLocaleLowerCase();
  if (discoverGeocodeCache.has(cacheKey)) return discoverGeocodeCache.get(cacheKey);

  const request = new Promise((resolve) => {
    geocoder.geocode({ address: query }, (results, status) => {
      const location = results?.[0]?.geometry?.location;
      if (status === maps.GeocoderStatus?.OK || status === 'OK') {
        resolve(location ? { lat: location.lat(), lng: location.lng() } : null);
        return;
      }
      if (!['ZERO_RESULTS', 'INVALID_REQUEST'].includes(status)) discoverGeocodeCache.delete(cacheKey);
      resolve(null);
    });
  });
  discoverGeocodeCache.set(cacheKey, request);
  return request;
}

async function loadServerDiscoverLocations(items, searchLocationLabel, center, radiusMeters) {
  const candidates = items.map((item) => ({
    item,
    query: discoverGeocodeQuery(item, searchLocationLabel),
  })).filter(({ item, query }) => query && !discoverCoordinates(item));
  const uncached = candidates.filter(({ query }) => !discoverGeocodeCache.has(query.toLocaleLowerCase()));
  if (!uncached.length) return;
  try {
    const payload = await apiRequest('/discover-locations', {
      method: 'POST',
      body: JSON.stringify({
        items: uncached.map(({ item, query }) => ({ id: item.id, query })),
        center,
        radiusMeters,
      }),
    });
    const byId = new Map((payload.locations || []).map((location) => [location.id, location]));
    uncached.forEach(({ item, query }) => {
      const location = byId.get(item.id);
      if (!location) return;
      discoverGeocodeCache.set(query.toLocaleLowerCase(), Promise.resolve({
        lat: Number(location.latitude),
        lng: Number(location.longitude),
      }));
    });
  } catch {
    // The browser geocoder below remains available when server-side Places lookup fails.
  }
}

function createMapMarker({ maps, AdvancedMarkerElement, map, position, title, content, label, onClick }) {
  if (AdvancedMarkerElement) {
    const marker = new AdvancedMarkerElement({ map, position, title, content, gmpClickable: true });
    if (marker.addEventListener) marker.addEventListener('gmp-click', onClick);
    else marker.addListener?.('click', onClick);
    return marker;
  }
  const marker = new maps.Marker({ map, position, title, label });
  marker.addListener('click', onClick);
  return marker;
}

export async function renderGoogleDiscoverMap({ element, center, radiusMeters = 4828, items = [], selectedId = '', searchLocationLabel = '', onItemSelect }) {
  if (!element || !hasGoogleMapsKey() || !center) return false;
  const renderToken = ++activeDiscoverRenderToken;
  try {
    const maps = await loadGoogleMaps();
    let MapConstructor = maps.Map;
    let AdvancedMarkerElement = maps.marker?.AdvancedMarkerElement || null;
    let GeocoderConstructor = maps.Geocoder || null;
    if (maps.importLibrary) {
      const [mapsLibrary, markerLibrary, geocodingLibrary] = await Promise.all([
        maps.importLibrary('maps'),
        maps.importLibrary('marker').catch(() => ({})),
        maps.importLibrary('geocoding').catch(() => ({})),
      ]);
      MapConstructor = mapsLibrary.Map || MapConstructor;
      AdvancedMarkerElement = markerLibrary.AdvancedMarkerElement || AdvancedMarkerElement;
      GeocoderConstructor = geocodingLibrary.Geocoder || GeocoderConstructor;
    }
    if (!MapConstructor) return false;
    const isNewMap = activeMapElement !== element;
    if (isNewMap) {
      activeRadiusCircle?.setMap(null);
      activeRadiusCircle = null;
      activeMap = new MapConstructor(element, {
        center,
        zoom: 13,
        mapId: 'DEMO_MAP_ID',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      });
      activeMapElement = element;
    }
    if (!activeRadiusCircle) {
      activeRadiusCircle = new maps.Circle({
        map: activeMap,
        center,
        radius: radiusMeters,
        strokeColor: '#e86f3d',
        strokeOpacity: 0.68,
        strokeWeight: 2,
        fillColor: '#f7c7a5',
        fillOpacity: 0.12,
      });
    } else {
      activeRadiusCircle.setCenter(center);
      activeRadiusCircle.setRadius(radiusMeters);
    }
    activeMap.setCenter(center);
    activeMapRadiusMeters = radiusMeters;
    clearMarkers();
    activeMarkers.push(createMapMarker({
      maps,
      AdvancedMarkerElement,
      map: activeMap,
      position: center,
      title: 'Your family location',
      content: markerContent('google-map-user-pin', 'You'),
      label: 'You',
      onClick: () => {},
    }));

    await loadServerDiscoverLocations(items.slice(0, 40), searchLocationLabel, center, radiusMeters);
    if (renderToken !== activeDiscoverRenderToken || activeMapElement !== element) return true;
    const geocoder = GeocoderConstructor ? new GeocoderConstructor() : null;
    const locatedItems = await Promise.allSettled(items.slice(0, 40).map(async (item) => ({
      item,
      position: await geocodeDiscoverItem({ maps, geocoder, item, searchLocationLabel }),
    })));
    if (renderToken !== activeDiscoverRenderToken || activeMapElement !== element) return true;

    const visibleBounds = maps.LatLngBounds ? new maps.LatLngBounds() : null;
    visibleBounds?.extend(center);
    let locatedItemCount = 0;
    locatedItems.forEach((result) => {
      if (result.status !== 'fulfilled') return;
      const { item, position } = result.value;
      if (!position) return;
      const maximumEventDistance = Math.max(radiusMeters * 4, 50000);
      if (['weekend_event', 'story_time'].includes(item.kind)
        && distanceInMeters(center, position) > maximumEventDistance) return;
      locatedItemCount += 1;
      visibleBounds?.extend(position);
      const kindClass = String(item.kind || 'place').replace(/_/g, '-');
      const selectedClass = item.id === selectedId ? ' selected' : '';
      const label = discoverMarkerLabel(item.kind);
      const marker = createMapMarker({
        maps,
        AdvancedMarkerElement,
        map: activeMap,
        position,
        title: item.title,
        content: markerContent(`google-map-discover-pin kind-${kindClass}${selectedClass}`, label),
        label,
        onClick: () => onItemSelect?.(item),
      });
      activeMarkers.push(marker);
    });
    if (visibleBounds && locatedItemCount > 0) activeMap.fitBounds(visibleBounds, 56);
    return true;
  } catch (error) {
    console.warn(error);
    return false;
  }
}

function groupPlaydatesByPlayground(playdates) {
  const groups = new Map();
  playdates.forEach((playdate) => {
    const coordinateKey = `${playdate.playgroundLatitude || ''}|${playdate.playgroundLongitude || ''}`;
    const key = playdate.playgroundKey || coordinateKey || playdate.playgroundName || playdate.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(playdate);
  });
  return [...groups.values()];
}

export async function renderGooglePlayMap({ element, center, radiusMeters = 4828, playgrounds = [], playdates = [], selectedPlaygroundKey = '', onPlaygroundSelect, onPlaydateSelect }) {
  if (!element || !hasGoogleMapsKey() || !center) return false;
  try {
    const maps = await loadGoogleMaps();
    const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
      maps.importLibrary('maps'),
      maps.importLibrary('marker'),
    ]);
    const isNewMap = activeMapElement !== element;
    if (isNewMap) {
      activeRadiusCircle?.setMap(null);
      activeRadiusCircle = null;
      activeMap = new Map(element, {
        center,
        zoom: 16,
        mapId: 'DEMO_MAP_ID',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        styles: sproutMapStyles,
      });
      activeMapElement = element;
    }
    if (!activeRadiusCircle) {
      activeRadiusCircle = new maps.Circle({
        map: activeMap,
        center,
        radius: radiusMeters,
        strokeColor: '#2f6b4e',
        strokeOpacity: 0.62,
        strokeWeight: 2,
        fillColor: '#cfe5ec',
        fillOpacity: 0.22,
      });
    } else {
      activeRadiusCircle.setCenter(center);
      activeRadiusCircle.setRadius(radiusMeters);
    }
    activeMap.setCenter(center);
    activeMapRadiusMeters = radiusMeters;
    clearMarkers();
    const userMarker = new AdvancedMarkerElement({
      map: activeMap,
      position: center,
      title: 'Your family location',
      content: markerContent('google-map-user-pin', 'You'),
    });
    activeMarkers.push(userMarker);
    playgrounds.slice(0, 20).forEach((playground, index) => {
      const position = coordinates(playground);
      if (!position) return;
      const marker = new AdvancedMarkerElement({
        map: activeMap,
        position,
        title: playground.name,
        content: markerContent(`google-map-playground-pin${playground.preference === 'indoor' ? ' indoor-backup-pin' : ''}${playground.key === selectedPlaygroundKey ? ' selected' : ''}`, String(index + 1)),
      });
      marker.addListener('click', () => onPlaygroundSelect?.(playground.key));
      activeMarkers.push(marker);
    });
    groupPlaydatesByPlayground(playdates).slice(0, 20).forEach((playdateGroup) => {
      const playdate = playdateGroup[0];
      const position = coordinates({ latitude: playdate.playgroundLatitude, longitude: playdate.playgroundLongitude });
      if (!position) return;
      const playdateCount = playdateGroup.length;
      const label = playdateCount > 1
        ? `${playdateCount} playdates`
        : (() => {
          const count = Number(playdate.participantCount) || 0;
          const startsAt = new Date(playdate.startsAt);
          const time = Number.isNaN(startsAt.getTime()) ? 'Time set' : startsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          return `${time} · ${count} ${count === 1 ? 'family' : 'families'}`;
        })();
      const marker = new AdvancedMarkerElement({
        map: activeMap,
        position,
        title: `${playdate.playgroundName || 'Playdate'} · ${label}`,
        content: markerContent(`google-map-playdate-pill${playdateCount > 1 ? ' clustered' : ''}`, label),
      });
      marker.addListener('click', () => onPlaydateSelect?.(playdate));
      activeMarkers.push(marker);
    });
    return true;
  } catch (error) {
    console.warn(error);
    return false;
  }
}
