import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, ArrowRight as Transfer, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency, formatDateShort } from '@/lib/utils'

export function RecentTransactions() {
  const { transactions } = useTransactions({ committedOnly: true })
  const { accounts } = useAccounts()
  const { currency } = useSettings()

  const recent = transactions.slice(0, 8)

  function getAccount(id: number) {
    return accounts.find((a) => a.id === id)
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Recent Transactions
        </CardTitle>
        <Link
          to="/transactions"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View all <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {recent.length === 0 ? (
          <div className="px-4 pb-4 text-sm text-muted-foreground">
            No transactions yet. Use the + button to add one.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((tx) => {
              const account = getAccount(tx.accountId)
              return (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                  {/* Icon */}
                  <div className={`p-2 rounded-lg shrink-0 ${
                    tx.type === 'income'   ? 'bg-emerald-500/10 text-emerald-400' :
                    tx.type === 'expense'  ? 'bg-red-500/10 text-red-400' :
                                             'bg-blue-500/10 text-blue-400'
                  }`}>
                    {tx.type === 'income'  ? <TrendingUp className="h-3.5 w-3.5" /> :
                     tx.type === 'expense' ? <TrendingDown className="h-3.5 w-3.5" /> :
                                             <Transfer className="h-3.5 w-3.5" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.description}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-muted-foreground">{account?.name}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{formatDateShort(tx.date)}</span>
                    </div>
                  </div>

                  {/* Amount */}
                  <span className={`text-sm font-semibold shrink-0 ${
                    tx.type === 'income'   ? 'text-emerald-400' :
                    tx.type === 'expense'  ? 'text-red-400' :
                                             'text-blue-400'
                  }`}>
                    {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                    {formatCurrency(tx.amount, currency)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function BudgetProgressList() {
  // imported inline in Dashboard to keep things composable
  return null
}

// Unused import fix
const _Badge = Badge
export { _Badge }
