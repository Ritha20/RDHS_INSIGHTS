'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface SidebarContextValue {
  collapsed: boolean
  collapse: () => void
  expand: () => void
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  collapse: () => {},
  expand: () => {},
  toggle: () => {},
})

export function useSidebar() {
  return useContext(SidebarContext)
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const collapse = useCallback(() => setCollapsed(true), [])
  const expand = useCallback(() => setCollapsed(false), [])
  const toggle = useCallback(() => setCollapsed(c => !c), [])

  return (
    <SidebarContext.Provider value={{ collapsed, collapse, expand, toggle }}>
      {children}
    </SidebarContext.Provider>
  )
}
