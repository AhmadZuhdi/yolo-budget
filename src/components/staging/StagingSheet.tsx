import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useStagingStore } from '@/store/stagingStore'
import { TerminalInput } from './TerminalInput'
import { StagingQueue, CommitButton } from './StagingQueue'
import { cn } from '@/lib/utils'

export function StagingSheet() {
  const { isOpen, closeSheet, staged } = useStagingStore()
  const sheetRef = useRef<HTMLDivElement>(null)

  // Close on backdrop click
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) closeSheet()
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeSheet()
    }
    if (isOpen) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, closeSheet])

  // Prevent body scroll when open on mobile
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Sheet — slides up from bottom on mobile, fixed panel on desktop */}
      <div
        ref={sheetRef}
        className={cn(
          // Mobile: full-width bottom sheet
          'fixed inset-x-0 bottom-0 z-50 flex flex-col',
          'bg-card border-t border-border rounded-t-2xl shadow-2xl',
          'transition-transform duration-300 ease-out',
          'min-h-[50svh] max-h-[85svh]',
          // Desktop: right-side fixed panel
          'md:inset-x-auto md:right-6 md:bottom-20 md:w-[420px] md:rounded-xl md:border md:min-h-[50vh] md:max-h-[80vh]',
          isOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-[120%]'
        )}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-muted" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold">Staging Area</h2>
            <p className="text-xs text-muted-foreground">
              {staged.length === 0
                ? 'Queue transactions, then commit'
                : `${staged.length} pending — hit Commit to save`}
            </p>
          </div>
          <button
            onClick={closeSheet}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          {/* Terminal input */}
          <TerminalInput />

          {/* Staged list */}
          {staged.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Queued ({staged.length})
              </p>
              <StagingQueue />
            </div>
          )}
        </div>

        {/* Footer / Commit button */}
        <div className="px-4 pb-4 pb-safe shrink-0">
          <CommitButton />
        </div>
      </div>
    </>
  )
}
