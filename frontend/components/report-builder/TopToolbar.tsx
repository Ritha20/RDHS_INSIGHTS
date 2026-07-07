'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Edit, Sparkles, Settings, Download, Eye, FileText, Play,
  FileSpreadsheet, FileJson, Code2, Undo2, Redo2, Focus, ZoomIn, ZoomOut,
  LayoutGrid, Command, Check, Loader2,
} from 'lucide-react'

interface TopToolbarProps {
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  undoCount: number
  redoCount: number
  zoom: number
  onZoom: (z: number) => void
  focusMode: boolean
  onToggleFocus: () => void
  onOpenSettings: () => void
  onOpenGallery: () => void
  onOpenPalette: () => void
  autosaveLabel: string | null
  autosaving: boolean
  // Export handlers
  onExportPDF: () => void
  onExportWord: () => void
  onExportHTML: () => void
  onExportPPTX: () => void
  onExportCSV: () => void
  onExportJSON: () => void
}

export default function TopToolbar(props: TopToolbarProps) {
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!exportOpen) return
    const onDown = (e: MouseEvent) => {
      if (!exportRef.current?.contains(e.target as Node)) setExportOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [exportOpen])

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
      {/* Left: mode segmented control + status */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-nisr-navy to-nisr-cyan px-3 py-2 text-[11px] font-bold text-white shadow-elev-1">
          <Sparkles className="h-3.5 w-3.5" />
          AI Agent
        </div>
        <div className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] text-slate-500 shadow-elev-1 md:flex">
          {props.autosaving ? (
            <><Loader2 className="h-3 w-3 animate-spin text-nisr-cyan" /> Saving…</>
          ) : props.autosaveLabel ? (
            <><Check className="h-3 w-3 text-emerald-500" /> Saved {props.autosaveLabel}</>
          ) : (
            <>Ready</>
          )}
        </div>
      </div>

      {/* Center: editing controls */}
      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-elev-1">
        <IconBtn onClick={props.onUndo} disabled={!props.canUndo} title={`Undo (${props.undoCount})`} >
          <Undo2 className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn onClick={props.onRedo} disabled={!props.canRedo} title={`Redo (${props.redoCount})`}>
          <Redo2 className="h-3.5 w-3.5" />
        </IconBtn>
        <Divider />
        <IconBtn onClick={() => props.onZoom(Math.max(0.6, props.zoom - 0.1))} title="Zoom out">
          <ZoomOut className="h-3.5 w-3.5" />
        </IconBtn>
        <button
          onClick={() => props.onZoom(1)}
          className="min-w-[3rem] rounded-md px-1 py-1 text-center text-[10px] font-bold text-slate-600 hover:bg-slate-100"
          title="Reset zoom"
        >
          {Math.round(props.zoom * 100)}%
        </button>
        <IconBtn onClick={() => props.onZoom(Math.min(1.5, props.zoom + 0.1))} title="Zoom in">
          <ZoomIn className="h-3.5 w-3.5" />
        </IconBtn>
        <Divider />
        <IconBtn onClick={props.onToggleFocus} active={props.focusMode} title="Focus / preview (⌘⇧F)">
          {props.focusMode ? <Focus className="h-3.5 w-3.5" /> : <Edit className="h-3.5 w-3.5" />}
        </IconBtn>
        <IconBtn onClick={props.onOpenGallery} title="Templates">
          <LayoutGrid className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn onClick={props.onOpenPalette} title="Command palette (⌘K)">
          <Command className="h-3.5 w-3.5" />
        </IconBtn>
        <Divider />
        <IconBtn onClick={props.onOpenSettings} title="API key settings">
          <Settings className="h-3.5 w-3.5" />
        </IconBtn>
      </div>

      {/* Right: export */}
      <div className="relative" ref={exportRef}>
        <button
          onClick={() => setExportOpen(o => !o)}
          aria-haspopup="menu"
          aria-expanded={exportOpen}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-nisr-navy to-nisr-navy-dark px-4 py-2 text-xs font-bold text-white shadow-elev-2 transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/40"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
        {exportOpen && (
          <motion.div
            role="menu"
            aria-label="Export report"
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 top-full z-50 mt-2 w-56 origin-top-left divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white py-1.5 shadow-elev-3"
          >
            <ExportGroup>
              <ExportItem icon={Eye} color="text-blue-500" label="PDF (Publication Quality)" onClick={() => { props.onExportPDF(); setExportOpen(false) }} />
              <ExportItem icon={FileText} color="text-blue-700" label="Microsoft Word (.doc)" onClick={() => { props.onExportWord(); setExportOpen(false) }} />
              <ExportItem icon={Code2} color="text-orange-500" label="Standalone HTML" onClick={() => { props.onExportHTML(); setExportOpen(false) }} />
            </ExportGroup>
            <ExportGroup>
              <ExportItem icon={Play} color="text-purple-500" label="Slide outline (.txt)" onClick={() => { props.onExportPPTX(); setExportOpen(false) }} />
              <ExportItem icon={FileSpreadsheet} color="text-emerald-600" label="Data Tables (CSV)" onClick={() => { props.onExportCSV(); setExportOpen(false) }} />
              <ExportItem icon={FileJson} color="text-indigo-500" label="JSON definition" onClick={() => { props.onExportJSON(); setExportOpen(false) }} />
            </ExportGroup>
          </motion.div>
        )}
      </div>
    </div>
  )
}

function IconBtn({ children, onClick, disabled, active, title }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean; title?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${
        active ? 'bg-nisr-sky text-nisr-navy' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-slate-200" />
}

function ExportGroup({ children }: { children: React.ReactNode }) {
  return <div className="py-1">{children}</div>
}

function ExportItem({ icon: IconCmp, color, label, onClick }: {
  icon: typeof Eye; color: string; label: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      role="menuitem"
      className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:bg-nisr-sky/60 focus:text-nisr-navy"
    >
      <IconCmp className={`h-3.5 w-3.5 ${color}`} />
      {label}
    </button>
  )
}
