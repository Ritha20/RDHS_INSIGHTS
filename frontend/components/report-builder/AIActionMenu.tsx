'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, RefreshCw, Search } from 'lucide-react'
import { AI_ACTION_GROUPS, type AIActionDef } from '@/lib/report-builder/aiActions'
import { ACCENT_CLASSES } from '@/lib/report-builder/agentMeta'
import { Icon } from './Icons'

interface AIActionMenuProps {
  /** Action currently running anywhere on the canvas — disables the trigger. */
  isAnyRunning: boolean
  /** This block is the one running right now (shows a spinner). */
  isThisRunning: boolean
  onRun: (action: string) => void
}

// Filterable, grouped dropdown of the 14 per-block AI actions. The flat list
// in the old builder became unwieldy; here the same `action` ids are organized
// into Write / Analyze / Visualize / Source / Layout with a quick search box.
export default function AIActionMenu({ isAnyRunning, isThisRunning, onRun }: AIActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return
      if (triggerRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const filtered = AI_ACTION_GROUPS
    .map(g => ({
      ...g,
      actions: g.actions.filter(a =>
        a.label.toLowerCase().includes(query.toLowerCase()) ||
        a.description.toLowerCase().includes(query.toLowerCase())
      ),
    }))
    .filter(g => g.actions.length > 0)

  const run = (action: string) => {
    setOpen(false)
    setQuery('')
    onRun(action)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        disabled={isAnyRunning}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-nisr-cyan-dark transition-colors hover:bg-nisr-sky/60 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/30 disabled:opacity-40"
        title="AI actions"
      >
        {isThisRunning
          ? <RefreshCw className="h-3 w-3 animate-spin" />
          : <Sparkles className="h-3 w-3" />}
        AI
      </button>

      {open && (
        <motion.div
          ref={panelRef}
          role="menu"
          aria-label="AI block actions"
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full z-50 mt-1 w-64 origin-top-right overflow-hidden rounded-xl border border-slate-200 bg-white shadow-elev-3"
        >
          {/* Search */}
          <div className="border-b border-slate-100 p-2">
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5">
              <Search className="h-3 w-3 text-slate-400" />
              <input
                autoFocus
                aria-label="Search AI actions"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search AI actions…"
                className="w-full bg-transparent text-[11px] text-slate-700 placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Grouped actions */}
          <div className="max-h-72 overflow-y-auto scroll-thin py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-[11px] text-slate-400">No actions match “{query}”.</p>
            )}
            {filtered.map(group => {
              const accent = ACCENT_CLASSES[group.accent]
              return (
                <div key={group.id} className="py-1">
                  <p className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    {group.label}
                  </p>
                  {group.actions.map((a: AIActionDef) => (
                    <button
                      key={a.action}
                      onClick={() => run(a.action)}
                      role="menuitem"
                      className="group flex w-full items-start gap-2 px-3 py-1.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:bg-nisr-sky/50"
                    >
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${accent.bgSoft} ${accent.text}`}>
                        <Icon name={a.icon} className="h-3 w-3" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-semibold text-slate-700 group-hover:text-slate-900">{a.label}</span>
                        <span className="block truncate text-[10px] text-slate-400">{a.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </motion.div>
      )}
    </div>
  )
}
