import { useState, useEffect } from 'react'
import { TrendingDown, TrendingUp, ArrowRight, Plus, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { AmountInput } from '@/components/ui/amount-input'
import { useAccounts } from '@/hooks/useAccounts'
import { useSettings } from '@/hooks/useSettings'
import { useTransactions } from '@/hooks/useTransactions'
import { toast } from '@/hooks/useToast'
import { cn, getCurrencySymbol, evalAmount } from '@/lib/utils'
import type { Transaction, TransactionType } from '@/db/types'

interface EditTransactionDialogProps {
  transaction: Transaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TYPES: { value: TransactionType; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'expense',  label: 'Expense',  icon: TrendingDown, color: 'text-red-400' },
  { value: 'income',   label: 'Income',   icon: TrendingUp,   color: 'text-emerald-400' },
  { value: 'transfer', label: 'Transfer', icon: ArrowRight,   color: 'text-blue-400' },
]

const COMMON_TAGS: Record<TransactionType, string[]> = {
  expense:  ['food', 'transport', 'housing', 'health', 'entertainment', 'shopping', 'utilities'],
  income:   ['salary', 'freelance', 'investment', 'gift', 'refund'],
  transfer: ['savings', 'atm', 'investment'],
}

export function EditTransactionDialog({ transaction, open, onOpenChange }: EditTransactionDialogProps) {
  const { accounts } = useAccounts()
  const { currency } = useSettings()
  const { updateTransaction } = useTransactions()
  const currencySymbol = getCurrencySymbol(currency)

  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [accountId, setAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [date, setDate] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [transferFee, setTransferFee] = useState('')
  const [loading, setLoading] = useState(false)

  // Populate fields when dialog opens with a transaction
  useEffect(() => {
    if (!transaction) return
    setType(transaction.type)
    setAmount(String(transaction.amount))
    setDescription(transaction.description)
    setAccountId(String(transaction.accountId))
    setToAccountId(transaction.toAccountId ? String(transaction.toAccountId) : '')
    setDate(transaction.date)
    setTags(transaction.tags)
    setTagInput('')
    setTransferFee(transaction.transferFee ? String(transaction.transferFee) : '')
  }, [transaction])

  function addTag(raw: string) {
    const t = raw.trim().toLowerCase().replace(/^#/, '')
    if (!t || tags.includes(t)) return
    setTags((prev) => [...prev, t])
    setTagInput('')
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag))
  }

  function toggleSuggestedTag(tag: string) {
    tags.includes(tag) ? removeTag(tag) : setTags((prev) => [...prev, tag])
  }

  const parsedAmount = evalAmount(amount) ?? parseFloat(amount)
  const parsedFee = transferFee ? (evalAmount(transferFee) ?? parseFloat(transferFee)) : undefined

  const isValid =
    amount && parsedAmount > 0 &&
    accountId &&
    (type !== 'transfer' || (toAccountId && toAccountId !== accountId))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || !transaction?.id) return
    setLoading(true)

    try {
      await updateTransaction(transaction.id, {
        type,
        accountId: Number(accountId),
        amount: parsedAmount,
        date,
        description: description.trim() || (type === 'transfer' ? 'Transfer' : type === 'income' ? 'Income' : 'Expense'),
        tags,
        toAccountId: type === 'transfer' ? Number(toAccountId) : undefined,
        transferFee: type === 'transfer' && parsedFee ? parsedFee : undefined,
      })
      toast.success('Transaction updated')
      onOpenChange(false)
    } catch (err) {
      toast.error('Failed to update transaction', String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-secondary">
            {TYPES.map(({ value, label, icon: Icon, color }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setType(value); setTags([]) }}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all',
                  type === value
                    ? 'bg-card shadow-sm ' + color
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <AmountInput
              value={amount}
              onChange={setAmount}
              prefix={currencySymbol}
              placeholder="0.00"
              autoFocus
              className="text-lg font-semibold"
            />
          </div>

          {/* Account(s) */}
          <div className={cn('grid gap-3', type === 'transfer' ? 'grid-cols-2' : 'grid-cols-1')}>
            <div className="space-y-1.5">
              <Label>{type === 'transfer' ? 'From' : 'Account'}</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {type === 'transfer' && (
              <div className="space-y-1.5">
                <Label>To</Label>
                <Select value={toAccountId} onValueChange={setToAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((a) => String(a.id) !== accountId)
                      .map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Transfer fee */}
          {type === 'transfer' && (
            <div className="space-y-1.5">
              <Label>Transfer Fee <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <AmountInput
                value={transferFee}
                onChange={setTransferFee}
                prefix={currencySymbol}
                placeholder="0.00"
              />
            </div>
          )}

          {/* Description + Date row */}
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={type === 'transfer' ? 'Transfer' : type === 'income' ? 'Salary…' : 'Coffee…'}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-[130px]"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_TAGS[type].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleSuggestedTag(t)}
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full border transition-colors',
                    tags.includes(t)
                      ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tags.includes(t) && <Check className="inline h-2.5 w-2.5 mr-1" />}
                  #{t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) }
                  if (e.key === ',' || e.key === ' ') { e.preventDefault(); addTag(tagInput) }
                }}
                placeholder="Custom tag…"
                className="h-8 text-sm"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => addTag(tagInput)} className="shrink-0 h-8">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <Badge key={t} variant="tag" className="cursor-pointer" onClick={() => removeTag(t)}>
                    #{t} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={!isValid || loading}
            className={cn(
              'w-full',
              type === 'income'   && 'bg-emerald-600 hover:bg-emerald-700',
              type === 'expense'  && 'bg-primary',
              type === 'transfer' && 'bg-blue-600 hover:bg-blue-700',
            )}
          >
            {loading ? 'Saving…' : 'Save Changes'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
