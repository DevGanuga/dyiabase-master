// Email templates for Dyia notifications
// These generate HTML strings for Resend

const baseStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; }
  .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
  .logo { height: 32px; margin-bottom: 24px; }
  .header { font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 16px; }
  .subheader { font-size: 18px; font-weight: 600; color: #334155; margin-bottom: 12px; }
  .text { font-size: 16px; color: #475569; margin-bottom: 16px; }
  .text-small { font-size: 14px; color: #64748b; }
  .btn { display: inline-block; padding: 12px 24px; background: linear-gradient(to right, #f97316, #f59e0b); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
  .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 16px 0; }
  .metric { font-size: 28px; font-weight: 700; color: #0f172a; }
  .metric-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
  .divider { height: 1px; background: #e2e8f0; margin: 24px 0; }
  .footer { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 32px; }
  .highlight { background: linear-gradient(to right, #fef3c7, #fed7aa); padding: 2px 6px; border-radius: 4px; }
`

function wrap(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <img src="https://dyia.io/dyia-logo-full.png" alt="Dyia" class="logo" />
    ${content}
    <div class="footer">
      <p>Dyia - Your Day, Decoded</p>
      <p>© ${new Date().getFullYear()} Dyia. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`
}

// Welcome email
export function welcomeEmail(firstName: string): string {
  return wrap(`
    <h1 class="header">Welcome to Dyia, ${firstName}! 🎉</h1>
    <p class="text">
      You're on your way to taking control of your business finances. 
      Dyia helps you track jobs, create quotes, and understand your profits—all in one place.
    </p>
    <div class="card">
      <p class="subheader">Get started in 3 steps:</p>
      <ol class="text">
        <li>Log your first job to start tracking revenue</li>
        <li>Set up your business info in Settings</li>
        <li>Try the AI assistant to log jobs by voice</li>
      </ol>
    </div>
    <p style="text-align: center; margin-top: 24px;">
      <a href="https://dyia.io/app" class="btn">Open Dyia</a>
    </p>
  `)
}

// Trial ending email (2 days before)
export function trialEndingEmail(firstName: string, daysLeft: number): string {
  return wrap(`
    <h1 class="header">Your Pro trial ends in ${daysLeft} days</h1>
    <p class="text">
      Hi ${firstName}, just a heads up—your free Pro trial is ending soon.
    </p>
    <div class="card">
      <p class="subheader">What you'll lose access to:</p>
      <ul class="text">
        <li>AI business insights and recommendations</li>
        <li>Revenue forecasting</li>
        <li>Smart follow-up reminders</li>
        <li>AI pricing suggestions</li>
      </ul>
    </div>
    <p class="text">
      Upgrade now to keep these powerful features and continue growing your business.
    </p>
    <p style="text-align: center; margin-top: 24px;">
      <a href="https://dyia.io/app?upgrade=true" class="btn">Upgrade to Pro</a>
    </p>
  `)
}

// Weekly insights email
export interface WeeklyInsightsData {
  revenue: number
  revenueChange: number
  profit: number
  jobCount: number
  avgJobValue: number
  topSource: string
  insights: string[]
  recommendations: string[]
}

export function weeklyInsightsEmail(firstName: string, data: WeeklyInsightsData): string {
  const changeIcon = data.revenueChange >= 0 ? '📈' : '📉'
  const changeColor = data.revenueChange >= 0 ? '#16a34a' : '#dc2626'
  
  return wrap(`
    <h1 class="header">Your Weekly Business Insights</h1>
    <p class="text">Hi ${firstName}, here's how your business performed this week:</p>
    
    <div style="display: flex; gap: 16px; margin: 24px 0;">
      <div class="card" style="flex: 1; text-align: center;">
        <p class="metric" style="color: #16a34a;">$${data.revenue.toLocaleString()}</p>
        <p class="metric-label">Revenue</p>
        <p class="text-small" style="color: ${changeColor};">${changeIcon} ${data.revenueChange >= 0 ? '+' : ''}${data.revenueChange}%</p>
      </div>
      <div class="card" style="flex: 1; text-align: center;">
        <p class="metric" style="color: #7c3aed;">$${data.profit.toLocaleString()}</p>
        <p class="metric-label">Profit</p>
      </div>
    </div>
    
    <div class="card">
      <p class="subheader">This Week</p>
      <p class="text">
        You completed <strong>${data.jobCount} jobs</strong> with an average value of 
        <strong>$${data.avgJobValue.toLocaleString()}</strong>.
        ${data.topSource ? `Your top lead source was <span class="highlight">${data.topSource}</span>.` : ''}
      </p>
    </div>
    
    ${data.insights.length > 0 ? `
    <div class="card">
      <p class="subheader">💡 Insights</p>
      <ul class="text">
        ${data.insights.map(i => `<li>${i}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    ${data.recommendations.length > 0 ? `
    <div class="card" style="background: linear-gradient(to right, #fef3c7, #fed7aa);">
      <p class="subheader">🎯 Recommendations</p>
      <ul class="text">
        ${data.recommendations.map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    <p style="text-align: center; margin-top: 24px;">
      <a href="https://dyia.io/app" class="btn">View Full Dashboard</a>
    </p>
  `)
}

// Follow-up reminder email
export interface FollowUpData {
  customerName: string
  quoteAmount: string
  daysSinceQuote: number
  jobDescription?: string
}

export function followUpReminderEmail(firstName: string, followUps: FollowUpData[]): string {
  return wrap(`
    <h1 class="header">You have ${followUps.length} quote${followUps.length > 1 ? 's' : ''} to follow up on</h1>
    <p class="text">
      Hi ${firstName}, these customers are waiting to hear from you:
    </p>
    
    ${followUps.map(f => `
      <div class="card">
        <p class="subheader">${f.customerName}</p>
        <p class="text-small">Quote: ${f.quoteAmount} • ${f.daysSinceQuote} days ago</p>
        ${f.jobDescription ? `<p class="text-small">${f.jobDescription}</p>` : ''}
      </div>
    `).join('')}
    
    <p class="text">
      Following up within the first few days dramatically increases your conversion rate!
    </p>
    
    <p style="text-align: center; margin-top: 24px;">
      <a href="https://dyia.io/app?view=followUps" class="btn">View Follow-ups</a>
    </p>
  `)
}

// Subscription confirmed email
export function subscriptionConfirmedEmail(firstName: string, plan: 'monthly' | 'annual'): string {
  const planLabel = plan === 'annual' ? 'Annual' : 'Monthly'
  
  return wrap(`
    <h1 class="header">Welcome to Dyia Pro! 🚀</h1>
    <p class="text">
      Hi ${firstName}, your ${planLabel} Pro subscription is now active. 
      You have full access to all of Dyia's powerful features.
    </p>
    
    <div class="card">
      <p class="subheader">What's included in Pro:</p>
      <ul class="text">
        <li>✨ AI-powered business insights</li>
        <li>📊 Revenue forecasting</li>
        <li>🔔 Smart follow-up reminders</li>
        <li>💰 AI pricing recommendations</li>
        <li>📧 Weekly performance emails</li>
      </ul>
    </div>
    
    <p class="text">
      Have questions? Reply to this email or chat with Dyia AI in the app.
    </p>
    
    <p style="text-align: center; margin-top: 24px;">
      <a href="https://dyia.io/app" class="btn">Go to Dashboard</a>
    </p>
  `)
}

// Monthly report email
export interface MonthlyReportData {
  month: string
  revenue: number
  profit: number
  profitMargin: number
  jobCount: number
  avgJobValue: number
  comparedToLastMonth: {
    revenue: number
    profit: number
    jobCount: number
  }
  topSources: { name: string; count: number; revenue: number }[]
  insights: string
}

export function monthlyReportEmail(firstName: string, data: MonthlyReportData): string {
  return wrap(`
    <h1 class="header">${data.month} Business Report</h1>
    <p class="text">Hi ${firstName}, here's your monthly performance summary:</p>
    
    <div style="display: flex; gap: 12px; margin: 24px 0;">
      <div class="card" style="flex: 1; text-align: center;">
        <p class="metric" style="color: #16a34a;">$${data.revenue.toLocaleString()}</p>
        <p class="metric-label">Revenue</p>
      </div>
      <div class="card" style="flex: 1; text-align: center;">
        <p class="metric" style="color: #7c3aed;">$${data.profit.toLocaleString()}</p>
        <p class="metric-label">Profit</p>
      </div>
      <div class="card" style="flex: 1; text-align: center;">
        <p class="metric">${data.profitMargin}%</p>
        <p class="metric-label">Margin</p>
      </div>
    </div>
    
    <div class="card">
      <p class="subheader">📊 vs Last Month</p>
      <p class="text">
        Revenue: ${data.comparedToLastMonth.revenue >= 0 ? '+' : ''}${data.comparedToLastMonth.revenue}% •
        Profit: ${data.comparedToLastMonth.profit >= 0 ? '+' : ''}${data.comparedToLastMonth.profit}% •
        Jobs: ${data.comparedToLastMonth.jobCount >= 0 ? '+' : ''}${data.comparedToLastMonth.jobCount}%
      </p>
    </div>
    
    ${data.topSources.length > 0 ? `
    <div class="card">
      <p class="subheader">🎯 Top Lead Sources</p>
      ${data.topSources.slice(0, 3).map((s, i) => `
        <p class="text">${i + 1}. ${s.name} — ${s.count} jobs, $${s.revenue.toLocaleString()}</p>
      `).join('')}
    </div>
    ` : ''}
    
    <div class="card" style="background: linear-gradient(to right, #f0f9ff, #e0f2fe);">
      <p class="subheader">💡 AI Analysis</p>
      <p class="text">${data.insights}</p>
    </div>
    
    <p style="text-align: center; margin-top: 24px;">
      <a href="https://dyia.io/app?view=reports" class="btn">View Full Report</a>
    </p>
  `)
}

// Profit leak quiz report (lead funnel)
export interface QuizReportData {
  firstName: string
  totalMonthlyLoss: number
  annualLoss: number
  breakdown: Record<string, number>
  resultsUrl: string
  appUrl: string
}

export function quizReportEmail(data: QuizReportData): string {
  const { firstName, totalMonthlyLoss, annualLoss, breakdown, resultsUrl, appUrl } = data
  const trialUrl = `${appUrl}/sign-up?redirect_url=${encodeURIComponent(appUrl + '/app')}&utm_source=profit_calculator`
  const parts: string[] = []
  if (breakdown.followup > 0) parts.push(`Follow-ups: $${breakdown.followup}/mo`)
  if (breakdown.expenses > 0) parts.push(`Expenses: $${breakdown.expenses}/mo`)
  if (breakdown.pricing > 0) parts.push(`Pricing: $${breakdown.pricing}/mo`)
  if (breakdown.multitrip > 0) parts.push(`Multi-trip: $${breakdown.multitrip}/mo`)
  if (breakdown.visibility > 0) parts.push(`Visibility: $${breakdown.visibility}/mo`)
  const breakdownList = parts.length ? parts.join(' • ') : 'See your results for details.'

  return wrap(`
    <h1 class="header">Your Profit Leak Report</h1>
    <p class="text">Hi ${firstName}, here's your personalized report based on the quiz.</p>
    <div class="card">
      <p class="metric" style="color: #f97316;">$${totalMonthlyLoss.toLocaleString()}/month</p>
      <p class="metric-label">Estimated profit you're leaving on the table</p>
      <p class="text-small">That's $${annualLoss.toLocaleString()} per year.</p>
    </div>
    <div class="card">
      <p class="subheader">Where it's leaking</p>
      <p class="text">${breakdownList}</p>
    </div>
    <p class="text">Every one of these is fixable. Dyia helps junk removal pros plug these leaks with follow-up tracking, per-job expenses, and real-time profit visibility.</p>
    <p style="text-align: center; margin-top: 24px;">
      <a href="${resultsUrl}" class="btn">View full results</a>
      &nbsp;
      <a href="${trialUrl}" class="btn">Start your 14-day free trial</a>
    </p>
    <p class="text-small" style="margin-top: 24px;">No credit card required. Cancel anytime.</p>
  `)
}
