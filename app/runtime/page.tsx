"use client"

import * as React from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

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
import { generateRuntimeSeries } from "@/lib/mock-data"

const chartConfig = {
  run: {
    label: "Run",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export default function RuntimePage() {
  const [printer, setPrinter] = React.useState("3.0")
  const [start, setStart] = React.useState(new Date(2025, 3, 1))
  const [end, setEnd] = React.useState(new Date(2025, 3, 4))

  const data = React.useMemo(
    () =>
      generateRuntimeSeries().map((point) => ({
        ...point,
        timestamp: new Date(point.timestamp).getTime(),
      })),
    []
  )

  const halfDayTicks = React.useMemo(() => {
    const first = data[0].timestamp
    const last = data[data.length - 1].timestamp
    const twelveHours = 12 * 60 * 60 * 1000
    const ticks: number[] = []
    for (let t = first; t <= last; t += twelveHours) {
      ticks.push(t)
    }
    return ticks
  }, [data])

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
        <h2 className="text-sm font-medium">Printer Runtime</h2>
        <ChartContainer config={chartConfig} className="aspect-auto h-[360px] w-full">
          <LineChart data={data} margin={{ left: 12, right: 12 }}>
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
            <Line
              type="stepAfter"
              dataKey="run"
              stroke="var(--color-run)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  )
}
