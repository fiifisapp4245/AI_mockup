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
  generateRuntimeBuildBoundaries,
  generateRuntimeBuildSpans,
  generateRuntimeSeries,
  generateTopupSeries,
} from "@/lib/mock-data"

const SYNC_ID = "printer-runtime-topup"

// Keep only points inside [start, end], plus the point just before and just
// after the window so a step line still shows the right value at the edges.
// (Passing the full underlying series and relying on the axis `domain` to
// clip it visually was enough to confuse recharts' tick placement when the
// domain covered only a small slice of a much larger dataset.)
function clipToWindow<T>(
  points: T[],
  getTime: (point: T) => number,
  start: number,
  end: number
): T[] {
  const within = points.filter(
    (p) => getTime(p) >= start && getTime(p) <= end
  )
  const hasStart = within.length > 0 && getTime(within[0]) === start
  const hasEnd = within.length > 0 && getTime(within[within.length - 1]) === end

  const before = points.filter((p) => getTime(p) < start)
  const after = points.filter((p) => getTime(p) > end)
  const lastBefore = !hasStart && before.length ? [before[before.length - 1]] : []
  const firstAfter = !hasEnd && after.length ? [after[0]] : []

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

const chartConfig = {
  run: {
    label: "Production",
    color: "var(--chart-1)",
  },
  planning: {
    label: "Planning",
    color: "var(--chart-3)",
  },
  topup: {
    label: "Topup",
    color: "var(--chart-1)",
  },
  totalBuilds: {
    label: "Total Builds",
    color: "var(--chart-3)",
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

  const data = React.useMemo(() => {
    const points = generateRuntimeSeries(printer).map((point) => ({
      ...point,
      timestamp: new Date(point.timestamp).getTime(),
    }))
    const clipped = clipToWindow(points, (p) => p.timestamp, domainStart, domainEnd)
    return fillGrid(clipped, syncGridTimes, (before) => ({ run: before.run }))
  }, [printer, domainStart, domainEnd, syncGridTimes])

  const buildBoundaries = React.useMemo(
    () =>
      generateRuntimeBuildBoundaries(printer).map((timestamp) =>
        new Date(timestamp).getTime()
      ),
    [printer]
  )

  const productionBuildSpans = React.useMemo(
    () =>
      generateRuntimeBuildSpans(printer).map((span) => ({
        start: new Date(span.start).getTime(),
        end: new Date(span.end).getTime(),
      })),
    [printer]
  )

  const planningData = React.useMemo(() => {
    const points = generatePlanningRuntimeSeries(printer).map((point) => ({
      ...point,
      timestamp: new Date(point.timestamp).getTime(),
    }))
    const clipped = clipToWindow(points, (p) => p.timestamp, domainStart, domainEnd)
    return fillGrid(clipped, syncGridTimes, (before) => ({ run: before.run }))
  }, [printer, domainStart, domainEnd, syncGridTimes])

  const planningBuildSpans = React.useMemo(
    () =>
      generatePlanningBuildSpans(printer).map((span) => ({
        start: new Date(span.start).getTime(),
        end: new Date(span.end).getTime(),
      })),
    [printer]
  )

  const topupData = React.useMemo(() => {
    const points = generateTopupSeries(printer).map((point) => ({
      ...point,
      timestamp: new Date(point.date).getTime(),
    }))
    const clipped = clipToWindow(points, (p) => p.timestamp, domainStart, domainEnd)
    return fillGrid(clipped, syncGridTimes, (before) => ({
      date: before.date,
      topup: before.topup,
      totalBuilds: before.totalBuilds,
    }))
  }, [printer, domainStart, domainEnd, syncGridTimes])

  // Shared by both charts so their x-axis pixel columns line up exactly —
  // this is what lets the production build boundaries visually extend from
  // the runtime chart straight down through the topup chart.
  const sharedTicks = React.useMemo(() => {
    const oneDay = 24 * 60 * 60 * 1000
    const ticks: number[] = []
    for (let t = domainStart; t <= domainEnd; t += oneDay) {
      ticks.push(t)
    }
    return ticks
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
    <div className="flex flex-col gap-8">
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
            className="aspect-auto h-[320px] w-full"
          >
            <LineChart
              syncId={SYNC_ID}
              syncMethod="value"
              data={data}
              margin={{ left: 12, right: 12 }}
            >
              <defs>
                <linearGradient id="productionAreaA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="productionAreaB" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
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
                domain={[0, 1]}
                tickCount={3}
                tickLine={false}
                axisLine={false}
                width={30}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent labelFormatter={tooltipLabelFormatter} />
                }
              />
              {visibleSeries.production &&
                productionBuildSpans.map((span, index) => (
                  <ReferenceArea
                    key={`prod-area-${index}`}
                    x1={span.start}
                    x2={span.end}
                    y1={0}
                    y2={1}
                    fill={
                      index % 2 === 0
                        ? "url(#productionAreaA)"
                        : "url(#productionAreaB)"
                    }
                    stroke="none"
                    ifOverflow="hidden"
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
                      index % 2 === 0
                        ? "url(#planningAreaA)"
                        : "url(#planningAreaB)"
                    }
                    stroke="none"
                    ifOverflow="hidden"
                  />
                ))}
              {visibleSeries.production &&
                buildBoundaries.map((timestamp) => (
                  <ReferenceLine
                    key={timestamp}
                    x={timestamp}
                    stroke="var(--muted-foreground)"
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
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
          <h2 className="text-sm font-medium">Topup and Builds by StartTime</h2>
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[320px] w-full"
          >
            <LineChart
              syncId={SYNC_ID}
              syncMethod="value"
              data={topupData}
              margin={{ left: 12, right: 12 }}
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
                dataKey="topup"
                domain={[0, 3]}
                ticks={[0, 1, 2, 3]}
                tickLine={false}
                axisLine={false}
                width={30}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent labelFormatter={tooltipLabelFormatter} />
                }
              />
              {visibleSeries.production &&
                buildBoundaries.map((timestamp) => (
                  <ReferenceLine
                    key={timestamp}
                    x={timestamp}
                    stroke="var(--muted-foreground)"
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
                  />
                ))}
              <Line
                type="stepAfter"
                dataKey="topup"
                stroke="var(--color-topup)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                dataKey="totalBuilds"
                stroke="none"
                dot={false}
                isAnimationActive={false}
                legendType="none"
              />
            </LineChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  )
}
