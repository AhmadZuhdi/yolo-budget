// Currency formatting utility
let cachedCurrency = 'USD'
let cachedFormatter: Intl.NumberFormat | null = null

export function getCurrencyFormatter(currency?: string): Intl.NumberFormat {
  const curr = currency || cachedCurrency
  
  if (!cachedFormatter || cachedCurrency !== curr) {
    cachedCurrency = curr
    cachedFormatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }
  
  return cachedFormatter
}

export function formatCurrency(amount: number, currency?: string): string {
  return getCurrencyFormatter(currency).format(amount)
}

export function setCurrency(currency: string) {
  cachedCurrency = currency
  cachedFormatter = null
}
