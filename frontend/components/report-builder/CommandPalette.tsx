'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  Search, CornerDownLeft, Command, ArrowUp, ArrowDown,
} from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'

export interface CommandItem {
  id: string
  label: string
  hint?: string
  icon: typeof Search
  group: string
  shortcut?: string
  run: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  commands: CommandItem[]
}

// A Cmd/Ctrl+K command palette — fuzzy-ish filter over a flat command list,
// keyboard navigable. Lets power users drive the whole builder without the mouse.
export default function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, open)

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return commands
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q)
    )
  }, [commands, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  useEffect(() => { setActive(0) }, [query])

  if (!open || typeof document === 'undefined') return null

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, c) => {
    (acc[c.group] ||= []).push(c)
    return acc
  }, {})
  const flatIds = filtered.map(c => c.id)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const item = filtered[active]
      if (item) { item.run(); onClose() }
    } else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-start justify-center bg-slate-900/50 p-4 pt-[12vh] backdrop-blur-sm print:hidden" onClick={onClose}>
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        initial={{ opacity: 0, scale: 0.97, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-elev-4"
      >
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command or search…"
            className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
          />
          <kbd className="hidden items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400 sm:flex">
            <CornerDownLeft className="h-2.5 w-2.5" /> to run
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto scroll-thin p-2">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-slate-400">No commands match “{query}”.</p>
          )}
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="mb-1">
              <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">{group}</p>
              {items.map(item => {
                const idx = flatIds.indexOf(item.id)
                const isActive = idx === active
                const IconCmp = item.icon
                return (
                  <button
                    key={item.id}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => { item.run(); onClose() }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      isActive ? 'bg-nisr-navy text-white' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <IconCmp className={`h-4 w-4 shrink-0 ${isActive ? 'text-nisr-cyan-light' : 'text-slate-400'}`} />
                    <span className="flex-1">
                      <span className="block text-[12px] font-semibold">{item.label}</span>
                      {item.hint && <span className={`block text-[10px] ${isActive ? 'text-nisr-cyan-light/80' : 'text-slate-400'}`}>{item.hint}</span>}
                    </span>
                    {item.shortcut && (
                      <kbd className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {item.shortcut}
                      </kbd>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-[9px] text-slate-400">
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-0.5"><ArrowUp className="h-2.5 w-2.5" /><ArrowDown className="h-2.5 w-2.5" /> navigate</span>
            <span className="flex items-center gap-0.5"><Command className="h-2.5 w-2.5" />+K</span>
          </span>
          <span>{filtered.length} commands</span>
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
