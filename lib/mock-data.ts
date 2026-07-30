export type KpiSummary = {
  availableHours: number
  totalBuilds: number
  totalPrintHours: number
  averageBuildHours: number
  averageChangeOverHours: number
  totalChangeOverHours: number
  utilization: number
}

const KPI_PROFILES: Record<string, { actual: KpiSummary; planned: KpiSummary }> = {
  "1": {
    actual: {
      availableHours: 1210,
      totalBuilds: 58,
      totalPrintHours: 498.6,
      averageBuildHours: 8.6,
      averageChangeOverHours: 9.8,
      totalChangeOverHours: 568.4,
      utilization: 39.6,
    },
    planned: {
      availableHours: 1150,
      totalBuilds: 62,
      totalPrintHours: 520,
      averageBuildHours: 8.25,
      averageChangeOverHours: 8.5,
      totalChangeOverHours: 511,
      utilization: 44,
    },
  },
  "2": {
    actual: {
      availableHours: 1325,
      totalBuilds: 61,
      totalPrintHours: 555.2,
      averageBuildHours: 9.1,
      averageChangeOverHours: 11.3,
      totalChangeOverHours: 689.3,
      utilization: 41.9,
    },
    planned: {
      availableHours: 1275,
      totalBuilds: 64,
      totalPrintHours: 585,
      averageBuildHours: 8.75,
      averageChangeOverHours: 9.75,
      totalChangeOverHours: 624,
      utilization: 46,
    },
  },
  "3": {
    actual: {
      availableHours: 1430,
      totalBuilds: 65,
      totalPrintHours: 612.03,
      averageBuildHours: 9.42,
      averageChangeOverHours: 12.77,
      totalChangeOverHours: 817.12,
      utilization: 42.82,
    },
    planned: {
      availableHours: 1350,
      totalBuilds: 70,
      totalPrintHours: 650,
      averageBuildHours: 9,
      averageChangeOverHours: 10.5,
      totalChangeOverHours: 750,
      utilization: 48,
    },
  },
}

export function getKpiSummary(printerId: string = "3"): KpiSummary {
  return (KPI_PROFILES[printerId] ?? KPI_PROFILES["3"]).actual
}

export function getKpiPlanningSummary(printerId: string = "3"): KpiSummary {
  return (KPI_PROFILES[printerId] ?? KPI_PROFILES["3"]).planned
}

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function addHours(date: Date, hours: number) {
  const result = new Date(date)
  result.setHours(result.getHours() + hours)
  return result
}

function addMinutes(date: Date, minutes: number) {
  const result = new Date(date)
  result.setMinutes(result.getMinutes() + minutes)
  return result
}

export type PowderMassPoint = {
  date: string
  massKg: number
  belowThreshold: boolean
}

// How far out the mock production/powder data is generated — both
// getRuntimeSegments (production) and generatePowderMassSeries (powder
// mass) tile/derive from this same window.
const PRODUCTION_DATA_TOTAL_DAYS = 91 // 4/1 - 6/30

// A full hopper holds 70kg. One refill cycle is 4 segments of 30 builds
// each (120 builds total, ~60 days running 24/7): two 30kg topups, one
// smaller 15-20kg topup (varies slightly cycle to cycle), then a full
// refill back to 70kg.
const POWDER_FULL_KG = 70
const SEGMENT_BUILD_COUNTS = [30]
const SEGMENTS_PER_CYCLE = 4
const TOPUP_DURATION_MINUTES = 720 // 12h — long enough to read as a visible slant

// Topups are supposed to fire before mass drops below this threshold —
// doing so is fine. Roughly 1 in 4 segments instead runs it late, dropping
// well below threshold first, so a handful of occasions show up as
// attrition per printer.
export const POWDER_TOPUP_THRESHOLD_KG = 20
const ON_TIME_SEGMENT_END_KG = 24
const LATE_SEGMENT_END_KG = 10

// The first segment always fires its topup on time; most segments after
// that run late instead, so a printer's chart shows a couple of clear
// late-topup scenarios rather than being a rare one-off.
function isLateSegment(globalSegmentIndex: number): boolean {
  return globalSegmentIndex % 3 !== 0
}

// Segment position 0 and 1 are the two fixed 30kg topups; position 2 is
// the smaller, slightly variable 15-20kg topup. Position 3 (the last in
// the cycle) triggers a full refill instead, handled separately.
function getTopupAmount(positionInCycle: number, cycleIndex: number): number {
  if (positionInCycle === 2) {
    return 15 + seededFraction(`topup3-${cycleIndex}`) * 5
  }
  return 30
}

// One point per build/changeover boundary, mirroring the real powder-weight
// trend off the site's PI Vision "Popup Trend" chart: mass declines only
// while a build is actually running (each build takes an even share of its
// 30-build segment's total drop), holds perfectly flat across changeover/
// idle gaps (no build = no powder consumed), then ramps sharply back up
// over TOPUP_DURATION_MINUTES once a segment's build count is hit.
export type PowderLateWindow = { start: string; end: string }

export function generatePowderMassSeries(printerId: string = "3"): {
  points: PowderMassPoint[]
  lateWindows: PowderLateWindow[]
} {
  const segments = getRuntimeSegments(printerId)
  const points: PowderMassPoint[] = []
  const lateWindows: PowderLateWindow[] = []
  if (segments.length === 0) return { points, lateWindows }

  let cursor = new Date(2025, 3, 1, 0, 0)
  let mass = POWDER_FULL_KG
  let globalSegmentIndex = 0
  let cycleIndex = 0
  let positionInCycle = 0
  let segmentLength = SEGMENT_BUILD_COUNTS[0]
  let segmentEndTarget = isLateSegment(0) ? LATE_SEGMENT_END_KG : ON_TIME_SEGMENT_END_KG
  let segmentStartMass = mass
  let buildsIntoSegment = 0
  // Marks the moment mass first crosses the topup threshold within a late
  // segment — closed off into a lateWindows entry once that segment's
  // topup finally fires, so the page can shade the whole overrun span.
  let lateWindowStart: string | null = null

  points.push({ date: cursor.toISOString(), massKg: mass, belowThreshold: false })

  segments.forEach(([hours, run]) => {
    cursor = addHours(cursor, hours)

    if (run === 0) {
      // ChangeOver/idle time — flat line, no powder consumed.
      points.push({
        date: cursor.toISOString(),
        massKg: mass,
        belowThreshold: mass < POWDER_TOPUP_THRESHOLD_KG,
      })
      return
    }

    buildsIntoSegment++
    const wasBelowThreshold = mass < POWDER_TOPUP_THRESHOLD_KG
    const perBuildDrop = (segmentStartMass - segmentEndTarget) / segmentLength
    mass = Math.max(mass - perBuildDrop, 0)
    const isBelowThreshold = mass < POWDER_TOPUP_THRESHOLD_KG
    points.push({ date: cursor.toISOString(), massKg: mass, belowThreshold: isBelowThreshold })

    if (isBelowThreshold && !wasBelowThreshold) {
      lateWindowStart = cursor.toISOString()
    }

    if (buildsIntoSegment >= segmentLength) {
      const isFullRefill = positionInCycle === SEGMENTS_PER_CYCLE - 1
      mass = isFullRefill
        ? POWDER_FULL_KG
        : Math.min(POWDER_FULL_KG, mass + getTopupAmount(positionInCycle, cycleIndex))

      cursor = addMinutes(cursor, TOPUP_DURATION_MINUTES)
      points.push({
        date: cursor.toISOString(),
        massKg: mass,
        belowThreshold: mass < POWDER_TOPUP_THRESHOLD_KG,
      })

      if (lateWindowStart) {
        lateWindows.push({ start: lateWindowStart, end: cursor.toISOString() })
        lateWindowStart = null
      }

      positionInCycle++
      if (positionInCycle >= SEGMENTS_PER_CYCLE) {
        positionInCycle = 0
        cycleIndex++
      }

      globalSegmentIndex++
      segmentLength = SEGMENT_BUILD_COUNTS[globalSegmentIndex % SEGMENT_BUILD_COUNTS.length]
      segmentEndTarget = isLateSegment(globalSegmentIndex)
        ? LATE_SEGMENT_END_KG
        : ON_TIME_SEGMENT_END_KG
      segmentStartMass = mass
      buildsIntoSegment = 0
    }
  })

  return { points, lateWindows }
}

// ---------------------------------------------------------------------------
// Powder Planner — a consolidated, all-printer view standing in for the
// site's manually-maintained "Powder Tracker" spreadsheet: which lot each
// printer is currently running, what's queued next (already IPM-qualified
// elsewhere, or still needing an IPM first), and how many days remain
// before that printer needs a full powder change.
// ---------------------------------------------------------------------------

export const POWDER_PLANNER_PRINTERS = [
  "DE888",
  "DE934",
  "DE936",
  "DE1349",
  "DE1352",
  "DE1355",
  "DE1376",
  "DE1378",
  "DE1380",
  "DE1382",
  "DE1384",
  "DE1386",
  "DE1514",
  "DE1515",
  "DE1718",
  "DE1719",
  "DE1720",
  "DE1721",
  "DE1722",
  "DE1723",
]

// These aren't currently running production (allocated to internal
// projects instead), so the tracker has nothing to report for them.
const POWDER_PLANNER_PROJECT_PRINTERS = new Set([
  "DE888",
  "DE1515",
  "DE1718",
  "DE1719",
  "DE1720",
])

// Each 610kg powder delivery is split 4 ways across printers, so every lot
// family shows up as up to 4 sibling lot numbers (-1 to -4).
const POWDER_LOT_FAMILIES = ["7380734", "7386745", "7385755", "7383527", "7383506"]
const POWDER_STORAGE_EXTRA_FAMILIES = ["7368236", "7361850", "7366359", "7367789"]
const POWDER_STORAGE_NOTES = ["Powder on hold", "Still in Cones printers"]

// "As of" date the tracker's days-remaining/approx-date columns are
// counted from.
const POWDER_PLANNER_REPORT_DATE = new Date(2026, 6, 29)

function addFractionalDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

// Printer/bin identifiers often differ by only a digit or two between
// neighbors (DE1376 vs DE1378, POW1 vs POW2), which barely shifts
// seededFraction's simple additive-character hash. Multiplying the item's
// position by a large prime first spreads neighboring entries across very
// different seed strings so their generated values don't cluster together.
function scatteredFraction(index: number, salt: string): number {
  return seededFraction(`${index * 104729}-${salt}`)
}

const POWDER_PLANNER_COLOR_PALETTE = [
  "border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200",
  "border-blue-300 bg-blue-100 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
  "border-purple-300 bg-purple-100 text-purple-900 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-200",
  "border-pink-300 bg-pink-100 text-pink-900 dark:border-pink-800 dark:bg-pink-950 dark:text-pink-200",
  "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  "border-cyan-300 bg-cyan-100 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-200",
  "border-lime-300 bg-lime-100 text-lime-900 dark:border-lime-800 dark:bg-lime-950 dark:text-lime-200",
  "border-indigo-300 bg-indigo-100 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  "border-teal-300 bg-teal-100 text-teal-900 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200",
  "border-fuchsia-300 bg-fuchsia-100 text-fuchsia-900 dark:border-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200",
  "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200",
]

// Every lot family gets its own palette slot in first-seen order, rather
// than a hash, so two unrelated deliveries can never land on the same
// color — a hash-mod approach collided for a few of these once the
// storage-plan-only families were added (more distinct families than
// palette slots is fine as long as this list stays under 12; a hash would
// silently keep colliding as more are added).
const POWDER_LOT_FAMILY_COLOR_MAP: Record<string, string> = Object.fromEntries(
  [...POWDER_LOT_FAMILIES, ...POWDER_STORAGE_EXTRA_FAMILIES].map((family, index) => [
    family,
    POWDER_PLANNER_COLOR_PALETTE[index % POWDER_PLANNER_COLOR_PALETTE.length],
  ])
)

// So the same lot family always renders the same color, letting you
// visually trace one delivery's 4-way split across printers.
export function lotFamilyColorClass(lotFamily: string | null | undefined): string {
  if (!lotFamily) return "border-border bg-muted/40 text-muted-foreground"
  return (
    POWDER_LOT_FAMILY_COLOR_MAP[lotFamily] ??
    POWDER_PLANNER_COLOR_PALETTE[POWDER_PLANNER_COLOR_PALETTE.length - 1]
  )
}

export type PowderPlannerRow = {
  printerId: string
  state: "Running" | "Projects"
  topUpCount: number | null
  cycleCount: number | null
  currentLot: string | null
  nextQualifiedLot: string | null
  nextIpmLot: string | null
  daysToNewPowder: number | null
  approxDateNewPowder: string | null
}

// Every physical portion across the 5 main delivery families — 4 splits
// each, one per printer, per the real 610kg/4-printer rule. Drawn from
// without replacement below so no two printers can ever reference the
// same physical portion as their current or next lot.
const ALL_PRINTER_LOT_PORTIONS = POWDER_LOT_FAMILIES.flatMap((family) =>
  [1, 2, 3, 4].map((suffix) => `${family}-${suffix}`)
)

// Deterministically reorders a fixed list by a per-position scattered
// value — looks shuffled but is stable across re-renders.
function deterministicShuffle<T>(items: T[], salt: string): T[] {
  return items
    .map((item, index) => ({ item, sortKey: scatteredFraction(index, salt) }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ item }) => item)
}

// Mirrors the real tracker's math one-for-one: with 30 builds per topup
// segment and 4 segments per full cycle, a printer at topup N / cycle
// count C has (3 - N) full 30-build segments left plus (30 - C) builds
// left in its current one — at ~12h/build (9h build + 3h changeover),
// that's ((3-N)*30 + (30-C)) * 0.5 days until the next full powder change.
export function generatePowderPlannerRows(): PowderPlannerRow[] {
  const runningPrinters = POWDER_PLANNER_PRINTERS.filter(
    (printerId) => !POWDER_PLANNER_PROJECT_PRINTERS.has(printerId)
  )

  // One unique portion per running printer for "current," leaving
  // whatever's left over as the pool "next" lots can draw from — so a
  // portion already loaded somewhere can never also show up as another
  // printer's queued next lot.
  const shuffledPortions = deterministicShuffle(ALL_PRINTER_LOT_PORTIONS, "portion-order")
  const currentPortions = shuffledPortions.slice(0, runningPrinters.length)
  const nextPortions = shuffledPortions.slice(runningPrinters.length)

  const rows = new Map<string, PowderPlannerRow>()

  POWDER_PLANNER_PRINTERS.forEach((printerId) => {
    if (POWDER_PLANNER_PROJECT_PRINTERS.has(printerId)) {
      rows.set(printerId, {
        printerId,
        state: "Projects",
        topUpCount: null,
        cycleCount: null,
        currentLot: null,
        nextQualifiedLot: null,
        nextIpmLot: null,
        daysToNewPowder: null,
        approxDateNewPowder: null,
      })
    }
  })

  runningPrinters.forEach((printerId, runningIndex) => {
    const topUpCount = Math.floor(scatteredFraction(runningIndex, "topup") * 4)
    const cycleCount = Math.floor(scatteredFraction(runningIndex, "cycle") * 30)
    const daysToNewPowder =
      Math.round(((3 - topUpCount) * 30 + (30 - cycleCount)) * 0.5 * 10) / 10
    const approxDateNewPowder = addFractionalDays(
      POWDER_PLANNER_REPORT_DATE,
      daysToNewPowder
    ).toISOString()

    rows.set(printerId, {
      printerId,
      state: "Running",
      topUpCount,
      cycleCount,
      currentLot: currentPortions[runningIndex],
      nextQualifiedLot: null,
      nextIpmLot: null,
      daysToNewPowder,
      approxDateNewPowder,
    })
  })

  // Only as many printers as there are leftover portions get a queued
  // "next" lot lined up — matching the real tracker, where most rows
  // leave both Next columns blank until a swap is actually imminent.
  const printersWithNext = deterministicShuffle(runningPrinters, "next-eligible").slice(
    0,
    nextPortions.length
  )
  printersWithNext.forEach((printerId, i) => {
    const row = rows.get(printerId)!
    const nextLot = nextPortions[i]
    if (scatteredFraction(i, "needs-ipm") > 0.3) {
      row.nextIpmLot = nextLot
    } else {
      row.nextQualifiedLot = nextLot
    }
  })

  return POWDER_PLANNER_PRINTERS.map((printerId) => rows.get(printerId)!)
}

export type PowderStorageBin = {
  bin: string
  kg: number
  lot: string | null
  note: string | null
}

// The 4-printer delivery split leaves 2.5kg behind to flush the sieve, so a
// bin's contents run a little under the round 152.5kg-per-printer share.
// Only draws from the storage-only families — the 5 main delivery
// families are fully accounted for as printer current/next lots above, so
// none of their portions should also show up sitting in a cabinet.
export function generatePowderStorageBins(count: number = 25): PowderStorageBin[] {
  return Array.from({ length: count }, (_, i): PowderStorageBin => {
    const bin = `POW${i + 1}`
    if (scatteredFraction(i, "bin-empty") < 0.15) {
      return { bin, kg: 0, lot: null, note: null }
    }

    const family =
      POWDER_STORAGE_EXTRA_FAMILIES[
        Math.floor(scatteredFraction(i, "bin-family") * POWDER_STORAGE_EXTRA_FAMILIES.length)
      ]
    const suffix = 1 + Math.floor(scatteredFraction(i, "bin-suffix") * 4)
    const kg = Math.round((150 + scatteredFraction(i, "bin-kg") * 180) * 2) / 2
    const hasNote = scatteredFraction(i, "bin-note") < 0.12
    const note = hasNote
      ? POWDER_STORAGE_NOTES[
          Math.floor(scatteredFraction(i, "bin-note-index") * POWDER_STORAGE_NOTES.length)
        ]
      : null

    return { bin, kg, lot: `${family}-${suffix}`, note }
  })
}

export type RuntimePoint = { timestamp: string; run: number }

export const PRINTER_IDS = ["1", "2", "3"]

// Derived from a real BuildSummary export for printer 3 (build/changeover
// durations in whole hours, run=1 for a build, run=0 for the changeover
// after it) — mostly short changeovers punctuated by occasional multi-day
// gaps. Printers 1 and 2 apply a small per-printer scale + jitter to the
// same sequence so all three look related but not identical.
const RUNTIME_PROFILES: Record<string, Array<[number, number]>> = {
  "1": [
    [5, 1],
    [2, 0],
    [7, 1],
    [2, 0],
    [7, 1],
    [2, 0],
    [7, 1],
    [2, 0],
    [7, 1],
    [19, 0],
    [8, 1],
    [49, 0],
    [8, 1],
    [2, 0],
    [8, 1],
    [4, 0],
    [8, 1],
    [3, 0],
    [9, 1],
    [3, 0],
    [9, 1],
    [1, 0],
    [9, 1],
    [4, 0],
    [9, 1],
    [3, 0],
    [9, 1],
    [61, 0],
    [9, 1],
    [3, 0],
    [9, 1],
    [5, 0],
    [9, 1],
    [2, 0],
    [9, 1],
    [4, 0],
    [9, 1],
    [4, 0],
    [9, 1],
    [2, 0],
    [10, 1],
    [3, 0],
    [10, 1],
    [74, 0],
    [10, 1],
    [3, 0],
    [9, 1],
    [2, 0],
    [9, 1],
    [2, 0],
    [8, 1],
    [6, 0],
    [8, 1],
    [2, 0],
    [8, 1],
    [2, 0],
    [8, 1],
    [54, 0],
    [8, 1],
    [2, 0],
    [8, 1],
    [5, 0],
    [8, 1],
    [2, 0],
    [8, 1],
    [3, 0],
    [8, 1],
    [2, 0],
    [8, 1],
    [6, 0],
    [8, 1],
    [3, 0],
    [8, 1],
    [8, 0],
    [10, 1],
    [75, 0],
    [9, 1],
    [2, 0],
    [8, 1],
    [3, 0],
    [5, 1],
    [3, 0],
    [8, 1],
    [2, 0],
    [8, 1],
    [2, 0],
    [8, 1],
    [3, 0],
    [8, 1],
    [55, 0],
    [8, 1],
    [5, 0],
    [8, 1],
    [2, 0],
    [8, 1],
    [3, 0],
    [8, 1],
    [56, 0],
    [8, 1],
    [49, 0],
    [8, 1],
    [2, 0],
    [8, 1],
    [5, 0],
    [8, 1],
    [2, 0],
    [8, 1],
    [2, 0],
    [8, 1],
    [2, 0],
    [9, 1],
    [3, 0],
    [9, 1],
    [3, 0],
    [8, 1],
    [2, 0],
    [8, 1],
    [50, 0],
    [8, 1],
    [3, 0],
    [7, 1],
    [2, 0],
    [7, 1],
    [3, 0],
    [7, 1],
    [12, 0],
    [7, 1],
    [34, 0],
    [7, 1],
  ],
  "2": [
    [6, 1],
    [2, 0],
    [9, 1],
    [3, 0],
    [9, 1],
    [3, 0],
    [9, 1],
    [2, 0],
    [9, 1],
    [21, 0],
    [10, 1],
    [54, 0],
    [10, 1],
    [2, 0],
    [10, 1],
    [4, 0],
    [10, 1],
    [3, 0],
    [11, 1],
    [3, 0],
    [11, 1],
    [1, 0],
    [11, 1],
    [4, 0],
    [11, 1],
    [3, 0],
    [11, 1],
    [67, 0],
    [11, 1],
    [3, 0],
    [11, 1],
    [6, 0],
    [11, 1],
    [2, 0],
    [11, 1],
    [4, 0],
    [12, 1],
    [4, 0],
    [11, 1],
    [2, 0],
    [12, 1],
    [3, 0],
    [12, 1],
    [80, 0],
    [12, 1],
    [3, 0],
    [11, 1],
    [2, 0],
    [11, 1],
    [2, 0],
    [10, 1],
    [7, 0],
    [10, 1],
    [2, 0],
    [10, 1],
    [2, 0],
    [10, 1],
    [59, 0],
    [10, 1],
    [2, 0],
    [10, 1],
    [6, 0],
    [10, 1],
    [2, 0],
    [10, 1],
    [3, 0],
    [10, 1],
    [2, 0],
    [10, 1],
    [7, 0],
    [10, 1],
    [3, 0],
    [10, 1],
    [9, 0],
    [12, 1],
    [82, 0],
    [11, 1],
    [2, 0],
    [10, 1],
    [3, 0],
    [7, 1],
    [3, 0],
    [10, 1],
    [2, 0],
    [10, 1],
    [2, 0],
    [10, 1],
    [3, 0],
    [10, 1],
    [60, 0],
    [10, 1],
    [5, 0],
    [10, 1],
    [2, 0],
    [10, 1],
    [3, 0],
    [10, 1],
    [62, 0],
    [10, 1],
    [54, 0],
    [9, 1],
    [2, 0],
    [9, 1],
    [5, 0],
    [9, 1],
    [2, 0],
    [9, 1],
    [2, 0],
    [9, 1],
    [2, 0],
    [11, 1],
    [3, 0],
    [11, 1],
    [3, 0],
    [10, 1],
    [2, 0],
    [9, 1],
    [53, 0],
    [9, 1],
    [3, 0],
    [9, 1],
    [2, 0],
    [9, 1],
    [3, 0],
    [9, 1],
    [13, 0],
    [9, 1],
    [36, 0],
    [9, 1],
  ],
  "3": [
    [6, 1],
    [2, 0],
    [9, 1],
    [3, 0],
    [9, 1],
    [3, 0],
    [9, 1],
    [2, 0],
    [9, 1],
    [23, 0],
    [9, 1],
    [56, 0],
    [9, 1],
    [2, 0],
    [9, 1],
    [4, 0],
    [9, 1],
    [3, 0],
    [10, 1],
    [3, 0],
    [10, 1],
    [1, 0],
    [10, 1],
    [4, 0],
    [10, 1],
    [3, 0],
    [10, 1],
    [69, 0],
    [10, 1],
    [3, 0],
    [10, 1],
    [6, 0],
    [10, 1],
    [2, 0],
    [10, 1],
    [4, 0],
    [11, 1],
    [4, 0],
    [10, 1],
    [2, 0],
    [11, 1],
    [3, 0],
    [11, 1],
    [82, 0],
    [11, 1],
    [3, 0],
    [10, 1],
    [2, 0],
    [10, 1],
    [2, 0],
    [9, 1],
    [7, 0],
    [9, 1],
    [2, 0],
    [9, 1],
    [2, 0],
    [9, 1],
    [60, 0],
    [9, 1],
    [2, 0],
    [9, 1],
    [6, 0],
    [9, 1],
    [2, 0],
    [9, 1],
    [3, 0],
    [9, 1],
    [2, 0],
    [9, 1],
    [7, 0],
    [9, 1],
    [3, 0],
    [9, 1],
    [9, 0],
    [11, 1],
    [82, 0],
    [10, 1],
    [2, 0],
    [9, 1],
    [3, 0],
    [6, 1],
    [3, 0],
    [9, 1],
    [2, 0],
    [9, 1],
    [2, 0],
    [9, 1],
    [3, 0],
    [9, 1],
    [60, 0],
    [9, 1],
    [5, 0],
    [9, 1],
    [2, 0],
    [9, 1],
    [3, 0],
    [9, 1],
    [61, 0],
    [9, 1],
    [53, 0],
    [9, 1],
    [2, 0],
    [9, 1],
    [6, 0],
    [9, 1],
    [2, 0],
    [9, 1],
    [2, 0],
    [9, 1],
    [2, 0],
    [11, 1],
    [3, 0],
    [11, 1],
    [3, 0],
    [10, 1],
    [2, 0],
    [9, 1],
    [58, 0],
    [9, 1],
    [3, 0],
    [9, 1],
    [2, 0],
    [9, 1],
    [3, 0],
    [9, 1],
    [14, 0],
    [9, 1],
    [40, 0],
    [9, 1],
  ],
}

// The Batch/Lot Timeline page's per-lot build durations are pulled straight
// from RUNTIME_PROFILES (the same source the Printer Runtime and Topup page
// uses) rather than a separately hand-authored list, so both pages always
// show the same batch durations.
// Continues a printer's hand-picked lot-number sequence far enough that
// every build gets its own unique lot ID instead of cycling back through a
// short list once the tiled build count exceeds it. The step between new
// IDs is the median gap in the existing sequence (median rather than mean
// since a couple of these hand-picked sequences have one big one-off jump
// that would otherwise badly skew the typical step) plus a little
// deterministic jitter, so the continuation still looks like the same
// numbering scheme.
function extendLotIds(existing: string[], count: number, seedPrefix: string): string[] {
  if (count <= existing.length) return existing.slice(0, count)

  const diffs = existing
    .slice(1)
    .map((value, i) => Number(value) - Number(existing[i]))
    .sort((a, b) => a - b)
  const mid = Math.floor(diffs.length / 2)
  const medianDiff =
    diffs.length % 2 === 0 ? (diffs[mid - 1] + diffs[mid]) / 2 : diffs[mid]
  const avgStep = Math.max(1, Math.round(medianDiff))

  const ids = [...existing]
  let current = Number(existing[existing.length - 1])

  for (let i = existing.length; i < count; i++) {
    const jitter = Math.round(
      (seededFraction(`${seedPrefix}-lotid-${i}`) - 0.5) * avgStep * 0.6
    )
    current += avgStep + jitter
    ids.push(String(current))
  }

  return ids
}

function getRuntimeBuildHours(printerId: string): number[] {
  // Tiled (not the raw single hand-authored cycle) so the Batch/Lot
  // Timeline page has as many lots as the Printer Runtime and Topup page
  // has builds, instead of stopping after one short cycle.
  return getRuntimeSegments(printerId)
    .filter(([, run]) => run === 1)
    .map(([hours]) => hours)
}

// Tiles each printer's hand-authored build/idle pattern back-to-back until
// it covers PRODUCTION_DATA_TOTAL_DAYS, so widening the date filter reveals
// more real production history instead of running dry after ~10 days.
function getRuntimeSegments(printerId: string): Array<[number, number]> {
  const pattern = RUNTIME_PROFILES[printerId] ?? RUNTIME_PROFILES["3"]
  const targetHours = PRODUCTION_DATA_TOTAL_DAYS * 24

  const segments: Array<[number, number]> = []
  let totalHours = 0
  let index = 0
  while (totalHours < targetHours) {
    const segment = pattern[index % pattern.length]
    segments.push(segment)
    totalHours += segment[0]
    index++
  }

  return segments
}

export function generateRuntimeSeries(printerId: string = "3"): RuntimePoint[] {
  const start = new Date(2025, 3, 1, 0, 0)
  const segments = getRuntimeSegments(printerId)

  const points: RuntimePoint[] = []
  let cursor = start

  for (const [hours, run] of segments) {
    points.push({ timestamp: cursor.toISOString(), run })
    cursor = addHours(cursor, hours)
    points.push({ timestamp: addHours(cursor, -0.01).toISOString(), run })
  }
  points.push({ timestamp: cursor.toISOString(), run: 1 })

  return points
}

export type TimeSpan = {
  start: string
  end: string
  lotId: string
  productId: string
}

// The start/end of each "running" (value 1) span, for shading a background
// behind each build on the chart. Carries the lot/product it corresponds to
// so the runtime tooltip can show which batch is running at a given time.
export function generateRuntimeBuildSpans(printerId: string = "3"): TimeSpan[] {
  const start = new Date(2025, 3, 1, 0, 0)
  const segments = getRuntimeSegments(printerId)
  const { lotIds, productIds } = getPrinterProfile(printerId)

  const spans: TimeSpan[] = []
  let cursor = start
  let buildIndex = 0

  for (const [hours, run] of segments) {
    const segmentStart = cursor
    cursor = addHours(cursor, hours)
    if (run === 1) {
      spans.push({
        start: segmentStart.toISOString(),
        end: cursor.toISOString(),
        lotId: lotIds[buildIndex % lotIds.length],
        productId: productIds[buildIndex % productIds.length],
      })
      buildIndex++
    }
  }

  return spans
}

export type GanttSegment = {
  type:
    | "Build"
    | "ChangeOver"
    | "Overrun"
    | "BuildOverrun"
    | "Ahead"
    | "Leave"
    | "Maintenance"
    | "StartOffset"
  start: string
  end: string
  lotId?: string
  productId?: string
  operator?: string
  // Identifies which build occurrence a segment belongs to, for pairing
  // Production/Planning segments that share the same lotId — lot numbers
  // cycle back around once a printer's short lotId list is exhausted, so
  // lotId alone isn't unique enough once the chain runs past a handful of
  // builds.
  groupKey?: string
  // Why a build or changeover ran long — only set on Overrun/BuildOverrun
  // segments.
  reason?: string
}

type PrinterProfile = {
  buildHours: number[]
  changeOverHours: number
  lotIds: string[]
  productIds: string[]
  operators: string[]
}

// One shared operator roster across every printer — the same ten people
// rotate across all three printers rather than each printer having its own
// separate pool of names.
const SHARED_OPERATORS = [
  "Siobhan Ryan",
  "Liam Kennedy",
  "Grainne Fitzgerald",
  "Darragh Murphy",
  "Aoibhinn Walsh",
  "Tadhg Byrne",
  "Clodagh Doyle",
  "Eamon Kelly",
  "Roisin Gallagher",
  "Fiachra Brennan",
]

const PRINTER_PROFILES: Record<string, PrinterProfile> = {
  "1": {
    buildHours: getRuntimeBuildHours("1"),
    changeOverHours: 6,
    lotIds: extendLotIds(
      [
        "5501120",
        "5501144",
        "5501167",
        "5501190",
        "5501212",
        "5501235",
        "5501258",
      ],
      getRuntimeBuildHours("1").length,
      "1"
    ),
    productIds: [
      "PRD-10142",
      "PRD-10156",
      "PRD-10173",
      "PRD-10188",
      "PRD-10205",
      "PRD-10219",
      "PRD-10234",
      "PRD-10251",
      "PRD-10267",
      "PRD-10282",
    ],
    operators: SHARED_OPERATORS,
  },
  "2": {
    buildHours: getRuntimeBuildHours("2"),
    changeOverHours: 7,
    lotIds: extendLotIds(
      [
        "6602201",
        "6602223",
        "6602245",
        "6602267",
        "6602289",
        "6602301",
        "6602323",
      ],
      getRuntimeBuildHours("2").length,
      "2"
    ),
    productIds: [
      "PRD-20305",
      "PRD-20319",
      "PRD-20334",
      "PRD-20348",
      "PRD-20362",
      "PRD-20377",
      "PRD-20391",
      "PRD-20406",
      "PRD-20420",
      "PRD-20435",
      "PRD-20449",
    ],
    operators: SHARED_OPERATORS,
  },
  "3": {
    buildHours: getRuntimeBuildHours("3"),
    changeOverHours: 8,
    lotIds: extendLotIds(
      [
        "2246447",
        "4775614",
        "4776612",
        "4776999",
        "4777011",
        "4777006",
        "4777008",
      ],
      getRuntimeBuildHours("3").length,
      "3"
    ),
    productIds: [
      "PRD-30112",
      "PRD-30126",
      "PRD-30140",
      "PRD-30155",
      "PRD-30169",
      "PRD-30183",
      "PRD-30198",
      "PRD-30212",
      "PRD-30226",
      "PRD-30241",
      "PRD-30255",
      "PRD-30269",
      "PRD-30284",
    ],
    operators: SHARED_OPERATORS,
  },
}

function getPrinterProfile(printerId: string): PrinterProfile {
  return PRINTER_PROFILES[printerId] ?? PRINTER_PROFILES["3"]
}

export function getPrinterOperators(printerId: string = "3"): string[] {
  return getPrinterProfile(printerId).operators
}

// Standard planning reference per the real process: a plain build is
// planned at 9h + 3h changeover. An IPM (qualification/coupon) build is
// shorter — 6h + 1h changeover — since it's a smaller test build rather
// than a full production run.
const PLANNING_BUILD_HOURS_OPTIONS = [9]
const PLANNING_CHANGEOVER_HOURS = 3
export const IPM_BUILD_HOURS = 6
export const IPM_CHANGEOVER_HOURS = 1

function getPlannedBuildHours(index: number): number {
  return PLANNING_BUILD_HOURS_OPTIONS[index % PLANNING_BUILD_HOURS_OPTIONS.length]
}

type BuildPair = {
  start: Date
  actualHours: number
  changeOverHours: number
  lotId: string
  productId: string
  operator: string
}

// Each production build and its planned counterpart share the same start
// time, so the two rows read as "same lot, same starting point." Whichever
// one is shorter for that lot leaves a gap before the next lot begins.
function getPrinterBuildPairs(printerId: string): BuildPair[] {
  const { buildHours, changeOverHours, lotIds, productIds, operators } =
    getPrinterProfile(printerId)
  const start = new Date(2025, 3, 1)
  const pairs: BuildPair[] = []
  let cursor = start

  buildHours.forEach((hours, index) => {
    const co = index === buildHours.length - 1 ? 0 : changeOverHours

    pairs.push({
      start: new Date(cursor),
      actualHours: hours,
      changeOverHours: co,
      lotId: lotIds[index % lotIds.length],
      productId: productIds[index % productIds.length],
      operator: operators[index % operators.length],
    })

    cursor = addHours(cursor, hours + co)
  })

  return pairs
}

export type PrinterLotChain = {
  productionSegments: GanttSegment[]
  planningSegments: GanttSegment[]
  domainStart: number
  domainEnd: number
}

// Plausible causes for a build or changeover running past its planned
// reference — picked deterministically per lot so the same lot always
// shows the same reason.
const BUILD_OVERRUN_REASONS = [
  "Support structure failure required a reprint segment",
  "Layer adhesion issue slowed the build",
  "Powder feed inconsistency",
  "Print head recalibration mid-build",
  "Unexpected geometry complexity",
  "Recoater blade jam",
]
const CHANGEOVER_OVERRUN_REASONS = [
  "Extended post-processing",
  "Powder removal and recovery delay",
  "Build plate replacement",
  "Quality inspection hold",
  "Chamber cleaning required",
  "Operator changeover",
]

function pickReason(reasons: string[], seed: string): string {
  const index = Math.floor(seededFraction(seed) * reasons.length)
  return reasons[Math.min(index, reasons.length - 1)]
}

// Production and Planning are each their own independent, gap-free chain —
// Planning always at its own clean, uninterrupted pace (just Build +
// ChangeOver, lot after lot), Production at its own real pace (which runs
// longer overall, since real changeovers exceed the fixed 2h planning
// reference and a few builds overrun their plan). Rather than padding
// Planning out to match Production lot-by-lot, any time Production's build
// or changeover exceeds its planned reference, that extra time is colored
// directly onto Production's own bar — attached right after the portion
// that matches plan — so the delta stays visually anchored to the segment
// it actually belongs to.
export function generatePrinterLotChain(printerId: string = "3"): PrinterLotChain {
  const anchor = new Date(2025, 3, 1)
  const productionSegments: GanttSegment[] = []
  let productionEnd = anchor

  getPrinterBuildPairs(printerId)
    .slice(0, BATCH_LOT_TIMELINE_LOT_LIMIT)
    .forEach(
      ({ start, actualHours, changeOverHours, lotId, productId, operator }, index) => {
        const plannedBuildHours = getPlannedBuildHours(index)
        const common = { lotId, productId, operator, groupKey: String(index) }

        const buildRefHours = Math.min(actualHours, plannedBuildHours)
        const buildRefEnd = addHours(start, buildRefHours)
        productionSegments.push({
          type: "Build",
          start: start.toISOString(),
          end: buildRefEnd.toISOString(),
          ...common,
        })
        const buildEnd = addHours(start, actualHours)
        if (actualHours > plannedBuildHours) {
          productionSegments.push({
            type: "BuildOverrun",
            start: buildRefEnd.toISOString(),
            end: buildEnd.toISOString(),
            ...common,
            reason: pickReason(BUILD_OVERRUN_REASONS, `${lotId}-${index}-build`),
          })
        } else if (actualHours < plannedBuildHours) {
          productionSegments.push({
            type: "Ahead",
            start: buildEnd.toISOString(),
            end: addHours(start, plannedBuildHours).toISOString(),
            ...common,
          })
        }

        const changeOverRefHours = Math.min(changeOverHours, PLANNING_CHANGEOVER_HOURS)
        const changeOverRefEnd = addHours(buildEnd, changeOverRefHours)
        const changeOverEnd = addHours(buildEnd, changeOverHours)
        if (changeOverHours > 0) {
          productionSegments.push({
            type: "ChangeOver",
            start: buildEnd.toISOString(),
            end: changeOverRefEnd.toISOString(),
            ...common,
          })
          if (changeOverHours > PLANNING_CHANGEOVER_HOURS) {
            productionSegments.push({
              type: "Overrun",
              start: changeOverRefEnd.toISOString(),
              end: changeOverEnd.toISOString(),
              ...common,
              reason: pickReason(
                CHANGEOVER_OVERRUN_REASONS,
                `${lotId}-${index}-changeover`
              ),
            })
          }
        }

        productionEnd = changeOverEnd
      }
    )

  const planningSegments = generateLotPlanningTimelines(printerId).flatMap(
    (lot) => lot.segments
  )
  const planningEnd = planningSegments.length
    ? new Date(planningSegments[planningSegments.length - 1].end)
    : anchor

  return {
    productionSegments,
    planningSegments,
    domainStart: anchor.getTime(),
    domainEnd: Math.max(productionEnd.getTime(), planningEnd.getTime()),
  }
}

// Where the historical schedule leaves off — forecasted builds continue
// forward from here.
function getForecastStart(printerId: string): Date {
  const pairs = getPrinterBuildPairs(printerId)
  const lastPair = pairs[pairs.length - 1]
  return addHours(lastPair.start, lastPair.actualHours + lastPair.changeOverHours)
}

export type OperatorForecastBuild = {
  lotId: string
  productId: string
  operator: string
  segments: GanttSegment[]
}

// Forecasted upcoming builds, assigned round-robin to operators, each
// running a planned build (12h/15h/18h, cycling) + 2h changeover.
export function generateOperatorForecast(
  printerId: string = "3",
  count: number = 40
): OperatorForecastBuild[] {
  const pairs = getPrinterBuildPairs(printerId)
  const { lotIds, productIds, operators } = getPrinterProfile(printerId)

  const builds: OperatorForecastBuild[] = []
  let cursor = getForecastStart(printerId)

  for (let i = 0; i < count; i++) {
    const index = pairs.length + i
    const lotId = lotIds[index % lotIds.length]
    const productId = productIds[index % productIds.length]
    const operator = operators[index % operators.length]

    const start = new Date(cursor)
    const buildEnd = addHours(start, getPlannedBuildHours(index))
    const changeOverEnd = addHours(buildEnd, PLANNING_CHANGEOVER_HOURS)

    const segments: GanttSegment[] = [
      {
        type: "Build",
        start: start.toISOString(),
        end: buildEnd.toISOString(),
        lotId,
        productId,
        operator,
      },
      {
        type: "ChangeOver",
        start: buildEnd.toISOString(),
        end: changeOverEnd.toISOString(),
        lotId,
        productId,
        operator,
      },
    ]

    builds.push({ lotId, productId, operator, segments })
    cursor = changeOverEnd
  }

  return builds
}

export type MaintenanceWindow = { start: string; end: string }

// Recurring maintenance downtime per printer — a fixed-length block every N
// days, phase-offset per printer so all three don't line up on the same day.
const MAINTENANCE_INTERVAL_DAYS: Record<string, number> = {
  "1": 6,
  "2": 5,
  "3": 7,
}
const MAINTENANCE_DURATION_HOURS: Record<string, number> = {
  "1": 3,
  "2": 4,
  "3": 5,
}
const MAINTENANCE_OFFSET_DAYS: Record<string, number> = {
  "1": 2,
  "2": 1,
  "3": 3,
}

export function generatePrinterMaintenanceSchedule(
  printerId: string = "3",
  count: number = 40
): MaintenanceWindow[] {
  const forecastStart = getForecastStart(printerId)
  const lastBuildEnd = addHours(
    forecastStart,
    count * (getPlannedBuildHours(0) + PLANNING_CHANGEOVER_HOURS + 24)
  )

  const intervalDays = MAINTENANCE_INTERVAL_DAYS[printerId] ?? 6
  const durationHours = MAINTENANCE_DURATION_HOURS[printerId] ?? 4
  const offsetDays = MAINTENANCE_OFFSET_DAYS[printerId] ?? 2

  const windows: MaintenanceWindow[] = []
  let cursor = addDays(forecastStart, offsetDays)

  while (cursor.getTime() < lastBuildEnd.getTime()) {
    const end = addHours(cursor, durationHours)
    windows.push({ start: cursor.toISOString(), end: end.toISOString() })
    cursor = addDays(cursor, intervalDays)
  }

  return windows
}

// The same round-robin forecast as generateOperatorForecast, but re-optimized
// around printer maintenance: whenever a build's start would run into a
// maintenance window, it's pushed out to the end of that window before being
// scheduled, so no build ever overlaps downtime.
export function generateOptimizedOperatorForecast(
  printerId: string = "3",
  count: number = 40
): OperatorForecastBuild[] {
  const pairs = getPrinterBuildPairs(printerId)
  const { lotIds, productIds, operators } = getPrinterProfile(printerId)
  const maintenanceWindows = generatePrinterMaintenanceSchedule(
    printerId,
    count
  ).map((window) => ({
    start: new Date(window.start).getTime(),
    end: new Date(window.end).getTime(),
  }))

  const builds: OperatorForecastBuild[] = []
  let cursor = getForecastStart(printerId)

  for (let i = 0; i < count; i++) {
    const index = pairs.length + i
    const lotId = lotIds[index % lotIds.length]
    const productId = productIds[index % productIds.length]
    const operator = operators[index % operators.length]
    const buildHours = getPlannedBuildHours(index)

    let start = new Date(cursor)
    let pushedOut = true
    while (pushedOut) {
      pushedOut = false
      const startMs = start.getTime()
      const buildEndMs = startMs + buildHours * 60 * 60 * 1000
      for (const window of maintenanceWindows) {
        if (startMs < window.end && buildEndMs > window.start) {
          start = new Date(window.end)
          pushedOut = true
          break
        }
      }
    }

    const buildEnd = addHours(start, buildHours)
    const changeOverEnd = addHours(buildEnd, PLANNING_CHANGEOVER_HOURS)

    const segments: GanttSegment[] = [
      {
        type: "Build",
        start: start.toISOString(),
        end: buildEnd.toISOString(),
        lotId,
        productId,
        operator,
      },
      {
        type: "ChangeOver",
        start: buildEnd.toISOString(),
        end: changeOverEnd.toISOString(),
        lotId,
        productId,
        operator,
      },
    ]

    builds.push({ lotId, productId, operator, segments })
    cursor = changeOverEnd
  }

  return builds
}

export type OperatorLeave = {
  operator: string
  start: string
  end: string
}

// Deterministic per-seed fraction in [0, 1) — keeps leave placement stable
// across re-renders without relying on Math.random().
function seededFraction(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return (Math.abs(hash) % 997) / 997
}

// One leave day per operator, dropped somewhere in the idle gap between their
// first and second forecasted build. Both the offset into the gap and the
// duration are randomized so leave doesn't always start the moment a shift
// ends — it's biased into the middle of the gap, leaving a buffer on both
// sides so it never overlaps a scheduled build.
export function generateOperatorLeaves(
  printerId: string = "3",
  count: number = 40
): OperatorLeave[] {
  const forecastBuilds = generateOperatorForecast(printerId, count)
  const { operators } = getPrinterProfile(printerId)
  const leaves: OperatorLeave[] = []

  operators.forEach((operator) => {
    const ownBuilds = forecastBuilds.filter(
      (build) => build.operator === operator
    )
    if (ownBuilds.length < 2) return

    const firstBuildEnd = new Date(
      ownBuilds[0].segments[ownBuilds[0].segments.length - 1].end
    )
    const secondBuildStart = new Date(ownBuilds[1].segments[0].start)
    const gapHours =
      (secondBuildStart.getTime() - firstBuildEnd.getTime()) /
      (1000 * 60 * 60)

    const minLeaveHours = 4
    const maxLeaveHours = Math.min(24, gapHours - 2)
    if (maxLeaveHours < minLeaveHours) return

    const durationFraction = seededFraction(`${operator}-leave-duration`)
    const leaveHours =
      minLeaveHours + (maxLeaveHours - minLeaveHours) * durationFraction

    const maxOffsetHours = gapHours - leaveHours
    const offsetFraction = seededFraction(`${operator}-leave-offset`)
    const offsetHours = maxOffsetHours * (0.2 + offsetFraction * 0.7)

    const leaveStart = addHours(firstBuildEnd, offsetHours)
    leaves.push({
      operator,
      start: leaveStart.toISOString(),
      end: addHours(leaveStart, leaveHours).toISOString(),
    })
  })

  return leaves
}

// A clean, uninterrupted planned cadence (12h/15h/18h builds + 2h
// changeover, cycling) over the same forecast window, for comparison
// against the operator rows.
export function generateForecastPlanningSegments(
  printerId: string = "3",
  count: number = 40
): GanttSegment[] {
  const pairs = getPrinterBuildPairs(printerId)
  const { lotIds, productIds } = getPrinterProfile(printerId)
  const segments: GanttSegment[] = []
  let cursor = getForecastStart(printerId)

  for (let i = 0; i < count; i++) {
    const index = pairs.length + i
    const lotId = lotIds[index % lotIds.length]
    const productId = productIds[index % productIds.length]

    const buildEnd = addHours(cursor, getPlannedBuildHours(index))
    const changeOverEnd = addHours(buildEnd, PLANNING_CHANGEOVER_HOURS)

    segments.push({
      type: "Build",
      start: cursor.toISOString(),
      end: buildEnd.toISOString(),
      lotId,
      productId,
    })
    segments.push({
      type: "ChangeOver",
      start: buildEnd.toISOString(),
      end: changeOverEnd.toISOString(),
      lotId,
      productId,
    })

    cursor = changeOverEnd
  }

  return segments
}

// One planning cycle (mixed 12h/15h/18h build + 2h changeover) per actual
// production build, chained back-to-back into a single continuous series: 1
// while the plan has the printer running, 0 during its changeover, with no
// time gaps between cycles.
export function generatePlanningRuntimeSeries(): RuntimePoint[] {
  const start = new Date(2025, 3, 1, 0, 0)
  const targetEnd = addDays(start, PRODUCTION_DATA_TOTAL_DAYS)

  const points: RuntimePoint[] = []
  let cursor = start
  let i = 0

  while (cursor < targetEnd) {
    const buildStart = cursor
    const buildEnd = addHours(buildStart, getPlannedBuildHours(i))
    const changeOverEnd = addHours(buildEnd, PLANNING_CHANGEOVER_HOURS)

    points.push({ timestamp: buildStart.toISOString(), run: 1 })
    points.push({ timestamp: addHours(buildEnd, -0.01).toISOString(), run: 1 })
    points.push({ timestamp: buildEnd.toISOString(), run: 0 })
    points.push({
      timestamp: addHours(changeOverEnd, -0.01).toISOString(),
      run: 0,
    })

    cursor = changeOverEnd
    i++
  }

  return points
}

// The start/end of each planned "running" span, for shading a background
// behind each planned build. Carries the lot/product it corresponds to so
// the runtime tooltip can show which batch is planned at a given time.
export function generatePlanningBuildSpans(
  printerId: string = "3"
): TimeSpan[] {
  const start = new Date(2025, 3, 1, 0, 0)
  const targetEnd = addDays(start, PRODUCTION_DATA_TOTAL_DAYS)
  const { lotIds, productIds } = getPrinterProfile(printerId)

  const spans: TimeSpan[] = []
  let cursor = start
  let i = 0

  while (cursor < targetEnd) {
    const buildStart = cursor
    const buildEnd = addHours(buildStart, getPlannedBuildHours(i))
    spans.push({
      start: buildStart.toISOString(),
      end: buildEnd.toISOString(),
      lotId: lotIds[i % lotIds.length],
      productId: productIds[i % productIds.length],
    })
    cursor = addHours(buildEnd, PLANNING_CHANGEOVER_HOURS)
    i++
  }

  return spans
}

export type LotTimeline = {
  lotId: string
  segments: GanttSegment[]
}

function generateChainedLotTimelines(
  lotIds: string[],
  productIds: string[],
  operators: string[],
  buildHours: number | ((index: number) => number),
  changeOverHours: number
): LotTimeline[] {
  const start = new Date(2025, 3, 1)
  let cursor = start

  return lotIds.map((lotId, index) => {
    const productId = productIds[index % productIds.length]
    const operator = operators[index % operators.length]
    const hours =
      typeof buildHours === "function" ? buildHours(index) : buildHours
    const buildStart = cursor
    const buildEnd = addHours(buildStart, hours)
    const changeOverEnd = addHours(buildEnd, changeOverHours)
    cursor = changeOverEnd

    const groupKey = String(index)

    return {
      lotId,
      segments: [
        {
          type: "Build",
          start: buildStart.toISOString(),
          end: buildEnd.toISOString(),
          lotId,
          productId,
          operator,
          groupKey,
        },
        {
          type: "ChangeOver",
          start: buildEnd.toISOString(),
          end: changeOverEnd.toISOString(),
          lotId,
          productId,
          operator,
          groupKey,
        },
      ],
    }
  })
}

// The Batch/Lot Timeline page shows every lot as its own row, so it's
// capped to the first 15 — the full (much longer) history is still what
// drives the Printer Runtime and Topup page and Asset Utilization's
// forecast continuation point.
const BATCH_LOT_TIMELINE_LOT_LIMIT = 15

export function generateLotTimelines(printerId: string = "3"): LotTimeline[] {
  const { lotIds, productIds, operators, buildHours, changeOverHours } =
    getPrinterProfile(printerId)
  return generateChainedLotTimelines(
    lotIds.slice(0, BATCH_LOT_TIMELINE_LOT_LIMIT),
    productIds,
    operators,
    (index) => buildHours[index % buildHours.length],
    changeOverHours
  )
}

export function generateLotPlanningTimelines(
  printerId: string = "3"
): LotTimeline[] {
  const { lotIds, productIds, operators } = getPrinterProfile(printerId)
  return generateChainedLotTimelines(
    lotIds.slice(0, BATCH_LOT_TIMELINE_LOT_LIMIT),
    productIds,
    operators,
    getPlannedBuildHours,
    PLANNING_CHANGEOVER_HOURS
  )
}
