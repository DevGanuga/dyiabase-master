# dyia - QA Master Specification

> Full QA audit performed Feb 6, 2026. Covers all views, components, API routes, and cross-cutting concerns.
> Bugs found during this audit have been fixed inline (see "Fixes Applied" sections).

---

## Table of Contents

1. [Landing Page](#1-landing-page)
2. [Authentication & Onboarding](#2-authentication--onboarding)
3. [Dashboard](#3-dashboard)
4. [Jobs](#4-jobs)
5. [Quote Builder](#5-quote-builder)
6. [Quotes](#6-quotes)
7. [Follow-Ups](#7-follow-ups)
8. [Customers](#8-customers)
9. [Reports](#9-reports)
10. [Settings](#10-settings)
11. [Marketing (Pro)](#11-marketing-pro)
12. [Mass Email (Pro)](#12-mass-email-pro)
13. [AI Assistant (Pro)](#13-ai-assistant-pro)
14. [Navigation & Layout](#14-navigation--layout)
15. [Mobile Responsiveness](#15-mobile-responsiveness)
16. [Edge Cases & Error Handling](#16-edge-cases--error-handling)
17. [Bugs Found & Fixes Applied](#17-bugs-found--fixes-applied)
18. [Recommendations](#18-recommendations)
19. [Feature Completeness Matrix](#19-feature-completeness-matrix)

---

## 1. Landing Page

**File**: `src/app/page.tsx`

### Features
| Feature | Status | Notes |
|---------|--------|-------|
| Hero section with headline | PASS | "Know your real profit." headline, dashboard preview mockup |
| Animated stat counters | PASS | 30 sec, 100%, 2 min, $0 stats |
| Problem section (pain points) | PASS | 4 pain point cards |
| How It Works (3 steps) | PASS | Log, See, Grow |
| Features grid (12 features) | PASS | All features listed with descriptions |
| AI Demo section (Dyia) | PASS | Chat mockup with pricing suggestion |
| Testimonials (3) | PASS | Marcus R., Jake T., Priya S. |
| Business type selector | PASS | 6 types, Junk Removal live, others "Coming Soon" |
| Waitlist form for coming-soon types | PASS | Email input, submit to `/api/waitlist` |
| Pricing section (Monthly/Annual toggle) | PASS | Basic $14.99/mo, Pro $24.99/mo; Annual saves 20% |
| Coupon input | PASS | Text field below pricing |
| FAQ accordion (8 questions) | PASS | Collapsible Q&A |
| CTA sections | PASS | Multiple "Start Free Trial" buttons |
| Navigation links (Features, AI, Pricing, FAQ) | PASS | Smooth scroll anchors |
| Footer (Product, Company, Get Started) | PASS | Links to sign-in, sign-up, dashboard |
| Comparison section (vs Jobber) | PASS | Feature comparison table |

### Issues Found
- **None critical** - Landing page is comprehensive and well-structured.

---

## 2. Authentication & Onboarding

**Files**: `src/app/sign-in/`, `src/app/sign-up/`, `src/app/app/onboarding/page.tsx`, `src/app/app/layout.tsx`

### Auth Flow
| Feature | Status | Notes |
|---------|--------|-------|
| Clerk sign-up page | PASS | `/sign-up` with Clerk UI |
| Clerk sign-in page | PASS | `/sign-in` with Clerk UI |
| Auth middleware redirect | PASS | Unauthenticated users redirected from `/app` |
| User profile init via API | PASS | `POST /api/user/init` creates `dyia_users` + `dyia_settings` |
| Demo mode (cookie-based) | PASS | `POST /api/demo/activate` sets `dyia_demo_access=true` |
| Demo mode banner + exit | PASS | Fixed top banner with "Exit" button |

### Onboarding Flow
| Step | Status | Notes |
|------|--------|-------|
| Welcome step | PASS | Greeting, start button |
| Profile step | PASS | First name, business type |
| Business step | PASS | Business name, phone, email, address, logo upload, team size |
| Financials step | PASS | Tax percentage slider, monthly revenue goal |
| Template step | PASS | Optional price template creation |
| Skip behavior | PASS | Can skip; `onboarding_skipped` flag set |
| Completion redirect | PASS | Redirects to `/app` dashboard |
| Re-open from launchpad | PASS | "Complete setup" button navigates to `/app/onboarding` |

### Issues Found
- **URL persistence bug**: Navigating directly to `/app?view=jobs` doesn't persist the `?view=` param. The page loads, shows "Loading...", then redirects to `/app` (dashboard). This is likely a race condition between Clerk auth initialization and the Suspense boundary reading `useSearchParams()`.

---

## 3. Dashboard

**File**: `src/components/app/Dashboard.tsx`

### Features
| Feature | Status | Notes |
|---------|--------|-------|
| Time-based greeting | PASS | "Good morning/afternoon/evening, {name}" |
| Quick actions (Log Job, New Quote, Ask Dyia) | PASS | Navigate to respective views |
| Launchpad checklist | PASS | 6 items, progress tracking, collapsible |
| Today stats (jobs, revenue) | PASS | Filtered by today's date |
| Workflow pipeline | PASS | Quotes, Follow-ups, Jobs, Overhead, Take Home |
| Goal progress bar | PASS | Visual bar with percentage |
| Monthly breakdown (collapsible) | PASS | Revenue, expenses, profit, tax, take-home |
| Recent jobs list | PASS | Last 5 jobs with "View all" link |
| AI Insights card (Pro) | PASS | Gated with ProFeature, refresh button |
| Pending Actions card | PASS | Shows AI-proposed jobs/quotes awaiting confirmation |

### Calculations
| Calculation | Status | Notes |
|-------------|--------|-------|
| Monthly revenue | PASS | Sum of job revenues for current month |
| Monthly expenses | PASS | Sum of all expense fields |
| Net profit | PASS | Revenue - Job expenses - Fixed monthly expenses |
| Tax set-aside | PASS | `netProfit * taxRate%` |
| Take home | PASS | `netProfit - taxSetAside` |
| Goal progress | PASS | `monthRevenue / monthlyGoal * 100` |

### Issues Found
- **Tax calculation basis**: Tax is calculated on net profit after fixed expenses. Some users may expect it on gross profit. Consider making this configurable or adding a tooltip explaining the methodology.
- **Week calculation**: Uses rolling 7 days from `Date.now()`, which may include/exclude boundary days depending on timezone.

---

## 4. Jobs

**File**: `src/components/app/Jobs.tsx`

### Features
| Feature | Status | Notes |
|---------|--------|-------|
| Job list with profit margins | PASS | Shows customer, revenue, profit, source |
| Add job form | PASS | Date, customer(s), source, revenue, expenses, notes |
| Multi-customer per trip | PASS | Add/remove customers; expenses split equally |
| Quick expense entry (total) | PASS | Single total field, clears itemized |
| Itemized expense entry | PASS | Labor, gas, dump fee, dumpster rental, additional |
| Live profit preview | PASS | Real-time profit, margin, tax, take-home calculations |
| Customer autocomplete | PASS | Type-ahead from existing customer names |
| Edit job | PASS | Pre-fills form with existing data |
| Delete job with confirmation | PASS | Uses `ConfirmProvider` dialog |
| Month navigation (prev/next) | PASS | Arrow buttons + month picker |
| "Today" quick button | PASS | Jumps to current month |
| Search by customer name/source | PASS | Real-time text filter |
| Source filter dropdown | PASS | Filters by marketing source |
| Stats cards (Jobs, Revenue, Expenses, Profit) | PASS | Aggregated for selected month |
| Review request modal | PASS | Platform selection (Google/Yelp/Facebook), copy message, API tracking |
| Empty state with CTA | PASS | Shows when no jobs in selected month |

### Validation
| Check | Status | Notes |
|-------|--------|-------|
| At least one customer with name + revenue > 0 | PASS | Validated before save |
| Date required | PARTIAL | Date input required by HTML, but no future date validation |
| Revenue max limit | MISSING | No upper bound on revenue input |
| Customer name max length | MISSING | No maxLength on input |
| Expense negative prevention | PASS | Uses `Math.max(0, value)` |

### Issues Found
- Missing date validation (allows future dates, very old dates)
- No maxLength on customer name or notes inputs
- No loading indicator during initial data fetch (only on save button)

---

## 5. Quote Builder

**File**: `src/components/app/QuoteBuilder.tsx`

### Features
| Feature | Status | Notes |
|---------|--------|-------|
| Customer info form | PASS | Name (required), phone, email, address, description |
| Customer autocomplete | PASS | From existing customers via hook |
| Volume-based pricing (5 tiers) | PASS | Minimum, 1/4, 1/2, 3/4, Full load |
| Multiple full loads calculator | PASS | Count + per-load price |
| Specialty items (6 types) | PASS | Trampoline, shed, fridge, furniture, hot tub, custom demo |
| Additional fees (6 types) | PASS | Labor, heavy item, distance, time, hazard, custom |
| Photo upload (up to 3) | PASS | Client-side compression, base64 storage |
| Price template loading | PARTIAL | Loads some fields, missing `threeQuarterLoad`, `fullLoad` surcharges |
| Review & confirmation step | PASS | Two-step: review summary, then confirm to save |
| Auto follow-up creation | PASS | Creates pending follow-up on quote save |
| Estimate range calculation | PASS | ±10% of total (floor/ceil) |
| Back to quotes navigation | PASS | "Back" button returns to quotes list |

### Fixes Applied
- **Follow-up creation error handling**: Added try-catch around follow-up insert so quote still saves if follow-up creation fails (was silently failing before).

### Issues Found
- Price template loading is incomplete - only loads some pricing fields from template
- No "Save as Draft" option - must complete full flow
- No unsaved changes warning when clicking Cancel/Back
- `parseFloat(e.target.value) || 0` prevents clearing input fields to empty
- Estimate range for very small totals (< $1) produces odd ranges ($0-$2)

---

## 6. Quotes

**File**: `src/components/app/Quotes.tsx`

### Features
| Feature | Status | Notes |
|---------|--------|-------|
| Quote list with estimate ranges | PASS | Cards showing customer, status, estimate range |
| Status filters (Draft/Sent/Accepted/Declined/Expired) | PASS | Tab-style filter buttons |
| Search by customer name | PASS | Real-time text filter |
| Mark as Sent | PASS | Sets `sent_at` timestamp |
| Mark as Accepted/Declined | PASS | Updates status |
| PDF download with business info | PASS | jsPDF generation with logo, customer info, pricing, photos |
| Link quote to job | PASS | Dropdown of unlinked jobs for linking |
| Unlink from job | PASS | Removes `jobId` reference |
| Delete with confirmation | PASS | Confirmation dialog |
| Review request (for completed quotes) | PASS | Modal with platform selection |
| Empty state with CTA | PASS | "Create your first quote" prompt |

### Fixes Applied
- **Follow-up deletion**: Now explicitly deletes associated follow-up before deleting quote (was relying on unverified CASCADE).
- **PDF logo format detection**: Auto-detects PNG vs JPEG format from data URL (was hardcoded 'PNG').
- **PDF photo format detection**: Auto-detects PNG vs JPEG for job photos (was hardcoded 'JPEG').

### Issues Found
- No edit quote functionality - can only create new quotes
- No loading state during PDF generation (can take time with photos)
- No loading state per-quote during status updates (risk of double-click)
- Review request button only shows for 'completed' status (should also show for 'accepted')

---

## 7. Follow-Ups

**File**: `src/components/app/FollowUps.tsx`

### Features
| Feature | Status | Notes |
|---------|--------|-------|
| Kanban board (5 columns) | PASS | Pending, Contacted, Snoozed, Converted, Lost |
| Auto-populated from quotes | PASS | Follow-ups created when quotes are saved |
| Priority system (Hot/Warm/Cold) | PASS | Auto-assigned based on days since quote |
| Priority filter | PASS | Dropdown to filter by priority |
| Status change via buttons | PASS | Move between columns |
| Drag-and-drop (desktop) | PARTIAL | Uses HTML5 drag API; no touch/mobile support |
| Copy follow-up message | PASS | Generates templated message with clipboard copy |
| Convert to job (one-click) | PASS | Creates job from quote data with average estimate |
| Days since quote indicator | PASS | Shows elapsed time |
| Contact count tracking | PASS | Increments when moved to "Contacted" |
| Snooze with future date | PASS | Sets `next_follow_up_at` |
| Empty state with CTA | PASS | "Create and send a quote" prompt |

### Issues Found
- No mobile touch support for drag-and-drop
- Empty state doesn't link directly to quote builder
- No bulk actions (mark multiple as contacted, etc.)
- No undo after status change
- Job date on "Convert to Job" uses `new Date()` which may not match user's timezone

---

## 8. Customers

**File**: `src/components/app/Customers.tsx`

### Features
| Feature | Status | Notes |
|---------|--------|-------|
| Customer list with search | PASS | Name search, real-time filter |
| Sort options | PASS | Name, revenue, last job date, job count |
| Customer detail view | PASS | Expandable card with full info |
| Contact info (phone, email, address) | PASS | Displayed in detail view |
| Action buttons (Call, Text, Email) | PASS | `tel:`, `sms:`, `mailto:` links |
| Lifetime value / job count / avg job | PASS | Calculated from job history |
| Job history per customer | PASS | List of past jobs with dates and revenue |
| Quote history per customer | PASS | List of quotes with status |
| Add customer manually | PASS | Form with name, phone, email, address, notes, tags |
| Edit customer | PASS | Pre-fills form from existing data |
| Delete customer with confirmation | PASS | Confirmation dialog |
| Tags | PASS | Add/remove custom tags |
| Notes | PASS | Free-text notes field |
| Re-engage badge | PASS | Shows for inactive customers (30+ days, 2+ jobs) |
| Auto-derive from jobs | PASS | Customers appear from job customer names |
| Database persistence | PASS | Saves to `dyia_customers` table |
| Create quote from customer | PASS | "New Quote" button in detail view |

### Issues Found
- Auto-sync is one-way: customers are derived from jobs in memory, but creating a job doesn't auto-create a `dyia_customers` record. The empty state text "Customers are auto-added when you log jobs" is misleading.
- Case-sensitive name matching could create duplicate customer entries
- No merge functionality for duplicate customers
- "Re-engage" badge hidden on mobile (`hidden sm:inline`)
- No customer activity timeline (combined jobs + quotes chronologically)

---

## 9. Reports

**File**: `src/components/app/Reports.tsx`

### Features
| Feature | Status | Notes |
|---------|--------|-------|
| Time range filters (7D, 30D, 3M, 1Y, All) | PASS | Toggleable buttons |
| Revenue summary card | PASS | Total revenue for period |
| Gross Profit card | PASS | Revenue minus job expenses |
| Avg Job Value card | PASS | Revenue / job count |
| Total Expenses card | PASS | Sum of all expense categories |
| Revenue by source chart | PASS | Bar chart visualization |
| Expense breakdown chart | PASS | Category-wise expense bars |
| Monthly trend table | PASS | Revenue, expenses, profit by month |
| Performance metrics | PASS | Best day, quote conversion rate, net profit |
| AI Insights card (Pro) | PASS | Gated with ProFeature wrapper |
| Empty state | PASS | "Log your first job" prompt when no data |

### Issues Found
- Fixed expense calculation for "All" time range uses `months = 12` as default, which is inaccurate if user has more or fewer months of data.
- Week calculation uses `0.25` months approximation.
- No data export from reports view (would need to go to Settings > Account > Export).

---

## 10. Settings

**File**: `src/components/app/Settings.tsx`, `src/components/app/FixedExpenses.tsx`, `src/components/app/PriceTemplates.tsx`

### Tabs
| Tab | Status | Notes |
|-----|--------|-------|
| Business | PASS | Name, phone, email, address, logo, review URLs (Google/Yelp/Facebook) |
| Financial | PASS | Tax % slider (0-50%), monthly goal with weekly/daily breakdown |
| Expenses | PASS | Fixed expenses CRUD, monthly/yearly frequency, active/paused toggle |
| Templates | PASS | Price template CRUD, set default, preview grid |
| Account | PASS | Profile, subscription, billing portal, data export |

### Business Tab
| Feature | Status | Notes |
|---------|--------|-------|
| Business name input | PASS | Text field |
| Phone input | PASS | Text field |
| Email input | PASS | Text field (no format validation) |
| Address input | PASS | Text field |
| Logo upload | PASS | File input with 2MB limit, client-side compression |
| Logo remove | PASS | Remove button clears logo |
| Review URL (Google) | PASS | Text field |
| Review URL (Yelp) | PASS | Text field |
| Review URL (Facebook) | PASS | Text field |
| Save button | PASS | Saves to `dyia_settings` |

### Financial Tab
| Feature | Status | Notes |
|---------|--------|-------|
| Tax percentage slider | PASS | Range 0-50%, shows real-time value |
| Monthly goal input | PASS | Number input |
| Weekly/Daily breakdown | PASS | Calculated display (goal/4 weeks, goal/30 days) |
| Save button | PASS | Saves tax + goal together |

### Expenses Tab (FixedExpenses component)
| Feature | Status | Notes |
|---------|--------|-------|
| Add expense | PASS | Name, amount, frequency (monthly/yearly), category |
| Edit expense | PASS | Pre-fills form |
| Delete expense | PASS | With confirmation |
| Active/Paused toggle | PASS | Toggles `is_active` flag |
| Monthly total display | PASS | Sums active expenses (yearly/12) |
| Yearly total display | PASS | Sums active expenses (monthly*12) |
| Category presets | PASS | Insurance, truck, tools, software, etc. |

### Templates Tab (PriceTemplates component)
| Feature | Status | Notes |
|---------|--------|-------|
| Create template | PASS | Name, all pricing fields |
| Edit template | PASS | Pre-fills form |
| Delete template | PASS | With confirmation |
| Set as default | PASS | Default template auto-loads in QuoteBuilder |
| Preview grid | PASS | Shows pricing at a glance |

### Account Tab
| Feature | Status | Notes |
|---------|--------|-------|
| Profile display | PASS | Name, email, avatar from Clerk |
| Edit profile link | PASS | Opens Clerk profile page |
| Security link | PASS | Opens Clerk security settings |
| Subscription status | PASS | Shows current tier + days remaining |
| Upgrade buttons (monthly/annual) | PASS | Stripe checkout integration |
| Billing portal | PASS | Opens Stripe billing portal |
| Data export (CSV) | PASS | Downloads jobs, quotes, customers |

### Fixes Applied
- **Logo upload error handling**: Added try-catch around image compression and DB update. Added `reader.onerror` handler. Loading state now properly clears in `finally` block.

### Issues Found
- No email format validation on business email
- No phone format validation
- Weekly/daily breakdown doesn't account for varying month lengths (uses fixed 4 weeks / 30 days)
- No unsaved changes warning when navigating away from settings

---

## 11. Marketing (Pro)

**File**: `src/components/app/Marketing.tsx`

### Features
| Feature | Status | Notes |
|---------|--------|-------|
| Track spend by channel/month | PASS | Add/edit/delete spend entries |
| Period filters (month/quarter/all) | PASS | Dropdown selector |
| ROI by source table | PASS | Revenue, spend, ROI per source |
| Summary cards (Total Spend, Revenue, ROI) | PASS | Aggregated stats |
| Channel presets | PASS | 13 common channels |
| Add/Edit/Delete spend entries | PASS | Form with channel, month, amount, notes |
| Pro feature gate | PASS (FIXED) | Was missing; now properly gated |

### Fixes Applied
- **Added ProFeature gating**: Marketing view now shows "Pro Feature" upgrade prompt for non-Pro users. Previously accessible to all tiers.
- **ROI calculation fix**: When total spend is $0, ROI now shows "—" instead of misleading "100%".
- **Parent component updated**: `page.tsx` now passes `isPro` prop to Marketing component.

### Issues Found
- Quarter calculation doesn't handle year boundaries correctly (Q4 -> Q1 next year)
- No loading state while ROI data loads

---

## 12. Mass Email (Pro)

**File**: `src/components/app/MassEmail.tsx`

### Features
| Feature | Status | Notes |
|---------|--------|-------|
| Gmail OAuth connect | PASS | OAuth flow to connect Gmail |
| Outlook OAuth connect | PASS | OAuth flow to connect Outlook |
| Disconnect email account | PASS | Remove connection |
| Recipient selection | PASS | Checkbox list of customers with emails |
| Select All / Deselect All | PASS | Bulk selection |
| Compose subject + message | PASS | Text inputs |
| Send campaign | PASS | Posts to `/api/email/send` |
| Send history | PASS | Past campaigns list |
| Pro feature gate | PASS | Shows upgrade prompt for non-Pro users |

### Issues Found
- OAuth callback URL cleanup uses `window.history.replaceState` which doesn't update React Router state
- No email format validation on recipients before sending
- No loading overlay during email send (button shows "Sending..." but list is still interactive)
- No campaign preview before sending

---

## 13. AI Assistant (Pro)

**File**: `src/components/app/Assistant.tsx`

### Features
| Feature | Status | Notes |
|---------|--------|-------|
| Chat interface | PASS | Message input, send button, message history |
| Thread sidebar | PASS | List of past conversations |
| Dynamic quick actions | PASS | Fetched from `/api/ai/quick-actions` |
| File upload | PASS | Images, PDFs, CSV |
| Pending action confirmations | PASS | Job/quote proposals with accept/reject |
| Tool result cards | PASS | Shows function call results (job created, stats, etc.) |
| Markdown rendering | PASS | Assistant messages support markdown |
| Credit balance display | PASS | Shows remaining AI credits |
| Stateful conversations | PASS | Uses `response_id` for conversation continuity |
| New thread creation | PASS | Button to start fresh conversation |
| Delete thread | PASS | Remove conversation |

### Fixes Applied
- **File upload error handling**: Was calling `showSuccess` with error message. Now shows error as an assistant message in the chat stream.

### Issues Found
- Race condition: rapid thread switching could cause multiple in-flight requests
- No retry mechanism for failed API calls
- Quick actions show loading skeleton but don't cache for instant display

---

## 14. Navigation & Layout

**File**: `src/components/app/Sidebar.tsx`

### Desktop Sidebar
| Feature | Status | Notes |
|---------|--------|-------|
| Logo link | PASS | Links to home |
| Create dropdown (Log Job, New Quote, Add Customer) | PASS | Dropdown with 3 options |
| Nav groups (Work, Customers, Insights) | PASS | Grouped navigation |
| Active state highlighting | PASS | Orange highlight on current view |
| Launchpad widget (Getting Started) | PASS | Collapsible, shows progress |
| User card (name, email, avatar) | PASS | Bottom of sidebar |
| Subscription tier badge | PASS | Shows trial/pro/basic |
| Trial days remaining | PASS | Shows countdown |
| Theme toggle (Light/Dark) | PASS | Switches between themes |
| Sign Out button | PASS | Clears session |

### Mobile Bottom Nav
| Feature | Status | Notes |
|---------|--------|-------|
| 4 primary tabs (Dashboard, Jobs, Quotes, Customers) | PASS | Bottom bar on small screens |
| "More" drawer | PASS | Slide-up drawer with remaining nav items |
| Create menu in More drawer | PASS | Log Job, New Quote, Add Customer |

### Cross-Cutting
| Feature | Status | Notes |
|---------|--------|-------|
| URL sync (`?view=` param) | PARTIAL | Works for in-app navigation; fails on direct URL load |
| Browser back/forward | PASS | Uses `router.push` which integrates with history |
| Success toast messages | PASS | Green toast with auto-dismiss |
| Error toast messages | PASS | Red toast with auto-dismiss |
| Trial banner | PASS | Shows for trial/basic users with upgrade CTA |
| Trial banner dismissal | PASS (FIXED) | Now persists in sessionStorage |

### Fixes Applied
- **Sidebar icon pointer-events**: Added `pointer-events-none` to icon `<span>` wrappers in `NavButton` to prevent SVG elements from intercepting clicks.
- **Trial banner persistence**: Banner dismissal now persists via `sessionStorage` (was reset on every page load).

### Issues Found
- **Sidebar click interception**: SVG icons inside nav buttons intercept Playwright clicks (sibling element overlap). The `pointer-events-none` fix helps but the root cause appears to be the "Create" dropdown element overlapping nav items due to DOM ordering. In real browsers this works fine via event bubbling.
- Mobile "More" drawer state doesn't auto-close on navigation in all cases

---

## 15. Mobile Responsiveness

### Layout
| Feature | Status | Notes |
|---------|--------|-------|
| Sidebar hidden on mobile | PASS | `hidden sm:flex` |
| Bottom nav on mobile | PASS | `sm:hidden` |
| Content padding adjusts | PASS | `p-4 sm:p-6 lg:p-8` |
| Dashboard cards stack vertically | PASS | Grid adjusts |
| Form layouts responsive | PASS | Fields stack on mobile |

### Known Issues
- "Re-engage" badge on customer cards hidden on mobile (`hidden sm:inline`)
- Kanban board horizontal scrolling on small screens (5 columns don't fit)
- Follow-ups drag-and-drop has no touch support
- Some modal/drawer sizing may need adjustment on very small screens (< 360px)
- Pro feature badges on sidebar nav items may crowd on collapsed sidebar

---

## 16. Edge Cases & Error Handling

### Input Validation
| Case | Status | Notes |
|------|--------|-------|
| Empty required fields | PASS | Customer name + revenue validated |
| Negative numbers | PASS | `Math.max(0, value)` on expenses |
| Very large numbers | PARTIAL | No upper bound validation |
| Special characters in names | PARTIAL | No sanitization; Supabase handles SQL injection |
| Very long strings | MISSING | No maxLength on any text inputs |
| Future dates | MISSING | Date inputs allow any date |
| Invalid email formats | MISSING | No email validation on business email or customer email |
| Invalid phone formats | MISSING | No phone validation |

### Error Handling
| Scenario | Status | Notes |
|----------|--------|-------|
| Network failure on save | PARTIAL | Try-catch shows generic error |
| Supabase query failure | PASS | Errors caught and logged |
| PDF generation failure | PARTIAL | Photos wrapped in try-catch; no user feedback |
| File upload failure | PASS (FIXED) | Now shows error in chat stream |
| Concurrent edits | MISSING | No optimistic locking |
| Session expiry mid-action | MISSING | No graceful handling |

### Double-Submit Prevention
| Action | Status | Notes |
|--------|--------|-------|
| Job save | PASS | `saving` state disables button |
| Quote save | PASS | `saving` state disables button |
| Settings save | PASS | `saving` state disables button |
| Status change (quotes) | MISSING | No loading state per-quote |
| Email send | PARTIAL | Button shows "Sending..." but list still interactive |

---

## 17. Bugs Found & Fixes Applied

### Critical Fixes (Applied)

1. **Marketing.tsx - Missing ProFeature gate**
   - Bug: Marketing view was accessible to Basic tier users despite being a Pro feature
   - Fix: Added `isPro` prop and Pro feature upgrade gate with matching UI pattern from MassEmail
   - Files: `src/components/app/Marketing.tsx`, `src/app/app/page.tsx`

2. **Marketing.tsx - ROI shows 100% when spend is $0**
   - Bug: `overallRoi` returned `100` when `totalSpend === 0 && totalRevenue > 0`
   - Fix: Returns `null` when spend is 0; displays "—" instead of misleading percentage

3. **Assistant.tsx - File upload error shows success message**
   - Bug: `catch` block called `showSuccess(err.message)` instead of showing error
   - Fix: Shows error as assistant message in chat stream

4. **Quotes.tsx - Follow-up not explicitly deleted with quote**
   - Bug: Quote deletion didn't explicitly delete associated follow-up (relied on unverified CASCADE)
   - Fix: Now explicitly deletes from `dyia_follow_ups` before deleting quote

5. **Quotes.tsx - PDF image format hardcoded**
   - Bug: Logo assumed PNG, photos assumed JPEG regardless of actual format
   - Fix: Auto-detects format from data URL prefix (`data:image/png` vs `data:image/jpeg`)

6. **QuoteBuilder.tsx - Follow-up creation silently fails**
   - Bug: If follow-up insert failed after quote save, error was unhandled
   - Fix: Wrapped in try-catch with console.error; quote still saved successfully

7. **Settings.tsx - Logo upload missing error handling**
   - Bug: `compressImage` failure or `FileReader` error had no user feedback
   - Fix: Added try-catch around compression + DB update, added `reader.onerror` handler

8. **TrialBanner.tsx - Dismissal not persisted**
   - Bug: Banner reappeared on every page refresh
   - Fix: Stores dismissal in `sessionStorage` (per-session persistence)

9. **Sidebar.tsx - Icon click interception**
   - Bug: SVG icons inside nav buttons intercepted automated clicks
   - Fix: Added `pointer-events-none` to icon wrapper `<span>` elements

### Known Issues (Not Yet Fixed)

1. **URL `?view=` param lost on direct navigation / page refresh** - Race condition between Clerk auth and Suspense/searchParams
2. **Marketing quarter calculation** - Year boundary handling (Q4 → Q1 next year)
3. **QuoteBuilder template loading** - Incomplete field mapping from price templates
4. **Customers auto-sync text** - Empty state says "auto-added" but customers are derived in-memory
5. **Reports fixed expenses for "All" range** - Uses hardcoded 12 months instead of actual data range
6. **Follow-ups drag-and-drop** - No mobile/touch support
7. **Missing input validations** - No maxLength, no email/phone format, no future date prevention
8. **No edit quote functionality** - Can only create new, not edit existing
9. **No loading states** - Several async operations lack user feedback

---

## 18. Recommendations

### High Priority
1. **Fix URL persistence**: Ensure `?view=` params survive page loads. Consider storing view state in `localStorage` as fallback, or restructure auth loading to not lose search params.
2. **Add input validation**: Email format, phone format, maxLength on text fields, future date prevention.
3. **Add loading states**: Per-quote status changes, PDF generation, email sending, ROI table loading.
4. **Fix customer auto-sync text**: Either implement actual auto-creation in `dyia_customers` table when jobs are saved, or update the empty state text to be accurate.

### Medium Priority
5. **Add edit quote functionality**: Allow editing existing quotes (currently create-only).
6. **Fix template loading in QuoteBuilder**: Map all pricing fields from price templates.
7. **Add unsaved changes warnings**: Prevent accidental data loss when navigating away from forms.
8. **Fix marketing quarter calculation**: Handle year boundary correctly.
9. **Add touch support for follow-up kanban**: Use a library like `@dnd-kit` or `react-beautiful-dnd`.
10. **Fix reports fixed expense calculation**: Use actual month range from data instead of hardcoded 12.

### Low Priority
11. **Add bulk operations**: Bulk delete/edit jobs, bulk status change for follow-ups.
12. **Add duplicate customer detection/merge**: Prevent duplicates from case differences.
13. **Add campaign preview for mass email**: Show preview before sending.
14. **Add retry mechanisms**: For failed API calls in AI Assistant.
15. **Add keyboard shortcuts**: Quick actions for power users.
16. **Add job templates/recurring jobs**: Speed up common job types.

### UX Polish
17. **Re-engage badge on mobile**: Currently hidden; find alternative display.
18. **Kanban mobile layout**: Consider tab-based view instead of horizontal scroll.
19. **Settings confirmation**: Add "save successful" feedback that's more prominent.
20. **Empty states**: Add direct navigation links (e.g., Follow-ups empty state should link to QuoteBuilder).

---

## 19. Feature Completeness Matrix

| Feature Area | Complete | Partial | Missing |
|-------------|----------|---------|---------|
| **Landing Page** | Hero, Features, Pricing, FAQ, Testimonials, CTA, Footer | — | — |
| **Auth** | Sign-up, Sign-in, Demo mode, Session management | URL view persistence | — |
| **Onboarding** | 5-step flow, Skip, Resume | — | — |
| **Dashboard** | Greeting, Quick actions, Launchpad, Stats, Pipeline, Recent jobs | AI Insights (Pro dep.) | — |
| **Jobs** | CRUD, Multi-customer, Expenses, Search, Filter, Month nav, Review request | Input validation | Bulk ops, Templates, Recurring |
| **Quote Builder** | Customer form, Pricing tiers, Specialty items, Fees, Photos, Auto follow-up | Template loading, Save as draft | Edit quote |
| **Quotes** | List, Filters, Status changes, PDF export, Link to job, Delete | Loading states | Edit quote |
| **Follow-Ups** | Kanban, Priority, Status changes, Convert to job, Copy message | Drag-drop (desktop only) | Touch support, Bulk actions |
| **Customers** | List, Search, Sort, Detail, CRUD, Tags, Notes, Action buttons | Auto-sync accuracy | Merge, Import/Export |
| **Reports** | Time ranges, Summary cards, Charts, Trend table, Performance | Fixed expense calc | Data export from reports |
| **Settings** | Business, Financial, Expenses, Templates, Account | Validation | Unsaved changes warning |
| **Marketing (Pro)** | Spend tracking, ROI table, Period filters | Quarter boundaries | — |
| **Mass Email (Pro)** | OAuth connect, Compose, Send, History | Email validation | Campaign preview |
| **AI Assistant (Pro)** | Chat, Threads, Quick actions, File upload, Pending actions | Error recovery | Retry mechanism |
| **Navigation** | Sidebar, Mobile nav, Create menu, Theme toggle, Sign out | URL sync | — |

---

*Generated by QA audit - Feb 6, 2026*
