import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Tags } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTransactions } from '@/hooks/useTransactions'
import { db } from '@/db/db'
import { toast } from '@/hooks/useToast'

function TagRenameCard() {
  const { renameTag } = useTransactions()
  const [oldTag, setOldTag] = useState('')
  const [newTag, setNewTag] = useState('')
  const [loading, setLoading] = useState(false)

  // All distinct tags from committed transactions
  const allTags = useLiveQuery(async () => {
    const txs = await db.transactions.where('isCommitted').equals(1).toArray()
    const tagSet = new Set<string>()
    txs.forEach((tx) => tx.tags.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [])

  // Affected count for selected tag
  const affectedCount = useLiveQuery(async () => {
    if (!oldTag) return 0
    return db.transactions.where('tags').equals(oldTag).count()
  }, [oldTag])

  const noTags = !allTags || allTags.length === 0
  const newTagTrimmed = newTag.trim().toLowerCase()
  const canConfirm = oldTag !== '' && newTagTrimmed !== '' && newTagTrimmed !== oldTag && !loading

  async function handleRename() {
    if (!canConfirm) return
    setLoading(true)
    try {
      const count = await renameTag(oldTag, newTag)
      if (count === 0) {
        toast.info('No transactions updated', 'Tag may have already been removed.')
      } else {
        toast.success('Tag renamed', `Renamed '#${oldTag}' → '#${newTagTrimmed}' across ${count} transaction${count !== 1 ? 's' : ''}`)
      }
      setOldTag('')
      setNewTag('')
    } catch {
      toast.error('Rename failed', 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Tags className="h-4 w-4 text-muted-foreground" />
          Rename Tag
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Bulk-rename a tag across all transactions. Renaming to an existing tag merges them.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Existing tag</Label>
          <Select
            value={oldTag}
            onValueChange={(v) => { setOldTag(v); setNewTag('') }}
            disabled={noTags}
          >
            <SelectTrigger>
              <SelectValue placeholder={noTags ? 'No tags found' : 'Select a tag…'} />
            </SelectTrigger>
            <SelectContent>
              {(allTags ?? []).map((tag) => (
                <SelectItem key={tag} value={tag}>#{tag}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {oldTag && affectedCount !== undefined && (
            <p className="text-xs text-muted-foreground">
              {affectedCount} transaction{affectedCount !== 1 ? 's' : ''} will be updated
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>New tag name</Label>
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="e.g. groceries"
            disabled={!oldTag}
          />
        </div>

        <Button
          onClick={handleRename}
          disabled={!canConfirm}
          className="w-full"
        >
          {loading ? 'Renaming…' : 'Confirm Rename'}
        </Button>
      </CardContent>
    </Card>
  )
}

export default function Utilities() {
  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto md:p-6">
      <div className="pt-2">
        <h1 className="text-2xl font-bold">Utilities</h1>
        <p className="text-sm text-muted-foreground">Data management tools</p>
      </div>

      <TagRenameCard />
    </div>
  )
}
