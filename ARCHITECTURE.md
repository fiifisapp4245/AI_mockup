# Architecture — 3D Printing Schedule Optimizer

This document describes the full technical architecture of the `ai-dashboard-realta` project: a **front-end-only demo dashboard** for Realta Technologies' 3D-printing production, built to explore what a real scheduling/planning tool could look like. There is no backend, no database, and no live data source — every number on screen is produced by a deterministic mock-data layer designed to *look and behave* like the real manufacturing process described by site stakeholders.

Read this alongside the two persistent memory notes for this project (if you have access to them): `project_realta_process_context` (the real-world manufacturing rules this app approximates) and `project_realta_mock_data_architecture` (a running log of what's implemented vs. still a gap).

---

## 1. Purpose & Scope

The app is a stand-in for several disconnected tools/spreadsheets a real 3D-printing site currently uses:

- A production-vs-planning tracking view ("Ben's dashboard")
- A manually-maintained Excel powder tracker
- Ad-hoc operator scheduling and maintenance coordination

It exists to **prototype what a unified dashboard could look like**, using plausible, internally-consistent mock data rather than a live integration. Nothing in this app reads from or writes to a real system (JD Edwards, Maximo, PI Vision, etc.) — those are referenced only as target integrations for a future, real implementation.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, `shadcn/ui` (Radix primitives via `radix-ui`) |
| Charts | `recharts` (only on the Runtime page); everything else is a hand-rolled Gantt/table |
| Theming | `next-themes` (light/dark, system-aware) |
| Dates | `date-fns` (installed but most date math is hand-rolled in `lib/mock-data.ts`) |
| Icons | `lucide-react` |
| Fonts | Figtree (sans), Geist Mono |
| Linting/formatting | ESLint (`eslint-config-next`), Prettier + `prettier-plugin-tailwindcss` |
| Package manager / scripts | `dev`, `build`, `start`, `lint`, `format`, `typecheck` (see `package.json`) |

There is **no server framework beyond Next.js itself** — no API routes, no server actions, no ORM, no auth. Every page is a client component (`"use client"`) that computes its own data on render via `React.useMemo`.

---

## 3. Directory Structure

```
app/
  layout.tsx              — root layout: fonts, ThemeProvider, DashboardShell
  page.tsx                — Overview ("/")
  runtime/page.tsx         — Printer Runtime and Topup ("/runtime")
  timeline/page.tsx        — Batch/Lot Timeline ("/timeline")
  asset-utilization/page.tsx — Asset Utilization ("/asset-utilization")
  powder-planner/page.tsx  — Powder Planner ("/powder-planner")
  live-schedule/page.tsx   — Live Schedule ("/live-schedule")
  globals.css              — Tailwind + design tokens (--chart-1..5, etc.)

components/
  dashboard/
    dashboard-shell.tsx    — page chrome: header (logo, title, theme toggle) + nav + main slot
    main-nav.tsx            — top nav tab list (one entry per route above)
    filters.tsx             — FilterGroup, PrinterFilter, OperatorFilter, LotIdFilter, DateRangeFilter
    gantt-timeline.tsx       — GanttRow / GanttAxis / GanttLegend — the shared multi-day Gantt primitive
    chat-sidebar.tsx         — ChatSidebar — the "Optimizer Assistant" keyword-matched Q&A panel
    kpi-card.tsx             — KpiCard — the Overview page's stat tiles
  theme-provider.tsx / theme-toggle.tsx — next-themes wiring
  ui/                        — shadcn/ui primitives (button, card, select, popover, calendar, chart, etc.)

lib/
  mock-data.ts              — the entire data layer (~2000 lines, described in §6)
  utils.ts                  — `cn()` class-merge helper (standard shadcn util)
```

There is no `pages/api`, no `middleware.ts`, no `.env` consumption of note — the app is fully static/client-driven at runtime (though rendered through the Next.js App Router, so each page still gets an initial server render before hydration).

---

## 4. App Shell & Navigation

`app/layout.tsx` wraps every page in:

```
ThemeProvider (next-themes)
  DashboardShell
    header: Realta logo · "3D Printing Schedule Optimizer" title · ThemeToggle
    MainNav: tab strip, one entry per route
    <main>{page content}</main>
```

`MainNav` (`components/dashboard/main-nav.tsx`) is a static array of `{ href, label }` pairs rendered as `next/link` tabs with active-state underlining based on `usePathname()`. Adding a page to the app means: create the route file, add one line to this array.

Every page follows the same top-level layout convention:

```tsx
<div className="flex gap-6">
  <div className="flex min-w-0 flex-1 flex-col gap-...">
    {/* filters, then one or more titled sections with a chart/table + legend */}
  </div>
  <ChatSidebar suggestions={...} prompts={...} />
</div>
```

---

## 5. Pages

### 5.1 Overview (`/`)

The simplest page: a `PrinterFilter` and six `KpiCard` tiles (Available Hours, Total Builds, Total Print Hours, Average Build Hours, Average Changeover Hours, Utilization), each showing an actual value with a "planned" comparison and an up/down trend arrow. Backed entirely by a **hardcoded lookup table** (`KPI_PROFILES`) keyed by printer id — not derived from the other generators, so if the underlying build data changes, these numbers must be updated by hand (a known inconsistency risk, see §9).

### 5.2 Printer Runtime and Topup (`/runtime`)

The one page that uses `recharts` instead of the custom Gantt. Two stacked, x-axis-synced (`syncId`) line charts sharing a `DateRangeFilter` + `PrinterFilter`:

1. **Printer Runtime** — a step chart of Production (run 0/1) and Planning (run 0/1) over time, with `ReferenceArea` bands drawn under each for build occupancy; clicking a band highlights its linked Production/Planning counterpart via a shared `selectedBuildIndex`.
2. **Powder Topup by Start Time** — the hopper's mass (kg) over time. Rebuilt to mirror a real AVEVA PI Vision "Popup Trend" export: mass declines only while a build is actually running, holds flat across changeover/idle time, and ramps sharply on a topup. Segments that run late (mass crosses the topup threshold before the topup fires) are shaded with a red `ReferenceArea` ("late topup" band) in addition to the line itself turning red.

Both charts clip/pad their data to the visible window via `clipToWindow`/`fillGrid`/`fillGridLinear` helpers defined locally in the page (not in `mock-data.ts`) — these exist to keep recharts' shared x-axis scale from misbehaving when the two series have very different point densities.

### 5.3 Batch/Lot Timeline (`/timeline`)

Two Gantt sections built on the shared `GanttRow`/`GanttAxis`/`GanttLegend` primitives:

1. **Printer Runtime** — one Production row and one Planning row, each a long chain of Build/ChangeOver segments for the selected printer. Production and Planning are independently-paced chains (Planning is fast and uninterrupted; Production carries the real, longer durations plus amber/red "Behind Schedule" deltas attached directly to whichever segment ran over). Hovering a segment highlights its paired counterpart on the other row via a `groupKey`.
2. **Batch/Lot View Timeline** — the same data broken out per-lot (capped to the first 15 lots), Production and Planning stacked per lot, with a gray "Start Difference" segment showing how far apart the two rows' start times have drifted for that lot.

### 5.4 Asset Utilization (`/asset-utilization`)

Two Gantt sections (Asset Utilization / Optimized Schedule of Assets) showing a rolling 40-build forecast of operator assignments, condensed to one row per operator (even across printers), plus a per-printer Maintenance row. "Optimized" re-times the same forecast so no build overlaps a maintenance window. Supports Printer + Operator filters and a date-range slicer.

### 5.5 Powder Planner (`/powder-planner`)

A from-scratch page modeled directly on the site's real "Powder Tracker" spreadsheet (built from photos the stakeholder shared). Two plain HTML tables (no `GanttRow` involved — this page predates/sits outside the Gantt primitive):

1. **Tracker table** — one row per printer (20 real `DE####`-style ids), columns: Top Up count, Cycle Count, Current Powder, Next – Qualified Powder, Next – Need IPM First, Days to New Powder, Approx Date Required, Printer State. Lot badges are color-coded by *lot family* (not by qualification status — that distinction is column-based only).
2. **Storage Plan table** — POW1–25 cabinet bins with kg available, lot, and notes ("Powder on hold", etc.).

This page's data model is the most rule-driven part of the app (see §6.7) — it's the one place where the real physical constraint "each 610kg delivery splits into exactly 4 portions, one per printer" is actually enforced by construction.

### 5.6 Live Schedule (`/live-schedule`)

An hourly, per-printer Gantt built from a stakeholder mockup + written spec ("Proposed Timeline View"). Left-hand columns (Printer, Top Up, Cycle) are a fixed, non-scrolling panel; only the hour-by-hour timeline scrolls horizontally (`overflow-x-auto` on the right-hand column only, both columns kept in sync via matching fixed row heights rather than a shared scroll container). Each printer's starting Top Up/Cycle position is read directly from the Powder Planner generator so the two pages agree. Blocks: `Build` (labeled with build number, lot ID, and current powder lot), `BuildSetup`, `PowderTopup`, `IpmCoupon`, `Maintenance` — see §6.8 for the simulation rules.

---

## 6. Data Layer (`lib/mock-data.ts`)

This is the actual "backend" of the app — a single ~2000-line module of pure functions. There is no persistence; every generator recomputes its output from scratch (deterministically) each time it's called, memoized per-page via `React.useMemo`.

### 6.1 Core design principles

- **No `Math.random()`, `Date.now()`, or bare `new Date()`.** All pseudo-randomness goes through `seededFraction(seed: string): number` — a simple additive character-hash mod 997, turned into a `[0,1)` fraction — so output is stable across renders/reloads and safe under React strict-mode double-invocation and server/client hydration.
- **`scatteredFraction(index, salt)`** exists alongside `seededFraction` for cases where the seed strings are near-identical (e.g. adjacent printer ids `DE1376`/`DE1378`, or bin ids `POW1`/`POW2`). `seededFraction`'s additive hash barely moves for such inputs, so `scatteredFraction` multiplies the item's *position* by a large prime (104729) before hashing, guaranteeing adjacent items scatter to unrelated values. This was added mid-project after a real bug (near-duplicate rows in Powder Planner) was traced to exactly this hash-collision behavior.
- **Fixed anchor dates, not "today".** Each subsystem has its own hardcoded anchor (`2025-04-01` for the 3-printer production data, `2026-07-29` for Powder Planner/Live Schedule) rather than deriving from the real current date, so the whole app is reproducible and not quietly "expiring."
- **Pool-based allocation over independent random picks**, wherever a real physical constraint requires uniqueness (see §6.7) — this was the direct fix for a real duplicate-assignment bug.

### 6.2 Two parallel printer-identity systems

This is the single most important thing to understand about the codebase, and it's a deliberate (not accidental) split:

| | 3-printer system | 20-printer system |
|---|---|---|
| IDs | `"1"`, `"2"`, `"3"` (`PRINTER_IDS`) | `DE888`, `DE934`, … `DE1723` (`POWDER_PLANNER_PRINTERS`) |
| Pages | Overview, Runtime, Timeline, Asset Utilization | Powder Planner, Live Schedule |
| Backing data | `RUNTIME_PROFILES` (derived from a real exported `BuildSummary.csv` for one printer, then scaled+jittered for the other two), `PRINTER_PROFILES` | `generatePowderPlannerRows()` computed fresh from constants |
| Why separate | These pages model *one real, already-integrated dashboard's* view of 3 printers with deep production history | These pages model the site's *separate, disconnected* Excel-based powder tracker, which stakeholders described as covering ~20 printers and not yet unified with "Ben's dashboard" |

Live Schedule bridges the two: it reads its starting Top Up/Cycle Count per printer from `generatePowderPlannerRows()` (20-printer system) but otherwise has its own build-chain simulation. Unifying all pages onto one printer roster is a known, explicitly deferred piece of future work (§9).

### 6.3 KPI summaries

`getKpiSummary` / `getKpiPlanningSummary` — a flat, hand-authored lookup table (`KPI_PROFILES`) per printer id, actual vs. planned. Not derived from any other generator.

### 6.4 Production & planning time series (3-printer system)

- `RUNTIME_PROFILES: Record<string, Array<[hours, run]>>` — the real backbone. Printer `"3"`'s sequence is parsed 1:1 from a real `BuildSummary.csv` export (build/changeover durations rounded to whole hours); printers `"1"`/`"2"` apply a deterministic per-printer scale + jitter to the same sequence so all three "look related but not identical."
- `getRuntimeSegments` tiles that pattern out to a fixed `PRODUCTION_DATA_TOTAL_DAYS` (91 days) window.
- `generateRuntimeSeries` / `generateRuntimeBuildSpans` turn that into a timestamped run-state series and a list of build `TimeSpan`s, respectively — these feed the Runtime page's top chart.
- Planning is generated independently and faster: `PLANNING_BUILD_HOURS_OPTIONS = [9]`, `PLANNING_CHANGEOVER_HOURS = 3` (a flat 9h/3h reference, per the real process spec), via `generatePlanningRuntimeSeries` / `generatePlanningBuildSpans`.
- `IPM_BUILD_HOURS = 6` / `IPM_CHANGEOVER_HOURS = 1` are the qualification-build equivalents — defined once here, consumed by the Powder Planner day-count math and (fully) by Live Schedule's IPM Coupon blocks.

### 6.5 Powder mass / topup cycle (feeds `/runtime`'s bottom chart)

Models the real cycle: 70kg full hopper, 4 segments of **30 builds** each per 120-build cycle (`SEGMENT_BUILD_COUNTS = [30]`, `SEGMENTS_PER_CYCLE = 4`), three partial topups (30kg/30kg/15–20kg) then a full refill. `generatePowderMassSeries` walks the real per-build/changeover schedule and emits one point per build/changeover boundary — mass drops only during a Build span (an even share of that segment's total planned decline), holds flat during ChangeOver, and jumps on topup. It also returns `lateWindows: PowderLateWindow[]` — spans where mass crossed the topup threshold before the topup actually fired — which the Runtime page renders as red-shaded bands. `isLateSegment` currently marks most segments after the first as "late" (`idx % 3 !== 0`), so ~2 late scenarios show up reliably per printer within the generated window — a deliberate demo-visibility choice, not a literal frequency claim.

### 6.6 Batch/Lot chained timelines (feeds `/timeline`)

- `GanttSegment` (the shared type consumed by `gantt-timeline.tsx`) has 8 variants: `Build`, `ChangeOver`, `Overrun`, `BuildOverrun`, `Ahead`, `Leave`, `Maintenance`, `StartOffset` — plus optional `lotId`/`productId`/`operator`/`groupKey`/`reason`.
- `generatePrinterLotChain` builds two **independent, gap-free chains** — Production (real durations, with amber/red overrun deltas attached to whichever segment overran) and Planning (flat pace, no delta coloring) — rather than one padded/forced-sync chain, following an explicit product decision made mid-project after an initial "pad Planning to match" design was rejected.
- `generateLotTimelines` / `generateLotPlanningTimelines` produce the per-lot breakdown (capped to 15 lots via `BATCH_LOT_TIMELINE_LOT_LIMIT`).
- `extendLotIds` generates enough unique lot-number continuations (median-gap + seeded jitter) that lot IDs don't repeat across the app — another real bug fix (lot numbers were originally allowed to cycle/repeat).
- `BUILD_OVERRUN_REASONS` / `CHANGEOVER_OVERRUN_REASONS` + `pickReason` supply the human-readable "why did this run long" tooltip text.

### 6.7 Powder Planner (`/powder-planner`)

The most constraint-driven generator in the app, after two rounds of bug fixes prompted by user inspection:

- **`generatePowderPlannerRows()`**: builds `ALL_PRINTER_LOT_PORTIONS` — all 20 physical portions across the 5 main delivery families (4 splits each) — shuffles them deterministically (`deterministicShuffle`, itself built on `scatteredFraction`), and hands out exactly one portion per running printer as "current," with only the leftover portions eligible to appear as anyone's "next" lot. This guarantees, **by construction**, that no physical portion is ever assigned to two printers at once — the original implementation picked family+suffix independently per printer and could (and did) duplicate a lot across up to 4 printers.
- **`generatePowderStorageBins()`** draws only from the 4 *storage-only* lot families (`POWDER_STORAGE_EXTRA_FAMILIES`) — the 5 main families are fully claimed by printer assignments above, so a cabinet bin can never show a lot that's simultaneously loaded in a printer.
- **`lotFamilyColorClass()`** — colors are assigned via an explicit ordered map (`POWDER_LOT_FAMILY_COLOR_MAP`, first-seen-order over a 12-color palette), not a hash. A hash-mod-8 approach was tried first and produced real collisions (3 unrelated lot families rendering the same color) once storage-only families pushed the distinct-family count past the palette size.
- **Days-to-new-powder formula**, verified against the real spreadsheet's numbers: `((3 - topUpCount) * 30 + (30 - cycleCount)) * 0.5` days (30 builds/segment × ~12h/build ÷ 24h/day), anchored to `POWDER_PLANNER_REPORT_DATE = 2026-07-29`.

### 6.8 Live Schedule (`/live-schedule`)

`generatePrinterLiveSchedules()` is a from-scratch hourly simulation, one printer at a time (`generateSinglePrinterLiveSchedule`), starting from that printer's live Powder Planner position:

- **Build numbering** resets to 1 at the start of each 30-build segment (`Build N` where N = position in segment), matching the mockup's own numbering behavior.
- **Segment-boundary events**: a routine `PowderTopup` (same lot, yellow) for segment positions 0–2; an `IpmCoupon` build (new lot, indigo, `IPM_BUILD_HOURS`/`IPM_CHANGEOVER_HOURS`) when a full 4-segment cycle completes and a genuinely new lot is introduced.
- **`applyShiftCutoff`**: won't start a build inside the last 2.5h of a 12h shift (7:00/19:00 boundaries) — models "operators won't start a build they can't monitor through the first 10 layers."
- **Maintenance staggering** (`generateLiveMaintenanceBlocks`): one global rotation across every running printer, 6h apart, so — by construction — no two printers are ever in maintenance at the same time.
- **`pushPastMaintenance`**: every Build/Setup/Topup/IPM block is checked against that *same* printer's own maintenance windows and pushed past them if it would overlap — added after recognizing the initial version could visually overlap a printer's own build chain with its own maintenance block.
- Lot-family portion suffixes here are also clamped to `(printerIndex % 4) + 1` — an earlier version used the raw printer index (up to 20) as the suffix, silently violating the same "4 portions per family" rule fixed in Powder Planner; caught and fixed once the powder lot was surfaced on-screen.

### 6.9 Operator forecast & maintenance (feeds `/asset-utilization`)

`generateOperatorForecast` / `generateOptimizedOperatorForecast` round-robin the next N builds across a printer's operator roster; `generateOperatorLeaves` drops one leave day per operator into an idle gap; `generatePrinterMaintenanceSchedule` produces recurring maintenance windows per (3-printer-system) printer on a fixed interval/duration/offset table (`MAINTENANCE_INTERVAL_DAYS` etc.). The "Optimized" forecast re-times builds around these windows so nothing overlaps.

---

## 7. Shared Component Library

### `gantt-timeline.tsx`
The core visualization primitive used by Timeline and Asset Utilization (Powder Planner and Live Schedule use their own bespoke table/hourly-grid markup instead, since their requirements — inline text labels, hourly resolution, fixed columns — diverge enough that reusing this component wasn't a good fit):
- `GanttRow` — renders `GanttSegment[]` as absolutely-positioned, percentage-width `<div>`s over a `[domainStart, domainEnd]` time range, with per-segment hover tooltip (`SegmentTooltip`, showing start/end/duration/reason/lot/product/operator) and optional cross-row highlight pairing via `groupKey`/`lotId`.
- `GanttAxis` — evenly-spaced date tick labels above a row group.
- `GanttLegend` — configurable swatch legend (`showDelta`, `showLeave`, `showMaintenance`, `showStartOffset` flags).

### `chat-sidebar.tsx`
`ChatSidebar` — the "Optimizer Assistant" panel present on every page. **This is not a real LLM integration** — `matchPrompt()` does simple keyword-substring matching against a per-page `ChatPrompt[]` array (`{ keywords: string[], answer: string }`) and returns the canned answer with the most keyword hits, or a generic fallback. Each page defines its own suggestion chips and prompt/answer bank tailored to that page's data.

### `filters.tsx`
`FilterGroup` (layout wrapper), `PrinterFilter`, `OperatorFilter`, `LotIdFilter` (all thin `Select` wrappers), `DateRangeFilter` (two `CalendarButton` popovers backed by `react-day-picker`). All filter state is local `useState` in the owning page — there is no shared/global filter store, no URL query-param sync.

### `kpi-card.tsx`, `main-nav.tsx`, `dashboard-shell.tsx`, `theme-provider.tsx`/`theme-toggle.tsx`
Small, single-purpose presentational components; theming is `next-themes`'s standard `class`-strategy dark mode, with Tailwind dark: variants used throughout (see `components/dashboard/kpi-card.tsx` for the pattern).

### `components/ui/*`
Standard `shadcn/ui` primitives (button, card, select, popover, calendar, dropdown-menu, input, label, tabs, badge, chart). `chart.tsx` is shadcn's Recharts wrapper (`ChartContainer`/`ChartTooltip`/`ChartConfig`) used only on the Runtime page.

---

## 8. Cross-Cutting Patterns

- **No global state management.** Every page owns its filter state (`useState`) and derives everything else via `useMemo` off the mock-data generators. There is no Context/Redux/Zustand beyond `next-themes`'s theme context.
- **No data fetching.** No `fetch`, no SWR/React Query, no API routes. All "data loading" is synchronous function calls.
- **Verification approach used during development** (no automated test suite exists): `tsc --noEmit` for type safety, `eslint` for lint cleanliness, and ad-hoc Playwright scripts (screenshot + console-error check) run against a local `next dev` server to visually verify chart/table changes before considering a task done. There are no Jest/Vitest/Playwright test files committed to the repo — verification has been manual-but-scripted, per change.
- **Determinism as a correctness property, not just a style preference** — several real bugs in this project (duplicate lot assignments, near-identical rows from adjacent seeds, color collisions) were only catchable *because* the data is deterministic and could be dumped/diffed via one-off `tsx` scripts. This is a load-bearing design choice, not incidental.

---

## 9. Known Gaps vs. the Real Process

(Kept in sync with the `project_realta_mock_data_architecture` memory note.) Not yet implemented:

- **Printer roster unification** — Overview/Runtime/Timeline/Asset Utilization model only 3 printers; Powder Planner/Live Schedule model a separate 20-printer roster. The real site has 14 qualified printers on one roster.
- **Operator build-recommendation engine** — no logic yet suggests which build size an operator should run next to stagger shift handovers.
- **Maximo integration** — Live Schedule's maintenance slots are a locally-generated global rotation, not sourced from a real maintenance schedule/target-window system.
- **Planned-vs-actual overlay on Live Schedule** — currently shows one live/actual timeline only.
- **Chatbot is not connected to real logic** — `ChatSidebar` is keyword-matched canned text per page, not a model reasoning over the actual dataset.
- **Powder-sample-required-per-topup flag** (a real flashing-red alert on the site's existing tool, tied to a past compliance incident) has no equivalent here yet.
- **KPI tiles on Overview are hand-authored**, not derived from the same generators driving the other pages — a latent consistency risk if the underlying build data changes.

---

## 10. Extending This App

To add a new page: create `app/<route>/page.tsx` as a client component, add data generator(s) to `lib/mock-data.ts` (deterministic, seeded via `seededFraction`/`scatteredFraction`, no `Math.random`/`Date.now`), add one entry to `MainNav`'s route array, and — if it needs a Gantt — reuse `GanttRow`/`GanttAxis`/`GanttLegend` rather than hand-rolling a new one unless the visual requirements genuinely diverge (as they did for Powder Planner and Live Schedule).

When a new page's data has a real physical/business constraint (a resource that can only be in one place at a time, a color that should mean one thing consistently, a counter that must not repeat), prefer **pool-based allocation or an explicit ordered mapping over independent per-row random picks** — this codebase has hit the same class of bug (silent duplicate/collision) three separate times when that shortcut was taken.
