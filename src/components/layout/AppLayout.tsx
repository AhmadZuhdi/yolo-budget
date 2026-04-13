import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { FAB } from './FAB'
import { StagingSheet } from '@/components/staging/StagingSheet'
import { Toaster } from '@/components/ui/toaster'
import { Outlet } from 'react-router-dom'

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Page content with bottom padding for mobile nav */}
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />

      {/* Floating Action Button */}
      <FAB />

      {/* Staging / Commit sheet */}
      <StagingSheet />

      {/* Toast notifications */}
      <Toaster />
    </div>
  )
}
