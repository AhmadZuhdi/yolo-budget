import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Returns today's date as YYYY-MM-DD in local time (avoids UTC offset shift)
export function todayYMD(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Converts any Date to YYYY-MM-DD in local time
export function dateToYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Safely evaluate a math expression string
 *   "50"          → 50
 */
export function evalAmount(expr: string): number | null {
  const cleaned = expr.replace(/\s/g, '')
  if (!cleaned) return null
  // Whitelist: digits, decimal point, operators, parentheses
  if (!/^[\d.+\-*/()]+$/.test(cleaned)) return null
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${cleaned})`)() as unknown
    if (typeof result !== 'number' || !isFinite(result)) return null
    return Math.round(result * 100) / 100  // round to 2dp
  } catch {
    return null
  }
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function getCurrencySymbol(currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .formatToParts(0)
    .find((p) => p.type === 'currency')?.value ?? currency
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(d)
}

/**
 * Returns the current pay-cycle date range based on a monthly payday.
 *
 * If today >= paycycleDay:  start = this month's paycycleDay,  end = next month's paycycleDay - 1
 * If today <  paycycleDay:  start = last month's paycycleDay,  end = this month's paycycleDay - 1
 *
 * No day-clamping — JS Date handles month overflow naturally.
 */
export function getPaycycleDateRange(paycycleDay: number): { start: string; end: string } {
  function toYMD(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()   // 0-indexed
  const today = now.getDate()

  if (today >= paycycleDay) {
    const start = new Date(y, m, paycycleDay)
    const end   = new Date(y, m + 1, paycycleDay - 1)
    return { start: toYMD(start), end: toYMD(end) }
  } else {
    const start = new Date(y, m - 1, paycycleDay)
    const end   = new Date(y, m, paycycleDay - 1)
    return { start: toYMD(start), end: toYMD(end) }
  }
}
