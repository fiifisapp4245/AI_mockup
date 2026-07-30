"use client"

import * as React from "react"

import { ChatSidebar, type ChatPrompt } from "@/components/dashboard/chat-sidebar"
import {
  generatePowderPlannerRows,
  generatePowderStorageBins,
  lotFamilyColorClass,
} from "@/lib/mock-data"

const CHAT_SUGGESTIONS = [
  "Which printers need a powder change soonest?",
  "Which printers still need an IPM build?",
  "Which lot is DE1352 running?",
]

const CHAT_PROMPTS: ChatPrompt[] = [
  {
    keywords: ["soon", "next", "urgent", "days", "change"],
    answer:
      "Sort by eye on the \"Days to New Powder\" column — rows under ~10 days are highlighted so you can plan the swap and line up a delivery before that printer runs dry.",
  },
  {
    keywords: ["ipm", "qualif", "coupon"],
    answer:
      "A lot listed under \"Next – Need IPM First\" hasn't been qualified on any printer yet, so its first use there requires a ~6h/1h IPM build before normal production resumes. A lot under \"Next – Qualified Powder\" means another printer already ran the IPM, so it can swap in with no extra qualification build. The column it's in is what tells you the status — badge color is unrelated, it just marks lot family.",
  },
  {
    keywords: ["project", "offline", "not running", "idle"],
    answer:
      "Rows marked \"Projects\" aren't currently in the production rotation, so there's nothing to track for them — they're excluded from the days/date columns.",
  },
  {
    keywords: ["storage", "bin", "cabinet", "pow"],
    answer:
      "The Storage Plan below tracks powder sitting in cabinets (POW1-POW25) that isn't currently loaded in a printer — each bin's color matches its lot family so you can trace a delivery's 4-way split across both tables.",
  },
  {
    keywords: ["color", "family", "lot"],
    answer:
      "Each 610kg delivery is split across 4 printers (152.5kg each, minus 2.5kg to flush the sieve), so every lot family shows up as up to four sibling lot numbers ending -1 through -4. Matching background colors across rows mark lots from the same delivery.",
  },
  {
    keywords: ["sample", "cap", "flag", "alert"],
    answer:
      "Every topup requires a powder sample — a missed one caused a CAP last year, so treat any printer close to a topup as needing a sample pulled and logged before that topup fires.",
  },
]

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  })
}

function lotFamilyOf(lot: string | null): string | null {
  return lot ? lot.split("-")[0] : null
}

function LotBadge({ lot }: { lot: string | null }) {
  if (!lot) return <span className="text-muted-foreground">—</span>
  return (
    <span
      className={`rounded-md border px-1.5 py-0.5 font-mono text-xs ${lotFamilyColorClass(lotFamilyOf(lot))}`}
    >
      {lot}
    </span>
  )
}

export default function PowderPlannerPage() {
  const rows = React.useMemo(() => generatePowderPlannerRows(), [])
  const bins = React.useMemo(() => generatePowderStorageBins(), [])

  return (
    <div className="flex gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Powder Planner</h2>
          <p className="text-xs text-muted-foreground">
            All-printer view of the powder tracker: current lot, what&apos;s
            queued next, and how many days remain before each printer needs
            its next full powder change. Badge color marks lot family, not
            status — matching colors (in the Current Powder, Next, and
            Storage Plan columns alike) trace one 610kg delivery&apos;s
            4-way split across printers. Whether a printer&apos;s next lot
            is already qualified or still needs an IPM build is shown by
            which of the two &quot;Next&quot; columns it appears in, not by
            color.
          </p>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Printer</th>
                  <th className="px-3 py-2 font-medium">Top Up</th>
                  <th className="px-3 py-2 font-medium">Cycle Count</th>
                  <th className="px-3 py-2 font-medium">Current Powder</th>
                  <th className="px-3 py-2 font-medium">Next – Qualified Powder</th>
                  <th className="px-3 py-2 font-medium">Next – Need IPM First</th>
                  <th className="px-3 py-2 font-medium">Days to New Powder</th>
                  <th className="px-3 py-2 font-medium">Approx Date Required</th>
                  <th className="px-3 py-2 font-medium">Printer State</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isProjects = row.state === "Projects"
                  const isUrgent =
                    row.daysToNewPowder !== null && row.daysToNewPowder <= 10

                  return (
                    <tr
                      key={row.printerId}
                      className={`border-b last:border-0 ${isProjects ? "bg-rose-50 dark:bg-rose-950/30" : ""}`}
                    >
                      <td className="px-3 py-2 font-medium">{row.printerId}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {row.topUpCount ?? "—"}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {row.cycleCount ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <LotBadge lot={row.currentLot} />
                      </td>
                      <td className="px-3 py-2">
                        <LotBadge lot={row.nextQualifiedLot} />
                      </td>
                      <td className="px-3 py-2">
                        <LotBadge lot={row.nextIpmLot} />
                      </td>
                      <td
                        className={`px-3 py-2 tabular-nums ${isUrgent ? "font-semibold text-rose-600 dark:text-rose-400" : ""}`}
                      >
                        {row.daysToNewPowder ?? "—"}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatDate(row.approxDateNewPowder)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            isProjects
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          }`}
                        >
                          {row.state}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Storage Plan</h2>
          <p className="text-xs text-muted-foreground">
            Powder currently sitting in cabinets rather than loaded in a
            printer — same lot-family coloring as the tracker above.
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Bin</th>
                  <th className="px-3 py-2 font-medium">kg Available</th>
                  <th className="px-3 py-2 font-medium">Lot</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {bins.map((bin) => (
                  <tr key={bin.bin} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{bin.bin}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {bin.kg > 0 ? bin.kg : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <LotBadge lot={bin.lot} />
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {bin.note ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ChatSidebar suggestions={CHAT_SUGGESTIONS} prompts={CHAT_PROMPTS} />
    </div>
  )
}
