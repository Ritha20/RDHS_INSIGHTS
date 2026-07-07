// Shared types for the Report Builder UI.
//
// The `Block` and `IndicatorStats` shapes mirror the backend contract exactly
// (backend/rdhs_viz/routers/report_builder.py): block `type` set, `chartType`
// set, LAYOUT_PRESETS keys, and the SSE status values must stay in sync.

export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'chart'
  | 'table'
  | 'callout'
  | 'insight'
  | 'recommendation'
  | 'executive_summary'
  | 'methodology'
  | 'references'

export type ChartType = 'bar' | 'map' | 'line' | 'pie' | 'kpi' | 'table'

/** Stats payload the backend attaches to chart/table blocks at generation
 *  time so the chart paints instantly without a network fetch. */
export interface IndicatorStats {
  indicator?: string
  unit?: string
  year?: number | string
  national?: number | null
  provinces?: { name: string; value: number | null }[]
  districts?: { name: string; value: number | null }[]
}

export interface Block {
  id: string
  type: BlockType
  title?: string
  content?: string
  indicatorId?: string
  chartType?: ChartType
  params?: Record<string, string>
  points?: string[]
  layoutClass?: string
  stats?: IndicatorStats
}

// --- AI agent pipeline -----------------------------------------------------

export type AgentId =
  | 'planning'
  | 'discovery'
  | 'analysis'
  | 'visualization'
  | 'narrative'
  | 'insights'
  | 'recommendation'
  | 'qa'

export type AgentStatus = 'waiting' | 'working' | 'completed' | 'error'

export interface AgentStep {
  id: AgentId
  status: AgentStatus
  message?: string
}

/** Static identity for each agent — frontend-owned; the backend only emits
 *  the role label inside its `message` strings, so the richer metadata
 *  (icon/color/specialty) lives here. */
export interface AgentMeta {
  id: AgentId
  name: string
  role: string
  description: string
  /** lucide icon name, resolved in Icons.tsx */
  icon: string
  /** Tailwind text/bg/border color tokens, e.g. 'sky' → text-sky-600 */
  accent: AccentColor
}

export type AccentColor =
  | 'navy'
  | 'cyan'
  | 'violet'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'sky'
  | 'indigo'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  pending?: boolean
  timestamp?: number
}

/** Report-level metadata (title page) — not a block, but rendered above the
 *  canvas and injected into every export format. */
export interface ReportMeta {
  title: string
  subtitle: string
  author: string
  date: string
  preparedFor: string
}
