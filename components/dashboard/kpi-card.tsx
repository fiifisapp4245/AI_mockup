export function KpiCard({
  value,
  label,
}: {
  value: string
  label: string
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border p-6">
      <span className="text-3xl font-semibold tracking-tight">{value}</span>
      <span className="truncate text-sm text-muted-foreground">{label}</span>
    </div>
  )
}
