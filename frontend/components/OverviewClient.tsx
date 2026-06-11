'use client'

import { useQueries } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { fetchIndicator } from '@/lib/api'
import { fmtNum } from '@/lib/utils'
import KPICard from '@/components/cards/KPICard'
import Header from '@/components/layout/Header'
import ProvinceBarChart from '@/components/charts/ProvinceBarChart'
import { PROVINCES } from '@/lib/types'
import { useState } from 'react'
import type { IndicatorResponse } from '@/lib/types'

const KPI_QUERIES = [
  { path: '/chapter3/fertility-rate', params: { rate_type: 'observed', region: '1' }, title: 'Total Fertility Rate', description: 'National avg', color: 'blue' as const },
  { path: '/chapter4/contraception-use', params: { method: 'modern', marital_status: 'married', region: '1' }, title: 'Modern Contraceptive Use', description: 'Married women', color: 'green' as const },
  { path: '/chapter5/delivery-assistance', params: { provider: 'skilled', region: '1' }, title: 'Skilled Birth Attendance', description: 'Last 5 years', color: 'teal' as const },
  { path: '/chapter7/stunting', params: { severity: 'any', region: '1' }, title: 'Child Stunting', description: 'Children < 5', color: 'rose' as const },
  { path: '/chapter8/itn-ownership', params: { region: '1' }, title: 'ITN Ownership', description: 'Households', color: 'purple' as const },
  { path: '/chapter9/hiv-testing', params: { gender: 'female', timing: 'ever', region: '1' }, title: 'HIV Testing (Women)', description: 'Ever tested, age 15-49', color: 'amber' as const },
]

const COMPARISON_QUERIES = PROVINCES.map((p) => ({
  path: '/chapter4/contraception-use',
  params: { method: 'modern', marital_status: 'married', region: String(p.code) },
  province: p,
}))

interface Props {
  kpiData: (IndicatorResponse | null)[]
  compData: (IndicatorResponse | null)[]
}

export default function OverviewClient({ kpiData, compData }: Props) {
  const [, setSelectedProvince] = useState<number | null>(null)

  const kpiResults = useQueries({
    queries: KPI_QUERIES.map((q, i) => ({
      queryKey: ['kpi', q.path, q.params],
      queryFn: () => fetchIndicator(q.path, q.params),
      initialData: kpiData[i] ?? undefined,
      initialDataUpdatedAt: kpiData[i] ? Date.now() : undefined,
    })),
  })

  const compResults = useQueries({
    queries: COMPARISON_QUERIES.map((q, i) => ({
      queryKey: ['overview-comp', q.path, q.params],
      queryFn: () => fetchIndicator(q.path, q.params),
      initialData: compData[i] ?? undefined,
      initialDataUpdatedAt: compData[i] ? Date.now() : undefined,
    })),
  })

  const compChartData = PROVINCES.map((p, i) => ({
    name: p.name,
    code: p.code,
    value: compResults[i]?.data?.provinces?.[0]?.value ?? null,
    districts: compResults[i]?.data?.districts ?? [],
  }))

  const compNational = compResults[0]?.data?.national.value ?? null
  const hasCompData = compResults.some((r) => !!r.data)

  return (
    <>
      <Header />

      <div className="print-only p-6 border-b mb-4">
        <h1 className="text-2xl font-bold text-slate-900">DHS Rwanda Analytics Dashboard</h1>
        <p className="text-slate-600">Overview Report · Demographic and Health Survey 2019–20</p>
        <p className="text-slate-500 text-sm">Generated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <div className="p-6 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-green-200 bg-gradient-to-br from-rwanda-green to-green-700 p-6 text-white shadow-sm"
        >
          <h2 className="text-xl font-bold">Rwanda DHS 2019–20</h2>
          <p className="mt-1 text-green-100/90 text-sm max-w-xl">
            Explore health, fertility, nutrition, and demographic indicators across Rwanda&apos;s five provinces and 30 districts. Select a chapter from the sidebar to dive into detailed analytics.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {['10 Chapters', '40 Indicators', '5 Provinces', '30 Districts'].map((tag) => (
              <span key={tag} className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                {tag}
              </span>
            ))}
          </div>
        </motion.div>

        <section>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Key National Indicators
          </h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-3">
            {KPI_QUERIES.map((q, i) => {
              const r = kpiResults[i]
              const value = r.data?.national.value
              const unit = r.data?.unit ?? ''
              const isPercent = unit === 'Percentage'
              const display = value != null
                ? `${fmtNum(value)}${isPercent ? '%' : ''}`
                : null
              return (
                <KPICard
                  key={q.path + JSON.stringify(q.params)}
                  title={q.title}
                  value={display}
                  unit={r.data?.unit ?? ''}
                  description={q.description}
                  color={q.color}
                  index={i}
                  isLoading={!r.data && r.isLoading}
                />
              )
            })}
          </div>
        </section>

        <section>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Modern Contraceptive Use by Province</h3>
                <p className="text-sm text-slate-500">Married women 15-49 · DHS Rwanda 2019–20</p>
              </div>
              {compNational != null && (
                <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                  National: {fmtNum(compNational)}%
                </span>
              )}
            </div>
            {!hasCompData ? (
              <div className="flex h-56 items-center justify-center">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="inline-block h-2 w-2 animate-bounce rounded-full bg-rwanda-green" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            ) : (
              <ProvinceBarChart
                data={compChartData}
                national={compNational}
                unit="Percentage"
                indicator="Modern Contraceptive Use"
                onSelectProvince={(code) => setSelectedProvince(code)}
              />
            )}
          </div>
        </section>

        <section>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Explore by Chapter
          </h3>
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
              <motion.a
                key={c.slug}
                href={`/chapters/${c.slug}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm transition-smooth hover:border-rwanda-green/40 hover:shadow-md hover:-translate-y-0.5"
              >
                <span className="text-2xl">{c.emoji}</span>
                <span className="text-xs font-medium text-slate-700">{c.label}</span>
              </motion.a>
            ))}
          </div>
        </section>

        <p className="text-center text-xs text-slate-400">
          Data source: Rwanda Demographic and Health Survey 2019–20 (RDHS-2020) · NISR &amp; ICF International
        </p>
      </div>
    </>
  )
}
