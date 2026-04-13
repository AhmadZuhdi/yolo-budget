import { useState, useRef, useEffect } from 'react'
import { Settings as SettingsIcon, Github, Upload, Download, Check, Loader2, Trash2, ChevronDown, Search, Info } from 'lucide-react'
import pkg from '../../package.json'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useSettings } from '@/hooks/useSettings'
import { exportToGist, restoreFromPayload, createNewGist } from '@/utils/gistSync'
import { ImportPreviewDialog, ExportPreviewDialog } from '@/components/staging/ImportPreviewDialog'
import type { GistSyncPayload } from '@/db/types'
import { formatDate, cn } from '@/lib/utils'
import { db } from '@/db/db'
import { toast } from '@/hooks/useToast'

// Common world currencies with flag emoji
const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', flag: '🇬🇧' },
  { code: 'JPY', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'CNY', name: 'Chinese Yuan', flag: '🇨🇳' },
  { code: 'INR', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'CAD', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'AUD', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'CHF', name: 'Swiss Franc', flag: '🇨🇭' },
  { code: 'HKD', name: 'Hong Kong Dollar', flag: '🇭🇰' },
  { code: 'SGD', name: 'Singapore Dollar', flag: '🇸🇬' },
  { code: 'SEK', name: 'Swedish Krona', flag: '🇸🇪' },
  { code: 'NOK', name: 'Norwegian Krone', flag: '🇳🇴' },
  { code: 'DKK', name: 'Danish Krone', flag: '🇩🇰' },
  { code: 'NZD', name: 'New Zealand Dollar', flag: '🇳🇿' },
  { code: 'MXN', name: 'Mexican Peso', flag: '🇲🇽' },
  { code: 'BRL', name: 'Brazilian Real', flag: '🇧🇷' },
  { code: 'ZAR', name: 'South African Rand', flag: '🇿🇦' },
  { code: 'KRW', name: 'South Korean Won', flag: '🇰🇷' },
  { code: 'TRY', name: 'Turkish Lira', flag: '🇹🇷' },
  { code: 'IDR', name: 'Indonesian Rupiah', flag: '🇮🇩' },
  { code: 'MYR', name: 'Malaysian Ringgit', flag: '🇲🇾' },
  { code: 'THB', name: 'Thai Baht', flag: '🇹🇭' },
  { code: 'PHP', name: 'Philippine Peso', flag: '🇵🇭' },
  { code: 'VND', name: 'Vietnamese Dong', flag: '🇻🇳' },
  { code: 'AED', name: 'UAE Dirham', flag: '🇦🇪' },
  { code: 'SAR', name: 'Saudi Riyal', flag: '🇸🇦' },
  { code: 'EGP', name: 'Egyptian Pound', flag: '🇪🇬' },
  { code: 'NGN', name: 'Nigerian Naira', flag: '🇳🇬' },
  { code: 'KES', name: 'Kenyan Shilling', flag: '🇰🇪' },
  { code: 'GHS', name: 'Ghanaian Cedi', flag: '🇬🇭' },
  { code: 'PKR', name: 'Pakistani Rupee', flag: '🇵🇰' },
  { code: 'BDT', name: 'Bangladeshi Taka', flag: '🇧🇩' },
  { code: 'LKR', name: 'Sri Lankan Rupee', flag: '🇱🇰' },
  { code: 'NPR', name: 'Nepalese Rupee', flag: '🇳🇵' },
  { code: 'MMK', name: 'Myanmar Kyat', flag: '🇲🇲' },
  { code: 'TWD', name: 'Taiwan Dollar', flag: '🇹🇼' },
  { code: 'HUF', name: 'Hungarian Forint', flag: '🇭🇺' },
  { code: 'PLN', name: 'Polish Zloty', flag: '🇵🇱' },
  { code: 'CZK', name: 'Czech Koruna', flag: '🇨🇿' },
  { code: 'RON', name: 'Romanian Leu', flag: '🇷🇴' },
  { code: 'ILS', name: 'Israeli Shekel', flag: '🇮🇱' },
  { code: 'CLP', name: 'Chilean Peso', flag: '🇨🇱' },
  { code: 'COP', name: 'Colombian Peso', flag: '🇨🇴' },
  { code: 'PEN', name: 'Peruvian Sol', flag: '🇵🇪' },
  { code: 'ARS', name: 'Argentine Peso', flag: '🇦🇷' },
]

function CurrencySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = CURRENCIES.find((c) => c.code === value)
  const filtered = CURRENCIES.filter(
    (c) =>
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
  )

  function handleOpen() {
    setOpen(true)
    setSearch('')
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  function handleSelect(code: string) {
    onChange(code)
    setOpen(false)
    setSearch('')
  }

  // Close on outside click
  function handleBlur(e: React.FocusEvent) {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative w-56" onBlur={handleBlur}>
      <button
        type="button"
        onClick={handleOpen}
        className={cn(
          'flex items-center justify-between w-full h-9 px-3 rounded-md border border-input bg-background text-sm',
          'hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
        )}
      >
        <span className="flex items-center gap-2">
          {selected ? (
            <>
              <span>{selected.flag}</span>
              <span className="font-mono font-medium">{selected.code}</span>
              <span className="text-muted-foreground truncate">{selected.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{value || 'Select currency'}</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full min-w-[240px] rounded-md border border-border bg-popover shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search currency..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No results</li>
            ) : (
              filtered.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    tabIndex={0}
                    onMouseDown={() => handleSelect(c.code)}
                    className={cn(
                      'flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors',
                      c.code === value && 'bg-accent'
                    )}
                  >
                    <span>{c.flag}</span>
                    <span className="font-mono font-medium w-10 shrink-0">{c.code}</span>
                    <span className="text-muted-foreground truncate">{c.name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

type SyncStatus = 'idle' | 'loading' | 'success' | 'error'

export default function Settings() {
  const { setSetting, githubPat, gistId, currency, lastSyncAt } = useSettings()
  const [pat, setPat] = useState(githubPat)
  const [gist, setGist] = useState(gistId)
  const [curr, setCurr] = useState(currency)
  const [exportStatus, setExportStatus] = useState<SyncStatus>('idle')
  const [importStatus, setImportStatus] = useState<SyncStatus>('idle')
  const [showExportPreview, setShowExportPreview] = useState(false)
  const [showImportPreview, setShowImportPreview] = useState(false)

  // Sync local state once DB values are loaded (useLiveQuery resolves async)
  useEffect(() => { setPat(githubPat) }, [githubPat])
  useEffect(() => { setGist(gistId) }, [gistId])
  useEffect(() => { setCurr(currency) }, [currency])

  async function handleSaveCredentials() {
    await setSetting('githubPat', pat)
    await setSetting('gistId', gist)
    await setSetting('currency', curr)
    toast.success('Saved', 'Settings updated successfully.')
  }

  async function handleCreateGist() {
    if (!pat) return
    try {
      setExportStatus('loading')
      const newId = await createNewGist(pat)
      setGist(newId)
      await setSetting('gistId', newId)
      await setSetting('githubPat', pat)
      // Immediately export real data — createNewGist only writes a placeholder
      await exportToGist(pat, newId)
      setExportStatus('success')
      toast.success('Gist created & exported', `ID: ${newId}`)
      setTimeout(() => setExportStatus('idle'), 3000)
    } catch (err) {
      setExportStatus('error')
      toast.error('Failed to create Gist', String(err))
    }
  }

  async function handleExport() {
    const activePat = pat || githubPat
    const activeGist = gist || gistId
    if (!activePat || !activeGist) {
      toast.warning('Missing credentials', 'Enter your GitHub PAT and Gist ID first.')
      return
    }
    setShowExportPreview(true)
  }

  async function handleConfirmExport() {
    setShowExportPreview(false)
    const activePat = pat || githubPat
    const activeGist = gist || gistId
    try {
      setExportStatus('loading')
      await exportToGist(activePat, activeGist)
      setExportStatus('success')
      toast.success('Export successful', 'Your data was backed up to GitHub Gist.')
      setTimeout(() => setExportStatus('idle'), 3000)
    } catch (err) {
      setExportStatus('error')
      toast.error('Export failed', String(err))
    }
  }

  async function handleImport(payload: GistSyncPayload) {
    setShowImportPreview(false)
    try {
      setImportStatus('loading')
      await restoreFromPayload(payload)
      setImportStatus('success')
      toast.success('Import successful', 'All data has been restored from your Gist.')
      setTimeout(() => setImportStatus('idle'), 3000)
    } catch (err) {
      setImportStatus('error')
      toast.error('Import failed', String(err))
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto md:p-6">
      <div className="pt-2">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Preferences and data sync</p>
      </div>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4" /> About
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>App</span>
            <span className="font-medium text-foreground">{pkg.name}</span>
          </div>
          <div className="flex justify-between">
            <span>Version</span>
            <span className="font-mono font-medium text-foreground">v{pkg.version}</span>
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SettingsIcon className="h-4 w-4" /> Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Default Currency</Label>
            <CurrencySelect value={curr} onChange={setCurr} />
          </div>
        </CardContent>
      </Card>

      {/* GitHub Gist Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Github className="h-4 w-4" /> GitHub Gist Sync
          </CardTitle>
          <CardDescription>
            Export and import your data via a private GitHub Gist. Your PAT is stored only in IndexedDB — never sent anywhere except GitHub.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>GitHub Personal Access Token</Label>
            <Input
              type="password"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              Needs <code className="bg-secondary px-1 rounded">gist</code> scope only.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Gist ID</Label>
            <div className="flex gap-2">
              <Input
                value={gist}
                onChange={(e) => setGist(e.target.value)}
                placeholder="a1b2c3d4e5f6..."
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={handleCreateGist} disabled={!pat}>
                Create new
              </Button>
            </div>
          </div>

          <Button onClick={handleSaveCredentials} variant="secondary" className="w-full">
            Save credentials
          </Button>

          {lastSyncAt && (
            <p className="text-xs text-muted-foreground text-center">
              Last sync: {formatDate(lastSyncAt)}
            </p>
          )}

          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleExport}
              disabled={exportStatus === 'loading' || (!pat && !githubPat)}
              variant="outline"
              className="flex items-center gap-2"
            >
              {exportStatus === 'loading' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : exportStatus === 'success' ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Export
            </Button>
            <Button
              onClick={() => setShowImportPreview(true)}
              disabled={importStatus === 'loading' || (!pat && !githubPat)}
              variant="outline"
              className="flex items-center gap-2"
            >
              {importStatus === 'loading' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : importStatus === 'success' ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Import
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-red-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-red-400">
            <Trash2 className="h-4 w-4" /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Permanently delete all local data. This cannot be undone.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (confirm('Delete ALL local data? This cannot be undone.')) {
                await Promise.all([
                  db.accounts.clear(),
                  db.transactions.clear(),
                  db.budgets.clear(),
                  db.recurring.clear(),
                  db.settings.clear(),
                ])
                window.location.reload()
              }
            }}
          >
            Clear all data
          </Button>
        </CardContent>
      </Card>


      {/* Export preview dialog */}
      <ExportPreviewDialog
        open={showExportPreview}
        pat={pat || githubPat}
        gistId={gist || gistId}
        onConfirm={handleConfirmExport}
        onCancel={() => setShowExportPreview(false)}
      />

      {/* Import preview dialog */}
      <ImportPreviewDialog
        open={showImportPreview}
        pat={pat || githubPat}
        gistId={gist || gistId}
        onConfirm={handleImport}
        onCancel={() => setShowImportPreview(false)}
      />
    </div>
  )
}

// end of file
