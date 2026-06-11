'use client'

import { useState, useCallback } from 'react'
import { X, FileText, Download, Printer, ChevronDown, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CHAPTERS } from '@/lib/chapters'

interface SelectedIndicator {
  chapterSlug: string
  chapterTitle: string
  indicatorId: string
  indicatorName: string
  params: Record<string, string>
  description: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  currentIndicator?: SelectedIndicator
  currentRegions?: { type: 'province' | 'district' | 'national'; name: string; value: number | null }[]
  reportTitle?: string
  reportContent?: string
}

const PROVINCES = ['Kigali City', 'Southern Province', 'Western Province', 'Northern Province', 'Eastern Province']

function generateWordDoc(html: string, title: string): void {
  const doc = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta name=ProgId content=Word.Document>
<meta name=Generator content="Microsoft Word 15">
<meta name=Originator content="Microsoft Word 15">
<title>${title}</title>
<style>
  body { font-family: Calibri, sans-serif; font-size: 11pt; color: #1e293b; margin: 2cm; }
  h1 { font-size: 18pt; color: #15803d; border-bottom: 2px solid #15803d; padding-bottom: 6pt; }
  h2 { font-size: 14pt; color: #166534; margin-top: 18pt; }
  h3 { font-size: 12pt; color: #374151; margin-top: 12pt; }
  table { width: 100%; border-collapse: collapse; margin: 12pt 0; font-size: 10pt; }
  th { background: #f0fdf4; color: #166534; padding: 6pt 8pt; text-align: left; border: 1px solid #bbf7d0; font-weight: bold; }
  td { padding: 5pt 8pt; border: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  .national-badge { color: #dc2626; font-weight: bold; }
  .province-badge { color: #1d4ed8; }
  .meta { color: #64748b; font-size: 9pt; }
  .section { page-break-inside: avoid; }
  .highlight { background: #f0fdf4; padding: 8pt; border-left: 3px solid #15803d; margin: 6pt 0; }
</style>
</head>
<body>
${html}
</body>
</html>`
  const blob = new Blob([doc], { type: 'application/vnd.ms-word' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/\s+/g, '_')}_Report.doc`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportModal({ isOpen, onClose, currentIndicator, currentRegions, reportTitle, reportContent }: Props) {
  const [selectedIndicators, setSelectedIndicators] = useState<Set<string>>(
    currentIndicator ? new Set([`${currentIndicator.chapterSlug}::${currentIndicator.indicatorId}`]) : new Set()
  )
  const [selectedProvinces, setSelectedProvinces] = useState<Set<string>>(new Set(PROVINCES))
  const [includeDistricts, setIncludeDistricts] = useState(false)
  const [includeNational, setIncludeNational] = useState(true)
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    new Set(currentIndicator ? [currentIndicator.chapterSlug] : [CHAPTERS[0].slug])
  )
  const [format, setFormat] = useState<'pdf' | 'word'>('pdf')
  const [tab, setTab] = useState<'content' | 'geography' | 'format'>('content')

  const toggleIndicator = (key: string) => {
    setSelectedIndicators(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const toggleChapter = (slug: string) => {
    const chapter = CHAPTERS.find(c => c.slug === slug)
    if (!chapter) return
    const chapterKeys = chapter.indicators.map(i => `${slug}::${i.id}`)
    const allSelected = chapterKeys.every(k => selectedIndicators.has(k))
    setSelectedIndicators(prev => {
      const next = new Set(prev)
      if (allSelected) chapterKeys.forEach(k => next.delete(k))
      else chapterKeys.forEach(k => next.add(k))
      return next
    })
  }

  const toggleProvince = (prov: string) => {
    setSelectedProvinces(prev => {
      const next = new Set(prev)
      next.has(prov) ? next.delete(prov) : next.add(prov)
      return next
    })
  }

  const buildReportHTML = useCallback(() => {
    const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const regionFilter = (rows: typeof currentRegions) => {
      if (!rows) return []
      return rows.filter(r => {
        if (r.type === 'national') return includeNational
        if (r.type === 'province') return selectedProvinces.has(r.name)
        if (r.type === 'district') return includeDistricts
        return false
      })
    }

    const selectedIndicatorsList = CHAPTERS.flatMap(ch =>
      ch.indicators
        .filter(ind => selectedIndicators.has(`${ch.slug}::${ind.id}`))
        .map(ind => ({ chapter: ch, indicator: ind }))
    )

    let html = `
      <h1>DHS Rwanda Analytics Report</h1>
      <p class="meta">Demographic and Health Survey 2019–20 · NISR &amp; ICF International</p>
      <p class="meta">Report generated: ${now}</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:12pt 0">
    `

    if (selectedIndicatorsList.length === 0 && currentIndicator) {
      const rows = regionFilter(currentRegions)
      html += `
        <div class="section">
          <h2>${currentIndicator.chapterTitle} — ${currentIndicator.indicatorName}</h2>
          <div class="highlight">${currentIndicator.description}</div>
          ${rows.length > 0 ? `
            <h3>Regional Data</h3>
            <table>
              <thead><tr><th>Region</th><th>Type</th><th>Value</th></tr></thead>
              <tbody>
                ${rows.map(r => `<tr><td>${r.name}</td><td class="${r.type}-badge">${r.type}</td><td>${r.value != null ? r.value.toFixed(1) : 'N/A'}</td></tr>`).join('')}
              </tbody>
            </table>
          ` : '<p>No regional data selected.</p>'}
        </div>
      `
    } else {
      selectedIndicatorsList.forEach(({ chapter, indicator }) => {
        html += `
          <div class="section">
            <h2>${chapter.title} — ${indicator.name}</h2>
            <div class="highlight">${indicator.description}</div>
            <p class="meta">API Path: ${indicator.path} · Chapter: ${chapter.slug}</p>
          </div>
        `
      })
    }

    html += `
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:12pt 0">
      <p class="meta">Data Source: Rwanda Demographic and Health Survey 2019–20</p>
      <p class="meta">Produced by National Institute of Statistics of Rwanda (NISR) and ICF International</p>
    `
    return html
  }, [selectedIndicators, selectedProvinces, includeDistricts, includeNational, currentIndicator, currentRegions])

  const handleGenerate = () => {
    if (format === 'pdf') {
      onClose()
      setTimeout(() => window.print(), 100)
    } else {
      const title = reportTitle || 'DHS Rwanda Analytics'
      const html = buildReportHTML()
      generateWordDoc(html, title)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rwanda-green/10">
              <FileText className="h-4 w-4 text-rwanda-green" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Generate Report</h2>
              <p className="text-xs text-slate-500">Choose content, regions, and format</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          {(['content', 'geography', 'format'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors capitalize', tab === t ? 'border-rwanda-green text-rwanda-green' : 'border-transparent text-slate-500 hover:text-slate-700')}>
              {t === 'content' ? '1. Content' : t === 'geography' ? '2. Geography' : '3. Format'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'content' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Select which indicators to include in the report.</p>
              {currentIndicator && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                  <span className="font-medium">Currently viewing:</span> {currentIndicator.chapterTitle} → {currentIndicator.indicatorName}
                </div>
              )}
              {CHAPTERS.map(ch => {
                const isExpanded = expandedChapters.has(ch.slug)
                const chapterKeys = ch.indicators.map(i => `${ch.slug}::${i.id}`)
                const selectedCount = chapterKeys.filter(k => selectedIndicators.has(k)).length
                const allSelected = selectedCount === chapterKeys.length
                return (
                  <div key={ch.slug} className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 cursor-pointer hover:bg-slate-100"
                      onClick={() => setExpandedChapters(prev => { const n = new Set(prev); isExpanded ? n.delete(ch.slug) : n.add(ch.slug); return n })}>
                      <input type="checkbox" checked={allSelected} onChange={() => toggleChapter(ch.slug)}
                        onClick={e => e.stopPropagation()} className="rounded text-rwanda-green" />
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                      <span className="font-medium text-sm text-slate-800">{ch.title}</span>
                      {selectedCount > 0 && (
                        <span className="ml-auto rounded-full bg-rwanda-green/10 px-2 py-0.5 text-[11px] font-medium text-rwanda-green">
                          {selectedCount}/{chapterKeys.length}
                        </span>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="divide-y divide-slate-50">
                        {ch.indicators.map(ind => {
                          const key = `${ch.slug}::${ind.id}`
                          return (
                            <label key={key} className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                              <input type="checkbox" checked={selectedIndicators.has(key)} onChange={() => toggleIndicator(key)}
                                className="mt-0.5 rounded text-rwanda-green" />
                              <div>
                                <p className="text-sm font-medium text-slate-700">{ind.name}</p>
                                <p className="text-xs text-slate-400">{ind.description}</p>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {tab === 'geography' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Choose which regions to include in the report.</p>
              <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
                <input type="checkbox" id="incl-national" checked={includeNational} onChange={e => setIncludeNational(e.target.checked)} className="rounded text-rwanda-green" />
                <label htmlFor="incl-national" className="text-sm font-medium text-slate-700 cursor-pointer">Include National Summary</label>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">Provinces</p>
                  <button onClick={() => setSelectedProvinces(selectedProvinces.size === 5 ? new Set() : new Set(PROVINCES))}
                    className="text-xs text-rwanda-green hover:underline">
                    {selectedProvinces.size === 5 ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="space-y-2">
                  {PROVINCES.map(prov => (
                    <label key={prov} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" checked={selectedProvinces.has(prov)} onChange={() => toggleProvince(prov)} className="rounded text-rwanda-green" />
                      <span className="text-sm text-slate-700">{prov}</span>
                      {selectedProvinces.has(prov) && <Check className="h-3.5 w-3.5 text-rwanda-green ml-auto" />}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
                <input type="checkbox" id="incl-districts" checked={includeDistricts} onChange={e => setIncludeDistricts(e.target.checked)} className="rounded text-rwanda-green" />
                <label htmlFor="incl-districts" className="text-sm font-medium text-slate-700 cursor-pointer">Include District-Level Breakdown</label>
              </div>
            </div>
          )}

          {tab === 'format' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Choose how to export your report.</p>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setFormat('pdf')}
                  className={cn('flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all', format === 'pdf' ? 'border-rwanda-green bg-green-50' : 'border-slate-200 hover:border-slate-300')}>
                  <Printer className={cn('h-8 w-8', format === 'pdf' ? 'text-rwanda-green' : 'text-slate-400')} />
                  <div className="text-center">
                    <p className="font-semibold text-slate-800">PDF</p>
                    <p className="text-xs text-slate-500 mt-1">Opens browser print dialog. Choose "Save as PDF" to download.</p>
                  </div>
                </button>
                <button onClick={() => setFormat('word')}
                  className={cn('flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all', format === 'word' ? 'border-rwanda-green bg-green-50' : 'border-slate-200 hover:border-slate-300')}>
                  <Download className={cn('h-8 w-8', format === 'word' ? 'text-rwanda-green' : 'text-slate-400')} />
                  <div className="text-center">
                    <p className="font-semibold text-slate-800">Word (.doc)</p>
                    <p className="text-xs text-slate-500 mt-1">Downloads an HTML document that opens in Microsoft Word.</p>
                  </div>
                </button>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-medium">Note on report content</p>
                <p className="mt-1 text-xs">The printed report includes all charts and tables currently visible on the page. For a complete multi-chapter report, open each chapter and print individually.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <span className="text-xs text-slate-500">
            {selectedIndicators.size} indicator{selectedIndicators.size !== 1 ? 's' : ''} · {selectedProvinces.size} province{selectedProvinces.size !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleGenerate}
              className="flex items-center gap-2 rounded-lg bg-rwanda-green px-4 py-2 text-sm font-medium text-white hover:bg-rwanda-green-dark transition-colors">
              {format === 'pdf' ? <Printer className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
              {format === 'pdf' ? 'Print / Save PDF' : 'Download Word'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
