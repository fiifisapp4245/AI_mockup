"use client"

import * as React from "react"

import { ChatSidebar, type ChatPrompt } from "@/components/dashboard/chat-sidebar"
import {
  generatePrinterLiveSchedules,
  LIVE_SCHEDULE_ANCHOR_ISO,
  LIVE_SCHEDULE_WINDOW_HOURS,
  type LiveScheduleBlock,
  type LiveScheduleBlockType,
} from "@/lib/mock-data"

const PX_PER_HOUR = 46
const ROW_HEIGHT = "h-7"
const ROW_HEIGHT_PX = 40
const HEADER_HEIGHT_PX = 40
const LABEL_COLUMN_WIDTH = 190

const BLOCK_COLOR: Record<LiveScheduleBlockType, string> = {
  Build: "bg-sky-400 text-sky-950",
  BuildSetup: "bg-amber-400 text-amber-950",
  PowderTopup: "bg-yellow-300 text-yellow-950",
  IpmCoupon: "bg-indigo-600 text-indigo-50",
  Maintenance: "bg-slate-500 text-slate-50",
}

const CHAT_SUGGESTIONS = [
  "Which printers are in maintenance right now?",
  "When is DE1352's next powder top-up?",
  "Which printer is running an IPM coupon build?",
]

const CHAT_PROMPTS: ChatPrompt[] = [
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
      "The timeline resets visually at each 7:00 AM boundary (marked with a stronger divider) and scrolls forward across the full 10-day generated window — scroll right to see further out.",
  },
  {
    keywords: ["planned", "actual", "overrun", "maximo"],
    answer:
      "This view currently shows one live/actual schedule rather than a planned-vs-actual overlay, and maintenance dates are generated locally rather than pulled from Maximo — both are natural next steps once that integration exists.",
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

function LiveScheduleRow({
  blocks,
  anchorMs,
  totalWidth,
}: {
  blocks: LiveScheduleBlock[]
  anchorMs: number
  totalWidth: number
}) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null)

  return (
    <div
      className={`relative ${ROW_HEIGHT} rounded-sm bg-muted/40`}
      style={{ width: totalWidth }}
    >
      {blocks.map((block, index) => {
        const startMs = new Date(block.start).getTime()
        const endMs = new Date(block.end).getTime()
        const left = ((startMs - anchorMs) / (1000 * 60 * 60)) * PX_PER_HOUR
        const width = Math.max(
          ((endMs - startMs) / (1000 * 60 * 60)) * PX_PER_HOUR,
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

export default function LiveSchedulePage() {
  const schedules = React.useMemo(() => generatePrinterLiveSchedules(), [])
  const anchorMs = React.useMemo(
    () => new Date(LIVE_SCHEDULE_ANCHOR_ISO).getTime(),
    []
  )
  const totalWidth = LIVE_SCHEDULE_WINDOW_HOURS * PX_PER_HOUR

  const hourTicks = React.useMemo(
    () =>
      Array.from({ length: LIVE_SCHEDULE_WINDOW_HOURS }, (_, hour) => {
        const date = new Date(anchorMs + hour * 60 * 60 * 1000)
        return { hour, date, isDayStart: date.getHours() === 7 }
      }),
    [anchorMs]
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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Live Schedule</h2>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[2px] bg-sky-400" />
              Build
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[2px] bg-amber-400" />
              Build setup
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[2px] bg-yellow-300" />
              Powder top-up
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[2px] bg-indigo-600" />
              IPM coupon build
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[2px] bg-slate-500" />
              Maintenance
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Hourly, per-printer view of the live build schedule — resets
          visually at each 7:00 AM boundary and scrolls forward across the
          full generated window. Hover any block for its build number, cycle
          top-up count, powder lot, and product ID.
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
              const isProjects = schedule.state === "Projects"
              return (
                <div
                  key={schedule.printerId}
                  className={`flex items-center gap-3 border-b px-3 text-sm last:border-0 ${isProjects ? "bg-rose-50 dark:bg-rose-950/30" : ""}`}
                  style={{ height: ROW_HEIGHT_PX }}
                >
                  <span
                    className={`w-20 font-medium ${isProjects ? "text-rose-600 dark:text-rose-400" : ""}`}
                  >
                    {schedule.printerId}
                  </span>
                  {isProjects ? (
                    <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                      Projects
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
                {hourTicks.map(({ hour, date, isDayStart }) => (
                  <div
                    key={hour}
                    className={`absolute top-0 h-full border-r ${isDayStart ? "border-foreground/30" : "border-border/60"}`}
                    style={{ left: hour * PX_PER_HOUR, width: PX_PER_HOUR }}
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
                ))}
              </div>

              {schedules.map((schedule) => {
                const isProjects = schedule.state === "Projects"
                return (
                  <div
                    key={schedule.printerId}
                    className={`flex items-center border-b px-0 last:border-0 ${isProjects ? "bg-rose-50 dark:bg-rose-950/30" : ""}`}
                    style={{ height: ROW_HEIGHT_PX }}
                  >
                    {isProjects ? (
                      <div style={{ width: totalWidth, height: 20 }} />
                    ) : (
                      <LiveScheduleRow
                        blocks={schedule.blocks}
                        anchorMs={anchorMs}
                        totalWidth={totalWidth}
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
