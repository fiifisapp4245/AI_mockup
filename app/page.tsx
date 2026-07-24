"use client"

import * as React from "react"

import { FilterGroup, PrinterFilter } from "@/components/dashboard/filters"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { kpiSummary } from "@/lib/mock-data"

export default function OverviewPage() {
  const [printer, setPrinter] = React.useState("3")

  return (
    <div className="flex flex-col gap-8">
      <FilterGroup>
        <PrinterFilter value={printer} onChange={setPrinter} />
      </FilterGroup>

      <div className="flex flex-wrap gap-4">
        <KpiCard
          value={`${(kpiSummary.availableHours / 1000).toFixed(2)}K`}
          label="AvailableHours"
        />
        <KpiCard value={String(kpiSummary.totalBuilds)} label="TotalBuilds" />
        <KpiCard
          value={kpiSummary.totalPrintHours.toFixed(2)}
          label="TotalPrintHours"
        />
        <KpiCard
          value={kpiSummary.averageBuildHours.toFixed(2)}
          label="AverageBuildHours"
        />
        <KpiCard
          value={kpiSummary.averageChangeOverHours.toFixed(2)}
          label="AverageChangeOverHours"
        />
        <KpiCard
          value={kpiSummary.totalChangeOverHours.toFixed(2)}
          label="TotalChangeOverHours"
        />
        <KpiCard
          value={`${kpiSummary.utilization.toFixed(2)}%`}
          label="Utilization"
        />
      </div>
    </div>
  )
}
