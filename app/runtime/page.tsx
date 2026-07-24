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
} from "@/lib/mock-data"

const chartConfig = {
  run: {
    label: "Production",
    color: "var(--chart-1)",
  },
  planning: {
    label: "Planning",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

export default function RuntimePage() {
  const [printer, setPrinter] = React.useState("3")
  const [start, setStart] = React.useState(new Date(2025, 3, 1))
  const [end, setEnd] = React.useState(new Date(2025, 3, 4))
  const [visibleSeries, setVisibleSeries] = React.useState({
    production: true,
    planning: true,
  })

  const toggleSeries = (key: keyof typeof visibleSeries) => {
    setVisibleSeries((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const data = React.useMemo(
    () =>
      generateRuntimeSeries(printer).map((point) => ({
        ...point,
        timestamp: new Date(point.timestamp).getTime(),
      })),
    [printer]
  )

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

  const planningData = React.useMemo(
    () =>
      generatePlanningRuntimeSeries(printer).map((point) => ({
        ...point,
        timestamp: new Date(point.timestamp).getTime(),
      })),
    [printer]
  )

  const planningBuildSpans = React.useMemo(
    () =>
      generatePlanningBuildSpans(printer).map((span) => ({
        start: new Date(span.start).getTime(),
        end: new Date(span.end).getTime(),
      })),
    [printer]
  )

  const halfDayTicks = React.useMemo(() => {
    const timestamps = [
      ...(visibleSeries.production ? data.map((point) => point.timestamp) : []),
      ...(visibleSeries.planning
        ? planningData.map((point) => point.timestamp)
        : []),
    ]
    const first = Math.min(...timestamps)
    const last = Math.max(...timestamps)
    const twelveHours = 12 * 60 * 60 * 1000
    const ticks: number[] = []
    for (let t = first; t <= last; t += twelveHours) {
      ticks.push(t)
    }
    return ticks
  }, [data, planningData, visibleSeries])

  return (
    <div className="flex flex-col gap-8">
      <FilterGroup>
        <DateRangeFilter
          label="TimeStamp"
          start={start}
          end={end}
          onChangeStart={setStart}
          onChangeEnd={setEnd}
        />
        <PrinterFilter value={printer} onChange={setPrinter} />
      </FilterGroup>

      <div className="flex flex-col gap-3">
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
        <ChartContainer config={chartConfig} className="aspect-auto h-[360px] w-full">
          <LineChart data={data} margin={{ left: 12, right: 12 }}>
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
              domain={["dataMin", "dataMax"]}
              tickFormatter={(value) =>
                new Date(value).toLocaleString("en-US", {
                  month: "short",
                  day: "2-digit",
                  hour: "numeric",
                })
              }
              tickLine={false}
              axisLine={false}
              ticks={halfDayTicks}
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
                <ChartTooltipContent
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                />
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
    </div>
  )
}
