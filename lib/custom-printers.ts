"use client"

import * as React from "react"

// Persisted the same way as printer-visibility.ts (localStorage, no backend
// to write to) — these are reference/spec-sheet entries only, not wired
// into the Powder Planner tracker, Live Schedule, or any KPI numbers, since
// none of those have a real production/topup/IPM history for a printer that
// was just registered here.
const STORAGE_KEY = "realta-custom-printers"

export type CustomPrinter = {
  id: string
  printerId: string
  model: string
  buildVolume: string
  hopperCapacityKg: string
  laserPowerSpec: string
}

function readCustomPrinters(): CustomPrinter[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CustomPrinter[]) : []
  } catch {
    return []
  }
}

function writeCustomPrinters(printers: CustomPrinter[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(printers))
  } catch {
    // Ignore write failures (private browsing, storage disabled, etc.) —
    // the added printer just won't persist across a reload.
  }
}

export function useCustomPrinters() {
  const [printers, setPrinters] = React.useState<CustomPrinter[]>([])

  // Read the real value after mount only, so server-rendered markup and the
  // first client render agree (avoids a hydration mismatch).
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrinters(readCustomPrinters())
  }, [])

  const addPrinter = React.useCallback((printer: Omit<CustomPrinter, "id">) => {
    setPrinters((prev) => {
      const next = [...prev, { ...printer, id: `${printer.printerId}-${prev.length}` }]
      writeCustomPrinters(next)
      return next
    })
  }, [])

  const removePrinter = React.useCallback((id: string) => {
    setPrinters((prev) => {
      const next = prev.filter((p) => p.id !== id)
      writeCustomPrinters(next)
      return next
    })
  }, [])

  return { printers, addPrinter, removePrinter }
}
