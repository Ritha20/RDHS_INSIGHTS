'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Terminal, ArrowRight } from 'lucide-react'
import type { AgentStep } from '@/lib/report-builder/types'
import { AGENT_PIPELINE } from '@/lib/report-builder/agentMeta'
import AgentCard from './AgentCard'

interface AgentMissionControlProps {
  steps: AgentStep[]
  /** Newest activity line, mirrored into the terminal log. */
  liveMessage?: string
  isGenerating: boolean
}

interface LogLine {
  id: string
  text: string
  ts: number
}

// The premium multi-agent collaboration view. Replaces the old generic 4×2
// status grid with: a progress ring, a horizontal stage flow, expanded live
// agent cards, and a streaming terminal log.
export default function AgentMissionControl({ steps, liveMessage, isGenerating }: AgentMissionControlProps) {
  const stepById = useMemo(() => {
    const m = new Map<string, AgentStep>()
    steps.forEach(s => m.set(s.id, s))
    return m
  }, [steps])

  const completedCount = steps.filter(s => s.status === 'completed').length
  const total = steps.length
  const progress = total ? completedCount / total : 0

  // Rolling terminal log — appends a timestamped line whenever `liveMessage`
  // changes to a non-empty value we haven't logged yet.
  const [log, setLog] = useState<LogLine[]>([])
  const lastLogged = useRef<string>('')
  const logRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!liveMessage || liveMessage === lastLogged.current) return
    lastLogged.current = liveMessage
    setLog(prev => [...prev.slice(-40), {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: liveMessage,
      ts: Date.now(),
    }])
  }, [liveMessage])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [log])

  // Reset the log when a new run kicks off.
  useEffect(() => {
    if (isGenerating && steps.every(s => s.status === 'waiting')) {
      setLog([])
      lastLogged.current = ''
    }
  }, [isGenerating, steps])

  const activeStep = steps.find(s => s.status === 'working')

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="mb-6 overflow-hidden rounded-2xl border border-nisr-navy/10 bg-gradient-to-br from-white via-white to-nisr-sky/30 shadow-elev-2 print:hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white/60 px-5 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-nisr-navy to-nisr-navy-dark text-white shadow-sm">
            <Bot className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-nisr-cyan ring-2 ring-white" />
          </span>
          <div>
            <p className="text-xs font-bold text-slate-900">Multi-Agent Collaboration</p>
            <p className="text-[10px] text-slate-500">A team of {total} specialized agents is building your report</p>
          </div>
        </div>
        <ProgressRing value={progress} count={`${completedCount}/${total}`} />
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {/* Stage flow — horizontal on wide screens, wraps on narrow */}
        <div className="flex flex-wrap items-center gap-1.5">
          {AGENT_PIPELINE.map((meta, i) => {
            const st = stepById.get(meta.id)?.status ?? 'waiting'
            const next = AGENT_PIPELINE[i + 1]
            const nextDone = next ? (stepById.get(next.id)?.status === 'completed') : false
            return (
              <div key={meta.id} className="flex items-center">
                <StagePill meta={meta} status={st} index={i} />
                {next && (
                  <Connector done={nextDone} active={st === 'working'} />
                )}
              </div>
            )
          })}
        </div>

        {/* Expanded agent cards */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {AGENT_PIPELINE.map((meta, i) => {
            const st = stepById.get(meta.id)
            return (
              <AgentCard
                key={meta.id}
                meta={meta}
                status={st?.status ?? 'waiting'}
                message={st?.message}
                index={i}
              />
            )
          })}
        </div>

        {/* Terminal log */}
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-inner">
          <div className="flex items-center gap-1.5 border-b border-slate-800 px-3 py-1.5">
            <Terminal className="h-3 w-3 text-nisr-cyan-light" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">Agent Activity</span>
            <span className="ml-auto flex items-center gap-1 text-[9px] text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              LIVE
            </span>
          </div>
          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-label="Agent activity log"
            className="h-24 overflow-y-auto scroll-thin px-3 py-2 font-mono text-[10.5px] leading-relaxed"
          >
            <AnimatePresence initial={false}>
              {log.length === 0 && (
                <p className="text-slate-500">
                  <span className="text-nisr-cyan-light">&gt;</span> Coordinating the agent team…
                </p>
              )}
              {log.map(line => (
                <motion.div
                  key={line.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-2"
                >
                  <span className="shrink-0 text-slate-600">{fmtClock(line.ts)}</span>
                  <span className="text-nisr-cyan-light">&gt;</span>
                  <span className="text-slate-200">{line.text}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {activeStep?.message && (
          <motion.p
            key={activeStep.message}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-[11px] font-medium text-slate-500"
          >
            <span className="font-semibold text-slate-700">{activeStep.message}</span>
          </motion.p>
        )}
      </div>
    </motion.div>
  )
}

/** Compact pill for the horizontal stage flow. */
function StagePill({ meta, status, index }: { meta: typeof AGENT_PIPELINE[number]; status: AgentStep['status']; index: number }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03 }}
      title={`${meta.name} · ${meta.role}`}
      className={`relative flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all ${
        status === 'working'
          ? 'border-transparent bg-gradient-to-r from-nisr-navy to-nisr-cyan text-white shadow-sm'
          : status === 'completed'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-slate-200 bg-white text-slate-400'
      }`}
    >
      {status === 'completed' ? (
        <CheckBadge />
      ) : status === 'working' ? (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
      )}
      <span className="hidden sm:inline">{meta.role}</span>
      <span className="sm:hidden">{meta.role.slice(0, 3)}</span>
    </motion.div>
  )
}

function CheckBadge() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 fill-emerald-600">
      <path d="M12 2l2.4 1.8 3 .2.9 2.9 2.4 1.8-.9 2.9.9 2.9-2.4 1.8-.9 2.9-3 .2L12 22l-2.4-1.8-3-.2-.9-2.9L3.3 15.3l.9-2.9-.9-2.9 2.4-1.8.9-2.9 3-.2L12 2zm-1.2 13.4l5-5-1.4-1.4-3.6 3.6-1.6-1.6L7.8 12l3 3.4z" />
    </svg>
  )
}

/** Animated dashed connector between stage pills. */
function Connector({ done, active }: { done: boolean; active: boolean }) {
  return (
    <ArrowRight
      className={`mx-0.5 h-3 w-3 shrink-0 transition-colors ${
        done ? 'text-emerald-400' : active ? 'text-nisr-cyan' : 'text-slate-300'
      }`}
    />
  )
}

/** Circular SVG progress ring with the completed/total count in the middle. */
function ProgressRing({ value, count }: { value: number; count: string }) {
  const r = 16
  const c = 2 * Math.PI * r
  const offset = c * (1 - value)
  return (
    <div
      className="relative h-11 w-11 shrink-0"
      role="progressbar"
      aria-label="Report generation progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
    >
      <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-200" />
        <motion.circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0099D4" />
            <stop offset="100%" stopColor="#1B3C74" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-700">
        {count}
      </span>
    </div>
  )
}

function fmtClock(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}
