import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, ArrowRight as Transfer, Loader2, AlertTriangle, CloudDownload, HardDrive } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { importFromGist } from '@/utils/gistSync'
import { db } from '@/db/db'
import type { GistSyncPayload, Transaction } from '@/db/types'
import { formatCurrency, formatDateShort, formatDate } from '@/lib/utils'
import { useSettings } from '@/hooks/useSettings'

interface Props {
  open: boolean
  pat: string
  gistId: string
  onConfirm: (payload: GistSyncPayload) => void
  onCancel: () => void
}

type LoadState = 'loading' | 'ready' | 'error'

// ─── Mini transaction row (shared by both columns) ────────────────────────────
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

// ─── One side of the comparison panel ────────────────────────────────────────
function PreviewColumn({
  label,
  icon,
  exportedAt,
  txCount,
  accountCount,
  recentTxs,
  currency,
  highlight,
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
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className={`${highlight ? 'text-violet-400' : 'text-muted-foreground'}`}>
          {icon}
        </span>
        <span className={`text-xs font-semibold uppercase tracking-wide ${
          highlight ? 'text-violet-400' : 'text-muted-foreground'
        }`}>
          {label}
        </span>
      </div>

      {/* Stats */}
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

      {/* Exported at */}
      {exportedAt && (
        <p className="text-xs text-muted-foreground">
          Saved: <span className="text-foreground">{formatDate(exportedAt)}</span>
        </p>
      )}

      {/* Recent transactions */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Last {recentTxs.length} transaction{recentTxs.length !== 1 ? 's' : ''}</p>
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

// ─── Main dialog ──────────────────────────────────────────────────────────────
export function ImportPreviewDialog({ open, pat, gistId, onConfirm, onCancel }: Props) {
  const { currency } = useSettings()
  const [state, setState] = useState<LoadState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [remotePayload, setRemotePayload] = useState<GistSyncPayload | null>(null)
  const [localTxs, setLocalTxs] = useState<Transaction[]>([])
  const [localAccountCount, setLocalAccountCount] = useState(0)
  const [localTxCount, setLocalTxCount] = useState(0)

  // Fetch remote payload + local snapshot whenever dialog opens
  useEffect(() => {
    if (!open) return
    setState('loading')
    setErrorMsg('')
    setRemotePayload(null)

    Promise.all([
      importFromGist(pat, gistId),
      db.transactions.where('isCommitted').equals(1).sortBy('date'),
      db.transactions.where('isCommitted').equals(1).count(),
      db.accounts.count(),
    ])
      .then(([payload, allLocalTxs, localCount, acctCount]) => {
        setRemotePayload(payload)
        // Most recent 3 committed local transactions (newest first)
        const sorted = [...allLocalTxs].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
        setLocalTxs(sorted.slice(0, 3))
        setLocalTxCount(localCount)
        setLocalAccountCount(acctCount)
        setState('ready')
      })
      .catch((err: unknown) => {
        setErrorMsg(String(err))
        setState('error')
      })
  }, [open, pat, gistId])

  // Most recent 3 committed remote transactions (newest first)
  const remoteTxs = remotePayload
    ? [...remotePayload.transactions]
        .filter((tx) => tx.isCommitted)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3)
    : []

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

        {/* Loading */}
        {state === 'loading' && (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Fetching Gist backup…</span>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {errorMsg}
          </div>
        )}

        {/* Ready — side-by-side comparison */}
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
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
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
