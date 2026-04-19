import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely evaluate a math expression string (digits + +-*\/() only).
 * Returns null if the expression is invalid or the result is not finite.
 * Examples:
 *   "10000+5000"  → 15000
 *   "(-10000-10000)" → -20000
 *   "1500*12"     → 18000
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
 * Clamps the day to the last day of the month (handles Feb, 30-day months).
 */
export function getPaycycleDateRange(paycycleDay: number): { start: string; end: string } {
  function clampDay(year: number, month: number, day: number): Date {
    const lastDay = new Date(year, month + 1, 0).getDate()
    return new Date(year, month, Math.min(day, lastDay))
  }

  function toYMD(d: Date): string {
    return d.toISOString().split('T')[0]
  }

  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()   // 0-indexed
  const today = now.getDate()

  if (today >= paycycleDay) {
    // cycle start: this month's paycycleDay
    // cycle end:   next month's paycycleDay - 1
    const start = clampDay(y, m, paycycleDay)
    const endRaw = clampDay(y, m + 1, paycycleDay)
    const end = new Date(endRaw.getFullYear(), endRaw.getMonth(), endRaw.getDate() - 1)
    return { start: toYMD(start), end: toYMD(end) }
  } else {
    // cycle start: last month's paycycleDay
    // cycle end:   this month's paycycleDay - 1
    const start = clampDay(y, m - 1, paycycleDay)
    const endRaw = clampDay(y, m, paycycleDay)
    const end = new Date(endRaw.getFullYear(), endRaw.getMonth(), endRaw.getDate() - 1)
    return { start: toYMD(start), end: toYMD(end) }
  }
}
