'use client'

import { Trash, Plus, SlidersHorizontal, X } from 'lucide-react'
import type { Block } from '@/lib/report-builder/types'
import type { ChapterConfig } from '@/lib/types'
import { LAYOUT_PRESETS } from '@/lib/report-builder/layoutPresets'
import DocumentOutline from './DocumentOutline'

interface PropertiesPanelProps {
  selectedBlock: Block | null
  allBlocks: Block[]
  chapters: ChapterConfig[]
  activeSectionId: string | null
  onUpdate: (id: string, patch: Partial<Block>) => void
  onJump: (id: string) => void
  onClose: () => void
}

// Right rail: when a block is selected, show its properties (indicator, chart
// type, dynamic params, points editor, layout style). Otherwise show the
// document outline + a contextual hint.
export default function PropertiesPanel({
  selectedBlock, allBlocks, chapters, activeSectionId, onUpdate, onJump, onClose,
}: PropertiesPanelProps) {
  const allIndicators = chapters.flatMap(ch =>
    ch.indicators.map(ind => ({ ...ind, chapter: ch.title }))
  )

  return (
    <div className="flex h-full flex-col">
      {selectedBlock ? (
        <div className="flex flex-col gap-5 p-4">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 pb-2">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <SlidersHorizontal className="h-3 w-3" />
              Block Properties
            </span>
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-nisr-sky px-2 py-0.5 text-[10px] font-bold capitalize text-nisr-navy">
                {selectedBlock.type.replace('_', ' ')}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/30"
                aria-label="Close block properties"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {canEditTitle(selectedBlock) && (
              <Field label="Title">
                <input
                  value={selectedBlock.title ?? ''}
                  onChange={e => onUpdate(selectedBlock.id, { title: e.target.value })}
                  placeholder={titlePlaceholder(selectedBlock.type)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/25"
                />
              </Field>
            )}
            {canEditContent(selectedBlock) && (
              <Field label={selectedBlock.type === 'heading' ? 'Subtitle' : 'Body'}>
                <textarea
                  value={selectedBlock.content ?? ''}
                  onChange={e => onUpdate(selectedBlock.id, { content: e.target.value })}
                  rows={selectedBlock.type === 'paragraph' ? 5 : 3}
                  placeholder="Write report text..."
                  className="scroll-thin w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs leading-relaxed text-slate-700 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/25"
                />
              </Field>
            )}
          </div>

          {(selectedBlock.type === 'chart' || selectedBlock.type === 'table') && (
            <div className="space-y-4">
              <Field label="Selected Indicator">
                <select
                  value={selectedBlock.indicatorId || ''}
                  onChange={e => onUpdate(selectedBlock.id, { indicatorId: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-nisr-navy/30"
                >
                  <option value="">Choose an indicator…</option>
                  {allIndicators.map(ind => (
                    <option key={ind.id} value={ind.id}>{ind.name} ({ind.chapter})</option>
                  ))}
                </select>
              </Field>

              {selectedBlock.type === 'chart' && (
                <Field label="Chart Visualization">
                  <select
                    value={selectedBlock.chartType || 'bar'}
                    onChange={e => onUpdate(selectedBlock.id, { chartType: e.target.value as Block['chartType'] })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-nisr-navy/30"
                  >
                    <option value="bar">Bar Chart (Comparisons)</option>
                    <option value="map">Provinces Map</option>
                    <option value="line">Line Chart (Averages)</option>
                    <option value="pie">Pie Chart (Distributions)</option>
                    <option value="kpi">KPI Card (National)</option>
                  </select>
                </Field>
              )}

              {(() => {
                const matchedInd = chapters.flatMap(c => c.indicators).find(i => i.id === selectedBlock.indicatorId)
                if (!matchedInd?.dynamicParams?.length) return null
                return (
                  <div className="space-y-3 border-t border-slate-100 pt-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dynamic Parameters</span>
                    {matchedInd.dynamicParams.map(param => {
                      const currentVal = selectedBlock.params?.[param.key] ?? param.default
                      return (
                        <Field key={param.key} label={param.label}>
                          <select
                            value={currentVal}
                            onChange={e => onUpdate(selectedBlock.id, {
                              params: { ...(selectedBlock.params || {}), [param.key]: e.target.value },
                            })}
                            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs focus:outline-none focus:ring-1 focus:ring-nisr-navy/30"
                          >
                            {param.options.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </Field>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}

          {(selectedBlock.type === 'insight' || selectedBlock.type === 'recommendation') && (
            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase text-slate-500">Points Editor</span>
              <div className="space-y-2">
                {selectedBlock.points?.map((pt, pIdx) => (
                  <div key={pIdx} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={pt}
                      onChange={e => {
                        const next = [...(selectedBlock.points || [])]
                        next[pIdx] = e.target.value
                        onUpdate(selectedBlock.id, { points: next })
                      }}
                      className="flex-1 rounded border border-slate-200 bg-slate-50 p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-nisr-navy/30"
                    />
                    <button
                      type="button"
                      onClick={() => onUpdate(selectedBlock.id, {
                        points: selectedBlock.points?.filter((_, idx) => idx !== pIdx),
                      })}
                      className="rounded p-1.5 text-rose-500 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-300/50"
                      aria-label={`Delete point ${pIdx + 1}`}
                    >
                      <Trash className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onUpdate(selectedBlock.id, {
                  points: [...(selectedBlock.points || []), 'New bullet point…'],
                })}
                className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-slate-300 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/30"
              >
                <Plus className="h-3 w-3" />
                Add point
              </button>
            </div>
          )}

          <div className="space-y-1.5 border-t border-slate-100 pt-4">
            <span className="text-[10px] font-bold uppercase text-slate-500">Style</span>
            <select
              value={LAYOUT_PRESETS.find(p => p.className === selectedBlock.layoutClass)?.id ?? ''}
              onChange={e => {
                const preset = LAYOUT_PRESETS.find(p => p.id === e.target.value)
                if (preset) onUpdate(selectedBlock.id, { layoutClass: preset.className })
              }}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-nisr-navy/30"
            >
              {!LAYOUT_PRESETS.some(p => p.className === selectedBlock.layoutClass) && (
                <option value="" disabled>Custom</option>
              )}
              {LAYOUT_PRESETS.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <p className="text-[10px] leading-relaxed text-slate-400">Controls spacing, borders, and background.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5 p-4">
          <DocumentOutline blocks={allBlocks} onJump={onJump} activeId={activeSectionId} />
          <div className="mt-auto rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-center">
            <p className="text-[11px] font-semibold text-slate-600">No block selected</p>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
              Click any block to edit it inline, run AI actions on it, or ask the assistant to change it.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function canEditTitle(block: Block): boolean {
  return ['heading', 'chart', 'table', 'callout', 'insight', 'recommendation', 'executive_summary', 'methodology', 'references'].includes(block.type)
}

function canEditContent(block: Block): boolean {
  return ['heading', 'paragraph', 'callout', 'executive_summary', 'methodology', 'references'].includes(block.type)
}

function titlePlaceholder(type: Block['type']): string {
  const labels: Record<Block['type'], string> = {
    heading: 'Section title',
    paragraph: 'Paragraph',
    chart: 'Chart title',
    table: 'Table title',
    callout: 'Notice title',
    insight: 'Key insights',
    recommendation: 'Evidence-based recommendations',
    executive_summary: 'Executive summary',
    methodology: 'Methodology',
    references: 'References',
  }
  return labels[type]
}
