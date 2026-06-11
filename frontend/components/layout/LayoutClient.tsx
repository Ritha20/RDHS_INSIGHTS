'use client'

import { SidebarProvider } from './SidebarContext'

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        {children}
      </div>
    </SidebarProvider>
  )
}
