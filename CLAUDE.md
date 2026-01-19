# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JunkProfit Tracker Pro is a business management web application for junk removal companies. It's a vanilla JavaScript SPA (no frameworks) that runs entirely in the browser with localStorage for data persistence.

**Tech Stack**: HTML5, CSS3, Vanilla JavaScript, jsPDF (CDN), localStorage

## Development

No build process required. Open `index.html` directly in a browser:

```bash
# Mac
open index.html

# Windows
start index.html

# Linux
xdg-open index.html
```

Edit files directly and refresh the browser to see changes.

## Architecture

### Single Application Object Pattern

The entire app is a single global `app` object in `app.js` (~1400 lines) containing:
- **State**: `jobs`, `quotes`, `settings`, `currentView`, `selectedMonth`, temporary form state (`tempCustomers`, `tempExpenses`, `tempPhotos`)
- **Data Layer**: `loadData()`, `saveData()`, `getStorageKey()` - all localStorage operations use prefix `junkProfit_dev_`
- **View Rendering**: `render()` dispatches to view-specific methods (`renderDashboard()`, `renderJobs()`, `renderQuotes()`, `renderQuoteBuilder()`, `renderSettings()`)
- **Navigation**: `setView()` changes views, `renderNav()` updates sidebar

### Data Flow

```
User Action → app method → modify state → saveData() → render()
```

Views are rendered as HTML strings returned from render methods, then inserted via `innerHTML` into `#mainContent`.

### Key Data Structures

**Job**:
```javascript
{ id, date, customerName, source, revenue, labor, gas, dumpFee, dumpsterRental, additionalExpense }
```

**Quote**:
```javascript
{ id, createdAt, customer: {name, phone, email, address, jobDescription}, pricing: {...}, photos: [], estimateRange: {low, high}, total }
```

**Settings**:
```javascript
{ taxPercentage, monthlyGoal, businessInfo: {name, phone, email, address, logo} }
```

### External Dependencies

- **jsPDF**: Loaded via CDN (`window.jspdf`) for PDF quote generation in `downloadQuotePDF()`
- **Google Fonts**: Inter font family

## Key Implementation Details

### Multi-Customer Job Entry
Jobs form (`renderJobForm()`) allows adding multiple customers at once. Expenses are split evenly across all customers when saving (`saveMultipleJobs()`).

### Quote Builder
Real-time price preview via `updateQuotePreview()`. Estimate range is calculated as base total +/- 10%.

### Photo Handling
Photos stored as base64 data URLs in localStorage. Large photos (>2MB) can exceed quota - app warns users and offers to save without photos.

### Monthly Filtering
Dashboard and Jobs views filter by `selectedMonth`. Use `getJobsForMonth()` for filtered data and `calculateStats()` for aggregations.

## Known Constraints

- localStorage 5MB limit - large photo uploads can fail
- Quotes auto-delete after 30 days (`cleanOldQuotes()`)
- No server-side persistence - all data is browser-local
- PDF generation requires jsPDF library to be loaded

## Design Tokens

Primary: `#3b82f6`, Success: `#10b981`, Warning: `#fbbf24`, Danger: `#ef4444`
