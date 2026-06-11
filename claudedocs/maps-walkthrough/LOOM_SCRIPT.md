# Dyia Maps — Loom Walkthrough Script

**Length target:** ~4 minutes
**Recording account:** `dev.ganuga@initdev.co` on **https://dyia.io** (admin = full Pro access, no upgrade locks, no demo banner)
**Backup account:** `devganuga@gmail.com` (also seeded — note: it's on Basic, so Week/Custom and the route button will show PRO badges; only use it if you *want* to show the gating)

---

## Pre-flight checklist (2 minutes before recording)

- [ ] Sign in at dyia.io with the admin account. Confirm the **Maps** tab is in the sidebar (Work group).
- [ ] Open Maps once BEFORE recording — first load fetches map tiles; second load is instant and smooth on camera.
- [ ] Confirm today shows **4 pins** (Whitaker, Brookside, Nguyen, Cedar Park). If pins look stale, ping dev to re-run the seeder — data is dated relative to seeding day.
- [ ] Browser window ~1440 wide, 100% zoom. Close extra tabs. Light or dark theme — both look good; dark pops more on Loom.
- [ ] Turn on Do Not Disturb. Hide bookmarks bar.
- [ ] Have the **Jobs** tab open in a second browser tab (for the autocomplete scene) so you don't fumble navigation live.

**The seeded day** (all in Austin, TX — pins cluster nicely):

| Time | Stop | Type |
|---|---|---|
| 8:00–10:00am | Whitaker Garage Co — $525 | Job (blue) |
| 10:30–11:30am | Brookside Estate — $600–850 | Estimate (orange) |
| 1:00–3:00pm | Nguyen Residence — $380 | Job (blue) |
| 4:00–5:00pm | Cedar Park Free Estimate | Free estimate (orange) |

Plus: 3 jobs later this week, 3 completed (green, two downtown), 1 cancelled (gray). Every customer has a phone number, so **Call** works everywhere.

---

## SCENE 1 — Cold open on Home (0:00–0:20)

**Show:** Dashboard, "Your Day" card with today's 4 jobs.

> "Hey — quick walkthrough of **Dyia Maps**, the newest section of the app. Here's my day: four stops booked. The question Maps answers is — *where* are these, and what's the smartest way to run them? Notice the Your Day card now has a **Map** link right here…"

**Action:** Hover the `📍 Map` link on the Your Day card. *Don't click yet.*

---

## SCENE 2 — The map (0:20–0:55)

**Action:** Click **Maps** in the sidebar (under Work, next to Calendar).

> "This is every job for today, dropped onto a map of my service area. The view auto-fits to my pins — no setup, it's built from addresses I already had on my jobs."

**Action:** Slow zoom out one notch, then back. Point cursor at the legend (bottom-left).

> "Pins are color-coded: **blue** is a scheduled job, **orange** is an estimate visit, **green** is completed work, **gray** is cancelled. And today's stops **pulse** — so when I'm looking at a whole week, today never gets lost."

---

## SCENE 3 — Pin detail panel (0:55–1:40)

**Action:** Click the **Whitaker Garage Co** pin (8am job).

> "Click any pin and I get the whole stop: customer, time window — eight to ten — what it's worth, the address, and my notes."

**Action:** Move cursor across the three buttons as you name them.

> "Three actions: **Open in Jobs** drops me into the job to edit or complete it. **Directions** opens Google Maps navigation to this exact address — one tap from the truck. And **Call** dials the customer. That's the workflow: see the stop, drive to it, or call ahead — without leaving the map."

**Action:** Click **Directions** → new tab opens Google Maps → close it, back to Dyia.

---

## SCENE 4 — Estimates are first-class (1:40–2:00)

**Action:** Close the panel. Click the **Brookside Estate** pin (orange).

> "Estimate visits get orange pins, and instead of revenue they show the **quoted range** — six hundred to eight-fifty here. So I can see at a glance which stops today are billable work and which are sales calls. And if estimates clutter the view…"

**Action:** Click the **Estimates** chip off, then back on.

> "…one tap hides them."

---

## SCENE 5 — Week planning + route (2:00–3:00) ⭐ the money scene

**Action:** Click **This Week**.

> "Today is just the start. **This Week** pulls the whole week onto the map — my upcoming jobs, plus the green pins, which are jobs I've already completed. That's my territory at a glance: where I've been making money and where I'm headed."

**Action:** Click **Today** again. Then move the cursor to **Open route in Google Maps** (top right) and click it.

> "And this is my favorite part. One button — **Open route in Google Maps** — takes every stop on the map, puts them in order by appointment time, and builds the full multi-stop route. Eight a.m. first, four p.m. last."

**Show:** the Google Maps tab with the 4-stop route. Linger 3 seconds.

> "That used to be ten minutes of copying addresses every morning. Now it's one tap, and I'm navigating."

**Action:** Close the tab, back to Dyia.

---

## SCENE 6 — Wired into everything (3:00–3:35)

**Action:** Click **Calendar**, click today, expand **Whitaker Garage Co**.

> "Maps is connected everywhere you see an address. In the Calendar, every job's address row has a **Map** link…"

**Action:** Click the orange `Map` link → lands on Maps with the pin pre-selected.

> "…and it jumps straight to that pin. Same from the Jobs list — every card with an address has a pin button."

**Action:** Click **Jobs** in the sidebar, point at the pin icon on a job row.

---

## SCENE 7 — Where pins come from (3:35–4:00)

**Action:** In Jobs, click **+ Log Job** (or the Create button), scroll to the **Job Address** field. Type "1100 S Congress" slowly — let the Google suggestions appear. Pick one.

> "Last thing — where do pins come from? The address field is now Google-powered. Pick the real address from the dropdown and Dyia quietly saves the exact location — see the little **Pinned for Maps** badge. From then on, that job is on the map forever. Older jobs you typed by hand get located automatically the first time you open Maps."

**Action:** Cancel the form (don't save).

---

## SCENE 8 — Close (4:00–4:15)

**Action:** Back to Maps. Idle on the full map.

> "So that's Maps: your whole day, on a map, with directions, calls, and the route handled. It's live now — the map's on every plan, and week-ahead planning plus one-tap routing comes with Pro. Go open your day."

**Stop recording.**

---

## Contingencies

- **Map loads slowly on camera** → you pre-warmed it in pre-flight; if it still hitches, narrate over it ("pulling in my service area…") — never dead air.
- **A pin doesn't open on first click** → click directly on the dot center; zoom in one notch first if pins are tight.
- **Route opens with stops out of order** → you clicked while on This Week; switch to Today first (route follows the visible range).
- **Wrong/stale data day** → re-run: `node scripts/seed-maps-jobs.mjs dev.ganuga@initdev.co` (refreshes all dates to today; safe to run any time).
- **Don't show:** Settings, the admin panel, or the browser URL bar if you can crop — keeps focus on the feature.
