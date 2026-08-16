"use client"

import * as React from "react"

// Shared across pages via localStorage rather than a global store — the
// Powder Planner page's "Printer Visibility" toggles decide which printers
// the Live Schedule page shows, and these are two separate page components
// with no other state shared between them.
const STORAGE_KEY = "realta-hidden-printers"

// Printers not currently running have no reason to show up on Live
// Schedule — hidden by default until someone's actually saved a
// preference, at which point that saved choice always wins.
function readHiddenPrinters(defaultHidden: string[]): Set<string> {
  if (typeof window === "undefined") return new Set(defaultHidden)
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set(defaultHidden)
  } catch {
    return new Set(defaultHidden)
  }
}

function writeHiddenPrinters(hidden: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...hidden]))
  } catch {
    // Ignore write failures (private browsing, storage disabled, etc.) —
    // visibility toggles just won't persist across a reload.
  }
}

export function usePrinterVisibility(defaultHidden: string[] = []) {
  const [hidden, setHidden] = React.useState<Set<string>>(() => new Set())

  // Read the real value after mount only, so server-rendered markup and the
  // first client render agree (avoids a hydration mismatch) before syncing
  // to whatever was actually saved (or the default-hidden set, the first
  // time there's nothing saved yet).
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(readHiddenPrinters(defaultHidden))
    // Only ever needs to run once per mount — re-reading on every
    // defaultHidden identity change would stomp a user's own toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isVisible = React.useCallback((printerId: string) => !hidden.has(printerId), [hidden])

  const toggle = React.useCallback((printerId: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(printerId)) next.delete(printerId)
      else next.add(printerId)
      writeHiddenPrinters(next)
      return next
    })
  }, [])

  return { hidden, isVisible, toggle }
}
