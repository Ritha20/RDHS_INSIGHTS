import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Traps keyboard focus inside `ref` while `active`, and restores focus to the
 * previously-focused element when the dialog closes/unmounts. Pair with
 * role="dialog" + aria-modal="true" on the same element for accessible modals.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return
    const node = ref.current
    if (!node) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    const visibleFocusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null)

    // Move focus into the dialog if nothing inside already holds it (some
    // dialogs, e.g. the command palette, focus their own input on open).
    if (!node.contains(document.activeElement)) {
      const els = visibleFocusables()
      ;(els[0] ?? node).focus()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const els = visibleFocusables()
      if (els.length === 0) {
        e.preventDefault()
        return
      }
      const first = els[0]
      const last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    node.addEventListener('keydown', onKeyDown)
    return () => {
      node.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [active, ref])
}
