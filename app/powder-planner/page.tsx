"use client"

import * as React from "react"

import { ChatSidebar, type ChatPrompt } from "@/components/dashboard/chat-sidebar"
import {
  computeApproxDateNewPowder,
  computeDaysToNewPowder,
  generatePowderPlannerRows,
  generatePowderStorageBins,
  lotFamilyColorClass,
  NOT_RUNNING_PRINTER_IDS,
  SHIFT_MODE_RUN_DAYS,
  type ShiftMode,
} from "@/lib/mock-data"
import { usePrinterVisibility } from "@/lib/printer-visibility"
import { useCustomPrinters, type CustomPrinter } from "@/lib/custom-printers"
import { usePrinterStateOverrides } from "@/lib/printer-state-overrides"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const SHIFT_MODES: ShiftMode[] = ["24/7", "24/6", "24/5"]

const CHAT_SUGGESTIONS = [
  "Which printers need a powder change soonest?",
  "Which printers still need an IPM build?",
  "Which lot is DE1352 running?",
]

const CHAT_PROMPTS: ChatPrompt[] = [
  {
    keywords: ["24/7", "24/6", "24/5", "shift mode", "schedule", "week"],
    answer:
      "The 24/7 · 24/6 · 24/5 toggle above the tracker sets how many days a week each printer is assumed to run — fewer running days a week stretches out the Days to New Powder and Approx Date Required columns, since the same remaining builds now take more calendar days.",
  },
  {
    keywords: ["visibility", "toggle", "hide", "show"],
    answer:
      "The Printer Visibility toggles at the top control the Live Schedule page only — switch a printer off here and it drops out of Live Schedule's list, without affecting anything in the tracker table below.",
  },
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
    keywords: ["add printer", "register", "new printer", "build volume", "hopper capacity", "laser power"],
    answer:
      "The Add Printer section registers a machine's spec sheet — model, build volume, hopper capacity, laser power — for reference. It doesn't add the printer to the tracker table or Live Schedule, since neither has a production/topup history to simulate for a printer that was just registered.",
  },
  {
    keywords: ["project", "offline", "not running", "idle", "printer state", "dropdown"],
    answer:
      "Printer State is a dropdown you can switch per row — Running or Not Running. It's independent of the powder data: a printer can have powder loaded and tracked (top up count, cycle count, current lot, days to new powder) while marked Not Running, since those columns reflect what's assigned to the powder, not whether the printer happens to be running right now.",
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

function LotBadge({
  lot,
  stripSuffix = false,
}: {
  lot: string | null
  stripSuffix?: boolean
}) {
  if (!lot) return <span className="text-muted-foreground">—</span>
  const family = lotFamilyOf(lot)
  return (
    <span
      className={`rounded-md border px-1.5 py-0.5 font-mono text-xs ${lotFamilyColorClass(family)}`}
    >
      {stripSuffix ? family : lot}
    </span>
  )
}

function PrinterToggle({
  printerId,
  on,
  onToggle,
}: {
  printerId: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm">
      <span className="font-medium">{printerId}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${printerId} visible on Live Schedule`}
        onClick={onToggle}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          on ? "bg-emerald-500" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  )
}

function ShiftModeToggle({
  value,
  onChange,
}: {
  value: ShiftMode
  onChange: (mode: ShiftMode) => void
}) {
  return (
    <div className="inline-flex items-center rounded-md border p-0.5 text-xs">
      {SHIFT_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`rounded px-2.5 py-1 font-medium transition-colors ${
            value === mode
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {mode}
        </button>
      ))}
    </div>
  )
}

const EMPTY_FORM = {
  printerId: "",
  model: "",
  buildVolume: "",
  hopperCapacityKg: "",
  laserPowerSpec: "",
}

function AddPrinterForm({
  printers,
  onAdd,
  onRemove,
}: {
  printers: CustomPrinter[]
  onAdd: (printer: typeof EMPTY_FORM) => void
  onRemove: (id: string) => void
}) {
  const [form, setForm] = React.useState(EMPTY_FORM)

  const updateField = (field: keyof typeof EMPTY_FORM) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.printerId.trim()) return
    onAdd(form)
    setForm(EMPTY_FORM)
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Add Printer</h2>
      <p className="text-xs text-muted-foreground">
        Register a new printer&apos;s spec sheet — build volume, powder
        hopper capacity, and laser power/build rate. This is a reference
        registry only; it doesn&apos;t add the printer to the tracker table
        below or to Live Schedule.
      </p>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="printerId">
            Printer ID
          </label>
          <Input
            id="printerId"
            placeholder="DE2001"
            value={form.printerId}
            onChange={updateField("printerId")}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="model">
            Model / Manufacturer
          </label>
          <Input
            id="model"
            placeholder="EOS M290"
            value={form.model}
            onChange={updateField("model")}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="buildVolume">
            Build Volume (X x Y x Z mm)
          </label>
          <Input
            id="buildVolume"
            placeholder="250 x 250 x 325"
            value={form.buildVolume}
            onChange={updateField("buildVolume")}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="hopperCapacityKg">
            Hopper Capacity (kg)
          </label>
          <Input
            id="hopperCapacityKg"
            placeholder="70"
            value={form.hopperCapacityKg}
            onChange={updateField("hopperCapacityKg")}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="laserPowerSpec">
            Laser Power / Build Rate
          </label>
          <Input
            id="laserPowerSpec"
            placeholder="400W, 40cm3/h"
            value={form.laserPowerSpec}
            onChange={updateField("laserPowerSpec")}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full">
            Add Printer
          </Button>
        </div>
      </form>

      {printers.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Printer ID</th>
                <th className="px-3 py-2 font-medium">Model</th>
                <th className="px-3 py-2 font-medium">Build Volume</th>
                <th className="px-3 py-2 font-medium">Hopper Capacity</th>
                <th className="px-3 py-2 font-medium">Laser Power / Build Rate</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {printers.map((printer) => (
                <tr key={printer.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{printer.printerId}</td>
                  <td className="px-3 py-2">{printer.model || "—"}</td>
                  <td className="px-3 py-2">{printer.buildVolume || "—"}</td>
                  <td className="px-3 py-2">
                    {printer.hopperCapacityKg ? `${printer.hopperCapacityKg} kg` : "—"}
                  </td>
                  <td className="px-3 py-2">{printer.laserPowerSpec || "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onRemove(printer.id)}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function PowderPlannerPage() {
  const rows = React.useMemo(() => generatePowderPlannerRows(), [])
  const bins = React.useMemo(() => generatePowderStorageBins(), [])
  const { isVisible, toggle } = usePrinterVisibility(NOT_RUNNING_PRINTER_IDS)
  const { printers: customPrinters, addPrinter, removePrinter } = useCustomPrinters()
  const { getState, setState } = usePrinterStateOverrides()
  const [shiftMode, setShiftMode] = React.useState<ShiftMode>("24/7")
  const runDaysPerWeek = SHIFT_MODE_RUN_DAYS[shiftMode]

  return (
    <div className="flex gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <AddPrinterForm
          printers={customPrinters}
          onAdd={addPrinter}
          onRemove={removePrinter}
        />

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Printer Visibility</h2>
          <p className="text-xs text-muted-foreground">
            Turn a printer off here to hide it from the Live Schedule page —
            useful for printers you don&apos;t need to watch right now. This
            only controls Live Schedule; the tracker below still shows every
            printer.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {rows.map((row) => (
              <PrinterToggle
                key={row.printerId}
                printerId={row.printerId}
                on={isVisible(row.printerId)}
                onToggle={() => toggle(row.printerId)}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Powder Planner</h2>
            <ShiftModeToggle value={shiftMode} onChange={setShiftMode} />
          </div>
          <p className="text-xs text-muted-foreground">
            All-printer view of the powder tracker: current lot, what&apos;s
            queued next, and how many days remain before each printer needs
            its next full powder change. Badge color marks lot family, not
            status — matching colors (in the Current Powder, Next, and
            Storage Plan columns alike) trace one 610kg delivery&apos;s
            4-way split across printers. Whether a printer&apos;s next lot
            is already qualified or still needs an IPM build is shown by
            which of the two &quot;Next&quot; columns it appears in, not by
            color. The {shiftMode} toggle above controls how many days a
            week each printer is assumed to run, which is what the Days to
            New Powder and Approx Date Required columns are based on.
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
                  <th className="px-3 py-2 font-medium">Days to New Powder ({shiftMode})</th>
                  <th className="px-3 py-2 font-medium">Approx Date Required ({shiftMode})</th>
                  <th className="px-3 py-2 font-medium">Printer State</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const state = getState(row.printerId, row.state)
                  const isNotRunning = state === "Not Running"
                  const daysToNewPowder =
                    row.topUpCount !== null && row.cycleCount !== null
                      ? computeDaysToNewPowder(row.topUpCount, row.cycleCount, runDaysPerWeek)
                      : null
                  const approxDateNewPowder =
                    daysToNewPowder !== null ? computeApproxDateNewPowder(daysToNewPowder) : null
                  const isUrgent = daysToNewPowder !== null && daysToNewPowder <= 10

                  return (
                    <tr
                      key={row.printerId}
                      className={`border-b last:border-0 ${isNotRunning ? "bg-rose-50 dark:bg-rose-950/30" : ""}`}
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
                        {daysToNewPowder ?? "—"}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatDate(approxDateNewPowder)}
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={state}
                          onValueChange={(value) =>
                            setState(row.printerId, value as "Running" | "Not Running")
                          }
                        >
                          <SelectTrigger
                            className={`h-7 w-[130px] rounded-full border-0 px-2.5 text-xs font-medium ${
                              isNotRunning
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            }`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Running">Running</SelectItem>
                            <SelectItem value="Not Running">Not Running</SelectItem>
                          </SelectContent>
                        </Select>
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
                      <LotBadge lot={bin.lot} stripSuffix />
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
