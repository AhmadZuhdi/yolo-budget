import { useState } from 'react'
import { Plus, Target, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useBudgets } from '@/hooks/useBudgets'
import { useTransactions } from '@/hooks/useTransactions'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency, cn } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import type { BudgetPeriod } from '@/db/types'

function AddBudgetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addBudget } = useBudgets()
  const { allTags } = useTransactions()
  const { currency } = useSettings()
  const [form, setForm] = useState({
    name: '',
    limitAmount: '',
    period: 'monthly' as BudgetPeriod,
    tagInput: '',
    targetTags: [] as string[],
  })

  function addTag(tag: string) {
    const t = tag.trim().toLowerCase().replace(/^#/, '')
    if (!t || form.targetTags.includes(t)) return
    setForm((f) => ({ ...f, targetTags: [...f.targetTags, t], tagInput: '' }))
  }

  function removeTag(tag: string) {
    setForm((f) => ({ ...f, targetTags: f.targetTags.filter((t) => t !== tag) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.limitAmount || form.targetTags.length === 0) return
    await addBudget({
      name: form.name,
      limitAmount: parseFloat(form.limitAmount),
      period: form.period,
      targetTags: form.targetTags,
    })
    toast.success('Budget created', `"${form.name}" — ${formatCurrency(parseFloat(form.limitAmount), currency)} / ${form.period}`)
    onClose()
    setForm({ name: '', limitAmount: '', period: 'monthly', tagInput: '', targetTags: [] })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Budget</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Budget Name</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Food & Groceries" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Limit</Label>
              <Input type="number" step="0.01" min="1" value={form.limitAmount}
                onChange={(e) => setForm((f) => ({ ...f, limitAmount: e.target.value }))}
                placeholder="300.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Period</Label>
              <Select value={form.period} onValueChange={(v) => setForm((f) => ({ ...f, period: v as BudgetPeriod }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Track Tags</Label>
            <div className="flex gap-2">
              <Input
                value={form.tagInput}
                onChange={(e) => setForm((f) => ({ ...f, tagInput: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(form.tagInput) } }}
                placeholder="Type tag and press Enter"
                list="existing-tags"
              />
              <datalist id="existing-tags">
                {allTags.map((t) => <option key={t} value={t} />)}
              </datalist>
              <Button type="button" variant="outline" size="sm"
                onClick={() => addTag(form.tagInput)}>Add</Button>
            </div>
            {form.targetTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.targetTags.map((tag) => (
                  <Badge key={tag} variant="tag" className="cursor-pointer" onClick={() => removeTag(tag)}>
                    #{tag} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={form.targetTags.length === 0}>Create Budget</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function Budgets() {
  const { budgets, deleteBudget } = useBudgets()
  const { currency } = useSettings()
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto md:p-6">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold">Budgets</h1>
          <p className="text-sm text-muted-foreground">{budgets.length} budgets</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>

      {budgets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>No budgets yet</p>
          <p className="text-sm mt-1">Set spending limits for tagged expenses</p>
          <Button className="mt-4" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create your first budget
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map((b) => (
            <Card key={b.id} className={cn(
              'transition-colors',
              b.status === 'danger'  && 'border-red-500/30',
              b.status === 'warning' && 'border-yellow-500/30',
            )}>
              <CardHeader className="pb-2 flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-base">{b.name}</CardTitle>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">{b.period}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-sm font-semibold',
                    b.status === 'safe'    && 'text-emerald-400',
                    b.status === 'warning' && 'text-yellow-400',
                    b.status === 'danger'  && 'text-red-400',
                  )}>
                    {Math.round(b.percentage)}%
                  </span>
                  <button
                    onClick={async () => {
                      await deleteBudget(b.id!)
                      toast.warning('Budget deleted', `"${b.name}" removed.`)
                    }}
                    className="p-1 rounded text-muted-foreground hover:text-red-400 transition-colors"
                    aria-label="Delete budget"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress
                  value={Math.min(b.percentage, 100)}
                  indicatorClassName={cn(
                    b.status === 'safe'    && 'bg-emerald-500',
                    b.status === 'warning' && 'bg-yellow-500',
                    b.status === 'danger'  && 'bg-red-500',
                  )}
                />
                <div className="flex items-center justify-between text-sm">
                  <div className="flex flex-wrap gap-1">
                    {b.targetTags.map((tag) => (
                      <Badge key={tag} variant="tag" className="text-[10px] px-1.5 py-0">#{tag}</Badge>
                    ))}
                  </div>
                  <span className="text-muted-foreground shrink-0 ml-2">
                    {formatCurrency(b.spent, currency)} / {formatCurrency(b.limitAmount, currency)}
                  </span>
                </div>
                {b.status === 'danger' && (
                  <p className="text-xs text-red-400 font-medium">
                    Over budget by {formatCurrency(b.spent - b.limitAmount, currency)}
                  </p>
                )}
                {b.status === 'warning' && (
                  <p className="text-xs text-yellow-400">
                    {formatCurrency(b.limitAmount - b.spent, currency)} remaining
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddBudgetDialog open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  )
}
