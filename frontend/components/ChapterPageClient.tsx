'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQueries } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, ChevronDown } from 'lucide-react'
import { fetchIndicator } from '@/lib/api'
import { PROVINCES } from '@/lib/types'
import type { ChapterConfig, IndicatorConfig, IndicatorResponse } from '@/lib/types'
import { fmtNum, cn } from '@/lib/utils'
import DataTable from './DataTable'
import type { DataRow } from './DataTable'
import Header from './layout/Header'
import RwandaMap from './charts/RwandaMap'
import VertBarChart from './charts/VertBarChart'

interface Props {
  chapter: ChapterConfig
  initialData?: (IndicatorResponse | null)[]
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-nisr-navy/30 cursor-pointer">
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  )
}

export default function ChapterPageClient({ chapter, initialData }: Props) {
  const [selectedIndicatorId, setSelectedIndicatorId] = useState(chapter.indicators[0]?.id ?? '')
  const [dynamicParams, setDynamicParams] = useState<Record<string, string>>({})
  const [selectedProvince, setSelectedProvince] = useState<number | null>(null)

  const indicator: IndicatorConfig | undefined = useMemo(
    () => chapter.indicators.find(i => i.id === selectedIndicatorId),
    [chapter, selectedIndicatorId]
  )

  const currentParams = useMemo(() => {
    if (!indicator) return {}
    const params: Record<string, string> = { ...indicator.fixedParams }
    indicator.dynamicParams?.forEach(p => { params[p.key] = dynamicParams[p.key] ?? p.default })
    return params
  }, [indicator, dynamicParams])

  const handleIndicatorChange = useCallback((id: string) => {
    setSelectedIndicatorId(id)
    setDynamicParams({})
    setSelectedProvince(null)
  }, [])

  const isDefaultView = selectedIndicatorId === chapter.indicators[0]?.id && Object.keys(dynamicParams).length === 0

  const queries = useQueries({
    queries: indicator
      ? PROVINCES.map((prov, i) => ({
          queryKey: ['indicator', indicator.path, { ...currentParams, region: String(prov.code) }],
          queryFn: () => fetchIndicator(indicator.path, { ...currentParams, region: String(prov.code) }),
          enabled: !!indicator,
          ...(isDefaultView && initialData?.[i]
            ? { initialData: initialData[i]!, staleTime: 5 * 60 * 1000 }
            : {}),
        }))
      : [],
  })

  const isError = queries.every(q => q.isError)
  const firstSuccess = queries.find(q => q.data)?.data
  const hasAnyData = queries.some(q => !!q.data)
  const isLoading = !hasAnyData && queries.some(q => q.isPending || q.isFetching)

  const provinceData = useMemo(() =>
    queries.map((q, i) => ({
      name: PROVINCES[i].name,
      code: PROVINCES[i].code,
      value: q.data?.provinces?.[0]?.value ?? null,
      districts: q.data?.districts ?? [],
    })),
    [queries]
  )

  const districtData = useMemo(() => {
    if (!selectedProvince) return []
    const prov = queries.find((_, i) => PROVINCES[i].code === selectedProvince)
    return prov?.data?.districts ?? []
  }, [queries, selectedProvince])

  const unit = firstSuccess?.unit ?? 'Percentage'
  const national = firstSuccess?.national.value ?? null

  const tableRows = useMemo((): DataRow[] => {
    const rows: DataRow[] = []
    const nat = firstSuccess?.national.value

    if (selectedProvince) {
      // Province selected → show national + its districts only (no province row)
      if (nat != null) rows.push({ name: 'National', value: nat, type: 'national' })
      const provName = PROVINCES.find(p => p.code === selectedProvince)?.name ?? ''
      districtData.forEach(d => {
        rows.push({
          name: d.district_name,
          value: d.value,
          type: 'district',
          province: provName,
          provinceCode: selectedProvince,
        })
      })
    } else {
      // No province selected → national + all provinces
      if (nat != null) rows.push({ name: 'National', value: nat, type: 'national' })
      provinceData.forEach(p => {
        rows.push({ name: p.name, value: p.value, type: 'province' })
      })
    }

    return rows
  }, [provinceData, districtData, firstSuccess, selectedProvince])

  const districtChartData = useMemo(() =>
    districtData.map((d, i) => ({
      name: d.district_name,
      value: d.value,
      code: d.district_code ?? i,
    })),
    [districtData]
  )

  if (!indicator) return <div className="p-8 text-slate-500">No indicators available for this chapter.</div>

  const handleProvinceSelect = (code: number) => {
    setSelectedProvince(prev => prev === code ? null : code)
  }

  return (
    <>
      <Header
        title={chapter.title}
        subtitle={firstSuccess ? `${firstSuccess.population_type} · ${firstSuccess.data_source}` : 'DHS Rwanda 2019–20'}
      />

      <div className="p-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <Select
            label="Indicator"
            value={selectedIndicatorId}
            onChange={handleIndicatorChange}
            options={chapter.indicators.map(i => ({ value: i.id, label: i.name }))}
          />
          {indicator.dynamicParams?.map(param => (
            <Select
              key={param.key}
              label={param.label}
              value={dynamicParams[param.key] ?? param.default}
              onChange={v => setDynamicParams(prev => ({ ...prev, [param.key]: v }))}
              options={param.options}
            />
          ))}
        </div>

        {isError && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />Failed to load data. Please try again.
          </div>
        )}

        {/* Main chart: Map + Bar side by side */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${selectedIndicatorId}-${JSON.stringify(currentParams)}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{firstSuccess?.indicator ?? indicator.name}</h2>
                <p className="text-sm text-slate-500 mt-0.5">{indicator.description}</p>
              </div>
              {national != null && (
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                  National: {fmtNum(national)}{unit === 'Percentage' ? '%' : ` ${unit}`}
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="flex h-72 items-center justify-center">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-nisr-navy" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 text-center">Rwanda Provinces Map</p>
                  <RwandaMap
                    data={provinceData}
                    unit={unit}
                    national={national}
                    onSelect={handleProvinceSelect}
                    selected={selectedProvince}
                    districtData={districtChartData}
                  />
                </div>
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 text-center">Province Comparison</p>
                  <VertBarChart
                    data={provinceData}
                    national={national}
                    unit={unit}
                    indicator={firstSuccess?.indicator ?? indicator.name}
                    onSelect={handleProvinceSelect}
                    selected={selectedProvince}
                  />
                  {!selectedProvince && (
                    <p className="mt-2 text-center text-xs text-slate-400">Click a bar or province to see district breakdown</p>
                  )}
                  {selectedProvince && (
                    <p className="mt-2 text-center text-xs text-slate-400">
                      Showing {PROVINCES.find(p => p.code === selectedProvince)?.name} · Click again to deselect
                    </p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* District breakdown */}
        {!isLoading && selectedProvince && districtChartData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-800">
                District Breakdown ·{' '}
                <span className="font-normal text-slate-500">
                  {PROVINCES.find(p => p.code === selectedProvince)?.name}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {districtChartData.length} districts · {firstSuccess?.indicator ?? indicator.name}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 text-center">Map View</p>
                <RwandaMap
                  data={provinceData}
                  unit={unit}
                  national={national}
                  selected={selectedProvince}
                  districtData={districtChartData}
                />
              </div>
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 text-center">District Bar Chart</p>
                <VertBarChart
                  data={districtChartData}
                  national={national}
                  unit={unit}
                  indicator={firstSuccess?.indicator ?? indicator.name}
                  height={districtChartData.length > 5 ? districtChartData.length * 48 : 300}
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Data table */}
        {!isLoading && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Data Table</h3>
              {!selectedProvince && (
                <p className="text-xs text-slate-400">Click a province on the map or chart to add district data</p>
              )}
            </div>
            <DataTable
              rows={tableRows}
              unit={unit}
              indicator={firstSuccess?.indicator ?? indicator.name}
            />
          </div>
        )}
      </div>
    </>
  )
}
