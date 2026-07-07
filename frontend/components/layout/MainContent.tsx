'use client'

import { useSidebar } from './SidebarContext'
import { cn } from '@/lib/utils'

export default function MainContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar()

  return (
    <div
      className={cn(
        'main-content flex min-h-screen min-w-0 max-w-full flex-1 flex-col overflow-x-hidden transition-all duration-300 ease-in-out',
        collapsed ? 'md:ml-16' : 'md:ml-64'
      )}
    >
      {children}
    </div>
  )
}
