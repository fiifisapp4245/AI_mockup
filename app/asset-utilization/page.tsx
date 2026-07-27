"use client"

import * as React from "react"

import { ChatSidebar, type ChatPrompt } from "@/components/dashboard/chat-sidebar"
import {
  DateRangeFilter,
  FilterGroup,
  PrinterFilter,
} from "@/components/dashboard/filters"
import {
  GanttAxis,
  GanttLegend,
  GanttRow,
} from "@/components/dashboard/gantt-timeline"
import {
  generateForecastPlanningSegments,
  generateOperatorForecast,
  generateOperatorLeaves,
  getPrinterOperators,
  type GanttSegment,
} from "@/lib/mock-data"

const FORECAST_BUILD_COUNT = 40
const LABEL_WIDTH = "w-36"
const LABEL_OFFSET = 156 // w-36 (144px) + gap-3 (12px)
const DEFAULT_VIEW_DAYS = 7

const CHAT_SUGGESTIONS = [
  "Who's on leave this week?",
  "Which operator has the most builds?",
  "Is anyone overbooked?",
]

const CHAT_PROMPTS: ChatPrompt[] = [
  {
    keywords: ["leave", "vacation", "off", "away"],
    answer:
      "Each operator's rose-colored \"Leave\" segment marks their scheduled time off, placed in a gap between their forecasted builds so it never conflicts with an assignment. Widen the date slicer if you don't see one in the current window.",
  },
  {
    keywords: ["overbooked", "conflict", "double", "clash"],
    answer:
      "Builds are assigned round-robin across operators with no overlapping assignments in this forecast, so nobody is double-booked — leave time is also fenced off from adjacent builds.",
  },
  {
    keywords: ["most", "busiest", "workload", "assigned"],
    answer:
      "Workload is spread evenly across the operator roster in this forecast — scan each row's Build segments (light blue) to compare how densely packed one operator's schedule is versus another's.",
  },
  {
    keywords: ["operator", "operators", "roster", "who"],
    answer:
      "The operator roster shown here is shared across this page, Printer Runtime, and the Batch/Lot Timeline — switching the Printer filter swaps in that printer's own operator pool.",
  },
  {
    keywords: ["date", "slicer", "range", "window"],
    answer:
      "Use the Date filter above to narrow or widen the visible window — it defaults to the first 7 days of the forecast to keep the timeline readable.",
  },
]

export default function AssetUtilizationPage() {
  const [printer, setPrinter] = React.useState("3")

  const forecastBuilds = React.useMemo(
    () => generateOperatorForecast(printer, FORECAST_BUILD_COUNT),
    [printer]
  )

  const planningSegments = React.useMemo(
    () => generateForecastPlanningSegments(printer, FORECAST_BUILD_COUNT),
    [printer]
  )

  const leaves = React.useMemo(
    () => generateOperatorLeaves(printer, FORECAST_BUILD_COUNT),
    [printer]
  )

  const operators = React.useMemo(() => getPrinterOperators(printer), [printer])

  const operatorRows = React.useMemo(
    () =>
      operators.map((operator) => {
        const leaveSegments: GanttSegment[] = leaves
          .filter((leave) => leave.operator === operator)
          .map((leave) => ({
            type: "Leave",
            start: leave.start,
            end: leave.end,
            operator,
          }))

        return {
          operator,
          segments: [
            ...forecastBuilds
              .filter((build) => build.operator === operator)
              .flatMap((build) => build.segments),
            ...leaveSegments,
          ],
        }
      }),
    [operators, forecastBuilds, leaves]
  )

  const fullRangeStart = React.useMemo(() => {
    const allSegments = [
      ...planningSegments,
      ...forecastBuilds.flatMap((build) => build.segments),
    ]
    return Math.min(
      ...allSegments.map((segment) => new Date(segment.start).getTime())
    )
  }, [planningSegments, forecastBuilds])

  // The date slicer — defaults to the first week of the forecast so the
  // page isn't showing all 40 builds across every operator at once.
  const [viewStart, setViewStart] = React.useState(
    () => new Date(fullRangeStart)
  )
  const [viewEnd, setViewEnd] = React.useState(
    () => new Date(fullRangeStart + DEFAULT_VIEW_DAYS * 24 * 60 * 60 * 1000)
  )

  const domainStart = viewStart.getTime()
  const domainEnd = viewEnd.getTime()

  return (
    <div className="flex gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-8">
      <FilterGroup>
        <DateRangeFilter
          label="Date"
          start={viewStart}
          end={viewEnd}
          onChangeStart={setViewStart}
          onChangeEnd={setViewEnd}
        />
        <PrinterFilter value={printer} onChange={setPrinter} />
      </FilterGroup>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Asset Utilization</h2>
          <GanttLegend showLeave />
        </div>
        <p className="text-xs text-muted-foreground">
          {`Forecasted assignment of the next ${FORECAST_BUILD_COUNT} builds across operators, continuing from where the historical schedule leaves off. Use the date slicer above to narrow the window.`}
        </p>
        <GanttAxis
          domainStart={domainStart}
          domainEnd={domainEnd}
          labelOffset={LABEL_OFFSET}
        />
        <div className="flex flex-col gap-1.5 pl-4">
          <GanttRow
            label="Planning"
            segments={planningSegments}
            domainStart={domainStart}
            domainEnd={domainEnd}
            labelWidth={LABEL_WIDTH}
            muted
          />
          {operatorRows.map((row) => (
            <GanttRow
              key={row.operator}
              label={row.operator}
              segments={row.segments}
              domainStart={domainStart}
              domainEnd={domainEnd}
              labelWidth={LABEL_WIDTH}
            />
          ))}
        </div>
      </div>
      </div>

      <ChatSidebar suggestions={CHAT_SUGGESTIONS} prompts={CHAT_PROMPTS} />
    </div>
  )
}
