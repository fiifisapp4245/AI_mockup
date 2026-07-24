import type { GanttSegment } from "@/lib/mock-data"

const SEGMENT_COLOR: Record<GanttSegment["type"], string> = {
  Build: "bg-sky-400",
  ChangeOver: "bg-indigo-700",
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

export function GanttRow({
  label,
  segments,
  domainStart,
  domainEnd,
  muted = false,
}: {
  label: string
  segments: GanttSegment[]
  domainStart: number
  domainEnd: number
  muted?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`w-20 shrink-0 text-sm italic ${muted ? "text-muted-foreground/70" : "text-muted-foreground"}`}
      >
        {label}
      </span>
      <div
        className={`relative flex-1 rounded-sm bg-muted/40 ${muted ? "h-4" : "h-6"}`}
      >
        {segments.map((segment, index) => (
          <div
            key={index}
            className={`absolute top-0 h-full rounded-[2px] ${SEGMENT_COLOR[segment.type]} ${muted ? "opacity-50" : ""}`}
            style={segmentStyle(segment, domainStart, domainEnd)}
            title={`${segment.type}: ${new Date(segment.start).toLocaleString()} – ${new Date(segment.end).toLocaleString()}`}
          />
        ))}
      </div>
    </div>
  )
}

export function GanttLegend() {
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
    </div>
  )
}

export function GanttAxis({
  domainStart,
  domainEnd,
}: {
  domainStart: number
  domainEnd: number
}) {
  const days = Math.round((domainEnd - domainStart) / (1000 * 60 * 60 * 24))
  const tickCount = Math.min(days, 4)
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const time = domainStart + (i / tickCount) * (domainEnd - domainStart)
    return new Date(time)
  })

  return (
    <div className="ml-[92px] flex justify-between border-b pb-2 text-xs text-muted-foreground">
      {ticks.map((tick, index) => (
        <span key={index}>
          {tick.toLocaleDateString("en-US", { month: "short", day: "2-digit" })}
        </span>
      ))}
    </div>
  )
}
