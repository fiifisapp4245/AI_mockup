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

export type TopupPoint = { date: string; topup: number; totalBuilds: number }

// One cycle: hold at 0 for a stretch, then step up through 1, 2, 3 (each
// held for a stretch), then drop back to 0 and repeat. Longer per-level
// durations mean fewer complete cycles fit in the same date range.
const TOPUP_CYCLE_PROFILES: Record<string, Array<{ level: number; days: number }>> = {
  "1": [
    { level: 0, days: 4 },
    { level: 1, days: 5 },
    { level: 2, days: 6 },
    { level: 3, days: 5 },
  ],
  "2": [
    { level: 0, days: 3 },
    { level: 1, days: 4 },
    { level: 2, days: 5 },
    { level: 3, days: 4 },
  ],
  "3": [
    { level: 0, days: 2 },
    { level: 1, days: 3 },
    { level: 2, days: 4 },
    { level: 3, days: 3 },
  ],
}

const TOPUP_TOTAL_DAYS = 61 // 4/1 - 5/31

type TopupStep = {
  level: number
  startDay: number
  days: number
}

function getTopupSteps(printerId: string): TopupStep[] {
  const cycle = TOPUP_CYCLE_PROFILES[printerId] ?? TOPUP_CYCLE_PROFILES["3"]
  const steps: TopupStep[] = []
  let day = 0
  let cycleIndex = 0

  while (day < TOPUP_TOTAL_DAYS) {
    const { level, days } = cycle[cycleIndex % cycle.length]
    const stepDays = Math.min(days, TOPUP_TOTAL_DAYS - day)

    steps.push({ level, startDay: day, days: stepDays })

    day += stepDays
    cycleIndex++
  }

  return steps
}

// Total builds completed within each topup step, before the build moves on
// to the next topup level. Kept in the 25-30 range.
const STEP_BUILD_COUNTS = [25, 29, 27, 30, 26, 28]

export function generateTopupSeries(printerId: string = "3"): TopupPoint[] {
  const start = new Date(2025, 3, 1)
  const points: TopupPoint[] = []

  getTopupSteps(printerId).forEach(({ level, startDay, days }, stepIndex) => {
    const totalBuilds = STEP_BUILD_COUNTS[stepIndex % STEP_BUILD_COUNTS.length]

    for (let i = 0; i < days; i++) {
      points.push({
        date: addDays(start, startDay + i).toISOString(),
        topup: level,
        totalBuilds,
      })
    }
  })

  return points
}

export type RuntimePoint = { timestamp: string; run: number }

export const PRINTER_IDS = ["1", "2", "3"]

const RUNTIME_PROFILES: Record<string, Array<[number, number]>> = {
  "1": [
    [20, 1],
    [4, 0],
    [24, 1],
    [3, 0],
    [18, 1],
    [6, 0],
    [22, 1],
    [5, 0],
    [26, 1],
    [4, 0],
    [16, 1],
    [7, 0],
    [28, 1],
    [3, 0],
    [19, 1],
    [5, 0],
    [30, 1],
  ],
  "2": [
    [24, 1],
    [3, 0],
    [27, 1],
    [4, 0],
    [15, 1],
    [9, 0],
    [21, 1],
    [6, 0],
    [25, 1],
    [4, 0],
    [17, 1],
    [8, 0],
    [23, 1],
    [5, 0],
    [20, 1],
    [6, 0],
    [23, 1],
  ],
  "3": [
    [27, 1],
    [3, 0],
    [30, 1],
    [3, 0],
    [30, 1],
    [3, 0],
    [12, 1],
    [21, 0],
    [12, 1],
    [4, 0],
    [20, 1],
    [6, 0],
    [24, 1],
    [5, 0],
    [40, 1],
  ],
}

export function generateRuntimeSeries(printerId: string = "3"): RuntimePoint[] {
  const start = new Date(2025, 3, 1, 0, 0)
  const segments = RUNTIME_PROFILES[printerId] ?? RUNTIME_PROFILES["3"]

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

// The midpoint of each idle gap between two builds, marking the boundary
// between one production build and the next.
export function generateRuntimeBuildBoundaries(
  printerId: string = "3"
): string[] {
  const start = new Date(2025, 3, 1, 0, 0)
  const segments = RUNTIME_PROFILES[printerId] ?? RUNTIME_PROFILES["3"]

  const boundaries: string[] = []
  let cursor = start

  for (const [hours, run] of segments) {
    if (run === 0) {
      boundaries.push(addHours(cursor, hours / 2).toISOString())
    }
    cursor = addHours(cursor, hours)
  }

  return boundaries
}

export type TimeSpan = { start: string; end: string }

// The start/end of each "running" (value 1) span, for shading a background
// behind each build on the chart.
export function generateRuntimeBuildSpans(printerId: string = "3"): TimeSpan[] {
  const start = new Date(2025, 3, 1, 0, 0)
  const segments = RUNTIME_PROFILES[printerId] ?? RUNTIME_PROFILES["3"]

  const spans: TimeSpan[] = []
  let cursor = start

  for (const [hours, run] of segments) {
    const segmentStart = cursor
    cursor = addHours(cursor, hours)
    if (run === 1) {
      spans.push({
        start: segmentStart.toISOString(),
        end: cursor.toISOString(),
      })
    }
  }

  return spans
}

export type GanttSegment = {
  type: "Build" | "ChangeOver" | "Overrun" | "Ahead" | "Leave"
  start: string
  end: string
  lotId?: string
  productId?: string
  operator?: string
}

type PrinterProfile = {
  buildHours: number[]
  changeOverHours: number
  lotIds: string[]
  productIds: string[]
  operators: string[]
}

const PRINTER_PROFILES: Record<string, PrinterProfile> = {
  "1": {
    buildHours: [14, 18, 16, 20, 22, 16, 24, 18, 20, 26],
    changeOverHours: 6,
    lotIds: [
      "5501120",
      "5501144",
      "5501167",
      "5501190",
      "5501212",
      "5501235",
      "5501258",
    ],
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
    operators: [
      "Aoife Byrne",
      "Cian Murphy",
      "Niamh Kelly",
      "Sean Gallagher",
      "Roisin Doyle",
      "Padraig Walsh",
      "Orla Fitzgerald",
      "Declan Ryan",
      "Sinead Brennan",
      "Eoin Nolan",
    ],
  },
  "2": {
    buildHours: [20, 24, 22, 26, 20, 28, 24, 22, 30, 26, 24],
    changeOverHours: 7,
    lotIds: [
      "6602201",
      "6602223",
      "6602245",
      "6602267",
      "6602289",
      "6602301",
      "6602323",
    ],
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
    operators: [
      "Sean O'Brien",
      "Roisin Walsh",
      "Conor Doyle",
      "Aisling Byrne",
      "Fionn Murphy",
      "Caoimhe Kelly",
      "Ronan Gallagher",
      "Maeve Brennan",
      "Cormac Nolan",
      "Grainne Ryan",
    ],
  },
  "3": {
    buildHours: [18, 22, 16, 20, 24, 18, 26, 20, 22, 30, 26, 40, 60],
    changeOverHours: 8,
    lotIds: [
      "2246447",
      "4775614",
      "4776612",
      "4776999",
      "4777011",
      "4777006",
      "4777008",
    ],
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
    operators: [
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
    ],
  },
}

function getPrinterProfile(printerId: string): PrinterProfile {
  return PRINTER_PROFILES[printerId] ?? PRINTER_PROFILES["3"]
}

export function getPrinterOperators(printerId: string = "3"): string[] {
  return getPrinterProfile(printerId).operators
}

// Planned build duration isn't one fixed number — it varies by lot, since
// actual production also ranges widely. Cycles through 12h/15h/18h plans.
const PLANNING_BUILD_HOURS_OPTIONS = [12, 15, 18]
const PLANNING_CHANGEOVER_HOURS = 2

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
    // Actual builds run a little faster than the nominal plan: trim 1-2h.
    const actualHours = Math.max(hours - (1 + (index % 2)), 1)
    const co = index === buildHours.length - 1 ? 0 : changeOverHours

    pairs.push({
      start: new Date(cursor),
      actualHours,
      changeOverHours: co,
      lotId: lotIds[index % lotIds.length],
      productId: productIds[index % productIds.length],
      operator: operators[index % operators.length],
    })

    cursor = addHours(cursor, actualHours + co)
  })

  return pairs
}

export type PrinterLotChain = {
  productionSegments: GanttSegment[]
  planningSegments: GanttSegment[]
  domainStart: number
  domainEnd: number
}

// One continuous horizontal line per row: lot 1's Production and Planning
// builds start together at the same point, lot 2's start right after where
// lot 1 ended, and so on — so both rows read left to right as build 1,
// build 2, build 3... with every lot's start aligned between the two rows.
//
// Each lot is compared in two independent stages, since conflating them was
// hiding good outcomes: the BUILD portions are compared against each other
// (production's actual build vs. the planned build) to decide Ahead/green
// vs. Overrun/amber for that stage, then — separately — the CHANGEOVER
// portions are compared the same way. A production build that beat its
// plan now shows green even when its (much longer) changeover afterward
// still runs over the planned 2h changeover.
export function generatePrinterLotChain(printerId: string = "3"): PrinterLotChain {
  const anchor = new Date(2025, 3, 1)
  const productionSegments: GanttSegment[] = []
  const planningSegments: GanttSegment[] = []
  let cursor = anchor

  getPrinterBuildPairs(printerId).forEach(
    ({ actualHours, changeOverHours, lotId, productId, operator }, index) => {
      const plannedBuildHours = getPlannedBuildHours(index)
      const lotStart = new Date(cursor)
      const common = { lotId, productId, operator }

      // Stage 1: build vs. planned build.
      const maxBuildHours = Math.max(actualHours, plannedBuildHours)
      const buildEnd = addHours(lotStart, actualHours)
      productionSegments.push({
        type: "Build",
        start: lotStart.toISOString(),
        end: buildEnd.toISOString(),
        ...common,
      })
      const prodBuildPhaseEnd = addHours(lotStart, maxBuildHours)
      if (actualHours < maxBuildHours) {
        productionSegments.push({
          type: "Ahead",
          start: buildEnd.toISOString(),
          end: prodBuildPhaseEnd.toISOString(),
          ...common,
        })
      }

      const planBuildEnd = addHours(lotStart, plannedBuildHours)
      planningSegments.push({
        type: "Build",
        start: lotStart.toISOString(),
        end: planBuildEnd.toISOString(),
        ...common,
      })
      const planBuildPhaseEnd = addHours(lotStart, maxBuildHours)
      if (plannedBuildHours < maxBuildHours) {
        planningSegments.push({
          type: "Overrun",
          start: planBuildEnd.toISOString(),
          end: planBuildPhaseEnd.toISOString(),
          ...common,
        })
      }

      // Stage 2: changeover vs. planned changeover — both start from the
      // now-synced end of stage 1.
      const maxChangeOverHours = Math.max(
        changeOverHours,
        PLANNING_CHANGEOVER_HOURS
      )

      let prodCycleEnd = prodBuildPhaseEnd
      if (changeOverHours > 0) {
        const prodChangeOverEnd = addHours(prodBuildPhaseEnd, changeOverHours)
        productionSegments.push({
          type: "ChangeOver",
          start: prodBuildPhaseEnd.toISOString(),
          end: prodChangeOverEnd.toISOString(),
          ...common,
        })
        prodCycleEnd = prodChangeOverEnd
        if (changeOverHours < maxChangeOverHours) {
          const fillEnd = addHours(prodBuildPhaseEnd, maxChangeOverHours)
          productionSegments.push({
            type: "Ahead",
            start: prodChangeOverEnd.toISOString(),
            end: fillEnd.toISOString(),
            ...common,
          })
          prodCycleEnd = fillEnd
        }
      }

      const planChangeOverEnd = addHours(
        planBuildPhaseEnd,
        PLANNING_CHANGEOVER_HOURS
      )
      planningSegments.push({
        type: "ChangeOver",
        start: planBuildPhaseEnd.toISOString(),
        end: planChangeOverEnd.toISOString(),
        ...common,
      })
      let planCycleEnd = planChangeOverEnd
      if (PLANNING_CHANGEOVER_HOURS < maxChangeOverHours) {
        const fillEnd = addHours(planBuildPhaseEnd, maxChangeOverHours)
        planningSegments.push({
          type: "Overrun",
          start: planChangeOverEnd.toISOString(),
          end: fillEnd.toISOString(),
          ...common,
        })
        planCycleEnd = fillEnd
      }

      cursor = new Date(Math.max(prodCycleEnd.getTime(), planCycleEnd.getTime()))
    }
  )

  return {
    productionSegments,
    planningSegments,
    domainStart: anchor.getTime(),
    domainEnd: cursor.getTime(),
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

// One planning cycle (9h build + 2h changeover) per actual production
// build, chained back-to-back into a single continuous series: 1 while the
// plan has the printer running, 0 during its changeover, with no time gaps
// between cycles.
export function generatePlanningRuntimeSeries(
  printerId: string = "3"
): RuntimePoint[] {
  const start = new Date(2025, 3, 1, 0, 0)
  const segments = RUNTIME_PROFILES[printerId] ?? RUNTIME_PROFILES["3"]
  const buildCount = segments.filter(([, run]) => run === 1).length

  const points: RuntimePoint[] = []
  let cursor = start

  for (let i = 0; i < buildCount; i++) {
    const buildStart = cursor
    const buildEnd = addHours(buildStart, 9)
    const changeOverEnd = addHours(buildEnd, 2)

    points.push({ timestamp: buildStart.toISOString(), run: 1 })
    points.push({ timestamp: addHours(buildEnd, -0.01).toISOString(), run: 1 })
    points.push({ timestamp: buildEnd.toISOString(), run: 0 })
    points.push({
      timestamp: addHours(changeOverEnd, -0.01).toISOString(),
      run: 0,
    })

    cursor = changeOverEnd
  }

  return points
}

// The start/end of each 9h "running" span in the planning schedule, for
// shading a background behind each planned build.
export function generatePlanningBuildSpans(
  printerId: string = "3"
): TimeSpan[] {
  const start = new Date(2025, 3, 1, 0, 0)
  const segments = RUNTIME_PROFILES[printerId] ?? RUNTIME_PROFILES["3"]
  const buildCount = segments.filter(([, run]) => run === 1).length

  const spans: TimeSpan[] = []
  let cursor = start

  for (let i = 0; i < buildCount; i++) {
    const buildStart = cursor
    const buildEnd = addHours(buildStart, 9)
    spans.push({ start: buildStart.toISOString(), end: buildEnd.toISOString() })
    cursor = addHours(buildEnd, 2)
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
        },
        {
          type: "ChangeOver",
          start: buildEnd.toISOString(),
          end: changeOverEnd.toISOString(),
          lotId,
          productId,
          operator,
        },
      ],
    }
  })
}

export function generateLotTimelines(printerId: string = "3"): LotTimeline[] {
  const { lotIds, productIds, operators } = getPrinterProfile(printerId)
  return generateChainedLotTimelines(lotIds, productIds, operators, 18, 8)
}

export function generateLotPlanningTimelines(
  printerId: string = "3"
): LotTimeline[] {
  const { lotIds, productIds, operators } = getPrinterProfile(printerId)
  return generateChainedLotTimelines(
    lotIds,
    productIds,
    operators,
    getPlannedBuildHours,
    PLANNING_CHANGEOVER_HOURS
  )
}
