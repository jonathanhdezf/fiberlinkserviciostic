// ==========================================
// FIBERLINK GEOCODING API v4 SERVER PROXY
// Avoids browser CORS & legacy JS Geocoder billing errors
// ==========================================

const ATTRIBUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';
const GEOCODE_V4_BASE = 'https://geocode.googleapis.com/v4/geocode';

let envLoaded = false;

function ensureMapsEnv() {
  if (envLoaded) return;
  envLoaded = true;
  try {
    if (
      !process.env.VITE_GOOGLE_MAPS_API_KEY &&
      !process.env.GOOGLE_MAPS_API_KEY &&
      typeof process.loadEnvFile === 'function'
    ) {
      process.loadEnvFile('.env');
    }
  } catch (_) {
    // .env opcional
  }
}

function getServerMapsApiKey() {
  ensureMapsEnv();
  return String(
    process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ''
  ).trim();
}

function sanitizeAddress(val) {
  return String(val || '').replace(/\s+/g, ' ').trim().slice(0, 260);
}

export async function handleGeocodeProxy(searchParams) {
  const apiKey = getServerMapsApiKey();
  if (!apiKey) {
    return {
      status: 200,
      data: { unavailable: true, reason: 'NO_SERVER_KEY' }
    };
  }

  const address = String(searchParams.get('address') || '').trim();
  const latRaw = searchParams.get('lat');
  const lngRaw = searchParams.get('lng');

  let targetUrl = '';

  if (latRaw !== null && lngRaw !== null && latRaw !== '' && lngRaw !== '') {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return { status: 400, data: { error: 'Coordenadas inválidas' } };
    }
    const url = new URL(`${GEOCODE_V4_BASE}/location`);
    url.searchParams.set('location.latitude', String(lat));
    url.searchParams.set('location.longitude', String(lng));
    url.searchParams.set('languageCode', 'es');
    url.searchParams.set('regionCode', 'MX');
    targetUrl = url.toString();
  } else if (address) {
    if (address.length > 300) {
      return { status: 400, data: { error: 'Dirección demasiado larga' } };
    }
    const url = new URL(`${GEOCODE_V4_BASE}/address/${encodeURIComponent(address)}`);
    url.searchParams.set('languageCode', 'es');
    url.searchParams.set('regionCode', 'MX');
    url.searchParams.set('locationBias.rectangle.low.latitude', '19.77');
    url.searchParams.set('locationBias.rectangle.low.longitude', '-97.41');
    url.searchParams.set('locationBias.rectangle.high.latitude', '19.865');
    url.searchParams.set('locationBias.rectangle.high.longitude', '-97.31');
    targetUrl = url.toString();
  } else {
    return { status: 400, data: { error: 'Parámetros requeridos: address o lat/lng' } };
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'results.placeId,results.formattedAddress,results.location',
        'X-Goog-Maps-Solution-ID': ATTRIBUTION_ID
      }
    });

    const payload = await response.json().catch(() => ({}));
    const errStatus = String(payload?.error?.status || '');

    if (response.status === 429 || errStatus === 'RESOURCE_EXHAUSTED') {
      return { status: 429, data: { quotaExceeded: true } };
    }

    if (!response.ok) {
      return {
        status: 200,
        data: { unavailable: true, reason: errStatus || `HTTP_${response.status}` }
      };
    }

    const first = payload?.results?.[0];
    if (!first) {
      return { status: 200, data: { notFound: true } };
    }

    return {
      status: 200,
      data: {
        formattedAddress: sanitizeAddress(first.formattedAddress),
        placeId: first.placeId || '',
        lat: Number(first.location?.latitude),
        lng: Number(first.location?.longitude)
      }
    };
  } catch (err) {
    return {
      status: 200,
      data: { unavailable: true, reason: 'NETWORK_ERROR', details: String(err?.message || '') }
    };
  }
}
