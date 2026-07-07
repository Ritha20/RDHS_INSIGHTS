// Mirrors LAYOUT_PRESETS in backend/rdhs_viz/routers/report_builder.py exactly.
// The manual "Style" selector and the AI "improve_layout" action must agree on
// the same vocabulary, or a block styled by one would look unrecognized to the
// other. Keep the `id` set in sync; the `className` values are Tailwind strings.
export const LAYOUT_PRESETS: { id: string; label: string; className: string }[] = [
  { id: 'plain', label: 'Plain', className: 'my-4' },
  { id: 'narrative', label: 'Narrative Text', className: 'text-sm text-slate-600 leading-relaxed mb-4' },
  { id: 'card', label: 'Card', className: 'my-6 p-4 border border-slate-100 rounded-xl shadow-sm bg-white' },
  { id: 'summary_panel', label: 'Summary Panel', className: 'bg-slate-50 border border-slate-200 p-5 rounded-xl my-4' },
  { id: 'insight_panel', label: 'Insight Panel', className: 'bg-blue-50/50 border border-blue-100 p-5 rounded-xl my-6' },
  { id: 'recommendation_panel', label: 'Recommendation Panel', className: 'bg-emerald-50/50 border border-emerald-100 p-5 rounded-xl my-6' },
  { id: 'section_heading', label: 'Section Heading', className: 'text-lg font-bold text-slate-800 mt-6 mb-2 border-b border-slate-100 pb-1' },
  { id: 'footnote', label: 'Footnote', className: 'text-xs border-t pt-4 text-slate-400 mt-8' },
]
