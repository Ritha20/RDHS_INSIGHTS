'use client'

import { useQueries } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { fetchIndicator } from '@/lib/api'
import { fmtNum } from '@/lib/utils'
import KPICard from '@/components/cards/KPICard'
import Header from '@/components/layout/Header'
import RwandaMap from '@/components/charts/RwandaMap'
import VertBarChart from '@/components/charts/VertBarChart'
import { PROVINCES } from '@/lib/types'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const KPI_QUERIES = [
  {
    path: '/chapter3/fertility-rate',
    params: { rate_type: 'observed', region: '1' },
    title: 'Total Fertility Rate',
    description: 'Fertility & Marriage',
    color: 'blue' as const,
    compPath: '/chapter3/fertility-rate',
    compParams: { rate_type: 'observed' },
    unit: 'Children per woman',
    href: '/chapters/fertility',
  },
  {
    path: '/chapter5/delivery-assistance',
    params: { provider: 'skilled', region: '1' },
    title: 'Skilled Birth Attendance',
    description: 'Maternal Health',
    color: 'teal' as const,
    compPath: '/chapter5/delivery-assistance',
    compParams: { provider: 'skilled' },
    unit: 'Percentage',
    href: '/chapters/maternal-health',
  },
  {
    path: '/chapter7/stunting',
    params: { severity: 'any', region: '1' },
    title: 'Child Stunting',
    description: 'Nutrition',
    color: 'rose' as const,
    compPath: '/chapter7/stunting',
    compParams: { severity: 'any' },
    unit: 'Percentage',
    href: '/chapters/nutrition',
  },
  {
    path: '/chapter4/contraception-use',
    params: { method: 'modern', marital_status: 'married', region: '1' },
    title: 'Modern Contraceptive Use',
    description: 'Family Planning',
    color: 'green' as const,
    compPath: '/chapter4/contraception-use',
    compParams: { method: 'modern', marital_status: 'married' },
    unit: 'Percentage',
    href: '/chapters/family-planning',
  },
  {
    path: '/chapter9/hiv-testing',
    params: { gender: 'female', timing: 'ever', region: '1' },
    title: 'HIV Testing (Women)',
    description: 'HIV/AIDS & Infectious Diseases',
    color: 'amber' as const,
    compPath: '/chapter9/hiv-testing',
    compParams: { gender: 'female', timing: 'ever' },
    unit: 'Percentage',
    href: '/chapters/hiv-aids',
  },
]

export default function OverviewPage() {
  const [selectedKPI, setSelectedKPI] = useState(0)

  const kpiResults = useQueries({
    queries: KPI_QUERIES.map(q => ({
      queryKey: ['kpi', q.path, q.params],
      queryFn: () => fetchIndicator(q.path, q.params),
    })),
  })

  const selectedIndicator = KPI_QUERIES[selectedKPI]

  const compResults = useQueries({
    queries: PROVINCES.map(prov => ({
      queryKey: ['overview-comp', selectedIndicator.compPath, { ...selectedIndicator.compParams, region: String(prov.code) }],
      queryFn: () => fetchIndicator(selectedIndicator.compPath, { ...selectedIndicator.compParams, region: String(prov.code) }),
    })),
  })

  const compData = PROVINCES.map((p, i) => ({
    name: p.name,
    code: p.code,
    value: compResults[i]?.data?.provinces?.[0]?.value ?? null,
  }))

  const compNational = compResults[0]?.data?.national.value ?? null
  const compUnit = compResults[0]?.data?.unit ?? selectedIndicator.unit
  const compIndicatorName = compResults[0]?.data?.indicator ?? selectedIndicator.title
  const compPopType = compResults[0]?.data?.population_type ?? selectedIndicator.description
  const hasCompData = compResults.some(r => !!r.data)

  return (
    <>
      <Header />
      <div className="p-6 space-y-8">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-nisr-navy/20 bg-gradient-to-br from-nisr-navy to-nisr-navy-dark p-6 text-white shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold">Rwanda DHS 2019–20</h2>
              <p className="mt-1 text-white/80 text-sm max-w-xl">
                Explore health, fertility, nutrition, and demographic indicators across Rwanda&apos;s five provinces and 30 districts. Select a chapter from the sidebar to dive into detailed analytics.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {['10 Chapters', '40 Indicators', '5 Provinces', '30 Districts'].map(tag => (
                  <span key={tag} className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium border border-white/10">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* KPI cards */}
        <section>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Key National Indicators</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {KPI_QUERIES.map((q, i) => {
              const r = kpiResults[i]
              const value = r.data?.national.value
              const unit = r.data?.unit ?? ''
              const isPercent = unit === 'Percentage'
              const display = value != null ? `${fmtNum(value)}${isPercent ? '%' : ''}` : null
              return (
                <motion.div key={q.path + JSON.stringify(q.params)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                  <KPICard
                    title={q.title}
                    value={display}
                    unit={r.data?.unit ?? ''}
                    description={q.description}
                    color={q.color}
                    index={i}
                    isLoading={r.isLoading}
                    selected={selectedKPI === i}
                    onSelect={() => setSelectedKPI(i)}
                  />
                </motion.div>
              )
            })}
          </div>
        </section>

        {/* Province comparison: map + bar chart side by side */}
        <section>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold text-slate-900">{compIndicatorName} by Province</h3>
                  <div className="relative">
                    <select
                      value={selectedKPI}
                      onChange={e => setSelectedKPI(Number(e.target.value))}
                      className="appearance-none rounded-lg border border-slate-200 bg-slate-50 py-1 pl-2 pr-7 text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-nisr-navy/30 cursor-pointer"
                    >
                      {KPI_QUERIES.map((q, i) => <option key={i} value={i}>{q.title}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
                <p className="text-sm text-slate-500">{compPopType} · DHS Rwanda 2019–20</p>
              </div>
              {compNational != null && (
                <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                  National: {fmtNum(compNational)}{compUnit === 'Percentage' ? '%' : ` ${compUnit}`}
                </span>
              )}
            </div>

            {!hasCompData ? (
              <div className="flex h-64 items-center justify-center">
                <div className="flex gap-1.5">{[0, 1, 2].map(i => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-nisr-navy" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 text-center">Rwanda Provinces Map</p>
                  <RwandaMap data={compData} unit={compUnit} national={compNational} />
                </div>
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 text-center">Province Comparison</p>
                  <VertBarChart data={compData} national={compNational} unit={compUnit} indicator={compIndicatorName} />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Chapter links */}
        <section>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Explore by Chapter</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { slug: 'household', label: 'Household', emoji: '🏠' },
              { slug: 'demographics', label: 'Demographics', emoji: '👥' },
              { slug: 'fertility', label: 'Fertility', emoji: '👶' },
              { slug: 'family-planning', label: 'Family Planning', emoji: '💊' },
              { slug: 'maternal-health', label: 'Maternal Health', emoji: '🏥' },
              { slug: 'child-health', label: 'Child Health', emoji: '🛡️' },
              { slug: 'nutrition', label: 'Nutrition', emoji: '🥗' },
              { slug: 'malaria', label: 'Malaria', emoji: '🦟' },
              { slug: 'hiv-aids', label: 'HIV/AIDS', emoji: '🔬' },
              { slug: 'gender', label: 'Gender', emoji: '⚖️' },
            ].map((c, i) => (
              <motion.a key={c.slug} href={`/chapters/${c.slug}`}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm transition-smooth hover:border-nisr-navy/40 hover:shadow-md hover:-translate-y-0.5">
                <span className="text-2xl">{c.emoji}</span>
                <span className="text-xs font-medium text-slate-700">{c.label}</span>
              </motion.a>
            ))}
          </div>
        </section>

        <p className="text-center text-xs text-slate-400">
          Data source: Rwanda Demographic and Health Survey 2019–20 (RDHS-2020) · NISR
        </p>
      </div>
    </>
  )
}
