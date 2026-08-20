"use client"

import * as React from "react"

import {
  DateRangeFilter,
  FilterGroup,
  PrinterFilter,
} from "@/components/dashboard/filters"
import { KpiCard } from "@/components/dashboard/kpi-card"
import {
  getKpiPlanningSummaryForRange,
  getKpiSummaryForRange,
} from "@/lib/mock-data"

function kpiTrend(
  actual: number,
  planned: number,
  lowerIsBetter: boolean = false
) {
  const direction: "up" | "down" = actual >= planned ? "up" : "down"
  const favorable = lowerIsBetter ? actual <= planned : actual >= planned
  return { direction, favorable }
}

export default function OverviewPage() {
  const [printer, setPrinter] = React.useState("3")
  const [start, setStart] = React.useState(new Date(2025, 3, 1))
  const [end, setEnd] = React.useState(new Date(2025, 5, 30))

  const kpiSummary = React.useMemo(
    () => getKpiSummaryForRange(printer, start.toISOString(), end.toISOString()),
    [printer, start, end]
  )
  const kpiPlanningSummary = React.useMemo(
    () => getKpiPlanningSummaryForRange(start.toISOString(), end.toISOString()),
    [start, end]
  )

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

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            value={`${(kpiSummary.availableHours / 1000).toFixed(2)}K`}
            label="AvailableHours"
            planningValue={`${(kpiPlanningSummary.availableHours / 1000).toFixed(2)}K`}
            {...kpiTrend(
              kpiSummary.availableHours,
              kpiPlanningSummary.availableHours
            )}
          />
          <KpiCard
            value={String(kpiSummary.totalBuilds)}
            label="TotalBuilds"
            planningValue={String(kpiPlanningSummary.totalBuilds)}
            {...kpiTrend(
              kpiSummary.totalBuilds,
              kpiPlanningSummary.totalBuilds
            )}
          />
          <KpiCard
            value={kpiSummary.totalPrintHours.toFixed(2)}
            label="TotalPrintHours"
            planningValue={kpiPlanningSummary.totalPrintHours.toFixed(2)}
            {...kpiTrend(
              kpiSummary.totalPrintHours,
              kpiPlanningSummary.totalPrintHours
            )}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            value={kpiSummary.averageBuildHours.toFixed(2)}
            label="AverageBuildHours"
            planningValue={kpiPlanningSummary.averageBuildHours.toFixed(2)}
            {...kpiTrend(
              kpiSummary.averageBuildHours,
              kpiPlanningSummary.averageBuildHours,
              true
            )}
          />
          <KpiCard
            value={kpiSummary.averageChangeOverHours.toFixed(2)}
            label="AverageChangeOverHours"
            planningValue={kpiPlanningSummary.averageChangeOverHours.toFixed(2)}
            {...kpiTrend(
              kpiSummary.averageChangeOverHours,
              kpiPlanningSummary.averageChangeOverHours,
              true
            )}
          />
          <KpiCard
            value={kpiSummary.totalChangeOverHours.toFixed(2)}
            label="TotalChangeOverHours"
            planningValue={kpiPlanningSummary.totalChangeOverHours.toFixed(2)}
            {...kpiTrend(
              kpiSummary.totalChangeOverHours,
              kpiPlanningSummary.totalChangeOverHours,
              true
            )}
          />
          <KpiCard
            value={`${kpiSummary.utilization.toFixed(2)}%`}
            label="Utilization"
            planningValue={`${kpiPlanningSummary.utilization.toFixed(2)}%`}
            {...kpiTrend(kpiSummary.utilization, kpiPlanningSummary.utilization)}
          />
        </div>
      </div>
    </div>
  )
}
