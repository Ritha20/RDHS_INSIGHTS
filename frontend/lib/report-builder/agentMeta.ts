import type { AgentId, AgentMeta } from './types'

// The eight agents of the multi-agent pipeline, in pipeline order. The `id`
// values match the SSE `status` values emitted by the backend exactly, so the
// mission-control UI can map an incoming event straight onto its card.
export const AGENT_PIPELINE: AgentMeta[] = [
  {
    id: 'planning',
    name: 'Planning Agent',
    role: 'Architect',
    description: 'Designs the report structure and selects the right indicators.',
    icon: 'Brain',
    accent: 'navy',
  },
  {
    id: 'discovery',
    name: 'Indicator Discovery',
    role: 'Cataloger',
    description: 'Resolves each chosen indicator to live DHS data paths.',
    icon: 'Search',
    accent: 'cyan',
  },
  {
    id: 'analysis',
    name: 'Statistical Analyst',
    role: 'Analyst',
    description: 'Queries national and provincial values from the survey.',
    icon: 'Calculator',
    accent: 'sky',
  },
  {
    id: 'visualization',
    name: 'Visualization Specialist',
    role: 'Designer',
    description: 'Picks the best chart type for each indicator.',
    icon: 'BarChart3',
    accent: 'indigo',
  },
  {
    id: 'narrative',
    name: 'Narrative Writer',
    role: 'Author',
    description: 'Writes the executive summary and every section narrative.',
    icon: 'PenLine',
    accent: 'violet',
  },
  {
    id: 'insights',
    name: 'Insight Generator',
    role: 'Synthesizer',
    description: 'Distills the key findings worth highlighting.',
    icon: 'Lightbulb',
    accent: 'amber',
  },
  {
    id: 'recommendation',
    name: 'Policy Advisory',
    role: 'Advisor',
    description: 'Drafts evidence-based policy recommendations.',
    icon: 'ShieldCheck',
    accent: 'emerald',
  },
  {
    id: 'qa',
    name: 'Report Designer',
    role: 'Editor',
    description: 'Assembles and polishes the publication-ready canvas.',
    icon: 'Sparkles',
    accent: 'rose',
  },
]

export const AGENT_BY_ID: Record<AgentId, AgentMeta> = Object.fromEntries(
  AGENT_PIPELINE.map(a => [a.id, a])
) as Record<AgentId, AgentMeta>

export const AGENT_IDS: AgentId[] = AGENT_PIPELINE.map(a => a.id)

// Map an accent token to the concrete Tailwind classes used across the
// mission-control cards. Centralised so every surface stays consistent and
// Tailwind's JIT sees the full literal class strings.
export interface AccentClasses {
  text: string
  bg: string
  bgSoft: string
  border: string
  ring: string
  gradient: string
  dot: string
}

export const ACCENT_CLASSES: Record<string, AccentClasses> = {
  navy: {
    text: 'text-nisr-navy',
    bg: 'bg-nisr-navy',
    bgSoft: 'bg-nisr-navy/10',
    border: 'border-nisr-navy/30',
    ring: 'ring-nisr-navy/40',
    gradient: 'from-nisr-navy to-nisr-navy-dark',
    dot: 'bg-nisr-navy',
  },
  cyan: {
    text: 'text-nisr-cyan-dark',
    bg: 'bg-nisr-cyan',
    bgSoft: 'bg-nisr-cyan/10',
    border: 'border-nisr-cyan/30',
    ring: 'ring-nisr-cyan/40',
    gradient: 'from-nisr-cyan to-nisr-cyan-dark',
    dot: 'bg-nisr-cyan',
  },
  sky: {
    text: 'text-sky-600',
    bg: 'bg-sky-500',
    bgSoft: 'bg-sky-50',
    border: 'border-sky-200',
    ring: 'ring-sky-400/50',
    gradient: 'from-sky-400 to-sky-600',
    dot: 'bg-sky-500',
  },
  indigo: {
    text: 'text-indigo-600',
    bg: 'bg-indigo-500',
    bgSoft: 'bg-indigo-50',
    border: 'border-indigo-200',
    ring: 'ring-indigo-400/50',
    gradient: 'from-indigo-400 to-indigo-600',
    dot: 'bg-indigo-500',
  },
  violet: {
    text: 'text-violet-600',
    bg: 'bg-violet-500',
    bgSoft: 'bg-violet-50',
    border: 'border-violet-200',
    ring: 'ring-violet-400/50',
    gradient: 'from-violet-400 to-violet-600',
    dot: 'bg-violet-500',
  },
  amber: {
    text: 'text-amber-600',
    bg: 'bg-amber-500',
    bgSoft: 'bg-amber-50',
    border: 'border-amber-200',
    ring: 'ring-amber-400/50',
    gradient: 'from-amber-400 to-amber-600',
    dot: 'bg-amber-500',
  },
  emerald: {
    text: 'text-emerald-600',
    bg: 'bg-emerald-500',
    bgSoft: 'bg-emerald-50',
    border: 'border-emerald-200',
    ring: 'ring-emerald-400/50',
    gradient: 'from-emerald-400 to-emerald-600',
    dot: 'bg-emerald-500',
  },
  rose: {
    text: 'text-rose-600',
    bg: 'bg-rose-500',
    bgSoft: 'bg-rose-50',
    border: 'border-rose-200',
    ring: 'ring-rose-400/50',
    gradient: 'from-rose-400 to-rose-600',
    dot: 'bg-rose-500',
  },
}
