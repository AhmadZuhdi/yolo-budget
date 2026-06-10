import { useState, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Tags, GitMerge, FileDown, FileUp, Loader2, Check, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { useTransactions } from '@/hooks/useTransactions'
import { db } from '@/db/db'
import { toast } from '@/hooks/useToast'
import { exportToJsonFile, importFromJsonFile } from '@/utils/fileBackup'
import { restoreFromPayload } from '@/utils/gistSync'
import type { GistSyncPayload } from '@/db/types'

function TagRenameCard() {
  const { renameTag } = useTransactions()
  const [oldTag, setOldTag] = useState('')
  const [newTag, setNewTag] = useState('')
  const [loading, setLoading] = useState(false)

  // All distinct tags from committed transactions
  const allTags = useLiveQuery(async () => {
    const txs = await db.transactions.filter(tx => tx.isCommitted === true).toArray()
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

function TagMergeCard() {
  const { mergeTag } = useTransactions()
  const [sourceTag, setSourceTag] = useState('')
  const [targetTag, setTargetTag] = useState('')
  const [loading, setLoading] = useState(false)

  // All distinct tags from committed transactions
  const allTags = useLiveQuery(async () => {
    const txs = await db.transactions.filter((tx) => tx.isCommitted === true).toArray()
    const tagSet = new Set<string>()
    txs.forEach((tx) => tx.tags.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [])

  // Count of committed transactions containing the source tag
  const affectedCount = useLiveQuery(async () => {
    if (!sourceTag) return 0
    const txs = await db.transactions
      .filter((tx) => tx.isCommitted === true && tx.tags.includes(sourceTag))
      .toArray()
    return txs.length
  }, [sourceTag])

  const noTags = !allTags || allTags.length === 0
  const canConfirm = sourceTag !== '' && targetTag !== '' && sourceTag !== targetTag && !loading

  async function handleMerge() {
    if (!canConfirm) return
    setLoading(true)
    try {
      const count = await mergeTag(sourceTag, targetTag)
      toast.success(
        'Tags merged',
        `Merged '#${sourceTag}' into '#${targetTag}' across ${count} transaction${count !== 1 ? 's' : ''}`
      )
      setSourceTag('')
      setTargetTag('')
    } catch {
      toast.error('Merge failed', 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitMerge className="h-4 w-4 text-muted-foreground" />
          Merge Tags
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Replace a source tag with a target tag across all transactions. The source tag is removed.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Source tag (to remove)</Label>
          <Select
            value={sourceTag}
            onValueChange={(v) => { setSourceTag(v); setTargetTag('') }}
            disabled={noTags}
          >
            <SelectTrigger>
              <SelectValue placeholder={noTags ? 'No tags found' : 'Select source tag…'} />
            </SelectTrigger>
            <SelectContent>
              {(allTags ?? []).map((tag) => (
                <SelectItem key={tag} value={tag}>#{tag}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {sourceTag && affectedCount !== undefined && (
            <p className="text-xs text-muted-foreground">
              {affectedCount} transaction{affectedCount !== 1 ? 's' : ''} will be updated
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Target tag (to keep)</Label>
          <Select
            value={targetTag}
            onValueChange={setTargetTag}
            disabled={noTags || !sourceTag}
          >
            <SelectTrigger>
              <SelectValue placeholder={!sourceTag ? 'Select source first…' : 'Select target tag…'} />
            </SelectTrigger>
            <SelectContent>
              {(allTags ?? [])
                .filter((tag) => tag !== sourceTag)
                .map((tag) => (
                  <SelectItem key={tag} value={tag}>#{tag}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleMerge} disabled={!canConfirm} className="w-full">
          {loading ? 'Merging…' : 'Confirm Merge'}
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Export to JSON ───────────────────────────────────────────────────────────

function ExportJsonCard() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')

  async function handleExport() {
    try {
      setStatus('loading')
      await exportToJsonFile()
      setStatus('success')
      toast.success('Export successful', 'JSON file has been downloaded.')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      setStatus('idle')
      toast.error('Export failed', String(err))
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileDown className="h-4 w-4 text-muted-foreground" />
          Export to JSON
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Download all your data as a JSON file for backup or transfer.
        </p>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handleExport}
          disabled={status === 'loading'}
          variant="outline"
          className="w-full flex items-center gap-2"
        >
          {status === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : status === 'success' ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          {status === 'loading' ? 'Exporting…' : status === 'success' ? 'Exported!' : 'Export JSON'}
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Import from JSON ─────────────────────────────────────────────────────────

type ImportState = 'idle' | 'loading' | 'preview' | 'restoring' | 'success'

function ImportJsonCard() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<ImportState>('idle')
  const [previewPayload, setPreviewPayload] = useState<GistSyncPayload | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setState('loading')
    setErrorMsg('')
    importFromJsonFile(file)
      .then((payload) => {
        setPreviewPayload(payload)
        setState('preview')
      })
      .catch((err: Error) => {
        setErrorMsg(err.message)
        setState('idle')
        toast.error('Import failed', err.message)
      })
      .finally(() => {
        if (inputRef.current) inputRef.current.value = ''
      })
  }

  async function handleConfirm() {
    if (!previewPayload) return
    setState('restoring')
    try {
      await restoreFromPayload(previewPayload)
      setState('success')
      toast.success('Import successful', 'All data has been restored from the file.')
      setTimeout(() => setState('idle'), 3000)
    } catch (err) {
      setState('preview')
      toast.error('Import failed', String(err))
    }
  }

  function handleCancel() {
    setState('idle')
    setPreviewPayload(null)
    setErrorMsg('')
  }

  const counts = previewPayload
    ? {
        accounts: previewPayload.accounts.length,
        transactions: previewPayload.transactions.length,
        budgets: previewPayload.budgets.length,
        recurring: previewPayload.recurring.length,
      }
    : null

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileUp className="h-4 w-4 text-muted-foreground" />
            Import from JSON
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Restore data from a previously exported JSON file. This will replace all existing data.
          </p>
        </CardHeader>
        <CardContent>
          <input
            ref={inputRef}
            type="file"
            accept=".json"
            onChange={handleFilePicked}
            className="hidden"
          />
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={state === 'loading' || state === 'restoring'}
            variant="outline"
            className="w-full flex items-center gap-2"
          >
            {state === 'loading' || state === 'restoring' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : state === 'success' ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <FileUp className="h-4 w-4" />
            )}
            {state === 'loading' ? 'Reading file…' : state === 'restoring' ? 'Restoring…' : state === 'success' ? 'Imported!' : 'Select JSON file'}
          </Button>
        </CardContent>
      </Card>

      {/* Import preview dialog */}
      <Dialog open={state === 'preview'} onOpenChange={(v) => { if (!v) handleCancel() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              Review before importing
            </DialogTitle>
            <DialogDescription>
              This will permanently replace all your existing data with the data from the file.
            </DialogDescription>
          </DialogHeader>

          {counts && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-secondary/50 px-3 py-2 text-center">
                <p className="text-lg font-bold">{counts.accounts}</p>
                <p className="text-xs text-muted-foreground">accounts</p>
              </div>
              <div className="rounded-md bg-secondary/50 px-3 py-2 text-center">
                <p className="text-lg font-bold">{counts.transactions}</p>
                <p className="text-xs text-muted-foreground">transactions</p>
              </div>
              <div className="rounded-md bg-secondary/50 px-3 py-2 text-center">
                <p className="text-lg font-bold">{counts.budgets}</p>
                <p className="text-xs text-muted-foreground">budgets</p>
              </div>
              <div className="rounded-md bg-secondary/50 px-3 py-2 text-center">
                <p className="text-lg font-bold">{counts.recurring}</p>
                <p className="text-xs text-muted-foreground">recurring</p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {errorMsg}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirm}>
              Yes, overwrite with file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function Utilities() {  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto md:p-6">
      <div className="pt-2">
        <h1 className="text-2xl font-bold">Utilities</h1>
        <p className="text-sm text-muted-foreground">Data management tools</p>
      </div>

      <TagRenameCard />
      <TagMergeCard />
      <ExportJsonCard />
      <ImportJsonCard />
    </div>
  )
}
