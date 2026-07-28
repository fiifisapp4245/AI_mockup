"use client"

import * as React from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import { ChatSidebar, type ChatPrompt } from "@/components/dashboard/chat-sidebar"
import {
  DateRangeFilter,
  FilterGroup,
  PrinterFilter,
} from "@/components/dashboard/filters"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  generatePlanningBuildSpans,
  generatePlanningRuntimeSeries,
  generatePowderMassSeries,
  generateRuntimeBuildSpans,
  generateRuntimeSeries,
  POWDER_TOPUP_THRESHOLD_KG,
} from "@/lib/mock-data"

const SYNC_ID = "printer-runtime-topup"

// Hovering a Production or Planning build band highlights both it and its
// linked counterpart (same build index) in this color — deliberately not
// red or green, since those are already used elsewhere for behind-schedule
// vs. ahead-of-plan.
const LINKED_BUILD_HIGHLIGHT = "#a855f7"

const CHAT_SUGGESTIONS = [
  "How is production tracking against planning?",
  "When was the last topup?",
  "Which builds ran longest?",
]

const CHAT_PROMPTS: ChatPrompt[] = [
  {
    keywords: ["topup", "top-up", "top up", "powder", "mass", "kg"],
    answer:
      "The powder hopper starts full at 70kg and drains build-by-build — each vertical jump back up to 70kg is a topup, which happens roughly every 25-30 builds.",
  },
  {
    keywords: ["compare", "comparison", "vs", "versus", "planning", "plan"],
    answer:
      "Production sits one lane above Planning on the Printer Runtime chart (both drop to the baseline during changeover) so the two step lines don't overlap — toggle either series off with the legend buttons to isolate one, or click a shaded build band to highlight it alongside its linked Production/Planning counterpart.",
  },
  {
    keywords: ["longest", "build", "duration", "run"],
    answer:
      "Wider shaded bands on the Printer Runtime chart indicate longer-running builds — hover one to see its exact lot, start, end, and duration, or check the Batch/Lot Timeline page for the full per-lot breakdown.",
  },
  {
    keywords: ["printer"],
    answer:
      "Use the Printer filter above to switch which printer's runtime and topup data is shown — each printer has its own production history and planning schedule.",
  },
]

// Keep only points inside [start, end], plus the point just before and just
// after the window so a step line still shows the right value at the edges.
// (Passing the full underlying series and relying on the axis `domain` to
// clip it visually was enough to confuse recharts' tick placement when the
// domain covered only a small slice of a much larger dataset.)
// Padding points are clamped to sit exactly at the domain boundary rather
// than keeping their real (possibly much later/earlier) timestamp — a
// single point far outside the visible window is enough to throw off
// recharts' tick placement across the whole axis, even with an explicit
// `domain` set, so we only ever carry its value across the boundary, never
// its actual time.
function clipToWindow<T extends { timestamp: number }>(
  points: T[],
  start: number,
  end: number
): T[] {
  const within = points.filter((p) => p.timestamp >= start && p.timestamp <= end)
  const hasStart = within.length > 0 && within[0].timestamp === start
  const hasEnd = within.length > 0 && within[within.length - 1].timestamp === end

  const before = points.filter((p) => p.timestamp < start)
  const after = points.filter((p) => p.timestamp > end)
  const lastBefore =
    !hasStart && before.length ? [{ ...before[before.length - 1], timestamp: start }] : []
  const firstAfter = !hasEnd && after.length ? [{ ...after[0], timestamp: end }] : []

  return [...lastBefore, ...within, ...firstAfter]
}

// Recharts' cross-chart tooltip sync (syncMethod="value") only activates
// when the hovered chart's active timestamp exists as an EXACT data point
// in the other chart too — it's not a nearest-match. Production/planning
// and topup data have completely different point densities, so they'd
// almost never land on the same timestamp. Filling in a shared hourly grid
// (holding each step function's current value) gives both series a common
// set of exact-matching points, so hovering anywhere syncs both charts.
function fillGrid<T extends { timestamp: number }>(
  points: T[],
  gridTimes: number[],
  valueFieldsAt: (before: T) => Omit<T, "timestamp">
): T[] {
  if (points.length === 0) return points
  const existing = new Set(points.map((p) => p.timestamp))
  const additions: T[] = []

  for (const t of gridTimes) {
    if (existing.has(t)) continue
    let before = points[0]
    for (const p of points) {
      if (p.timestamp <= t) before = p
      else break
    }
    additions.push({ timestamp: t, ...valueFieldsAt(before) } as T)
  }

  return [...points, ...additions].sort((a, b) => a.timestamp - b.timestamp)
}

// Same purpose as fillGrid (exact-matching timestamps for cross-chart
// tooltip sync), but for a smooth diagonal series instead of a step
// function — an inserted grid point is linearly interpolated between its
// surrounding real points instead of holding the earlier one flat, so it
// lands exactly on the existing line instead of introducing a fake stair
// step.
function fillGridLinear<T extends { timestamp: number; massKg: number; belowThreshold: boolean }>(
  points: T[],
  gridTimes: number[]
): T[] {
  if (points.length === 0) return points
  const existing = new Set(points.map((p) => p.timestamp))
  const additions: T[] = []

  for (const t of gridTimes) {
    if (existing.has(t)) continue
    if (t < points[0].timestamp || t > points[points.length - 1].timestamp) continue

    let before = points[0]
    let after = points[points.length - 1]
    for (const p of points) {
      if (p.timestamp <= t) before = p
      if (p.timestamp >= t) {
        after = p
        break
      }
    }

    const massKg =
      after.timestamp === before.timestamp
        ? before.massKg
        : before.massKg +
          ((t - before.timestamp) / (after.timestamp - before.timestamp)) *
            (after.massKg - before.massKg)

    additions.push({
      ...before,
      timestamp: t,
      massKg,
      belowThreshold: massKg < POWDER_TOPUP_THRESHOLD_KG,
    })
  }

  return [...points, ...additions].sort((a, b) => a.timestamp - b.timestamp)
}

type RuntimeBatchSpan = {
  start: number
  end: number
  lotId: string
  productId: string
}

function findSpanAt(
  spans: RuntimeBatchSpan[],
  timestamp: number
): RuntimeBatchSpan | undefined {
  return spans.find((span) => timestamp >= span.start && timestamp < span.end)
}

function BatchTooltipBlock({
  title,
  color,
  span,
}: {
  title: string
  color: string
  span?: RuntimeBatchSpan
}) {
  return (
    <div className="grid gap-1 border-t border-border/50 pt-1.5 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-1.5 font-medium text-foreground">
        <span
          className="size-2 shrink-0 rounded-[2px]"
          style={{ backgroundColor: color }}
        />
        {title}
      </div>
      {span ? (
        <>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Lot</span>
            <span className="font-mono text-foreground">{span.lotId}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Product</span>
            <span className="font-mono text-foreground">{span.productId}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Start</span>
            <span className="font-mono text-foreground tabular-nums">
              {new Date(span.start).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">End</span>
            <span className="font-mono text-foreground tabular-nums">
              {new Date(span.end).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-mono text-foreground tabular-nums">
              {((span.end - span.start) / (1000 * 60 * 60)).toFixed(1)}h
            </span>
          </div>
        </>
      ) : (
        <span className="text-muted-foreground">No active batch</span>
      )}
    </div>
  )
}

// Custom tooltip for the Printer Runtime chart — instead of just the raw
// 0/1 run value, looks up which batch (lot/product/start/end/duration) is
// active at the hovered timestamp for each visible series.
function RuntimeBatchTooltip({
  active,
  label,
  productionSpans,
  planningSpans,
  showProduction,
  showPlanning,
}: {
  active?: boolean
  label?: number
  productionSpans: RuntimeBatchSpan[]
  planningSpans: RuntimeBatchSpan[]
  showProduction: boolean
  showPlanning: boolean
}) {
  if (!active || label === undefined || (!showProduction && !showPlanning)) {
    return null
  }

  return (
    <div className="grid min-w-56 gap-2 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium text-foreground">
        {new Date(label).toLocaleString()}
      </div>
      {showProduction && (
        <BatchTooltipBlock
          title="Production"
          color="var(--chart-1)"
          span={findSpanAt(productionSpans, label)}
        />
      )}
      {showPlanning && (
        <BatchTooltipBlock
          title="Planning"
          color="var(--chart-3)"
          span={findSpanAt(planningSpans, label)}
        />
      )}
    </div>
  )
}

const chartConfig = {
  run: {
    label: "Production",
    color: "var(--chart-1)",
  },
  planning: {
    label: "Planning",
    color: "var(--chart-3)",
  },
  massKg: {
    label: "Mass of Powder (kg)",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export default function RuntimePage() {
  const [printer, setPrinter] = React.useState("3")
  const [start, setStart] = React.useState(new Date(2025, 3, 1))
  const [end, setEnd] = React.useState(new Date(2025, 3, 11))
  const [visibleSeries, setVisibleSeries] = React.useState({
    production: true,
    planning: true,
  })

  const toggleSeries = (key: keyof typeof visibleSeries) => {
    setVisibleSeries((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const domainStart = start.getTime()
  const domainEnd = end.getTime()

  // Common hourly grid used to give both charts' datasets exact-matching
  // timestamps, so recharts' cross-chart tooltip sync can find them.
  const syncGridTimes = React.useMemo(() => {
    const oneHour = 60 * 60 * 1000
    const times: number[] = []
    for (let t = domainStart; t <= domainEnd; t += oneHour) {
      times.push(t)
    }
    return times
  }, [domainStart, domainEnd])

  // Production is drawn one lane above Planning (2 vs. 1, both falling to 0
  // during changeover) so the two step lines don't sit directly on top of
  // each other.
  const data = React.useMemo(() => {
    const points = generateRuntimeSeries(printer).map((point) => ({
      ...point,
      timestamp: new Date(point.timestamp).getTime(),
      run: point.run * 2,
    }))
    const clipped = clipToWindow(points, domainStart, domainEnd)
    return fillGrid(clipped, syncGridTimes, (before) => ({ run: before.run }))
  }, [printer, domainStart, domainEnd, syncGridTimes])

  // Which build index (shared between the production and planning span
  // arrays) is currently selected — clicking either side of the link
  // highlights both; clicking the same one again clears the selection.
  const [selectedBuildIndex, setSelectedBuildIndex] = React.useState<
    number | null
  >(null)

  const toggleSelectedBuildIndex = (index: number) => {
    setSelectedBuildIndex((prev) => (prev === index ? null : index))
  }

  const productionBuildSpans = React.useMemo(
    () =>
      generateRuntimeBuildSpans(printer).map((span) => ({
        start: new Date(span.start).getTime(),
        end: new Date(span.end).getTime(),
        lotId: span.lotId,
        productId: span.productId,
      })),
    [printer]
  )

  const planningData = React.useMemo(() => {
    const points = generatePlanningRuntimeSeries().map((point) => ({
      ...point,
      timestamp: new Date(point.timestamp).getTime(),
    }))
    const clipped = clipToWindow(points, domainStart, domainEnd)
    return fillGrid(clipped, syncGridTimes, (before) => ({ run: before.run }))
  }, [domainStart, domainEnd, syncGridTimes])

  const planningBuildSpans = React.useMemo(
    () =>
      generatePlanningBuildSpans(printer).map((span) => ({
        start: new Date(span.start).getTime(),
        end: new Date(span.end).getTime(),
        lotId: span.lotId,
        productId: span.productId,
      })),
    [printer]
  )

  const powderMassData = React.useMemo(() => {
    const points = generatePowderMassSeries(printer).map((point) => ({
      ...point,
      timestamp: new Date(point.date).getTime(),
    }))
    const clipped = clipToWindow(points, domainStart, domainEnd)
    const filled = fillGridLinear(clipped, syncGridTimes)
    // A second, overlaid line drawn only across below-threshold stretches —
    // null everywhere else so it breaks instead of connecting across a
    // whole on-time run — to recolor just those segments red.
    return filled.map((point) => ({
      ...point,
      alertMassKg: point.belowThreshold ? point.massKg : null,
    }))
  }, [printer, domainStart, domainEnd, syncGridTimes])

  // Shared by both charts so their x-axis pixel columns line up exactly —
  // this is what lets the production build boundaries visually extend from
  // the runtime chart straight down through the topup chart. Capped at a
  // max tick count (evenly spaced) so wider date ranges don't cram in one
  // label per day and overlap each other.
  const sharedTicks = React.useMemo(() => {
    const oneDay = 24 * 60 * 60 * 1000
    const days = Math.round((domainEnd - domainStart) / oneDay)
    const tickCount = Math.max(1, Math.min(days, 10))
    return Array.from({ length: tickCount + 1 }, (_, i) => {
      return domainStart + (i / tickCount) * (domainEnd - domainStart)
    })
  }, [domainStart, domainEnd])

  const tickFormatter = (value: number) =>
    new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "numeric",
    })

  const tooltipLabelFormatter = (value: React.ReactNode) =>
    new Date(value as number).toLocaleString()

  return (
    <div className="flex gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-8">
      <FilterGroup>
        <DateRangeFilter
          label="Date"
          start={start}
          end={end}
          onChangeStart={setStart}
          onChangeEnd={setEnd}
        />
        <PrinterFilter value={printer} onChange={setPrinter} />
      </FilterGroup>

      <div className="flex flex-col rounded-lg border">
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Printer Runtime</h2>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Type</span>
              <button
                type="button"
                onClick={() => toggleSeries("production")}
                className={`flex items-center gap-1.5 transition-opacity ${
                  visibleSeries.production ? "" : "opacity-40"
                }`}
              >
                <span
                  className="size-2.5 rounded-[2px]"
                  style={{ backgroundColor: "var(--chart-1)" }}
                />
                Production
              </button>
              <button
                type="button"
                onClick={() => toggleSeries("planning")}
                className={`flex items-center gap-1.5 transition-opacity ${
                  visibleSeries.planning ? "" : "opacity-40"
                }`}
              >
                <span
                  className="size-2.5 rounded-[2px]"
                  style={{ backgroundColor: "var(--chart-3)" }}
                />
                Planning
              </button>
            </div>
          </div>
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[320px] w-full [&_.recharts-cartesian-axis-tick_text]:fill-foreground [&_.recharts-cartesian-axis-tick_text]:font-semibold"
          >
            <LineChart
              syncId={SYNC_ID}
              syncMethod="value"
              data={data}
              margin={{ left: 12, right: 12 }}
            >
              <defs>
                <linearGradient id="productionArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="planningAreaA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="planningAreaB" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={[domainStart, domainEnd]}
                tickFormatter={tickFormatter}
                tickLine={false}
                axisLine={false}
                ticks={sharedTicks}
                interval={0}
              />
              <YAxis
                dataKey="run"
                domain={[0, 2]}
                ticks={[0, 1, 2]}
                tickLine={false}
                axisLine={false}
                width={30}
              />
              <ChartTooltip
                content={
                  <RuntimeBatchTooltip
                    productionSpans={productionBuildSpans}
                    planningSpans={planningBuildSpans}
                    showProduction={visibleSeries.production}
                    showPlanning={visibleSeries.planning}
                  />
                }
              />
              {visibleSeries.production &&
                productionBuildSpans.map((span, index) => (
                  <ReferenceArea
                    key={`prod-area-${index}`}
                    x1={span.start}
                    x2={span.end}
                    y1={1}
                    y2={2}
                    fill={
                      selectedBuildIndex === index
                        ? LINKED_BUILD_HIGHLIGHT
                        : "url(#productionArea)"
                    }
                    fillOpacity={selectedBuildIndex === index ? 0.55 : undefined}
                    stroke={selectedBuildIndex === index ? LINKED_BUILD_HIGHLIGHT : "none"}
                    strokeWidth={selectedBuildIndex === index ? 1.5 : undefined}
                    ifOverflow="hidden"
                    style={{ cursor: "pointer" }}
                    onClick={() => toggleSelectedBuildIndex(index)}
                  />
                ))}
              {visibleSeries.planning &&
                planningBuildSpans.map((span, index) => (
                  <ReferenceArea
                    key={`plan-area-${index}`}
                    x1={span.start}
                    x2={span.end}
                    y1={0}
                    y2={1}
                    fill={
                      selectedBuildIndex === index
                        ? LINKED_BUILD_HIGHLIGHT
                        : index % 2 === 0
                          ? "url(#planningAreaA)"
                          : "url(#planningAreaB)"
                    }
                    fillOpacity={selectedBuildIndex === index ? 0.55 : undefined}
                    stroke={selectedBuildIndex === index ? LINKED_BUILD_HIGHLIGHT : "none"}
                    strokeWidth={selectedBuildIndex === index ? 1.5 : undefined}
                    ifOverflow="hidden"
                    style={{ cursor: "pointer" }}
                    onClick={() => toggleSelectedBuildIndex(index)}
                  />
                ))}
              {visibleSeries.planning && (
                <Line
                  data={planningData}
                  name="planning"
                  type="stepAfter"
                  dataKey="run"
                  stroke="var(--color-planning)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
              {visibleSeries.production && (
                <Line
                  name="run"
                  type="stepAfter"
                  dataKey="run"
                  stroke="var(--color-run)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ChartContainer>
        </div>

        <div className="flex flex-col gap-3 border-t p-4">
          <h2 className="text-sm font-medium">Powder Topup by Start Time</h2>
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[320px] w-full [&_.recharts-cartesian-axis-tick_text]:fill-foreground [&_.recharts-cartesian-axis-tick_text]:font-semibold"
          >
            <LineChart
              syncId={SYNC_ID}
              syncMethod="value"
              data={powderMassData}
              margin={{ left: 20, right: 12 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={[domainStart, domainEnd]}
                tickFormatter={tickFormatter}
                tickLine={false}
                axisLine={false}
                ticks={sharedTicks}
                interval={0}
              />
              <YAxis
                dataKey="massKg"
                domain={[0, 70]}
                ticks={[0, 35, 70]}
                tickLine={false}
                axisLine={false}
                width={40}
                label={{
                  value: "Mass of powder (kg)",
                  angle: -90,
                  position: "insideLeft",
                  style: { textAnchor: "middle", fill: "var(--muted-foreground)" },
                }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent labelFormatter={tooltipLabelFormatter} />
                }
              />
              <ReferenceLine
                y={POWDER_TOPUP_THRESHOLD_KG}
                stroke="var(--destructive)"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{
                  value: "Topup threshold",
                  position: "insideBottomLeft",
                  fill: "var(--destructive)",
                  fontSize: 11,
                }}
              />
              <Line
                type="linear"
                dataKey="massKg"
                stroke="var(--color-massKg)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="linear"
                dataKey="alertMassKg"
                stroke="var(--destructive)"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
                legendType="none"
              />
            </LineChart>
          </ChartContainer>
        </div>
      </div>
      </div>

      <ChatSidebar suggestions={CHAT_SUGGESTIONS} prompts={CHAT_PROMPTS} />
    </div>
  )
}
