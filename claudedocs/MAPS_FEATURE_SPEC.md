# Dyia Maps — Feature Specification

**Version:** 1.0
**Date:** April 29, 2026
**Status:** Proposed
**Owner:** TBD
**Estimated Effort:** ~5–7 days

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Vendor Selection](#3-vendor-selection)
4. [Data Model Changes](#4-data-model-changes)
5. [Geocoding Strategy](#5-geocoding-strategy)
6. [UX & Navigation Integration](#6-ux--navigation-integration)
7. [Component Contracts](#7-component-contracts)
8. [API Routes](#8-api-routes)
9. [AI / Assistant Integration](#9-ai--assistant-integration)
10. [Pro Gating, Plan Limits & Cost](#10-pro-gating-plan-limits--cost)
11. [Security, Privacy & RLS](#11-security-privacy--rls)
12. [Implementation Phases](#12-implementation-phases)
13. [Testing Plan](#13-testing-plan)
14. [Rollout & Telemetry](#14-rollout--telemetry)
15. [Open Questions](#15-open-questions)
16. [Appendix A — Files Touched](#appendix-a--files-touched)

---

## 1. Executive Summary

### 1.1 Objective
Add a **Maps** view to dyia that visualizes scheduled jobs and estimates as pins on a Google Map. Pins reveal the customer, time window, status, estimate/revenue, and address; clicking a pin links back into Jobs to edit or complete the work.

### 1.2 Why now
- Service businesses (junk removal, lawn care, cleaning) plan their day geographically. Today they have to mentally map addresses from `Calendar.tsx` and `Jobs.tsx`.
- `dyia_jobs.address` already exists as free-text (migration `017_job_status_and_address.sql`) — we have the data, we just don't render it spatially.
- A maps view is a natural Pro upgrade vector and a foundation for v2 routing.

### 1.3 Scope
**In:** Map view, address autocomplete, lat/lng caching, pin → detail panel, cross-links from Calendar and Jobs, basic Pro gating.
**Out:** Turn-by-turn directions, true route optimization (VRP), driver tracking, geofencing, crew assignment.

---

## 2. Goals & Non-Goals

### 2.1 Goals
- Render scheduled jobs (and optionally estimates / free estimates) as pins on a map.
- Click a pin → see job summary with deep link into Jobs.
- Filter by date (today / this week / custom range) and by `scheduledKind` (`job` | `estimate` | `free_estimate`).
- Reuse the existing `GOOGLE_PLACES_API_KEY` server-side workflow from `src/lib/intel/places.ts`.
- Lazy backfill geocoding for legacy addresses on first visit; never block app boot.

### 2.2 Non-Goals (v1)
- Turn-by-turn driving directions (we only deep-link to Google Maps).
- Optimized multi-stop routing / VRP solver (v2).
- Crew assignment / live driver tracking (v2+).
- Geofencing / on-site check-ins (v2+).

### 2.3 Success Metrics
- ≥ 30% of Pro/Trial users open the Maps view in the first week post-launch.
- ≥ 80% of newly created scheduled jobs have a `address_place_id` (i.e., autocomplete adoption).
- Geocoding spend < $0.02 per active user / month (see §10.3).
- Zero regressions in Calendar or Jobs render performance.

---

## 3. Vendor Selection

**Selected: Google Maps JavaScript API + Places API (New)**

### 3.1 Rationale
1. dyia already calls `places.googleapis.com` via `GOOGLE_PLACES_API_KEY` in `src/lib/intel/places.ts`. Single billing account, one less vendor to vet.
2. Places **Autocomplete (New)** REST endpoint can drive the address input on the Job form — addresses get geocoded the moment they're entered (no batch back-fill required).
3. The official React wrapper [`@vis.gl/react-google-maps`](https://visgl.github.io/react-google-maps/) is React 19 / Next.js 16 friendly and SSR-safe.

### 3.2 Alternatives considered
| Option | Pro | Con |
|---|---|---|
| **Mapbox GL JS** | Beautiful default styling, generous free tier | Second vendor + bill; Places-style autocomplete still needs a separate provider |
| **Leaflet + OSM tiles** | Free tiles | Address autocomplete/geocoding still needs a paid provider; we'd combine 2 services |
| **MapLibre + Mapbox tiles** | Fully OSS client | Same vendor problem as Leaflet |

**Decision:** Google Maps JS + Places (New), gated behind a new browser env var (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) restricted by HTTP referrer.

### 3.3 New environment variables
```
# .env.local
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY     # browser key, HTTP-referrer restricted to dyia.co + localhost
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID      # optional: cloud-styled Map ID for vector + theming
```
Existing `GOOGLE_PLACES_API_KEY` (server-side) stays unchanged and is reused by `/api/maps/geocode`.

---

## 4. Data Model Changes

Today, `dyia_jobs.address` is plain text with no coordinates. We must cache lat/lng so the Map view doesn't re-geocode on every render.

### 4.1 Migration `supabase/migrations/036_job_geocoding.sql`

```sql
-- Add geocoded coordinates to scheduled jobs so the Maps view can render
-- pins without re-geocoding on every load. Address remains the source of
-- truth; address_place_id provides a stable canonical identifier.
ALTER TABLE dyia_jobs
  ADD COLUMN IF NOT EXISTS address_lat         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS address_lng         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS address_place_id    TEXT,
  ADD COLUMN IF NOT EXISTS address_formatted   TEXT,
  ADD COLUMN IF NOT EXISTS address_geocoded_at TIMESTAMPTZ;

COMMENT ON COLUMN dyia_jobs.address_lat IS 'Cached latitude from Google geocoding';
COMMENT ON COLUMN dyia_jobs.address_lng IS 'Cached longitude from Google geocoding';
COMMENT ON COLUMN dyia_jobs.address_place_id IS 'Google Places place_id for canonical identity';
COMMENT ON COLUMN dyia_jobs.address_formatted IS 'Google-canonicalized one-line address for display';

-- Partial index supporting Maps view queries (only rows we can render)
CREATE INDEX IF NOT EXISTS idx_dyia_jobs_geo
  ON dyia_jobs(user_id, date)
  WHERE address_lat IS NOT NULL;

-- Mirror columns on customers so a customer's geocoded address can prefill
-- new jobs without re-geocoding.
ALTER TABLE dyia_customers
  ADD COLUMN IF NOT EXISTS address_lat        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS address_lng        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS address_place_id   TEXT,
  ADD COLUMN IF NOT EXISTS address_formatted  TEXT;
```

### 4.2 Type updates (`src/types/database.ts`)

Extend `Job` (DB) and `AppJob`:
```ts
// Job (snake_case, DB row)
address_lat?: number | null
address_lng?: number | null
address_place_id?: string | null
address_formatted?: string | null
address_geocoded_at?: string | null

// AppJob (camelCase, app)
addressLat?: number | null
addressLng?: number | null
addressPlaceId?: string | null
addressFormatted?: string | null
```

Same shape for `Customer` / `AppCustomer` (minus `*_geocoded_at`).

### 4.3 Mapping in `src/app/app/page.tsx`

Update `loadData()` (around lines 234–261 in `src/app/app/page.tsx`) to read the new columns:
```ts
addressLat: (j as { address_lat?: number | null }).address_lat ?? null,
addressLng: (j as { address_lng?: number | null }).address_lng ?? null,
addressPlaceId: (j as { address_place_id?: string | null }).address_place_id ?? null,
addressFormatted: (j as { address_formatted?: string | null }).address_formatted ?? null,
```

---

## 5. Geocoding Strategy

Two paths, both behind a single server route so the API key never ships to the browser:

### 5.1 Inline geocoding (primary path)
When the user picks a suggestion in the new `<AddressAutocomplete>` component on the Job form (`src/components/app/Jobs.tsx`, line ~1310 where `tempAddress` lives), the suggestion includes `place_id`. On save we POST to `/api/maps/geocode` once and persist `lat / lng / place_id / formatted` together with the job. Zero extra calls on subsequent reads.

### 5.2 Lazy backfill (fallback)
For jobs where `address` is set but `address_lat` is null (legacy, AI-created, or imported), the Maps view triggers a debounced batch through the same endpoint and writes results back. Idempotent via `address_place_id`.

### 5.3 Cost containment
- Use Place Autocomplete **session tokens** (single billable session per typing burst, not per keystroke).
- Optional `dyia_geocode_cache` table keyed by normalized address — only added if monitoring shows real cost.
- **Never** geocode in `loadData()` on app boot — only inside the Maps view, lazily.
- Hard rate-limit `/api/maps/geocode`: ≤ 30 requests / minute / user.

---

## 6. UX & Navigation Integration

### 6.1 Sidebar (`src/components/app/Sidebar.tsx`)

Add a new entry to `NAV_SECTIONS` under the **Work** group, immediately after `calendar`:
```ts
{ id: 'maps', icon: 'mapPin', label: 'Maps' }
```
- Add a `mapPin` SVG to the existing `Icons` map.
- Add `'maps'` to the `View` union in both `Sidebar.tsx` and `src/app/app/page.tsx` (and to `VALID_VIEWS`).
- Mobile: keep Maps inside the **More** drawer — do not displace the existing 4 primary tabs (`dashboard`, `jobs`, `quotes`, `customers`).

### 6.2 New view `src/components/app/Maps.tsx`

Layout mirrors the structure of `Calendar.tsx` (`page-content` shell, header + filters + grid):

```
┌─ page-header ─────────────────────────────────────────────┐
│  "Maps"                                  [Schedule Job +] │
│  date range picker · filter chips                         │
├──────────────────────────┬─────────────────────────────────┤
│                          │  Selected Pin Detail Panel     │
│                          │  ┌───────────────────────────┐ │
│   <Map>                  │  │ Customer name             │ │
│   pins for filtered      │  │ Time window · Status      │ │
│   jobs, colored by       │  │ Estimate / Revenue        │ │
│   status                 │  │ Address (formatted)       │ │
│                          │  │ Notes                     │ │
│                          │  │ [Open in Jobs →]          │ │
│                          │  │ [Open in Google Maps ↗]   │ │
│                          │  │ [Call customer]           │ │
│                          │  └───────────────────────────┘ │
└──────────────────────────┴─────────────────────────────────┘
```

### 6.3 Pin styling

Reuse the existing palette so it matches Calendar at a glance:
| State | Color | Notes |
|---|---|---|
| Scheduled job | Blue | Mirrors `Calendar.tsx` job-status blue |
| Estimate / free estimate | Orange | Matches dyia primary |
| Completed (within filter) | Green | Mirrors revenue-positive accents |
| Cancelled | Slate (muted) | De-emphasized |
| Today's jobs | Larger pin + subtle pulse | Draws the eye |

Use marker clustering (built-in to `@vis.gl/react-google-maps`) for high-density days and recurring same-address jobs.

### 6.4 Cross-links from existing views

- **`Calendar.tsx` day-detail panel** — at the address row (around lines 425–430), add a **"View on map"** chevron that calls `onNavigate?.('maps')` and pre-selects that job.
- **`Jobs.tsx` job card** — small map-pin icon next to the address that does the same.
- **Maps → Jobs** — "Open in Jobs to complete" / "Edit in Jobs" buttons, mirroring the pattern at `Calendar.tsx:432`.

### 6.5 Pre-selection plumbing
Follow the existing state-lifting pattern in `src/app/app/page.tsx` (`closeDayDateFromDashboard`, `jobDraftDate`):
```ts
const [mapsInitialJobId, setMapsInitialJobId] = useState<string | null>(null)
// passed to <Maps initialJobId={mapsInitialJobId} onInitialJobConsumed={...} />
```

---

## 7. Component Contracts

### 7.1 `<Maps>` props
```ts
interface MapsProps {
  jobs: AppJob[]                          // already loaded in app/page.tsx
  settings: AppSettings                   // for default center (businessInfo.address)
  onNavigate?: (view: View) => void
  onScheduleJob?: (date: string) => void  // mirrors Calendar prop
  initialJobId?: string | null
  onInitialJobConsumed?: () => void
  isPro?: boolean                         // see §10 — gating
}
```

### 7.2 `<AddressAutocomplete>` props
```ts
interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onPick: (picked: {
    formatted: string
    placeId: string
    lat: number
    lng: number
  }) => void
  placeholder?: string
  disabled?: boolean
}
```
Drop-in replacement for the plain `<input>` at `Jobs.tsx:1310` (where `tempAddress` is bound).

### 7.3 Map render (illustrative)
```tsx
<Map
  defaultCenter={businessAddressLatLng ?? US_CENTER}
  defaultZoom={11}
  mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
  gestureHandling="greedy"
>
  {filteredJobs.map(job => (
    <AdvancedMarker
      key={job.id}
      position={{ lat: job.addressLat!, lng: job.addressLng! }}
      onClick={() => setSelectedJob(job)}
    >
      <JobPin job={job} isSelected={selectedJobId === job.id} />
    </AdvancedMarker>
  ))}
</Map>
```

---

## 8. API Routes

### 8.1 `POST /api/maps/geocode`

**Request**
```ts
{ address: string; placeId?: string }
```
**Response**
```ts
{
  lat: number
  lng: number
  formatted: string
  placeId: string
}
```
**Behavior**
1. Verify Clerk session (or demo cookie → reject in demo).
2. If `placeId` is supplied, call Places **Place Details** (cheaper, single call).
3. Otherwise call Places **Geocoding** with the free-text address.
4. Return the canonicalized result. The client persists it on the job.

**Errors**
- `400` invalid input
- `401` unauthenticated
- `402` rate limit exceeded (per-user 30/min)
- `502` upstream Google failure (do not retry on client; surface a soft error and let the user save without coordinates)

### 8.2 `POST /api/maps/autocomplete`

**Request**
```ts
{ query: string; sessionToken: string }
```
**Response**
```ts
{
  predictions: Array<{ description: string; placeId: string }>
}
```
**Behavior**
- Proxies to Places **Autocomplete (New)** so the API key stays server-side.
- Client generates a `sessionToken` (UUIDv4) per typing burst and reuses it across keystrokes; clears it after the user picks a suggestion.

---

## 9. AI / Assistant Integration

Two small additions to `src/lib/openai/functions.ts` and `src/lib/openai/handlers.ts`:

### 9.1 `get_jobs_near(address: string, radiusMiles: number)`
Returns scheduled jobs within `radiusMiles` of `address`, ordered by distance. Useful for context-rich answers like *"What else is near this stop on Friday?"*

### 9.2 `find_route_for_day(date: string)`
Returns an ordered list of stops for that date using a simple nearest-neighbor traversal anchored at `settings.businessInfo.address`. Includes a Google Maps multi-stop directions URL the assistant can hand back to the user.

These two handlers make the new geo data immediately useful through Dyia chat without building a full routing UI.

---

## 10. Pro Gating, Plan Limits & Cost

### 10.1 Tier matrix
| Capability | Basic | Trial | Pro |
|---|---|---|---|
| See today's jobs on a map | ✅ (≤ 50 pins / month) | ✅ | ✅ |
| Week / custom date range | — | ✅ | ✅ |
| Multi-stop "Open route in Google Maps" link | — | ✅ | ✅ |
| Nearest-neighbor route ordering | — | ✅ | ✅ |
| AI route suggestions (`find_route_for_day`) | — | ✅ | ✅ |

### 10.2 Gating implementation
- Wrap range selectors and route CTAs in the existing `<ProFeature>` component used elsewhere.
- The **nav entry itself is not Pro-gated** — keep it visible to drive discovery, mirroring the existing `pro?: boolean` pattern in `Sidebar.tsx`.

### 10.3 Cost model (target < $0.02 / active user / month)
| Call | Google price (2026) | Frequency assumption |
|---|---|---|
| Autocomplete session | ~$0.017 / session | ~1 per new job |
| Place Details | ~$0.017 / call | ~1 per new job |
| Geocoding (fallback) | ~$0.005 / call | rare; only legacy backfill |
| Map load (Dynamic Maps) | ~$0.007 / load | once per Maps view open |

Mitigations: session tokens, lat/lng caching, lazy load map, no boot-time geocoding.

---

## 11. Security, Privacy & RLS

- **Browser key** (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) **must** be HTTP-referrer-restricted in Google Cloud Console to `dyia.co`, `*.dyia.co`, and `localhost:3000`. API surface restricted to "Maps JavaScript API" only.
- **Server key** (`GOOGLE_PLACES_API_KEY`) stays server-side; reused by `/api/maps/*` routes.
- All geocoded writes go through the existing user-scoped Supabase pattern; new columns inherit existing RLS on `dyia_jobs` and `dyia_customers` (row owner = `user_id`). **No new RLS policies required.**
- **Demo mode** (`dyia_demo_active` cookie): skip geocoding entirely. Extend `DEMO_JOBS` in `src/app/app/page.tsx` with hard-coded `addressLat / addressLng` literals so the map renders without any API calls.
- **PII**: addresses are already stored as plain text. No new PII surface area.

---

## 12. Implementation Phases

### Phase 1 — Plumbing (1–2 days)
1. Migration `036_job_geocoding.sql` (§4.1).
2. Extend `Job`, `AppJob`, `Customer`, `AppCustomer` types (§4.2).
3. Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` to `.env.local` and document them in `CLAUDE.md`.
4. Create `/api/maps/geocode` and `/api/maps/autocomplete` routes (§8).
5. Build `<AddressAutocomplete>` component and replace the plain `<input>` at `Jobs.tsx:1310`. On pick, persist `address_*` columns to `dyia_jobs`.
6. Update `loadData()` in `src/app/app/page.tsx` to map the new columns onto `AppJob`.

### Phase 2 — Map view (2–3 days)
1. `npm install @vis.gl/react-google-maps`.
2. Create `src/components/app/Maps.tsx` (mirror `Calendar.tsx` styling; reuse `page-content` / `page-header` classes).
3. Wire into `src/app/app/page.tsx`:
   - `const Maps = dynamic(() => import('@/components/app/Maps').then(m => ({ default: m.Maps })), { ssr: false })`
   - Add `'maps'` to the `View` union and `VALID_VIEWS`.
   - Add a `case 'maps':` branch to `renderContent()`.
4. Add Maps to `Sidebar` Work section + mobile More drawer + new `mapPin` icon.
5. Add cross-links from `Calendar.tsx` day detail and `Jobs.tsx` cards.

### Phase 3 — Polish (1–2 days)
1. Marker clustering, pin styling per status / kind.
2. Pro-gated "Open route in Google Maps" multi-stop deep link.
3. Lazy backfill geocoding for legacy addresses.
4. Demo data with hard-coded coordinates.
5. Empty / loading / error states matching `Calendar.tsx` empty state aesthetic.

### Phase 4 — Assistant (~0.5 day)
1. Add `get_jobs_near` and `find_route_for_day` AI functions in `src/lib/openai/functions.ts` + `handlers.ts`.

---

## 13. Testing Plan

### 13.1 Unit
- `<AddressAutocomplete>`: keystroke → autocomplete request, pick → `onPick` payload, session-token reset on pick.
- `Maps.tsx` filter logic: date range + scheduledKind chips correctly subset `jobs`.
- Geocode response normalization (formatted address, place_id passthrough).

### 13.2 Integration
- Create a job with a real address via autocomplete → row in `dyia_jobs` has all four `address_*` fields populated.
- Open Maps view with a mix of geocoded and non-geocoded jobs → only geocoded ones show pins; backfill kicks in for the rest.
- Cross-link from Calendar day detail → Maps opens with the correct pin selected.
- Demo mode → no network calls to `/api/maps/*`.

### 13.3 Manual QA checklist (add to `QA_MASTER_SPEC.md`)
- [ ] Light + dark theme parity
- [ ] Mobile drawer entry visible and functional
- [ ] Pro-gated CTAs hidden for basic tier
- [ ] Cluster expand on zoom-in
- [ ] Selecting a pin scrolls/animates the detail panel correctly on mobile

---

## 14. Rollout & Telemetry

### 14.1 Feature flag
Gate behind a `MAPS_ENABLED` flag (env or admin toggle) so we can dark-launch internally first. Flip on for all users when Phase 3 lands.

### 14.2 Telemetry events
Lightweight client logs (existing console pattern, or extend whatever analytics path the team adopts):
- `maps_view_opened`
- `maps_pin_clicked`
- `maps_open_in_google_clicked`
- `maps_route_optimize_clicked` (Pro)
- `address_autocomplete_picked` (with `placeId` hashed)

### 14.3 Cost monitoring
- Daily cron reads Google Cloud billing export → posts to admin Slack if daily spend > $X.
- Weekly admin dashboard tile in `AdminPanel.tsx`: total geocodes / autocompletes / map loads.

---

## 15. Open Questions

1. **Address ownership** — should the canonical address live on `dyia_customers` (and jobs inherit), or stay duplicated on `dyia_jobs` for historical accuracy when a customer moves? *Recommendation: keep both; customer's address is the default when creating a new job for that customer.*
2. **Map theming** — sync with `useTheme()` (light/dark) only, or expose styling? *Recommendation: just sync with theme.*
3. **Quotes on the map?** Quotes also have `customer_address`. *Recommendation: v2 — keep v1 focused on scheduled work.*
4. **Free estimates on by default?** They're already a `scheduled_kind`. *Recommendation: yes, with a chip filter to hide.*
5. **Mobile experience** — full-screen map sheet vs. responsive grid? *Recommendation: full-screen sheet with a bottom drawer for the detail panel; the 33% column from Calendar is too cramped for a map.*

---

## Appendix A — Files Touched

### New
- `supabase/migrations/036_job_geocoding.sql`
- `src/components/app/Maps.tsx`
- `src/components/app/AddressAutocomplete.tsx`
- `src/app/api/maps/geocode/route.ts`
- `src/app/api/maps/autocomplete/route.ts`
- `claudedocs/MAPS_FEATURE_SPEC.md` *(this file)*

### Modified
- `src/types/database.ts` — extend `Job`, `AppJob`, `Customer`, `AppCustomer`
- `src/app/app/page.tsx` — `View` union, `VALID_VIEWS`, dynamic import, `renderContent` case, `loadData` field mapping, demo data coords, pre-selection state
- `src/components/app/Sidebar.tsx` — `View` union, `mapPin` icon, Work nav entry, mobile drawer entry
- `src/components/app/Calendar.tsx` — "View on map" cross-link in day detail
- `src/components/app/Jobs.tsx` — replace `tempAddress` `<input>` with `<AddressAutocomplete>`; persist `address_*` fields on save; map-pin cross-link
- `src/lib/openai/functions.ts` — add `get_jobs_near`, `find_route_for_day` definitions
- `src/lib/openai/handlers.ts` — add corresponding handlers
- `CLAUDE.md` — document new env vars
- `.env.example` — add new env vars
- `QA_MASTER_SPEC.md` — add Maps QA section

---

**End of Specification**
