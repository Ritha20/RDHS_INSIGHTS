'use client'

import { useState, useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Plus, X, ChevronDown, BarChart2 } from 'lucide-react'
import { fetchIndicator } from '@/lib/api'
import { PROVINCES } from '@/lib/types'
import { CHAPTERS } from '@/lib/chapters'
import { fmtNum, cn } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend
} from 'recharts'
import Header from './layout/Header'
import RwandaMap from './charts/RwandaMap'
import VertBarChart from './charts/VertBarChart'

interface SelectedIndicator {
  id: string
  chapterSlug: string
  chapterTitle: string
  indicatorId: string
  indicatorName: string
  path: string
  params: Record<string, string>
  color: string
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-rwanda-green/30 cursor-pointer">
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  )
}

const INDICATOR_COLORS = ['#1B3C74', '#0099D4', '#2D6AAE', '#00756A', '#E07B39', '#6B4E9B', '#C8563E', '#3D8C5A']

export default function CompareClient() {
  const [selectedIndicators, setSelectedIndicators] = useState<SelectedIndicator[]>([])
  const [addChapter, setAddChapter] = useState(CHAPTERS[0].slug)
  const [addIndicator, setAddIndicator] = useState(CHAPTERS[0].indicators[0].id)
  const [addParams, setAddParams] = useState<Record<string, string>>({})
  const [compareMode, setCompareMode] = useState<'province' | 'indicator'>('province')

  const chapter = CHAPTERS.find(c => c.slug === addChapter)!
  const indicatorConfig = chapter?.indicators.find(i => i.id === addIndicator)

  const handleAddChapterChange = (slug: string) => {
    setAddChapter(slug)
    const ch = CHAPTERS.find(c => c.slug === slug)!
    setAddIndicator(ch.indicators[0].id)
    setAddParams({})
  }

  const handleAddIndicatorChange = (id: string) => {
    setAddIndicator(id)
    setAddParams({})
  }

  const handleAdd = () => {
    if (!indicatorConfig) return
    const params: Record<string, string> = { ...indicatorConfig.fixedParams }
    indicatorConfig.dynamicParams?.forEach(p => { params[p.key] = addParams[p.key] ?? p.default })
    const id = `${addChapter}::${addIndicator}::${JSON.stringify(params)}`
    if (selectedIndicators.find(s => s.id === id)) return
    setSelectedIndicators(prev => [
      ...prev,
      {
        id,
        chapterSlug: addChapter,
        chapterTitle: chapter.title,
        indicatorId: addIndicator,
        indicatorName: indicatorConfig.name,
        path: indicatorConfig.path,
        params,
        color: INDICATOR_COLORS[prev.length % INDICATOR_COLORS.length],
      }
    ])
  }

  const queries = useQueries({
    queries: selectedIndicators.flatMap(ind =>
      PROVINCES.map(prov => ({
        queryKey: ['compare', ind.path, { ...ind.params, region: String(prov.code) }],
        queryFn: () => fetchIndicator(ind.path, { ...ind.params, region: String(prov.code) }),
        enabled: selectedIndicators.length > 0,
      }))
    ),
  })

  const indicatorData = useMemo(() => {
    return selectedIndicators.map((ind, indIdx) => {
      const provData = PROVINCES.map((prov, provIdx) => {
        const q = queries[indIdx * PROVINCES.length + provIdx]
        return {
          name: prov.name,
          code: prov.code,
          value: q?.data?.provinces?.[0]?.value ?? null,
        }
      })
      const national = queries[indIdx * PROVINCES.length]?.data?.national?.value ?? null
      const unit = queries[indIdx * PROVINCES.length]?.data?.unit ?? 'Percentage'
      const isLoading = queries.slice(indIdx * PROVINCES.length, (indIdx + 1) * PROVINCES.length).some(q => q.isPending)
      return { ...ind, provData, national, unit, isLoading }
    })
  }, [selectedIndicators, queries])

  const groupedByProvince = useMemo(() => {
    if (!indicatorData.length) return []
    return PROVINCES.map(prov => {
      const entry: Record<string, any> = { name: prov.name, code: prov.code }
      indicatorData.forEach(ind => {
        entry[ind.id] = ind.provData.find(p => p.code === prov.code)?.value ?? null
      })
      return entry
    })
  }, [indicatorData])

  const isLoading = queries.some(q => q.isPending)
  const hasData = indicatorData.some(ind => ind.provData.some(p => p.value != null))

  const fmt = (v: number, unit: string) => unit === 'Percentage' ? `${fmtNum(v)}%` : fmtNum(v)

  return (
    <>
      <Header title="Compare Regions" subtitle="Compare indicators across provinces · DHS Rwanda 2019–20" />
      <div className="p-6 space-y-6">
        {/* Hero */}
        <div className="rounded-xl border border-nisr-navy/20 bg-nisr-navy p-5 text-white">
          <h2 className="text-lg font-bold">Regional Indicator Comparison</h2>
          <p className="mt-1 text-white/75 text-sm">Add indicators from any chapter and compare them side-by-side across Rwanda's five provinces.</p>
        </div>

        {/* Add indicator */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Add an Indicator to Compare</h3>
          <div className="flex flex-wrap items-end gap-3">
            <Select label="Chapter" value={addChapter} onChange={handleAddChapterChange}
              options={CHAPTERS.map(c => ({ value: c.slug, label: c.title }))} />
            <Select label="Indicator" value={addIndicator} onChange={handleAddIndicatorChange}
              options={(CHAPTERS.find(c => c.slug === addChapter)?.indicators ?? []).map(i => ({ value: i.id, label: i.name }))} />
            {indicatorConfig?.dynamicParams?.map(param => (
              <Select key={param.key} label={param.label} value={addParams[param.key] ?? param.default}
                onChange={v => setAddParams(prev => ({ ...prev, [param.key]: v }))}
                options={param.options} />
            ))}
            <button onClick={handleAdd}
              className="flex items-center gap-2 rounded-lg bg-rwanda-green px-4 py-2 text-sm font-medium text-white hover:bg-rwanda-green-dark transition-colors">
              <Plus className="h-4 w-4" />Add to Comparison
            </button>
          </div>
        </div>

        {/* Selected indicators chips */}
        {selectedIndicators.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedIndicators.map(ind => (
              <div key={ind.id} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white pl-1 pr-2 py-1 shadow-sm text-sm">
                <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: ind.color }} />
                <span className="font-medium text-slate-700">{ind.indicatorName}</span>
                <span className="text-slate-400 text-xs">({ind.chapterTitle})</span>
                <button onClick={() => setSelectedIndicators(prev => prev.filter(s => s.id !== ind.id))}
                  className="ml-1 rounded-full p-0.5 hover:bg-slate-100 text-slate-400">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {selectedIndicators.length > 1 && (
              <button onClick={() => setSelectedIndicators([])}
                className="text-xs text-slate-400 hover:text-red-500 px-2">Clear all</button>
            )}
          </div>
        )}

        {selectedIndicators.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16 text-slate-400">
            <BarChart2 className="h-10 w-10 mb-3 opacity-30" />
            <p className="font-medium">No indicators selected</p>
            <p className="text-sm mt-1">Add an indicator above to start comparing</p>
          </div>
        )}

        {selectedIndicators.length > 0 && (
          <>
            {/* Chart controls */}
            {selectedIndicators.length > 1 && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1 w-fit">
                <button onClick={() => setCompareMode('province')}
                  className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-all', compareMode === 'province' ? 'bg-nisr-navy text-white shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                  By Province
                </button>
                <button onClick={() => setCompareMode('indicator')}
                  className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-all', compareMode === 'indicator' ? 'bg-nisr-navy text-white shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                  By Indicator
                </button>
              </div>
            )}

            {/* Grouped comparison chart */}
            {selectedIndicators.length > 1 && compareMode === 'province' && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-1 text-base font-semibold text-slate-900">Multi-Indicator Comparison by Province</h3>
                <p className="mb-4 text-xs text-slate-500">Side-by-side comparison. Note: indicators may use different units and scales.</p>
                {isLoading ? (
                  <div className="flex h-56 items-center justify-center">
                    <div className="flex gap-1.5">{[0, 1, 2].map(i => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-rwanda-green" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={groupedByProvince} margin={{ top: 8, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false}
                        interval={0} angle={-20} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload) return null
                          return (
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-sm">
                              <p className="font-semibold text-slate-800 mb-1">{label}</p>
                              {payload.map((p: any) => (
                                <p key={p.dataKey} className="text-slate-600" style={{ color: p.fill }}>
                                  {p.name}: <b>{p.value != null ? fmtNum(p.value) : 'N/A'}</b>
                                </p>
                              ))}
                            </div>
                          )
                        }}
                      />
                      <Legend formatter={(value) => <span style={{ fontSize: 11, color: '#374151' }}>{value}</span>} />
                      {selectedIndicators.map((ind, i) => (
                        <Bar key={ind.id} dataKey={ind.id} name={ind.indicatorName} fill={ind.color}
                          radius={[3, 3, 0, 0]} maxBarSize={40} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {/* Individual indicator charts */}
            <div className="grid gap-6 grid-cols-1">
              {indicatorData.map(ind => (
                <div key={ind.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-1 h-3 w-3 rounded-full flex-shrink-0" style={{ background: ind.color }} />
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{ind.indicatorName}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{ind.chapterTitle}</p>
                      </div>
                    </div>
                    {ind.national != null && (
                      <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                        National: {fmt(ind.national, ind.unit)}
                      </span>
                    )}
                  </div>
                  {ind.isLoading ? (
                    <div className="flex h-64 items-center justify-center">
                      <div className="flex gap-1.5">{[0, 1, 2].map(i => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-nisr-navy" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 text-center">Rwanda Provinces Map</p>
                        <RwandaMap
                          data={ind.provData}
                          unit={ind.unit}
                          national={ind.national}
                        />
                      </div>
                      <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 text-center">Province Comparison</p>
                        <VertBarChart
                          data={ind.provData}
                          national={ind.national}
                          unit={ind.unit}
                          indicator={ind.indicatorName}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Comparison table */}
            {hasData && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm overflow-x-auto">
                <h3 className="mb-4 text-sm font-semibold text-slate-800">Summary Table</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Province</th>
                      {indicatorData.map(ind => (
                        <th key={ind.id} className="px-4 py-2.5 text-right font-semibold text-slate-600 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: ind.color }} />
                            {ind.indicatorName}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100 bg-red-50/30">
                      <td className="px-4 py-2 font-medium text-red-700">National</td>
                      {indicatorData.map(ind => (
                        <td key={ind.id} className="px-4 py-2 text-right font-semibold text-red-700">
                          {ind.national != null ? fmt(ind.national, ind.unit) : '—'}
                        </td>
                      ))}
                    </tr>
                    {PROVINCES.map(prov => (
                      <tr key={prov.code} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-2 font-medium text-slate-800">{prov.name}</td>
                        {indicatorData.map(ind => {
                          const val = ind.provData.find(p => p.code === prov.code)?.value ?? null
                          return (
                            <td key={ind.id} className="px-4 py-2 text-right text-slate-700">
                              {val != null ? fmt(val, ind.unit) : <span className="text-slate-300">—</span>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
