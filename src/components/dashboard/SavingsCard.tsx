import { PiggyBank, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAccounts } from '@/hooks/useAccounts'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency } from '@/lib/utils'
import { useStagingStore } from '@/store/stagingStore'

const MASK = '••••••'

export function SavingsCard() {
  const { nonLiquidAccounts, nonLiquidNetWorth } = useAccounts()
  const { currency } = useSettings()
  const { hideAmounts, toggleHideAmounts } = useStagingStore()

  if (nonLiquidAccounts.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-muted-foreground text-sm font-medium">
          <div className="flex items-center gap-2">
            <PiggyBank className="h-4 w-4" />
            Savings &amp; Investments
          </div>
          <button
            onClick={toggleHideAmounts}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={hideAmounts ? 'Show amounts' : 'Hide amounts'}
          >
            {hideAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-foreground tracking-tight">
          {hideAmounts ? MASK : formatCurrency(nonLiquidNetWorth, currency)}
        </p>
        <div className="mt-3 space-y-1.5">
          {nonLiquidAccounts.map((acc) => (
            <div key={acc.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: acc.color }}
                />
                <span className="text-muted-foreground truncate max-w-[140px]">{acc.name}</span>
                <span className="text-xs text-muted-foreground capitalize opacity-60">{acc.type}</span>
              </div>
              <span className={acc.balance < 0 ? 'text-red-400' : 'text-foreground'}>
                {hideAmounts ? MASK : formatCurrency(acc.balance, currency)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
