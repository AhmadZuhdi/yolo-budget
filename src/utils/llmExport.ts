import { db } from '@/db/db'
import type { Account, Transaction } from '@/db/types'
import { getPaycycleDateRange, dateToYMD } from '@/lib/utils'

// ─── LLM-friendly export ──────────────────────────────────────────────────────
// Produces a structured Markdown document that can be pasted directly into any
// LLM chat (ChatGPT, Claude, Gemini, etc.) for analysis.
//
// What's included:
//   - Summary snapshot (net worth, # transactions, date range)
//   - Account balances
//   - Monthly income / expense / net (last 6 months)
//   - Expenses grouped by tag (all-time)
//   - Full committed transaction ledger (chronological)
//   - Budget status
//
// What's excluded:
//   - Settings (PAT, Gist ID)
//   - Staged (uncommitted) transactions
//   - Recurring templates (not actionable for analysis)

function computeBalance(account: Account, txs: Transaction[]): number {
  let bal = account.initialBalance
  for (const tx of txs) {
    if (!tx.isCommitted) continue
    if (tx.type === 'income'  && tx.accountId === account.id) bal += tx.amount
    if (tx.type === 'expense' && tx.accountId === account.id) bal -= tx.amount
    if (tx.type === 'transfer') {
      if (tx.accountId   === account.id) bal -= tx.amount + (tx.transferFee ?? 0)
      if (tx.toAccountId === account.id) bal += tx.amount
    }
  }
  return bal
}

function fmt(n: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n)
}

function monthKey(date: string): string {
  return date.slice(0, 7) // YYYY-MM
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

export async function buildLLMExport(): Promise<string> {
  const [accounts, allTransactions, budgets, currencySetting] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.toArray(),
    db.budgets.toArray(),
    db.settings.get('currency'),
  ])

  const currency = currencySetting?.value ?? 'USD'
  const txs = allTransactions.filter((t) => t.isCommitted)
  const now = new Date().toISOString()

  // ── Net worth ──────────────────────────────────────────────────────────────
  const balances = accounts.map((a) => ({ account: a, balance: computeBalance(a, txs) }))
  const netWorth = balances.reduce((s, b) => s + b.balance, 0)

  // ── Date range ─────────────────────────────────────────────────────────────
  const dates = txs.map((t) => t.date).sort()
  const firstDate = dates[0] ?? 'N/A'
  const lastDate  = dates[dates.length - 1] ?? 'N/A'

  // ── Monthly flow (last 6 months) ───────────────────────────────────────────
  const allMonths = Array.from(new Set(txs.map((t) => monthKey(t.date)))).sort()
  const last6 = allMonths.slice(-6)
  const monthly = last6.map((m) => {
    const mtxs = txs.filter((t) => monthKey(t.date) === m)
    const income  = mtxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = mtxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { month: m, income, expense, net: income - expense }
  })

  // ── Tag totals (expenses only) ─────────────────────────────────────────────
  const tagMap = new Map<string, number>()
  for (const tx of txs.filter((t) => t.type === 'expense')) {
    const tags = tx.tags.length > 0 ? tx.tags : ['(untagged)']
    for (const tag of tags) {
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + tx.amount)
    }
  }
  const tagRows = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1])

  // ── Budget status ──────────────────────────────────────────────────────────
  const paycycleSetting = await db.settings.get('paycycleDay')
  const paycycleDay = paycycleSetting ? parseInt(paycycleSetting.value, 10) : 1

  const budgetRows = budgets.map((b) => {
    const now2 = new Date()
    let startStr: string, endStr: string
    if (b.period === 'monthly') {
      const range = getPaycycleDateRange(paycycleDay)
      startStr = range.start
      endStr   = range.end
    } else if (b.period === 'weekly') {
      const day = now2.getDay()
      const start = new Date(now2); start.setDate(now2.getDate() - day)
      const end   = new Date(start); end.setDate(start.getDate() + 6)
      startStr = dateToYMD(start)
      endStr   = dateToYMD(end)
    } else {
      startStr = dateToYMD(new Date(now2.getFullYear(), 0, 1))
      endStr   = dateToYMD(new Date(now2.getFullYear(), 11, 31))
    }
    const spent = txs
      .filter((t) => t.type === 'expense' && t.date >= startStr && t.date <= endStr
        && b.targetTags.some((tag) => t.tags.includes(tag)))
      .reduce((s, t) => s + t.amount, 0)
    const pct = b.limitAmount > 0 ? Math.round((spent / b.limitAmount) * 100) : 0
    return { name: b.name, period: b.period, spent, limit: b.limitAmount, pct, tags: b.targetTags }
  })

  // ── Build Markdown ─────────────────────────────────────────────────────────
  const lines: string[] = []

  lines.push(`# Yolo Expense Tracker — Financial Export`)
  lines.push(``)
  lines.push(`> Generated: ${now}`)
  lines.push(`> Currency: ${currency}`)
  lines.push(`> Transaction range: ${firstDate} → ${lastDate}`)
  lines.push(`> Total committed transactions: ${txs.length}`)
  lines.push(``)

  // Summary
  lines.push(`## Summary`)
  lines.push(``)
  lines.push(`| Metric | Value |`)
  lines.push(`|--------|-------|`)
  lines.push(`| Net Worth | ${fmt(netWorth, currency)} |`)
  lines.push(`| Total Income | ${fmt(txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0), currency)} |`)
  lines.push(`| Total Expenses | ${fmt(txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0), currency)} |`)
  lines.push(`| Accounts | ${accounts.length} |`)
  lines.push(`| Budgets | ${budgets.length} |`)
  lines.push(``)

  // Accounts
  lines.push(`## Account Balances`)
  lines.push(``)
  lines.push(`| Account | Type | Balance |`)
  lines.push(`|---------|------|---------|`)
  for (const { account, balance } of balances) {
    lines.push(`| ${account.name} | ${account.type} | ${fmt(balance, currency)} |`)
  }
  lines.push(``)

  // Monthly flow
  if (monthly.length > 0) {
    lines.push(`## Monthly Cash Flow (last ${monthly.length} months)`)
    lines.push(``)
    lines.push(`| Month | Income | Expenses | Net |`)
    lines.push(`|-------|--------|----------|-----|`)
    for (const m of monthly) {
      lines.push(`| ${monthLabel(m.month)} | ${fmt(m.income, currency)} | ${fmt(m.expense, currency)} | ${fmt(m.net, currency)} |`)
    }
    lines.push(``)
  }

  // Tag totals
  if (tagRows.length > 0) {
    lines.push(`## Expenses by Tag (all-time)`)
    lines.push(``)
    lines.push(`| Tag | Total Spent |`)
    lines.push(`|-----|------------|`)
    for (const [tag, total] of tagRows) {
      lines.push(`| #${tag} | ${fmt(total, currency)} |`)
    }
    lines.push(``)
  }

  // Budget status
  if (budgetRows.length > 0) {
    lines.push(`## Budget Status (current period)`)
    lines.push(``)
    lines.push(`| Budget | Period | Tags | Spent | Limit | % Used |`)
    lines.push(`|--------|--------|------|-------|-------|--------|`)
    for (const b of budgetRows) {
      lines.push(`| ${b.name} | ${b.period} | ${b.tags.map(t=>`#${t}`).join(', ')} | ${fmt(b.spent, currency)} | ${fmt(b.limit, currency)} | ${b.pct}% |`)
    }
    lines.push(``)
  }

  // Full ledger
  lines.push(`## Full Transaction Ledger`)
  lines.push(``)
  lines.push(`| Date | Type | Description | Tags | Amount | Account |`)
  lines.push(`|------|------|-------------|------|--------|---------|`)
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date))
  const accountMap = new Map(accounts.map((a) => [a.id!, a.name]))
  for (const tx of sorted) {
    const sign = tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '→'
    const tags = tx.tags.length > 0 ? tx.tags.map(t=>`#${t}`).join(' ') : '—'
    const acct = accountMap.get(tx.accountId) ?? String(tx.accountId)
    const dest = tx.toAccountId ? ` → ${accountMap.get(tx.toAccountId) ?? tx.toAccountId}` : ''
    lines.push(`| ${tx.date} | ${tx.type} | ${tx.description} | ${tags} | ${sign}${fmt(tx.amount, currency)} | ${acct}${dest} |`)
  }
  lines.push(``)
  lines.push(`---`)
  lines.push(`*End of export. Paste this into your LLM and ask any question about your finances.*`)

  return lines.join('\n')
}
