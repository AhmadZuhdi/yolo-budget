import { TrendingUp, TrendingDown, Tag } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { NetWorthCard } from '@/components/dashboard/NetWorthCard'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { useTransactions } from '@/hooks/useTransactions'
import { useBudgets } from '@/hooks/useBudgets'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useStagingStore } from '@/store/stagingStore'

const MASK = '••••••'

function CashFlowCard() {
  const { currency, paycycleDay } = useSettings()
  const { paycycleFlow } = useTransactions({}, paycycleDay)
  const { hideAmounts } = useStagingStore()
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Pay Cycle
          {paycycleFlow.start && (
            <span className="ml-2 font-normal text-xs">
              {paycycleFlow.start} → {paycycleFlow.end}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-xs">Income</span>
          </div>
          <span className="text-xl font-semibold text-emerald-400">
            {hideAmounts ? MASK : formatCurrency(paycycleFlow.income, currency)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-red-400">
            <TrendingDown className="h-3.5 w-3.5" />
            <span className="text-xs">Expenses</span>
          </div>
          <span className="text-xl font-semibold text-red-400">
            {hideAmounts ? MASK : formatCurrency(paycycleFlow.expense, currency)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function BudgetOverview() {
  const { budgets } = useBudgets()
  const { currency } = useSettings()
  const { hideAmounts } = useStagingStore()
  if (budgets.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Budget Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {budgets.slice(0, 4).map((b) => (
          <div key={b.id} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium truncate max-w-[140px]">{b.name}</span>
              <span className={cn(
                'text-xs font-medium',
                b.status === 'safe'    && 'text-emerald-400',
                b.status === 'warning' && 'text-yellow-400',
                b.status === 'danger'  && 'text-red-400',
              )}>
                {hideAmounts ? MASK : `${formatCurrency(b.spent, currency)} / ${formatCurrency(b.limitAmount, currency)}`}
              </span>
            </div>
            <Progress
              value={Math.min(b.percentage, 100)}
              indicatorClassName={cn(
                b.status === 'safe'    && 'bg-emerald-500',
                b.status === 'warning' && 'bg-yellow-500',
                b.status === 'danger'  && 'bg-red-500',
              )}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ExpenseByTag() {
  const { transactions } = useTransactions({ committedOnly: true, type: 'expense' })
  const { currency } = useSettings()
  const { hideAmounts } = useStagingStore()

  // Aggregate: tag → total expense amount
  const tagMap = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.tags.length === 0) {
      tagMap.set('(untagged)', (tagMap.get('(untagged)') ?? 0) + tx.amount)
    } else {
      for (const tag of tx.tags) {
        tagMap.set(tag, (tagMap.get(tag) ?? 0) + tx.amount)
      }
    }
  }

  if (tagMap.size === 0) return null

  const sorted = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1])
  const max = sorted[0][1]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5" />
          Expenses by Tag
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map(([tag, total]) => (
          <div key={tag} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-violet-400 font-mono text-xs">#{tag}</span>
              <span className="text-red-400 font-semibold text-xs">
                {hideAmounts ? MASK : formatCurrency(total, currency)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-red-500/60"
                style={{ width: `${(total / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto md:p-6">
      <div className="pt-2">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your financial overview</p>
      </div>

      <NetWorthCard />
      <CashFlowCard />
      <BudgetOverview />
      <ExpenseByTag />
      <RecentTransactions />
    </div>
  )
}
