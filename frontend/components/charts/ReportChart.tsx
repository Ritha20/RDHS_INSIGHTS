'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchAllProvinces } from '@/lib/api'
import { CHAPTERS } from '@/lib/chapters'
import { PROVINCES } from '@/lib/types'
import RwandaMap from './RwandaMap'
import VertBarChart from './VertBarChart'
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts'
import { fmtNum } from '@/lib/utils'

/** Shape the report-builder backend already computes per indicator during
 * generation (national + province values). When present, the chart paints
 * immediately from this instead of re-fetching the same data over the network. */
export interface IndicatorStats {
  indicator?: string
  unit?: string
  year?: number | string
  national?: number | null
  provinces?: { name: string; value: number | null }[]
}

interface ReportChartProps {
  indicatorId: string
  chartType: 'bar' | 'map' | 'line' | 'pie' | 'kpi' | 'table'
  params?: Record<string, string>
  prefetched?: IndicatorStats
}

const COLORS = ['#1B3C74', '#0099D4', '#00756A', '#E07B39', '#6B4E9B', '#C8563E', '#64748B', '#2D6AAE']

export default function ReportChart({ indicatorId, chartType, params = {}, prefetched }: ReportChartProps) {
  const hasPrefetched = !!prefetched?.provinces?.length
  // Find indicator config in CHAPTERS
  const indicatorConfig = (() => {
    for (const chapter of CHAPTERS) {
      const found = chapter.indicators.find(ind => ind.id === indicatorId)
      if (found) return found
    }
    return null
  })()

  // Build current parameters
  const currentParams = (() => {
    if (!indicatorConfig) return {}
    const merged = { ...indicatorConfig.fixedParams }
    // Add default values for dynamic parameters if not present in params
    indicatorConfig.dynamicParams?.forEach(p => {
      merged[p.key] = params[p.key] ?? p.default
    })
    // Overwrite with custom parameters
    Object.entries(params).forEach(([k, v]) => {
      merged[k] = v
    })
    return merged
  })()

  // Fetch data for all provinces in parallel — skipped entirely when the report
  // agents already computed and attached these stats at generation time.
  const { data, isLoading, error } = useQuery({
    queryKey: ['report-chart', indicatorConfig?.path, currentParams],
    queryFn: () => fetchAllProvinces(indicatorConfig!.path, currentParams),
    enabled: !!indicatorConfig && !hasPrefetched,
  })

  if (!indicatorConfig) {
    return (
      <ChartState tone="warning" title="Unknown indicator" message={`Indicator ID "${indicatorId}" is not in the local DHS catalogue.`} />
    )
  }

  if (!hasPrefetched && isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl bg-white" role="status" aria-live="polite" aria-label={`Loading ${indicatorConfig.name} data`}>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-nisr-navy" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    )
  }

  if (!hasPrefetched && (error || !data)) {
    return (
      <ChartState tone="error" title="Could not load chart data" message="Check the API connection or choose another indicator." />
    )
  }

  // Format province comparison data — from the prefetched stats when available,
  // otherwise from the per-province network responses.
  const provinceData = PROVINCES.map((prov, i) => {
    if (hasPrefetched) {
      const match = prefetched!.provinces!.find(p => p.name === prov.name)
      return { name: prov.name, code: prov.code, value: match?.value ?? null }
    }
    const provResp = data![i]
    return {
      name: prov.name,
      code: prov.code,
      value: provResp?.provinces?.[0]?.value ?? null,
    }
  })

  const nationalValue = hasPrefetched ? (prefetched!.national ?? null) : (data![0]?.national?.value ?? null)
  const unit = hasPrefetched ? (prefetched!.unit ?? 'Percentage') : (data![0]?.unit ?? 'Percentage')
  const isPercent = unit === 'Percentage'
  const validProvinceData = provinceData.filter(p => p.value != null)
  const valueLabel = unit === 'Percentage' ? '%' : unit
  const chartAlt = `${indicatorConfig.name}. National value ${formatValue(nationalValue, isPercent)}. ${validProvinceData.length} province values available.`

  if (validProvinceData.length === 0 && nationalValue == null) {
    return (
      <ChartState
        tone="empty"
        title="No data available"
        message="This indicator returned no national or provincial values for the selected parameters."
      />
    )
  }

  // Render KPI Card
  if (chartType === 'kpi') {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm" role="img" aria-label={chartAlt}>
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">National Average</span>
        <div className="text-4xl font-extrabold text-nisr-navy mb-1">
          {nationalValue !== null ? `${fmtNum(nationalValue)}${isPercent ? '%' : ''}` : 'N/A'}
        </div>
        <div className="mt-1 max-w-xs text-center text-xs font-medium text-slate-500">
          {indicatorConfig.name} · DHS Rwanda {prefetched?.year ?? '2019-20'}
        </div>
        <ScreenReaderDataTable indicator={indicatorConfig.name} unit={unit} national={nationalValue} rows={provinceData} />
      </div>
    )
  }

  // Render HTML Data Table
  if (chartType === 'table') {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-xs text-left">
          <caption className="sr-only">{chartAlt}</caption>
          <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Region / Province</th>
              <th className="px-4 py-3 text-right">Value ({valueLabel})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            <tr className="bg-red-50/50 font-bold text-red-900">
              <td className="px-4 py-2.5">National Average</td>
              <td className="px-4 py-2.5 text-right">
                {nationalValue !== null ? `${fmtNum(nationalValue)}${isPercent ? '%' : ''}` : '—'}
              </td>
            </tr>
            {provinceData.map(p => (
              <tr key={p.code} className="hover:bg-slate-50/50">
                <td className="px-4 py-2.5 font-medium">{p.name}</td>
                <td className="px-4 py-2.5 text-right">
                  {p.value !== null ? `${fmtNum(p.value)}${isPercent ? '%' : ''}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Render Map View
  if (chartType === 'map') {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-slate-100 bg-white p-2" role="img" aria-label={chartAlt}>
        <RwandaMap data={provinceData} unit={unit} national={nationalValue} />
        <ScreenReaderDataTable indicator={indicatorConfig.name} unit={unit} national={nationalValue} rows={provinceData} />
      </div>
    )
  }

  // Render standard Vertical Bar Chart
  if (chartType === 'bar') {
    return (
      <div className="min-h-[280px] rounded-xl border border-slate-100 bg-white p-2" role="img" aria-label={chartAlt}>
        <VertBarChart data={provinceData} national={nationalValue} unit={unit} indicator={indicatorConfig.name} />
        <ScreenReaderDataTable indicator={indicatorConfig.name} unit={unit} national={nationalValue} rows={provinceData} />
      </div>
    )
  }

  // Render Line Chart
  if (chartType === 'line') {
    return (
      <div className="h-[280px] rounded-xl border border-slate-100 bg-white p-4" role="img" aria-label={chartAlt}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={provinceData} margin={{ top: 15, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip 
              formatter={(value: any) => [`${fmtNum(value)}${isPercent ? '%' : ''}`, indicatorConfig.name]}
              contentStyle={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
            />
            <Legend verticalAlign="top" height={36} iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
            <Line type="monotone" dataKey="value" name="Province Value" stroke="#0099D4" strokeWidth={3} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
        <ScreenReaderDataTable indicator={indicatorConfig.name} unit={unit} national={nationalValue} rows={provinceData} />
      </div>
    )
  }

  // Render Pie Chart
  if (chartType === 'pie') {
    // Normalise to percentage segments
    const pieData = validProvinceData
    return (
      <div className="flex h-[280px] flex-col justify-center rounded-xl border border-slate-100 bg-white p-4" role="img" aria-label={chartAlt}>
        <ResponsiveContainer width="100%" height="85%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: any) => [`${fmtNum(value)}${isPercent ? '%' : ''}`, 'Value']}
              contentStyle={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
            />
            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
          </PieChart>
        </ResponsiveContainer>
        <ScreenReaderDataTable indicator={indicatorConfig.name} unit={unit} national={nationalValue} rows={provinceData} />
      </div>
    )
  }

  return null
}

function formatValue(value: number | null | undefined, isPercent: boolean): string {
  if (value == null) return 'not available'
  return `${fmtNum(value)}${isPercent ? '%' : ''}`
}

function ChartState({ tone, title, message }: { tone: 'empty' | 'error' | 'warning'; title: string; message: string }) {
  const style = tone === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-800'
    : tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-slate-200 bg-slate-50 text-slate-600'

  return (
    <div className={`flex min-h-48 flex-col items-center justify-center rounded-xl border px-4 text-center ${style}`} role="status">
      <p className="text-xs font-bold">{title}</p>
      <p className="mt-1 max-w-sm text-[11px] leading-relaxed opacity-80">{message}</p>
    </div>
  )
}

function ScreenReaderDataTable({ indicator, unit, national, rows }: {
  indicator: string
  unit: string
  national: number | null
  rows: { name: string; value: number | null }[]
}) {
  return (
    <div className="sr-only">
      {indicator} data values, unit: {unit}. Rwanda National: {national == null ? 'not available' : fmtNum(national)}.
      {' '}
      {rows.map(row => `${row.name}: ${row.value == null ? 'not available' : fmtNum(row.value)}`).join('; ')}.
    </div>
  )
}
