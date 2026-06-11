'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, LabelList, LineChart, Line, PieChart, Pie, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Sector
} from 'recharts'
import { cn, fmtNum } from '@/lib/utils'

export type ChartType = 'bar-h' | 'bar-v' | 'line' | 'pie' | 'radar'

export interface ChartEntry {
  name: string
  value: number | null
  code: number
}

interface Props {
  data: ChartEntry[]
  national?: number | null
  unit: string
  indicator: string
  chartType: ChartType
  onSelect?: (code: number, name: string) => void
  selected?: number | null
  height?: number
  colors?: string[]
}

export const CHART_COLORS = ['#1d4ed8', '#0f766e', '#7c3aed', '#b45309', '#0369a1', '#be185d', '#c2410c', '#0891b2', '#15803d', '#7e22ce']
const SELECTED_COLOR = '#1a6b3c'

function formatVal(v: number, unit: string) {
  return unit === 'Percentage' ? `${fmtNum(v)}%` : fmtNum(v)
}

const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-sm">
      <p className="font-semibold text-slate-800">{label ?? payload[0]?.name}</p>
      <p className="text-slate-600">
        {v != null ? formatVal(v, unit) : 'N/A'}
      </p>
    </div>
  )
}

function HorizBar({ data, national, unit, indicator, onSelect, selected, height, colors }: Props) {
  const valid = data.filter(d => d.value != null)
  const max = valid.length ? Math.max(...valid.map(d => d.value!)) : 100
  const domainMax = unit === 'Percentage' ? Math.min(100, Math.ceil(max * 1.2)) : Math.ceil(max * 1.2)
  const fmt = (v: number) => unit === 'Percentage' ? `${fmtNum(v)}%` : fmtNum(v)

  return (
    <ResponsiveContainer width="100%" height={height ?? (data.length <= 6 ? 280 : data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 64, left: 10, bottom: 4 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" domain={[0, domainMax]} tickFormatter={v => unit === 'Percentage' ? `${v}%` : String(v)}
          tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={data.length > 5 ? 120 : 130}
          tick={{ fontSize: data.length > 5 ? 11 : 12, fill: '#374151', fontWeight: 500 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip unit={unit} />} cursor={{ fill: '#f8fafc' }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}
          onClick={d => onSelect?.(d.code, d.name)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
          {data.map((entry, i) => (
            <Cell key={entry.code}
              fill={selected === entry.code ? SELECTED_COLOR : (colors ?? CHART_COLORS)[i % (colors ?? CHART_COLORS).length]}
              fillOpacity={selected && selected !== entry.code ? 0.45 : 1} />
          ))}
          <LabelList dataKey="value" position="right"
            formatter={(v: number) => v != null ? fmt(v) : ''}
            style={{ fontSize: 11, fontWeight: 600, fill: '#374151' }} />
        </Bar>
        {national != null && (
          <ReferenceLine x={national} stroke="#dc2626" strokeDasharray="4 3" strokeWidth={1.5}
            label={{ value: `National: ${fmt(national)}`, position: 'insideTopRight', fontSize: 10, fill: '#dc2626', fontWeight: 600 }} />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}

function VertBar({ data, national, unit, onSelect, selected, height, colors }: Props) {
  const valid = data.filter(d => d.value != null)
  const max = valid.length ? Math.max(...valid.map(d => d.value!)) : 100
  const domainMax = unit === 'Percentage' ? Math.min(100, Math.ceil(max * 1.2)) : Math.ceil(max * 1.2)

  return (
    <ResponsiveContainer width="100%" height={height ?? 280}>
      <BarChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 60 }} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false}
          interval={0} angle={-35} textAnchor="end" height={65} />
        <YAxis domain={[0, domainMax]} tickFormatter={v => unit === 'Percentage' ? `${v}%` : String(v)}
          tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip unit={unit} />} cursor={{ fill: '#f8fafc' }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}
          onClick={d => onSelect?.(d.code, d.name)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
          {data.map((entry, i) => (
            <Cell key={entry.code}
              fill={selected === entry.code ? SELECTED_COLOR : (colors ?? CHART_COLORS)[i % (colors ?? CHART_COLORS).length]}
              fillOpacity={selected && selected !== entry.code ? 0.45 : 1} />
          ))}
          <LabelList dataKey="value" position="top"
            formatter={(v: number) => v != null ? (unit === 'Percentage' ? `${fmtNum(v)}%` : fmtNum(v)) : ''}
            style={{ fontSize: 10, fontWeight: 600, fill: '#374151' }} />
        </Bar>
        {national != null && (
          <ReferenceLine y={national} stroke="#dc2626" strokeDasharray="4 3" strokeWidth={1.5}
            label={{ value: `Nat: ${unit === 'Percentage' ? `${fmtNum(national)}%` : fmtNum(national)}`, position: 'insideTopRight', fontSize: 10, fill: '#dc2626', fontWeight: 600 }} />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}

function LineChartView({ data, national, unit, onSelect, selected, height, colors }: Props) {
  const valid = data.filter(d => d.value != null)
  const max = valid.length ? Math.max(...valid.map(d => d.value!)) : 100
  const domainMax = unit === 'Percentage' ? Math.min(100, Math.ceil(max * 1.2)) : Math.ceil(max * 1.2)

  return (
    <ResponsiveContainer width="100%" height={height ?? 280}>
      <LineChart data={data} margin={{ top: 20, right: 60, left: 10, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false}
          interval={0} angle={-35} textAnchor="end" height={65} />
        <YAxis domain={[0, domainMax]} tickFormatter={v => unit === 'Percentage' ? `${v}%` : String(v)}
          tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip unit={unit} />} />
        <Line type="monotone" dataKey="value" stroke="#1d4ed8" strokeWidth={2.5}
          dot={(props: any) => {
            const { cx, cy, payload, index } = props
            const isSelected = selected === payload.code
            const color = isSelected ? SELECTED_COLOR : (colors ?? CHART_COLORS)[index % (colors ?? CHART_COLORS).length]
            return <circle key={payload.code} cx={cx} cy={cy} r={isSelected ? 7 : 5} fill={color} stroke="white" strokeWidth={2}
              style={{ cursor: onSelect ? 'pointer' : 'default' }}
              onClick={() => onSelect?.(payload.code, payload.name)} />
          }}
          activeDot={{ r: 7, cursor: 'pointer', onClick: (_: any, payload: any) => onSelect?.(payload.payload.code, payload.payload.name) }}
        />
        {national != null && (
          <ReferenceLine y={national} stroke="#dc2626" strokeDasharray="4 3" strokeWidth={1.5}
            label={{ value: `National: ${unit === 'Percentage' ? `${fmtNum(national)}%` : fmtNum(national)}`, position: 'insideTopRight', fontSize: 10, fill: '#dc2626' }} />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}

const RADIAN = Math.PI / 180
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, value, unit }: any) {
  if (percent < 0.05) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {unit === 'Percentage' ? `${fmtNum(value)}%` : fmtNum(value)}
    </text>
  )
}

function PieChartView({ data, unit, onSelect, selected, height, colors }: Props) {
  const valid = data.filter(d => d.value != null && d.value > 0)
  return (
    <ResponsiveContainer width="100%" height={height ?? 300}>
      <PieChart>
        <Pie data={valid} dataKey="value" nameKey="name" cx="50%" cy="50%"
          innerRadius="35%" outerRadius="60%"
          labelLine={false} label={<PieLabel unit={unit} />}
          onClick={(d: any) => onSelect?.(d.code, d.name)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
          {valid.map((entry, i) => (
            <Cell key={entry.code}
              fill={selected === entry.code ? SELECTED_COLOR : (colors ?? CHART_COLORS)[i % (colors ?? CHART_COLORS).length]}
              stroke="white" strokeWidth={2}
              opacity={selected && selected !== entry.code ? 0.5 : 1} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip unit={unit} />} />
        <Legend formatter={(value) => <span style={{ fontSize: 12, color: '#374151' }}>{value}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function RadarChartView({ data, unit, selected, height, colors }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height ?? 300}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} />
        <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }}
          tickFormatter={v => unit === 'Percentage' ? `${v}%` : String(v)} />
        <Radar name={unit} dataKey="value" stroke="#1d4ed8" fill="#1d4ed8" fillOpacity={0.25} dot />
        <Tooltip content={<CustomTooltip unit={unit} />} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

export const CHART_TYPE_OPTIONS: { value: ChartType; label: string; icon: string }[] = [
  { value: 'bar-h', label: 'Horizontal Bar', icon: '≡' },
  { value: 'bar-v', label: 'Vertical Bar', icon: '▐' },
  { value: 'line', label: 'Line', icon: '∿' },
  { value: 'pie', label: 'Pie / Donut', icon: '◕' },
  { value: 'radar', label: 'Radar', icon: '✦' },
]

interface SelectorProps {
  value: ChartType
  onChange: (t: ChartType) => void
}

export function ChartTypeSelector({ value, onChange }: SelectorProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
      {CHART_TYPE_OPTIONS.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)} title={opt.label}
          className={cn(
            'rounded-md px-2.5 py-1.5 text-xs font-medium transition-all',
            value === opt.value
              ? 'bg-white shadow-sm text-slate-900 border border-slate-200'
              : 'text-slate-500 hover:text-slate-700'
          )}>
          <span className="text-sm">{opt.icon}</span>
          <span className="ml-1.5 hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  )
}

export default function ChartContainer(props: Props) {
  const { chartType } = props
  if (chartType === 'bar-h') return <HorizBar {...props} />
  if (chartType === 'bar-v') return <VertBar {...props} />
  if (chartType === 'line') return <LineChartView {...props} />
  if (chartType === 'pie') return <PieChartView {...props} />
  if (chartType === 'radar') return <RadarChartView {...props} />
  return <HorizBar {...props} />
}
