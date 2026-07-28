"use client"

import * as React from "react"

import { ChatSidebar, type ChatPrompt } from "@/components/dashboard/chat-sidebar"
import {
  DateRangeFilter,
  FilterGroup,
  OperatorFilter,
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
  generateOptimizedOperatorForecast,
  generatePrinterMaintenanceSchedule,
  getPrinterOperators,
  PRINTER_IDS,
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
  "When is the next maintenance window?",
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
      "Use the Operator filter above to isolate a single operator's row, or leave it on \"All\" to see the full roster. Switching the Printer filter to \"All\" condenses every printer's schedule for that operator onto a single row instead of splitting it by printer.",
  },
  {
    keywords: ["date", "slicer", "range", "window"],
    answer:
      "Use the Date filter above to narrow or widen the visible window — it defaults to the first 7 days of the forecast to keep the timeline readable.",
  },
  {
    keywords: ["maintenance", "downtime", "offline"],
    answer:
      "Each printer's recurring maintenance downtime shows up as a gray \"Maintenance\" row in both sections — the Optimized Schedule of Assets below additionally re-times every build so none of them overlap a maintenance window.",
  },
]

type PrinterBundle = {
  printerId: string
  planningSegments: GanttSegment[]
  maintenanceSegments: GanttSegment[]
  forecastBuilds: { operator: string; segments: GanttSegment[] }[]
  optimizedBuilds: { operator: string; segments: GanttSegment[] }[]
  leaves: { operator: string; start: string; end: string }[]
}

type OperatorRow = { operator: string; segments: GanttSegment[] }

// Merges a given printer's per-build/per-leave records into one row per
// operator, then folds those rows across every selected printer so an
// operator who happens to work more than one printer still ends up on a
// single condensed line instead of one row per printer.
function condenseOperatorRows(
  bundles: PrinterBundle[],
  pick: (bundle: PrinterBundle) => OperatorRow[]
): OperatorRow[] {
  const rowsByOperator = new Map<string, GanttSegment[]>()

  bundles.forEach((bundle) => {
    pick(bundle).forEach(({ operator, segments }) => {
      const existing = rowsByOperator.get(operator) ?? []
      rowsByOperator.set(operator, [...existing, ...segments])
    })
  })

  return Array.from(rowsByOperator.entries()).map(([operator, segments]) => ({
    operator,
    segments,
  }))
}

export default function AssetUtilizationPage() {
  const [printer, setPrinter] = React.useState("3")
  const [operatorFilter, setOperatorFilter] = React.useState("All")

  // The operator roster narrows to whichever printer(s) are currently
  // selected — reset back to "All" whenever that selection changes so a
  // stale operator name from a different printer can't stay selected.
  const [prevPrinter, setPrevPrinter] = React.useState(printer)
  if (printer !== prevPrinter) {
    setPrevPrinter(printer)
    setOperatorFilter("All")
  }

  const operatorOptions = React.useMemo(() => {
    const ids = printer === "All" ? PRINTER_IDS : [printer]
    return Array.from(new Set(ids.flatMap((id) => getPrinterOperators(id))))
  }, [printer])

  const printerBundles = React.useMemo<PrinterBundle[]>(() => {
    const ids = printer === "All" ? PRINTER_IDS : [printer]

    return ids.map((id) => {
      const rawForecastBuilds = generateOperatorForecast(id, FORECAST_BUILD_COUNT)
      const rawOptimizedBuilds = generateOptimizedOperatorForecast(
        id,
        FORECAST_BUILD_COUNT
      )
      const leaves = generateOperatorLeaves(id, FORECAST_BUILD_COUNT).filter(
        (leave) => operatorFilter === "All" || leave.operator === operatorFilter
      )
      const maintenanceWindows = generatePrinterMaintenanceSchedule(
        id,
        FORECAST_BUILD_COUNT
      )
      const planningSegments = generateForecastPlanningSegments(
        id,
        FORECAST_BUILD_COUNT
      )
      const operators = getPrinterOperators(id).filter(
        (operator) => operatorFilter === "All" || operator === operatorFilter
      )

      const forecastBuilds = operators.map((operator) => ({
        operator,
        segments: [
          ...rawForecastBuilds
            .filter((build) => build.operator === operator)
            .flatMap((build) => build.segments),
          ...leaves
            .filter((leave) => leave.operator === operator)
            .map((leave): GanttSegment => ({
              type: "Leave",
              start: leave.start,
              end: leave.end,
              operator,
            })),
        ],
      }))

      const optimizedBuilds = operators.map((operator) => ({
        operator,
        segments: [
          ...rawOptimizedBuilds
            .filter((build) => build.operator === operator)
            .flatMap((build) => build.segments),
          ...leaves
            .filter((leave) => leave.operator === operator)
            .map((leave): GanttSegment => ({
              type: "Leave",
              start: leave.start,
              end: leave.end,
              operator,
            })),
        ],
      }))

      const maintenanceSegments: GanttSegment[] = maintenanceWindows.map(
        (window) => ({
          type: "Maintenance",
          start: window.start,
          end: window.end,
        })
      )

      return {
        printerId: id,
        planningSegments,
        maintenanceSegments,
        forecastBuilds,
        optimizedBuilds,
        leaves,
      }
    })
  }, [printer, operatorFilter])

  // Condensed so an operator gets exactly one row regardless of how many
  // printers their schedule spans, rather than a separate row per printer.
  const operatorRows = React.useMemo(
    () => condenseOperatorRows(printerBundles, (bundle) => bundle.forecastBuilds),
    [printerBundles]
  )
  const optimizedOperatorRows = React.useMemo(
    () => condenseOperatorRows(printerBundles, (bundle) => bundle.optimizedBuilds),
    [printerBundles]
  )

  const fullRangeStart = React.useMemo(() => {
    const allStarts = [
      ...printerBundles.flatMap((bundle) =>
        bundle.planningSegments.map((segment) => new Date(segment.start).getTime())
      ),
      ...operatorRows.flatMap((row) =>
        row.segments.map((segment) => new Date(segment.start).getTime())
      ),
    ]
    return allStarts.length ? Math.min(...allStarts) : new Date(2025, 3, 1).getTime()
  }, [printerBundles, operatorRows])

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

  const showPrinterLabel = printerBundles.length > 1

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
          <PrinterFilter value={printer} onChange={setPrinter} includeAll />
          <OperatorFilter
            value={operatorFilter}
            onChange={setOperatorFilter}
            operators={operatorOptions}
          />
        </FilterGroup>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Asset Utilization</h2>
            <GanttLegend showLeave showMaintenance />
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
            {printerBundles.map((bundle) => (
              <GanttRow
                key={`maintenance-${bundle.printerId}`}
                label={
                  showPrinterLabel ? `Maintenance (${bundle.printerId})` : "Maintenance"
                }
                segments={bundle.maintenanceSegments}
                domainStart={domainStart}
                domainEnd={domainEnd}
                labelWidth={LABEL_WIDTH}
                muted
              />
            ))}
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

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Optimized Schedule of Assets</h2>
            <GanttLegend showMaintenance showLeave />
          </div>
          <p className="text-xs text-muted-foreground">
            Same forecasted assignment, re-timed around each printer&apos;s
            recurring maintenance downtime so no build ever overlaps a
            maintenance window.
          </p>
          <GanttAxis
            domainStart={domainStart}
            domainEnd={domainEnd}
            labelOffset={LABEL_OFFSET}
          />
          <div className="flex flex-col gap-1.5 pl-4">
            {printerBundles.map((bundle) => (
              <GanttRow
                key={`maintenance-${bundle.printerId}`}
                label={
                  showPrinterLabel ? `Maintenance (${bundle.printerId})` : "Maintenance"
                }
                segments={bundle.maintenanceSegments}
                domainStart={domainStart}
                domainEnd={domainEnd}
                labelWidth={LABEL_WIDTH}
                muted
              />
            ))}
            {optimizedOperatorRows.map((row) => (
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
