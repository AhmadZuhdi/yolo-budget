import { Trash2, ArrowRight, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useStagingStore } from '@/store/stagingStore'
import { useAccounts } from '@/hooks/useAccounts'
import { useSettings } from '@/hooks/useSettings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, cn } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { computeAccountBalance } from '@/db/db'
import type { StagedTransaction } from '@/db/types'

// Apply all staged txs to a base balance map and return final balances
function applyAllStaged(
  baseBalances: Map<number, number>,
  staged: StagedTransaction[]
): Map<number, number> {
  const map = new Map(baseBalances)
  for (const tx of staged) {
    const prev = map.get(tx.accountId) ?? 0
    if (tx.type === 'income') {
      map.set(tx.accountId, prev + tx.amount)
    } else if (tx.type === 'expense') {
      map.set(tx.accountId, prev - tx.amount)
    } else if (tx.type === 'transfer') {
      map.set(tx.accountId, prev - tx.amount - (tx.transferFee ?? 0))
      if (tx.toAccountId != null) {
        const toPrev = map.get(tx.toAccountId) ?? 0
        map.set(tx.toAccountId, toPrev + tx.amount)
      }
    }
  }
  return map
}

function StagedItem({ tx }: { tx: StagedTransaction }) {
  const { removeFromStaging } = useStagingStore()
  const { accounts } = useAccounts()
  const { currency } = useSettings()

  const account = accounts.find((a) => a.id === tx.accountId)
  const toAccount = tx.toAccountId ? accounts.find((a) => a.id === tx.toAccountId) : null

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border border-border group">
      {/* Type icon */}
      <div className={`mt-0.5 p-1.5 rounded-md shrink-0 ${
        tx.type === 'income'   ? 'bg-emerald-500/10 text-emerald-400' :
        tx.type === 'expense'  ? 'bg-red-500/10 text-red-400' :
                                  'bg-blue-500/10 text-blue-400'
      }`}>
        {tx.type === 'income'  ? <TrendingUp className="h-3.5 w-3.5" /> :
         tx.type === 'expense' ? <TrendingDown className="h-3.5 w-3.5" /> :
                                  <ArrowRight className="h-3.5 w-3.5" />}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{tx.description}</span>
          <span className={`text-sm font-semibold shrink-0 ${
            tx.type === 'income'   ? 'text-emerald-400' :
            tx.type === 'expense'  ? 'text-red-400' :
                                      'text-blue-400'
          }`}>
            {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
            {formatCurrency(tx.amount, currency)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1 mt-1">
          {account && (
            <span className="text-xs text-muted-foreground">
              {tx.type === 'transfer'
                ? `${account.name} → ${toAccount?.name ?? '?'}`
                : account.name}
            </span>
          )}
          {tx.transferFee && (
            <span className="text-xs text-amber-400">fee: {formatCurrency(tx.transferFee, currency)}</span>
          )}
          {tx.tags.map((tag) => (
            <Badge key={tag} variant="tag" className="text-[10px] px-1.5 py-0">{tag}</Badge>
          ))}
        </div>
      </div>

      {/* Remove */}
      <button
        onClick={() => removeFromStaging(tx.id)}
        className="opacity-0 group-hover:opacity-100 md:opacity-100 shrink-0 p-1 rounded text-muted-foreground hover:text-red-400 transition-all"
        aria-label="Remove"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// One row per affected account showing before → after
function BalanceSummary({
  baseBalances,
  finalBalances,
  involvedIds,
}: {
  baseBalances: Map<number, number>
  finalBalances: Map<number, number>
  involvedIds: number[]
}) {
  const { accounts } = useAccounts()
  const { currency } = useSettings()

  // Only show accounts whose balance actually changed
  const changed = involvedIds.filter(
    (id) => (baseBalances.get(id) ?? 0) !== (finalBalances.get(id) ?? 0)
  )
  if (changed.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2 space-y-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        Balance impact after commit
      </p>
      {changed.map((id) => {
        const acc = accounts.find((a) => a.id === id)
        const before = baseBalances.get(id) ?? 0
        const after = finalBalances.get(id) ?? 0
        const delta = after - before
        const sign = delta >= 0 ? '+' : ''
        return (
          <div key={id} className="flex items-start justify-between gap-3 font-mono text-xs">
            <span className="text-muted-foreground pt-0.5 truncate">
              {acc?.name ?? `#${id}`}
            </span>
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">{formatCurrency(before, currency)}</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <span className={cn('font-semibold', after < 0 ? 'text-red-400' : 'text-foreground')}>
                  {formatCurrency(after, currency)}
                </span>
              </div>
              <span className={cn(delta >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {sign}{formatCurrency(Math.abs(delta), currency)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function StagingQueue() {
  const { staged } = useStagingStore()

  const involvedIds = Array.from(
    new Set(staged.flatMap((tx) => [tx.accountId, tx.toAccountId].filter((id): id is number => id != null)))
  )

  const baseBalances = useLiveQuery(async () => {
    const entries = await Promise.all(
      involvedIds.map(async (id) => [id, await computeAccountBalance(id)] as [number, number])
    )
    return new Map<number, number>(entries)
  }, [involvedIds.join(',')]) ?? new Map<number, number>()

  const finalBalances = applyAllStaged(baseBalances, staged)

  if (staged.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <p className="text-sm">No staged transactions</p>
        <p className="text-xs mt-1">Use the terminal above to queue entries</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {staged.map((tx) => (
        <StagedItem key={tx.id} tx={tx} />
      ))}
      <BalanceSummary
        baseBalances={baseBalances}
        finalBalances={finalBalances}
        involvedIds={involvedIds}
      />
    </div>
  )
}

export function CommitButton() {
  const { staged, commitAll, clearStaging } = useStagingStore()
  const count = staged.length

  if (count === 0) return null

  async function handleCommit() {
    const n = await commitAll()
    toast.success('Committed!', `${n} transaction${n === 1 ? '' : 's'} saved to your records.`)
  }

  function handleDiscard() {
    clearStaging()
    toast.warning('Discarded', 'All staged transactions removed.')
  }

  return (
    <div className="flex gap-2 pt-2 border-t border-border">
      <Button
        variant="outline"
        size="sm"
        className="flex-1 text-muted-foreground"
        onClick={handleDiscard}
      >
        Discard all
      </Button>
      <Button
        size="sm"
        className="flex-1 bg-primary"
        onClick={handleCommit}
      >
        Commit {count} {count === 1 ? 'change' : 'changes'}
      </Button>
    </div>
  )
}
