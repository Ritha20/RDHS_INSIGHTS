import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmt(value: number | null | undefined, unit?: string): string {
  if (value === null || value === undefined) return 'N/A'
  const n = unit === 'Children per woman' ? value.toFixed(1) : value.toFixed(1)
  return unit === 'Percentage' ? `${n}%` : n
}

export function fmtNum(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A'
  return value.toFixed(1)
}

export function downloadCSV(
  rows: { name: string; value: number | null }[],
  indicator: string,
  national: number | null,
  unit: string,
  source: string
) {
  const header = ['Region', `${indicator} (${unit})`]
  const lines = [
    header.join(','),
    ...rows.map((r) => [JSON.stringify(r.name), r.value ?? ''].join(',')),
    ['National', national ?? ''].join(','),
    [],
    [`Source: ${source}`],
    [`Downloaded: ${new Date().toLocaleDateString('en-GB')}`],
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${indicator.replace(/\s+/g, '_').toLowerCase()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
