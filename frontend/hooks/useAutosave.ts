'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'report-autosave-v1'

type SaveState = 'idle' | 'saving' | 'saved'

export interface AutosaveSnapshot<T> {
  blocks: T
  meta: unknown
  savedAt: number
}

function readSnapshot<T>(): AutosaveSnapshot<T> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AutosaveSnapshot<T>
  } catch {
    return null
  }
}

function writeSnapshot<T>(blocks: T, meta: unknown) {
  if (typeof window === 'undefined') return
  try {
    const snapshot: AutosaveSnapshot<T> = {
      blocks,
      meta,
      savedAt: Date.now(),
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    /* quota or serialization error — fail silently; autosave is best-effort */
  }
}

/**
 * Debounced localStorage autosave. Returns a save-state string the toolbar can
 * render ("Saving…", "Saved 5s ago") plus a `hasRestorable` flag and a
 * `restore()` function used by the "Restore last session?" prompt.
 *
 * The first `value` is treated as initial and is NOT saved — only subsequent
 * changes are persisted, so loading a report doesn't immediately overwrite the
 * previous autosave with an identical copy.
 */
export function useAutosave<T>(value: T, meta: unknown, opts?: { enabled?: boolean; debounceMs?: number }) {
  const enabled = opts?.enabled ?? true
  const debounceMs = opts?.debounceMs ?? 1200

  const [state, setState] = useState<SaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [snapshot, setSnapshot] = useState<AutosaveSnapshot<T> | null>(() => readSnapshot<T>())

  const firstRun = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return
    // Skip the very first emit — it's the initial mount value.
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    setState('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      writeSnapshot(value, meta)
      const now = Date.now()
      setLastSavedAt(now)
      setState('saved')
    }, debounceMs)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, meta, enabled, debounceMs])

  const restore = useCallback(() => {
    const s = readSnapshot<T>()
    if (s) setSnapshot(s)
    return s
  }, [])

  // Refresh the "Saved Xs ago" relative label every 15s while saved.
  const [, tick] = useState(0)
  useEffect(() => {
    if (!lastSavedAt) return
    const id = setInterval(() => tick(n => n + 1), 15000)
    return () => clearInterval(id)
  }, [lastSavedAt])

  return {
    state,
    lastSavedAt,
    relativeSavedLabel: lastSavedAt ? formatRelative(lastSavedAt) : null,
    hasRestorable: !!snapshot?.blocks && Array.isArray(snapshot.blocks as unknown) && (snapshot.blocks as unknown as unknown[]).length > 0,
    snapshot,
    restore,
    clear: useCallback(() => {
      if (typeof window === 'undefined') return
      window.localStorage.removeItem(STORAGE_KEY)
      setSnapshot(null)
    }, []),
  }
}

function formatRelative(ts: number): string {
  const diff = Math.max(0, Date.now() - ts)
  const s = Math.floor(diff / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}
