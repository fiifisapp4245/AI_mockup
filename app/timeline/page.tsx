"use client"

import * as React from "react"

import {
  DateRangeFilter,
  FilterGroup,
  LotIdFilter,
  PrinterFilter,
} from "@/components/dashboard/filters"
import {
  GanttAxis,
  GanttLegend,
  GanttRow,
} from "@/components/dashboard/gantt-timeline"
import {
  generateLotPlanningTimelines,
  generateLotTimelines,
  generatePrinterPlanningSegments,
  generatePrinterRuntimeSegments,
} from "@/lib/mock-data"

export default function TimelinePage() {
  const [printer, setPrinter] = React.useState("3")
  const [lotId, setLotId] = React.useState("All")
  const [start, setStart] = React.useState(new Date(2025, 3, 1))
  const [end, setEnd] = React.useState(new Date(2025, 3, 18))

  const printerSegments = React.useMemo(
    () => generatePrinterRuntimeSegments(),
    []
  )
  const printerPlanningSegments = React.useMemo(
    () => generatePrinterPlanningSegments(),
    []
  )
  const lotTimelines = React.useMemo(() => generateLotTimelines(), [])
  const lotPlanningTimelines = React.useMemo(
    () => generateLotPlanningTimelines(),
    []
  )

  const domainStart = start.getTime()
  const domainEnd = end.getTime()

  const visibleLots =
    lotId === "All"
      ? lotTimelines
      : lotTimelines.filter((lot) => lot.lotId === lotId)

  const visiblePlanningLots =
    lotId === "All"
      ? lotPlanningTimelines
      : lotPlanningTimelines.filter((lot) => lot.lotId === lotId)

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
        <LotIdFilter
          value={lotId}
          onChange={setLotId}
          lotIds={lotTimelines.map((lot) => lot.lotId)}
        />
      </FilterGroup>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Printer Runtime</h2>
          <GanttLegend />
        </div>
        <GanttAxis domainStart={domainStart} domainEnd={domainEnd} />
        <div className="flex flex-col gap-1.5">
          <GanttRow
            label={printer}
            segments={printerSegments}
            domainStart={domainStart}
            domainEnd={domainEnd}
          />
          <GanttRow
            label="Planning Schedule"
            segments={printerPlanningSegments}
            domainStart={domainStart}
            domainEnd={domainEnd}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Batch/Lot View Timeline</h2>
          <GanttLegend />
        </div>
        <GanttAxis domainStart={domainStart} domainEnd={domainEnd} />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{printer}</span>
          <div className="flex flex-col gap-4 pl-4">
            {visibleLots.map((lot) => {
              const planningLot = visiblePlanningLots.find(
                (planned) => planned.lotId === lot.lotId
              )

              return (
                <div key={lot.lotId} className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{lot.lotId}</span>
                  <div className="flex flex-col gap-1.5 pl-4">
                    <GanttRow
                      label="Production"
                      segments={lot.segments}
                      domainStart={domainStart}
                      domainEnd={domainEnd}
                    />
                    {planningLot && (
                      <GanttRow
                        label="Planning"
                        segments={planningLot.segments}
                        domainStart={domainStart}
                        domainEnd={domainEnd}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
