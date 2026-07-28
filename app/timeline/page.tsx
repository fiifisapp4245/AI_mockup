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
  type GanttSegment,
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
      "A few lots are running behind their planned build window — check the Planning row for red \"Behind Schedule (Build)\" segments (the build itself ran long) versus amber \"Behind Schedule (Changeover)\" segments (only the changeover ran long).",
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
  {
    keywords: ["start", "offset", "difference", "drift"],
    answer:
      "On the Batch/Lot View Timeline, a gold \"Start Difference\" segment appears on whichever row (Production or Planning) starts later for that lot — hover it to see exactly how far apart the two starts are.",
  },
]

// Production and Planning are each their own independently-chained sequence,
// so the same lot can start at different times in each — one lags the
// other by however much drift has accumulated so far. Prepends a gold
// "StartOffset" segment to whichever row starts later, spanning from the
// earlier row's start up to its own, so hovering it shows exactly how far
// apart the two starts are.
function withStartOffset(
  productionSegments: GanttSegment[],
  planningSegments: GanttSegment[]
): { productionSegments: GanttSegment[]; planningSegments: GanttSegment[] } {
  if (productionSegments.length === 0 || planningSegments.length === 0) {
    return { productionSegments, planningSegments }
  }

  const productionStart = new Date(productionSegments[0].start).getTime()
  const planningStart = new Date(planningSegments[0].start).getTime()
  if (productionStart === planningStart) {
    return { productionSegments, planningSegments }
  }

  const common = {
    lotId: productionSegments[0].lotId,
    productId: productionSegments[0].productId,
    operator: productionSegments[0].operator,
  }

  const offsetSegment: GanttSegment = {
    type: "StartOffset",
    start: new Date(Math.min(productionStart, planningStart)).toISOString(),
    end: new Date(Math.max(productionStart, planningStart)).toISOString(),
    ...common,
  }

  return productionStart > planningStart
    ? { productionSegments: [offsetSegment, ...productionSegments], planningSegments }
    : { productionSegments, planningSegments: [offsetSegment, ...planningSegments] }
}

export default function TimelinePage() {
  const [printer, setPrinter] = React.useState("3")
  const [lotId, setLotId] = React.useState("All")
  const [start, setStart] = React.useState(new Date(2025, 3, 1))
  const [end, setEnd] = React.useState(new Date(2025, 3, 18))
  const [highlightedLotId, setHighlightedLotId] = React.useState<string | null>(
    null
  )

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
        <GanttAxis domainStart={domainStart} domainEnd={domainEnd} />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{printer}</span>
          <div className="flex flex-col gap-1.5 pl-4">
            <GanttRow
              label="Production"
              segments={printerLotChain.productionSegments}
              domainStart={domainStart}
              domainEnd={domainEnd}
              highlightedKey={highlightedLotId}
              onHighlightKeyChange={setHighlightedLotId}
            />
            <GanttRow
              label="Planning"
              segments={printerLotChain.planningSegments}
              domainStart={domainStart}
              domainEnd={domainEnd}
              highlightedKey={highlightedLotId}
              onHighlightKeyChange={setHighlightedLotId}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Batch/Lot View Timeline</h2>
          <GanttLegend showStartOffset />
        </div>
        <GanttAxis domainStart={domainStart} domainEnd={domainEnd} />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{printer}</span>
          <div className="flex flex-col gap-4 pl-4">
            {visibleLots.map((lot) => {
              const planningLot = visiblePlanningLots.find(
                (planned) => planned.lotId === lot.lotId
              )

              const { productionSegments, planningSegments } = withStartOffset(
                lot.segments,
                planningLot?.segments ?? []
              )

              return (
                <div key={lot.lotId} className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{lot.lotId}</span>
                  <div className="flex flex-col gap-1.5 pl-4">
                    <GanttRow
                      label="Production"
                      segments={productionSegments}
                      domainStart={domainStart}
                      domainEnd={domainEnd}
                      trackWidth={100}
                    />
                    {planningLot && (
                      <GanttRow
                        label="Planning"
                        segments={planningSegments}
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
