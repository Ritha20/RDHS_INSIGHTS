'use client'

import { motion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KPICardProps {
  title: string
  value: string | number | null
  unit: string
  description: string
  color?: 'green' | 'blue' | 'amber' | 'rose' | 'purple' | 'teal'
  index?: number
  isLoading?: boolean
  selected?: boolean
  onSelect?: () => void
}

const colorMap = {
  green:  { bg: 'bg-emerald-50',  text: 'text-emerald-700',  icon: 'bg-emerald-100 text-emerald-600',  border: 'border-emerald-200',  ring: 'ring-emerald-400' },
  blue:   { bg: 'bg-blue-50',     text: 'text-blue-700',     icon: 'bg-blue-100 text-blue-600',         border: 'border-blue-200',     ring: 'ring-blue-400' },
  amber:  { bg: 'bg-amber-50',    text: 'text-amber-700',    icon: 'bg-amber-100 text-amber-600',       border: 'border-amber-200',    ring: 'ring-amber-400' },
  rose:   { bg: 'bg-rose-50',     text: 'text-rose-700',     icon: 'bg-rose-100 text-rose-600',         border: 'border-rose-200',     ring: 'ring-rose-400' },
  purple: { bg: 'bg-purple-50',   text: 'text-purple-700',   icon: 'bg-purple-100 text-purple-600',     border: 'border-purple-200',   ring: 'ring-purple-400' },
  teal:   { bg: 'bg-teal-50',     text: 'text-teal-700',     icon: 'bg-teal-100 text-teal-600',         border: 'border-teal-200',     ring: 'ring-teal-400' },
}

export default function KPICard({ title, value, unit, description, color = 'green', index = 0, isLoading, selected, onSelect }: KPICardProps) {
  const c = colorMap[color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35, ease: 'easeOut' }}
      onClick={onSelect}
      className={cn(
        'relative overflow-hidden rounded-xl border bg-white p-5 shadow-sm transition-all',
        c.border,
        onSelect && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5',
        selected && `ring-2 ${c.ring} shadow-md -translate-y-0.5`,
      )}
    >
      {/* Decorative blob */}
      <div className={cn('absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-40', c.bg)} />

      {selected && (
        <div className="absolute right-3 top-3">
          <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white', c.text.replace('text-', 'bg-').replace('-700', '-500'))}>✓</span>
        </div>
      )}

      <div className="relative">
        <div className={cn('mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', c.bg, c.text)}>
          <TrendingUp className="h-3 w-3" />
          {description}
        </div>

        {isLoading ? (
          <div className="h-9 w-24 animate-pulse rounded-md bg-slate-100" />
        ) : (
          <p className={cn('text-3xl font-bold', c.text)}>
            {value === null || value === undefined ? '—' : String(value)}
          </p>
        )}
        <p className="text-xs text-slate-500 mt-0.5">{unit}</p>
        <p className="mt-2 text-sm font-medium text-slate-700">{title}</p>
      </div>
    </motion.div>
  )
}
