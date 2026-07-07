'use client'

import { memo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronUp, ChevronDown, Trash, GripVertical, Copy, CopyCheck,
  BarChart3, MousePointer2,
} from 'lucide-react'
import ReportChart from '../charts/ReportChart'
import type { IndicatorStats } from '../charts/ReportChart'
import type { Block } from '@/lib/report-builder/types'
import AIActionMenu from './AIActionMenu'

// Re-export the Block type so existing deep imports (`import type { Block } from
// './BlockItem'`) keep resolving after the type moved to lib/report-builder.
export type { Block } from '@/lib/report-builder/types'
export type { IndicatorStats } from '../charts/ReportChart'

interface BlockItemProps {
  block: Block
  index: number
  isFirst: boolean
  isLast: boolean
  isSelected: boolean
  /** Highlight pulse when an AI agent just produced this block. */
  justLanded?: boolean
  onSelect: (id: string) => void
  onMove: (index: number, direction: 'up' | 'down') => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  /** Drag-and-drop callbacks wired by the canvas. */
  onDragStart: (index: number) => void
  onDragEnter: (index: number) => void
  onDragEnd: () => void
  isDragging: boolean
  isDropTarget: boolean
  onRunAction: (blockId: string, action: string) => void
  runningAction: { blockId: string; action: string } | null
  updateBlock: (id: string, updated: Partial<Block>) => void
}

function BlockItemImpl({
  block, index, isFirst, isLast, isSelected, justLanded,
  onSelect, onMove, onDelete, onDuplicate,
  onDragStart, onDragEnter, onDragEnd, isDragging, isDropTarget,
  onRunAction, runningAction, updateBlock,
}: BlockItemProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const isThisRunning = runningAction?.blockId === block.id
  const isAnyRunning = runningAction !== null

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDuplicate(block.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      onDragEnter={(e) => { e.preventDefault(); onDragEnter(index) }}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(block.id)}
      className={`group relative rounded-xl px-4 py-3 transition-colors ${
        isDragging ? 'opacity-40' : ''
      } ${
        isSelected
          ? 'border border-nisr-cyan/40 bg-nisr-sky/30 shadow-sm'
          : justLanded
            ? 'border border-emerald-300 bg-emerald-50/40'
            : 'border border-transparent hover:border-slate-200/60 hover:bg-slate-50/50'
      }`}
    >
      {/* Drop indicator line */}
      {isDropTarget && (
        <span className="absolute -top-0.5 left-2 right-2 h-0.5 rounded-full bg-nisr-cyan shadow-[0_0_8px_rgba(0,153,212,0.6)]" />
      )}

      {/* Drag handle (always visible on touch, hover otherwise) */}
      <button
        onClick={(e) => e.stopPropagation()}
        draggable
        onDragStart={(e) => {
          e.stopPropagation()
          e.dataTransfer.effectAllowed = 'move'
          onDragStart(index)
        }}
        onDragEnd={(e) => {
          e.stopPropagation()
          onDragEnd()
        }}
        title="Drag to reorder"
        className="absolute -left-1 top-1/2 flex -translate-y-1/2 cursor-grab touch-none rounded p-0.5 text-slate-300 opacity-100 transition-all hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/30 active:cursor-grabbing sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 print:hidden"
        aria-label="Drag handle"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Hover controls (hidden during print) — forced visible while the AI
          menu is open so it doesn't vanish out from under the cursor. */}
      <div className={`absolute right-2 -top-3 flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 opacity-100 shadow-elev-2 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 print:hidden ${
        menuOpen ? 'sm:opacity-100' : ''
      }`}>
        <button
          onClick={(e) => { e.stopPropagation(); onMove(index, 'up') }}
          disabled={isFirst}
          className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/30 disabled:opacity-30"
          title="Move up"
          aria-label="Move block up"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMove(index, 'down') }}
          disabled={isLast}
          className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/30 disabled:opacity-30"
          title="Move down"
          aria-label="Move block down"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleDuplicate}
          className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/30"
          title="Duplicate block"
          aria-label="Duplicate block"
        >
          {copied ? <CopyCheck className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(block.id) }}
          className="rounded p-1 text-rose-500 transition-colors hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-300/50"
          title="Delete block"
          aria-label="Delete block"
        >
          <Trash className="h-3.5 w-3.5" />
        </button>

        <div className="mx-1 h-4 w-px bg-slate-200" />
        <div onClick={(e) => e.stopPropagation()}>
          <AIActionMenu
            isAnyRunning={isAnyRunning}
            isThisRunning={isThisRunning}
            onRun={(action) => onRunAction(block.id, action)}
          />
        </div>
      </div>

      <BlockBody block={block} updateBlock={updateBlock} />
    </motion.div>
  )
}

/** Renders the editable body of a block by type. Extracted so the hover
 *  chrome re-renders don't tear through the inputs. */
function BlockBody({ block, updateBlock }: { block: Block; updateBlock: (id: string, u: Partial<Block>) => void }) {
  if (block.type === 'heading') {
    return (
      <div className={block.layoutClass}>
        <input
          type="text"
          aria-label="Heading title"
          value={block.title ?? ''}
          onChange={e => updateBlock(block.id, { title: e.target.value })}
          placeholder="Heading title"
          className="w-full rounded border-none bg-transparent py-0.5 text-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/25"
        />
        <input
          type="text"
          aria-label="Heading subtitle"
          value={block.content ?? ''}
          onChange={e => updateBlock(block.id, { content: e.target.value })}
          placeholder="Subtitle details…"
          className="mt-0.5 w-full rounded border-none bg-transparent py-0.5 text-xs text-slate-500 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/25"
        />
      </div>
    )
  }

  if (block.type === 'paragraph') {
    return (
      <div className={block.layoutClass}>
        <textarea
          aria-label="Paragraph content"
          value={block.content ?? ''}
          onChange={e => updateBlock(block.id, { content: e.target.value })}
          placeholder="Write your analysis narrative…"
          className="min-h-[40px] w-full resize-y rounded border-none bg-transparent py-1 text-sm leading-relaxed text-slate-600 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/25"
        />
      </div>
    )
  }

  if (block.type === 'executive_summary') {
    return (
      <div className={block.layoutClass}>
        <input
          type="text"
          aria-label="Executive summary title"
          value={block.title ?? ''}
          onChange={e => updateBlock(block.id, { title: e.target.value })}
          placeholder="Executive Summary"
          className="mb-1.5 w-full rounded border-none bg-transparent py-0.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/25"
        />
        <textarea
          aria-label="Executive summary content"
          value={block.content ?? ''}
          onChange={e => updateBlock(block.id, { content: e.target.value })}
          placeholder="Enter executive summary text…"
          className="min-h-[60px] w-full resize-y rounded border-none bg-transparent text-sm leading-relaxed text-slate-600 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/25"
        />
      </div>
    )
  }

  if (block.type === 'callout') {
    return (
      <div className={block.layoutClass}>
        <input
          type="text"
          aria-label="Callout title"
          value={block.title ?? ''}
          onChange={e => updateBlock(block.id, { title: e.target.value })}
          placeholder="Attention Notice"
          className="mb-1.5 w-full rounded border-none bg-transparent py-0.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/25"
        />
        <textarea
          aria-label="Callout content"
          value={block.content ?? ''}
          onChange={e => updateBlock(block.id, { content: e.target.value })}
          placeholder="Enter callout info text…"
          className="min-h-[40px] w-full resize-y rounded border-none bg-transparent text-sm leading-relaxed text-slate-600 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/25"
        />
      </div>
    )
  }

  if (block.type === 'insight') {
    return (
      <div className={block.layoutClass}>
        <input
          type="text"
          aria-label="Insight title"
          value={block.title ?? ''}
          onChange={e => updateBlock(block.id, { title: e.target.value })}
          placeholder="Key Insights"
          className="mb-2 w-full rounded border-none bg-transparent text-sm font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300/40"
        />
        <ul className="list-disc space-y-1.5 pl-5 text-xs text-blue-800">
          {block.points?.map((pt, pIdx) => (
            <li key={pIdx}>
              <input
                type="text"
                aria-label={`Insight point ${pIdx + 1}`}
                value={pt}
                onChange={e => {
                  const updatedPoints = [...(block.points || [])]
                  updatedPoints[pIdx] = e.target.value
                  updateBlock(block.id, { points: updatedPoints })
                }}
                className="w-[95%] rounded border-none bg-transparent py-0.5 text-xs font-medium text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-300/40"
              />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (block.type === 'recommendation') {
    return (
      <div className={block.layoutClass}>
        <input
          type="text"
          aria-label="Recommendation title"
          value={block.title ?? ''}
          onChange={e => updateBlock(block.id, { title: e.target.value })}
          placeholder="Evidence-Based Recommendations"
          className="mb-2 w-full rounded border-none bg-transparent text-sm font-bold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
        />
        <ul className="list-decimal space-y-1.5 pl-5 text-xs text-emerald-800">
          {block.points?.map((pt, pIdx) => (
            <li key={pIdx}>
              <input
                type="text"
                aria-label={`Recommendation point ${pIdx + 1}`}
                value={pt}
                onChange={e => {
                  const updatedPoints = [...(block.points || [])]
                  updatedPoints[pIdx] = e.target.value
                  updateBlock(block.id, { points: updatedPoints })
                }}
                className="w-[95%] rounded border-none bg-transparent py-0.5 text-xs font-medium text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
              />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (block.type === 'chart' && block.indicatorId) {
    return (
      <div className={block.layoutClass}>
        <input
          type="text"
          aria-label="Chart title"
          value={block.title ?? ''}
          onChange={e => updateBlock(block.id, { title: e.target.value })}
          placeholder="Chart title"
          className="mb-3 w-full rounded border-none bg-transparent text-center text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/25"
        />
        <ReportChart
          indicatorId={block.indicatorId}
          chartType={block.chartType || 'bar'}
          params={block.params}
          prefetched={block.stats as IndicatorStats | undefined}
        />
      </div>
    )
  }

  if (block.type === 'table' && block.indicatorId) {
    return (
      <div className={block.layoutClass}>
        <input
          type="text"
          aria-label="Table title"
          value={block.title ?? ''}
          onChange={e => updateBlock(block.id, { title: e.target.value })}
          placeholder="Table title"
          className="mb-3 w-full rounded border-none bg-transparent text-center text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/25"
        />
        <ReportChart
          indicatorId={block.indicatorId}
          chartType="table"
          params={block.params}
          prefetched={block.stats as IndicatorStats | undefined}
        />
      </div>
    )
  }

  if ((block.type === 'chart' || block.type === 'table') && !block.indicatorId) {
    return (
      <EmptyDataBlock
        kind={block.type}
        title={block.title ?? ''}
        onTitleChange={title => updateBlock(block.id, { title })}
      />
    )
  }

  if (block.type === 'methodology') {
    return (
      <div className={block.layoutClass}>
        <input
          type="text"
          aria-label="Methodology title"
          value={block.title ?? ''}
          onChange={e => updateBlock(block.id, { title: e.target.value })}
          placeholder="Methodology"
          className="mb-1 w-full rounded border-none bg-transparent text-[10px] font-bold uppercase text-slate-500 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/25"
        />
        <textarea
          aria-label="Methodology content"
          value={block.content ?? ''}
          onChange={e => updateBlock(block.id, { content: e.target.value })}
          placeholder="Technical notes…"
          rows={2}
          className="w-full resize-none rounded border-none bg-transparent text-[10px] text-slate-500 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/25"
        />
      </div>
    )
  }

  if (block.type === 'references') {
    return (
      <div className={block.layoutClass}>
        <input
          type="text"
          aria-label="References title"
          value={block.title ?? ''}
          onChange={e => updateBlock(block.id, { title: e.target.value })}
          placeholder="References"
          className="mb-1 w-full rounded border-none bg-transparent text-[10px] font-bold uppercase text-slate-500 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/25"
        />
        <textarea
          aria-label="References content"
          value={block.content ?? ''}
          onChange={e => updateBlock(block.id, { content: e.target.value })}
          placeholder="Add reference urls or documents…"
          rows={2}
          className="w-full resize-none rounded border-none bg-transparent text-[10px] text-slate-500 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/25"
        />
      </div>
    )
  }

  return null
}

function EmptyDataBlock({ kind, title, onTitleChange }: {
  kind: 'chart' | 'table'
  title: string
  onTitleChange: (title: string) => void
}) {
  return (
    <div className="my-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-5 text-center">
      <input
        type="text"
        aria-label={`${kind} title`}
        value={title}
        onChange={e => onTitleChange(e.target.value)}
        placeholder={kind === 'chart' ? 'Untitled chart' : 'Untitled table'}
        className="mb-3 w-full rounded border-none bg-transparent text-center text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/25"
      />
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-nisr-navy shadow-elev-1">
        <BarChart3 className="h-5 w-5" />
      </div>
      <p className="text-xs font-bold text-slate-700">Choose an indicator to render this {kind}</p>
      <p className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-slate-500">
        Select this block, then use the Inspector to pick a DHS indicator, visualization, and parameters.
      </p>
      <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500">
        <MousePointer2 className="h-3 w-3 text-nisr-cyan-dark" />
        Inspector opens from the right panel or mobile dock
      </span>
    </div>
  )
}

// `block` keeps referential equality for every sibling that wasn't the target
// of an edit (see updateBlock in ReportBuilderClient), so memoizing here means
// typing in one paragraph no longer re-renders every chart on the canvas.
const BlockItem = memo(BlockItemImpl)
export default BlockItem
