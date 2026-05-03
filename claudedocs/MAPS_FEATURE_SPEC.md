# Dyia Maps — Feature Proposal & Quote

**Prepared for:** Founder
**Date:** April 29, 2026
**Status:** Proposed
**Total quote:** **16 hours**

---

## 1. The pitch in one paragraph

Dyia already knows the address of every scheduled job, estimate, and customer — it just doesn't show them on a map. **Maps** is a new section in the app that drops every upcoming job onto a Google Map. The user clicks a pin and sees the customer, time window, estimate, and status; one click jumps them back into the job to edit or complete it. It turns the calendar into something a service-business owner can actually plan a day around.

---

## 2. Why this fits Dyia right now

- **The data is already there.** Every job has an address field. We're rendering data we already collect — not asking users to do anything new.
- **It's a daily-use surface.** Service-business owners (junk removal, lawn care, cleaning) plan their day geographically. A map view becomes one of the most-opened screens.
- **It's a clean upgrade vector.** Basic users see today's pins. Pro users get date ranges, multi-stop "open route in Google" links, and AI route suggestions. Maps becomes a reason to upgrade.
- **It reuses infrastructure we already pay for.** Dyia Intel already uses the Google Places API. Maps uses the same Google account, the same key story, the same vendor. No new contracts.

---

## 3. What the user sees

**A new "Maps" tab** appears in the sidebar under the "Work" group, right next to Calendar.

**On open**, the user sees a map centered on their service area with a pin for every upcoming job. Pins are color-coded:

| Color | Meaning |
|---|---|
| Blue | Scheduled job |
| Orange | Estimate or free estimate |
| Green | Completed (within filter) |
| Gray | Cancelled |
| Larger pulsing pin | Today's jobs |

**Filters at the top** — toggle date range (Today / This Week / Custom) and job type (Jobs / Estimates).

**Click any pin** — a side panel shows customer name, time window, status, estimate or revenue, address, and notes. Three buttons: "Open in Jobs", "Open in Google Maps" (for directions), and "Call customer".

**Cross-links from existing screens** — the address row in the Calendar day-detail and the address line on each Job card both get a small map pin icon that jumps to Maps with the right pin pre-selected.

**On the address field of the Job form** — replace the plain text input with a Google-powered autocomplete. Users pick from real addresses; we silently store the coordinates so the map is fast and accurate.

---

## 4. Scope

### In scope
- Maps tab with pins, filters, and pin detail panel
- Address autocomplete on the Job form
- Cross-links from Calendar and Jobs
- Pin clustering for high-density days
- Pro-gated extras: date ranges beyond today, multi-stop Google Maps deep link, AI "what's near this stop?" answers
- Demo mode with sample pins (no API calls)
- Light + dark theme parity

### Out of scope (future phases)
- Turn-by-turn directions inside Dyia (we deep-link to Google Maps instead)
- True route optimization with a routing engine
- Driver tracking, geofencing, on-site check-ins
- Crew assignment

---

## 5. Vendor: Google Maps

**Why Google Maps and not Mapbox or OpenStreetMap?**

Dyia Intel already uses Google's Places API. Adding Google Maps means one billing account, one vendor relationship, and the same address autocomplete powering both products. Mapbox would mean a second vendor and a second bill for no real benefit. OpenStreetMap is free for tiles but still needs a paid provider for autocomplete — defeats the simplification.

**Cost economics** (target: under $0.02 per active user per month)

| Call type | Roughly | When it happens |
|---|---|---|
| Address autocomplete session | ~$0.017 | Once per new job created |
| Place lookup | ~$0.017 | Once per new job created |
| Map view load | ~$0.007 | Each time user opens the Maps tab |

We mitigate by caching coordinates on the job (one geocode forever, not one per render), using session tokens (one bill per typing burst, not per keystroke), and skipping geocoding entirely in demo mode.

**Cost monitoring** — daily Google Cloud spend posted to admin Slack if it exceeds a threshold.

---

## 6. Privacy & data

- All map data stays inside the user's existing Dyia account; no new tables that need new access policies.
- Addresses are already stored as plain text today; we add cached coordinates next to them. No new personal data is collected.
- The browser API key is locked to the dyia.co domain so it can't be reused by anyone outside the app.

---

## 7. Phased delivery

| Phase | What ships | Hours |
|---|---|---:|
| **1. Foundation** | Address autocomplete on the Job form. Coordinates saved silently. No map yet, but every new job is now map-ready. | 4 |
| **2. The Maps tab** | Full map view, pins, filters, detail panel, cross-links from Calendar and Jobs. | 5 |
| **3. Polish** | Pin clustering, status colors, multi-stop "open in Google" link, demo data, empty/loading/error states. | 3 |
| **4. AI hookup** | Dyia chat can answer "what jobs are near this stop?" and "give me my route for Friday." | 1.5 |
| **5. QA & launch** | Manual QA (light/dark, mobile, Pro gating), feature-flag rollout, basic usage telemetry. | 2.5 |
| | **Total** | **16** |

The recommended **first ship** is Phase 1 alone (~4 hours). It's invisible to the user but it cleans up every new address with Google's canonical version and quietly captures coordinates — meaning when Phase 2 ships a week later, the map is instantly populated with real data instead of starting empty.

---

## 8. How this affects pricing tiers

| Capability | Basic | Trial | Pro |
|---|:---:|:---:|:---:|
| See today's jobs on a map | ✅ | ✅ | ✅ |
| Week and custom date ranges | — | ✅ | ✅ |
| Multi-stop "Open route in Google Maps" | — | ✅ | ✅ |
| AI route suggestions | — | ✅ | ✅ |

The map itself is **not** Pro-gated — keeping it visible to Basic users makes it a daily reminder of what they're missing, and the route-planning features are exactly what a busy operator will pay to unlock.

---

## 9. The quote

### 16 hours total

Calibrated against past Dyia work:

| Reference feature | Hours |
|---|---:|
| Stripe Connect (marketplace payments, identity, webhooks) | 26 |
| **Dyia Maps (this proposal)** | **16** |
| Dyia Intel (Places + research + report) | 12 |

**Why it lands between Intel and Stripe Connect** — Maps is bigger than Intel because it adds a full new interactive view plus a form control that integrates into the existing Jobs flow. It's smaller than Stripe Connect because there's no payment regulation, identity verification, or webhook reconciliation work.

### Risk buffer
The 16-hour figure is a **point estimate**, not a worst case. A reasonable contingency window is 14–18 hours. Anything beyond 18 hours likely means scope drift into v2 territory (route optimization, driver tracking) which should be quoted separately.

---

## 10. Open questions to confirm before kickoff

1. **Default address source.** When a user adds a job for an existing customer, do we prefill the customer's saved address by default? *Recommended: yes.*
2. **Free estimates on the map by default?** *Recommended: yes, with a one-click filter to hide them.*
3. **Should quotes also appear on the map?** *Recommended: not in v1 — keep the first version focused on scheduled work to avoid visual clutter.*
4. **Mobile experience** — full-screen map with a bottom sheet for the detail panel, or the same side-panel layout as desktop? *Recommended: full-screen with bottom sheet; the desktop layout cramps the map on a phone.*

---

## 11. What's not included (and would be quoted separately)

- True route optimization (a routing engine that solves the multi-stop problem)
- Live driver/crew location tracking
- Geofencing (auto-mark a job in-progress when the driver arrives)
- Custom map theming beyond light/dark
- A separate analytics dashboard for map usage
- Migration of historical addresses through paid geocoding (we backfill lazily as users open the map; mass backfill would be a separate line item if desired)

---

**End of proposal.**
