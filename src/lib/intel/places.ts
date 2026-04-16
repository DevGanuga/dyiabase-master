/**
 * Google Places API (New) client — provides verified business data.
 * Used to get accurate review counts, ratings, and competitor info
 * that the deep research model cannot reliably extract from web search.
 *
 * Uses the REST API directly (no SDK needed).
 * Requires: GOOGLE_PLACES_API_KEY env var + Places API (New) enabled in Google Cloud Console.
 */

const PLACES_API_BASE = 'https://places.googleapis.com/v1'

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY is not set')
  return key
}

export interface PlaceBusiness {
  placeId: string
  name: string
  address: string
  rating: number
  reviewCount: number
  types: string[]
  websiteUri: string | null
  googleMapsUri: string | null
}

export interface PlacesSearchResult {
  target: PlaceBusiness | null
  competitors: PlaceBusiness[]
}

async function placesRequest(
  endpoint: string,
  body: Record<string, unknown>,
  fieldMask: string
): Promise<unknown> {
  const res = await fetch(`${PLACES_API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': getApiKey(),
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Places API error (${res.status}): ${err}`)
  }

  return res.json()
}

function parsePlaces(data: unknown): PlaceBusiness[] {
  const response = data as { places?: Array<Record<string, unknown>> }
  if (!response.places || !Array.isArray(response.places)) return []

  return response.places.map(p => {
    const displayName = p.displayName as { text?: string } | undefined
    const shortAddr = p.shortFormattedAddress as string | undefined
    const fullAddr = p.formattedAddress as string | undefined

    return {
      placeId: (p.id as string) || '',
      name: displayName?.text || '',
      address: shortAddr || fullAddr || '',
      rating: typeof p.rating === 'number' ? p.rating : 0,
      reviewCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : 0,
      types: Array.isArray(p.types) ? (p.types as string[]) : [],
      websiteUri: (p.websiteUri as string) || null,
      googleMapsUri: (p.googleMapsUri as string) || null,
    }
  })
}

/**
 * Search for a specific business by name and location.
 * Returns the best match or null.
 */
export async function findBusiness(
  businessName: string,
  location: string
): Promise<PlaceBusiness | null> {
  const query = `${businessName} ${location}`

  const data = await placesRequest('places:searchText', {
    textQuery: query,
    maxResultCount: 3,
  }, 'places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress,places.rating,places.userRatingCount,places.types,places.websiteUri,places.googleMapsUri')

  const places = parsePlaces(data)
  if (places.length === 0) return null

  const nameLower = businessName.toLowerCase()
  const exactMatch = places.find(p => p.name.toLowerCase().includes(nameLower) || nameLower.includes(p.name.toLowerCase()))

  return exactMatch || places[0]
}

/**
 * Search for competitors in a given industry and location.
 * Returns up to `limit` businesses sorted by relevance.
 */
export async function findCompetitors(
  industry: string,
  location: string,
  limit: number = 10
): Promise<PlaceBusiness[]> {
  const query = `${industry} in ${location}`

  const data = await placesRequest('places:searchText', {
    textQuery: query,
    maxResultCount: Math.min(limit, 20),
  }, 'places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress,places.rating,places.userRatingCount,places.types,places.websiteUri,places.googleMapsUri')

  return parsePlaces(data)
}

/**
 * Full scan: find the target business and its competitors.
 * Returns verified data for all of them.
 */
export async function scanLocalMarket(
  businessName: string,
  industry: string,
  location: string,
  zipCode: string
): Promise<PlacesSearchResult> {
  const locationQuery = location || `zip code ${zipCode}`

  const [target, competitors] = await Promise.all([
    findBusiness(businessName, locationQuery),
    findCompetitors(industry, locationQuery, 10),
  ])

  // Remove the target business from competitors if it appears there
  const filteredCompetitors = competitors.filter(c =>
    c.placeId !== target?.placeId &&
    c.name.toLowerCase() !== businessName.toLowerCase()
  )

  return {
    target,
    competitors: filteredCompetitors,
  }
}
