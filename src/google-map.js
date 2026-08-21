let mapsApiPromise;
let activeMapElement;
let activeMap;
let activeMarkers = [];
let activeMapRadiusMeters = 0;
let activeRadiusCircle;

const browserMapsKey = String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim();

export function hasGoogleMapsKey() {
  return Boolean(browserMapsKey);
}

async function loadGoogleMaps() {
  if (globalThis.google?.maps?.importLibrary) return globalThis.google.maps;
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
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(browserMapsKey)}&v=weekly&loading=async`;
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
  activeMarkers.forEach((marker) => { marker.map = null; });
  activeMarkers = [];
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
        zoom: 13,
        mapId: 'DEMO_MAP_ID',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      });
      activeMapElement = element;
    }
    const radiusChanged = activeMapRadiusMeters !== radiusMeters;
    if (!activeRadiusCircle) {
      activeRadiusCircle = new maps.Circle({
        map: activeMap,
        center,
        radius: radiusMeters,
        strokeColor: '#3b82f6',
        strokeOpacity: 0.72,
        strokeWeight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
      });
    } else {
      activeRadiusCircle.setCenter(center);
      activeRadiusCircle.setRadius(radiusMeters);
    }
    if (radiusChanged || isNewMap) {
      const bounds = activeRadiusCircle.getBounds();
      if (bounds) activeMap.fitBounds(bounds, 24);
    } else {
      activeMap.setCenter(center);
    }
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
        content: markerContent(`google-map-playground-pin${playground.key === selectedPlaygroundKey ? ' selected' : ''}`, String(index + 1)),
      });
      marker.addListener('click', () => onPlaygroundSelect?.(playground.key));
      activeMarkers.push(marker);
    });
    playdates.slice(0, 20).forEach((playdate) => {
      const position = coordinates({ latitude: playdate.playgroundLatitude, longitude: playdate.playgroundLongitude });
      if (!position) return;
      const count = Number(playdate.participantCount) || 0;
      const startsAt = new Date(playdate.startsAt);
      const time = Number.isNaN(startsAt.getTime()) ? 'Time set' : startsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const marker = new AdvancedMarkerElement({
        map: activeMap,
        position,
        title: `${playdate.playgroundName || 'Playdate'} · ${time}`,
        content: markerContent('google-map-playdate-pill', `${time} · ${count} ${count === 1 ? 'family' : 'families'}`),
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
