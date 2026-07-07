import type { Block, ReportMeta } from './types'

// Neutral placeholder title page. Left intentionally blank (title/subtitle show
// ReportHeader's placeholders) so the canvas never presents a hardcoded sample
// report — the title page is filled from the real generated report on /generate,
// or edited by hand. Author defaults to the operating agency; date is today.
export const DEFAULT_REPORT_META: ReportMeta = {
  title: '',
  subtitle: '',
  author: 'National Institute of Statistics of Rwanda',
  date: new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }),
  preparedFor: '',
}

// The canvas opens EMPTY (no hardcoded sample report). The empty state shows a
// call-to-action to generate with the AI agent, pick a template, or add blocks
// manually — so nothing on screen is ever fake/hardcoded when presenting.
export const DEFAULT_BLOCKS: Block[] = []

export interface ReportTemplate {
  id: string
  name: string
  description: string
  icon: string
  accent: string
  blocks: Block[]
}

// Starter templates shown in the empty-canvas gallery. Each is a hand-tuned
// skeleton the user can populate manually or hand to the AI agent.
export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Canvas',
    description: 'Start from scratch with an empty report.',
    icon: 'FilePlus',
    accent: 'slate',
    blocks: [],
  },
  {
    id: 'executive-brief',
    name: 'Executive Brief',
    description: 'Tight one-page summary with KPIs and key recommendations.',
    icon: 'FileText',
    accent: 'navy',
    blocks: [
      {
        id: 'tpl-exec-heading',
        type: 'heading',
        title: 'Executive Brief',
        content: 'Key indicators at a glance',
        layoutClass: 'border-b pb-4 mb-6',
      },
      {
        id: 'tpl-exec-summary',
        type: 'executive_summary',
        title: 'Summary',
        content: 'Add a 3–4 sentence summary of the most important findings here.',
        layoutClass: 'bg-slate-50 border border-slate-200 p-5 rounded-xl my-4',
      },
      {
        id: 'tpl-exec-insights',
        type: 'insight',
        title: 'Key Findings',
        points: ['Finding one.', 'Finding two.', 'Finding three.'],
        layoutClass: 'bg-blue-50/50 border border-blue-100 p-5 rounded-xl my-6',
      },
      {
        id: 'tpl-exec-recs',
        type: 'recommendation',
        title: 'Recommended Actions',
        points: ['Recommended action one.', 'Recommended action two.'],
        layoutClass: 'bg-emerald-50/50 border border-emerald-100 p-5 rounded-xl my-6',
      },
    ],
  },
  {
    id: 'provincial-comparison',
    name: 'Provincial Comparison',
    description: 'Side-by-side charts and a comparison table across provinces.',
    icon: 'GitCompare',
    accent: 'cyan',
    blocks: [
      {
        id: 'tpl-pc-heading',
        type: 'heading',
        title: 'Provincial Comparison Report',
        content: 'Benchmarking indicators across the five provinces',
        layoutClass: 'border-b pb-4 mb-6',
      },
      {
        id: 'tpl-pc-h2',
        type: 'heading',
        title: 'Overview by Province',
        content: '',
        layoutClass: 'text-lg font-bold text-slate-800 mt-6 mb-2 border-b border-slate-100 pb-1',
      },
      {
        id: 'tpl-pc-chart',
        type: 'chart',
        title: 'Add an indicator chart',
        indicatorId: 'electricity',
        chartType: 'bar',
        layoutClass: 'my-6 p-4 border border-slate-100 rounded-xl shadow-sm bg-white',
      },
      {
        id: 'tpl-pc-table',
        type: 'table',
        title: 'Provincial Data Table',
        indicatorId: 'electricity',
        layoutClass: 'my-4',
      },
    ],
  },
  {
    id: 'thematic-deep-dive',
    name: 'Thematic Deep-Dive',
    description: 'Long-form narrative report with sections and methodology.',
    icon: 'BookOpen',
    accent: 'violet',
    blocks: [
      {
        id: 'tpl-td-heading',
        type: 'heading',
        title: 'Thematic Deep-Dive',
        content: 'An in-depth analysis of a single topic',
        layoutClass: 'border-b pb-4 mb-6',
      },
      {
        id: 'tpl-td-exec',
        type: 'executive_summary',
        title: 'Executive Summary',
        content: 'Summarize the theme, scope, and headline findings.',
        layoutClass: 'bg-slate-50 border border-slate-200 p-5 rounded-xl my-4',
      },
      {
        id: 'tpl-td-s1',
        type: 'heading',
        title: 'Background & Context',
        content: '',
        layoutClass: 'text-lg font-bold text-slate-800 mt-6 mb-2 border-b border-slate-100 pb-1',
      },
      {
        id: 'tpl-td-s1p',
        type: 'paragraph',
        content: 'Write the background narrative here.',
        layoutClass: 'text-sm text-slate-600 leading-relaxed mb-4',
      },
      {
        id: 'tpl-td-method',
        type: 'methodology',
        title: 'Methodology',
        content: 'Describe the data source, sample, and calculation method.',
        layoutClass: 'text-xs border-t pt-4 text-slate-400 mt-8',
      },
    ],
  },
]
