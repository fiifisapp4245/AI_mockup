"use client"

import * as React from "react"

import type { GanttSegment } from "@/lib/mock-data"

const SEGMENT_COLOR: Record<GanttSegment["type"], string> = {
  Build: "bg-sky-400",
  ChangeOver: "bg-indigo-700",
  Overrun: "bg-amber-500",
  BuildOverrun: "bg-red-500",
  Ahead: "bg-emerald-500",
  Leave: "bg-rose-400",
  Maintenance: "bg-slate-500",
}

const SEGMENT_LABEL: Record<GanttSegment["type"], string> = {
  Build: "Build",
  ChangeOver: "ChangeOver",
  Overrun: "Behind Schedule (Changeover)",
  BuildOverrun: "Behind Schedule (Build)",
  Ahead: "Ahead of plan",
  Leave: "Leave",
  Maintenance: "Maintenance",
}

function segmentStyle(
  segment: GanttSegment,
  domainStart: number,
  domainEnd: number
) {
  const total = domainEnd - domainStart
  const left = ((new Date(segment.start).getTime() - domainStart) / total) * 100
  const width =
    ((new Date(segment.end).getTime() - new Date(segment.start).getTime()) /
      total) *
    100

  return {
    left: `${left}%`,
    width: `${Math.max(width, 0.3)}%`,
  }
}

function SegmentTooltip({ segment }: { segment: GanttSegment }) {
  const startDate = new Date(segment.start)
  const endDate = new Date(segment.end)
  const durationHours =
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)

  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-max -translate-x-1/2">
      <div className="grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <span
            className={`size-2 shrink-0 rounded-[2px] ${SEGMENT_COLOR[segment.type]}`}
          />
          {SEGMENT_LABEL[segment.type]}
        </div>
        <div className="grid gap-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Start</span>
            <span className="font-mono text-foreground tabular-nums">
              {startDate.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">End</span>
            <span className="font-mono text-foreground tabular-nums">
              {endDate.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-mono text-foreground tabular-nums">
              {durationHours.toFixed(1)}h
            </span>
          </div>
          {segment.lotId && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Lot</span>
              <span className="font-mono text-foreground">
                {segment.lotId}
              </span>
            </div>
          )}
          {segment.productId && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Product</span>
              <span className="font-mono text-foreground">
                {segment.productId}
              </span>
            </div>
          )}
          {segment.operator && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Operator</span>
              <span className="font-mono text-foreground">
                {segment.operator}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const TRACK_HEIGHT = {
  sm: "h-4",
  md: "h-6",
  lg: "h-8",
}

export function GanttRow({
  label,
  segments,
  domainStart,
  domainEnd,
  muted = false,
  size = "md",
  trackWidth = 100,
  labelWidth = "w-20",
}: {
  label: string
  segments: GanttSegment[]
  domainStart: number
  domainEnd: number
  muted?: boolean
  size?: keyof typeof TRACK_HEIGHT
  trackWidth?: number
  labelWidth?: string
}) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null)

  return (
    <div className="flex items-center gap-3">
      <span
        className={`${labelWidth} shrink-0 truncate text-sm italic ${muted ? "text-muted-foreground/70" : "text-muted-foreground"}`}
      >
        {label}
      </span>
      <div className="relative flex-1">
        <div
          className={`relative overflow-hidden rounded-sm bg-muted/40 ${TRACK_HEIGHT[size]}`}
          style={{ width: `${trackWidth}%` }}
        >
          {segments.map((segment, index) => (
            <div
              key={index}
              className={`absolute top-0 h-full rounded-[2px] ${SEGMENT_COLOR[segment.type]} ${muted ? "opacity-50" : ""}`}
              style={segmentStyle(segment, domainStart, domainEnd)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}
        </div>
        {hoveredIndex !== null && (
          <div
            className="pointer-events-none absolute inset-0 top-0"
            style={{ width: `${trackWidth}%` }}
          >
            <div
              className="absolute top-0 h-full"
              style={segmentStyle(segments[hoveredIndex], domainStart, domainEnd)}
            >
              <SegmentTooltip segment={segments[hoveredIndex]} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function GanttLegend({
  showDelta = false,
  showLeave = false,
  showMaintenance = false,
}: {
  showDelta?: boolean
  showLeave?: boolean
  showMaintenance?: boolean
} = {}) {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Type</span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] bg-sky-400" />
        Build
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] bg-indigo-700" />
        ChangeOver
      </span>
      {showDelta && (
        <>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px] bg-amber-500" />
            Behind Schedule (Changeover)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px] bg-red-500" />
            Behind Schedule (Build)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px] bg-emerald-500" />
            Ahead of plan
          </span>
        </>
      )}
      {showLeave && (
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-rose-400" />
          Leave
        </span>
      )}
      {showMaintenance && (
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-slate-500" />
          Maintenance
        </span>
      )}
    </div>
  )
}

export function GanttAxis({
  domainStart,
  domainEnd,
  labelOffset = 92,
}: {
  domainStart: number
  domainEnd: number
  labelOffset?: number
}) {
  const days = Math.round((domainEnd - domainStart) / (1000 * 60 * 60 * 24))
  const tickCount = Math.min(days, 4)
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const time = domainStart + (i / tickCount) * (domainEnd - domainStart)
    return new Date(time)
  })

  return (
    <div
      className="flex justify-between border-b pb-2 text-xs text-muted-foreground"
      style={{ marginLeft: labelOffset }}
    >
      {ticks.map((tick, index) => (
        <span key={index}>
          {tick.toLocaleDateString("en-US", { month: "short", day: "2-digit" })}
        </span>
      ))}
    </div>
  )
}
