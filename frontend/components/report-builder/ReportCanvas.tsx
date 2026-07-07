'use client'

import { useCallback, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FileText, Plus, Loader2, Sparkles } from 'lucide-react'
import type { Block } from '@/lib/report-builder/types'
import BlockItem from './BlockItem'
import ReportHeader from './ReportHeader'
import type { ReportMeta } from '@/lib/report-builder/types'

interface ReportCanvasProps {
  blocks: Block[]
  meta: ReportMeta
  zoom: number
  isGenerating: boolean
  focusMode: boolean
  selectedBlockId: string | null
  landedIds: string[]
  runningAction: { blockId: string; action: string } | null
  onMetaChange: (patch: Partial<ReportMeta>) => void
  onSelect: (id: string | null) => void
  onMove: (index: number, dir: 'up' | 'down') => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onReorder: (from: number, to: number) => void
  onUpdate: (id: string, patch: Partial<Block>) => void
  onRunAction: (blockId: string, action: string) => void
  onOpenGallery: () => void
}

// The editable document surface. Owns the drag-and-drop reordering state and
// renders the report title page (ReportHeader) above the block list.
export default function ReportCanvas(props: ReportCanvasProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const handleDragStart = useCallback((i: number) => setDragIndex(i), [])
  const handleDragEnter = useCallback((i: number) => setDropIndex(i), [])
  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      props.onReorder(dragIndex, dropIndex)
    }
    setDragIndex(null)
    setDropIndex(null)
  }, [dragIndex, dropIndex, props])

  const isEmpty = props.blocks.length === 0 && !props.isGenerating
  const isBootstrapping = props.blocks.length === 0 && props.isGenerating

  return (
    <div className="flex-1 overflow-y-auto scroll-thin bg-slate-100/60 p-3 pb-24 sm:p-6 sm:pb-6 print:overflow-visible print:bg-white print:p-0">
      <div
        className="mx-auto w-full max-w-[850px] origin-top transition-transform duration-200 print:scale-100"
        style={{ transform: props.focusMode ? 'none' : `scale(${props.zoom})` }}
      >
        <div className="relative min-h-[297mm] rounded-2xl border border-slate-200 bg-white p-5 shadow-elev-3 sm:p-12 print:min-h-0 print:rounded-none print:border-none print:p-0 print:shadow-none">
          <ReportHeader meta={props.meta} onChange={props.onMetaChange} />

          {isBootstrapping ? (
            <GeneratingCanvas />
          ) : isEmpty ? (
            <EmptyCanvas onOpenGallery={props.onOpenGallery} />
          ) : (
            <div className="space-y-1">
              <AnimatePresence initial={false}>
                {props.blocks.map((block, index) => (
                  <div key={block.id} id={`block-${block.id}`}>
                    <BlockItem
                      block={block}
                      index={index}
                      isFirst={index === 0}
                      isLast={index === props.blocks.length - 1}
                      isSelected={block.id === props.selectedBlockId}
                      justLanded={props.landedIds.includes(block.id)}
                      onSelect={props.onSelect}
                      onMove={props.onMove}
                      onDelete={props.onDelete}
                      onDuplicate={props.onDuplicate}
                      onDragStart={handleDragStart}
                      onDragEnter={handleDragEnter}
                      onDragEnd={handleDragEnd}
                      isDragging={dragIndex === index}
                      isDropTarget={dropIndex === index && dragIndex !== index}
                      onRunAction={props.onRunAction}
                      runningAction={props.runningAction}
                      updateBlock={props.onUpdate}
                    />
                  </div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Footer: add block affordance */}
          {!isEmpty && !props.focusMode && (
            <button
              onClick={props.onOpenGallery}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2.5 text-xs font-semibold text-slate-400 transition-colors hover:border-nisr-navy/40 hover:bg-slate-50 hover:text-slate-600 print:hidden"
            >
              <Plus className="h-3.5 w-3.5" />
              Add a block
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyCanvas({ onOpenGallery }: { onOpenGallery: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-nisr-navy to-nisr-cyan text-white shadow-elev-3"
      >
        <FileText className="h-7 w-7" />
      </motion.div>
      <p className="text-sm font-bold text-slate-700">Your canvas is empty</p>
      <p className="mt-1 max-w-xs text-xs text-slate-400">
        Pick a starter template, add blocks manually, or describe your report to the AI agent.
      </p>
      <button
        onClick={onOpenGallery}
        className="mt-4 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-nisr-navy to-nisr-cyan px-4 py-2 text-xs font-bold text-white shadow-elev-2 transition-transform hover:-translate-y-0.5"
      >
        <Plus className="h-3.5 w-3.5" />
        Browse templates
      </button>
    </div>
  )
}

function GeneratingCanvas() {
  return (
    <div className="py-8" role="status" aria-live="polite">
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-nisr-cyan/20 bg-nisr-sky/50 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-nisr-navy shadow-elev-1">
          <Loader2 className="h-5 w-5 animate-spin" />
        </span>
        <div>
          <p className="text-sm font-bold text-slate-900">Building the first draft</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            Agents are selecting indicators, querying data, and drafting editable report blocks.
          </p>
        </div>
      </div>

      <div className="space-y-5" aria-hidden="true">
        <div className="space-y-2">
          <div className="h-4 w-48 rounded-full bg-slate-200 shimmer-surface" />
          <div className="h-3 w-full max-w-[620px] rounded-full bg-slate-100 shimmer-surface" />
          <div className="h-3 w-5/6 rounded-full bg-slate-100 shimmer-surface" />
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="h-3 w-44 rounded-full bg-slate-200 shimmer-surface" />
            <Sparkles className="h-4 w-4 text-nisr-cyan" />
          </div>
          <div className="grid h-48 grid-cols-5 items-end gap-3">
            {[46, 68, 54, 82, 61].map((h, i) => (
              <div key={i} className="rounded-t-lg bg-nisr-sky shimmer-surface" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-24 rounded-2xl bg-slate-50 shimmer-surface" />
          <div className="h-24 rounded-2xl bg-slate-50 shimmer-surface" />
        </div>
      </div>
    </div>
  )
}
