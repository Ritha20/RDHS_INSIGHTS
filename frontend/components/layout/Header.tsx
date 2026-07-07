'use client'

import { Download, Sparkles } from 'lucide-react'

interface HeaderProps {
  title?: string
  subtitle?: string
  onDownloadCSV?: () => void
}

export default function Header({ title, subtitle, onDownloadCSV }: HeaderProps) {
  return (
    <header className="header-bar sticky top-0 z-20 flex h-16 min-w-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-3 shadow-sm backdrop-blur-sm sm:px-6">
      <div className="min-w-0 flex-1">
        {title ? (
          <>
            <h1 className="truncate text-base font-semibold text-slate-900">{title}</h1>
            {subtitle && <p className="line-clamp-2 text-xs leading-snug text-slate-500 sm:line-clamp-1">{subtitle}</p>}
          </>
        ) : (
          <>
            <h1 className="truncate text-base font-semibold text-slate-900">RDHS Insights Dashboard</h1>
            <p className="line-clamp-2 text-xs leading-snug text-slate-500 sm:line-clamp-1">Demographic and Health Survey 2019–20 · NISR</p>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {onDownloadCSV && (
          <button
            onClick={onDownloadCSV}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-smooth hover:bg-slate-50 hover:border-slate-300"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        )}
        <a
          href="https://askpro-chat.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open ASK DHS"
          className="flex min-h-10 items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-300/60"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">ASK DHS</span>
        </a>
      </div>
    </header>
  )
}
