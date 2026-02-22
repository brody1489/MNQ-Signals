# Flow Terminal — Handoff for Senior Dev / Team

**Purpose:** This doc is for a senior developer or team taking over the Flow Terminal codebase to ship a professional, Fidelity/Bloomberg-style product. It summarizes what exists, what’s missing, and what should change.

---

## 1. Can This Actually Work?

**Yes.** The repo is a solid **functional prototype**, not a throwaway.

- **Stack is appropriate:** Next.js 14 (App Router), Tailwind, react-rnd for the dashboard. No odd choices.
- **Structure is clear:** `app/` routes, `components/`, `lib/` (mock data, context). Easy to navigate.
- **Core flows exist:** Dashboard, Flow, News, People, Funds, Tickers, Calendars, Scanners, Settings, Search, Alerts (create/manage). You can demo the product end-to-end.
- **Gap:** Remaining prototype feel is from (a) mock-only data, (b) no design system or QA process, (c) no real API/auth. The dashboard is now free-form (Fidelity-style) with pixel layout and react-rnd.

**Verdict:** Treat this as the **outline + first draft**. A senior dev or small team can turn it into a shippable product by fixing the dashboard model, plugging real data, and tightening UX/design.

---

## 2. Dashboard: Free-form (Fidelity-style) — Implemented 
### Current behavior (react-rnd + pixel layout)

- **Grid-based:** Widgets live in a **12-column grid**. Position and size are in “grid units,” not pixels.
- **Snapping:** Items snap to grid cells. You can’t freely place a widget at (237px, 100px) or make it 323px wide.
- **Resize:** Only via the bottom-right handle; size is still in grid units (e.g. w=6, h=4). So “weird moving sizes” and “large blank space on the right” come from the grid (e.g. 12 cols, row height 80px) and from layout logic that may not fill or compact the grid the way you want.
- **Overlap:** `preventCollision={false}` allows overlap, but the library is still grid-based. There’s no **click-to-bring-to-front** (z-index) implemented.
- **“Everything is free”:** Fidelity-style “place anything anywhere, any size” is **not** what react-grid-layout does. It’s “free *within* a grid.”

So: the current implementation is **not** wrong for a grid-based dashboard; it’s just **different** from Fidelity’s free-form, overlapping, bring-to-front behavior.

### What Fidelity-like actually implies

| Behavior | Fidelity / ATP | Current codebase |
|----------|----------------|-------------------|
| Position | Free (pixel or percent) | Grid units (e.g. 0–11 cols) |
| Resize | Free (any width/height) | Grid units (w, h in cols/rows) |
| Overlap | Yes, windows stack | Overlap possible but grid-based |
| Click to focus | Clicked window comes to front | Not implemented |
| Blank space | Windows can sit anywhere; no “grid” gap | Empty grid columns → blank strip on right |

### Options for the team

**Option A — Keep grid, improve UX (fastest)**  
- Keep react-grid-layout.
- Add **click-to-bring-to-front** (track “active” widget id, set `zIndex` higher on the active item).
- Tune **compactType** (e.g. `"vertical"`) and **rowHeight** so resizing doesn’t leave big gaps; consider “compact on layout change” so widgets shift up/left.
- Optionally increase **cols** (e.g. 24) for finer horizontal sizing.
- Result: still grid-based, but less “weird” movement and blank space; no full Fidelity-style freedom.

**Option B — Free-form dashboard (Fidelity-like)**  
- Replace react-grid-layout with a **free-form** system:
  - **Option B1:** Use a **windowing library** (e.g. react-rnd, or a desktop-style layout with draggable/resizable divs in px or %). Store `{ id, x, y, width, height }` in layout state and persist it.
  - **Option B2:** Use **CSS Grid or Flexbox** with explicit pixel or percent sizes per widget and drag/resize logic (e.g. react-rnd) that updates those values.
- Implement **z-index / stacking:** on widget mousedown or click, move that widget’s `zIndex` to the max so it comes to front.
- Result: “Everything is free, overlap, whatever size you want, click to bring to front” — much closer to Fidelity.

**Recommendation:** If the product goal is “Fidelity-like workspace,” plan for **Option B** and a small spike (e.g. 2–3 days) to prototype with react-rnd or similar. If “good enough” grid with better behavior is acceptable for v1, **Option A** is enough for now.

---

## 3. What You Have vs What’s Missing (for “professional” ship)

### In good shape (keep / refine)

- **Navigation and routing:** Top bar, Calendar dropdown, Scanners, Flow, News, People, Funds, Settings.
- **Flow:** Filters (type, min size with dropdown + custom), EventTable, call/put ratio bar.
- **Ticker page:** Logo, sparkline, 52w range bar, options flow bar, tabs (overview, news, earnings, dividends, filings, transcripts, flow).
- **Scanners:** Top N, sort, min volume/cap filters, 52w bar, P/C bar, ticker logos.
- **Economic calendar:** Events, impact, Presidents Day (blank time / no impact).
- **Alerts:** Create/manage rules (price, flow, congress, insider, news, earnings); dropdown + Settings.
- **Layout persistence:** localStorage for layout (`flow-terminal-layout`); layout presets; pixel-based layout with react-rnd.
- **Mock data:** Tickers, people, funds, flow events, news, earnings, dividends, filings, transcripts; enough to demo and develop against.

### Needs work for “professional” feel

- **Dashboard:** See §2 (free-form is implemented; optional: polish resize handles, keyboard shortcuts).
- **Design system:** No single source of truth for spacing, type scale, components. Tailwind is used ad hoc. Recommend: define a small design system (e.g. in `SPEC.md` or a `/design` doc): spacing scale, font sizes, border radius, component variants (buttons, inputs, cards) and use them consistently.
- **Empty / loading / error states:** Many tables and sections don’t have consistent empty (“No data”), loading (skeletons), or error (retry, message) states. Add them everywhere data is shown.
- **Accessibility:** Keyboard nav, focus management, ARIA where needed (e.g. search, dropdowns). Not systematically done.
- **Real data and auth:** Everything is mock. Backend, API contracts, auth, and “wire real data” are out of scope for this prototype but are the next big phase for the team.

---

## 4. What Would Help Before Handoff (if you want it)

- **Product/UX spec:** One doc (or a few) that state:  
  - “Dashboard must behave like Fidelity: free position/size, overlap, click-to-front.”  
  - Priority order for: dashboard rework vs design system vs real API vs new features.
- **Design tokens:** A short list: primary/secondary colors, spacing scale (e.g. 4, 8, 12, 16, 24), font sizes (e.g. xs/sm/base/lg), radius. Not full Figma—just enough so the team doesn’t “vibe code” spacing and colors.
- **API contract (future):** When you have a backend in mind, a simple list of endpoints and payloads (e.g. “GET /api/flow/events”, “GET /api/tickers/:symbol”) so the frontend can be refactored to use real data without guessing.

You don’t have to write these yourself; a senior dev can derive them from the app and this doc in a short discovery phase.

---

## 5. Possible Improvements (prioritized)

**P0 (before calling it “professional”)**

1. **Dashboard:** Free-form + bring-to-front is done; optional: polish resize UX, keyboard shortcuts.
2. **Consistent empty/loading/error states** for every data surface (tables, widgets, ticker tabs).
3. **One pass of UX polish:** one place that defines “how buttons/inputs/cards look” and use it everywhere (even if it’s just a short design section in SPEC.md).

**P1 (soon after)**

4. **Design system / tokens:** Spacing, type, colors, components; use across the app.
5. **Accessibility:** Focus order, keyboard nav (especially search and dropdowns), basic ARIA.
6. **Tests:** At least smoke tests for critical paths (open dashboard, open Flow, open a ticker, change layout, add/remove widget).

**P2 (when moving to production)**

7. **Real API and auth:** Replace mock data; define and implement API contracts.
8. **Performance:** List virtualization for long tables (Flow, Scanners, etc.); lazy load heavy widgets if needed.
9. **Error boundaries:** So one broken widget doesn’t take down the whole dashboard.

---

## 6. Technical Notes for the Team

- **Layout state:** `LayoutContext` holds `layout: LayoutItem[]` (pixel-based: `i, x, y, width, height`; old grid layouts migrated on load). Persisted to `localStorage` under `flow-terminal-layout`. If you switch to free-form, you’ll store something like `{ i, x, y, width, height }` (px or %) and migrate or reset saved layout.
- **Alerts:** Rules and triggered alerts live in `lib/alerts-context.tsx` and localStorage. Backend will eventually own these.
- **Mock data:** `lib/mock-data.ts` is the single place for all fake data. Swap with API calls and keep the same shapes where possible.
- **Grid layout:** `TerminalDashboard.tsx` uses **react-rnd** (each widget is an Rnd; drag from header, all-edge resize, click-to-front). Draggable handle is `widget-drag-handle` on the widget header; bounds = workspace container).

---

## 7. Summary for You (product owner)

- **Can it work?** Yes. The codebase is a valid starting point for a professional product.
- **Dashboard:** The “weird sizes and blank space” and “not like Fidelity” come from using a **grid** layout. To get “everything free, overlap, click to front,” the team should plan to replace or augment the grid with a **free-form** layout (e.g. react-rnd) and add z-index on click.
- **What to give the team:** This HANDOFF.md plus SPEC.md. Optionally: a short product note that says “Dashboard must feel like Fidelity; here’s the priority order for v1.”
- **What the team should do first:** (1) Add empty/loading/error states everywhere, (2) One pass of visual/UX consistency (design tokens + components), (3) Real API and auth when ready.

If you want, the next step can be a short **PROJECT_REQUIREMENTS.md** (user stories, acceptance criteria) focused only on dashboard and “professional v1” scope, so the senior dev has a clear first sprint.
