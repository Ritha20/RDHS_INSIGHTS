'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, LabelList
} from 'recharts'
import { fmtNum } from '@/lib/utils'

interface Entry {
  name: string
  value: number | null
  code: number
}

interface Props {
  data: Entry[]
  national: number | null
  unit: string
  indicator: string
  onSelectProvince?: (code: number, name: string) => void
  selectedProvince?: number | null
}

const COLORS = ['#1d4ed8', '#0f766e', '#7c3aed', '#b45309', '#0369a1']
const SELECTED_COLOR = '#1a6b3c'

const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-sm">
      <p className="font-semibold text-slate-800">{label}</p>
      <p className="text-slate-600">
        {v != null ? `${fmtNum(v)}${unit === 'Percentage' ? '%' : ` ${unit}`}` : 'N/A'}
      </p>
    </div>
  )
}

export default function ProvinceBarChart({
  data, national, unit, indicator, onSelectProvince, selectedProvince
}: Props) {
  const isPercent = unit === 'Percentage'
  const valid = data.filter((d) => d.value !== null)
  const max = valid.length ? Math.max(...valid.map((d) => d.value!)) : 100
  const domainMax = isPercent ? Math.min(100, Math.ceil(max * 1.2)) : Math.ceil(max * 1.2)

  const fmt = (v: number) =>
    isPercent ? `${fmtNum(v)}%` : fmtNum(v)

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 60, left: 10, bottom: 4 }}
          barCategoryGap="30%"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
          <XAxis
            type="number"
            domain={[0, domainMax]}
            tickFormatter={(v) => isPercent ? `${v}%` : String(v)}
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={130}
            tick={{ fontSize: 12, fill: '#374151', fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip unit={unit} />} cursor={{ fill: '#f8fafc' }} />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            onClick={(d) => onSelectProvince?.(d.code, d.name)}
            style={{ cursor: onSelectProvince ? 'pointer' : 'default' }}
          >
            {data.map((entry, i) => (
              <Cell
                key={entry.code}
                fill={
                  selectedProvince === entry.code
                    ? SELECTED_COLOR
                    : COLORS[i % COLORS.length]
                }
                fillOpacity={selectedProvince && selectedProvince !== entry.code ? 0.5 : 1}
              />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v: number) => v != null ? fmt(v) : ''}
              style={{ fontSize: 11, fontWeight: 600, fill: '#374151' }}
            />
          </Bar>
          {national != null && (
            <ReferenceLine
              x={national}
              stroke="#dc2626"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{
                value: `National: ${fmt(national)}`,
                position: 'insideTopRight',
                fontSize: 10,
                fill: '#dc2626',
                fontWeight: 600,
              }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
