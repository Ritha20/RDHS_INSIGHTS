'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useMemo } from 'react'
import {
  Home, Users, Baby, HeartHandshake, Stethoscope,
  ShieldCheck, Apple, Bug, Activity, Scale, LayoutDashboard,
  GitCompare, Search, X, PanelLeftClose, PanelLeftOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CHAPTERS } from '@/lib/chapters'
import { useSidebar } from './SidebarContext'

const iconMap: Record<string, React.ElementType> = {
  Home, Users, Baby, HeartHandshake, Stethoscope,
  ShieldCheck, Apple, Bug, Activity, Scale,
}

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/compare', label: 'Compare Regions', icon: GitCompare },
  ...CHAPTERS.map((c) => ({
    href: `/chapters/${c.slug}`,
    label: c.title,
    icon: iconMap[c.icon] || Home,
  })),
]

export default function Sidebar() {
  const pathname = usePathname()
  const { collapsed, toggle } = useSidebar()
  const [searchQuery, setSearchQuery] = useState('')
  const [tooltip, setTooltip] = useState<{ label: string; y: number } | null>(null)

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return navItems
    const q = searchQuery.toLowerCase()
    return navItems.filter(item => item.label.toLowerCase().includes(q))
  }, [searchQuery])

  return (
    <aside
      className={cn(
        'sidebar-container fixed inset-y-0 left-0 z-30 flex flex-col bg-nisr-navy shadow-xl',
        'transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex h-16 items-center gap-3 border-b border-white/10 shrink-0 overflow-hidden',
        collapsed ? 'justify-center px-0' : 'px-4'
      )}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white p-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/nisr-logo.png"
            alt="NISR Logo"
            width={36}
            height={36}
            className="rounded object-contain"
            style={{ width: 36, height: 36 }}
          />
        </div>
        <div
          className="overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out"
          style={{ maxWidth: collapsed ? 0 : 180, opacity: collapsed ? 0 : 1 }}
        >
          <p className="text-sm font-bold text-white">RDHS Insights</p>
          <p className="text-[10px] text-nisr-cyan-light">Analytics Dashboard</p>
        </div>
      </div>

      {/* Search */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out shrink-0"
        style={{ maxHeight: collapsed ? 0 : 56, opacity: collapsed ? 0 : 1 }}
      >
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40 pointer-events-none" />
            <input
              type="text"
              placeholder="Search indicators..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-lg bg-white/10 py-1.5 pl-8 pr-7 text-xs text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-nisr-cyan/50 border border-white/10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {filteredItems.length === 0 && !collapsed && (
          <p className="px-3 py-4 text-xs text-white/40 text-center">No results found</p>
        )}
        {filteredItems.map((item) => {
          const active = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href)
          const Icon = item.icon
          const isCompare = item.href === '/compare'
          return (
            <div key={item.href}>
              {isCompare && <div className="mx-2 my-1 h-px bg-white/10" />}
              <div
                className="relative"
                onMouseEnter={e => {
                  if (collapsed) {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    setTooltip({ label: item.label, y: rect.top + rect.height / 2 })
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors duration-150',
                    collapsed ? 'justify-center px-0' : 'px-3',
                    active
                      ? 'bg-nisr-cyan/20 text-white border border-nisr-cyan/30'
                      : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <Icon className={cn(
                    'h-4 w-4 shrink-0',
                    active ? 'text-nisr-cyan' : 'text-white/60'
                  )} />
                  <span
                    className="overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out"
                    style={{ maxWidth: collapsed ? 0 : 160, opacity: collapsed ? 0 : 1 }}
                  >
                    {item.label}
                  </span>
                  {!collapsed && isCompare && (
                    <span className="ml-auto rounded-full bg-nisr-cyan/20 px-1.5 py-0.5 text-[10px] font-semibold text-nisr-cyan shrink-0">
                      NEW
                    </span>
                  )}
                </Link>
              </div>
              {isCompare && <div className="mx-2 my-1 h-px bg-white/10" />}
            </div>
          )
        })}
      </nav>

      {/* Toggle button */}
      <div className={cn(
        'shrink-0 border-t border-white/10 px-2 py-2',
        collapsed ? 'flex justify-center' : 'flex justify-end'
      )}>
        <button
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex items-center justify-center rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors duration-150"
        >
          {collapsed
            ? <PanelLeftOpen className="h-4 w-4" />
            : <PanelLeftClose className="h-4 w-4" />
          }
        </button>
      </div>

      {/* Footer */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out shrink-0"
        style={{ maxHeight: collapsed ? 0 : 52, opacity: collapsed ? 0 : 1 }}
      >
        <div className="border-t border-white/10 px-4 py-3">
          <p className="text-[10px] text-white/50">Rwanda DHS 2019–20</p>
          <p className="text-[10px] text-white/35">NISR</p>
        </div>
      </div>

      {/* Floating tooltip when collapsed */}
      {collapsed && tooltip && (
        <div
          className="pointer-events-none fixed z-50 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
          style={{ left: 72, top: tooltip.y, transform: 'translateY(-50%)' }}
        >
          {tooltip.label}
          <div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-slate-900" />
        </div>
      )}
    </aside>
  )
}
