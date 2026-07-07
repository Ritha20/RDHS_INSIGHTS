'use client'

import { useRef } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { REPORT_TEMPLATES } from '@/lib/report-builder/templates'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { Icon } from './Icons'

interface TemplatesGalleryProps {
  open: boolean
  onClose: () => void
  onChoose: (templateId: string) => void
}

// Modal shown over the empty canvas (and via the toolbar) letting users pick a
// starter template. Each choice maps to a hand-tuned block skeleton in
// lib/report-builder/templates.ts.
export default function TemplatesGallery({ open, onClose, onChoose }: TemplatesGalleryProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, open)
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm print:hidden"
      onClick={onClose}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="templates-dialog-title"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
        className="flex max-h-[88svh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-elev-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="templates-dialog-title" className="text-sm font-bold text-slate-900">Start from a template</h2>
            <p className="text-xs text-slate-500">Pick a structure to populate, or hand it to the AI agent.</p>
          </div>
          <button onClick={onClose} aria-label="Close templates" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 grid-cols-1 gap-3 overflow-y-auto p-6 sm:grid-cols-2">
          {REPORT_TEMPLATES.map((t, i) => (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onChoose(t.id)}
              className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-nisr-navy/30 hover:shadow-elev-2"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-nisr-navy to-nisr-cyan text-white shadow-sm">
                <Icon name={t.icon} className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-800 group-hover:text-nisr-navy">{t.name}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{t.description}</span>
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
