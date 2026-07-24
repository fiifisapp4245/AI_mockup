import { TrendingDown, TrendingUp } from "lucide-react"

export function KpiCard({
  value,
  label,
  planningValue,
  direction,
  favorable,
}: {
  value: string
  label: string
  planningValue?: string
  // Literal comparison: whether the actual value is above or below plan.
  direction?: "up" | "down"
  // Whether that direction is a good or bad outcome for this metric — e.g.
  // higher utilization is favorable, but higher changeover time is not.
  favorable?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border p-6">
      <span className="text-3xl font-semibold tracking-tight">{value}</span>
      <span className="truncate text-sm text-muted-foreground">{label}</span>
      {planningValue && direction && (
        <div
          className={`flex items-center gap-1 text-xs ${
            favorable
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {direction === "up" ? (
            <TrendingUp className="size-3.5 shrink-0" />
          ) : (
            <TrendingDown className="size-3.5 shrink-0" />
          )}
          <span className="truncate">{planningValue} planned</span>
        </div>
      )}
    </div>
  )
}
