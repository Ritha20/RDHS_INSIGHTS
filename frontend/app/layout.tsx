import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'
import QueryProvider from '@/components/QueryProvider'
import LayoutClient from '@/components/layout/LayoutClient'
import MainContent from '@/components/layout/MainContent'

export const metadata: Metadata = {
  title: 'RDHS Insights Dashboard',
  description: 'Rwanda Demographic and Health Survey — NISR Analytics Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <LayoutClient>
            <Sidebar />
            <MainContent>
              {children}
            </MainContent>
          </LayoutClient>
        </QueryProvider>
      </body>
    </html>
  )
}
