"use client"

import * as React from "react"

import { ChatSidebar, type ChatPrompt } from "@/components/dashboard/chat-sidebar"
import { DateRangeFilter, FilterGroup } from "@/components/dashboard/filters"
import {
  generatePrinterLiveSchedules,
  LIVE_SCHEDULE_ANCHOR_ISO,
  LIVE_SCHEDULE_WINDOW_HOURS,
  NOT_RUNNING_PRINTER_IDS,
  type LiveScheduleBlock,
  type LiveScheduleBlockType,
} from "@/lib/mock-data"
import { usePrinterVisibility } from "@/lib/printer-visibility"

const ROW_HEIGHT = "h-7"
const ROW_HEIGHT_PX = 40
const HEADER_HEIGHT_PX = 40
const LABEL_COLUMN_WIDTH = 190

// Hourly is the detailed, per-hour view already in place. Weekly and
// Monthly zoom out further to see a much longer range at a glance —
// individual blocks shrink to thin color slivers at that scale (hover
// still shows the full tooltip), traded for range over detail.
type ScheduleZoom = "Hourly" | "Weekly" | "Monthly"
const ZOOM_PX_PER_HOUR: Record<ScheduleZoom, number> = {
  Hourly: 46,
  Weekly: 6,
  Monthly: 2,
}

const BLOCK_COLOR: Record<LiveScheduleBlockType, string> = {
  Build: "bg-sky-400 text-sky-950",
  Unload: "bg-teal-400 text-teal-950",
  BuildSetup: "bg-amber-400 text-amber-950",
  PowderTopup: "bg-yellow-300 text-yellow-950",
  IpmCoupon: "bg-indigo-600 text-indigo-50",
  Maintenance: "bg-slate-500 text-slate-50",
}

const LEGEND_ITEMS: { type: LiveScheduleBlockType; swatch: string; label: string }[] = [
  { type: "Build", swatch: "bg-sky-400", label: "Build" },
  { type: "Unload", swatch: "bg-teal-400", label: "Build unload" },
  { type: "BuildSetup", swatch: "bg-amber-400", label: "Build setup" },
  { type: "PowderTopup", swatch: "bg-yellow-300", label: "Powder top-up" },
  { type: "IpmCoupon", swatch: "bg-indigo-600", label: "IPM coupon build" },
  { type: "Maintenance", swatch: "bg-slate-500", label: "Maintenance" },
]

const CHAT_SUGGESTIONS = [
  "Which printers are in maintenance right now?",
  "When is DE1352's next powder top-up?",
  "Which printer is running an IPM coupon build?",
]

const CHAT_PROMPTS: ChatPrompt[] = [
  {
    keywords: ["unload", "teal"],
    answer:
      "Teal blocks are the build unload — a fixed 1h step right after every build, before whatever comes next. When a maintenance window is due, it lands in the gap after the unload and before build setup, rather than the unload waiting on it.",
  },
  {
    keywords: ["maintenance", "down", "offline", "clean down", "check"],
    answer:
      "Gray blocks mark maintenance — the schedule stages these so no two printers are ever down at the same time, since only one maintenance tech is typically available at once.",
  },
  {
    keywords: ["ipm", "coupon", "qualif"],
    answer:
      "Indigo blocks are IPM coupon builds — a short qualification build (~6h + 1h changeover) run whenever a printer starts a brand-new, not-yet-qualified powder lot. Build numbering resets to 1 right after.",
  },
  {
    keywords: ["topup", "top-up", "top up", "yellow", "powder"],
    answer:
      "Yellow blocks are routine powder top-ups (same lot, no IPM needed) — they fire every 30 builds, resetting that printer's build counter back to 1 for the new segment.",
  },
  {
    keywords: ["shift", "handover", "setup", "changeover"],
    answer:
      "Builds are held back from starting inside the last ~2.5h of a 12h shift (7:00/19:00 boundaries) — operators won't kick off a build they can't stay to monitor through the first 10 layers, so the next build waits for shift handover instead.",
  },
  {
    keywords: ["reset", "day", "scroll", "window"],
    answer:
      "The timeline resets visually at each 7:00 AM boundary (marked with a stronger divider) and scrolls forward across the full 30-day generated window — scroll right to see further out, or use the Date filter above to jump straight to a range.",
  },
  {
    keywords: ["planned", "actual", "overrun", "maximo"],
    answer:
      "This view currently shows one live/actual schedule rather than a planned-vs-actual overlay, and maintenance dates are generated locally rather than pulled from Maximo — both are natural next steps once that integration exists.",
  },
  {
    keywords: ["hourly", "weekly", "monthly", "zoom", "range"],
    answer:
      "The Hourly / Weekly / Monthly toggle switches how compressed the timeline is — Hourly is the detailed per-hour view, Weekly and Monthly zoom out further to show a much longer range at a glance (blocks shrink to thin color slivers; hover still shows the full detail).",
  },
  {
    keywords: ["legend", "isolate", "filter type", "click", "only"],
    answer:
      "Click a legend swatch to isolate just that block type across every printer — click it again (or another swatch) to go back to showing everything.",
  },
]

function formatHourTick(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function BlockTooltip({ block }: { block: LiveScheduleBlock }) {
  const start = new Date(block.start)
  const end = new Date(block.end)
  const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)

  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-max -translate-x-1/2">
      <div className="grid min-w-40 gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <span className={`size-2 shrink-0 rounded-[2px] ${BLOCK_COLOR[block.type]}`} />
          {block.label}
        </div>
        <div className="grid gap-0.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Start</span>
            <span className="font-mono text-foreground tabular-nums">
              {start.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-mono text-foreground tabular-nums">
              {durationHours.toFixed(1)}h
            </span>
          </div>
          {block.cycleTopUpCount !== undefined && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Cycle Top Up</span>
              <span className="font-mono text-foreground">{block.cycleTopUpCount}</span>
            </div>
          )}
          {block.powderLot && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Powder Lot</span>
              <span className="font-mono text-foreground">{block.powderLot}</span>
            </div>
          )}
          {block.lotId && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Lot ID</span>
              <span className="font-mono text-foreground">{block.lotId}</span>
            </div>
          )}
          {block.productId && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Product ID</span>
              <span className="font-mono text-foreground">{block.productId}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ZoomToggle({
  value,
  onChange,
}: {
  value: ScheduleZoom
  onChange: (zoom: ScheduleZoom) => void
}) {
  const zooms: ScheduleZoom[] = ["Hourly", "Weekly", "Monthly"]
  return (
    <div className="inline-flex items-center rounded-md border p-0.5 text-xs">
      {zooms.map((zoom) => (
        <button
          key={zoom}
          type="button"
          onClick={() => onChange(zoom)}
          className={`rounded px-2.5 py-1 font-medium transition-colors ${
            value === zoom
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {zoom}
        </button>
      ))}
    </div>
  )
}

function LiveScheduleLegend({
  activeType,
  onToggle,
}: {
  activeType: LiveScheduleBlockType | null
  onToggle: (type: LiveScheduleBlockType) => void
}) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      {LEGEND_ITEMS.map((item) => {
        const isActive = activeType === item.type
        const isDimmed = activeType !== null && !isActive
        return (
          <button
            key={item.type}
            type="button"
            onClick={() => onToggle(item.type)}
            className={`flex items-center gap-1.5 rounded px-1.5 py-1 transition-colors ${
              isActive ? "bg-muted font-medium text-foreground" : ""
            } ${isDimmed ? "opacity-40 hover:opacity-70" : ""}`}
          >
            <span className={`size-2.5 rounded-[2px] ${item.swatch}`} />
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

function LiveScheduleRow({
  blocks,
  domainStart,
  domainEnd,
  totalWidth,
  pxPerHour,
  activeType,
}: {
  blocks: LiveScheduleBlock[]
  domainStart: number
  domainEnd: number
  totalWidth: number
  pxPerHour: number
  activeType: LiveScheduleBlockType | null
}) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null)

  const visibleBlocks = blocks.filter((block) => {
    const startMs = new Date(block.start).getTime()
    const endMs = new Date(block.end).getTime()
    const inRange = endMs > domainStart && startMs < domainEnd
    const matchesType = !activeType || block.type === activeType
    return inRange && matchesType
  })

  return (
    <div
      className={`relative ${ROW_HEIGHT} rounded-sm bg-muted/40`}
      style={{ width: totalWidth }}
    >
      {visibleBlocks.map((block, index) => {
        const startMs = new Date(block.start).getTime()
        const endMs = new Date(block.end).getTime()
        const left = ((startMs - domainStart) / (1000 * 60 * 60)) * pxPerHour
        const width = Math.max(
          ((endMs - startMs) / (1000 * 60 * 60)) * pxPerHour,
          6
        )

        return (
          <div
            key={index}
            className={`absolute top-0 h-full overflow-hidden rounded-[2px] border border-black/10 px-1 text-[10px] leading-7 font-medium whitespace-nowrap ${BLOCK_COLOR[block.type]}`}
            style={{ left, width }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {block.label}
            {hoveredIndex === index && <BlockTooltip block={block} />}
          </div>
        )
      })}
    </div>
  )
}

const DEFAULT_START = new Date(LIVE_SCHEDULE_ANCHOR_ISO)
const DEFAULT_END = new Date(
  DEFAULT_START.getTime() + LIVE_SCHEDULE_WINDOW_HOURS * 60 * 60 * 1000
)

export default function LiveSchedulePage() {
  const allSchedules = React.useMemo(() => generatePrinterLiveSchedules(), [])
  const { isVisible } = usePrinterVisibility(NOT_RUNNING_PRINTER_IDS)
  const schedules = React.useMemo(
    () => allSchedules.filter((schedule) => isVisible(schedule.printerId)),
    [allSchedules, isVisible]
  )
  const [zoom, setZoom] = React.useState<ScheduleZoom>("Hourly")
  const [activeBlockType, setActiveBlockType] =
    React.useState<LiveScheduleBlockType | null>(null)
  const toggleActiveBlockType = (type: LiveScheduleBlockType) => {
    setActiveBlockType((prev) => (prev === type ? null : type))
  }
  const [start, setStart] = React.useState(DEFAULT_START)
  const [end, setEnd] = React.useState(DEFAULT_END)
  const pxPerHour = ZOOM_PX_PER_HOUR[zoom]

  const domainStart = start.getTime()
  const domainEnd = end.getTime()
  const visibleHours = Math.max((domainEnd - domainStart) / (1000 * 60 * 60), 0)
  const totalWidth = visibleHours * pxPerHour

  const hourTicks = React.useMemo(
    () =>
      Array.from({ length: Math.ceil(visibleHours) }, (_, hour) => {
        const date = new Date(domainStart + hour * 60 * 60 * 1000)
        return { hour, date, isDayStart: date.getHours() === 7 }
      }),
    [domainStart, visibleHours]
  )

  // Weekly/Monthly zoom labels one tick per day instead of per hour — that
  // many hourly divider lines at those scales would just be visual noise.
  const dayTicks = React.useMemo(
    () =>
      Array.from({ length: Math.ceil(visibleHours / 24) }, (_, day) => {
        const date = new Date(domainStart + day * 24 * 60 * 60 * 1000)
        return { day, date }
      }),
    [domainStart, visibleHours]
  )

  // Two scrollbars, kept in sync — the main one sits below every printer
  // row, which is out of view whenever you've scrolled up to look at the
  // top of a tall list. This top strip mirrors it so there's always a
  // scrollbar on screen no matter where you're looking.
  const topScrollRef = React.useRef<HTMLDivElement>(null)
  const bottomScrollRef = React.useRef<HTMLDivElement>(null)
  const isSyncingScroll = React.useRef(false)

  const syncScroll = (source: HTMLDivElement, target: HTMLDivElement | null) => {
    if (isSyncingScroll.current || !target) return
    isSyncingScroll.current = true
    target.scrollLeft = source.scrollLeft
    isSyncingScroll.current = false
  }

  return (
    <div className="flex gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <FilterGroup>
          <DateRangeFilter
            label="Date"
            start={start}
            end={end}
            onChangeStart={setStart}
            onChangeEnd={setEnd}
          />
        </FilterGroup>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium">Live Schedule</h2>
            <ZoomToggle value={zoom} onChange={setZoom} />
          </div>
          <LiveScheduleLegend
            activeType={activeBlockType}
            onToggle={toggleActiveBlockType}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Per-printer view of the live build schedule — resets visually at
          each 7:00 AM boundary. Use the Hourly / Weekly / Monthly toggle to
          zoom, the Date filter to jump to a range, and click a legend swatch
          to isolate just that block type. Hover any block for its build
          number, cycle top-up count, powder lot, and product ID.
        </p>

        {/* Top scrollbar, synced with the one below — offset by the label
            column width so it lines up with the timeline, not the printer list. */}
        <div className="flex">
          <div className="shrink-0" style={{ width: LABEL_COLUMN_WIDTH }} />
          <div
            ref={topScrollRef}
            onScroll={() => syncScroll(topScrollRef.current!, bottomScrollRef.current)}
            className="overflow-x-auto overflow-y-hidden"
            style={{ height: 16 }}
          >
            <div style={{ width: totalWidth, height: 1 }} />
          </div>
        </div>

        <div className="flex rounded-lg border">
          {/* Fixed left column — never scrolls horizontally. */}
          <div className="flex shrink-0 flex-col border-r" style={{ width: LABEL_COLUMN_WIDTH }}>
            <div
              className="flex items-center gap-3 border-b bg-muted/40 px-3 text-xs font-medium text-muted-foreground"
              style={{ height: HEADER_HEIGHT_PX }}
            >
              <span className="w-20">Printer</span>
              <span className="w-12">Top Up</span>
              <span>Cycle</span>
            </div>
            {schedules.map((schedule) => {
              const isNotRunning = schedule.state === "Not Running"
              return (
                <div
                  key={schedule.printerId}
                  className={`flex items-center gap-3 border-b px-3 text-sm last:border-0 ${isNotRunning ? "bg-rose-50 dark:bg-rose-950/30" : ""}`}
                  style={{ height: ROW_HEIGHT_PX }}
                >
                  <span
                    className={`w-20 font-medium ${isNotRunning ? "text-rose-600 dark:text-rose-400" : ""}`}
                  >
                    {schedule.printerId}
                  </span>
                  {isNotRunning ? (
                    <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                      Not Running
                    </span>
                  ) : (
                    <>
                      <span className="w-12 tabular-nums text-muted-foreground">
                        {schedule.topUpCount}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {schedule.cycleCount}
                      </span>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Only this side scrolls horizontally. */}
          <div
            ref={bottomScrollRef}
            onScroll={() => syncScroll(bottomScrollRef.current!, topScrollRef.current)}
            className="overflow-x-auto"
          >
            <div style={{ width: totalWidth }}>
              <div
                className="relative border-b bg-muted/40"
                style={{ height: HEADER_HEIGHT_PX }}
              >
                {zoom === "Hourly"
                  ? hourTicks.map(({ hour, date, isDayStart }) => (
                      <div
                        key={hour}
                        className={`absolute top-0 h-full border-r ${isDayStart ? "border-foreground/30" : "border-border/60"}`}
                        style={{ left: hour * pxPerHour, width: pxPerHour }}
                      >
                        <span className="absolute left-0.5 top-1 whitespace-nowrap text-[10px] text-muted-foreground">
                          {formatHourTick(date)}
                        </span>
                        {isDayStart && (
                          <span className="absolute left-0.5 bottom-1 whitespace-nowrap text-[10px] font-medium text-foreground">
                            {date.toLocaleDateString("en-US", {
                              month: "short",
                              day: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    ))
                  : dayTicks.map(({ day, date }) => (
                      <div
                        key={day}
                        className="absolute top-0 h-full border-r border-foreground/30"
                        style={{ left: day * 24 * pxPerHour, width: 24 * pxPerHour }}
                      >
                        <span className="absolute left-0.5 bottom-1 whitespace-nowrap text-[10px] font-medium text-foreground">
                          {date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
              </div>

              {schedules.map((schedule) => {
                const isNotRunning = schedule.state === "Not Running"
                return (
                  <div
                    key={schedule.printerId}
                    className={`flex items-center border-b px-0 last:border-0 ${isNotRunning ? "bg-rose-50 dark:bg-rose-950/30" : ""}`}
                    style={{ height: ROW_HEIGHT_PX }}
                  >
                    {isNotRunning ? (
                      <div style={{ width: totalWidth, height: 20 }} />
                    ) : (
                      <LiveScheduleRow
                        blocks={schedule.blocks}
                        domainStart={domainStart}
                        domainEnd={domainEnd}
                        totalWidth={totalWidth}
                        pxPerHour={pxPerHour}
                        activeType={activeBlockType}
                      />
                    )}
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
