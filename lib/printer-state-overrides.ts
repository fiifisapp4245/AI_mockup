"use client"

import * as React from "react"

// A printer's Running/Not Running status and its powder data (top up
// count, cycle count, current lot) are independent — a printer can have
// powder loaded and tracked while temporarily not running. So the state
// shown here is a separate, user-settable override on top of whatever the
// generated row's default state and powder data are, not something that
// clears or regenerates powder data when flipped. Persisted the same way
// as printer-visibility.ts (localStorage, no backend to write to).
const STORAGE_KEY = "realta-printer-state-overrides"

export type PrinterState = "Running" | "Not Running"

function readOverrides(): Record<string, PrinterState> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, PrinterState>) : {}
  } catch {
    return {}
  }
}

function writeOverrides(overrides: Record<string, PrinterState>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch {
    // Ignore write failures (private browsing, storage disabled, etc.) —
    // the override just won't persist across a reload.
  }
}

export function usePrinterStateOverrides() {
  const [overrides, setOverrides] = React.useState<Record<string, PrinterState>>({})

  // Read the real value after mount only, so server-rendered markup and the
  // first client render agree (avoids a hydration mismatch).
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOverrides(readOverrides())
  }, [])

  const setState = React.useCallback((printerId: string, state: PrinterState) => {
    setOverrides((prev) => {
      const next = { ...prev, [printerId]: state }
      writeOverrides(next)
      return next
    })
  }, [])

  const getState = React.useCallback(
    (printerId: string, defaultState: PrinterState) => overrides[printerId] ?? defaultState,
    [overrides]
  )

  return { getState, setState }
}
