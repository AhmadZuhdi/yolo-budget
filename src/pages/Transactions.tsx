import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, ArrowRight, Filter, X, Scale, Trash2, Pencil } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTransactions, TransactionFilters } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency, formatDate, getPaycycleDateRange } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { ReconcileDialog } from '@/components/transactions/ReconcileDialog'
import { EditTransactionDialog } from '@/components/transactions/EditTransactionDialog'
import { toast } from '@/hooks/useToast'
import type { Transaction } from '@/db/types'

export default function Transactions() {
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState<TransactionFilters>({ committedOnly: true })
  const [showFilters, setShowFilters] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    const tag = searchParams.get('tag')
    return tag ? [tag] : []
  })

  // Open filter panel automatically if a tag was pre-selected via URL
  useEffect(() => {
    if (searchParams.get('tag')) setShowFilters(true)
  }, [])
  const [showReconcile, setShowReconcile] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [payCycleActive, setPayCycleActive] = useState(false)

  const { transactions, allTags, deleteTransaction } = useTransactions({ ...filters, tags: selectedTags.length > 0 ? selectedTags : undefined })
  const { accounts } = useAccounts()
  const { currency, paycycleDay } = useSettings()

  function getAccount(id: number) {
    return accounts.find((a) => a.id === id)
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  function togglePayCycle() {
    if (payCycleActive) {
      setPayCycleActive(false)
      setFilters((f) => ({ ...f, startDate: undefined, endDate: undefined }))
    } else {
      const { start, end } = getPaycycleDateRange(paycycleDay)
      setPayCycleActive(true)
      setFilters((f) => ({ ...f, startDate: start, endDate: end }))
    }
  }

  async function handleDelete(tx: Transaction) {
    if (tx.id === undefined) return
    setDeletingId(tx.id)
    try {
      await deleteTransaction(tx.id)
      toast.success('Transaction deleted', tx.description)
    } catch {
      toast.error('Failed to delete transaction')
    } finally {
      setDeletingId(null)
    }
  }

  // Group transactions by date
  const grouped = transactions.reduce<Record<string, typeof transactions>>((acc, tx) => {
    const date = tx.date
    if (!acc[date]) acc[date] = []
    acc[date].push(tx)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto md:p-6">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-sm text-muted-foreground">{transactions.length} records</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowReconcile(true)}
          >
            <Scale className="h-3.5 w-3.5 mr-1.5" />
            Reconcile
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((s) => !s)}
            className={cn((showFilters || payCycleActive) && 'border-primary text-primary')}
          >
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            Filter{payCycleActive && ' •'}
          </Button>
        </div>
      </div>

      <ReconcileDialog open={showReconcile} onOpenChange={setShowReconcile} />

      <EditTransactionDialog
        transaction={editingTx}
        open={editingTx !== null}
        onOpenChange={(open) => { if (!open) setEditingTx(null) }}
      />

      {/* Filter panel */}
      {showFilters && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* Pay Cycle quick filter */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Quick filter</label>
              <button
                onClick={togglePayCycle}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-md border transition-colors',
                  payCycleActive
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                )}
              >
                Pay Cycle{payCycleActive && filters.startDate ? `: ${filters.startDate} → ${filters.endDate}` : ''}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Account filter */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Account</label>
                <Select
                  value={filters.accountId?.toString() ?? 'all'}
                  onValueChange={(v) =>
                    setFilters((f) => ({ ...f, accountId: v === 'all' ? undefined : Number(v) }))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All accounts</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type filter */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Type</label>
                <Select
                  value={filters.type ?? 'all'}
                  onValueChange={(v) =>
                    setFilters((f) => ({ ...f, type: v === 'all' ? undefined : v as TransactionFilters['type'] }))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">From</label>
                <input
                  type="date"
                  value={filters.startDate ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value || undefined }))}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">To</label>
                <input
                  type="date"
                  value={filters.endDate ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value || undefined }))}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            {/* Tag chips */}
            {allTags.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full border transition-colors',
                        selectedTags.includes(tag)
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                      )}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Clear filters */}
            {(filters.accountId || filters.type || filters.startDate || filters.endDate || selectedTags.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => { setFilters({ committedOnly: true }); setSelectedTags([]); setPayCycleActive(false) }}
              >
                <X className="h-3 w-3 mr-1" /> Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transaction list grouped by date */}
      {sortedDates.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>No transactions found</p>
          <p className="text-sm mt-1">Use the + button to add some</p>
        </div>
      ) : (
        sortedDates.map((date) => (
          <div key={date} className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
              {formatDate(date)}
            </p>
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {grouped[date].map((tx) => {
                  const account = getAccount(tx.accountId)
                  const toAccount = tx.toAccountId ? getAccount(tx.toAccountId) : null
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-3 group">
                      <div className={`p-2 rounded-lg shrink-0 ${
                        tx.type === 'income'   ? 'bg-emerald-500/10 text-emerald-400' :
                        tx.type === 'expense'  ? 'bg-red-500/10 text-red-400' :
                                                  'bg-blue-500/10 text-blue-400'
                      }`}>
                        {tx.type === 'income'  ? <TrendingUp className="h-3.5 w-3.5" /> :
                         tx.type === 'expense' ? <TrendingDown className="h-3.5 w-3.5" /> :
                                                  <ArrowRight className="h-3.5 w-3.5" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium break-words">{tx.description}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          {tx.type === 'transfer' ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: account?.color ?? '#6366f1' }}
                              />
                              {account?.name ?? '…'}
                              <ArrowRight className="h-2.5 w-2.5" />
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: toAccount?.color ?? '#6366f1' }}
                              />
                              {toAccount?.name ?? '…'}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: account?.color ?? '#6366f1' }}
                              />
                              {account?.name ?? '…'}
                            </span>
                          )}
                          {tx.tags.map((tag) => (
                            <Badge key={tag} variant="tag" className="text-[10px] px-1.5 py-0">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <span className={`text-sm font-semibold shrink-0 ${
                        tx.type === 'income'   ? 'text-emerald-400' :
                        tx.type === 'expense'  ? 'text-red-400' :
                                                  'text-blue-400'
                      }`}>
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                        {formatCurrency(tx.amount, currency)}
                      </span>

                      <button
                        onClick={() => setEditingTx(tx)}
                        className="shrink-0 p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-primary hover:bg-primary/10 transition-all"
                        aria-label="Edit transaction"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(tx)}
                        disabled={deletingId === tx.id}
                        className="shrink-0 p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                        aria-label="Delete transaction"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        ))
      )}
    </div>
  )
}
