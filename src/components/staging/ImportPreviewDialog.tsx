import { useEffect, useState } from 'react'
import {
  TrendingUp, TrendingDown, ArrowRight as Transfer,
  Loader2, AlertTriangle, CloudDownload, CloudUpload, HardDrive,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { importFromGist } from '@/utils/gistSync'
import { db } from '@/db/db'
import type { GistSyncPayload, Transaction } from '@/db/types'
import { formatCurrency, formatDateShort, formatDate } from '@/lib/utils'
import { useSettings } from '@/hooks/useSettings'

type LoadState = 'loading' | 'ready' | 'error'

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Sort committed transactions newest-first and return the top N. */
function topCommitted(txs: Transaction[], n = 3): Transaction[] {
  return [...txs]
    .filter((tx) => tx.isCommitted)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, n)
}

/** Fetch local DB snapshot: recent txs, tx count, account count. */
async function fetchLocalSnapshot() {
  const [allTxs, accountCount] = await Promise.all([
    db.transactions.toArray(),
    db.accounts.count(),
  ])
  const committed = allTxs.filter((tx) => tx.isCommitted)
  const recentTxs = [...committed]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3)
  return { recentTxs, txCount: committed.length, accountCount }
}

// ─── Mini transaction row ─────────────────────────────────────────────────────
function TxRow({ tx, currency }: { tx: Transaction; currency: string }) {
  const isIncome = tx.type === 'income'
  const isExpense = tx.type === 'expense'
  return (
    <div className="flex items-center gap-2 py-2">
      <div className={`p-1.5 rounded-md shrink-0 ${
        isIncome  ? 'bg-emerald-500/10 text-emerald-400' :
        isExpense ? 'bg-red-500/10 text-red-400' :
                    'bg-blue-500/10 text-blue-400'
      }`}>
        {isIncome  ? <TrendingUp className="h-3 w-3" /> :
         isExpense ? <TrendingDown className="h-3 w-3" /> :
                     <Transfer className="h-3 w-3" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{tx.description || '—'}</p>
        <p className="text-xs text-muted-foreground">{formatDateShort(tx.date)}</p>
      </div>
      <span className={`text-xs font-semibold shrink-0 ${
        isIncome  ? 'text-emerald-400' :
        isExpense ? 'text-red-400' :
                    'text-blue-400'
      }`}>
        {isIncome ? '+' : isExpense ? '-' : ''}
        {formatCurrency(tx.amount, currency)}
      </span>
    </div>
  )
}

// ─── Comparison column ────────────────────────────────────────────────────────
function PreviewColumn({
  label, icon, exportedAt, txCount, accountCount, recentTxs, currency, highlight,
}: {
  label: string
  icon: React.ReactNode
  exportedAt?: string
  txCount: number
  accountCount: number
  recentTxs: Transaction[]
  currency: string
  highlight?: boolean
}) {
  return (
    <div className={`flex-1 min-w-0 rounded-lg border p-3 space-y-3 ${
      highlight ? 'border-violet-500/40 bg-violet-500/5' : 'border-border bg-card/50'
    }`}>
      <div className="flex items-center gap-2">
        <span className={highlight ? 'text-violet-400' : 'text-muted-foreground'}>{icon}</span>
        <span className={`text-xs font-semibold uppercase tracking-wide ${
          highlight ? 'text-violet-400' : 'text-muted-foreground'
        }`}>{label}</span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-md bg-secondary/50 px-2 py-1.5 text-center">
          <p className="text-lg font-bold leading-none">{accountCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">accounts</p>
        </div>
        <div className="rounded-md bg-secondary/50 px-2 py-1.5 text-center">
          <p className="text-lg font-bold leading-none">{txCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">transactions</p>
        </div>
      </div>

      {exportedAt && (
        <p className="text-xs text-muted-foreground">
          Saved: <span className="text-foreground">{formatDate(exportedAt)}</span>
        </p>
      )}

      <div>
        <p className="text-xs text-muted-foreground mb-1">
          Last {recentTxs.length} transaction{recentTxs.length !== 1 ? 's' : ''}
        </p>
        {recentTxs.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2">No transactions</p>
        ) : (
          <div className="divide-y divide-border">
            {recentTxs.map((tx, i) => (
              <TxRow key={tx.id ?? i} tx={tx} currency={currency} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Inline error banner ──────────────────────────────────────────────────────
function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
      {message}
    </div>
  )
}

// ─── Loading state ────────────────────────────────────────────────────────────
function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// ImportPreviewDialog
// Shows remote Gist vs local DB before overwriting local with the Gist.
// ═════════════════════════════════════════════════════════════════════════════

interface ImportPreviewProps {
  open: boolean
  pat: string
  gistId: string
  onConfirm: (payload: GistSyncPayload) => void
  onCancel: () => void
}

export function ImportPreviewDialog({ open, pat, gistId, onConfirm, onCancel }: ImportPreviewProps) {
  const { currency } = useSettings()
  const [state, setState] = useState<LoadState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [remotePayload, setRemotePayload] = useState<GistSyncPayload | null>(null)
  const [localTxs, setLocalTxs] = useState<Transaction[]>([])
  const [localAccountCount, setLocalAccountCount] = useState(0)
  const [localTxCount, setLocalTxCount] = useState(0)

  useEffect(() => {
    if (!open) return
    setState('loading')
    setErrorMsg('')
    setRemotePayload(null)

    Promise.all([importFromGist(pat, gistId), fetchLocalSnapshot()])
      .then(([payload, local]) => {
        setRemotePayload(payload)
        setLocalTxs(local.recentTxs)
        setLocalTxCount(local.txCount)
        setLocalAccountCount(local.accountCount)
        setState('ready')
      })
      .catch((err: unknown) => { setErrorMsg(String(err)); setState('error') })
  }, [open, pat, gistId])

  const remoteTxs = remotePayload ? topCommitted(remotePayload.transactions) : []

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            Review before importing
          </DialogTitle>
          <DialogDescription>
            Compare your local data with the Gist backup. Importing will permanently overwrite all local data.
          </DialogDescription>
        </DialogHeader>

        {state === 'loading' && <LoadingState label="Fetching Gist backup…" />}
        {state === 'error'   && <ErrorBanner message={errorMsg} />}

        {state === 'ready' && remotePayload && (
          <div className="flex gap-3 flex-col sm:flex-row">
            <PreviewColumn
              label="Local (current)"
              icon={<HardDrive className="h-3.5 w-3.5" />}
              txCount={localTxCount}
              accountCount={localAccountCount}
              recentTxs={localTxs}
              currency={currency}
            />
            <PreviewColumn
              label="Gist (will replace)"
              icon={<CloudDownload className="h-3.5 w-3.5" />}
              exportedAt={remotePayload.exportedAt}
              txCount={remotePayload.transactions.filter((tx) => tx.isCommitted).length}
              accountCount={remotePayload.accounts.length}
              recentTxs={remoteTxs}
              currency={currency}
              highlight
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={state !== 'ready'}
            onClick={() => remotePayload && onConfirm(remotePayload)}
          >
            Yes, overwrite with Gist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// ExportPreviewDialog
// Shows local DB vs remote Gist before overwriting the Gist with local data.
// ═════════════════════════════════════════════════════════════════════════════

interface ExportPreviewProps {
  open: boolean
  pat: string
  gistId: string
  onConfirm: () => void
  onCancel: () => void
}

export function ExportPreviewDialog({ open, pat, gistId, onConfirm, onCancel }: ExportPreviewProps) {
  const { currency } = useSettings()
  const [state, setState] = useState<LoadState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [remotePayload, setRemotePayload] = useState<GistSyncPayload | null>(null)
  const [localTxs, setLocalTxs] = useState<Transaction[]>([])
  const [localAccountCount, setLocalAccountCount] = useState(0)
  const [localTxCount, setLocalTxCount] = useState(0)

  useEffect(() => {
    if (!open) return
    setState('loading')
    setErrorMsg('')
    setRemotePayload(null)

    Promise.all([importFromGist(pat, gistId), fetchLocalSnapshot()])
      .then(([payload, local]) => {
        setRemotePayload(payload)
        setLocalTxs(local.recentTxs)
        setLocalTxCount(local.txCount)
        setLocalAccountCount(local.accountCount)
        setState('ready')
      })
      .catch((err: unknown) => {
        // If the Gist has never been properly exported (placeholder), treat it
        // as an empty remote rather than blocking the export entirely.
        const msg = String(err)
        const isVersionMismatch = msg.includes('Incompatible backup version')
        const isNotFound = msg.includes('not found in the Gist')
        if (isVersionMismatch || isNotFound) {
          setRemotePayload(null)
          fetchLocalSnapshot()
            .then((local) => {
              setLocalTxs(local.recentTxs)
              setLocalTxCount(local.txCount)
              setLocalAccountCount(local.accountCount)
              setState('ready')
            })
            .catch((e: unknown) => { setErrorMsg(String(e)); setState('error') })
        } else {
          setErrorMsg(msg)
          setState('error')
        }
      })
  }, [open, pat, gistId])

  const remoteTxs = remotePayload ? topCommitted(remotePayload.transactions) : []

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            Review before exporting
          </DialogTitle>
          <DialogDescription>
            Your local data will overwrite the existing Gist backup. The current Gist content will be lost.
          </DialogDescription>
        </DialogHeader>

        {state === 'loading' && <LoadingState label="Fetching current Gist backup…" />}
        {state === 'error'   && <ErrorBanner message={errorMsg} />}

        {state === 'ready' && (
          <div className="flex gap-3 flex-col sm:flex-row">
            {/* Remote — what will be overwritten */}
            {remotePayload ? (
              <PreviewColumn
                label="Gist (will be overwritten)"
                icon={<CloudDownload className="h-3.5 w-3.5" />}
                exportedAt={remotePayload.exportedAt}
                txCount={remotePayload.transactions.filter((tx) => tx.isCommitted).length}
                accountCount={remotePayload.accounts.length}
                recentTxs={remoteTxs}
                currency={currency}
              />
            ) : (
              /* Gist had a placeholder / no valid backup yet */
              <div className="flex-1 min-w-0 rounded-lg border border-border bg-card/50 p-3 flex flex-col items-center justify-center gap-2 text-muted-foreground min-h-[120px]">
                <CloudDownload className="h-6 w-6 opacity-40" />
                <p className="text-xs text-center">No existing backup in Gist</p>
              </div>
            )}

            {/* Local — what will replace it */}
            <PreviewColumn
              label="Local (will replace)"
              icon={<CloudUpload className="h-3.5 w-3.5" />}
              txCount={localTxCount}
              accountCount={localAccountCount}
              recentTxs={localTxs}
              currency={currency}
              highlight
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={state !== 'ready'}
            onClick={onConfirm}
          >
            Yes, overwrite Gist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
