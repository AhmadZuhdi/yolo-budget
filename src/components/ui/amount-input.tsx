import { useState, useRef } from 'react'
import { cn, evalAmount } from '@/lib/utils'

interface AmountInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  id?: string
  prefix?: string
}

/**
 * Text input that accepts math expressions (e.g. "10000+5000", "(-500-200)").
 * On blur: evaluates the expression and replaces the input value with the result.
 * Shows a green tinted preview while typing a valid expression.
 */
export function AmountInput({
  value,
  onChange,
  placeholder = '0.00',
  className,
  autoFocus,
  id,
  prefix,
}: AmountInputProps) {
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Is the current value a plain number (no operators beyond leading minus)?
  const isExpression = /[+\-*/()]/.test(value.replace(/^-/, ''))
  const evaluated = isExpression ? evalAmount(value) : null
  const isInvalid = isExpression && evaluated === null

  function handleBlur() {
    setFocused(false)
    if (isExpression && evaluated !== null) {
      onChange(String(evaluated))
    }
  }

  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm',
          'transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          prefix && 'pl-7',
          focused && isExpression && !isInvalid && 'border-emerald-500/60 ring-1 ring-emerald-500/30',
          focused && isInvalid && 'border-red-500/60 ring-1 ring-red-500/30',
          className
        )}
      />
      {focused && isExpression && evaluated !== null && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-400 pointer-events-none font-mono">
          = {evaluated}
        </span>
      )}
    </div>
  )
}
