'use client'

import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import type { AgentMeta, AgentStatus } from '@/lib/report-builder/types'
import { ACCENT_CLASSES } from '@/lib/report-builder/agentMeta'
import { Icon } from './Icons'

interface AgentCardProps {
  meta: AgentMeta
  status: AgentStatus
  message?: string
  /** Pipeline index 0..7 — used to stagger the entrance animation. */
  index: number
  compact?: boolean
}

// One node in the multi-agent pipeline. The card has three visual states:
//  - waiting:  muted, dimmed icon, no ring
//  - working:  lit accent, shimmering ring, spinning loader, live message
//  - completed: check badge, soft accent wash, locked-in look
export default function AgentCard({ meta, status, message, index, compact }: AgentCardProps) {
  const accent = ACCENT_CLASSES[meta.accent]
  const isActive = status === 'working'
  const isDone = status === 'completed'
  const isError = status === 'error'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: 'easeOut' }}
      className={`relative flex ${compact ? 'flex-row items-center gap-2.5 p-2.5' : 'flex-col gap-2 p-3'} rounded-xl border transition-all duration-300 ${
        isActive
          ? `${accent.border} ${accent.bgSoft} shadow-elev-2`
          : isDone
            ? 'border-slate-200 bg-slate-50/70'
            : isError
              ? 'border-rose-200 bg-rose-50/80 shadow-elev-1'
              : 'border-slate-200/70 bg-white/60 opacity-65'
      }`}
    >
      {/* Active glow ring */}
      {isActive && (
        <span className={`pointer-events-none absolute inset-0 rounded-xl ring-2 ${accent.ring} animate-glow-pulse`} aria-hidden />
      )}

      <div className="relative flex items-start gap-2.5">
        {/* Icon tile */}
        <div
          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
            isActive
              ? `bg-gradient-to-br ${accent.gradient} text-white shadow-sm`
              : isDone
                ? `${accent.bgSoft} ${accent.text}`
                : 'bg-slate-100 text-slate-400'
          }`}
        >
          {isDone ? (
            <CheckCircle2 className="h-4.5 w-4.5" />
          ) : isError ? (
            <AlertTriangle className="h-4.5 w-4.5 text-rose-600" />
          ) : isActive ? (
            <Icon name={meta.icon} className="h-4.5 w-4.5" />
          ) : (
            <Icon name={meta.icon} className="h-4.5 w-4.5" />
          )}
          {isActive && (
            <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white shadow">
              <Loader2 className="h-2.5 w-2.5 animate-spin text-slate-700" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className={`truncate text-[11px] font-bold ${isActive ? 'text-slate-900' : isDone ? 'text-slate-700' : isError ? 'text-rose-800' : 'text-slate-500'}`}>
              {meta.name}
            </p>
          </div>
          <p className={`truncate text-[10px] font-medium ${isError ? 'text-rose-600' : 'text-slate-400'}`}>
            {isError ? message || 'Needs retry' : isActive ? message || meta.description : meta.role}
          </p>
        </div>
      </div>

      {/* Expanded live status for active cards */}
      {isActive && message && !compact && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="relative mt-1 rounded-lg bg-white/70 px-2.5 py-1.5 text-[10.5px] leading-relaxed text-slate-600 backdrop-blur-sm"
        >
          {message}
        </motion.p>
      )}

      {/* Shimmer band across the top while active */}
      {isActive && (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-t-xl">
          <span className="block h-full w-full bg-shimmer-band bg-[length:200%_100%] animate-shimmer" />
        </span>
      )}
    </motion.div>
  )
}
