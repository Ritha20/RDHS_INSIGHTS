'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, LabelList,
} from 'recharts'
import { fmtNum } from '@/lib/utils'

interface Entry {
  name: string
  value: number | null
  code: number
}

interface Props {
  data: Entry[]
  national?: number | null
  unit: string
  indicator: string
  onSelect?: (code: number, name: string) => void
  selected?: number | null
  height?: number
}

const COLORS = ['#1B3C74', '#0099D4', '#2A509A', '#4AB8E0', '#0D2550']

const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-sm">
      <p className="font-semibold text-slate-800">{label ?? payload[0]?.name}</p>
      <p className="text-slate-600">
        {v != null ? (unit === 'Percentage' ? `${fmtNum(v)}%` : fmtNum(v)) : 'N/A'}
      </p>
    </div>
  )
}

export default function VertBarChart({ data, national, unit, indicator, onSelect, selected, height }: Props) {
  const valid = data.filter(d => d.value != null)
  const max = valid.length ? Math.max(...valid.map(d => d.value!)) : 100
  const domainMax = unit === 'Percentage' ? Math.min(100, Math.ceil(max * 1.25)) : Math.ceil(max * 1.25)
  const fmt = (v: number) => unit === 'Percentage' ? `${fmtNum(v)}%` : fmtNum(v)

  return (
    <ResponsiveContainer width="100%" height={height ?? 300}>
      <BarChart data={data} margin={{ top: 24, right: 16, left: 8, bottom: 64 }} barCategoryGap="28%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: '#374151' }}
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={-35}
          textAnchor="end"
          height={68}
        />
        <YAxis
          domain={[0, domainMax]}
          tickFormatter={v => unit === 'Percentage' ? `${v}%` : String(v)}
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip unit={unit} />} cursor={{ fill: '#f8fafc' }} />
        <Bar
          dataKey="value"
          radius={[4, 4, 0, 0]}
          onClick={d => onSelect?.(d.code, d.name)}
          style={{ cursor: onSelect ? 'pointer' : 'default' }}
        >
          {data.map((entry, i) => (
            <Cell
              key={entry.code}
              fill={selected === entry.code ? '#0D2550' : COLORS[i % COLORS.length]}
              fillOpacity={selected && selected !== entry.code ? 0.45 : 1}
            />
          ))}
          <LabelList
            dataKey="value"
            position="top"
            formatter={(v: number) => v != null ? fmt(v) : ''}
            style={{ fontSize: 10, fontWeight: 600, fill: '#374151' }}
          />
        </Bar>
        {national != null && (
          <ReferenceLine
            y={national}
            stroke="#dc2626"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{ value: `Nat: ${fmt(national)}`, position: 'insideTopRight', fontSize: 10, fill: '#dc2626', fontWeight: 600 }}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}
