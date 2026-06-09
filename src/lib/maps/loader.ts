/**
 * Google Maps JavaScript API loader.
 *
 * Loads the Maps JS SDK exactly once per page using the official loader, then
 * hands back the typed `google.maps` libraries. Both the Maps view and the
 * address autocomplete on the Job form share this single load so we never pull
 * the script twice or pay for redundant boots.
 *
 * Requires a browser-restricted key in `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` with
 * the "Maps JavaScript API" and "Places API" enabled. Lock the key to the
 * dyia.co domain (HTTP referrers) so it can't be reused elsewhere.
 */

import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

let optionsConfigured = false

export function getMapsApiKey(): string | null {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null
}

export function isMapsConfigured(): boolean {
  return !!getMapsApiKey()
}

function ensureOptions(): void {
  const apiKey = getMapsApiKey()
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set')
  }
  if (!optionsConfigured) {
    // Must be called before any library import; the first importLibrary then
    // boots the API. Calling setOptions twice would throw, hence the guard.
    setOptions({ key: apiKey, v: 'weekly', libraries: ['places', 'marker', 'geocoding'] })
    optionsConfigured = true
  }
}

export interface MapsLibraries {
  maps: google.maps.MapsLibrary
  marker: google.maps.MarkerLibrary
  places: google.maps.PlacesLibrary
  core: google.maps.CoreLibrary
  geocoding: google.maps.GeocodingLibrary
}

/**
 * Load the Maps + Marker + Places + Core + Geocoding libraries. Safe to call
 * repeatedly; the underlying loader dedupes so the script is only fetched once.
 */
export async function loadMapsLibraries(): Promise<MapsLibraries> {
  ensureOptions()
  const [maps, marker, places, core, geocoding] = await Promise.all([
    importLibrary('maps'),
    importLibrary('marker'),
    importLibrary('places'),
    importLibrary('core'),
    importLibrary('geocoding'),
  ])
  return { maps, marker, places, core, geocoding }
}
