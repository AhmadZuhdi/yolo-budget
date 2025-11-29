import React, { useEffect, useState } from 'react'
import { db, Account, Budget } from '../db/indexeddb'

export default function SettingsPage() {
  const [currency, setCurrency] = useState('USD')
  const [doubleEntry, setDoubleEntry] = useState(true)
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [defaultAccountId, setDefaultAccountId] = useState('')
  const [defaultBudgetId, setDefaultBudgetId] = useState('')

  useEffect(()=>{
    let mounted = true
    Promise.all([
      db.getMeta('currency'),
      db.getMeta('doubleEntry'),
      db.getAll<Account>('accounts'),
      db.getAll<Budget>('budgets'),
      db.getMeta<string>('defaultAccountId'),
      db.getMeta<string>('defaultBudgetId')
    ]).then(([curr, de, accs, buds, defAccId, defBudId]) => {
      if (mounted) {
        setCurrency(curr || 'USD')
        setDoubleEntry(de !== false) // default to true
        setAccounts(accs)
        setBudgets(buds)
        setDefaultAccountId(defAccId || '')
        setDefaultBudgetId(defBudId || '')
        setLoading(false)
      }
    })
    return ()=>{ mounted=false }
  },[])

  async function saveCurrency(){
    await db.setMeta('currency', currency)
    alert('Currency saved')
  }

  async function saveDoubleEntry(){
    await db.setMeta('doubleEntry', doubleEntry)
    alert('Double-entry mode saved. Refresh the page to apply changes.')
  }

  async function saveDefaults(){
    await db.setMeta('defaultAccountId', defaultAccountId)
    await db.setMeta('defaultBudgetId', defaultBudgetId)
    alert('Default settings saved!')
  }

  async function doExport(){
    const dump = await db.exportAll()
    const dataStr = JSON.stringify(dump, null, 2)
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
        
        await db.importAll(parsed, { clearBefore: true })
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

  return (
    <div className="page container">
      <h2 style={{marginBottom: 24, fontSize: '1.75rem', fontWeight: 700}}>Settings</h2>
      {loading ? (
        <div className="card" style={{padding: 40, textAlign: 'center', color: '#6b7280'}}>Loading settings...</div>
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
          <span style={{fontSize: '1.5rem'}}>⚙️</span> Transaction Mode
        </h3>
        <p style={{color: '#6b7280', fontSize: '0.875rem', marginTop: 0, marginBottom: 16}}>
          Double-entry accounting ensures balanced transactions. Simple mode allows quick income/expense tracking without requiring balanced entries.
        </p>
        <label style={{display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 12}}>
          <input 
            type="checkbox" 
            checked={doubleEntry} 
            onChange={(e) => setDoubleEntry(e.target.checked)}
            style={{width: 20, height: 20, cursor: 'pointer'}}
          />
          <span style={{fontWeight: 500}}>Enable Double-Entry Mode</span>
        </label>
        <button onClick={saveDoubleEntry} className="button-primary">💾 Save Transaction Mode</button>
      </div>

      <div className="card" style={{marginBottom: 20}}>
        <h3 style={{marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8}}>
          <span style={{fontSize: '1.5rem'}}>⚡</span> Quick Transaction Defaults
        </h3>
        <p style={{color: '#6b7280', fontSize: '0.875rem', marginTop: 0, marginBottom: 16}}>
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

      <div className="card">
        <h3 style={{marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8}}>
          <span style={{fontSize: '1.5rem'}}>💾</span> Data Management
        </h3>
        <p style={{color: '#6b7280', fontSize: '0.875rem', marginTop: 0, marginBottom: 16}}>
          Export your data as a JSON file for backup or import from a previous backup file.
        </p>
        <div style={{display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap'}}>
          <button onClick={doExport} className="button-success">📤 Export to File</button>
          <button onClick={doImport} className="button-primary">📥 Import from File</button>
          <button onClick={factoryReset} className="button-danger">🗑️ Factory Reset</button>
        </div>
        <div style={{padding: 12, background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, fontSize: '0.875rem'}}>
          <strong>⚠️ Important:</strong> 
          <ul style={{margin: '8px 0', paddingLeft: 20}}>
            <li>Export creates a downloadable backup file</li>
            <li>Import will replace all current data</li>
            <li>Factory Reset permanently deletes everything</li>
          </ul>
        </div>
      </div>
        </>
      )}
    </div>
  )
}
