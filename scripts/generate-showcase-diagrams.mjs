/**
 * Render the four branded architecture diagrams used in the AI SaaS Platform
 * Technical Showcase PDF, as standalone PNG image files.
 *
 *   node scripts/generate-showcase-diagrams.mjs
 *
 * Output: claudedocs/ai-showcase/assets/diagram-*.png
 *
 * Diagrams are pure HTML/CSS rendered to PNG via Puppeteer so they match the
 * PDF's typography and orange brand accent and stay editable in source.
 */

import puppeteer from 'puppeteer'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'claudedocs', 'ai-showcase', 'assets')
mkdirSync(OUT, { recursive: true })

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #0f172a; background: #ffffff; }
  #card { width: 1180px; padding: 40px 44px 44px; background: #ffffff; }
  .dtitle { font-size: 24px; font-weight: 800; letter-spacing: -0.4px; color: #0f172a; }
  .dsub { font-size: 13px; color: #64748b; margin-top: 4px; }
  .rule { height: 4px; width: 64px; background: linear-gradient(90deg,#f97316,#f59e0b); border-radius: 2px; margin: 14px 0 24px; }

  .lane { border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 16px 16px; margin: 0 0 6px; background: #f8fafc; }
  .lane-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .12em; color: #c2410c; margin-bottom: 10px; }
  .lane-label .impl { color: #16a34a; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; }
  .row.j { justify-content: center; }

  .box { flex: 1; min-width: 150px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 11px 13px; box-shadow: 0 1px 3px rgba(15,23,42,.05); }
  .box .h { font-size: 12.5px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 7px; }
  .box .d { font-size: 10.5px; color: #64748b; margin-top: 4px; line-height: 1.45; }
  .box.accent { border-color: #fdba74; background: #fff7ed; }
  .box.dark { background: #0f172a; border-color: #0f172a; }
  .box.dark .h { color: #fff; } .box.dark .d { color: #cbd5e1; }
  .box.future { border-style: dashed; border-color: #cbd5e1; background: #fff; }
  .box.future .h { color: #475569; }

  .ico { width: 22px; height: 22px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; flex: none; background: linear-gradient(135deg,#f97316,#f59e0b); color: #fff; font-weight: 800; }
  .ico.slate { background: #1e293b; }
  .ico.green { background: linear-gradient(135deg,#16a34a,#22c55e); }
  .ico.blue { background: linear-gradient(135deg,#2563eb,#3b82f6); }
  .ico.violet { background: linear-gradient(135deg,#7c3aed,#a855f7); }

  .arrow { text-align: center; color: #f97316; font-size: 16px; line-height: 1; margin: 3px 0; font-weight: 700; }
  .tag { display: inline-block; font-size: 9px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; padding: 2px 7px; border-radius: 999px; vertical-align: middle; }
  .tag.impl { background: #dcfce7; color: #166534; }
  .tag.future { background: #f1f5f9; color: #475569; border: 1px dashed #cbd5e1; }

  .legend { margin-top: 16px; font-size: 10px; color: #64748b; display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
  .legend b { color: #334155; }
  .sw { display: inline-block; width: 18px; height: 11px; border-radius: 3px; vertical-align: middle; margin-right: 5px; }

  /* flow (vertical numbered steps) */
  .step { display: flex; gap: 14px; align-items: stretch; }
  .num { width: 30px; height: 30px; flex: none; border-radius: 50%; background: linear-gradient(135deg,#f97316,#f59e0b); color: #fff; font-weight: 800; font-size: 13px; display: flex; align-items: center; justify-content: center; }
  .num.slate { background: #1e293b; }
  .num.green { background: linear-gradient(135deg,#16a34a,#22c55e); }
  .connector { width: 30px; display: flex; justify-content: center; }
  .connector .line { width: 2px; height: 14px; background: #fdba74; }
  .stepbody { flex: 1; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 13px; box-shadow: 0 1px 3px rgba(15,23,42,.05); }
  .stepbody.dark { background: #0f172a; border-color: #0f172a; }
  .stepbody.dark .sh { color: #fff; } .stepbody.dark .sd { color: #cbd5e1; }
  .stepbody.gate { border-color: #fdba74; background: #fff7ed; }
  .sh { font-size: 12.5px; font-weight: 700; color: #0f172a; }
  .sd { font-size: 10.5px; color: #64748b; margin-top: 3px; line-height: 1.45; }

  .cols { display: flex; gap: 22px; }
  .side { width: 300px; flex: none; }
  .panel { border: 1px solid #e2e8f0; border-radius: 12px; padding: 13px 15px; margin-bottom: 12px; background: #f8fafc; }
  .panel h4 { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; color: #c2410c; margin-bottom: 8px; }
  .panel ul { list-style: none; }
  .panel li { font-size: 10.5px; color: #334155; margin: 5px 0; padding-left: 14px; position: relative; line-height: 1.4; }
  .panel li::before { content: '▸'; position: absolute; left: 0; color: #f97316; }

  /* ERD */
  .erd { display: flex; flex-direction: column; gap: 16px; }
  .tier { display: flex; gap: 14px; justify-content: center; }
  .ent { flex: 1; max-width: 270px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #fff; box-shadow: 0 1px 3px rgba(15,23,42,.05); }
  .ent .et { background: #0f172a; color: #fff; font-size: 11.5px; font-weight: 800; padding: 7px 11px; font-family: 'JetBrains Mono', monospace; }
  .ent.hub .et { background: linear-gradient(135deg,#f97316,#f59e0b); }
  .ent.audit .et { background: #475569; }
  .ent .ef { padding: 8px 11px; font-size: 10px; color: #475569; line-height: 1.6; }
  .ent .ef .k { color: #0f172a; font-weight: 600; }
  .ent .ef .st { color: #c2410c; }
  .relnote { text-align: center; font-size: 10px; color: #94a3b8; margin: -6px 0 -2px; }
`

function page(title, sub, inner) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
  <body><div id="card">
    <div class="dtitle">${title}</div>
    <div class="dsub">${sub}</div>
    <div class="rule"></div>
    ${inner}
  </div></body></html>`
}

const downArrow = '<div class="arrow">&#9660;</div>'

// ---------------------------------------------------------------------------
// 1. System architecture
// ---------------------------------------------------------------------------
const architecture = page(
  'System Architecture',
  'Actual request and data flow across the platform. Green = implemented today. Dashed = recommended extension.',
  `
  <div class="lane">
    <div class="lane-label"><span class="impl">CLIENT</span></div>
    <div class="row j">
      <div class="box"><div class="h"><span class="ico blue">UI</span>Web app (React 19)</div><div class="d">Next.js App Router SPA shell + 30+ marketing/tool pages. Responsive desktop & mobile.</div></div>
      <div class="box"><div class="h"><span class="ico blue">M</span>Mobile-responsive views</div><div class="d">Same components, bottom-nav layout, touch targets.</div></div>
    </div>
  </div>
  ${downArrow}
  <div class="lane">
    <div class="lane-label"><span class="impl">EDGE / AUTH</span></div>
    <div class="row j">
      <div class="box accent"><div class="h"><span class="ico">A</span>Auth middleware</div><div class="d">Session gate on <b>/app(.*)</b>, demo-cookie bypass, Content-Security-Policy.</div></div>
      <div class="box accent"><div class="h"><span class="ico">P</span>Permissions</div><div class="d">Subscription tiers (basic / trial / pro), feature gating, admin roles.</div></div>
    </div>
  </div>
  ${downArrow}
  <div class="lane">
    <div class="lane-label"><span class="impl">APPLICATION</span></div>
    <div class="row j">
      <div class="box"><div class="h"><span class="ico slate">RH</span>API route handlers (~69)</div><div class="d">Auth + AI + payments + admin + intel + cron. Validation, rate-limit, typed responses.</div></div>
      <div class="box"><div class="h"><span class="ico slate">SP</span>Server components</div><div class="d">Server-side auth checks, layouts, PDF generation utilities.</div></div>
    </div>
  </div>
  ${downArrow}
  <div class="lane">
    <div class="lane-label"><span class="impl">AI PROCESSING</span></div>
    <div class="row j">
      <div class="box dark"><div class="h"><span class="ico">AI</span>LLM orchestration</div><div class="d">Stateful Responses API, 21 strict-schema tools, tool-call loop, propose/confirm.</div></div>
      <div class="box"><div class="h"><span class="ico violet">H</span>Tool handlers (service role)</div><div class="d">Execute reads/writes, embeddings, customer linking, memory.</div></div>
      <div class="box"><div class="h"><span class="ico violet">PQ</span>Pending-action queue</div><div class="d">Human-confirmed writes; 7-day expiry; status tracked.</div></div>
    </div>
  </div>
  ${downArrow}
  <div class="lane">
    <div class="lane-label"><span class="impl">DATA</span></div>
    <div class="row j">
      <div class="box"><div class="h"><span class="ico green">DB</span>Postgres (~25 tables)</div><div class="d">Row-level security, status fields, created/updated audit columns, triggers.</div></div>
      <div class="box"><div class="h"><span class="ico green">V</span>Vector embeddings</div><div class="d">pgvector job-similarity search (1536-dim).</div></div>
    </div>
  </div>
  ${downArrow}
  <div class="lane">
    <div class="lane-label">EXTERNAL INTEGRATIONS &amp; OPS &nbsp;<span class="impl">· implemented</span></div>
    <div class="row j">
      <div class="box"><div class="h"><span class="ico">$</span>Payments + payouts</div><div class="d">Subscriptions, merchant Connect, webhooks.</div></div>
      <div class="box"><div class="h"><span class="ico">@</span>Outbound notification channel</div><div class="d">Transactional + provider-OAuth email.</div></div>
      <div class="box"><div class="h"><span class="ico">G</span>Maps / geocoding</div><div class="d">Address autocomplete, route planning.</div></div>
      <div class="box"><div class="h"><span class="ico slate">W</span>Webhooks + cron + audit log</div><div class="d">Lifecycle events, scheduled jobs, event log.</div></div>
      <div class="box"><div class="h"><span class="ico slate">O</span>Rate-limit · usage budget · errors</div><div class="d">Redis limits, daily AI budget, Sentry.</div></div>
      <div class="box future"><div class="h">+ Inbound message channel</div><div class="d">Recommended extension for conversational workflows.</div></div>
    </div>
  </div>
  <div class="legend">
    <span><span class="sw" style="background:#fff7ed;border:1px solid #fdba74"></span><b>Auth / gate</b></span>
    <span><span class="sw" style="background:#0f172a"></span><b>AI orchestration</b></span>
    <span><span class="sw" style="background:#fff;border:1px dashed #cbd5e1"></span><b>Recommended extension</b></span>
  </div>
  `
)

// ---------------------------------------------------------------------------
// 2. AI request lifecycle
// ---------------------------------------------------------------------------
function step(num, cls, title, desc, { connector = true } = {}) {
  return `<div class="step"><div class="num ${cls}">${num}</div><div class="stepbody ${cls === 'slate' ? '' : ''} ${title.startsWith('Guard') ? '' : ''}">${''}<div class="sh">${title}</div><div class="sd">${desc}</div></div></div>${connector ? '<div class="step"><div class="connector"><div class="line"></div></div><div></div></div>' : ''}`
}
const aiFlow = page(
  'AI Request Lifecycle',
  'How a single user message becomes a guarded, persisted, optionally human-approved action.',
  `
  <div class="cols">
    <div style="flex:1">
      ${step(1, '', 'User message', 'Free text, optional image or CSV/file context, conversation id, prior response id.')}
      ${step(2, 'slate', 'Access &amp; credit gate', 'Pro subscription OR AI-credit balance &gt; 0; per-IP rate limit (30/min); daily spend budget check.')}
      ${step(3, '', 'Responses API call', 'Stateful call with system instructions + 21 strict-schema tools; store=true; previous_response_id threads context.')}
      ${step(4, '', 'Tool-call loop (&le; 10 iterations)', 'Model selects tools. Read tools return data to the model; the loop continues until a final answer.')}
      ${step(5, 'slate', 'Branch: propose vs. direct write', 'Mutating intents (new job / quote) become PROPOSALS, not silent writes. Read + low-risk tools execute directly.')}
      ${step(6, 'green', 'Human confirm (pending action)', 'Proposal is stored and surfaced as a preview card. The user confirms or dismisses before any record is created.')}
      ${step(7, 'green', 'Confirmed write to database', 'On approval, the handler writes the record (service role), links the customer, and may trigger follow-ups / embeddings.')}
      ${step(8, '', 'Persist + account', 'Final assistant text saved to thread + messages; tokens, tool calls, credit cost and usage logged.', { connector: false })}
    </div>
    <div class="side">
      <div class="panel">
        <h4>Guardrails (implemented)</h4>
        <ul>
          <li>No automatic SDK retries (deterministic outcomes)</li>
          <li>Max output tokens per response</li>
          <li>Max tool iterations per request</li>
          <li>Strict JSON tool schemas, no extra fields</li>
          <li>Per-IP rate limiting (Redis)</li>
          <li>Daily cost budget + alert thresholds</li>
          <li>Subscription / credit enforcement</li>
        </ul>
      </div>
      <div class="panel">
        <h4>Persisted per turn</h4>
        <ul>
          <li>Thread + message rows</li>
          <li>Tool calls &amp; tool results</li>
          <li>Tokens used &amp; credit cost</li>
          <li>Usage / budget ledger</li>
          <li>Cross-thread user memory</li>
        </ul>
      </div>
    </div>
  </div>
  `
)

// ---------------------------------------------------------------------------
// 3. Data model
// ---------------------------------------------------------------------------
function ent(cls, name, fields) {
  return `<div class="ent ${cls}"><div class="et">${name}</div><div class="ef">${fields}</div></div>`
}
const dataModel = page(
  'Core Data Model &amp; State',
  'Primary entities, status fields, and ownership relationships. Every table carries created/updated audit columns.',
  `
  <div class="erd">
    <div class="tier">
      ${ent('hub', 'users', '<span class="k">identity</span> · billing · connect<br>role: <span class="st">user / admin / super_admin</span><br>subscription_status: <span class="st">active / trialing / past_due / canceled</span><br>ai_credits_balance')}
    </div>
    <div class="relnote">&#9660;&nbsp; one user owns &nbsp;&#9660;</div>
    <div class="tier">
      ${ent('', 'settings', 'tax % · monthly_goal · business_info<br>onboarding_completed · email_prefs')}
      ${ent('', 'customers', 'name · email · phone · address<br>tags[] &nbsp; (CRM spine)')}
      ${ent('', 'threads', 'title · openai_thread_id<br>message_count · last_message_at')}
    </div>
    <div class="relnote">customers &#8594; link jobs &amp; quotes &nbsp;|&nbsp; threads &#8594; messages</div>
    <div class="tier">
      ${ent('', 'jobs', 'date · revenue · expenses · embedding<br>status: <span class="st">scheduled / in_progress / completed / cancelled</span><br>payment_status')}
      ${ent('', 'quotes', 'pricing · estimate_low/high · total<br>status: <span class="st">draft / sent / accepted / declined / expired</span><br>job_id (nullable)')}
      ${ent('', 'messages', 'role · content<br>tool_calls · tool_results<br>tokens_used · credit_cost')}
    </div>
    <div class="relnote">quotes &#8594; follow_ups &nbsp;|&nbsp; quotes &amp; jobs &#8594; payments</div>
    <div class="tier">
      ${ent('', 'follow_ups', 'priority (hot / warm / cold)<br>status: <span class="st">pending / contacted / converted / lost / snoozed</span><br>next_follow_up_at · contact_count')}
      ${ent('', 'payments', 'public_token · amounts · tips<br>status: <span class="st">pending / paid / failed / refunded</span><br>kind: link / invoice / quote / job')}
      ${ent('', 'pending_actions', 'action_type · proposal_data<br>status: <span class="st">pending / confirmed / cancelled / expired</span><br>expires_at')}
    </div>
    <div class="relnote">&#183; audit &amp; observability tables &#183;</div>
    <div class="tier">
      ${ent('audit', 'webhook_events', 'source · event_type · payload · status · error')}
      ${ent('audit', 'openai_usage', 'tokens_in/out · cost_estimate_usd · source')}
      ${ent('audit', 'credit_transactions', 'type · amount · balance_after · stripe_payment_id')}
    </div>
  </div>
  `
)

// ---------------------------------------------------------------------------
// 4. Proposed MVP messaging-assistant architecture
// ---------------------------------------------------------------------------
const mvp = page(
  'Recommended MVP Architecture &mdash; AI Assistant Workflow',
  'Proposed architecture, framed on the engineering patterns this platform already demonstrates. Neutral channel terminology.',
  `
  <div class="cols">
    <div style="flex:1">
      ${step(1, '', 'Inbound message channel', 'Approved business messaging API delivers an inbound message via webhook into the orchestration layer.')}
      ${step(2, 'slate', 'Workflow orchestration layer', 'Validates, rate-limits, and routes the event; loads conversation state and decides the next action.')}
      ${step(3, '', 'Contact / session lookup', 'Resolve or create the contact; load status, tags/segments, history and follow-up eligibility.')}
      ${step(4, 'green', 'Pause / manual-takeover check', 'If an operator has taken over or automation is paused for this contact, STOP auto-replies and route to a human.')}
      ${step(5, '', 'AI reasoning layer', 'Guarded LLM call (token caps, budget, strict tools, retries policy) produces intent + a candidate response.')}
      ${step(6, '', 'Response generation', 'Template + AI text; optional human approval step for sensitive or first-contact messages.')}
      ${step(7, 'slate', 'Outbound notification channel', 'Send via the approved messaging API, respecting broadcast-safety rules and rate windows.')}
      ${step(8, 'green', 'Status / tag update', 'Update contact status, apply tags/segments, set next follow-up timing based on the interaction.')}
      ${step(9, '', 'Logs / analytics', 'Persist message, tool calls, latency, cost, and state changes for audit and reporting.', { connector: false })}
    </div>
    <div class="side">
      <div class="panel">
        <h4>Contact state</h4>
        <ul>
          <li>Statuses: new · active · awaiting reply · won · lost</li>
          <li>Tags / segments for routing &amp; broadcasts</li>
          <li>Follow-up eligibility &amp; timing windows</li>
        </ul>
      </div>
      <div class="panel">
        <h4>Manual control</h4>
        <ul>
          <li>AI acts by default when rules allow</li>
          <li>Human can take over at any time</li>
          <li>Automation pauses during takeover</li>
          <li>State change is logged</li>
          <li>Resumes only on an approved condition</li>
        </ul>
      </div>
      <div class="panel">
        <h4>Safety &amp; observability</h4>
        <ul>
          <li>Broadcast-safety / opt-out rules</li>
          <li>Rate &amp; budget guardrails</li>
          <li>Full message + action audit log</li>
        </ul>
      </div>
    </div>
  </div>
  <div class="legend"><span class="tag future">Proposed architecture</span> &nbsp; Built on patterns already implemented: AI orchestration, propose/confirm human-in-the-loop, state machines, webhooks, audit logging, and dashboard-driven operations.</div>
  `
)

const DIAGRAMS = [
  { name: 'diagram-architecture', html: architecture },
  { name: 'diagram-ai-flow', html: aiFlow },
  { name: 'diagram-data-model', html: dataModel },
  { name: 'diagram-mvp', html: mvp },
]

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] })
const pg = await browser.newPage()
await pg.setViewport({ width: 1200, height: 1200, deviceScaleFactor: 2 })
for (const d of DIAGRAMS) {
  await pg.setContent(d.html, { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 400))
  const el = await pg.$('#card')
  const path = join(OUT, `${d.name}.png`)
  await el.screenshot({ path })
  console.log(`  ✓ ${d.name}.png`)
}
await browser.close()
console.log('Diagrams written to', OUT)
