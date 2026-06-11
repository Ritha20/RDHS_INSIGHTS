'use client'

import { useSidebar } from './SidebarContext'

export default function MainContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar()

  return (
    <div
      className="main-content flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out"
      style={{ marginLeft: collapsed ? '64px' : '256px' }}
    >
      {children}
    </div>
  )
}
