'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Heading1, Pilcrow, FileText, Bell, Lightbulb, ShieldCheck, Microscope, BookMarked,
  BarChart3, Map, LineChart, PieChart, Table2, Gauge, Search,
} from 'lucide-react'
import type { Block, BlockType, ChartType } from '@/lib/report-builder/types'
import type { ChapterConfig } from '@/lib/types'

interface ManualSidebarProps {
  chapters: ChapterConfig[]
  onAddBlock: (type: BlockType) => void
  onAddIndicator: (id: string, chartType: ChartType) => void
}

const BLOCK_TEMPLATES: { type: BlockType; label: string; icon: typeof Heading1 }[] = [
  { type: 'heading', label: 'Section Title', icon: Heading1 },
  { type: 'paragraph', label: 'Paragraph', icon: Pilcrow },
  { type: 'executive_summary', label: 'Exec Summary', icon: FileText },
  { type: 'callout', label: 'Notice Box', icon: Bell },
  { type: 'insight', label: 'Insights', icon: Lightbulb },
  { type: 'recommendation', label: 'Policy Advisory', icon: ShieldCheck },
  { type: 'methodology', label: 'Methodology', icon: Microscope },
  { type: 'references', label: 'References', icon: BookMarked },
]

const CHART_ACTIONS: { chartType: ChartType; label: string; icon: typeof BarChart3; cls: string }[] = [
  { chartType: 'bar', label: 'Bar', icon: BarChart3, cls: 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100' },
  { chartType: 'map', label: 'Map', icon: Map, cls: 'text-teal-700 bg-teal-50 border-teal-200 hover:bg-teal-100' },
  { chartType: 'line', label: 'Line', icon: LineChart, cls: 'text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100' },
  { chartType: 'pie', label: 'Pie', icon: PieChart, cls: 'text-violet-700 bg-violet-50 border-violet-200 hover:bg-violet-100' },
  { chartType: 'kpi', label: 'KPI', icon: Gauge, cls: 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100' },
  { chartType: 'table', label: 'Table', icon: Table2, cls: 'text-slate-700 bg-slate-50 border-slate-200 hover:bg-slate-100' },
]

// Left rail for Manual mode: block templates on top, searchable indicator
// catalogue below. Each indicator expands a row of chart-type quick-adds.
export default function ManualSidebar({ chapters, onAddBlock, onAddIndicator }: ManualSidebarProps) {
  const [query, setQuery] = useState('')
  const filtered = chapters
    .map(ch => ({
      ...ch,
      indicators: ch.indicators.filter(i => i.name.toLowerCase().includes(query.toLowerCase())),
    }))
    .filter(ch => ch.indicators.length > 0)

  return (
    <div className="scroll-thin flex h-full flex-col overflow-y-auto p-4">
      {/* Block templates */}
      <section className="mb-6">
        <h3 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Add Blocks</h3>
        <div className="grid grid-cols-2 gap-2">
          {BLOCK_TEMPLATES.map((b, i) => (
            <motion.button
              type="button"
              key={b.type}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => onAddBlock(b.type)}
              className="group flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white p-3 text-center transition-all hover:-translate-y-0.5 hover:border-nisr-navy/30 hover:shadow-elev-1 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/30"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-nisr-sky/60 text-nisr-navy transition-colors group-hover:bg-nisr-navy group-hover:text-white">
                <b.icon className="h-4 w-4" />
              </span>
              <span className="text-[10px] font-semibold text-slate-600">{b.label}</span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* Indicator catalogue */}
      <section className="flex min-h-0 flex-1 flex-col">
        <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">DHS Indicators</h3>
        <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
          <Search className="h-3 w-3 text-slate-400" />
          <input
            aria-label="Search DHS indicators"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search indicators…"
            className="w-full bg-transparent text-[11px] text-slate-700 placeholder-slate-400 focus:outline-none"
          />
        </div>
        <div className="space-y-3">
          {filtered.map(ch => (
            <div key={ch.slug} className="space-y-1">
              <h4 className="border-b border-slate-100 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                {ch.title}
              </h4>
              <div className="space-y-1">
                {ch.indicators.map(ind => (
                  <div
                    key={ind.id}
                    className="group flex flex-col rounded-lg border border-transparent p-1.5 transition-colors hover:border-slate-200 hover:bg-slate-50 focus-within:border-nisr-cyan/30 focus-within:bg-nisr-sky/30"
                  >
                    <span className="text-[11px] font-semibold leading-tight text-slate-700">{ind.name}</span>
                    {ind.description && (
                      <span className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-500">{ind.description}</span>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      {CHART_ACTIONS.map(c => (
                        <button
                          type="button"
                          key={c.chartType}
                          onClick={() => onAddIndicator(ind.id, c.chartType)}
                          className={`flex min-h-7 items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold focus:outline-none focus:ring-2 focus:ring-nisr-cyan/30 ${c.cls}`}
                          title={`Add ${c.label}`}
                          aria-label={`Add ${c.label} for ${ind.name}`}
                        >
                          <c.icon className="h-2.5 w-2.5" />
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-6 text-center text-[10px] text-slate-400">No indicators match “{query}”.</p>
          )}
        </div>
      </section>
    </div>
  )
}
