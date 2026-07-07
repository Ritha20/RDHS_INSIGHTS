'use client'

import type { ReportMeta } from '@/lib/report-builder/types'

interface ReportHeaderProps {
  meta: ReportMeta
  onChange: (patch: Partial<ReportMeta>) => void
}

// The editable report title page rendered above the block canvas. Each field is
// an unbordered input so it reads as a finished document while staying editable
// inline. All fields are omitted from the print/export chrome by the caller.
export default function ReportHeader({ meta, onChange }: ReportHeaderProps) {
  return (
    <header className="mb-8 border-b border-slate-200 pb-6">
      <input
        value={meta.title}
        onChange={e => onChange({ title: e.target.value })}
        placeholder="Report title"
        className="w-full rounded border-none bg-transparent text-3xl font-extrabold tracking-tight text-slate-900 focus:outline-none focus:ring-1 focus:ring-nisr-navy/20"
      />
      <input
        value={meta.subtitle}
        onChange={e => onChange({ subtitle: e.target.value })}
        placeholder="Subtitle"
        className="mt-1 w-full rounded border-none bg-transparent text-sm font-medium text-slate-500 focus:outline-none focus:ring-1 focus:ring-nisr-navy/20"
      />
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-slate-500">
        <Field label="Author" value={meta.author} onChange={v => onChange({ author: v })} />
        <Field label="Date" value={meta.date} onChange={v => onChange({ date: v })} />
        <Field label="Prepared for" value={meta.preparedFor} onChange={v => onChange({ preparedFor: v })} />
      </div>
    </header>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="min-w-[120px] rounded border-none bg-transparent text-[11px] font-semibold text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-nisr-navy/20"
      />
    </label>
  )
}
