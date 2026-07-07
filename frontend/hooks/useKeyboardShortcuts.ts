'use client'

import { useEffect } from 'react'

export interface ShortcutHandlers {
  onUndo?: () => void
  onRedo?: () => void
  onCommandPalette?: () => void
  onEscape?: () => void
  onAddParagraph?: () => void
  onAddHeading?: () => void
  onSave?: () => void
  onToggleFocus?: () => void
  onExport?: () => void
}

function isEditableTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (!t) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
}

/**
 * Global keyboard shortcut wiring. Editing shortcuts (undo/redo/save) fire even
 * when focus is inside an input; structural shortcuts (palette, focus toggle,
 * add-block) are suppressed while typing so they don't hijack report editing.
 *
 * Mod/Mac detection: Cmd on macOS, Ctrl elsewhere.
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const editing = isEditableTarget(e)

      // Undo / Redo — work everywhere, including while editing text.
      if (mod && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault()
          handlers.onRedo?.()
        } else {
          e.preventDefault()
          handlers.onUndo?.()
        }
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        handlers.onRedo?.()
        return
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handlers.onSave?.()
        return
      }

      // Escape — close overlays / deselect. Works while editing too.
      if (e.key === 'Escape') {
        handlers.onEscape?.()
        return
      }

      // The rest are suppressed while the user is typing into a field.
      if (editing) return

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        handlers.onCommandPalette?.()
        return
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        handlers.onToggleFocus?.()
        return
      }
      if (mod && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        handlers.onExport?.()
        return
      }
      // Plain letter shortcuts for quick block insertion.
      if (!mod && e.key.toLowerCase() === 'p' && e.shiftKey) {
        e.preventDefault()
        handlers.onAddParagraph?.()
        return
      }
      if (!mod && e.key.toLowerCase() === 'h' && e.shiftKey) {
        e.preventDefault()
        handlers.onAddHeading?.()
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlers, enabled])
}
