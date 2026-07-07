'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Send, Loader2, Bot, User, Plus, Square } from 'lucide-react'
import type { ChatMessage, AgentStep } from '@/lib/report-builder/types'
import { AGENT_PIPELINE, ACCENT_CLASSES } from '@/lib/report-builder/agentMeta'
import { Icon } from './Icons'

interface ChatPanelProps {
  messages: ChatMessage[]
  input: string
  onInputChange: (v: string) => void
  onSend: () => void
  /** Abort the in-flight generation/refinement. */
  onStop?: () => void
  isGenerating: boolean
  /** A lighter "refine" round is in flight. */
  isRefining?: boolean
  /** Live pipeline state — rendered as an in-chat progress card while generating. */
  agentSteps: AgentStep[]
  reportStarted: boolean
  suggestions: string[]
  onSuggestion: (s: string) => void
  onNewReport: () => void
}

// The left-rail conversational assistant. Refined from the original: avatars,
// animated typing indicator, gradient send button, restyled suggestion cards.
export default function ChatPanel(props: ChatPanelProps) {
  const endRef = useRef<HTMLDivElement>(null)
  const busy = props.isGenerating || !!props.isRefining
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [props.messages, props.agentSteps])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-nisr-navy to-nisr-cyan text-white shadow-sm">
            <Bot className="h-3.5 w-3.5" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-white" />
          </span>
          <div>
            <p className="text-xs font-bold text-slate-800">AI Report Assistant</p>
            <p className="text-[10px] text-slate-500">Powered by a team of specialist agents</p>
          </div>
        </div>
        {props.reportStarted && (
          <button
            onClick={props.onNewReport}
            disabled={busy}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-nisr-navy disabled:opacity-40"
          >
            <Plus className="h-3 w-3" />
            New
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3" aria-live="polite">
        {props.messages.map(m => {
          // While the agents run, the live progress card (below) replaces the
          // plain pending status bubble, so skip it to avoid duplication.
          if (m.role === 'assistant' && m.pending && props.isGenerating) return null
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-nisr-navy to-nisr-cyan text-white">
                  <Sparkles className="h-3 w-3" />
                </span>
              )}
              <div
                className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'rounded-br-sm bg-nisr-navy text-white'
                    : 'rounded-bl-sm border border-slate-100 bg-slate-50 text-slate-700'
                }`}
              >
                {m.role === 'assistant' && m.pending && (
                  <span className="mb-1 flex items-center gap-1">
                    <TypingDots />
                  </span>
                )}
                {m.text}
              </div>
              {m.role === 'user' && (
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-600">
                  <User className="h-3 w-3" />
                </span>
              )}
            </motion.div>
          )
        })}

        {/* Live agent progress — shown inside the conversation while the
            multi-agent pipeline builds the report. */}
        <AnimatePresence>
          {props.isGenerating && (
            <motion.div
              key="agent-progress"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="flex gap-2"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-nisr-navy to-nisr-cyan text-white">
                <Sparkles className="h-3 w-3" />
              </span>
              <div className="min-w-0 flex-1">
                <AgentProgressCard steps={props.agentSteps} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      <AnimatePresence>
        {!props.reportStarted && !busy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex shrink-0 flex-wrap gap-1.5 px-3 pb-2"
          >
            {props.suggestions.map(s => (
              <button
                key={s}
                onClick={() => props.onSuggestion(s)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-left text-[10px] text-slate-600 transition-all hover:border-nisr-cyan/40 hover:bg-nisr-sky/40 hover:text-nisr-navy"
              >
                {s}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="shrink-0 border-t border-slate-100 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={props.input}
            onChange={e => props.onInputChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                props.onSend()
              }
            }}
            disabled={busy}
            placeholder={props.reportStarted ? 'Tell me what to change…' : 'Describe the report you want…'}
            rows={2}
            className="scroll-thin flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-nisr-navy/40 disabled:opacity-60"
          />
          {busy ? (
            <button
              onClick={props.onStop}
              aria-label={props.isRefining ? 'Stop update' : 'Stop generation'}
              title={props.isRefining ? 'Stop update' : 'Stop generation'}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-300/50"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={props.onSend}
              disabled={busy || !props.input.trim()}
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-nisr-navy to-nisr-cyan text-white shadow-elev-2 transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/40 disabled:translate-y-0 disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none"
              title="Send"
            >
              {props.isRefining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          )}
        </div>
        <p className="mt-1.5 text-center text-[10px] text-slate-500">
          {busy ? 'Press Stop to cancel the active AI request' : 'Enter to send · Shift+Enter for a new line'}
        </p>
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="h-1 w-1 rounded-full bg-nisr-cyan"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  )
}

// The backend live messages are prefixed with the agent name, e.g.
// "Planning Agent: Designing report structure…". We show the agent name
// separately, so strip the prefix for a cleaner action line.
function stripAgentPrefix(msg?: string): string {
  if (!msg) return ''
  const idx = msg.indexOf(':')
  return idx > -1 && idx < 42 ? msg.slice(idx + 1).trim() : msg
}

// Polished, compact in-chat view of the multi-agent pipeline: a progress bar,
// the currently-active agent + its live action, and an 8-segment stage tracker.
// Replaces the old full-width mission-control panel that sat on the canvas.
function AgentProgressCard({ steps }: { steps: AgentStep[] }) {
  const byId = new Map(steps.map(s => [s.id, s]))
  const total = steps.length || AGENT_PIPELINE.length
  const completed = steps.filter(s => s.status === 'completed').length
  const pct = Math.round((completed / (total || 1)) * 100)
  const active = steps.find(s => s.status === 'working')
  const activeMeta = active ? AGENT_PIPELINE.find(a => a.id === active.id) : null
  const accent = ACCENT_CLASSES[activeMeta?.accent ?? 'cyan'] ?? ACCENT_CLASSES.cyan

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-elev-1">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-nisr-sky/50 to-white px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-nisr-navy to-nisr-cyan text-white">
            <Sparkles className="h-3 w-3" />
          </span>
          <span className="text-[11px] font-bold text-slate-800">Building your report</span>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-nisr-navy shadow-sm ring-1 ring-slate-200">
          {completed}/{total}
        </span>
      </div>

      <div className="px-3 py-2.5">
        <div className="mb-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-nisr-navy to-nisr-cyan"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {activeMeta ? (
          <div className="flex items-start gap-2">
            <span className={`relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${accent.bgSoft} ${accent.text}`}>
              <Icon name={activeMeta.icon} className="h-3.5 w-3.5" />
              <span className={`absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full ${accent.dot} ring-2 ring-white`} />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate text-[11px] font-bold text-slate-800">
                {activeMeta.name}
                <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">· {activeMeta.role}</span>
              </p>
              <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
                {stripAgentPrefix(active?.message) || activeMeta.description}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <TypingDots /> Coordinating the agent team…
          </div>
        )}

        <div className="mt-3 flex items-center gap-1">
          {AGENT_PIPELINE.map(meta => {
            const st = byId.get(meta.id)?.status ?? 'waiting'
            return (
              <span
                key={meta.id}
                title={`${meta.name} · ${meta.role}`}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  st === 'completed'
                    ? 'bg-emerald-400'
                    : st === 'working'
                      ? `${accent.bg} animate-pulse`
                      : 'bg-slate-200'
                }`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
