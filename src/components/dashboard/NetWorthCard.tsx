import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAccounts } from '@/hooks/useAccounts'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency } from '@/lib/utils'

export function NetWorthCard() {
  const { netWorth, accountsWithBalance } = useAccounts()
  const { currency } = useSettings()

  return (
    <Card className="bg-gradient-to-br from-primary/10 via-card to-card border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
          <Wallet className="h-4 w-4" />
          Total Net Worth
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-foreground tracking-tight">
          {formatCurrency(netWorth, currency)}
        </p>

        {accountsWithBalance.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {accountsWithBalance.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: acc.color }}
                  />
                  <span className="text-muted-foreground truncate max-w-[120px]">{acc.name}</span>
                </div>
                <span className={acc.balance < 0 ? 'text-red-400' : 'text-foreground'}>
                  {formatCurrency(acc.balance, currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function CashFlowCard() {
  const { monthlyFlow } = { monthlyFlow: { income: 0, expense: 0, net: 0 } }
  const { currency } = useSettings()
  // We'll get this from useTransactions — imported where used

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-xs">Income</span>
          </div>
          <span className="text-lg font-semibold text-emerald-400">
            {formatCurrency(monthlyFlow.income, currency)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-red-400">
            <TrendingDown className="h-3.5 w-3.5" />
            <span className="text-xs">Expenses</span>
          </div>
          <span className="text-lg font-semibold text-red-400">
            {formatCurrency(monthlyFlow.expense, currency)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
