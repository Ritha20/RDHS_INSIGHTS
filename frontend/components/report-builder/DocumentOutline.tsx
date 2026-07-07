'use client'

import { useEffect, useState } from 'react'
import { ListTree, FileText } from 'lucide-react'
import type { Block } from '@/lib/report-builder/types'

interface DocumentOutlineProps {
  blocks: Block[]
  onJump: (id: string) => void
  activeId?: string | null
}

// Right-rail table of contents generated from the canvas's heading blocks.
// Clicking an entry scrolls the block into view; the active section is derived
// from scroll position via an IntersectionObserver wired by the canvas.
export default function DocumentOutline({ blocks, onJump, activeId }: DocumentOutlineProps) {
  const headings = blocks.filter(b => b.type === 'heading')

  if (headings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center">
        <ListTree className="mx-auto mb-1.5 h-4 w-4 text-slate-300" />
        <p className="text-[10px] text-slate-400">Add headings to build an outline.</p>
      </div>
    )
  }

  return (
    <nav className="space-y-0.5">
      <p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
        <ListTree className="h-3 w-3" />
        Outline
      </p>
      {headings.map((h, i) => (
        <button
          key={h.id}
          onClick={() => onJump(h.id)}
          className={`group flex w-full items-start gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors ${
            activeId === h.id
              ? 'bg-nisr-sky/70 font-semibold text-nisr-navy'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
          }`}
        >
          <FileText className={`mt-0.5 h-3 w-3 shrink-0 ${activeId === h.id ? 'text-nisr-cyan' : 'text-slate-300'}`} />
          <span className="line-clamp-2 leading-snug">{h.title || `Section ${i + 1}`}</span>
        </button>
      ))}
    </nav>
  )
}

/** Hook that observes canvas blocks and reports which heading is in view. */
export function useActiveSection(blockIds: string[], enabled: boolean) {
  const [active, setActive] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    const els = blockIds
      .map(id => document.getElementById(`block-${id}`))
      .filter((el): el is HTMLElement => !!el)
    if (els.length === 0) return
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id.replace('block-', ''))
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    )
    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [blockIds, enabled])
  return active
}
