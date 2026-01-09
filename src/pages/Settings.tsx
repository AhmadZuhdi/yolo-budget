import React, { useEffect, useState } from 'react'
import { db, Account, Budget } from '../db/indexeddb'
import packageJson from '../../package.json'

export default function SettingsPage() {
  const [currency, setCurrency] = useState('USD')
  const [darkMode, setDarkMode] = useState(false)
  const [useBottomNav, setUseBottomNav] = useState(false)
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [defaultAccountId, setDefaultAccountId] = useState('')
  const [defaultBudgetId, setDefaultBudgetId] = useState('')
  const [githubToken, setGithubToken] = useState('')
  const [gistUrl, setGistUrl] = useState('')
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [monthCycleDay, setMonthCycleDay] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  useEffect(()=>{
    let mounted = true
    Promise.all([
      db.getMeta('currency'),
      db.getMeta<boolean>('darkMode'),
      db.getMeta<boolean>('useBottomNav'),
      db.getAll<Account>('accounts'),
      db.getAll<Budget>('budgets'),
      db.getMeta<string>('defaultAccountId'),
      db.getMeta<string>('defaultBudgetId'),
      db.getMeta<string>('githubToken'),
      db.getMeta<number>('monthCycleDay'),
      db.getMeta<string>('gistUrl'),
      db.getMeta<number>('itemsPerPage')
    ]).then(([curr, dark, bottomNav, accs, buds, defAccId, defBudId, ghToken, cycleDay, savedGistUrl, savedItemsPerPage]) => {
      if (mounted) {
        setCurrency(curr || 'USD')
        setDarkMode(dark || false)
        setUseBottomNav(bottomNav || false)
        setAccounts(accs)
        setBudgets(buds)
        setDefaultAccountId(defAccId || '')
        setDefaultBudgetId(defBudId || '')
        setGithubToken(ghToken || '')
        setMonthCycleDay(cycleDay || 1)
        setGistUrl(savedGistUrl || '')
        setItemsPerPage(savedItemsPerPage || 10)
        setLoading(false)
      }
    })
    return ()=>{ mounted=false }
  },[])

  async function saveCurrency(){
    await db.setMeta('currency', currency)
    alert('Currency saved')
  }

  async function saveDefaults(){
    await db.setMeta('defaultAccountId', defaultAccountId)
    await db.setMeta('defaultBudgetId', defaultBudgetId)
    alert('Default settings saved!')
  }

  async function saveDarkMode(){
    await db.setMeta('darkMode', darkMode)
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    alert('Theme saved!')
  }

  async function saveBottomNav(){
    await db.setMeta('useBottomNav', useBottomNav)
    if (useBottomNav) {
      document.body.classList.add('bottom-nav-mode')
    } else {
      document.body.classList.remove('bottom-nav-mode')
    }
    // Dispatch event to notify Nav component
    window.dispatchEvent(new Event('settingsChanged'))
    alert('Navigation style saved!')
  }

  async function saveMonthCycleDay(){
    await db.setMeta('monthCycleDay', monthCycleDay)
    alert('Month cycle day saved!')
  }

  async function savePaginationSettings(){
    await db.setMeta('itemsPerPage', itemsPerPage)
    alert('Pagination settings saved!')
  }

  async function doExport(){
    const dump = await db.exportAll()
    
    // Remove sensitive data from export
    const exportData = { ...dump }
    if (exportData.meta) {
      exportData.meta = exportData.meta.filter((m: any) => m.key !== 'githubToken')
    }
    
    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `yolo-budget-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    alert('Data exported successfully!')
  }

  async function doImport(){
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      
      try {
        const text = await file.text()
        const parsed = JSON.parse(text)
        
        if (!confirm('This will erase all current data and import from the file. Continue?')) {
          return
        }
        
        // Preserve sensitive data before import
        const existingToken = await db.getMeta<string>('githubToken')
        const existingGistUrl = await db.getMeta<string>('gistUrl')
        
        await db.importAll(parsed, { clearBefore: true })
        
        // Restore sensitive data after import
        if (existingToken) {
          await db.setMeta('githubToken', existingToken)
        }
        if (existingGistUrl) {
          await db.setMeta('gistUrl', existingGistUrl)
        }
        
        alert('Import successful! Refreshing page...')
        window.location.reload()
      } catch (e: any) {
        alert('Invalid JSON file: ' + e.message)
      }
    }
    input.click()
  }

  async function factoryReset(){
    if (!confirm('⚠️ WARNING: This will permanently delete ALL data (accounts, budgets, transactions, settings). This cannot be undone! Are you sure?')) {
      return
    }
    
    if (!confirm('Really delete everything? Last chance to cancel!')) {
      return
    }
    
    try {
      await db.importAll({}, { clearBefore: true })
      alert('Factory reset complete. Refreshing page...')
      window.location.reload()
    } catch (e: any) {
      alert('Error during reset: ' + e.message)
    }
  }

  async function savePastebinApiKey(){
    await db.setMeta('githubToken', githubToken)
    alert('GitHub token saved!')
  }

  async function clearGistUrl(){
    if (!confirm('Clear the saved Gist URL? Your next export will create a new Gist.')) {
      return
    }
    await db.setMeta('gistUrl', '')
    setGistUrl('')
    alert('Saved Gist URL cleared!')
  }

  async function saveGistUrl(){
    if (!gistUrl.trim()) {
      alert('Please enter a valid Gist URL or ID')
      return
    }

    // Validate URL format
    let gistId = gistUrl.trim()
    if (gistUrl.includes('gist.github.com/')) {
      const parts = gistUrl.split('/')
      gistId = parts[parts.length - 1]
    }

    // Basic validation - should be a 32-character hex string (GitHub gist ID format)
    if (!/^[a-f0-9]{32}$/.test(gistId) && !gistUrl.includes('gist.github.com/')) {
      alert('Invalid Gist URL or ID format')
      return
    }

    try {
      // Verify the gist exists by fetching it
      const response = await fetch(`https://api.github.com/gists/${gistId}`)
      if (!response.ok) {
        throw new Error('Gist not found')
      }

      const gist = await response.json()
      const gistUrl = gist.html_url

      // Save to database
      await db.setMeta('gistUrl', gistUrl)
      setGistUrl(gistUrl)
      alert('✅ Gist URL saved successfully!')
    } catch (e: any) {
      alert('Error saving Gist URL: ' + e.message)
    }
  }

  async function exportToPastebin(){
    if (!githubToken) {
      alert('Please enter and save your GitHub token first!')
      return
    }

    try {
      setExporting(true)
      const dump = await db.exportAll()
      
      // Remove sensitive data from export
      const exportData = { ...dump }
      if (exportData.meta) {
        exportData.meta = exportData.meta.filter((m: any) => m.key !== 'githubToken')
      }
      
      const dataStr = JSON.stringify(exportData)
      
      // Extract gist ID from saved URL if available
      let gistId = null
      if (gistUrl) {
        if (gistUrl.includes('gist.github.com/')) {
          const parts = gistUrl.split('/')
          gistId = parts[parts.length - 1]
        } else {
          gistId = gistUrl
        }
      }

      const method = gistId ? 'PATCH' : 'POST'
      const endpoint = gistId ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists'
      
      const response = await fetch(endpoint, {
        method: method,
        headers: {
          'Authorization': `token ${githubToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: `Yolo Budget Backup - ${new Date().toISOString().slice(0, 10)}`,
          public: false,
          files: {
            'yolo-budget-backup.json': {
              content: dataStr
            }
          }
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to export gist')
      }

      const result = await response.json()
      const newGistUrl = result.html_url
      
      // Save the gist URL to database
      await db.setMeta('gistUrl', newGistUrl)
      setGistUrl(newGistUrl)
      
      const action = gistId ? 'updated' : 'created'
      alert(`✅ Data ${action} on GitHub Gist!\n\nURL: ${newGistUrl}`)
    } catch (e: any) {
      alert('Export error: ' + e.message)
    } finally {
      setExporting(false)
    }
  }

  async function importFromPastebin(){
    if (!gistUrl) {
      alert('Please enter a GitHub Gist URL!')
      return
    }

    try {
      setImporting(true)
      
      // Extract gist ID from URL
      let gistId = gistUrl
      if (gistUrl.includes('gist.github.com/')) {
        const parts = gistUrl.split('/')
        gistId = parts[parts.length - 1]
      }

      // Fetch gist data
      const response = await fetch(`https://api.github.com/gists/${gistId}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch gist: ${response.statusText}`)
      }

      const gist = await response.json()
      
      // Get the first file's content
      const files = Object.values(gist.files) as any[]
      if (!files.length) {
        throw new Error('No files found in gist')
      }

      const content = files[0].content
      const parsed = JSON.parse(content)
      
      if (!confirm('This will erase all current data and import from GitHub Gist. Continue?')) {
        return
      }
      
      // Preserve sensitive data before import
      const existingToken = await db.getMeta<string>('githubToken')
      const existingGistUrl = await db.getMeta<string>('gistUrl')
      
      await db.importAll(parsed, { clearBefore: true })
      
      // Restore sensitive data after import
      if (existingToken) {
        await db.setMeta('githubToken', existingToken)
      }
      if (existingGistUrl) {
        await db.setMeta('gistUrl', existingGistUrl)
      }
      
      alert('Import successful! Refreshing page...')
      window.location.reload()
    } catch (e: any) {
      alert('Import error: ' + e.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="page container">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24}}>
        <h2 style={{fontSize: '1.75rem', fontWeight: 700, margin: 0}}>Settings</h2>
        <span style={{fontSize: '0.875rem', color: 'var(--text-secondary)', padding: '4px 12px', background: 'var(--accent-light)', borderRadius: 16}}>
          v{packageJson.version}{import.meta.env.PROD ? `-${__BUILD_TIME__}` : '-dev'}
        </span>
      </div>
      {loading ? (
        <div className="card" style={{padding: 40, textAlign: 'center', color: 'var(--text-secondary)'}}>Loading settings...</div>
      ) : (
        <>
      <div className="card" style={{marginBottom: 20}}>
        <h3 style={{marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8}}>
          <span style={{fontSize: '1.5rem'}}>💱</span> Currency Settings
        </h3>
        <label style={{marginBottom: 8}}>Preferred Currency</label>
        <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
          <select value={currency} onChange={(e)=>setCurrency(e.target.value)} style={{flex: 1}}>
            <option value="USD">💵 USD - US Dollar</option>
            <option value="IDR">🇮🇩 IDR - Indonesian Rupiah</option>
          </select>
          <button onClick={saveCurrency} style={{whiteSpace: 'nowrap'}}>Save Currency</button>
        </div>
      </div>

      <div className="card" style={{marginBottom: 20}}>
        <h3 style={{marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8}}>
          <span style={{fontSize: '1.5rem'}}>📅</span> Month Cycle Day
        </h3>
        <p style={{color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 0, marginBottom: 16}}>
          Set which day of the month your monthly cycle starts. For example, if your salary/bills are on the 25th, set it to 25. This affects the "Month" filter in Reports.
        </p>
        <label style={{marginBottom: 8}}>Month starts on day</label>
        <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
          <input 
            type="number" 
            min="1" 
            max="31" 
            value={monthCycleDay} 
            onChange={(e) => setMonthCycleDay(parseInt(e.target.value) || 1)}
            style={{flex: 1}}
          />
          <button onClick={saveMonthCycleDay} style={{whiteSpace: 'nowrap'}}>Save Cycle Day</button>
        </div>
        <small style={{color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: 8, display: 'block'}}>
          Example: Day 25 means from last month 25th to this month 25th
        </small>
      </div>

      <div className="card" style={{marginBottom: 20}}>
        <h3 style={{marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8}}>
          <span style={{fontSize: '1.5rem'}}>📄</span> Pagination Settings
        </h3>
        <p style={{color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 0, marginBottom: 16}}>
          Configure how many items per page to show in the Transactions list.
        </p>
        <label style={{marginBottom: 8}}>Items per page</label>
        <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
          <select 
            value={itemsPerPage} 
            onChange={(e) => setItemsPerPage(parseInt(e.target.value))}
            style={{flex: 1}}
          >
            <option value="5">5 items</option>
            <option value="10">10 items</option>
            <option value="15">15 items</option>
            <option value="20">20 items</option>
            <option value="25">25 items</option>
            <option value="50">50 items</option>
          </select>
          <button onClick={savePaginationSettings} style={{whiteSpace: 'nowrap'}}>Save Pagination</button>
        </div>
        <small style={{color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: 8, display: 'block'}}>
          The current page and items per page will be automatically remembered when you navigate away.
        </small>
      </div>

      <div className="card" style={{marginBottom: 20}}>
        <h3 style={{marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8}}>
          <span style={{fontSize: '1.5rem'}}>🌓</span> Appearance
        </h3>
        <p style={{color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 0, marginBottom: 16}}>
          Choose between light and dark theme for the interface.
        </p>
        <label style={{display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 12}}>
          <input 
            type="checkbox" 
            checked={darkMode} 
            onChange={(e) => setDarkMode(e.target.checked)}
            style={{width: 20, height: 20, cursor: 'pointer'}}
          />
          <span style={{fontWeight: 500, color: 'var(--text)'}}>Enable Dark Mode</span>
        </label>
        <button onClick={saveDarkMode} className="button-primary">💾 Save Theme</button>
      </div>

      <div className="card" style={{marginBottom: 20}}>
        <h3 style={{marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8}}>
          <span style={{fontSize: '1.5rem'}}>🧭</span> Navigation Style
        </h3>
        <p style={{color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 0, marginBottom: 16}}>
          Choose between side menu (hamburger) or bottom navigation bar.
        </p>
        <label style={{display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 12}}>
          <input 
            type="checkbox" 
            checked={useBottomNav} 
            onChange={(e) => setUseBottomNav(e.target.checked)}
            style={{width: 20, height: 20, cursor: 'pointer'}}
          />
          <span style={{fontWeight: 500, color: 'var(--text)'}}>Use Bottom Navigation</span>
        </label>
        <button onClick={saveBottomNav} className="button-primary">💾 Save Navigation Style</button>
      </div>

      <div className="card" style={{marginBottom: 20}}>
        <h3 style={{marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8}}>
          <span style={{fontSize: '1.5rem'}}>⚡</span> Quick Transaction Defaults
        </h3>
        <p style={{color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 0, marginBottom: 16}}>
          Set default account and budget to pre-fill when creating new transactions.
        </p>
        <div style={{marginBottom: 16}}>
          <label style={{marginBottom: 8}}>Default Account</label>
          <select 
            value={defaultAccountId} 
            onChange={(e) => setDefaultAccountId(e.target.value)}
            style={{width: '100%'}}
          >
            <option value="">-- None --</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        </div>
        <div style={{marginBottom: 16}}>
          <label style={{marginBottom: 8}}>Default Budget</label>
          <select 
            value={defaultBudgetId} 
            onChange={(e) => setDefaultBudgetId(e.target.value)}
            style={{width: '100%'}}
          >
            <option value="">-- None --</option>
            {budgets.map(bud => (
              <option key={bud.id} value={bud.id}>{bud.name}</option>
            ))}
          </select>
        </div>
        <button onClick={saveDefaults} className="button-primary">💾 Save Defaults</button>
      </div>

      <div className="card" style={{marginBottom: 20}}>
        <h3 style={{marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8}}>
          <span style={{fontSize: '1.5rem'}}>💾</span> Data Management
        </h3>
        <p style={{color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 0, marginBottom: 16}}>
          Export your data as a JSON file for backup or import from a previous backup file.
        </p>
        <div style={{display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap'}}>
          <button onClick={doExport} className="button-success">📤 Export to File</button>
          <button onClick={doImport} className="button-primary">📥 Import from File</button>
          <button onClick={factoryReset} className="button-danger">🗑️ Factory Reset</button>
        </div>
        <div style={{padding: 12, background: 'var(--accent-light)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.875rem', color: 'var(--text)'}}>
          <strong>⚠️ Important:</strong> 
          <ul style={{margin: '8px 0', paddingLeft: 20}}>
            <li>Export creates a downloadable backup file</li>
            <li>Import will replace all current data</li>
            <li>Factory Reset permanently deletes everything</li>
          </ul>
        </div>
      </div>

      <div className="card">
        <h3 style={{marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8}}>
          <span style={{fontSize: '1.5rem'}}>📋</span> GitHub Gist Backup
        </h3>
        <p style={{color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 0, marginBottom: 16}}>
          Export/import your data using GitHub Gist. Create a Personal Access Token at <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" style={{color: '#0ea5a4'}}>github.com/settings/tokens</a> with <strong>gist</strong> scope.
        </p>
        
        <div style={{marginBottom: 20}}>
          <label style={{marginBottom: 8}}>GitHub Personal Access Token</label>
          <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
            <input 
              type="password"
              value={githubToken} 
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              style={{flex: 1}}
            />
            <button onClick={savePastebinApiKey} style={{whiteSpace: 'nowrap'}}>💾 Save Token</button>
          </div>
          <small style={{color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: 4, display: 'block'}}>
            Token needs 'gist' permission only
          </small>
        </div>

        <div style={{marginBottom: 20, paddingTop: 20, borderTop: '1px solid var(--border)'}}>
          <h4 style={{marginTop: 0, marginBottom: 12, fontSize: '1rem'}}>Save Gist URL</h4>
          <p style={{color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 0, marginBottom: 12}}>
            Save a GitHub Gist URL to use for future exports and imports. This allows you to restore from a previous backup or share across devices.
          </p>
          <div style={{marginBottom: 12}}>
            <label style={{marginBottom: 8}}>Gist URL or ID</label>
            <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
              <input 
                type="text"
                value={gistUrl} 
                onChange={(e) => setGistUrl(e.target.value)}
                placeholder="https://gist.github.com/username/abcd1234... or ID"
                style={{flex: 1}}
              />
              <button 
                onClick={saveGistUrl}
                style={{
                  padding: '8px 16px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  whiteSpace: 'nowrap'
                }}
              >
                💾 Save URL
              </button>
            </div>
          </div>
          {gistUrl && (
            <div style={{padding: 12, background: '#d1fae5', border: '1px solid #10b981', borderRadius: 8, fontSize: '0.875rem'}}>
              <strong>✅ Saved URL:</strong>
              <p style={{marginTop: 8, marginBottom: 8, wordBreak: 'break-all'}}>
                <a href={gistUrl} target="_blank" rel="noopener noreferrer" style={{color: '#059669'}}>
                  {gistUrl}
                </a>
              </p>
            </div>
          )}
        </div>

        <div style={{marginBottom: 20, paddingTop: 20, borderTop: '1px solid var(--border)'}}>
          <h4 style={{marginTop: 0, marginBottom: 12, fontSize: '1rem'}}>Export to GitHub Gist</h4>
          <p style={{color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 0, marginBottom: 12}}>
            {gistUrl ? 'Click to update the saved Gist with your latest data.' : 'Click to create a new Gist with your data.'}
          </p>
          <div style={{marginBottom: 12}}>
            <button 
              onClick={exportToPastebin} 
              disabled={exporting || !githubToken}
              style={{
                background: exporting ? '#9ca3af' : '#10b981',
                cursor: exporting || !githubToken ? 'not-allowed' : 'pointer',
                opacity: exporting || !githubToken ? 0.6 : 1
              }}
            >
              {exporting ? '⏳ Exporting...' : gistUrl ? '📤 Update GitHub Gist' : '📤 Export to GitHub Gist'}
            </button>
          </div>
          {gistUrl && (
            <div style={{marginTop: 12, padding: 12, background: '#d1fae5', border: '1px solid #10b981', borderRadius: 8, fontSize: '0.875rem'}}>
              <small style={{color: '#047857', display: 'block', marginBottom: 8}}>
                📌 Using saved Gist: Exports will update this Gist automatically
              </small>
              <button 
                onClick={clearGistUrl}
                style={{
                  padding: '4px 12px',
                  fontSize: '0.75rem',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: '#374151'
                }}
              >
                🔄 Use Different Gist
              </button>
            </div>
          )}
        </div>

        <div style={{paddingTop: 20, borderTop: '1px solid var(--border)'}}>
          <h4 style={{marginTop: 0, marginBottom: 12, fontSize: '1rem'}}>Import from GitHub Gist</h4>
          <div style={{marginBottom: 12}}>
            <label style={{marginBottom: 8}}>GitHub Gist URL or ID</label>
            <input 
              type="text"
              value={gistUrl} 
              onChange={(e) => setGistUrl(e.target.value)}
              placeholder="https://gist.github.com/username/..."
              style={{width: '100%'}}
            />
          </div>
          <button 
            onClick={importFromPastebin}
            disabled={importing || !gistUrl}
            style={{
              background: importing ? '#9ca3af' : '#3b82f6',
              cursor: importing || !gistUrl ? 'not-allowed' : 'pointer',
              opacity: importing || !gistUrl ? 0.6 : 1
            }}
          >
            {importing ? '⏳ Importing...' : '📥 Import from GitHub Gist'}
          </button>
        </div>

        <div style={{marginTop: 16, padding: 12, background: 'var(--accent-light)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.875rem', color: 'var(--text)'}}>
          <strong>ℹ️ GitHub Gist Benefits:</strong>
          <ul style={{margin: '8px 0', paddingLeft: 20}}>
            <li>Private gists (not publicly searchable)</li>
            <li>No expiration - saved forever</li>
            <li>Version history included</li>
            <li>Fast and reliable GitHub infrastructure</li>
          </ul>
        </div>
      </div>
        </>
      )}
    </div>
  )
}
