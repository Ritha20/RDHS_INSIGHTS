// The 14 per-block AI actions, grouped into semantic categories for the menu.
//
// The `action` id of each entry is the exact string sent to
// POST /report-builder/action and matched in the backend's if/elif chain —
// do NOT rename any `action` value. Only labels/grouping/icon are cosmetic
// and free to change.

import type { AccentColor } from './types'

export interface AIActionDef {
  action: string
  label: string
  description: string
  icon: string
}

export interface AIActionGroup {
  id: string
  label: string
  accent: AccentColor
  actions: AIActionDef[]
}

export const AI_ACTION_GROUPS: AIActionGroup[] = [
  {
    id: 'write',
    label: 'Writing',
    accent: 'violet',
    actions: [
      { action: 'improve', label: 'Improve writing', description: 'Tighten and clarify the prose', icon: 'Wand2' },
      { action: 'expand', label: 'Expand content', description: 'Add depth and detail', icon: 'Maximize2' },
      { action: 'shorten', label: 'Shorten', description: 'Make it more concise', icon: 'Minimize2' },
      { action: 'summarize', label: 'Summarize', description: 'Distill to the essentials', icon: 'AlignLeft' },
      { action: 'regenerate', label: 'Regenerate', description: 'Rewrite from scratch', icon: 'RefreshCw' },
      { action: 'translate', label: 'Translate', description: 'Translate to another language', icon: 'Languages' },
    ],
  },
  {
    id: 'analyze',
    label: 'Analyze',
    accent: 'indigo',
    actions: [
      { action: 'explain', label: 'Explain stats', description: 'Interpret the numbers in plain language', icon: 'HelpCircle' },
      { action: 'insight', label: 'Get insight', description: 'Surface the key finding', icon: 'Lightbulb' },
      { action: 'compare', label: 'Compare vs national', description: 'Benchmark against the national value', icon: 'GitCompare' },
    ],
  },
  {
    id: 'visualize',
    label: 'Visualize',
    accent: 'cyan',
    actions: [
      { action: 'recommend_viz', label: 'Suggest chart', description: 'Recommend a better chart type', icon: 'PieChart' },
      { action: 'add_supporting', label: 'Add supporting chart', description: 'Insert a related chart below', icon: 'PlusCircle' },
    ],
  },
  {
    id: 'source',
    label: 'Source',
    accent: 'amber',
    actions: [
      { action: 'cite_source', label: 'Cite source', description: 'Add a data citation', icon: 'Quote' },
      { action: 'find_related', label: 'Related indicators', description: 'Surface related indicators', icon: 'Link2' },
    ],
  },
  {
    id: 'layout',
    label: 'Layout',
    accent: 'emerald',
    actions: [
      { action: 'improve_layout', label: 'Improve layout', description: 'Pick a better visual style', icon: 'LayoutTemplate' },
    ],
  },
]

export const ALL_AI_ACTIONS: AIActionDef[] = AI_ACTION_GROUPS.flatMap(g => g.actions)
