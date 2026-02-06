# dyia - Final Milestone Additions

**Date:** February 4, 2026  
**For:** Marco Ayyala  
**Status:** Confirmed Scope for Final Milestone

---

## Overview

Additional features to be built on top of the base milestone scope.

**Base Milestone (already scoped):**
- Stripe billing logic (Basic, Pro, Founders pricing)
- Annual plans with two-month discount
- Gumroad coupon for Annual Pro (year one)
- Trial flows
- Resend email system (welcome, trial reminders, reports)
- Full QA pass, UX polish, mobile audit, error handling, launch readiness

**This document covers the additional features below.**

---

## 1. Marketing Page (Pro)

A dedicated page for tracking marketing spend and measuring ROI.

### What You Get:
- **Marketing Spend Tracker** — Log spend by channel (Google Ads, Facebook Ads, Yard Signs, Thumbtack, etc.)
- **ROI Dashboard** — Revenue generated vs. money spent per channel with automatic ROI calculation
- **Lead Source Breakdown** — Which channels bring the most jobs and highest average job value
- **Time Period Filters** — View by month, quarter, or all-time

### Deliverables:
- New "Marketing" section in sidebar (Pro only)
- Add/edit/delete marketing expenses by channel
- ROI calculations per channel
- Summary cards: total spend, total revenue, overall ROI %

**Hours: 8**

---

## 2. Marketing Source on Jobs

Tag how customers found you when logging a job.

### What You Get:
- **Preset Options** — Google, Facebook, Yard Sign, Referral, Word of Mouth, Thumbtack, Craigslist, Other
- **Custom Input** — Add your own source if not listed
- **Source Display** — Visible on job cards and job list
- **Filtering** — Filter jobs by marketing source

**Hours: 2**

---

## 3. Review Request System (Pro)

Request reviews from customers after completing a job.

### What You Get:
- **Review Templates** — Pre-written messages for Google, Yelp, and Facebook
- **One-Click Copy** — Copy to clipboard, ready to text or email
- **Customizable** — Templates include business name automatically
- **Request Tracking** — Track which customers were asked (date, platform)
- **Access Point** — "Request Review" button on completed jobs

### Deliverables:
- Review request modal with platform selection
- Copy-to-clipboard functionality
- Review request history per customer
- Settings area for review page links

**Hours: 4**

---

## 4. Customer Database (Basic)

Store and manage customer information with job history.

### What You Get:
- **Auto-Save Customers** — When you log a job, customer info is saved
- **Auto-Fill** — Start typing a name, it auto-completes from your database
- **Customer Profile** — See all past jobs for a customer, total lifetime value
- **Quick Re-Quote** — Start a new quote for an existing customer with one tap

### Pro Enhancement:
- AI insights on customer value: "This customer has spent $2,400 over 6 jobs — consider offering a loyalty discount"

**Hours: 5**

---

## 5. "Today" Dashboard Card

Quick view of today's business activity.

### What You Get:
- **Today's Jobs** — Jobs scheduled for today
- **Expected Revenue** — Projected revenue for the day
- **Motivational Stat** — e.g., "You're 3 jobs away from your best week ever"

**Hours: 2**

---

## 6. Mass Email Blast (Pro)

Send promotional emails to your customer database through Gmail/Outlook integration.

### What You Get:
- **Gmail/Outlook OAuth Integration** — Users connect their own email account
- **Customer Selection** — Select all customers or filter by criteria
- **Email Composition** — Write message directly in dyia
- **One-Click Send** — Emails sent through user's own email account
- **Personal Delivery** — Emails come from user's business email, not a generic address
- **Send Tracking** — Track which customers were emailed and when

### Pro Enhancement:
- AI writes promo copy and suggests messaging
- AI generates personalized variations per customer

### Deliverables:
- Gmail OAuth integration
- Outlook OAuth integration
- Email composition UI
- Customer selection interface
- Send tracking and history
- Error handling for failed sends

**Hours: 7**

---

## 7. File Upload & Data Extraction (Pro)

Upload files and documents for Dyia to extract data and perform tasks.

### What You Get:
- **File Upload** — Upload images, PDFs, spreadsheets, and documents directly to Dyia chat
- **Data Extraction** — Dyia reads and extracts relevant information (customer details, job info, expenses, etc.)
- **Auto-Action** — Dyia suggests or performs tasks based on extracted data (create job, generate quote, log expense)
- **Reference Storage** — Files stored and referenced in conversation history

### Supported File Types:
- Images (PNG, JPG, JPEG)
- PDFs (invoices, receipts, quotes)
- Spreadsheets (CSV, Excel)
- Documents (text files)

### Deliverables:
- File upload UI in chat interface
- File processing and parsing logic
- AI extraction prompts for different file types
- Task suggestion based on extracted data
- File storage and retrieval

**Hours: 4**

---

## 8. Onboarding Questionnaire

Quick questions on signup to give Dyia context about the business.

### What You Get:
- 3-4 questions: business type, average job size, pricing style, monthly goal
- Answers feed into AI context from day one
- Skippable but encouraged

**Hours: 2**

---

## 9. Logo Design

Final logo options for dyia branding.

### What You Get:
- 2-3 logo variations
- App icon (favicon)
- Full logo for landing page and headers

**Hours: 2**

---

## 10. Account Management

User profile and subscription settings.

### What You Get:
- Update business name and contact info
- View current plan and billing history
- Cancel/downgrade flow
- Data export (CSV)

**Hours: 3**

---

## Summary

| Feature | Tier | Hours |
|---------|------|-------|
| Marketing Page (spend + ROI) | Pro | 8 |
| Marketing Source on Jobs | Basic | 2 |
| Review Request System | Pro | 4 |
| Customer Database | Basic | 5 |
| "Today" Dashboard Card | Basic | 2 |
| Mass Email Blast (Gmail/Outlook) | Pro | 7 |
| File Upload & Data Extraction | Pro | 4 |
| Onboarding Questionnaire | All | 2 |
| Logo Design | — | 2 |
| Account Management | All | 3 |
| **Total** | | **39** |

---

## Tier Breakdown

### Basic Plan ($14.99/mo)
- Job tracking
- Quote builder + PDF export
- Fixed expenses
- Dashboard + Reports
- Follow-ups
- **Customer Database** (NEW)
- **"Today" Dashboard Card** (NEW)

### Pro Plan ($29.99/mo, Founders: $19.99/mo)
- Everything in Basic
- AI Assistant (chat interface)
- AI Insights
- Revenue forecasting
- Smart pricing suggestions
- **Marketing Page + ROI** (NEW)
- **Review Request System** (NEW)
- **Mass Email Blast with Gmail/Outlook** (NEW)
- **File Upload & Data Extraction** (NEW)
- **Customer AI Insights** (NEW)

---

## Post-MVP Considerations

- **AI Credits System** — Usage tracking + credit purchases
- **Business Tier** — Multi-user / team accounts (based on user feedback)
- **Google/Meta Ads API Integration** — Direct ad spend syncing

---

## Post-Launch Support

30 days of free support post-launch for bugs and edge cases.

---

*Confirmed and ready for final milestone.*

---

## Implementation Status (Updated Feb 5, 2026)

### All 10 Features: COMPLETE

| Feature | Status | Files |
|---------|--------|-------|
| Marketing Page | ✅ Complete | `Marketing.tsx`, `/api/marketing/*` |
| Marketing Source on Jobs | ✅ Complete | `Jobs.tsx` (source field) |
| Review Request System | ✅ Complete | `Jobs.tsx`, `Quotes.tsx`, `/api/review-requests` |
| Customer Database | ✅ Complete | `Customers.tsx` |
| "Today" Dashboard Card | ✅ Complete | `Dashboard.tsx` |
| Mass Email Blast | ✅ Complete | `MassEmail.tsx`, `/api/email/*` |
| File Upload & Extraction | ✅ Complete | `Assistant.tsx`, `/api/ai/upload` |
| Onboarding Questionnaire | ✅ Complete | `/app/onboarding/page.tsx` |
| Logo Design | ✅ Complete | `/public/dyia-logo*.png` |
| Account Management | ✅ Complete | `Settings.tsx`, `/api/stripe/portal`, `/api/export/data` |

### Mass Email Implementation Details

- **Migration:** `012_mass_email.sql` - creates `dyia_email_connections`, `dyia_email_sends`, `dyia_email_campaigns`
- **OAuth APIs:** `/api/email/connect/gmail`, `/api/email/connect/outlook` (+ callbacks)
- **Send API:** `/api/email/send` - handles Gmail API and Microsoft Graph
- **UI:** Full compose interface with customer selection, OAuth connection, send history
- **Setup:** See SETUP.md section "5. Mass Email (Pro)" for OAuth configuration
