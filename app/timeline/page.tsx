"use client"

import * as React from "react"

import {
  DateRangeFilter,
  FilterGroup,
  LotIdFilter,
  PrinterFilter,
} from "@/components/dashboard/filters"
import { ChatSidebar, type ChatPrompt } from "@/components/dashboard/chat-sidebar"
import {
  GanttAxis,
  GanttLegend,
  GanttRow,
} from "@/components/dashboard/gantt-timeline"
import {
  generateLotPlanningTimelines,
  generateLotTimelines,
  generatePrinterLotChain,
} from "@/lib/mock-data"

const CHAT_SUGGESTIONS = [
  "Which lots are behind schedule?",
  "How does production compare to planning?",
  "Which lot had the longest changeover?",
]

const CHAT_PROMPTS: ChatPrompt[] = [
  {
    keywords: ["behind", "overrun", "late", "delay"],
    answer:
      "A few lots are running behind their planned build window — look for amber \"Behind Schedule\" segments on the Planning row. Those show where the plan finished before actual production caught up.",
  },
  {
    keywords: ["ahead", "faster", "better"],
    answer:
      "Where you see a green \"Ahead of plan\" segment on the Production row, that build finished faster than its planned duration — a good sign for that lot/operator pairing.",
  },
  {
    keywords: ["changeover", "changeove", "setup"],
    answer:
      "Changeover time (the dark indigo segments) varies per printer and lot. Production changeovers tend to run noticeably longer than the fixed 2h planning changeover — that's expected and factored separately from build-time comparisons.",
  },
  {
    keywords: ["compare", "comparison", "vs", "versus", "production", "planning"],
    answer:
      "Production and Planning are compared in two stages: build-vs-build and changeover-vs-changeover independently, so a long changeover doesn't unfairly color a build that actually beat its plan.",
  },
  {
    keywords: ["lot", "lots"],
    answer:
      "Use the Lot Id filter above to isolate a single lot's Production vs Planning bars, or leave it on \"All\" to see every lot chained back-to-back on the printer's timeline.",
  },
]

export default function TimelinePage() {
  const [printer, setPrinter] = React.useState("3")
  const [lotId, setLotId] = React.useState("All")
  const [start, setStart] = React.useState(new Date(2025, 3, 1))
  const [end, setEnd] = React.useState(new Date(2025, 3, 18))

  const printerLotChain = React.useMemo(
    () => generatePrinterLotChain(printer),
    [printer]
  )
  const lotTimelines = React.useMemo(
    () => generateLotTimelines(printer),
    [printer]
  )
  const lotPlanningTimelines = React.useMemo(
    () => generateLotPlanningTimelines(printer),
    [printer]
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
        <LotIdFilter
          value={lotId}
          onChange={setLotId}
          lotIds={lotTimelines.map((lot) => lot.lotId)}
        />
      </FilterGroup>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Printer Runtime</h2>
          <GanttLegend showDelta />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{printer}</span>
          <div className="flex flex-col gap-1.5 pl-4">
            <GanttRow
              label="Production"
              segments={printerLotChain.productionSegments}
              domainStart={printerLotChain.domainStart}
              domainEnd={printerLotChain.domainEnd}
            />
            <GanttRow
              label="Planning"
              segments={printerLotChain.planningSegments}
              domainStart={printerLotChain.domainStart}
              domainEnd={printerLotChain.domainEnd}
            />
          </div>
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
                      trackWidth={85}
                    />
                    {planningLot && (
                      <GanttRow
                        label="Planning"
                        segments={planningLot.segments}
                        domainStart={domainStart}
                        domainEnd={domainEnd}
                        trackWidth={100}
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

      <ChatSidebar suggestions={CHAT_SUGGESTIONS} prompts={CHAT_PROMPTS} />
    </div>
  )
}
