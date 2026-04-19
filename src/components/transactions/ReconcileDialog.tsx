import { useState, useEffect } from 'react'
import { Scale } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AmountInput } from '@/components/ui/amount-input'
import { useAccounts } from '@/hooks/useAccounts'
import { useSettings } from '@/hooks/useSettings'
import { db, computeAccountBalance } from '@/db/db'
import { toast } from '@/hooks/useToast'
import { formatCurrency, evalAmount } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ReconcileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReconcileDialog({ open, onOpenChange }: ReconcileDialogProps) {
  const { accounts } = useAccounts()
  const { currency } = useSettings()

  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [actualBalance, setActualBalance] = useState<string>('')
  const [currentBalance, setCurrentBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingBalance, setLoadingBalance] = useState(false)

  // Load current computed balance whenever account changes
  useEffect(() => {
    if (!selectedAccountId) {
      setCurrentBalance(null)
      return
    }
    setLoadingBalance(true)
    computeAccountBalance(Number(selectedAccountId)).then((bal) => {
      setCurrentBalance(bal)
      setLoadingBalance(false)
    })
  }, [selectedAccountId, open])

  const parsedActual = evalAmount(actualBalance) ?? parseFloat(actualBalance)
  const difference =
    currentBalance !== null && !isNaN(parsedActual)
      ? parsedActual - currentBalance
      : null

  const differenceType =
    difference === null
      ? null
      : difference > 0
      ? 'income'
      : difference < 0
      ? 'expense'
      : 'zero'

  async function handleReconcile() {
    if (!selectedAccountId || difference === null || differenceType === 'zero') return

    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const account = accounts.find((a) => a.id === Number(selectedAccountId))

      await db.transactions.add({
        accountId: Number(selectedAccountId),
        type: difference > 0 ? 'income' : 'expense',
        amount: Math.abs(difference),
        date: today,
        description: `Reconciliation – ${account?.name ?? 'account'}`,
        tags: ['reconciliation'],
        isCommitted: true,
        createdAt: new Date().toISOString(),
      })

      toast.success(
        'Account reconciled',
        `${difference > 0 ? '+' : ''}${formatCurrency(difference, currency)} adjustment added`
      )
      handleClose()
    } catch {
      toast.error('Reconciliation failed', 'Could not save adjustment transaction')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setSelectedAccountId('')
    setActualBalance('')
    setCurrentBalance(null)
    onOpenChange(false)
  }

  const canReconcile =
    selectedAccountId &&
    !isNaN(parsedActual) &&
    actualBalance.trim() !== '' &&
    difference !== null &&
    differenceType !== 'zero'

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            Reconcile Account
          </DialogTitle>
          <DialogDescription>
            Enter the real-world balance of an account. An adjustment transaction
            will be created automatically to match.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Account selector */}
          <div className="space-y-1.5">
            <Label>Account</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account…" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Current computed balance */}
          {selectedAccountId && (
            <div className="rounded-lg bg-secondary/50 px-4 py-3 text-sm space-y-0.5">
              <p className="text-xs text-muted-foreground">Current tracked balance</p>
              <p className="font-semibold text-base">
                {loadingBalance
                  ? '—'
                  : formatCurrency(currentBalance ?? 0, currency)}
              </p>
            </div>
          )}

          {/* Actual balance input */}
          <div className="space-y-1.5">
            <Label htmlFor="actual-balance">Actual balance</Label>
            <AmountInput
              id="actual-balance"
              value={actualBalance}
              onChange={setActualBalance}
              placeholder="0.00"
            />
          </div>

          {/* Difference preview */}
          {difference !== null && differenceType !== 'zero' && (
            <div
              className={cn(
                'rounded-lg px-4 py-3 text-sm',
                differenceType === 'income'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              )}
            >
              <p className="text-xs opacity-75 mb-0.5">
                {differenceType === 'income'
                  ? 'Income adjustment will be created'
                  : 'Expense adjustment will be created'}
              </p>
              <p className="font-semibold text-base">
                {difference > 0 ? '+' : ''}
                {formatCurrency(difference, currency)}
              </p>
            </div>
          )}

          {difference !== null && differenceType === 'zero' && (
            <div className="rounded-lg bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
              Already balanced — no adjustment needed.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleReconcile}
            disabled={!canReconcile || loading}
          >
            {loading ? 'Saving…' : 'Apply adjustment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
