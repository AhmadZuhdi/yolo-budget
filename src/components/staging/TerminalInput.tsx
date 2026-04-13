import { useState, useRef, useEffect, useCallback } from 'react'
import { useStagingStore, parseTerminalInput } from '@/store/stagingStore'
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { cn } from '@/lib/utils'
import { CornerDownLeft, Terminal } from 'lucide-react'

const HINTS = [
  '-50 Coffee #food @Cash',
  '+2000 Salary #income @Bank',
  '>500 @Bank to @Cash #atm',
  '-120 Groceries #food #household @Cash',
]

// ── Token colours ────────────────────────────────────────────────────────────
// prefix   → red / green / blue
// amount   → white
// desc     → zinc-300
// #tag     → violet-400
// @account → amber-400
// fee:n    → zinc-400

interface Token {
  text: string
  color: string
}

function tokenize(value: string): Token[] {
  if (!value) return []

  const tokens: Token[] = []
  let rest = value

  // 1. Leading prefix (-, +, >)
  const prefixMatch = rest.match(/^([-+>])/)
  if (prefixMatch) {
    const p = prefixMatch[1]
    tokens.push({
      text: p,
      color: p === '+' ? '#34d399' : p === '-' ? '#f87171' : '#60a5fa', // emerald / red / blue
    })
    rest = rest.slice(1)
  }

  // 2. Split remaining into space-separated chunks and classify each
  // We need to preserve spaces
  const parts = rest.split(/(\s+)/)
  let descDone = false

  for (const part of parts) {
    if (/^\s+$/.test(part)) {
      tokens.push({ text: part, color: 'inherit' })
      continue
    }
    if (part === '') continue

    if (part.startsWith('#')) {
      tokens.push({ text: part, color: '#a78bfa' }) // violet-400
    } else if (part.startsWith('@')) {
      tokens.push({ text: part, color: '#fbbf24' }) // amber-400
    } else if (/^fee:\S*$/.test(part)) {
      tokens.push({ text: part, color: '#a1a1aa' }) // zinc-400
    } else if (/^to$/.test(part)) {
      // "to" keyword in transfers
      tokens.push({ text: part, color: '#94a3b8' }) // slate-400
    } else if (!descDone && /^\d/.test(part)) {
      // numeric amount (first plain word after prefix)
      tokens.push({ text: part, color: '#f4f4f5' }) // zinc-100
      descDone = true
    } else {
      // description words
      tokens.push({ text: part, color: '#d4d4d8' }) // zinc-300
      descDone = true
    }
  }

  return tokens
}

// ── Active token detection (for autocomplete) ────────────────────────────────
function getActiveToken(value: string, cursorPos: number): { type: '@' | '#' | null; partial: string; tokenStart: number } {
  const before = value.slice(0, cursorPos)
  const match = before.match(/(?:^|\s)([@#])(\S*)$/)
  if (!match) return { type: null, partial: '', tokenStart: -1 }
  const prefix = match[1] as '@' | '#'
  const partial = match[2]
  const tokenStart = before.lastIndexOf(match[0]) + (match[0].startsWith(' ') || match[0].startsWith('\t') ? 1 : 0)
  return { type: prefix, partial, tokenStart }
}

// ── Component ────────────────────────────────────────────────────────────────
export function TerminalInput() {
  const [value, setValue] = useState('')
  const [hint, setHint] = useState(HINTS[0])
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggestionType, setSuggestionType] = useState<'@' | '#' | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [tokenStart, setTokenStart] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const suggestionsRef = useRef<HTMLUListElement>(null)
  const { addToStaging } = useStagingStore()
  const { accounts } = useAccounts()
  const { allTags } = useTransactions()

  // Rotate hints
  useEffect(() => {
    const i = setInterval(() => {
      setHint((prev) => {
        const idx = HINTS.indexOf(prev)
        return HINTS[(idx + 1) % HINTS.length]
      })
    }, 3000)
    return () => clearInterval(i)
  }, [])

  const computeSuggestions = useCallback(
    (val: string, cursor: number) => {
      const { type, partial, tokenStart: ts } = getActiveToken(val, cursor)
      if (!type) {
        setSuggestions([])
        setSuggestionType(null)
        setTokenStart(-1)
        return
      }
      const lower = partial.toLowerCase()
      if (type === '@') {
        const matches = accounts
          .map((a) => a.name)
          .filter((n) => n.toLowerCase().startsWith(lower) && n.toLowerCase() !== lower)
        setSuggestions(matches.slice(0, 6))
      } else {
        const matches = allTags.filter((t) => t.startsWith(lower) && t !== lower)
        setSuggestions(matches.slice(0, 6))
      }
      setSuggestionType(type)
      setTokenStart(ts)
      setActiveIdx(0)
    },
    [accounts, allTags]
  )

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setValue(val)
    setError('')
    computeSuggestions(val, e.target.selectionStart ?? val.length)
  }

  function applySuggestion(suggestion: string) {
    if (!inputRef.current) return
    const cursor = inputRef.current.selectionStart ?? value.length
    const { partial } = getActiveToken(value, cursor)
    const beforeToken = value.slice(0, tokenStart)
    const afterCursor = value.slice(tokenStart + 1 + partial.length)
    const newVal = beforeToken + suggestionType + suggestion + (afterCursor.startsWith(' ') ? '' : ' ') + afterCursor
    setValue(newVal)
    setSuggestions([])
    setSuggestionType(null)
    setTimeout(() => {
      const pos = beforeToken.length + 1 + suggestion.length + 1
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(pos, pos)
    }, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      applySuggestion(suggestions[activeIdx])
    } else if (e.key === 'Escape') {
      setSuggestions([])
    }
  }

  function resolveAccountId(name?: string): number | undefined {
    if (!name) return accounts[0]?.id
    const match = accounts.find((a) => a.name.toLowerCase() === name.toLowerCase())
    return match?.id ?? accounts[0]?.id
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSuggestions([])
    setError('')

    const parsed = parseTerminalInput(value)
    if (!parsed) return
    if (parsed.error) { setError(parsed.error); return }
    if (!parsed.amount || parsed.amount <= 0) { setError('Amount must be > 0'); return }

    const accountId = resolveAccountId(parsed.accountName)
    if (!accountId) { setError('No accounts found. Create one first.'); return }

    if (parsed.type === 'transfer') {
      const toAccountId = resolveAccountId(parsed.toAccountName)
      if (!toAccountId || toAccountId === accountId) {
        setError('Transfer needs two different accounts')
        return
      }
      addToStaging({
        type: 'transfer',
        accountId,
        toAccountId,
        amount: parsed.amount,
        date: new Date().toISOString().split('T')[0],
        description: parsed.description,
        tags: parsed.tags,
        transferFee: parsed.transferFee,
      })
    } else {
      addToStaging({
        type: parsed.type,
        accountId,
        amount: parsed.amount,
        date: new Date().toISOString().split('T')[0],
        description: parsed.description,
        tags: parsed.tags,
      })
    }

    setValue('')
    inputRef.current?.focus()
  }

  const tokens = tokenize(value)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
        <Terminal className="h-3 w-3" />
        <span>Quick entry — type a command and press Enter</span>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">

          {/* ── Actual input — sits below, provides bg + border + caret ── */}
          <input
            ref={inputRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={hint}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className={cn(
              'terminal-input w-full h-10 px-3',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-500/50',
              error ? 'border-red-500/50' : ''
            )}
            style={{ color: 'transparent', caretColor: error ? '#f87171' : '#4ade80' }}
          />

          {/* ── Syntax-highlight mirror — floats on top, pointer-events-none ── */}
          <div
            ref={mirrorRef}
            aria-hidden="true"
            className="absolute inset-0 flex items-center px-3 pointer-events-none select-none overflow-hidden font-mono text-sm whitespace-pre bg-transparent"
          >
            {value === '' ? null : tokens.map((tok, i) => (
              <span key={i} style={{ color: tok.color }}>{tok.text}</span>
            ))}
          </div>

          {/* ── Autocomplete dropdown ── */}
          {suggestions.length > 0 && (
            <ul
              ref={suggestionsRef}
              className="absolute z-50 bottom-full mb-1 left-0 w-full rounded-md border border-border bg-popover shadow-lg overflow-hidden"
            >
              {suggestions.map((s, i) => (
                <li key={s}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      applySuggestion(s)
                    }}
                    className={cn(
                      'flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors',
                      i === activeIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                    )}
                  >
                    <span className={cn('font-mono text-xs', suggestionType === '@' ? 'text-amber-400' : 'text-violet-400')}>
                      {suggestionType}
                    </span>
                    <span>{s}</span>
                    {i === activeIdx && (
                      <span className="ml-auto text-[10px] text-muted-foreground">Tab</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="submit"
          disabled={!value.trim()}
          className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 disabled:opacity-40 transition-colors shrink-0"
          aria-label="Stage transaction"
        >
          <CornerDownLeft className="h-4 w-4" />
        </button>
      </form>

      {error && (
        <p className="text-xs text-red-400 px-1">{error}</p>
      )}

      <div className="text-[10px] text-zinc-600 font-mono px-1 space-y-0.5">
        <p>
          <span className="text-red-400">-</span> expense &nbsp;
          <span className="text-emerald-400">+</span> income &nbsp;
          <span className="text-blue-400">&gt;</span> transfer &nbsp;
          <span className="text-violet-400">#tag</span> &nbsp;
          <span className="text-amber-400">@account</span> &nbsp;
          <span className="text-zinc-400">fee:2.5</span>
        </p>
        <p className="text-zinc-700">Tab to complete &middot; &uarr;&darr; to navigate &middot; Esc to dismiss</p>
      </div>
    </div>
  )
}
