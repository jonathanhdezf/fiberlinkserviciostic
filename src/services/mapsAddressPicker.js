// ==========================================
// FIBERLINK GOOGLE MAPS ADDRESS MARKER PICKER
// Modern Maps JS API (AdvancedMarkerElement + Place Class + Geocoding v4 Proxy)
// Avoids legacy google.maps.Geocoder billing errors on Maps Demo Keys
// ==========================================

import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

const ATTRIBUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';
const DEMO_MAP_ID = 'DEMO_MAP_ID';

// Viewport center for Fiberlink service coverage area (Teziutlán, Puebla, MX)
const DEFAULT_CENTER = { lat: 19.8173, lng: -97.3596 };

let loaderConfigured = false;
let sdkPromise = null;
let quotaDefenseInstalled = false;
let quotaExceededState = false;

export function installMapsQuotaDefense() {
  if (typeof window === 'undefined' || quotaDefenseInstalled) return;
  quotaDefenseInstalled = true;

  const triggerQuotaEvent = () => {
    quotaExceededState = true;
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  };

  window.gm_authFailure = () => {
    triggerQuotaEvent();
  };

  const origError = console.error;
  console.error = (...args) => {
    origError.apply(console, args);
    const msg = args.map((a) => String(a)).join(' ');
    if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
      triggerQuotaEvent();
    }
  };
}

export function isMapsQuotaExceeded() {
  return quotaExceededState;
}

function checkAndReportQuotaError(err) {
  const msg = `${err?.code || ''} ${err?.status || ''} ${err?.message || ''} ${String(err || '')}`;
  if (
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('QuotaExceededError') ||
    msg.includes('OverQuotaMapError') ||
    msg.includes('429')
  ) {
    quotaExceededState = true;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
    return true;
  }
  return false;
}

function getApiKey() {
  return String(import.meta.env?.VITE_GOOGLE_MAPS_API_KEY || '').trim();
}

async function loadMapsModules() {
  const apiKey = getApiKey();
  if (!apiKey) {
    const missingErr = new Error('VITE_GOOGLE_MAPS_API_KEY no configurada');
    missingErr.code = 'MISSING_API_KEY';
    throw missingErr;
  }

  if (!loaderConfigured) {
    setOptions({
      key: apiKey,
      v: 'weekly',
      language: 'es',
      region: 'MX',
      mapIds: [DEMO_MAP_ID]
    });
    loaderConfigured = true;
  }

  if (!sdkPromise) {
    sdkPromise = Promise.all([
      importLibrary('maps'),
      importLibrary('marker'),
      importLibrary('places')
    ]).then(([mapsLib, markerLib, placesLib]) => ({
      Map: mapsLib.Map,
      AdvancedMarkerElement: markerLib.AdvancedMarkerElement,
      PinElement: markerLib.PinElement,
      Place: placesLib.Place,
      SearchNearbyRankPreference: placesLib.SearchNearbyRankPreference
    }));
  }

  try {
    return await sdkPromise;
  } catch (err) {
    sdkPromise = null;
    checkAndReportQuotaError(err);
    throw err;
  }
}

function sanitizeAddressForTicket(formatted) {
  const clean = String(formatted || '').replace(/\s+/g, ' ').trim();
  return clean.slice(0, 260);
}

function extractLatLngLiteral(pos) {
  if (!pos) return null;
  const lat = typeof pos.lat === 'function' ? pos.lat() : Number(pos.lat);
  const lng = typeof pos.lng === 'function' ? pos.lng() : Number(pos.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

async function callGeocodeProxy(params) {
  try {
    const qs = new URLSearchParams(params);
    const res = await fetch(`/api/geocode?${qs.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (res.status === 429 || data?.quotaExceeded) {
      quotaExceededState = true;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      return { quotaExceeded: true };
    }
    return data;
  } catch (_) {
    return { unavailable: true };
  }
}

export function createAddressMapPicker({
  mapEl,
  inputEl,
  statusEl,
  coordsEl,
  searchBtnEl,
  locateBtnEl,
  onAddressPicked
}) {
  let map = null;
  let marker = null;
  let PlaceClass = null;
  let NearbyRankEnum = null;
  let initPromise = null;
  let lastCoords = null;
  let lookupToken = 0;

  const setStatus = (text, tone = 'muted') => {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.dataset.tone = tone;
  };

  const setCoordsDisplay = (coords) => {
    lastCoords = coords;
    if (!coordsEl) return;
    coordsEl.textContent = coords
      ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
      : 'Sin marcador';
  };

  const setMarkerPosition = (coords, pan = true) => {
    if (!map || !marker || !coords) return;
    marker.position = coords;
    if (!marker.map) marker.map = map;
    if (pan) map.panTo(coords);
    setCoordsDisplay(coords);
  };

  const reverseLookupWithPlaces = async (coords) => {
    if (!PlaceClass) return null;
    try {
      const request = {
        fields: ['displayName', 'formattedAddress', 'location'],
        locationRestriction: {
          center: coords,
          radius: 120
        },
        maxResultCount: 1,
        language: 'es',
        region: 'mx',
        internalUsageAttributionIds: [ATTRIBUTION_ID]
      };
      if (NearbyRankEnum?.DISTANCE) {
        request.rankPreference = NearbyRankEnum.DISTANCE;
      }
      const { places } = await PlaceClass.searchNearby(request);
      const top = places?.[0];
      if (!top) return null;
      return sanitizeAddressForTicket(top.formattedAddress || top.displayName || '');
    } catch (err) {
      checkAndReportQuotaError(err);
      return null;
    }
  };

  const forwardLookupWithPlaces = async (query) => {
    if (!PlaceClass) return null;
    try {
      const { places } = await PlaceClass.searchByText({
        textQuery: query,
        fields: ['formattedAddress', 'location', 'displayName'],
        locationBias: DEFAULT_CENTER,
        language: 'es',
        region: 'mx',
        maxResultCount: 1,
        internalUsageAttributionIds: [ATTRIBUTION_ID]
      });
      const top = places?.[0];
      const coords = extractLatLngLiteral(top?.location);
      if (!coords) return null;
      return {
        coords,
        formattedAddress: sanitizeAddressForTicket(top.formattedAddress || top.displayName || '')
      };
    } catch (err) {
      checkAndReportQuotaError(err);
      return null;
    }
  };

  const reverseGeocodeCoords = async (coords) => {
    if (!coords) return;
    const token = ++lookupToken;
    setStatus('Consultando dirección del marcador...', 'loading');

    const proxyRes = await callGeocodeProxy({
      lat: String(coords.lat),
      lng: String(coords.lng)
    });
    if (token !== lookupToken) return;

    if (proxyRes?.quotaExceeded) {
      setStatus('Se alcanzó la cuota de Google Maps; edita la dirección manualmente.', 'error');
      return;
    }

    let resolvedAddress = proxyRes?.formattedAddress || '';

    if (!resolvedAddress && proxyRes?.unavailable) {
      resolvedAddress = (await reverseLookupWithPlaces(coords)) || '';
      if (token !== lookupToken) return;
    }

    if (resolvedAddress) {
      const cleanAddress = sanitizeAddressForTicket(resolvedAddress);
      if (inputEl) inputEl.value = cleanAddress;
      setStatus('Dirección actualizada desde el marcador. Haz clic en Guardar si estás editando.', 'ok');
      if (typeof onAddressPicked === 'function') {
        onAddressPicked(cleanAddress, coords);
      }
      return;
    }

    const fallbackCoordLabel = `Ubicación marcada (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`;
    if (inputEl && !inputEl.value.trim()) {
      inputEl.value = fallbackCoordLabel;
    }
    setStatus(
      `Marcador fijado en ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}. Puedes afinar o escribir la calle manualmente.`,
      'warn'
    );
  };

  const forwardGeocodeAddress = async (addressText, { silentNotFound = false } = {}) => {
    const query = String(addressText || '').trim();
    if (!query || query.toLowerCase() === 'soporte remoto') return false;
    await ensureInitialized();
    if (!map) return false;

    const token = ++lookupToken;
    setStatus('Ubicando dirección en el mapa...', 'loading');

    const proxyRes = await callGeocodeProxy({ address: query });
    if (token !== lookupToken) return false;

    if (proxyRes?.quotaExceeded) {
      setStatus('Se alcanzó la cuota de Google Maps; edita la dirección manualmente.', 'error');
      return false;
    }

    let coords =
      Number.isFinite(proxyRes?.lat) && Number.isFinite(proxyRes?.lng)
        ? { lat: proxyRes.lat, lng: proxyRes.lng }
        : null;

    if (!coords && proxyRes?.unavailable) {
      const placeMatch = await forwardLookupWithPlaces(query);
      if (token !== lookupToken) return false;
      coords = placeMatch?.coords || null;
    }

    if (coords) {
      setMarkerPosition(coords, true);
      map.setZoom(16);
      setStatus('Marcador ubicado. Arrástralo o haz clic para afinar el punto exacto.', 'ok');
      return true;
    }

    if (!silentNotFound) {
      setStatus('No se encontró esa dirección; haz clic en el mapa para colocar el marcador.', 'warn');
    } else {
      setStatus('Haz clic en el mapa o arrastra el marcador para ajustar la ubicación.', 'muted');
    }
    return false;
  };

  const ensureInitialized = async () => {
    if (map && marker) return true;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      if (!mapEl) return false;
      setStatus('Cargando Google Maps...', 'loading');
      try {
        const {
          Map,
          AdvancedMarkerElement,
          PinElement,
          Place,
          SearchNearbyRankPreference
        } = await loadMapsModules();

        PlaceClass = Place;
        NearbyRankEnum = SearchNearbyRankPreference;

        map = new Map(mapEl, {
          center: DEFAULT_CENTER,
          zoom: 15,
          mapId: DEMO_MAP_ID,
          internalUsageAttributionIds: [ATTRIBUTION_ID],
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy'
        });

        const pin = new PinElement({
          background: '#9cc32e',
          borderColor: '#2f4508',
          glyphColor: '#070904',
          scale: 1.15
        });

        marker = new AdvancedMarkerElement({
          map,
          position: DEFAULT_CENTER,
          gmpDraggable: true,
          title: 'Ubicación del servicio (haz clic en el mapa o arrastra este marcador)'
        });
        marker.append(pin);

        setCoordsDisplay(DEFAULT_CENTER);
        setStatus('Haz clic en el mapa o arrastra el marcador para elegir la dirección.', 'muted');

        map.addListener('click', (event) => {
          const coords = extractLatLngLiteral(event?.latLng);
          if (!coords) return;
          setMarkerPosition(coords, true);
          void reverseGeocodeCoords(coords);
        });

        marker.addListener('dragend', () => {
          const coords = extractLatLngLiteral(marker.position);
          if (!coords) return;
          setCoordsDisplay(coords);
          map.panTo(coords);
          void reverseGeocodeCoords(coords);
        });

        return true;
      } catch (err) {
        initPromise = null;
        if (err?.code === 'MISSING_API_KEY') {
          mapEl.innerHTML = `<div class="gmp-fallback-msg">Falta configurar la clave de Google Maps para mostrar el mapa interactivo. Puedes ingresar la dirección manualmente arriba.</div>`;
          setStatus('Mapa no disponible sin clave API.', 'warn');
        } else {
          mapEl.innerHTML = `<div class="gmp-fallback-msg">No se pudo cargar Google Maps en este momento. Puedes editar la dirección manualmente.</div>`;
          setStatus('Error al inicializar el mapa.', 'error');
        }
        return false;
      }
    })();

    return initPromise;
  };

  searchBtnEl?.addEventListener('click', () => {
    void forwardGeocodeAddress(inputEl?.value || '', { silentNotFound: false });
  });

  locateBtnEl?.addEventListener('click', async () => {
    const ok = await ensureInitialized();
    if (!ok) return;
    if (!navigator.geolocation) {
      setStatus('Tu navegador no soporta geolocalización.', 'warn');
      return;
    }
    setStatus('Obteniendo ubicación actual...', 'loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        setMarkerPosition(coords, true);
        map?.setZoom(17);
        void reverseGeocodeCoords(coords);
      },
      () => {
        setStatus('No se pudo obtener tu ubicación actual (permiso denegado o sin señal).', 'warn');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

  return {
    async openAndSync() {
      const ok = await ensureInitialized();
      if (!ok) return;
      const currentAddress = String(inputEl?.value || '').trim();
      if (currentAddress && currentAddress.toLowerCase() !== 'soporte remoto') {
        await forwardGeocodeAddress(currentAddress, { silentNotFound: true });
      } else {
        setMarkerPosition(lastCoords || DEFAULT_CENTER, true);
        setStatus('Haz clic en el mapa o arrastra el marcador para elegir la dirección.', 'muted');
      }
    },
    async searchCurrentInput() {
      await forwardGeocodeAddress(inputEl?.value || '', { silentNotFound: false });
    },
    resetView() {
      if (map && marker) {
        setMarkerPosition(DEFAULT_CENTER, false);
        map.setCenter(DEFAULT_CENTER);
        map.setZoom(15);
      }
      setStatus('Haz clic en el mapa o arrastra el marcador para elegir la dirección.', 'muted');
    }
  };
}
