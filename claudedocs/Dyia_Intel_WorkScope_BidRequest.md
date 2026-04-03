**Dyia Intel \+ CRM**

Work Scope — Requesting Bid & Feedback

| Prepared by | Dyia — Owner |
| :---- | :---- |
| **Prepared for** | Developer — for review, feedback, and bid |
| **Document type** | Work scope / bid request |
| **Date** | April 1, 2026 |

**What this document is**

We are sharing this work scope to get your thoughts, feedback, and a bid on the project before any work begins. We want to understand how you would approach the build, whether anything should be done differently, and what your honest estimate is for time and cost.

This scope describes two connected features we want to build: (1) a standalone Dyia Intel public page where any business owner can generate a free competitive intelligence report, and (2) an Intel tab inside the Dyia CRM where monthly subscribers receive an automatically refreshed version of that report plus an AI-generated action plan every month. Both features share the same underlying AI research agent.

We have laid out the full vision including screens, data points, automation steps, and acceptance criteria so you have complete context to price the job accurately and flag anything you would change.

# **1\. Project overview**

| Primary goal | Turn Dyia Intel into both a public lead acquisition tool and a retention-driving feature inside the Dyia CRM |
| :---- | :---- |
| **Revenue model** | Free public report → $27 action plan upsell \+ Dyia monthly subscription |
| **API cost per report** | $0.05–$0.08 per run (OpenAI deep research agent) |
| **Delivery approach** | Two connected surfaces built on the same AI agent — public page first, CRM tab second |

## **1.1 The two surfaces being built**

| Surface A — Public Intel page | Surface B — Dyia CRM Intel tab |
| :---- | :---- |
| Anyone can access | Dyia subscribers only |
| One free report per session | Auto-refreshed monthly per user |
| Shows teaser \+ upsells $27 action plan | Full report \+ action plan included in subscription |
| Captures email before showing full results | Uses business data already stored in Dyia |
| Entry point into the Dyia funnel | Retention engine — reason to never cancel |

# **2\. The AI research agent**

Both surfaces use the same underlying OpenAI deep research agent. This agent is the core of the entire build. It is a background job that takes structured business input, runs a research task, and returns structured JSON output. The developer builds this agent once and calls it from both surfaces.

## **2.1 Input — what gets fed to the agent**

| Input field | Where it comes from |
| :---- | :---- |
| Business name | User-entered on public page / stored in Dyia CRM |
| Website URL | User-entered / stored in Dyia CRM |
| Zip code | User-entered / stored in Dyia CRM |
| Industry / niche | User-selected dropdown / stored in Dyia CRM |
| Search radius | User-selected (10, 25, 50, 100 miles) / default 25mi in CRM |

## **2.2 Output — what the agent must return**

The agent must return a structured JSON object with the following fields. No other format is acceptable — the frontend and CRM both parse this JSON to render the report.

| JSON field | Description |
| :---- | :---- |
| local\_rank | Integer — business’s rank among local competitors (e.g. 4\) |
| total\_competitors | Integer — total competitors found in radius (e.g. 18\) |
| review\_count\_mine | Integer — number of Google reviews the business has |
| review\_count\_leader | Integer — number of reviews the \#1 competitor has |
| review\_gap | Integer — difference between leader and business |
| missing\_keywords | Array of strings — up to 15 keywords competitors rank for that business does not |
| missing\_keywords\_count | Integer — count of missing keywords |
| competitor\_ad\_spend\_avg | Integer — estimated average monthly ad spend across top 3 competitors (USD) |
| top\_competitors | Array of objects: { name, reviews, estimated\_ad\_spend, rank } |
| gbp\_gaps | Array of strings — specific Google Business Profile gaps vs top competitor |
| gap\_scores | Object: { reviews\_pct, keywords\_pct, ads\_pct, gbp\_pct } — integers 0–100 |
| scan\_date | ISO date string of when the scan ran |
| target\_zip\_codes | Array of strings — top 3 zip codes by search volume in radius |

## **2.3 Agent cost and rate**

*Each agent run costs approximately $0.05–$0.08 in OpenAI API credits. With a monthly schedule for CRM users and an email gate on the public page, volume is fully controlled. At 500 CRM subscribers, monthly cost is approximately $25–$40.*

# **3\. Surface A — Public Intel page**

The public Dyia Intel page is a standalone page accessible to anyone. Its job is to take a business owner from entering their info to seeing their competitive report — and then offering them a $27 action plan at the moment of maximum urgency.

## **3.1 Page flow (in order)**

| Step | What happens |
| :---- | :---- |
| 1\. Landing | User arrives at the page. Sees headline, subheading, and the input form. No report shown yet. |
| 2\. Input form | User enters: Business name, Website URL (optional), Zip code, Industry (dropdown), Search radius. Clicks ‘Generate my report’. |
| 3\. Email gate | Before running the agent, a modal asks for their email address. Copy: ‘Where should we send your report?’. This is required — no email, no report. Email is stored in the database. |
| 4\. Loading state | Agent runs in the background (\~30–60 seconds). Page shows animated progress: ‘Scanning your market...’ → ‘Analyzing competitors...’ → ‘Building your report...’ |
| 5\. Teaser reveal | The 4 metric cards appear: Local rank, Reviews behind leader, Missing keywords, Avg competitor ad spend. The competitor ranking table shows top 5\. Gap score bars show. This is visible for free. |
| 6\. Upsell gate | Below the teaser, a purple banner: ‘Get your 90-day action plan — $27’. The 6-item checklist previews what’s inside. CTA button: ‘Get my action plan’. Stripe checkout opens on click. |
| 7\. Action plan delivery | After Stripe payment, action plan is generated by Claude API (see Section 5\) and displayed immediately on a /report page. Also emailed to the address captured in step 3\. |
| 8\. Dyia CTA | At the bottom of the action plan: ‘Want this updated automatically every month?’ → link to Dyia signup. |

## **3.2 Input form fields**

| Field | Input type \+ options |
| :---- | :---- |
| Business name | Text input — required |
| Website URL | URL input — optional |
| Zip code | Text input — required, 5 digits |
| Search radius | Dropdown: 10 miles, 25 miles (default), 50 miles, 100 miles |
| Industry | Dropdown: Junk Removal, Landscaping, Plumbing, Cleaning, HVAC, Roofing, Painting, Moving, Pest Control, Pressure Washing, Electrical, Handyman, Tree Service, Fencing, Concrete, Other |

## **3.3 Pricing and Stripe**

* One product in Stripe: ‘Dyia Intel Action Plan’ — $27 one-time payment

* On successful payment: redirect to /report?session\_id={stripe\_session\_id} and display the action plan

* On failed payment: return to plan page with error message visible

* All Stripe products tested in test mode before go-live. Test card: 4242 4242 4242 4242

# **4\. Surface B — Dyia CRM Intel tab**

The Intel tab is a new screen inside the existing Dyia CRM dashboard. It is visible only to logged-in Dyia subscribers. Its job is to show each subscriber a fresh competitive intelligence report for their business, updated automatically every month, with an action plan built from that month’s data.

## **4.1 Where it lives in Dyia**

* A new top-level navigation tab labeled ‘Intel’ added to the Dyia dashboard nav bar

* Badge on the tab showing ‘New’ when a fresh monthly report is available and has not been viewed

* The tab is visible to all Dyia subscribers — no additional paywall inside the CRM

## **4.2 What the tab displays**

All data comes from the most recent agent run for that user. The page layout is as follows:

| Section | Content |
| :---- | :---- |
| Page header | Business name, city/state, scan radius. ‘Updated monthly · Next update in X days’ |
| 4 metric cards | Local rank (with change vs last month), Review count (with \+/- change), Reviews behind leader (with change), Missing keywords count (with change) |
| Monthly action plan banner | Purple banner: ‘Your \[Month\] action plan is ready’. Button: ‘View plan’. Opens the action plan section below. |
| Competitor ranking table | Top 5 competitors: rank, business name, review count. User’s business highlighted. |
| Gap score bars | 4 progress bars: Reviews %, Keywords %, Ad presence %, GBP profile %. Shows % of gap closed vs leader. |
| Competitor ad spend | Estimated monthly spend for top 3 competitors. |
| Action plan | 6 prioritized steps generated by Claude API from this month’s scan data. Each step has: priority pill (High/Medium/Quick win/Ongoing), title, 2-sentence description with specific data from the report. Filterable by tab: All / Reviews / Keywords / Ads. |
| Pro upsell strip | ‘Want these steps done for you?’ → link to Pro plan upgrade. (Pro plan fulfillment is a future phase — this is the CTA placeholder only.) |

## **4.3 Monthly refresh job**

* A scheduled background job runs on the 1st of each month for every active Dyia subscriber

* Job calls the OpenAI deep research agent with the user’s stored business data

* Job then calls the Claude API to generate the action plan from the new scan data (see Section 5\)

* Both outputs are written to the database and replace the previous month’s data

* The Intel tab nav badge is set to ‘New’ when the job completes and cleared when the user views the tab

* If the agent job fails for a user: log the error, retry once after 1 hour, and alert the Dyia owner if the retry also fails

## **4.4 Historical data**

Store each month’s scan result separately so the CRM can show month-over-month changes. Minimum fields to store per scan: local\_rank, review\_count\_mine, review\_gap, missing\_keywords\_count, gap\_scores, scan\_date. This powers the ‘change vs last month’ indicators on the metric cards.

# **5\. The action plan — Claude API**

After the OpenAI agent returns the competitive scan data, a second API call to the Claude API generates the personalized action plan. This is what makes the product feel built for that specific business owner rather than generic advice.

## **5.1 API details**

* Model: claude-sonnet-4-20250514

* Max tokens: 1500

* Response format: JSON array of 6 step objects

## **5.2 Prompt structure**

*Feed the full JSON output from the OpenAI agent into the Claude prompt. The prompt instructs Claude to return exactly 6 action steps as a JSON array. Each step object must contain: step\_number (1–6), category (reviews / keywords / ads / gbp), priority (high / medium / quick\_win / ongoing), title (max 10 words), description (2 sentences max, must reference specific numbers from the scan data), and include\_in\_free\_preview (boolean — first 2 steps are true).*

## **5.3 Example step output**

| Field | Example value |
| :---- | :---- |
| step\_number | 1 |
| category | reviews |
| priority | high |
| title | Send review requests to your last 30 customers |
| description | Your review gap grew by 4 this month — H-Town got 7 new reviews while you got 3\. Closing this is your \#1 priority. Script included. |
| include\_in\_free\_preview | true |

# **6\. Database schema**

New tables required. The developer should map these to the existing Dyia database structure as appropriate.

## **intel\_scans table**

| Column | Type \+ description |
| :---- | :---- |
| id | UUID — primary key |
| user\_id | FK to Dyia users table (null for public page scans) |
| email | String — captured from public page gate (null for CRM scans) |
| business\_name | String |
| website\_url | String — nullable |
| zip\_code | String |
| industry | String |
| radius\_miles | Integer |
| scan\_data | JSON — full raw output from OpenAI agent |
| action\_plan | JSON — full array output from Claude API |
| stripe\_session\_id | String — nullable, set when $27 plan is purchased |
| action\_plan\_purchased | Boolean — default false |
| created\_at | Timestamp |
| source | Enum: public\_page | crm\_monthly |

## **intel\_monthly\_status table**

Tracks the monthly job status per CRM user. One row per user per month.

| Column | Type \+ description |
| :---- | :---- |
| id | UUID |
| user\_id | FK to Dyia users |
| month\_year | String — e.g. 2026-04 |
| scan\_id | FK to intel\_scans |
| job\_status | Enum: pending | running | complete | failed |
| viewed\_at | Timestamp — nullable, set when user opens Intel tab |
| created\_at | Timestamp |

# **7\. API keys and secrets**

| Key | Who provides it |
| :---- | :---- |
| OpenAI API key (deep research agent) | Dyia owner provides before build begins |
| Anthropic API key (Claude action plan) | Dyia owner provides before build begins |
| Stripe secret key \+ webhook secret | Dyia owner provides from Stripe dashboard |

*All API keys must be stored as environment variables or in a secrets manager. Never hardcoded in source code or committed to version control.*

# **8\. Acceptance criteria**

Both features must pass every item in the relevant checklist before handoff. Neither feature is done until every box is checked by both the developer and the Dyia owner.

| Surface A — Public Intel page checklist |
| :---- |

**Input and email gate**

* All 5 input fields function correctly and validate on submit

* Email gate modal appears before agent is called — no report shown without email

* Email is stored in the database on submission

* If email already exists in database: no duplicate created, scan proceeds normally

**Agent and loading state**

* Agent is called with correct structured input after email capture

* Loading animation shows correct 3-stage progress messages

* If agent takes longer than 90 seconds: show error message and prompt retry

* If agent fails: show user-friendly error, log to server, alert owner

**Report display**

* All 4 metric cards render with correct values from agent JSON

* Competitor ranking table shows correct top 5 with user’s business highlighted

* All 4 gap score bars render with correct percentages

* Purple action plan upsell banner renders below the report

* Report renders correctly on mobile (375px), tablet (768px), desktop (1280px)

**Stripe and action plan**

* $27 Stripe checkout opens on CTA button click

* Test payment completes using card 4242 4242 4242 4242

* After payment: action plan generated and displayed on /report page within 10 seconds

* Action plan emailed to the captured email address

* Failed payment returns to page with visible error message

* stripe\_session\_id and action\_plan\_purchased=true written to intel\_scans table on success

| Surface B — Dyia CRM Intel tab checklist |
| :---- |

**Tab and navigation**

* Intel tab appears in Dyia nav for all logged-in subscribers

* ‘New’ badge appears when fresh report is available and clears on first view

* Tab loads within 2 seconds for users with existing scan data

**Monthly refresh job**

* Scheduled job runs on the 1st of each month for all active subscribers

* Job correctly calls the OpenAI agent with user’s stored business data

* Job correctly calls Claude API and stores action plan in database

* Month-over-month change values calculate correctly on all 4 metric cards

* Job failure triggers error log and owner alert

* Manual ‘refresh now’ trigger available for testing without waiting for the 1st

**Data display**

* All 4 metric cards show current values and correct change indicators vs prior month

* Competitor ranking, gap scores, and ad spend sections render correctly

* Action plan displays all 6 steps with correct priority pills and specific data references

* Tab filter (All / Reviews / Keywords / Ads) correctly filters action plan steps

* Pro upsell strip renders at the bottom of the page

**Data integrity**

* Historical scan data is preserved month-over-month — old scans are not overwritten

* intel\_monthly\_status table correctly tracks job status and viewed\_at timestamp

* No Dyia user’s data is ever visible to another user

# **9\. What we are asking for**

We are sharing this scope to get your honest feedback and a bid before any work begins. We are not locked into any particular approach and genuinely want your input. Please review the full scope and come back to us with the following:

| Your bid should include |
| :---- |

**1\. Time and cost estimate**

* A breakdown of estimated hours per build item (Surface A, Surface B, AI agent, database, QA)

* Your total project estimate

* Any items you would phase differently or split into separate milestones

**2\. Technical feedback**

* Is the OpenAI deep research agent the right tool for this job, or would you approach the competitive data differently?

* Any concerns with the proposed database schema or data model

* How would this integrate with the existing Dyia codebase — are there any conflicts or dependencies we should know about?

* Anything in the acceptance criteria that is unclear or that you would change

**3\. Recommended approach**

* Would you build Surface A and Surface B together or in sequence?

* Is there a lighter version of either surface you would recommend for a first release?

* Are there any tools or libraries you would use that differ from what is described here?

**4\. Questions for us**

* Anything you need from us before you can price this accurately

* API keys, existing codebase access, or other resources you would need before starting

*We want a clear picture of the full job before committing. The more detail in your response, the better. If your estimate comes with assumptions, please state them explicitly so we can confirm or correct them.*

# **10\. Out of scope for this build**

The following items are explicitly not part of this scope. They may be added in a future phase once the MVP is validated and we have confirmed the market.

* Agency service fulfillment (done-for-you marketing execution)

* GoHighLevel CRM integration

* Make.com automation flows

* AgencyAnalytics dashboard provisioning

* Google Ads or Meta Ads management

* Multi-location business support

* White-label or reseller version of Intel

* In-app messaging or support chat

*Thank you for taking the time to review this. We are excited about the direction and want to make sure we are building this the right way from the start. Please send your feedback, questions, and bid at your earliest convenience so we can move forward together.*

