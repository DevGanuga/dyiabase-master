# dyia AI Features Roadmap

A comprehensive guide to AI-powered features that can differentiate dyia from competitors and justify premium subscription tiers.

---

## Overview

AI features should focus on:
- **Time savings** - Reduce manual data entry
- **Better decisions** - Data-driven pricing and scheduling
- **Actionable insights** - Turn data into recommendations
- **Competitive advantage** - Features competitors don't have

---

## Basic Tier Enhancements ($12.99/mo)

### 1. Smart Quote Pricing
**What it does**: AI analyzes past jobs to suggest pricing for new quotes.

**User experience**:
- User starts a new quote
- AI suggests: *"Based on 47 similar jobs, recommend $180-$220"*
- Learns from your pricing patterns over time

**Technical approach**:
- Vector similarity on job descriptions
- Factor in: job type, location, photos, customer type
- Simple ML model trained on user's historical data

**Value**: Faster quoting, more consistent pricing, higher close rates

---

### 2. Natural Language Job Entry
**What it does**: Voice or text input that AI parses into structured data.

**User experience**:
```
User types: "Did a cleanout for Mike on Oak St, made $300, spent $45 on dump"

AI extracts:
- Customer: Mike
- Location: Oak St
- Revenue: $300
- Dump fee: $45
- Job type: Cleanout
```

**Technical approach**:
- GPT-based entity extraction
- Structured output parsing
- Confirmation step before saving

**Value**: 10x faster job logging, especially on mobile

---

### 3. Expense Auto-Categorization
**What it does**: Upload receipt photos, AI extracts and categorizes.

**User experience**:
- Snap photo of gas receipt
- AI extracts: $47.50, categorizes as "Gas/Fuel"
- User confirms or adjusts

**Technical approach**:
- OCR (Tesseract or cloud vision API)
- Category classification based on merchant/description
- Learns user's categorization patterns

**Value**: Accurate expense tracking without manual entry

---

## Pro Tier Features ($19.99/mo)

### 4. Photo-Based Job Estimation
**What it does**: Customer sends photo of junk pile, AI estimates job size and price.

**User experience**:
- Customer texts photo of garage cleanout
- Upload to dyia quote builder
- AI: *"Estimated 8-12 cubic yards, suggest $280-$380"*

**Technical approach**:
- Vision model trained on junk/debris images
- Volume estimation from 2D images
- Price mapping based on user's historical $/cubic yard

**Value**: Faster quotes, reduces in-person estimate visits, wow factor for customers

---

### 5. Weekly AI Business Insights
**What it does**: Personalized weekly summary with actionable insights.

**Example insights**:
- *"Your Thursday jobs are 23% more profitable than Mondays"*
- *"Craigslist leads convert at 2x the rate of Facebook"*
- *"You're averaging $47/hr this month, up from $41 last month"*
- *"3 quotes over $500 are pending - follow up recommended"*

**Technical approach**:
- Scheduled analysis job (weekly)
- GPT generates natural language from metrics
- Email delivery with in-app dashboard

**Value**: Turns raw data into business strategy

---

### 6. Revenue Forecasting
**What it does**: Predict next month's revenue based on historical trends.

**User experience**:
- Dashboard widget: *"February forecast: $8,200 - $9,400"*
- Confidence interval based on data quality
- Factors in seasonality

**Technical approach**:
- Time series analysis (Prophet or similar)
- Incorporate: historical revenue, seasonality, lead pipeline
- Update predictions as month progresses

**Value**: Better cash flow planning, goal setting

---

### 7. Smart Follow-Up Reminders
**What it does**: AI tracks quote age and suggests optimal follow-up timing.

**User experience**:
- Notification: *"Quote for Sarah (3 days old) - similar customers convert best at day 4"*
- Prioritized follow-up list in dashboard
- One-click to send follow-up

**Technical approach**:
- Analyze conversion patterns by quote age
- Segment by job size, customer type
- Push notifications / email reminders

**Value**: Higher quote conversion rates, no forgotten leads

---

## Platinum Tier Features ($39.99/mo)

### 8. Route Optimization
**What it does**: AI plans optimal job order to minimize drive time.

**User experience**:
- Input: 5 jobs scheduled for Tuesday
- AI: *"Optimal route saves 47 minutes. Start with Job 3, then 1, 5, 2, 4"*
- Map view with turn-by-turn

**Technical approach**:
- Geocode job addresses
- Traveling salesman optimization
- Factor in: dump locations, time windows, job duration estimates

**Value**: More jobs per day, less fuel cost, less windshield time

---

### 9. Customer Lifetime Value Prediction
**What it does**: Identify high-value customers likely to book again.

**User experience**:
- Customer list sorted by predicted LTV
- *"John: 80% chance of rebooking within 60 days"*
- Suggested actions: *"Send thank-you note to top 10 customers"*

**Technical approach**:
- Repeat customer analysis
- Predictive model on booking patterns
- Segment: one-time vs repeat vs VIP

**Value**: Focus retention efforts on highest-value relationships

---

### 10. Dynamic Pricing Recommendations
**What it does**: AI adjusts suggested pricing based on real-time factors.

**Factors considered**:
- Current workload (busy week = price up)
- Day of week / seasonality
- Customer history (repeat customer discount?)
- Job complexity signals

**User experience**:
- Quote builder: *"Demand is high this week. Consider +15% ($230 instead of $200)"*
- User decides final price

**Value**: Maximize revenue during busy periods, stay competitive during slow times

---

### 11. Automated Monthly Reports
**What it does**: AI generates executive summary PDF each month.

**Report includes**:
- Revenue & profit trends (with charts)
- Top marketing sources by ROI
- Expense breakdown with anomalies flagged
- Year-over-year comparison
- AI-written narrative summary

**User experience**:
- PDF delivered via email on 1st of month
- Shareable with accountant, business partner, spouse

**Technical approach**:
- Templated PDF generation
- GPT writes narrative sections
- Charts via server-side rendering

**Value**: Professional reporting without effort, accountability

---

### 12. Voice Assistant Integration
**What it does**: Hands-free job logging via voice.

**User experience**:
```
"Hey dyia, log a job"
"Customer name?"
"Mike Thompson"
"Revenue?"
"Two seventy-five"
"Any expenses?"
"Forty-five dump fee"
"Got it. Job logged for Mike Thompson, $275 revenue, $45 dump fee. Confirm?"
"Yes"
```

**Technical approach**:
- Voice-to-text (Whisper API or native)
- Conversational flow state machine
- Confirmation before saving

**Value**: Log jobs while driving between sites

---

## Implementation Priority Matrix

| Feature | Difficulty | User Value | Revenue Impact | Priority |
|---------|------------|------------|----------------|----------|
| Natural language job entry | Medium | Very High | High | 1 |
| Weekly AI insights | Easy | High | Medium | 2 |
| Smart quote pricing | Medium | High | High | 3 |
| Smart follow-up reminders | Easy | High | High | 4 |
| Photo estimation | Hard | Very High | Very High | 5 |
| Revenue forecasting | Medium | Medium | Medium | 6 |
| Expense auto-categorization | Medium | Medium | Low | 7 |
| Route optimization | Hard | High | Medium | 8 |
| Automated monthly reports | Medium | Medium | Low | 9 |
| Dynamic pricing | Hard | High | High | 10 |
| Voice assistant | Medium | Medium | Low | 11 |
| Customer LTV prediction | Hard | Medium | Medium | 12 |

---

## Quick Wins (Low Effort, High Impact)

### Smart Defaults
- Pre-fill job forms based on most common values
- Remember last-used marketing source
- Suggest common expense amounts

### Anomaly Detection
- Flag unusual jobs: *"This job's profit margin is 15% below your average"*
- Catch data entry errors: *"Revenue of $2500 is unusually high - confirm?"*

### Personalized Dashboard
- Show metrics most relevant to user's patterns
- Highlight biggest changes week-over-week

---

## Technical Infrastructure Needed

### For Basic AI Features
- OpenAI API integration (GPT-4 for parsing, insights)
- Simple ML model hosting (or use OpenAI fine-tuning)
- Background job processing (for async analysis)

### For Advanced Features
- Vector database (Pinecone/Supabase pgvector) for similarity search
- Vision API for photo analysis
- Time series forecasting library
- Mapping/routing API (Google Maps, Mapbox)

### Cost Considerations
- OpenAI API: ~$0.01-0.10 per AI interaction
- Vision API: ~$0.001-0.01 per image
- Keep costs under $1/user/month for healthy margins

---

## Competitive Differentiation

### What Jobber/Housecall Pro Don't Have
- Photo-based estimation
- Natural language job entry
- AI-powered pricing suggestions
- Personalized business insights

### dyia's AI Advantage
> "dyia doesn't just track your jobs - it learns your business and helps you make more money."

This positioning justifies premium pricing against spreadsheets and basic trackers.

---

## Next Steps

1. **Validate with Marco** - Which features resonate most?
2. **User research** - Survey target customers on pain points
3. **MVP selection** - Pick 2-3 features for Pro tier launch
4. **Technical spike** - Prototype natural language entry
5. **Cost modeling** - Ensure AI costs fit pricing model

---

*Document created: January 21, 2026*
*For internal planning use*
