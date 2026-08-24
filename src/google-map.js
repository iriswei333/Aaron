let mapsApiPromise;
let activeMapElement;
let activeMap;
let activeMarkers = [];
let activeMapRadiusMeters = 0;
let activeRadiusCircle;

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
