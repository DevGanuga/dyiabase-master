/**
 * Generate the "AI SaaS Platform Technical Showcase" PDF.
 *
 *   node scripts/generate-ai-showcase-pdf.mjs
 *
 * Consumes the fresh screenshots (capture-showcase-shots.mjs) and the four
 * branded diagrams (generate-showcase-diagrams.mjs) from
 * claudedocs/ai-showcase/assets/ and renders a single A4 PDF via Puppeteer.
 *
 * Output: claudedocs/ai-showcase/AI_SaaS_Platform_Technical_Showcase.pdf
 *
 * Editorial rules baked in: implemented features are clearly separated from
 * clearly-labeled proposed architecture; messaging integrations use neutral
 * terminology (inbound message channel / outbound notification channel).
 */

import puppeteer from 'puppeteer'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { writeFileSync, rmSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIR = join(__dirname, '..', 'claudedocs', 'ai-showcase')
const ASSETS = join(DIR, 'assets')
const OUT_FILE = join(DIR, 'AI_SaaS_Platform_Technical_Showcase.pdf')

const img = (name) => pathToFileURL(join(ASSETS, name)).href

const css = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #1e293b; font-size: 11.5px; line-height: 1.62; margin: 0; }

  /* Cover */
  .cover { background: linear-gradient(135deg,#0f172a 0%,#1e293b 55%,#7c2d12 135%); color: #fff; border-radius: 16px; padding: 52px 46px 40px; margin-bottom: 26px; position: relative; overflow: hidden; }
  .cover .kicker { display: inline-block; background: linear-gradient(90deg,#f97316,#f59e0b); color: #fff; font-weight: 800; letter-spacing: .14em; font-size: 10px; padding: 5px 13px; border-radius: 999px; text-transform: uppercase; }
  .cover h1 { font-size: 33px; margin: 18px 0 8px; color: #fff; letter-spacing: -0.8px; line-height: 1.12; }
  .cover .sub { color: #cbd5e1; font-size: 13.5px; max-width: 620px; margin: 0 0 4px; }
  .cover .one { color: #fed7aa; font-size: 12.5px; max-width: 640px; margin: 14px 0 0; font-weight: 500; }
  .cover .prepared { margin-top: 26px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.14); color: #94a3b8; font-size: 11px; }
  .cover .prepared b { color: #fff; }
  .cover .heroimg { width: 100%; border-radius: 11px; border: 1px solid rgba(255,255,255,.12); margin-top: 24px; box-shadow: 0 18px 50px rgba(0,0,0,.4); }

  h2 { font-size: 18px; margin: 0 0 4px; color: #0f172a; letter-spacing: -0.3px; }
  h2 .num { color: #f97316; margin-right: 9px; font-weight: 800; }
  h3 { font-size: 13px; margin: 18px 0 4px; color: #0f172a; }
  .rule { height: 3px; width: 60px; background: linear-gradient(90deg,#f97316,#f59e0b); border-radius: 2px; margin: 0 0 14px; }
  p { margin: 7px 0; }
  .lead { font-size: 12px; color: #334155; }
  strong, b { color: #0f172a; }

  .shot { width: 100%; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: 0 4px 18px rgba(15,23,42,.10); margin: 12px 0 4px; }
  .diagram { width: 100%; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(15,23,42,.08); margin: 10px 0 4px; }
  .caption { color: #64748b; font-size: 9.7px; margin: 5px 0 16px; }
  .caption b { color: #c2410c; }
  .duo { display: flex; gap: 14px; align-items: flex-start; }
  .duo .col { flex: 1; }
  .duo .shot { margin-top: 0; }

  ul, ol { margin: 7px 0; padding-left: 20px; } li { margin: 4px 0; }

  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10.3px; }
  th { background: #0f172a; color: #fff; text-align: left; padding: 7px 10px; font-weight: 700; }
  th:first-child { border-radius: 6px 0 0 0; } th:last-child { border-radius: 0 6px 0 0; }
  td { padding: 7px 10px; border-bottom: 1px solid #e8edf3; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 9.6px; color: #0f172a; }

  .pill { display: inline-block; font-size: 8.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; vertical-align: middle; }
  .pill.impl { background: #dcfce7; color: #166534; }
  .pill.future { background: #f1f5f9; color: #475569; border: 1px dashed #cbd5e1; }
  .pill.partial { background: #fef3c7; color: #92400e; }

  .callout { border-left: 4px solid #f97316; background: #fff7ed; border-radius: 0 8px 8px 0; padding: 11px 16px; margin: 14px 0; font-size: 10.6px; }
  .callout b { color: #c2410c; }
  .note { border-left: 4px solid #94a3b8; background: #f8fafc; border-radius: 0 8px 8px 0; padding: 11px 16px; margin: 14px 0; font-size: 10.4px; color: #475569; }
  .note b { color: #334155; }

  .grid2 { display: flex; gap: 16px; } .grid2 > div { flex: 1; }
  .kpi { display: flex; gap: 12px; margin: 14px 0 6px; flex-wrap: wrap; }
  .kpi .k { flex: 1; min-width: 120px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 11px 13px; background: #f8fafc; }
  .kpi .k .n { font-size: 19px; font-weight: 800; color: #c2410c; letter-spacing: -0.5px; }
  .kpi .k .l { font-size: 9.6px; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: .05em; }

  .toc { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 22px; }
  .toc ol { margin: 4px 0; padding-left: 22px; column-count: 2; column-gap: 40px; }
  .toc li { margin: 4px 0; color: #334155; font-size: 11px; }
  .toc b { color: #0f172a; }

  .pagebreak { page-break-before: always; }
  .avoidbreak { page-break-inside: avoid; }
  .footer { margin-top: 26px; padding-top: 10px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 8.8px; }

  .thumbstrip { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
  .thumbstrip img { width: 31.5%; border-radius: 7px; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(15,23,42,.08); }
  .summarybox { border: 2px solid #fdba74; border-radius: 14px; padding: 20px 24px; background: linear-gradient(180deg,#fff7ed,#ffffff); }
  .legendline { font-size: 9.6px; color: #64748b; margin: 6px 0 0; }
  .legendline .pill { margin-right: 4px; }
`

const sec = (n, title) => `<h2><span class="num">${n}</span>${title}</h2><div class="rule"></div>`

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>

<!-- ============ 1. COVER ============ -->
<div class="cover">
  <span class="kicker">AI SaaS Platform &nbsp;&middot;&nbsp; Technical Showcase</span>
  <h1>AI SaaS Platform Technical Showcase</h1>
  <p class="sub">Product walkthrough, system architecture, AI workflow design, and production readiness.</p>
  <p class="one">A production, multi-tenant SaaS for service businesses &mdash; job &amp; revenue tracking, quoting with PDF export, a follow-up pipeline, integrated payments, and a tool-calling AI assistant that proposes actions for human approval before writing to the system of record.</p>
  <img class="heroimg" src="${img('dashboard.png')}" />
  <div class="prepared">Prepared by <b>Dev Ganugapenta / InitDev</b><br/>Platform: <b>dyia</b> &mdash; &ldquo;Your Day, Decoded&rdquo; &nbsp;&middot;&nbsp; All screenshots captured live from the running application in Demo Mode (sample data only &mdash; no customer information).</div>
</div>

<div class="toc">
  <b>Contents</b>
  <ol>
    <li><b>Executive Summary</b></li>
    <li><b>Product Walkthrough</b></li>
    <li><b>Architecture Overview</b></li>
    <li><b>AI System Design</b></li>
    <li><b>Workflow / Automation Relevance</b></li>
    <li><b>Human-in-the-Loop / Manual Control</b></li>
    <li><b>Data Model and State</b></li>
    <li><b>Production Readiness</b></li>
    <li><b>Relevance to a Conversational Workflow System</b></li>
    <li><b>Recommended MVP Architecture</b></li>
    <li><b>One-Page Summary</b></li>
  </ol>
  <div class="legendline">Throughout this document:
    <span class="pill impl">Implemented</span> = present and verifiable in the codebase &nbsp;
    <span class="pill partial">Partial</span> = present in a related form &nbsp;
    <span class="pill future">Proposed</span> = recommended extension, not built yet.
  </div>
</div>

<!-- ============ 2. EXECUTIVE SUMMARY ============ -->
<div class="pagebreak"></div>
${sec(1, 'Executive Summary')}
<p class="lead">The platform is an operations system for owner-operated service businesses (junk removal, lawn care, house cleaning). It replaces the spreadsheets and disconnected tools these operators use to run day-to-day work.</p>

<h3>What problem it solves</h3>
<p>Small service operators lose money to invisible costs and dropped leads: untracked expenses, quotes that are never followed up, and no clear picture of daily profit. The platform centralizes jobs, quotes, customers, follow-ups, payments, and reporting, then layers an AI assistant on top so the operator can run the business by asking for what they want instead of navigating forms.</p>

<h3>Who it serves</h3>
<p>Individual operators and small crews. The product is multi-tenant: every record is scoped to a user account, gated by subscription tier (<b>basic / trial / pro</b>), with an internal <b>admin</b> role for operations and support.</p>

<h3>The core workflow</h3>
<p>Capture a job or quote &rarr; track revenue and itemized expenses &rarr; compute live profit against a monthly goal &rarr; convert quotes to jobs and drive a follow-up pipeline &rarr; collect payment &rarr; review analytics. The AI assistant can perform most of these steps on request, but <b>mutating actions are proposed and require explicit human confirmation</b> before any record is written.</p>

<h3>Why it is technically relevant</h3>
<ul>
  <li><b>AI orchestration with tool-calling.</b> A stateful LLM layer with 21 strictly-typed tools, a bounded tool-call loop, and a propose/confirm pattern that keeps a human in control of writes.</li>
  <li><b>Backend state management.</b> ~25 relational tables with explicit status enums, audit columns, and a persisted action queue.</li>
  <li><b>Real third-party integrations.</b> Authentication, subscription billing, merchant payouts, geocoding, transactional email, error monitoring, and Redis-backed rate limiting.</li>
  <li><b>Production SaaS hygiene.</b> Auth middleware, row-level security, webhook signature verification, scheduled jobs, and budget/rate guardrails on the AI layer.</li>
</ul>
<div class="kpi">
  <div class="k"><div class="n">~69</div><div class="l">API route handlers</div></div>
  <div class="k"><div class="n">21</div><div class="l">AI tools (strict schema)</div></div>
  <div class="k"><div class="n">~25</div><div class="l">Database tables</div></div>
  <div class="k"><div class="n">45+</div><div class="l">SQL migrations</div></div>
  <div class="k"><div class="n">4</div><div class="l">Scheduled cron jobs</div></div>
</div>

<!-- ============ 3. PRODUCT WALKTHROUGH ============ -->
<div class="pagebreak"></div>
${sec(2, 'Product Walkthrough')}
<p class="lead">Captured live from the running application in Demo Mode. Each caption notes what the screen demonstrates from an engineering standpoint.</p>

<img class="shot" src="${img('landing.png')}" />
<p class="caption">Public marketing surface with a self-serve demo path. <b>Proves:</b> a full public/authenticated split, SEO-oriented routing, and a real onboarding funnel &mdash; not a single-screen prototype.</p>

<img class="shot" src="${img('dashboard.png')}" />
<p class="caption">Authenticated home: today's schedule, live revenue/profit, monthly-goal progress, and a calendar. <b>Proves:</b> server-scoped data aggregation and real-time computed business state per tenant.</p>

<img class="shot" src="${img('jobs.png')}" />
<p class="caption">Job ledger with per-job revenue, itemized expenses, computed profit/margin, source attribution, and status. <b>Proves:</b> transactional CRUD plus financial computation, grouped and filterable.</p>

<div class="pagebreak"></div>
<img class="shot" src="${img('followUps.png')}" />
<p class="caption">Follow-up pipeline as a drag-and-drop board (Pending / Contacted / Snoozed) with hot/warm/cold prioritization and pipeline value. <b>Proves:</b> an explicit status state-machine driving an operational workflow &mdash; directly analogous to a contact/lead pipeline.</p>

<img class="shot" src="${img('quoteBuilder.png')}" />
<p class="caption">Structured quote builder (customer, line-item pricing, photos, estimate range) with PDF export. <b>Proves:</b> form-driven document generation and server-side artifact creation.</p>

<img class="shot" src="${img('payments.png')}" />
<p class="caption">Payments hub: pay links, invoices, and quote/job-linked requests with a transparent fee-and-payout model. <b>Proves:</b> a real merchant-payments integration with platform fees, webhook reconciliation, and money-movement state.</p>

<div class="pagebreak"></div>
<img class="shot" src="${img('reports.png')}" />
<p class="caption">Reporting: revenue by source, expense breakdown, margins, and monthly trend. <b>Proves:</b> analytics derived from the operational data model, with time-range selection.</p>

<img class="shot" src="${img('assistant.png')}" />
<p class="caption">The AI assistant workspace with suggested actions (this week's stats, pending follow-ups, suggest a price, monthly summary). <b>Proves:</b> a conversational interface wired into the same backend tools that power the UI.</p>

<div class="grid2">
  <div>
    <img class="shot" src="${img('maps.png')}" />
    <p class="caption">Geocoded jobs on a live map with route planning. <b>Proves:</b> third-party geospatial integration tied to records.</p>
  </div>
  <div>
    <img class="shot" src="${img('intel.png')}" />
    <p class="caption">A Pro-gated feature screen. <b>Proves:</b> subscription-tier feature gating enforced in the UI.</p>
  </div>
</div>

<div class="pagebreak"></div>
<h3>Responsive / mobile</h3>
<p>The same components reflow to a mobile layout with bottom navigation and touch-sized targets &mdash; the product is built mobile-first for operators working in the field.</p>
<div class="duo">
  <div class="col"><img class="shot" src="${img('mobile-dashboard.png')}" /><p class="caption">Mobile dashboard &mdash; daily view and quick actions.</p></div>
  <div class="col"><img class="shot" src="${img('mobile-assistant.png')}" /><p class="caption">Mobile AI assistant &mdash; full conversational workspace on a phone.</p></div>
</div>

<!-- ============ 4. ARCHITECTURE OVERVIEW ============ -->
<div class="pagebreak"></div>
${sec(3, 'Architecture Overview')}
<p class="lead">A single Next.js (App Router) application that serves the public site, the authenticated product, and the API. Server route handlers own privileged operations; the browser talks to the database under row-level security.</p>

<table>
  <tr><th>Layer</th><th>Technology</th><th>Notes</th></tr>
  <tr><td><b>Frontend</b></td><td>Next.js (App Router), React 19, TypeScript, Tailwind</td><td>Authenticated product is a single-page shell that switches views; 30+ public/marketing/tool pages.</td></tr>
  <tr><td><b>API layer</b></td><td>~69 Next.js route handlers</td><td>Auth, AI, payments, admin, intelligence, cron, webhooks. Typed responses, validation, rate limiting.</td></tr>
  <tr><td><b>Auth / permissions</b></td><td>Hosted auth + middleware</td><td>Session gate on <span class="mono">/app(.*)</span>, subscription tiers, admin roles, demo-mode bypass cookie, CSP.</td></tr>
  <tr><td><b>Database / storage</b></td><td>Managed Postgres (Supabase) + pgvector</td><td>~25 tables, row-level security, status enums, audit columns, vector embeddings for similarity search.</td></tr>
  <tr><td><b>AI / LLM</b></td><td>OpenAI Responses API</td><td>Stateful threads, 21 strict-schema tools, server-side handlers using a service-role DB client.</td></tr>
  <tr><td><b>Integrations</b></td><td>Billing + merchant payouts, email, maps/geocoding, error monitoring, Redis</td><td>Subscription checkout, Connect payouts, transactional + OAuth email, address autocomplete, Sentry, Upstash rate limiting.</td></tr>
  <tr><td><b>Async / scheduled</b></td><td>Webhooks + cron + audit log</td><td>Signature-verified webhooks, 4 scheduled cron jobs, webhook-event audit table.</td></tr>
  <tr><td><b>Deployment</b></td><td>Vercel (inferred from config)</td><td><span class="mono">vercel.json</span> declares build, install, and cron schedules.</td></tr>
</table>

<img class="diagram" src="${img('diagram-architecture.png')}" />
<p class="caption">Real request and data flow. Components shown are present in the codebase; the single dashed node (<b>inbound message channel</b>) is labeled as a recommended extension, not an existing feature.</p>

<div class="callout"><b>Data-flow note.</b> The browser uses an anon database client carrying the user's auth token, so row-level security applies to client reads. Privileged work &mdash; AI writes, webhooks, admin actions &mdash; runs in server handlers with a service-role client that intentionally bypasses RLS, keeping trust on the server side.</div>

<!-- ============ 5. AI SYSTEM DESIGN ============ -->
<div class="pagebreak"></div>
${sec(4, 'AI System Design')}
<p class="lead">The AI layer is an orchestrator, not a chat wrapper. It turns a natural-language message into typed tool calls, runs a bounded reasoning loop, and routes any state-changing intent through human confirmation.</p>

<h3>Where AI calls happen</h3>
<p>A dedicated chat route handles the main assistant; additional routes generate dashboard insights, a daily briefing, suggested quick actions, and price suggestions. All calls are server-side; the API key never reaches the browser.</p>

<h3>Inputs sent to the model</h3>
<ul>
  <li>The user's message, plus optional image or CSV/text file content as multi-part input.</li>
  <li>System instructions and the 21-tool schema; a prior response id to maintain stateful thread context.</li>
  <li>Resolved tenant identity (the model's tools operate only on the authenticated user's data).</li>
</ul>

<h3>Outputs and how they are stored</h3>
<ul>
  <li>Read tools return structured business data back into the loop (stats, pending follow-ups, forecasts, similar jobs).</li>
  <li>Mutating tools (<span class="mono">propose_job</span>, <span class="mono">propose_quote</span>) produce <b>proposals</b>, surfaced as preview cards, not silent writes.</li>
  <li>Final assistant text plus tool calls, tool results, token counts, and credit cost are persisted to thread and message tables; usage is logged to a budget ledger.</li>
</ul>

<h3>Guardrails, validation, and review <span class="pill impl">Implemented</span></h3>
<table>
  <tr><th>Control</th><th>Mechanism</th></tr>
  <tr><td>No silent mutations</td><td>Propose/confirm: writes require an explicit user approval step.</td></tr>
  <tr><td>Bounded reasoning</td><td>Capped tool-call iterations per request prevents runaway loops.</td></tr>
  <tr><td>Cost control</td><td>Per-request output-token cap; daily spend budget check with alert thresholds.</td></tr>
  <tr><td>Abuse control</td><td>Per-IP rate limiting (Redis) on the chat endpoint.</td></tr>
  <tr><td>Access control</td><td>Pro subscription or a positive AI-credit balance required; usage debits a credit ledger.</td></tr>
  <tr><td>Schema safety</td><td>Strict JSON tool schemas (no additional properties); handler-side field validation.</td></tr>
  <tr><td>Determinism</td><td>Automatic SDK retries disabled so user-visible outcomes are predictable.</td></tr>
</table>

<img class="diagram" src="${img('diagram-ai-flow.png')}" />
<p class="caption">The lifecycle of a single message: gate &rarr; reason &rarr; branch (propose vs. direct) &rarr; human confirm &rarr; write &rarr; persist + account.</p>

<div class="note"><b>Honest scope.</b> Responses are non-streaming by design (deterministic single-shot outcomes). Embeddings power job-similarity search today. A retrieval layer over historical conversations is a natural <span class="pill future">Proposed</span> extension.</div>

<!-- ============ 6. WORKFLOW / AUTOMATION RELEVANCE ============ -->
<div class="pagebreak"></div>
${sec(5, 'Workflow / Automation Relevance')}
<p class="lead">Automation-heavy AI systems are built from state, triggers, routing, approvals, logging, and retries. The platform already demonstrates most of these primitives.</p>

<table>
  <tr><th>Workflow primitive</th><th>Status</th><th>How it appears in this platform</th></tr>
  <tr><td>State management</td><td><span class="pill impl">Implemented</span></td><td>Explicit status enums on jobs, quotes, follow-ups, payments, and pending actions.</td></tr>
  <tr><td>User roles</td><td><span class="pill impl">Implemented</span></td><td><span class="mono">user / admin / super_admin</span> plus subscription tiers gating features.</td></tr>
  <tr><td>Task / item status</td><td><span class="pill impl">Implemented</span></td><td>Follow-up board moves items through pending &rarr; contacted &rarr; converted / lost / snoozed.</td></tr>
  <tr><td>Workflow steps</td><td><span class="pill impl">Implemented</span></td><td>Quote &rarr; follow-up &rarr; convert-to-job &rarr; payment is a multi-step lifecycle.</td></tr>
  <tr><td>Event triggers</td><td><span class="pill impl">Implemented</span></td><td>Signature-verified webhooks; auto-create follow-up when a quote is created.</td></tr>
  <tr><td>Routing</td><td><span class="pill impl">Implemented</span></td><td>The AI tool-dispatch router selects and executes the correct handler per intent.</td></tr>
  <tr><td>Approval flow</td><td><span class="pill impl">Implemented</span></td><td>Propose/confirm gate on AI writes; confirm endpoint executes only approved actions.</td></tr>
  <tr><td>Pause / resume</td><td><span class="pill partial">Partial</span></td><td>Pending-action queue persists proposed work with a status and 7-day expiry; a user can confirm later or let it lapse.</td></tr>
  <tr><td>Human review</td><td><span class="pill impl">Implemented</span></td><td>Preview cards for proposed jobs/quotes; admin review of users, payments, beta access.</td></tr>
  <tr><td>Logging</td><td><span class="pill impl">Implemented</span></td><td>Webhook-event audit table, AI usage/cost ledger, credit transactions, email send logs.</td></tr>
  <tr><td>Retries / reconciliation</td><td><span class="pill partial">Partial</span></td><td>A sync-pending route reconciles payments against the provider when a webhook is missed.</td></tr>
  <tr><td>Error handling</td><td><span class="pill impl">Implemented</span></td><td>React error boundaries plus server-side error monitoring (Sentry).</td></tr>
  <tr><td>Notifications</td><td><span class="pill impl">Implemented</span></td><td>Transactional email; scheduled reminder and insight emails.</td></tr>
  <tr><td>Background jobs</td><td><span class="pill impl">Implemented</span></td><td>Four scheduled cron jobs (trial reminders, weekly insights, follow-up reminders, monthly intelligence).</td></tr>
</table>

<div class="callout"><b>Relevant Extension Pattern.</b> For higher-volume automation, the same primitives extend cleanly to: a durable queue/worker for outbound side-effects with automatic retry/back-off; conversation-level pause/resume flags; and idempotency keys on event handlers. These are additive &mdash; the status fields, audit log, and confirm/queue pattern needed to support them already exist. <span class="pill future">Proposed</span></div>

<!-- ============ 7. HUMAN-IN-THE-LOOP ============ -->
<div class="pagebreak"></div>
${sec(6, 'Human-in-the-Loop / Manual Control')}
<p class="lead">The defining design choice of the AI layer is that it does not act unilaterally on anything that mutates the system of record.</p>

<h3>What exists today <span class="pill impl">Implemented</span></h3>
<ul>
  <li><b>Propose, don't execute.</b> When the assistant decides to create a job or quote, it emits a proposal rather than writing. The proposal is persisted to a pending-actions table with a status and expiry.</li>
  <li><b>Explicit confirmation.</b> The UI renders a preview card; only on user approval does a dedicated confirm endpoint perform the write (linking the customer, triggering downstream follow-ups).</li>
  <li><b>Admin overrides.</b> An admin role can review and manage users, subscriptions, payments, beta access, and webhook events &mdash; manual control over the operational surface.</li>
</ul>

<h3>Proposed manual-control extension <span class="pill future">Proposed</span></h3>
<p>For a conversation/workflow product, the same pattern generalizes into operator takeover. Stated in neutral, channel-agnostic terms:</p>
<ul>
  <li>The AI acts by default <b>only while rules allow</b> (eligible contact state, within rate windows).</li>
  <li>A human can <b>take over</b> a conversation at any time.</li>
  <li>While a human is in control, <b>automation pauses</b> for that contact &mdash; no auto-replies are sent.</li>
  <li>Every state change is <b>logged</b> (who took over, when, why).</li>
  <li>Automation <b>resumes only on an approved condition</b> (operator hands back, or a timeout/rule is met).</li>
  <li>Contact <b>statuses and tags</b> update based on the interaction, feeding routing and follow-up eligibility.</li>
</ul>
<div class="note">This extension reuses three things the platform already has: a persisted action/queue with status, an explicit approval gate, and an append-only audit log. The work is wiring a per-contact pause flag and a takeover state into the orchestration layer.</div>

<!-- ============ 8. DATA MODEL ============ -->
<div class="pagebreak"></div>
${sec(7, 'Data Model and State')}
<p class="lead">Every entity is tenant-scoped to a user, carries created/updated audit columns, and (where it represents work) a status field that drives the UI and workflow.</p>

<img class="diagram" src="${img('diagram-data-model.png')}" />
<p class="caption">Core entities, status enums, and ownership relationships. Audit/observability tables sit alongside the operational model.</p>

<table>
  <tr><th>Entity</th><th>Role</th><th>Key status / state</th></tr>
  <tr><td class="mono">users</td><td>Identity, billing, payout onboarding, AI credits, role</td><td>subscription_status, role</td></tr>
  <tr><td class="mono">settings</td><td>Per-tenant business config, onboarding, preferences</td><td>onboarding_completed</td></tr>
  <tr><td class="mono">customers</td><td>CRM spine; links jobs and quotes</td><td>tags[]</td></tr>
  <tr><td class="mono">jobs</td><td>Work records with revenue/expense math + embedding</td><td>scheduled / in_progress / completed / cancelled; payment_status</td></tr>
  <tr><td class="mono">quotes</td><td>Estimates with pricing and optional job link</td><td>draft / sent / accepted / declined / expired</td></tr>
  <tr><td class="mono">follow_ups</td><td>Lead pipeline with prioritization</td><td>pending / contacted / converted / lost / snoozed</td></tr>
  <tr><td class="mono">payments</td><td>Pay links / invoices / quote &amp; job payments</td><td>pending / paid / failed / refunded / &hellip;</td></tr>
  <tr><td class="mono">pending_actions</td><td>AI proposals awaiting human confirmation</td><td>pending / confirmed / cancelled / expired</td></tr>
  <tr><td class="mono">threads / messages</td><td>AI conversation history + tool I/O + cost</td><td>is_archived</td></tr>
  <tr><td class="mono">webhook_events</td><td>Inbound event audit log</td><td>status, error</td></tr>
  <tr><td class="mono">openai_usage / credit_transactions</td><td>Cost &amp; credit ledgers</td><td>type</td></tr>
</table>
<p>Relationships: a user owns settings, customers, jobs, quotes, threads, and pending actions; customers link to their jobs and quotes; quotes can spawn follow-ups and convert to jobs; quotes and jobs both link to payments; threads contain messages. Referential cleanup is handled (for example, a quote's job link is nulled if the job is deleted).</p>

<!-- ============ 9. PRODUCTION READINESS ============ -->
<div class="pagebreak"></div>
${sec(8, 'Production Readiness')}
<p class="lead">An honest assessment. Most production concerns are addressed; remaining gaps are labeled as recommendations rather than claimed.</p>

<table>
  <tr><th>Area</th><th>Status</th><th>Evidence / recommendation</th></tr>
  <tr><td>Authentication</td><td><span class="pill impl">Implemented</span></td><td>Hosted auth + middleware gate on all <span class="mono">/app</span> routes; webhook-synced user records.</td></tr>
  <tr><td>Authorization</td><td><span class="pill impl">Implemented</span></td><td>Subscription tiers, admin roles, row-level security on tenant data, server-side service-role isolation.</td></tr>
  <tr><td>Validation</td><td><span class="pill impl">Implemented</span></td><td>Strict AI tool schemas; payment amount/line-item validation; handler-side checks.</td></tr>
  <tr><td>Error handling</td><td><span class="pill impl">Implemented</span></td><td>React error boundaries; Sentry on client, server, and edge.</td></tr>
  <tr><td>Logging / audit</td><td><span class="pill impl">Implemented</span></td><td>Webhook-event log, AI usage ledger, credit transactions, email send logs.</td></tr>
  <tr><td>Secrets / config</td><td><span class="pill impl">Implemented</span></td><td>Documented <span class="mono">.env.example</span>; keys read server-side only; live/test-mode guard prevents cross-mode data corruption.</td></tr>
  <tr><td>Deployment</td><td><span class="pill impl">Implemented</span></td><td><span class="mono">vercel.json</span> with build/install commands and four cron schedules.</td></tr>
  <tr><td>Schema management</td><td><span class="pill impl">Implemented</span></td><td>45+ ordered SQL migrations under <span class="mono">supabase/migrations/</span>.</td></tr>
  <tr><td>API structure</td><td><span class="pill impl">Implemented</span></td><td>Consistent route-handler layout by domain; webhook signature verification (svix / provider).</td></tr>
  <tr><td>Responsive UI</td><td><span class="pill impl">Implemented</span></td><td>Mobile-first layouts verified in capture (see Walkthrough).</td></tr>
  <tr><td>Performance</td><td><span class="pill partial">Partial</span></td><td>Rate limiting, cached insights, vector search. Recommend query/index review at scale + caching headers audit.</td></tr>
  <tr><td>Security hardening</td><td><span class="pill impl">Implemented</span></td><td>CSP, timing-safe demo-token compare, service-role kept server-side, webhook verification.</td></tr>
  <tr><td>Automated tests</td><td><span class="pill partial">Partial</span></td><td>Vitest configured with unit tests for subscription, payment-mode, and maps logic. Recommend expanding to API-handler and AI-tool coverage + an e2e smoke suite.</td></tr>
</table>

<div class="callout"><b>Recommendations (not yet built).</b> Broaden automated test coverage around API handlers and AI tools; add idempotency keys and a durable retry queue for outbound side-effects; formalize a staging environment and migration CI. None block the current product; all are incremental. <span class="pill future">Proposed</span></div>

<!-- ============ 10. RELEVANCE ============ -->
<div class="pagebreak"></div>
${sec(9, 'Relevance to a Conversational Workflow System')}
<p class="lead">A team building an AI-assisted conversation/workflow system &mdash; business messaging integrations, contact/status tracking, manual takeover, follow-up logic, logs and analytics, scaling across operators &mdash; needs a specific set of engineering patterns. This platform is not that product, but it demonstrates the same patterns in production.</p>

<table>
  <tr><th>Requested capability</th><th>Pattern this platform demonstrates</th></tr>
  <tr><td>AI-assisted conversation workflows</td><td>Tool-calling orchestration with a bounded reasoning loop and propose/confirm control.</td></tr>
  <tr><td>Business messaging integrations</td><td>Signature-verified webhooks in, transactional/OAuth notification channels out, provider reconciliation.</td></tr>
  <tr><td>Workflow orchestration</td><td>Multi-step lifecycles (quote &rarr; follow-up &rarr; job &rarr; payment) with explicit status transitions.</td></tr>
  <tr><td>Contact / status tracking</td><td>CRM entity with tags, plus status-driven follow-up pipeline (hot/warm/cold).</td></tr>
  <tr><td>Manual takeover</td><td>Human-in-the-loop approval gate and admin overrides; generalizes to per-contact pause/takeover.</td></tr>
  <tr><td>Follow-up logic</td><td>Auto-created follow-ups, snooze/next-contact timing, scheduled reminder jobs.</td></tr>
  <tr><td>Logs &amp; analytics</td><td>Audit tables, usage/cost ledgers, and a reporting layer over operational data.</td></tr>
  <tr><td>Scaling across operators/accounts</td><td>Multi-tenant model with per-user scoping, RLS, roles, and subscription tiers.</td></tr>
</table>

<div class="note">In short: the platform shows <b>AI orchestration, dashboard-driven operations, backend state management, real API integrations, user-facing workflow design, and production SaaS architecture</b> &mdash; the exact foundations a conversational workflow system is built on.</div>

<!-- ============ 11. MVP ARCHITECTURE ============ -->
<div class="pagebreak"></div>
${sec(10, 'Recommended MVP Architecture')}
<p class="lead">A proposed, lean architecture for an AI assistant workflow system, expressed in neutral channel terminology and grounded in the patterns above. This is a recommendation, not an existing feature of the platform.</p>

<img class="diagram" src="${img('diagram-mvp.png')}" />
<p class="caption">Inbound message channel &rarr; orchestration &rarr; contact/session lookup &rarr; pause/manual-takeover check &rarr; AI reasoning &rarr; response generation &rarr; outbound notification channel &rarr; status/tag update &rarr; logs/analytics.</p>

<div class="grid2">
  <div>
    <h3>State &amp; eligibility</h3>
    <ul>
      <li>Contact statuses (new, active, awaiting reply, won, lost).</li>
      <li>Tags / segments for routing and broadcasts.</li>
      <li>Follow-up eligibility and timing windows.</li>
    </ul>
  </div>
  <div>
    <h3>Safety &amp; control</h3>
    <ul>
      <li>Manual takeover with automatic pause/resume.</li>
      <li>Broadcast-safety / opt-out rules before any send.</li>
      <li>Rate and budget guardrails on the AI layer.</li>
      <li>Full message + state-change audit log.</li>
    </ul>
  </div>
</div>
<div class="callout"><b>Why this is credible.</b> Each block maps to something already shipped here: orchestration and tool routing (AI chat), pause/approval (propose/confirm + pending-actions queue), status/tags (follow-ups + customers), and logging (audit + usage ledgers). The MVP is an assembly of proven parts, not a research project. <span class="pill future">Proposed</span></div>

<!-- ============ 12. ONE-PAGE SUMMARY ============ -->
<div class="pagebreak"></div>
${sec(11, 'One-Page Summary')}
<div class="summarybox">
  <h3 style="margin-top:0">What it is</h3>
  <p style="margin-top:2px">A production, multi-tenant AI SaaS for service businesses: track jobs and profit, build and send quotes, run a follow-up pipeline, collect payments, and operate the whole thing through a tool-calling AI assistant that asks for confirmation before it changes anything.</p>

  <h3>What Dev built / owns</h3>
  <p style="margin-top:2px">The full stack &mdash; product UI, ~69 API route handlers, the AI orchestration layer (21 tools + propose/confirm), a ~25-table relational data model with 45+ migrations, integrations for auth, billing, merchant payouts, email, maps, and monitoring, plus the operational tooling (admin, webhooks, cron jobs, rate/budget guardrails).</p>

  <h3>What the architecture demonstrates</h3>
  <p style="margin-top:2px">AI orchestration with human-in-the-loop control, backend state machines with audit logging, real third-party API integrations, multi-tenant SaaS security (auth, RLS, roles, tiers), and production deployment hygiene.</p>

  <h3>Why it is relevant to AI SaaS &amp; automation workflows</h3>
  <p style="margin-top:2px">The same primitives a conversational workflow system needs &mdash; orchestration, contact/status tracking, manual takeover, follow-up logic, logs/analytics, and per-account scaling &mdash; are already shipped here in a different product. The recommended MVP is an assembly of these proven parts.</p>

  <h3>Technical highlights</h3>
  <ul style="margin-top:2px">
    <li>Tool-calling AI with strict schemas, bounded loops, and no silent writes.</li>
    <li>Rate limiting, daily cost budget, and credit accounting on the AI layer.</li>
    <li>Status-driven workflows (jobs, quotes, follow-ups, payments, pending actions).</li>
    <li>Webhook verification, service-role isolation, RLS, and an append-only audit trail.</li>
  </ul>

  <div class="thumbstrip">
    <img src="${img('dashboard.png')}" />
    <img src="${img('followUps.png')}" />
    <img src="${img('assistant.png')}" />
    <img src="${img('payments.png')}" />
    <img src="${img('reports.png')}" />
    <img src="${img('diagram-ai-flow.png')}" />
  </div>
</div>

<div class="footer">AI SaaS Platform Technical Showcase &nbsp;&middot;&nbsp; Prepared by Dev Ganugapenta / InitDev &nbsp;&middot;&nbsp; Platform: dyia. Screenshots captured live from the running application in Demo Mode (sample data only). "Implemented" items are verifiable in the codebase; "Proposed" items are recommended extensions and are not presented as existing features.</div>

</body></html>`

// Write the HTML to a real file so the document has a file:// base URL.
// (page.setContent runs on about:blank, where Chromium blocks file:// images.)
const TMP_HTML = join(DIR, '_showcase.tmp.html')
writeFileSync(TMP_HTML, html)

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] })
const page = await browser.newPage()
await page.goto(pathToFileURL(TMP_HTML).href, { waitUntil: 'networkidle0' })
// Force every embedded image to finish decoding before printing, so no
// file:// asset renders as a broken-image placeholder in the PDF.
await page.evaluate(async () => {
  await Promise.all(
    Array.from(document.images).map((i) =>
      i.complete && i.naturalWidth > 0 ? Promise.resolve() : i.decode().catch(() => {})
    )
  )
})
await new Promise((r) => setTimeout(r, 400))
await page.pdf({
  path: OUT_FILE,
  format: 'A4',
  margin: { top: '13mm', right: '12mm', bottom: '14mm', left: '12mm' },
  printBackground: true,
})
await browser.close()
rmSync(TMP_HTML, { force: true })
console.log(`PDF written: ${OUT_FILE}`)
