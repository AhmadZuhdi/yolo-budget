import { useState } from 'react'
import { Repeat } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRecurring } from '@/hooks/useRecurring'
import { toast } from '@/hooks/useToast'
import type { Transaction } from '@/db/types'
import type { RecurringFrequency } from '@/db/types'

interface Props {
  open: boolean
  transaction: Transaction | null
  onClose: () => void
}

export function CreateRecurringDialog({ open, transaction: tx, onClose }: Props) {
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly')
  const [loading, setLoading] = useState(false)
  const { addRecurring } = useRecurring()

  if (!tx) return null

  async function handleCreate() {
    if (!tx) return
    setLoading(true)
    try {
      await addRecurring({
        frequency,
        isActive: true,
        templateTransaction: {
          accountId:   tx.accountId,
          type:        tx.type,
          amount:      tx.amount,
          description: tx.description,
          tags:        tx.tags,
          ...(tx.toAccountId  !== undefined && { toAccountId:  tx.toAccountId }),
          ...(tx.transferFee  !== undefined && { transferFee:  tx.transferFee }),
        },
      })
      toast.success('Recurring created', `"${tx.description}" will repeat ${frequency}.`)
      onClose()
    } catch {
      toast.error('Failed to create recurring')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-primary" />
            Create Recurring
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Transaction summary */}
          <div className="rounded-md border border-border bg-secondary/30 px-3 py-2 space-y-0.5 text-sm">
            <p className="font-medium truncate">{tx.description}</p>
            <p className="text-xs text-muted-foreground">
              {tx.type} · {tx.amount.toLocaleString()}
              {tx.tags.length > 0 && ` · #${tx.tags.join(' #')}`}
            </p>
          </div>

          {/* Frequency picker */}
          <div className="space-y-1.5">
            <Label>Repeat every</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as RecurringFrequency)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Day</SelectItem>
                <SelectItem value="weekly">Week</SelectItem>
                <SelectItem value="monthly">Month</SelectItem>
                <SelectItem value="yearly">Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            The next occurrence will be scheduled automatically. You can manage it in the Recurring page.
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating…' : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
