'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Sparkles, Settings, X,
  LayoutGrid, SlidersHorizontal,
} from 'lucide-react'
import { CHAPTERS } from '@/lib/chapters'
import Header from '../layout/Header'
import { useReportHistory } from '@/hooks/useReportHistory'
import { useAutosave } from '@/hooks/useAutosave'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useActiveSection } from './DocumentOutline'
import {
  AGENT_IDS, AGENT_PIPELINE,
} from '@/lib/report-builder/agentMeta'
import {
  DEFAULT_BLOCKS, DEFAULT_REPORT_META, REPORT_TEMPLATES,
} from '@/lib/report-builder/templates'
import type {
  AgentStep, Block, BlockType, ChatMessage, ReportMeta,
} from '@/lib/report-builder/types'
import { ToastProvider, useToast } from './Toaster'
import TopToolbar from './TopToolbar'
import ReportCanvas from './ReportCanvas'
import ChatPanel from './ChatPanel'
import PropertiesPanel from './PropertiesPanel'
import TemplatesGallery from './TemplatesGallery'
import CommandPalette, { type CommandItem } from './CommandPalette'

// The pipeline status values the backend emits — see the SSE contract in
// backend/rdhs_viz/routers/report_builder.py. Each non-terminal status implies
// the preceding stages are complete.
const PREV_STEPS: Record<string, string[]> = {
  discovery: ['planning'],
  analysis: ['planning', 'discovery'],
  visualization: ['planning', 'discovery', 'analysis'],
  narrative: ['visualization'],
  insights: ['narrative'],
  recommendation: ['insights'],
  qa: ['recommendation'],
}

const CHAT_SUGGESTIONS = [
  'Child nutrition & stunting, highlight Southern Province',
  'Mobile phone ownership: urban vs rural',
  'Malaria & ITN usage across provinces',
]

const INITIAL_STEPS: AgentStep[] = AGENT_PIPELINE.map(a => ({ id: a.id, status: 'waiting' as const }))

function ReportBuilderInner() {
  // --- core state ---------------------------------------------------------
  const history = useReportHistory<Block[]>(DEFAULT_BLOCKS)
  const { present: blocks, set: setBlocks, silentSet, undo, redo, reset, canUndo, canRedo, undoCount, redoCount } = history
  const blocksRef = useRef(blocks)
  blocksRef.current = blocks

  const [meta, setMeta] = useState<ReportMeta>(DEFAULT_REPORT_META)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [focusMode, setFocusMode] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<'workspace' | 'inspector' | null>(null)
  const [nvapiKey, setNvapiKey] = useState('')

  // --- AI pipeline state --------------------------------------------------
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRefining, setIsRefining] = useState(false)
  const [reportStarted, setReportStarted] = useState(false)
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>(INITIAL_STEPS)
  const [runningAction, setRunningAction] = useState<{ blockId: string; action: string } | null>(null)
  const [landedIds, setLandedIds] = useState<string[]>([])
  // Abort controller for the in-flight SSE generation, and a stalled-stream
  // watchdog so a dead connection doesn't look like an infinitely-slow model.
  const abortRef = useRef<AbortController | null>(null)
  const refineAbortRef = useRef<AbortController | null>(null)
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isGeneratingRef = useRef(false)
  const generationBlockIdsRef = useRef<Set<string>>(new Set())
  const dirtyGeneratedBlockIdsRef = useRef<Set<string>>(new Set())

  // --- chat state ---------------------------------------------------------
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hi! I'm your DHS report-writing team. Describe the report you want and I'll plan it, pull the survey data, choose charts, and write it — all in the canvas.\n\nTry: \"Create a report on child nutrition and stunting in Rwanda for policy makers, highlighting regional disparities and the Southern Province.\"",
      timestamp: Date.now(),
    },
  ])

  const { toast } = useToast()

  // --- load API key from localStorage ------------------------------------
  useEffect(() => {
    const saved = localStorage.getItem('NVIDIA_API_KEY')
    if (saved) setNvapiKey(saved)
  }, [])

  useEffect(() => {
    if (focusMode) setMobilePanel(null)
  }, [focusMode])

  useEffect(() => {
    isGeneratingRef.current = isGenerating
  }, [isGenerating])

  // --- autosave -----------------------------------------------------------
  const autosave = useAutosave(blocks, meta, { enabled: !isGenerating })

  // --- restore prompt on mount -------------------------------------------
  const [showRestore, setShowRestore] = useState(false)
  useEffect(() => {
    if (autosave.hasRestorable && autosave.snapshot?.blocks) {
      // Only offer restore if the autosaved canvas is meaningfully different.
      const saved = autosave.snapshot.blocks as Block[]
      if (saved.length > 0) setShowRestore(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- derived values -----------------------------------------------------
  const selectedBlock = useMemo(
    () => blocks.find(b => b.id === selectedBlockId) || null,
    [blocks, selectedBlockId]
  )
  const allIndicators = useMemo(
    () => CHAPTERS.flatMap(ch => ch.indicators.map(ind => ({
      ...ind, chapter: ch.title,
    }))),
    []
  )
  const headingIds = useMemo(
    () => blocks.filter(b => b.type === 'heading').map(b => b.id),
    [blocks]
  )
  const activeSection = useActiveSection(headingIds, !focusMode)

  // --- block mutation helpers (history-aware) -----------------------------
  const updateBlock = useCallback((id: string, patch: Partial<Block>) => {
    if (isGeneratingRef.current && generationBlockIdsRef.current.has(id)) {
      dirtyGeneratedBlockIdsRef.current.add(id)
    }
    setBlocks(prev => prev.map(b => (b.id === id ? { ...b, ...patch } : b)))
  }, [setBlocks])

  const moveBlock = useCallback((index: number, direction: 'up' | 'down') => {
    setBlocks(prev => {
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }, [setBlocks])

  const reorder = useCallback((from: number, to: number) => {
    setBlocks(prev => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }, [setBlocks])

  const deleteBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id))
    setSelectedBlockId(prev => (prev === id ? null : prev))
  }, [setBlocks])

  const duplicateBlock = useCallback((id: string) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id)
      if (idx === -1) return prev
      const copy: Block = { ...prev[idx], id: `${id}-copy-${Date.now()}` }
      const next = [...prev]
      next.splice(idx + 1, 0, copy)
      return next
    })
  }, [setBlocks])

  const addBlockTemplate = useCallback((type: BlockType) => {
    const id = `block-manual-${Date.now()}`
    const newBlock: Block = { id, type, layoutClass: 'my-4' }
    if (type === 'heading') {
      newBlock.title = 'New Section Title'
      newBlock.content = 'Provide a brief subtitle or description.'
      newBlock.layoutClass = 'text-lg font-bold text-slate-800 mt-6 mb-2 border-b border-slate-100 pb-1'
    } else if (type === 'paragraph') {
      newBlock.content = 'Start writing your narrative analysis here.'
      newBlock.layoutClass = 'text-sm text-slate-600 leading-relaxed mb-4'
    } else if (type === 'callout') {
      newBlock.title = 'Callout Notice'
      newBlock.content = 'Highlight key announcements or limitations.'
      newBlock.layoutClass = 'bg-slate-50 border border-slate-200 p-5 rounded-xl my-4'
    } else if (type === 'insight') {
      newBlock.title = 'Key Insights'
      newBlock.points = ['Add insight bullet point 1.', 'Add insight bullet point 2.']
      newBlock.layoutClass = 'bg-blue-50/50 border border-blue-100 p-5 rounded-xl my-4'
    } else if (type === 'recommendation') {
      newBlock.title = 'Policy Recommendations'
      newBlock.points = ['Add action recommendation 1.', 'Add action recommendation 2.']
      newBlock.layoutClass = 'bg-emerald-50/50 border border-emerald-100 p-5 rounded-xl my-4'
    } else if (type === 'executive_summary') {
      newBlock.title = 'Executive Summary'
      newBlock.content = 'Enter executive summary text.'
      newBlock.layoutClass = 'bg-slate-50 border border-slate-200 p-5 rounded-xl my-4'
    } else if (type === 'methodology') {
      newBlock.title = 'Methodology'
      newBlock.content = 'Methodology description.'
      newBlock.layoutClass = 'text-xs border-t pt-4 text-slate-400 mt-8'
    } else if (type === 'references') {
      newBlock.title = 'References'
      newBlock.content = 'Add survey publications or references.'
      newBlock.layoutClass = 'text-xs text-slate-400 mt-4'
    }
    setBlocks(prev => [...prev, newBlock])
    setSelectedBlockId(id)
  }, [setBlocks])

  const applyTemplate = useCallback((templateId: string) => {
    const t = REPORT_TEMPLATES.find(x => x.id === templateId)
    if (!t) return
    if (t.id === 'blank') {
      reset([])
    } else {
      // Deep clone and stamp fresh IDs so template reuse never duplicates keys.
      reset(freshTemplateBlocks(t.blocks))
    }
    setGalleryOpen(false)
    setSelectedBlockId(null)
  }, [reset])

  const restoreAutosave = useCallback(() => {
    const s = autosave.restore()
    if (s?.blocks) {
      reset(s.blocks as Block[])
      if (s.meta) setMeta(s.meta as ReportMeta)
      toast({ kind: 'success', title: 'Session restored', description: 'Picked up where you left off.' })
    }
    setShowRestore(false)
  }, [autosave, reset, toast])

  // --- indicator payload builder (for the backend agents) -----------------
  const buildIndicatorsPayload = useCallback(() => allIndicators.map(ind => ({
    id: ind.id,
    name: ind.name,
    description: ind.description,
    path: ind.path,
    fixedParams: ind.fixedParams,
    dynamicParams: ind.dynamicParams || [],
  })), [allIndicators])

  const stripStats = useCallback(
    (list: Block[]) => list.map(({ stats, ...rest }) => rest),
    []
  )

  // --- chat helpers -------------------------------------------------------
  const addChatMessage = useCallback((m: ChatMessage) =>
    setChatMessages(prev => [...prev, m]), [])
  const updateChatMessage = useCallback((id: string, patch: Partial<ChatMessage>) =>
    setChatMessages(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m))), [])

  const updateStepStatus = useCallback((id: string, status: AgentStep['status'], msg?: string) => {
    setAgentSteps(prev => prev.map(s => (s.id === id ? { ...s, status, message: msg ?? s.message } : s)))
  }, [])

  // Pulse a freshly-landed block so the user sees it arrive.
  const pulseBlock = useCallback((id: string) => {
    setLandedIds(prev => (prev.includes(id) ? prev : [...prev, id]))
    setTimeout(() => setLandedIds(prev => prev.filter(x => x !== id)), 1800)
  }, [])


  // The backend's first block (id 'block-header') carries the REAL generated
  // report title/subtitle. Route it into the editable title page instead of
  // rendering it as a duplicate heading, so the title page is always real —
  // never the old hardcoded sample.
  const applyHeaderMeta = useCallback((blk: Block) => {
    setMeta(m => ({
      ...m,
      title: blk.title || m.title,
      subtitle: blk.content ?? m.subtitle,
    }))
  }, [])

  // --- report generation / refinement ------------------------------------
  const generateReport = useCallback(async (message: string) => {
    setIsGenerating(true)
    reset([])
    setAgentSteps(INITIAL_STEPS.map(s => ({ ...s })))
    generationBlockIdsRef.current = new Set()
    dirtyGeneratedBlockIdsRef.current = new Set()
    const statusMsgId = `a-${Date.now()}`
    addChatMessage({ id: statusMsgId, role: 'assistant', text: 'Assembling the agent team…', pending: true, timestamp: Date.now() })
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'

    const controller = new AbortController()
    abortRef.current = controller
    let warnedStall = false
    const clearWatchdog = () => {
      if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null }
    }
    // Reset a 45s timer on every stream chunk (including heartbeats). If it
    // fires, the stream has gone quiet — warn once without killing the run.
    const bumpWatchdog = () => {
      clearWatchdog()
      watchdogRef.current = setTimeout(() => {
        if (!warnedStall) {
          warnedStall = true
          toast({
            kind: 'info',
            title: 'Still working…',
            description: 'The agents are taking longer than usual — the connection may have stalled. Keep waiting, or press Stop and retry.',
          })
        }
      }, 45000)
    }
    bumpWatchdog()
    let sawTerminalEvent = false

    try {
      const response = await fetch(`${API_URL}/report-builder/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          availableIndicators: buildIndicatorsPayload(),
          apiKey: nvapiKey,
        }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`Server returned status ${response.status}`)
      const reader = response.body?.getReader()
      if (!reader) throw new Error('Readable stream not supported.')
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        bumpWatchdog()
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const dataStr = line.slice(6).trim()
          if (!dataStr) continue
          try {
            const event = JSON.parse(dataStr)
            const st = event.status as string
            if (st === 'ping') {
              // Heartbeat — no UI, just keeps the watchdog fed (already bumped).
              continue
            } else if (st === 'completed') {
              sawTerminalEvent = true
              clearWatchdog()
              AGENT_IDS.forEach(id => updateStepStatus(id, 'completed'))
              const raw = Array.isArray(event.blocks) ? event.blocks as Block[] : []
              const header = raw.find(b => b.id === 'block-header')
              if (header) applyHeaderMeta(header)
              const incoming = raw.filter(b => b.id !== 'block-header')
              const merged = mergeGeneratedBlocks(
                incoming,
                blocksRef.current,
                dirtyGeneratedBlockIdsRef.current
              )
              silentSet(merged)
              setReportStarted(true)
              setIsGenerating(false)
              updateChatMessage(statusMsgId, {
                text: `Done. I built your report with ${incoming.length} blocks on the canvas. Edit anything, or tell me what to change.`,
                pending: false,
              })
              generationBlockIdsRef.current = new Set()
              dirtyGeneratedBlockIdsRef.current = new Set()
            } else if (st === 'error') {
              sawTerminalEvent = true
              clearWatchdog()
              setIsGenerating(false)
              updateStepStatus('qa', 'error', event.message)
              updateChatMessage(statusMsgId, { text: `⚠️ ${event.message}`, pending: false })
              toast({ kind: 'error', title: 'Generation failed', description: event.message })
            } else if (st === 'block') {
              // A single agent-produced block landed early — paint + pulse it.
              const blk = event.block as Block
              if (blk.id === 'block-header') {
                // The report title/subtitle drives the title page, not a block.
                applyHeaderMeta(blk)
              } else {
                generationBlockIdsRef.current.add(blk.id)
                setBlocks(prev => (prev.some(b => b.id === blk.id) ? prev : [...prev, blk]))
                pulseBlock(blk.id)
              }
            } else {
              ;(PREV_STEPS[st] || []).forEach(id => updateStepStatus(id, 'completed'))
              if (AGENT_IDS.includes(st as AgentStep['id'])) updateStepStatus(st, 'working', event.message)
              if (event.message) updateChatMessage(statusMsgId, { text: event.message, pending: true })
            }
          } catch (err) {
            console.error('Failed to parse SSE line', err)
          }
        }
      }
      if (!sawTerminalEvent) {
        const partialCount = blocksRef.current.length
        const msg = partialCount
          ? `The stream ended before the agents sent a final report. I kept ${partialCount} partial blocks on the canvas.`
          : 'The stream ended before the agents sent a final report. No blocks were received.'
        setIsGenerating(false)
        if (partialCount > 0) setReportStarted(true)
        setAgentSteps(prev => prev.map(s => (
          s.status === 'working' ? { ...s, status: 'error', message: 'Stream ended before completion' } : s
        )))
        updateChatMessage(statusMsgId, { text: `⚠️ ${msg}`, pending: false })
        toast({ kind: 'error', title: 'Generation interrupted', description: msg, retry: () => generateReport(message) })
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        setIsGenerating(false)
        if (blocksRef.current.length > 0) setReportStarted(true)
        updateChatMessage(statusMsgId, {
          text: blocksRef.current.length > 0
            ? 'Generation stopped. I kept the partial draft on the canvas so you can edit it or ask me to continue.'
            : 'Generation stopped. Tell me what you’d like and I’ll start again.',
          pending: false,
        })
      } else {
        console.error(error)
        setIsGenerating(false)
        updateChatMessage(statusMsgId, {
          text: `⚠️ Generation failed: ${error.message || error}. Check the API key in settings.`,
          pending: false,
        })
        toast({
          kind: 'error',
          title: 'Generation failed',
          description: error.message || String(error),
          retry: () => generateReport(message),
        })
      }
    } finally {
      clearWatchdog()
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [addChatMessage, applyHeaderMeta, buildIndicatorsPayload, nvapiKey, pulseBlock, reset, setBlocks, silentSet, toast, updateChatMessage, updateStepStatus])

  // Stop an in-flight generation. The fetch's AbortError is handled in the
  // catch above (posts a "stopped" note, no error toast).
  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort()
    refineAbortRef.current?.abort()
  }, [])

  const refineReport = useCallback(async (message: string) => {
    setIsRefining(true)
    const statusMsgId = `a-${Date.now()}`
    addChatMessage({ id: statusMsgId, role: 'assistant', text: 'Updating the report…', pending: true, timestamp: Date.now() })
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'
    const controller = new AbortController()
    refineAbortRef.current = controller
    try {
      const before = blocksRef.current
      const response = await fetch(`${API_URL}/report-builder/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          currentBlocks: stripStats(blocksRef.current),
          availableIndicators: buildIndicatorsPayload(),
          apiKey: nvapiKey,
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const err = await response.json().catch(() => null)
        throw new Error(err?.detail || `Server returned status ${response.status}`)
      }
      const data = await response.json()
      if (Array.isArray(data.blocks)) {
        const statsById = new Map(blocksRef.current.filter(b => b.stats).map(b => [b.id, b.stats]))
        const next = (data.blocks as Block[]).map(b => (statsById.has(b.id) && !b.stats ? { ...b, stats: statsById.get(b.id) } : b))
        silentSet(next)
        const changedIds = getChangedBlockIds(before, next)
        changedIds.slice(0, 8).forEach(pulseBlock)
        if (changedIds[0]) setSelectedBlockId(changedIds[0])
        updateChatMessage(statusMsgId, {
          text: data.changed === false
            ? "I kept the report as-is because I couldn't safely apply that change. Try rephrasing, or edit the block directly."
            : `Updated the report on the canvas. Changed ${changedIds.length || next.length} block${(changedIds.length || next.length) === 1 ? '' : 's'}.`,
          pending: false,
        })
      } else {
        updateChatMessage(statusMsgId, {
          text: data.changed === false
            ? "I kept the report as-is because I couldn't safely apply that change. Try rephrasing, or edit the block directly."
            : 'Updated the report on the canvas. Anything else?',
          pending: false,
        })
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        updateChatMessage(statusMsgId, { text: 'Update stopped. The current canvas was left unchanged.', pending: false })
        return
      }
      console.error(error)
      updateChatMessage(statusMsgId, { text: `⚠️ Update failed: ${error.message || error}`, pending: false })
      toast({ kind: 'error', title: 'Update failed', description: error.message || String(error), retry: () => refineReport(message) })
    } finally {
      setIsRefining(false)
      if (refineAbortRef.current === controller) refineAbortRef.current = null
    }
  }, [addChatMessage, buildIndicatorsPayload, nvapiKey, pulseBlock, silentSet, stripStats, toast, updateChatMessage])

  const sendChatMessage = useCallback(() => {
    const text = chatInput.trim()
    if (!text || isGenerating || isRefining) return
    setChatInput('')
    addChatMessage({ id: `u-${Date.now()}`, role: 'user', text, timestamp: Date.now() })
    if (reportStarted) void refineReport(text)
    else void generateReport(text)
  }, [addChatMessage, chatInput, generateReport, isGenerating, isRefining, refineReport, reportStarted])

  const startNewReport = useCallback(() => {
    setReportStarted(false)
    reset([])
    setMeta(DEFAULT_REPORT_META)
    setSelectedBlockId(null)
    setAgentSteps(INITIAL_STEPS.map(s => ({ ...s })))
    addChatMessage({ id: `a-${Date.now()}`, role: 'assistant', text: 'Started a fresh canvas. Describe the new report you want.', timestamp: Date.now() })
  }, [addChatMessage, reset])

  // --- per-block AI action (POST /action) ---------------------------------
  const runBlockAction = useCallback(async (targetBlock: Block, action: string) => {
    setRunningAction({ blockId: targetBlock.id, action })
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'
    try {
      const response = await fetch(`${API_URL}/report-builder/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          block: stripStats([targetBlock])[0],
          allBlocks: stripStats(blocksRef.current),
          availableIndicators: allIndicators,
          additionalInstructions: '',
          apiKey: nvapiKey,
        }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => null)
        throw new Error(err?.detail || 'API action failed')
      }
      const data = await response.json()

      if (data.insertBlocks && Array.isArray(data.insertBlocks)) {
        const stamped: Block[] = data.insertBlocks.map((b: Block, i: number) => ({
          ...b, id: `${b.id}-${Date.now()}-${i}`,
        }))
        setBlocks(prev => {
          const idx = prev.findIndex(b => b.id === targetBlock.id)
          const insertAt = idx === -1 ? prev.length : idx + 1
          return [...prev.slice(0, insertAt), ...stamped, ...prev.slice(insertAt)]
        })
        stamped.forEach(b => pulseBlock(b.id))
      }
      if (data.updates) updateBlock(targetBlock.id, data.updates)

      const result = data.result
      if (action === 'insight' && result && Array.isArray(result)) {
        updateBlock(targetBlock.id, { points: result, type: 'insight' })
      } else if (action === 'recommend_viz' && result?.chartType) {
        updateBlock(targetBlock.id, { chartType: result.chartType })
      } else if (typeof result === 'string') {
        if (targetBlock.type === 'insight' || targetBlock.type === 'recommendation') {
          const points = result.split('\n').map(p => p.replace(/^-\s*/, '').trim()).filter(Boolean)
          updateBlock(targetBlock.id, { points })
        } else {
          updateBlock(targetBlock.id, { content: result })
        }
      }
      toast({ kind: 'success', title: 'AI action complete', description: `Applied “${action}” to the block.` })
    } catch (err: any) {
      console.error(err)
      toast({
        kind: 'error',
        title: 'AI action failed',
        description: err?.message || 'Please verify your NVIDIA API key.',
        retry: () => runBlockAction(targetBlock, action),
      })
    } finally {
      setRunningAction(null)
    }
  }, [allIndicators, nvapiKey, pulseBlock, setBlocks, stripStats, toast, updateBlock])

  const handleBlockAction = useCallback((blockId: string, action: string) => {
    const target = blocksRef.current.find(b => b.id === blockId)
    if (target) void runBlockAction(target, action)
  }, [runBlockAction])

  // --- export handlers ----------------------------------------------------
  // Every export runs through runExport so a formatter failure surfaces a toast
  // instead of silently doing nothing.
  const runExport = useCallback((label: string, fn: () => void) => {
    try {
      fn()
    } catch (e: any) {
      console.error(`Export (${label}) failed`, e)
      toast({ kind: 'error', title: 'Export failed', description: `Couldn't build the ${label} export: ${e?.message || e}` })
    }
  }, [toast])

  const exportJSON = useCallback(() => runExport('JSON', () => {
    downloadBlob(JSON.stringify({ meta, blocks }, null, 2), 'report-definition.json', 'application/json')
  }), [blocks, meta, runExport])

  const exportHTML = useCallback(() => runExport('HTML', () => {
    downloadBlob(blocksToHTML(blocks, meta), 'report.html', 'text/html')
  }), [blocks, meta, runExport])

  const exportWord = useCallback(() => runExport('Word', () => {
    downloadBlob(blocksToWord(blocks, meta), 'DHS_Rwanda_Report.doc', 'application/msword')
  }), [blocks, meta, runExport])

  const exportPPTX = useCallback(() => runExport('slide outline', () => {
    downloadBlob(blocksToPPTX(blocks, meta), 'slide_outline.txt', 'text/plain')
  }), [blocks, meta, runExport])

  // CSV emits the real prefetched data (national + per-province + top districts)
  // that already rides on each chart/table block's `stats`, rather than the old
  // blank value cells.
  const exportCSV = useCallback(() => runExport('CSV', () => {
    const esc = (v: string | number | null | undefined) => {
      const s = v == null ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const rows: string[] = ['Indicator,Region,Value,Year,Unit']
    blocks.forEach(b => {
      if (b.type !== 'chart' && b.type !== 'table') return
      const config = b.indicatorId ? allIndicators.find(ind => ind.id === b.indicatorId) : null
      const name = b.stats?.indicator || config?.name || b.title || 'Indicator'
      const year = b.stats?.year ?? ''
      const unit = b.stats?.unit ?? ''
      const s = b.stats
      const line = (region: string, value: number | null | undefined) =>
        [esc(name), esc(region), esc(value), esc(year), esc(unit)].join(',')
      if (s && (s.national != null || (s.provinces && s.provinces.length))) {
        if (s.national != null) rows.push(line('Rwanda (National)', s.national))
        s.provinces?.forEach(p => rows.push(line(p.name, p.value)))
        s.districts?.forEach(d => rows.push(line(`${d.name} (district)`, d.value)))
      } else {
        // Manual/action-added block with no prefetched data — still represent it.
        rows.push(line('Rwanda (National)', null))
      }
    })
    if (rows.length === 1) {
      toast({ kind: 'info', title: 'Nothing to export', description: 'Add a chart or table block first — CSV exports their underlying survey data.' })
      return
    }
    downloadBlob(rows.join('\n'), 'tables_data.csv', 'text/csv')
  }), [allIndicators, blocks, runExport, toast])

  const triggerPrint = useCallback(() => runExport('PDF', () => window.print()), [runExport])

  // --- keyboard shortcuts -------------------------------------------------
  useKeyboardShortcuts({
    onUndo: undo,
    onRedo: redo,
    onCommandPalette: () => setPaletteOpen(true),
    onEscape: () => {
      setPaletteOpen(false)
      setSettingsOpen(false)
      setGalleryOpen(false)
      setSelectedBlockId(null)
    },
    onAddParagraph: () => addBlockTemplate('paragraph'),
    onAddHeading: () => addBlockTemplate('heading'),
    onSave: () => toast({ kind: 'info', title: 'Autosave is on', description: autosave.relativeSavedLabel ? `Last saved ${autosave.relativeSavedLabel}.` : 'Your work is saved automatically.' }),
    onToggleFocus: () => setFocusMode(f => !f),
    onExport: triggerPrint,
  })

  // --- command palette ----------------------------------------------------
  const commands: CommandItem[] = useMemo(() => [
    { id: 'focus', label: focusMode ? 'Exit focus mode' : 'Enter focus mode', group: 'View', icon: Sparkles, shortcut: '⌘⇧F', run: () => setFocusMode(f => !f) },
    { id: 'zoom-in', label: 'Zoom in', group: 'View', icon: Sparkles, run: () => setZoom(z => Math.min(1.5, z + 0.1)) },
    { id: 'zoom-out', label: 'Zoom out', group: 'View', icon: Sparkles, run: () => setZoom(z => Math.max(0.6, z - 0.1)) },
    { id: 'undo', label: 'Undo', group: 'Edit', icon: Sparkles, shortcut: '⌘Z', run: undo },
    { id: 'redo', label: 'Redo', group: 'Edit', icon: Sparkles, shortcut: '⌘⇧Z', run: redo },
    { id: 'add-heading', label: 'Add heading block', group: 'Insert', icon: Sparkles, shortcut: '⇧H', run: () => addBlockTemplate('heading') },
    { id: 'add-paragraph', label: 'Add paragraph block', group: 'Insert', icon: Sparkles, shortcut: '⇧P', run: () => addBlockTemplate('paragraph') },
    { id: 'add-insight', label: 'Add insights block', group: 'Insert', icon: Sparkles, run: () => addBlockTemplate('insight') },
    { id: 'add-rec', label: 'Add recommendations block', group: 'Insert', icon: Sparkles, run: () => addBlockTemplate('recommendation') },
    { id: 'templates', label: 'Browse templates', group: 'Insert', icon: Sparkles, run: () => setGalleryOpen(true) },
    { id: 'export-pdf', label: 'Export as PDF', group: 'Export', icon: Sparkles, shortcut: '⌘E', run: triggerPrint },
    { id: 'export-word', label: 'Export as Word', group: 'Export', icon: Sparkles, run: exportWord },
    { id: 'export-html', label: 'Export as HTML', group: 'Export', icon: Sparkles, run: exportHTML },
    { id: 'settings', label: 'Open API key settings', group: 'Settings', icon: Settings, run: () => setSettingsOpen(true) },
  ], [addBlockTemplate, exportHTML, exportWord, focusMode, redo, triggerPrint, undo])

  // --- jump to section (used by outline) ----------------------------------
  const jumpToBlock = useCallback((id: string) => {
    const el = document.getElementById(`block-${id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const renderWorkspacePanel = () => (
    <ChatPanel
      messages={chatMessages}
      input={chatInput}
      onInputChange={setChatInput}
      onSend={sendChatMessage}
      onStop={cancelGeneration}
      isGenerating={isGenerating}
      isRefining={isRefining}
      agentSteps={agentSteps}
      reportStarted={reportStarted}
      suggestions={CHAT_SUGGESTIONS}
      onSuggestion={setChatInput}
      onNewReport={startNewReport}
    />
  )

  const renderInspectorPanel = () => (
    <PropertiesPanel
      selectedBlock={selectedBlock}
      allBlocks={blocks}
      chapters={CHAPTERS}
      activeSectionId={activeSection ?? null}
      onUpdate={updateBlock}
      onJump={jumpToBlock}
      onClose={() => setSelectedBlockId(null)}
    />
  )

  return (
    <>
      <div className="print:hidden">
        <Header title="AI Report Builder" subtitle="Collaborative Multi-Agent DHS Report Authoring Canvas" />
      </div>

      <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50 print:h-auto print:overflow-visible print:bg-white">
        {/* LEFT PANEL */}
        {!focusMode && (
          <aside className="hidden w-80 shrink-0 flex-col border-r border-slate-200 bg-white print:hidden xl:flex">
            {renderWorkspacePanel()}
          </aside>
        )}

        {/* CENTER */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible">
          <div className="bg-slate-50 px-3 pt-4 sm:px-6 sm:pt-6 print:hidden print:bg-white print:p-0">
            <TopToolbar
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              undoCount={undoCount}
              redoCount={redoCount}
              zoom={zoom}
              onZoom={setZoom}
              focusMode={focusMode}
              onToggleFocus={() => setFocusMode(f => !f)}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenGallery={() => setGalleryOpen(true)}
              onOpenPalette={() => setPaletteOpen(true)}
              autosaveLabel={autosave.relativeSavedLabel}
              autosaving={autosave.state === 'saving'}
              onExportPDF={triggerPrint}
              onExportWord={exportWord}
              onExportHTML={exportHTML}
              onExportPPTX={exportPPTX}
              onExportCSV={exportCSV}
              onExportJSON={exportJSON}
            />
          </div>

          {/* All live AI activity (generation progress + refine status) is shown
              inside the chat panel, keeping the canvas clean and focused. */}

          <ReportCanvas
            blocks={blocks}
            meta={meta}
            zoom={zoom}
            isGenerating={isGenerating}
            focusMode={focusMode}
            selectedBlockId={selectedBlockId}
            landedIds={landedIds}
            runningAction={runningAction}
            onMetaChange={patch => setMeta(m => ({ ...m, ...patch }))}
            onSelect={setSelectedBlockId}
            onMove={moveBlock}
            onDelete={deleteBlock}
            onDuplicate={duplicateBlock}
            onReorder={reorder}
            onUpdate={updateBlock}
            onRunAction={handleBlockAction}
            onOpenGallery={() => setGalleryOpen(true)}
          />
        </main>

        {/* RIGHT PANEL */}
        {!focusMode && (
          <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white print:hidden xl:flex">
            {renderInspectorPanel()}
          </aside>
        )}
      </div>

      {!focusMode && (
        <MobileWorkspaceDock
          selectedBlock={!!selectedBlock}
          onOpenWorkspace={() => setMobilePanel('workspace')}
          onOpenInspector={() => setMobilePanel('inspector')}
          onOpenGallery={() => setGalleryOpen(true)}
        />
      )}

      <AnimatePresence>
        {!focusMode && mobilePanel && (
          <MobilePanelDrawer
            title={mobilePanel === 'workspace' ? 'AI Assistant' : 'Inspector'}
            subtitle={mobilePanel === 'workspace'
              ? 'Generate or refine editable report blocks.'
              : (selectedBlock ? 'Edit the selected block and document outline.' : 'Select a canvas block to edit its properties.')}
            onClose={() => setMobilePanel(null)}
          >
            {mobilePanel === 'workspace' ? renderWorkspacePanel() : renderInspectorPanel()}
          </MobilePanelDrawer>
        )}
      </AnimatePresence>

      {/* Overlays */}
      <TemplatesGallery open={galleryOpen} onClose={() => setGalleryOpen(false)} onChoose={applyTemplate} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />

      {/* Autosave restore banner */}
      <AnimatePresence>
        {showRestore && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-3 right-3 z-[80] flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-elev-3 sm:bottom-4 sm:left-auto sm:right-4 print:hidden"
          >
            <span className="text-xs font-medium text-slate-600">Restore your last session?</span>
            <button
              onClick={restoreAutosave}
              className="rounded-lg bg-nisr-navy px-3 py-1.5 text-[11px] font-bold text-white hover:bg-nisr-navy-dark"
            >
              Restore
            </button>
            <button
              onClick={() => setShowRestore(false)}
              className="rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-400 hover:text-slate-600"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings dialog */}
      <AnimatePresence>
        {settingsOpen && (
          <SettingsDialog
            apiKey={nvapiKey}
            onChange={setNvapiKey}
            onClose={() => setSettingsOpen(false)}
            onSave={() => {
              localStorage.setItem('NVIDIA_API_KEY', nvapiKey)
              setSettingsOpen(false)
              toast({ kind: 'success', title: 'API key saved' })
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function SettingsDialog({ apiKey, onChange, onClose, onSave }: {
  apiKey: string; onChange: (v: string) => void; onClose: () => void; onSave: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, true)
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm print:hidden" onClick={onClose}>
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={e => e.stopPropagation()}
        className="w-[450px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-elev-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-2 text-slate-800">
            <Settings className="h-4.5 w-4.5 text-nisr-navy" />
            <span id="settings-dialog-title" className="text-sm font-bold">LLM API Configuration</span>
          </div>
          <button onClick={onClose} aria-label="Close settings" className="rounded text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-xs leading-relaxed text-slate-400">
            By default, the backend uses a pre-configured NVIDIA key. To supply your own custom NVIDIA key, enter it here.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-500">NVIDIA API Key</span>
            <input
              type="password"
              value={apiKey}
              onChange={e => onChange(e.target.value)}
              placeholder="nvapi-…"
              className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs focus:outline-none focus:ring-1 focus:ring-nisr-navy/30"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 p-5">
          <button onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={onSave} className="rounded-lg bg-nisr-navy px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-nisr-navy-dark">
            Save & Set Key
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function MobileWorkspaceDock({ selectedBlock, onOpenWorkspace, onOpenInspector, onOpenGallery }: {
  selectedBlock: boolean
  onOpenWorkspace: () => void
  onOpenInspector: () => void
  onOpenGallery: () => void
}) {
  return (
    <div className="fixed inset-x-3 bottom-3 z-[70] grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-elev-4 backdrop-blur-xl print:hidden xl:hidden">
      <button
        type="button"
        onClick={onOpenWorkspace}
        className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-nisr-navy to-nisr-cyan px-3 py-2 text-[11px] font-bold text-white focus:outline-none focus:ring-2 focus:ring-nisr-cyan/40"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Assistant
      </button>
      <button
        type="button"
        onClick={onOpenInspector}
        className="relative flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/40"
      >
        <SlidersHorizontal className="h-3.5 w-3.5 text-nisr-cyan-dark" />
        Inspect
        {selectedBlock && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />}
      </button>
      <button
        type="button"
        onClick={onOpenGallery}
        className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/40"
      >
        <LayoutGrid className="h-3.5 w-3.5 text-nisr-cyan-dark" />
        Blocks
      </button>
    </div>
  )
}

function MobilePanelDrawer({ title, subtitle, onClose, children }: {
  title: string
  subtitle: string
  onClose: () => void
  children: React.ReactNode
}) {
  const drawerRef = useRef<HTMLDivElement>(null)
  useFocusTrap(drawerRef, true)

  return (
    <div
      className="fixed inset-0 z-[85] bg-slate-950/45 backdrop-blur-sm print:hidden xl:hidden"
      onClick={onClose}
    >
      <motion.div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-panel-title"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
        className="absolute inset-x-0 bottom-0 flex max-h-[88svh] min-h-[60svh] flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-elev-4"
      >
        <div className="shrink-0 border-b border-slate-100 px-4 py-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" aria-hidden />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="mobile-panel-title" className="text-sm font-bold text-slate-900">{title}</h2>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-nisr-cyan/40"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
          {children}
        </div>
      </motion.div>
    </div>
  )
}

// Wrap the whole builder in the toast provider so deeply-nested components
// (block actions, etc.) can raise toasts.
export default function ReportBuilderClient() {
  return (
    <ToastProvider>
      <ReportBuilderInner />
    </ToastProvider>
  )
}

// ---------------------------------------------------------------------------
// Export formatters — lifted from the legacy client and enriched to include
// the report metadata (title page) in every format.
// ---------------------------------------------------------------------------

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function cloneBlock(block: Block, idSuffix: string): Block {
  return {
    ...block,
    id: `${block.id}-${idSuffix}`,
    points: block.points ? [...block.points] : undefined,
    params: block.params ? { ...block.params } : undefined,
    stats: block.stats ? {
      ...block.stats,
      provinces: block.stats.provinces ? [...block.stats.provinces] : undefined,
      districts: block.stats.districts ? [...block.stats.districts] : undefined,
    } : undefined,
  }
}

function freshTemplateBlocks(blocks: Block[]): Block[] {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  return blocks.map((block, index) => cloneBlock(block, `${stamp}-${index}`))
}

function mergeGeneratedBlocks(incoming: Block[], current: Block[], dirtyIds: Set<string>): Block[] {
  const currentById = new Map(current.map(block => [block.id, block]))
  const incomingIds = new Set(incoming.map(block => block.id))
  const merged = incoming.map(block => {
    const local = currentById.get(block.id)
    if (!local || !dirtyIds.has(block.id)) return block
    return {
      ...block,
      ...local,
      stats: local.stats ?? block.stats,
    }
  })
  const localOnly = current.filter(block => !incomingIds.has(block.id))
  return [...merged, ...localOnly]
}

function getChangedBlockIds(before: Block[], after: Block[]): string[] {
  const beforeById = new Map(before.map(block => [block.id, block]))
  return after
    .filter(block => JSON.stringify(beforeById.get(block.id) ?? null) !== JSON.stringify(block))
    .map(block => block.id)
}

function escapeHtml(s: string): string {
  return (s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] as string))
}

function metaHeaderHTML(meta: ReportMeta): string {
  return `<h1>${escapeHtml(meta.title)}</h1><p class="subtitle">${escapeHtml(meta.subtitle)}</p>
    <p class="meta">${escapeHtml(meta.author)} · ${escapeHtml(meta.date)} · Prepared for ${escapeHtml(meta.preparedFor)}</p>`
}

// Renders a chart/table block as a real data table for the HTML/Word exports,
// using the stats already prefetched onto the block at generation time. Without
// this, chart blocks exported to Word/HTML would carry no data at all.
function statsTableHTML(b: Block): string {
  const title = escapeHtml(b.title || b.stats?.indicator || 'Indicator')
  const unit = b.stats?.unit ? ` (${escapeHtml(String(b.stats.unit))})` : ''
  const year = b.stats?.year ? ` — ${escapeHtml(String(b.stats.year))}` : ''
  const cell = (v: number | null | undefined) => (v == null ? '—' : escapeHtml(String(v)))
  const rows: string[] = []
  if (b.stats?.national != null) {
    rows.push(`<tr><td style="padding:6px 8px;border-bottom:1px solid #edf2f7;font-weight:600;">Rwanda (National)</td><td style="padding:6px 8px;border-bottom:1px solid #edf2f7;text-align:right;font-weight:600;">${cell(b.stats.national)}</td></tr>`)
  }
  b.stats?.provinces?.forEach(p => {
    rows.push(`<tr><td style="padding:6px 8px;border-bottom:1px solid #edf2f7;">${escapeHtml(p.name)}</td><td style="padding:6px 8px;border-bottom:1px solid #edf2f7;text-align:right;">${cell(p.value)}</td></tr>`)
  })
  if (rows.length === 0) {
    return `<h3>${title}</h3><p style="color:#94a3b8;font-style:italic;">Data table not available in this export.</p>`
  }
  return `<h3>${title}${unit}${year}</h3>
    <table style="border-collapse:collapse;width:100%;margin:0 0 20px;font-size:13px;">
      <thead><tr>
        <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #cbd5e1;">Region</th>
        <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #cbd5e1;">Value</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`
}

function blocksToHTML(blocks: Block[], meta: ReportMeta): string {
  let content = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(meta.title)}</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #334155; line-height: 1.6; }
      h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 4px; }
      .subtitle { color: #64748b; font-style: italic; margin-top: 0; }
      .meta { color: #94a3b8; font-size: 12px; }
      h2 { color: #1e293b; margin-top: 30px; }
      p { margin-bottom: 20px; }
      .summary { background: #f8fafc; border-left: 4px solid #1B3C74; padding: 15px; border-radius: 4px; margin: 20px 0; }
      .box { padding: 15px; border-radius: 8px; margin: 20px 0; }
      .insight { background: #eff6ff; border: 1px solid #bfdbfe; }
      .recommendation { background: #f0fdf4; border: 1px solid #bbf7d0; }
      ul { padding-left: 20px; } li { margin-bottom: 8px; }
    </style></head><body>`
  content += metaHeaderHTML(meta)
  blocks.forEach(b => {
    if (b.type === 'heading') content += `<h2>${escapeHtml(b.title || '')}</h2><p class="subtitle">${escapeHtml(b.content || '')}</p>`
    else if (b.type === 'paragraph') content += `<p>${escapeHtml(b.content || '')}</p>`
    else if (b.type === 'executive_summary') content += `<div class="summary"><h3>${escapeHtml(b.title || 'Executive Summary')}</h3><p>${escapeHtml(b.content || '')}</p></div>`
    else if (b.type === 'callout') content += `<div class="summary"><h3>${escapeHtml(b.title || 'Notice')}</h3><p>${escapeHtml(b.content || '')}</p></div>`
    else if (b.type === 'insight') {
      content += `<div class="box insight"><h3>${escapeHtml(b.title || 'Insights')}</h3><ul>`
      b.points?.forEach(p => { content += `<li>${escapeHtml(p)}</li>` })
      content += `</ul></div>`
    } else if (b.type === 'recommendation') {
      content += `<div class="box recommendation"><h3>${escapeHtml(b.title || 'Recommendations')}</h3><ul>`
      b.points?.forEach(p => { content += `<li>${escapeHtml(p)}</li>` })
      content += `</ul></div>`
    } else if (b.type === 'chart' || b.type === 'table') {
      content += statsTableHTML(b)
    } else if (b.type === 'methodology' || b.type === 'references') {
      content += `<hr/><p style="font-size:12px;color:#64748b;"><b>${escapeHtml(b.title || '')}:</b> ${escapeHtml(b.content || '')}</p>`
    }
  })
  content += `</body></html>`
  return content
}

function blocksToWord(blocks: Block[], meta: ReportMeta): string {
  let content = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset="utf-8"><title>${escapeHtml(meta.title)}</title><style>
      body { font-family: Arial, sans-serif; line-height: 1.5; color: #333; }
      h1 { font-size: 24pt; color: #1B3C74; font-weight: bold; margin-bottom: 4pt; }
      .subtitle { font-size: 12pt; color: #666; font-style: italic; }
      .meta { font-size: 10pt; color: #999; }
      h2 { font-size: 16pt; color: #0099D4; font-weight: bold; margin-top: 24pt; margin-bottom: 6pt; }
      p { font-size: 11pt; margin-bottom: 12pt; }
      .summary-box { background: #f1f5f9; border-left: 4px solid #1B3C74; padding: 12pt; margin-bottom: 18pt; }
      .insight-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 12pt; margin-bottom: 18pt; }
      .rec-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12pt; margin-bottom: 18pt; }
      li { font-size: 11pt; margin-bottom: 6pt; }
    </style></head><body>`
  content += `<h1>${escapeHtml(meta.title)}</h1><p class="subtitle">${escapeHtml(meta.subtitle)}</p><p class="meta">${escapeHtml(meta.author)} · ${escapeHtml(meta.date)} · Prepared for ${escapeHtml(meta.preparedFor)}</p>`
  blocks.forEach(b => {
    if (b.type === 'heading') content += `<h2>${escapeHtml(b.title || '')}</h2><p style="color:#666;font-style:italic;">${escapeHtml(b.content || '')}</p>`
    else if (b.type === 'paragraph') content += `<p>${escapeHtml(b.content || '')}</p>`
    else if (b.type === 'executive_summary') content += `<div class="summary-box"><h3>${escapeHtml(b.title || 'Executive Summary')}</h3><p>${escapeHtml(b.content || '')}</p></div>`
    else if (b.type === 'callout') content += `<div class="summary-box"><h3>${escapeHtml(b.title || 'Notice')}</h3><p>${escapeHtml(b.content || '')}</p></div>`
    else if (b.type === 'insight') {
      content += `<div class="insight-box"><h3>${escapeHtml(b.title || 'Key Insights')}</h3><ul>`
      b.points?.forEach(p => { content += `<li>${escapeHtml(p)}</li>` })
      content += `</ul></div>`
    } else if (b.type === 'recommendation') {
      content += `<div class="rec-box"><h3>${escapeHtml(b.title || 'Policy Recommendations')}</h3><ul>`
      b.points?.forEach(p => { content += `<li>${escapeHtml(p)}</li>` })
      content += `</ul></div>`
    } else if (b.type === 'chart' || b.type === 'table') {
      content += statsTableHTML(b)
    } else if (b.type === 'methodology' || b.type === 'references') {
      content += `<hr/><p style="font-size:9pt;color:#666;"><b>${escapeHtml(b.title || '')}:</b> ${escapeHtml(b.content || '')}</p>`
    }
  })
  content += `</body></html>`
  return content
}

function blocksToPPTX(blocks: Block[], meta: ReportMeta): string {
  let content = `${meta.title.toUpperCase()}\n${meta.subtitle}\n${meta.author} · ${meta.date}\n===================\n\n`
  let slide = 2
  blocks.forEach(b => {
    if (b.type === 'heading') {
      content += `SLIDE ${slide}: ${b.title?.toUpperCase() || ''}\n${b.content || ''}\n---------------------------------------\n\n`
      slide++
    } else if (b.type === 'insight' || b.type === 'recommendation') {
      content += `SLIDE ${slide}: ${b.title?.toUpperCase() || ''}\n`
      b.points?.forEach(p => { content += `* ${p}\n` })
      content += `---------------------------------------\n\n`
      slide++
    } else if (b.type === 'executive_summary') {
      content += `SLIDE ${slide}: ${b.title?.toUpperCase() || 'EXECUTIVE SUMMARY'}\n${b.content || ''}\n---------------------------------------\n\n`
      slide++
    }
  })
  return content
}
