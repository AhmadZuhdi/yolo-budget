import { useState } from 'react'
import { Plus, Wallet, Building2, Banknote, CreditCard, TrendingUp, PiggyBank, Trash2, Pencil } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { AmountInput } from '@/components/ui/amount-input'
import { useAccounts } from '@/hooks/useAccounts'
import { useStagingStore } from '@/store/stagingStore'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency, evalAmount, todayYMD } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import type { AccountType, AccountWithBalance } from '@/db/types'

const ACCOUNT_ICONS: Record<AccountType, React.ElementType> = {
  cash: Banknote,
  bank: Building2,
  credit_card: CreditCard,
  savings: PiggyBank,
  investment: TrendingUp,
  other: Wallet,
}

const ACCOUNT_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

function AccountFormDialog({
  open,
  onClose,
  initial,
}: {
  open: boolean
  onClose: () => void
  initial?: AccountWithBalance
}) {
  const { addAccount, updateAccount } = useAccounts()
  const isEdit = !!initial
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    type: (initial?.type ?? 'bank') as AccountType,
    initialBalance: String(initial?.initialBalance ?? '0'),
    currency: initial?.currency ?? 'USD',
    color: initial?.color ?? ACCOUNT_COLORS[0],
    icon: initial?.icon ?? 'Building2',
  })

  // Reset form when dialog opens with new data
  function resetAndClose() {
    setForm({
      name: initial?.name ?? '',
      type: (initial?.type ?? 'bank') as AccountType,
      initialBalance: String(initial?.initialBalance ?? '0'),
      currency: initial?.currency ?? 'USD',
      color: initial?.color ?? ACCOUNT_COLORS[0],
      icon: initial?.icon ?? 'Building2',
    })
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    if (isEdit) {
      await updateAccount(initial!.id!, {
        name: form.name,
        type: form.type,
        initialBalance: parseFloat(form.initialBalance) || 0,
        currency: form.currency,
        color: form.color,
        icon: form.icon,
      })
      toast.success('Account updated', `"${form.name}" has been updated.`)
    } else {
      await addAccount({ ...form, initialBalance: parseFloat(form.initialBalance) || 0 })
      toast.success('Account created', `"${form.name}" added to your accounts.`)
    }
    resetAndClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && resetAndClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Account' : 'Add Account'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Main Bank"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm((f) => ({ ...f, type: v as AccountType }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank Account</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
                <SelectItem value="investment">Investment</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Initial Balance</Label>
            <AmountInput
              value={form.initialBalance}
              onChange={(v) => setForm((f) => ({ ...f, initialBalance: v }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {ACCOUNT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    form.color === c ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose}>Cancel</Button>
            <Button type="submit">{isEdit ? 'Save Changes' : 'Add Account'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteAccountDialog({
  account,
  open,
  onClose,
}: {
  account: AccountWithBalance | null
  open: boolean
  onClose: () => void
}) {
  const { deleteAccount } = useAccounts()

  async function handleDelete() {
    if (!account) return
    await deleteAccount(account.id!)
    toast.success('Account deleted', `"${account.name}" and its transactions were removed.`)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Account</DialogTitle>
          <DialogDescription>
            Delete <strong>{account?.name}</strong>? This will permanently remove the account and
            all its transactions. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TransferDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { accounts } = useAccounts()
  const { addToStaging, openSheet } = useStagingStore()
  const [form, setForm] = useState({
    fromId: '',
    toId: '',
    amount: '',
    description: 'Transfer',
    fee: '',
    tags: '',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fromId || !form.toId || !form.amount) return
    if (form.fromId === form.toId) return

    addToStaging({
      type: 'transfer',
      accountId: Number(form.fromId),
      toAccountId: Number(form.toId),
      amount: evalAmount(form.amount) ?? parseFloat(form.amount),
      date: todayYMD(),
      description: form.description || 'Transfer',
      tags: form.tags ? form.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : [],
      transferFee: form.fee ? (evalAmount(form.fee) ?? parseFloat(form.fee)) : undefined,
    })

    toast.info('Transfer staged', 'Review it in the staging area, then commit.')
    openSheet()
    onClose()
    setForm({ fromId: '', toId: '', amount: '', description: 'Transfer', fee: '', tags: '' })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Between Accounts</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Select value={form.fromId} onValueChange={(v) => setForm((f) => ({ ...f, fromId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Select value={form.toId} onValueChange={(v) => setForm((f) => ({ ...f, toId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {accounts.filter((a) => String(a.id) !== form.fromId).map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <AmountInput value={form.amount}
              onChange={(v) => setForm((f) => ({ ...f, amount: v }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Transfer Fee (optional)</Label>
            <AmountInput value={form.fee}
              onChange={(v) => setForm((f) => ({ ...f, fee: v }))}
              placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Tags (comma separated)</Label>
            <Input value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="atm, transfer" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="transfer">Stage Transfer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function Accounts() {
  const { accountsWithBalance } = useAccounts()
  const { currency } = useSettings()
  const [showAdd, setShowAdd] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [editTarget, setEditTarget] = useState<AccountWithBalance | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AccountWithBalance | null>(null)

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto md:p-6">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-sm text-muted-foreground">{accountsWithBalance.length} accounts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowTransfer(true)}>
            Transfer
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>
      </div>

      {accountsWithBalance.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Wallet className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>No accounts yet</p>
          <Button className="mt-4" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add your first account
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {accountsWithBalance.map((acc) => {
            const Icon = ACCOUNT_ICONS[acc.type] ?? Wallet
            return (
              <Card key={acc.id} className="relative overflow-hidden group">
                <div
                  className="absolute top-0 left-0 w-1 h-full"
                  style={{ backgroundColor: acc.color }}
                />
                <CardContent className="pl-5 pr-4 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="p-2 rounded-lg shrink-0"
                        style={{ backgroundColor: `${acc.color}20` }}
                      >
                        <Icon className="h-4 w-4" style={{ color: acc.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{acc.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {acc.type.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <span className={`text-lg font-bold ${acc.balance < 0 ? 'text-red-400' : 'text-foreground'}`}>
                          {formatCurrency(acc.balance, currency)}
                        </span>
                        <button
                          onClick={() => setEditTarget(acc)}
                          className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                          aria-label="Edit account"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(acc)}
                          className="p-1.5 rounded text-muted-foreground hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          aria-label="Delete account"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add account dialog */}
      <AccountFormDialog open={showAdd} onClose={() => setShowAdd(false)} />

      {/* Edit account dialog */}
      <AccountFormDialog
        key={editTarget?.id}
        open={!!editTarget}
        initial={editTarget ?? undefined}
        onClose={() => setEditTarget(null)}
      />

      {/* Delete confirmation dialog */}
      <DeleteAccountDialog
        account={deleteTarget}
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />

      <TransferDialog open={showTransfer} onClose={() => setShowTransfer(false)} />
    </div>
  )
}
