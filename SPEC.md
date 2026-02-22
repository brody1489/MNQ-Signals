# Flow Terminal — Full Vision Spec

**Positioning:** Affordable Bloomberg-style informational terminal. One hub for whales, Congress, insiders, news, filings, earnings. No execution—information only.

---

## 1. Terminal Layout & Widget System

### 1.1 Core Behavior
- **Drag-and-drop widgets** in a resizable grid (like Bloomberg/TradingView)
- **Snap to grid** — 12 or 24 column grid, widgets snap to cells
- **Resize** — drag widget edges to resize
- **Rearrange** — drag widget header to new position
- **Add/remove widgets** — "+" or menu to add; "X" on widget to remove
- **Layout presets** — "Quadrant", "Left-right", "Full width", "Custom"
- **Persist layout** — save to localStorage (per-user when auth exists)
- **Responsive** — on small screens, stack or collapse sidebar; grid adapts
- **Full viewport** — no wasted space; auto-fit to any screen size

### 1.2 Available Widgets
| Widget | Description |
|--------|-------------|
| News Stream | Chronological feed, filters, scoring |
| Whale Tracker | Flow events (options, dark pool, CEO, Congress) |
| Congress Tracker | Congress-only subset |
| Insider Tracker | CEO/insider-only subset |
| Company Profile | Ticker overview, tabs for sections |
| Person Profile | CEO/Congress holdings, transaction history |
| Fund Profile | 13F holdings, QoQ changes |
| Calendar | Earnings, dividends, splits, IPO lockups |
| Watchlist | User-saved tickers/people |
| Alerts Panel | Triggered notifications |
| Search Bar | Universal search (always in header too) |

### 1.3 Default Layout Options
- **Flow-focused:** Whale + News + Calendar (quadrant)
- **Research:** Company profile + News + Whale (left-right)
- **Person-focused:** Person profile + Holdings + Transaction history
- **Dashboard:** Top tickers + Largest events + News stream

---

## 2. Universal Search & Autocomplete

### 2.1 Search Bar Behavior
- **Always visible** in header; keyboard shortcut: `Cmd+K` or `/`
- **Fuzzy match** — partial typing matches ticker, company name, person name, fund name
- **Autocomplete dropdown** — appears as user types
- **Result categories:** Companies | People | Funds | All (default)
- **Format:** 
  - Company: `AAPL — Apple Inc.`
  - Person: `Sarah Chen — CEO · TechFlow Inc.`
  - Fund: `BlackRock Inc. — $10.2T AUM`
- **Recent searches** — show last 5 below results
- **Keyboard nav** — Arrow up/down, Enter to select, Escape to close
- **Click result** → navigate to profile page or open in widget

### 2.2 Search Scope
- Tickers (symbol + company name)
- People (name, company, role)
- Funds (name, type)
- Optional: news headline search (phase 2)

---

## 3. Company (Ticker) Profile

### 3.1 Header Section
- Logo placeholder, company name, ticker (mono font)
- Price, change % (mock; color green/red)
- Sector, market cap
- 52w high/low
- Quick stats: P/E, div yield, beta

### 3.2 Tabs / Sections
| Tab | Content |
|-----|---------|
| Overview | Summary stats, key metrics |
| News | Filtered news for this ticker, newest first |
| Earnings | Upcoming date, estimates; past table (date, EPS act vs est, revenue, beat/miss) |
| Dividends | Next ex-date, payment date, amount, yield, history table |
| Insider Activity | All buys/sells for this ticker |
| Whale/Congress | Who traded this ticker |
| 13F Holdings | Which funds hold this, QoQ change |
| SEC Filings | 10-K, 10-Q, 8-K list; date, type, AI summary, link to full |
| Transcripts | Earnings call summaries (expandable) |

### 3.3 Visual Conventions
- Numbers: green = positive, red = negative
- Tables: sortable columns, pagination if needed
- Dates: relative ("2h ago") or absolute
- Empty state: "No data" with subtle icon

---

## 4. Person Profile (CEO, Congress)

### 4.1 Header
- Name, photo placeholder, role badge (CEO | Congress)
- For Congress: party, state, committee
- Total portfolio value, # of holdings, recent activity count

### 4.2 Holdings Section
- **Table:** Ticker | Company | Shares | Value | % of Portfolio | Change | Last Trade
- **Sort:** by value (largest first / smallest first), by change, by ticker
- **Filter:** by sector, by transaction type (buy/sell)
- **Quick sort buttons:** "Largest first" | "Smallest first" | "Recent"

### 4.3 Transaction History
- Timeline of all trades: date, ticker, action (buy/sell), size, price (mock)
- Expandable rows if needed

### 4.4 Stats
- Estimated performance %, best year
- Total capital deployed

---

## 5. Fund Profile (BlackRock, etc.)

### 5.1 Header
- Fund name, AUM, type (hedge fund, mutual fund, etc.)

### 5.2 Quarter-over-Quarter View
- **Quarter selector:** Q1 FY2026 ↔ Q2 FY2026 (dropdown or arrows)
- **Holdings table:** Ticker | Company | Shares | Value | % of Portfolio | Change from Prior Q
- **Change column:** e.g. "+10% NVDA", "-5% AAPL" (green/red)
- **Summary line:** "Added 45 positions, exited 23, increased 120"

### 5.3 Visual
- Bar chart: top 10 holdings by value (optional)
- Or change chart: biggest increases/decreases

### 5.4 Historical Quarters
- Dropdown to select any quarter (e.g. last 8 quarters)

---

## 6. Whale / Congress / Insider Tracker

### 6.1 Size Filter
- **Min value:** number input
- **Quick buttons:** $100K | $500K | $1M | $5M | $10M (sets min)
- **Max value:** optional, for "between X and Y"
- Or: preset ranges — "Under $1M" | "$1M–5M" | "$5M+" 

### 6.2 Other Filters
- **Type:** Options | Dark Pool | CEO | Congress (multi-select)
- **Direction:** Buy | Sell | Both
- **Date range:** Today | Week | Month | Custom
- **Ticker:** autocomplete search
- **Person:** autocomplete (for CEO/Congress subset)

### 6.3 Sort
- By size (largest first)
- By date (newest first)
- By ticker

### 6.4 Display
- **Table:** Time | Ticker | Type | Person (if any) | Action | Size | Details
- **Cards (alt view):** compact cards with key info
- **Click row** → ticker profile or person profile

---

## 7. News Stream

### 7.1 Article Card
- Headline, source, time
- Tickers mentioned (clickable chips)
- Importance score (1–5 stars or 1–10)
- Impact score (e.g. "High" | "Medium" | "Low")
- Expand: summary, link to full article

### 7.2 Filters
- **Ticker(s):** multiselect autocomplete
- **Date range:** picker
- **Source:** dropdown (Benzinga, Reuters, etc.)
- **Min importance:** 1–5
- **Keyword search:** free text

### 7.3 Sort
- Newest first
- Most important first

### 7.4 Display
- Chronological feed
- Compact vs expanded view toggle

---

## 8. Calendar

### 8.1 Events Shown
- Earnings (date, ticker, estimate)
- Dividends (ex-date, payment date)
- Splits
- IPO lockups (optional)

### 8.2 View
- Week | Month | List
- Click event → ticker profile

### 8.3 Filters
- Ticker(s)
- Event type (earnings, dividend, etc.)

---

## 9. Watchlist

### 9.1 Content
- User-saved tickers
- User-saved people (optional)
- User-saved funds (optional)

### 9.2 Display
- Compact table: Ticker/Name | Price | Change | Last activity
- Click → profile

### 9.3 Actions
- Add/remove from watchlist
- Reorder (drag)

---

## 10. Alerts

### 10.1 Triggers (mock)
- Ticker hits price (above/below)
- Whale trade over $X on ticker
- Congress/insider trade on ticker
- News with ticker + min importance
- Earnings date approaching

### 10.2 Display
- Alerts panel: list of triggered alerts
- Badge count on sidebar

---

## 11. Settings

### 11.1 Theme
- Light | Dark | System

### 11.2 Layout
- Save current layout
- Load layout preset
- Reset to default

### 11.3 Display
- Font size: Small | Medium | Large
- Density: Compact | Comfortable | Spacious

### 11.4 Mock (for prototype)
- Timezone
- Date format (MM/DD/YYYY vs DD/MM/YYYY)
- Number format (1,000.00 vs 1.000,00)
- Notifications: sound on/off

---

## 12. Navigation & Structure

### 12.1 Sidebar
- Dashboard (home)
- Whale Tracker
- Congress Tracker
- Insider Tracker
- News
- Calendar
- Watchlist
- Settings

### 12.2 Breadcrumbs
- When deep: Flow Dashboard > People > Sarah Chen

### 12.3 Routing
- `/` — Dashboard (widget grid)
- `/flow` — Whale tracker full page
- `/news` — News full page
- `/calendar` — Calendar full page
- `/ticker/[symbol]` — Company profile
- `/people/[id]` — Person profile
- `/funds/[id]` — Fund profile
- `/settings` — Settings

---

## 13. Mock Data Requirements

### 13.1 Companies
- 25–30 tickers: symbol, name, sector, market cap, price, 52w, P/E, div yield
- Earnings: next date, past 4 quarters (EPS, revenue, beat/miss)
- Dividends: next ex-date, amount, yield, history
- Short interest (optional)

### 13.2 People
- 15–20: mix of CEO, Congress
- Congress: party, state
- Holdings derived from events
- Stats: total value, performance, best year

### 13.3 Funds
- 5–10: BlackRock, Vanguard, etc.
- 13F-style holdings: ticker, shares, value, % of portfolio
- Two quarters: Q1 vs Q2 with change %

### 13.4 Flow Events
- 100+ events: options, dark pool, CEO, Congress
- Varied dates (today, yesterday, last week)
- Size range: $20K to $50M
- Link to tickers and people

### 13.5 News
- 50+ articles
- Varied: different tickers, sources, dates
- Importance 1–5, impact High/Med/Low
- Summary (1–2 sentences)
- Tickers mentioned

### 13.6 SEC Filings
- 20+ filings: 10-K, 10-Q, 8-K
- Per ticker
- AI summary (mock 1–2 sentences)
- Date, type

### 13.7 Transcript Summaries
- Per ticker, per earnings
- 2–3 sentence summary (mock)

---

## 14. Visual & UX Conventions

- **Tables:** sortable columns, hover highlight, striped or plain
- **Numbers:** tabular-nums, right-align; green/red for change
- **Links:** accent color, underline on hover
- **Empty states:** icon + "No data for this filter"
- **Loading:** skeleton placeholders
- **Modals:** for settings, add widget
- **Toasts:** for "Added to watchlist", etc.

---

## 15. Build Order

1. Expand mock data (funds, news, earnings, dividends, filings, transcripts)
2. Terminal layout + widget system (react-grid-layout)
3. Theme (light/dark) + settings context
4. Search: add funds, improve autocomplete
5. Company profile: full tabs
6. Person profile: holdings table, sort/filter
7. Fund profile: QoQ view
8. Whale tracker: size quick buttons, full filters
9. News stream: filters, scoring, cards
10. Calendar
11. Watchlist
12. Polish: drag, resize, persist layout, all edge cases
