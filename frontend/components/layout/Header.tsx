'use client'

import { Download } from 'lucide-react'

interface HeaderProps {
  title?: string
  subtitle?: string
  onDownloadCSV?: () => void
}

export default function Header({ title, subtitle, onDownloadCSV }: HeaderProps) {
  return (
    <header className="header-bar sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur-sm px-6 shadow-sm">
      <div>
        {title ? (
          <>
            <h1 className="text-base font-semibold text-slate-900">{title}</h1>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </>
        ) : (
          <>
            <h1 className="text-base font-semibold text-slate-900">RDHS Insights Dashboard</h1>
            <p className="text-xs text-slate-500">Demographic and Health Survey 2019–20 · NISR</p>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onDownloadCSV && (
          <button
            onClick={onDownloadCSV}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-smooth hover:bg-slate-50 hover:border-slate-300"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        )}
      </div>
    </header>
  )
}
