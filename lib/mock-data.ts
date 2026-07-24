export const kpiSummary = {
  availableHours: 1430,
  totalBuilds: 65,
  totalPrintHours: 612.03,
  averageBuildHours: 9.42,
  averageChangeOverHours: 12.77,
  totalChangeOverHours: 817.12,
  utilization: 42.82,
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

export type TopupPoint = { date: string; topup: number }

export function generateTopupSeries(): TopupPoint[] {
  const start = new Date(2025, 3, 1)
  const totalDays = 61 // 4/1 - 5/31
  const points: TopupPoint[] = []

  for (let i = 0; i < totalDays; i++) {
    const date = addDays(start, i)
    let topup = 3
    if (i < 2) topup = 2
    if (i >= 54) topup = 0

    points.push({
      date: date.toISOString(),
      topup,
    })
  }

  return points
}

export type RuntimePoint = { timestamp: string; run: number }

export function generateRuntimeSeries(): RuntimePoint[] {
  const start = new Date(2025, 3, 1, 0, 0)
  const segments: Array<[number, number]> = [
    [27, 1],
    [3, 0],
    [30, 1],
    [3, 0],
    [30, 1],
    [3, 0],
    [12, 1],
    [21, 0],
    [12, 1],
  ]

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

export type GanttSegment = {
  type: "Build" | "ChangeOver"
  start: string
  end: string
}

const PRINTER_BUILD_HOURS = [18, 22, 16, 20, 24, 18, 26, 20, 22, 30, 26, 40, 60]

export function generatePrinterRuntimeSegments(): GanttSegment[] {
  const start = new Date(2025, 3, 1)
  const segments: GanttSegment[] = []
  let cursor = start

  PRINTER_BUILD_HOURS.forEach((hours, index) => {
    const buildStart = cursor
    const buildEnd = addHours(buildStart, hours)
    segments.push({
      type: "Build",
      start: buildStart.toISOString(),
      end: buildEnd.toISOString(),
    })

    const changeOverHours = index === PRINTER_BUILD_HOURS.length - 1 ? 0 : 8
    const changeOverEnd = addHours(buildEnd, changeOverHours)
    if (changeOverHours > 0) {
      segments.push({
        type: "ChangeOver",
        start: buildEnd.toISOString(),
        end: changeOverEnd.toISOString(),
      })
    }
    cursor = changeOverEnd
  })

  return segments
}

export function generatePrinterPlanningSegments(): GanttSegment[] {
  const start = new Date(2025, 3, 1)
  const segments: GanttSegment[] = []
  let cursor = start
  const cycles = PRINTER_BUILD_HOURS.length

  for (let i = 0; i < cycles; i++) {
    const buildStart = cursor
    const buildEnd = addHours(buildStart, 9)
    segments.push({
      type: "Build",
      start: buildStart.toISOString(),
      end: buildEnd.toISOString(),
    })

    const changeOverHours = i === cycles - 1 ? 0 : 2
    const changeOverEnd = addHours(buildEnd, changeOverHours)
    if (changeOverHours > 0) {
      segments.push({
        type: "ChangeOver",
        start: buildEnd.toISOString(),
        end: changeOverEnd.toISOString(),
      })
    }
    cursor = changeOverEnd
  }

  return segments
}

export type LotTimeline = {
  lotId: string
  segments: GanttSegment[]
}

const LOT_IDS = [
  "2246447",
  "4775614",
  "4776612",
  "4776999",
  "4777011",
  "4777006",
  "4777008",
]

function generateChainedLotTimelines(
  buildHours: number,
  changeOverHours: number
): LotTimeline[] {
  const start = new Date(2025, 3, 1)
  let cursor = start

  return LOT_IDS.map((lotId) => {
    const buildStart = cursor
    const buildEnd = addHours(buildStart, buildHours)
    const changeOverEnd = addHours(buildEnd, changeOverHours)
    cursor = changeOverEnd

    return {
      lotId,
      segments: [
        {
          type: "Build",
          start: buildStart.toISOString(),
          end: buildEnd.toISOString(),
        },
        {
          type: "ChangeOver",
          start: buildEnd.toISOString(),
          end: changeOverEnd.toISOString(),
        },
      ],
    }
  })
}

export function generateLotTimelines(): LotTimeline[] {
  return generateChainedLotTimelines(18, 8)
}

export function generateLotPlanningTimelines(): LotTimeline[] {
  return generateChainedLotTimelines(9, 2)
}
