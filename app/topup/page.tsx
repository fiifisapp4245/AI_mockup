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
import { generateTopupSeries } from "@/lib/mock-data"

const chartConfig = {
  topup: {
    label: "Topup",
    color: "var(--chart-1)",
  },
  totalBuilds: {
    label: "Total Builds",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

export default function TopupPage() {
  const [printer, setPrinter] = React.useState("3")
  const [start, setStart] = React.useState(new Date(2025, 3, 1))
  const [end, setEnd] = React.useState(new Date(2025, 4, 31))

  const data = React.useMemo(
    () =>
      generateTopupSeries(printer).map((point) => ({
        ...point,
        date: new Date(point.date).getTime(),
      })),
    [printer]
  )

  const monthTicks = React.useMemo(() => {
    const months = new Set<number>()
    data.forEach(({ date }) => {
      const d = new Date(date)
      months.add(new Date(d.getFullYear(), d.getMonth(), 1).getTime())
    })
    return Array.from(months).sort((a, b) => a - b)
  }, [data])

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

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Topup and Builds by StartTime</h2>
        <ChartContainer config={chartConfig} className="aspect-auto h-[360px] w-full">
          <LineChart data={data} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })
              }
              tickLine={false}
              axisLine={false}
              ticks={monthTicks}
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
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString()
                  }
                />
              }
            />
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
  )
}
