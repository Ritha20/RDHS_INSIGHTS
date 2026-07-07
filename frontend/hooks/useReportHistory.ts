'use client'

import { useCallback, useRef, useState } from 'react'

const MAX_HISTORY = 60

/**
 * Undo/redo state machine over an arbitrary `T` value (the report blocks).
 *
 * Each `set` pushes a new snapshot onto the undo stack and clears the redo
 * stack — the standard "linear undo" model. Coalescing is intentionally NOT
 * done here; callers batch their own updates (e.g. the autosave debounce) so
 * fine-grained keystrokes don't flood the history with one-entry-per-keystroke.
 *
 * A small `set` variant that does not record history (`silentSet`) lets the
 * agent pipeline replace the canvas without polluting the undo stack.
 */
export function useReportHistory<T>(initial: T) {
  const [present, setPresent] = useState<T>(initial)
  // past/future hold snapshots. Refs would be leaner, but exposing length to
  // the toolbar (for disabled states + step hints) via state keeps it reactive.
  const [past, setPast] = useState<T[]>([])
  const [future, setFuture] = useState<T[]>([])
  // Guards against the history recording the programmatic `set` calls that
  // happen during undo/redo itself.
  const recording = useRef(true)

  const set = useCallback((updater: T | ((prev: T) => T), record = true) => {
    setPresent(prev => {
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater
      if (Object.is(next, prev)) return prev
      if (record && recording.current) {
        setPast(p => [...p.slice(-(MAX_HISTORY - 1)), prev])
        setFuture([])
      }
      return next
    })
  }, [])

  /** Replace present WITHOUT touching history (used by AI generation, refine,
   *  template swaps, autosave restore). */
  const silentSet = useCallback((value: T) => set(value, false), [set])

  const undo = useCallback(() => {
    setPast(p => {
      if (p.length === 0) return p
      const previous = p[p.length - 1]
      recording.current = false
      setPresent(prev => {
        setFuture(f => [prev, ...f])
        return previous
      })
      recording.current = true
      return p.slice(0, -1)
    })
  }, [])

  const redo = useCallback(() => {
    setFuture(f => {
      if (f.length === 0) return f
      const next = f[0]
      recording.current = false
      setPresent(prev => {
        setPast(p => [...p, prev])
        return next
      })
      recording.current = true
      return f.slice(1)
    })
  }, [])

  const reset = useCallback((value: T) => {
    recording.current = false
    setPresent(value)
    setPast([])
    setFuture([])
    recording.current = true
  }, [])

  return {
    present,
    set,
    silentSet,
    undo,
    redo,
    reset,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undoCount: past.length,
    redoCount: future.length,
  }
}
