import { useState } from 'react'
import { Plus, Terminal } from 'lucide-react'
import { useStagingStore } from '@/store/stagingStore'
import { TransactionFormDialog } from '@/components/staging/TransactionFormDialog'
import { cn } from '@/lib/utils'

export function FAB() {
  const { toggleSheet, staged } = useStagingStore()
  const count = staged.length
  const [showForm, setShowForm] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  return (
    <>
      {/* Mini action menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
          aria-hidden="true"
        />
      )}

      {showMenu && (
        <div className="fixed bottom-36 right-4 z-50 md:bottom-24 md:right-6 flex flex-col gap-2 items-end animate-fade-in">
          {/* Terminal / staging sheet */}
          <button
            onClick={() => { setShowMenu(false); toggleSheet() }}
            className="flex items-center gap-2 bg-card border border-border rounded-full pl-3 pr-4 py-2.5 text-sm font-medium shadow-lg hover:bg-secondary transition-colors"
          >
            <Terminal className="h-4 w-4 text-green-400" />
            Terminal entry
          </button>
          {/* Form entry */}
          <button
            onClick={() => { setShowMenu(false); setShowForm(true) }}
            className="flex items-center gap-2 bg-card border border-border rounded-full pl-3 pr-4 py-2.5 text-sm font-medium shadow-lg hover:bg-secondary transition-colors"
          >
            <Plus className="h-4 w-4 text-primary" />
            Form entry
          </button>
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setShowMenu((s) => !s)}
        aria-label="Add transaction"
        className={cn(
          'fixed bottom-20 right-4 z-50 md:bottom-6 md:right-6',
          'flex items-center justify-center w-14 h-14 rounded-full shadow-lg',
          'bg-primary text-primary-foreground',
          'transition-all active:scale-95 hover:bg-primary/90',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          showMenu && 'rotate-45'
        )}
      >
        <Plus className="h-6 w-6 transition-transform" />
        {count > 0 && !showMenu && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      <TransactionFormDialog open={showForm} onClose={() => setShowForm(false)} />
    </>
  )
}
