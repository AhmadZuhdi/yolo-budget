import { useState, useEffect } from 'react'
import { Plus, RefreshCw, Trash2, Pencil } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { AmountInput } from '@/components/ui/amount-input'
import { useRecurring } from '@/hooks/useRecurring'
import { useAccounts } from '@/hooks/useAccounts'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency, formatDate, evalAmount } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import type { Recurring, RecurringFrequency, TransactionType } from '@/db/types'

function AddRecurringDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addRecurring } = useRecurring()
  const { accounts } = useAccounts()
  const [form, setForm] = useState({
    description: '',
    amount: '',
    type: 'expense' as TransactionType,
    accountId: '',
    frequency: 'monthly' as RecurringFrequency,
    tags: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description || !form.amount || !form.accountId) return
    await addRecurring({
      frequency: form.frequency,
      isActive: true,
      templateTransaction: {
        accountId: Number(form.accountId),
        type: form.type,
        amount: evalAmount(form.amount) ?? parseFloat(form.amount),
        description: form.description,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : [],
      },
    })
    toast.success('Recurring saved', `"${form.description}" — every ${form.frequency}`)
    onClose()
    setForm({ description: '', amount: '', type: 'expense', accountId: '', frequency: 'monthly', tags: '' })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Recurring Transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Netflix Subscription" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <AmountInput value={form.amount}
                onChange={(v) => setForm((f) => ({ ...f, amount: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as TransactionType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Account</Label>
              <Select value={form.accountId} onValueChange={(v) => setForm((f) => ({ ...f, accountId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select value={form.frequency} onValueChange={(v) => setForm((f) => ({ ...f, frequency: v as RecurringFrequency }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tags (comma separated)</Label>
            <Input value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="subscription, entertainment" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditRecurringDialog({ recurring, open, onClose }: { recurring: Recurring | null; open: boolean; onClose: () => void }) {
  const { updateRecurring } = useRecurring()
  const { accounts } = useAccounts()
  const [form, setForm] = useState({
    description: '',
    amount: '',
    type: 'expense' as TransactionType,
    accountId: '',
    frequency: 'monthly' as RecurringFrequency,
    tags: '',
  })

  // Populate form when a recurring entry is passed in
  useEffect(() => {
    if (recurring) {
      setForm({
        description: recurring.templateTransaction.description,
        amount: String(recurring.templateTransaction.amount),
        type: recurring.templateTransaction.type as TransactionType,
        accountId: String(recurring.templateTransaction.accountId),
        frequency: recurring.frequency,
        tags: recurring.templateTransaction.tags.join(', '),
      })
    }
  }, [recurring?.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!recurring?.id || !form.description || !form.amount || !form.accountId) return
    await updateRecurring(recurring.id, {
      frequency: form.frequency,
      templateTransaction: {
        ...recurring.templateTransaction,
        accountId: Number(form.accountId),
        type: form.type,
        amount: evalAmount(form.amount) ?? parseFloat(form.amount),
        description: form.description,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : [],
      },
    })
    toast.success('Recurring updated', `"${form.description}" saved.`)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Recurring Transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Netflix Subscription" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <AmountInput value={form.amount}
                onChange={(v) => setForm((f) => ({ ...f, amount: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as TransactionType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Account</Label>
              <Select value={form.accountId} onValueChange={(v) => setForm((f) => ({ ...f, accountId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select value={form.frequency} onValueChange={(v) => setForm((f) => ({ ...f, frequency: v as RecurringFrequency }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tags (comma separated)</Label>
            <Input value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="subscription, entertainment" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function Recurring() {
  const { recurring, deleteRecurring, toggleActive } = useRecurring()
  const { accounts } = useAccounts()
  const { currency } = useSettings()
  const [showAdd, setShowAdd] = useState(false)
  const [editingRecurring, setEditingRecurring] = useState<Recurring | null>(null)

  function getAccount(id: number) {
    return accounts.find((a) => a.id === id)
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto md:p-6">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold">Recurring</h1>
          <p className="text-sm text-muted-foreground">{recurring.filter((r) => r.isActive).length} active</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>

      {recurring.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <RefreshCw className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>No recurring transactions</p>
          <p className="text-sm mt-1">Auto-generate subscriptions and regular bills</p>
          <Button className="mt-4" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add first recurring
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {recurring.map((r) => {
            const account = getAccount(r.templateTransaction.accountId)
            const { type, amount, description, tags } = r.templateTransaction
            return (
              <Card key={r.id} className={!r.isActive ? 'opacity-50' : undefined}>
                <CardContent className="flex items-start gap-3 py-4">
                  <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                    type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">{description}</p>
                      <span className={`text-sm font-semibold shrink-0 ${
                        type === 'income' ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {type === 'income' ? '+' : '-'}{formatCurrency(amount, currency)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="text-xs text-muted-foreground capitalize">{r.frequency}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{account?.name}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        Next: {formatDate(r.nextOccurrence)}
                      </span>
                    </div>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {tags.map((tag) => (
                          <Badge key={tag} variant="tag" className="text-[10px] px-1.5 py-0">#{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={r.isActive}
                      onCheckedChange={async (v) => {
                        await toggleActive(r.id!, v)
                        toast.info(v ? 'Activated' : 'Paused', `"${description}" recurring ${v ? 'enabled' : 'disabled'}.`)
                      }}
                      aria-label="Toggle active"
                    />
                    <button
                      onClick={() => setEditingRecurring(r)}
                      className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      aria-label="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        await deleteRecurring(r.id!)
                        toast.warning('Deleted', `"${description}" recurring removed.`)
                      }}
                      className="p-1.5 rounded text-muted-foreground hover:text-red-400 transition-colors"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <AddRecurringDialog open={showAdd} onClose={() => setShowAdd(false)} />

      <EditRecurringDialog
        recurring={editingRecurring}
        open={editingRecurring !== null}
        onClose={() => setEditingRecurring(null)}
      />
    </div>
  )
}
