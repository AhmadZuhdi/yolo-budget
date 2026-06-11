import { useState, useRef, useEffect, useCallback } from 'react'
import { useStagingStore, parseTerminalInput } from '@/store/stagingStore'
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { cn, todayYMD } from '@/lib/utils'
import { CornerDownLeft, Terminal, CalendarDays } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { InlineCalendar } from './InlineCalendar'

const HINTS = [
  '-50 Coffee #food @Cash',
  '+2000 Salary #income @Bank',
  '>500 @Bank to @Cash #atm',
  '-120 Groceries #food #household @Cash',
  '-80 Dinner #food @Cash d:yesterday',
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
    } else if (/^d:\S*$/.test(part)) {
      tokens.push({ text: part, color: '#38bdf8' }) // sky-400
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
type TokenType = '@' | '#' | 'd:' | null
function getActiveToken(value: string, cursorPos: number): { type: TokenType; partial: string; tokenStart: number } {
  const before = value.slice(0, cursorPos)
  const dMatch = before.match(/(?:^|\s)(d:)(\S*)$/)
  if (dMatch) {
    const tokenStart = before.lastIndexOf(dMatch[0]) + (dMatch[0].startsWith(' ') || dMatch[0].startsWith('\t') ? 1 : 0)
    return { type: 'd:', partial: dMatch[2], tokenStart }
  }
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
  const [suggestionType, setSuggestionType] = useState<TokenType>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [tokenStart, setTokenStart] = useState(-1)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const suggestionsRef = useRef<HTMLUListElement>(null)
  const { addToStaging } = useStagingStore()
  const { accounts } = useAccounts()
  const { allTags } = useTransactions()

  // Terminal-local pinned account (not global). Persist to localStorage under key 'terminalPinnedAccountId'
  const STORAGE_KEY = 'terminalPinnedAccountId'
  const [pinnedAccountId, setPinnedAccountId] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? parseInt(raw, 10) : null
    } catch (e) {
      return null
    }
  })
  const [pinMenuOpen, setPinMenuOpen] = useState(false)

  useEffect(() => {
    try {
      if (pinnedAccountId === null) localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, String(pinnedAccountId))
    } catch (e) {
      // ignore
    }
  }, [pinnedAccountId])

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

  const DATE_PRESETS = [
    'today', 'yesterday',
    ...Array.from({ length: 30 }, (_, i) => `-${i + 1}`),
  ]

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
        setSuggestionType(type)
      } else if (type === '#') {
        const matches = allTags.filter((t) => t.startsWith(lower) && t !== lower)
        setSuggestions(matches.slice(0, 6))
        setSuggestionType(type)
      } else if (type === 'd:') {
        const matches = DATE_PRESETS.filter((p) => p.startsWith(lower) && p !== lower)
        setSuggestions(matches)
      }
      setSuggestionType(type)
      setTokenStart(ts)
      setActiveIdx(0)
    },
    [accounts, allTags]
  )

  function autoGrow() {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setValue(val)
    setError('')
    computeSuggestions(val, e.target.selectionStart ?? val.length)
    autoGrow()
  }

  function applySuggestion(suggestion: string) {
    if (!inputRef.current || !suggestionType) return
    const cursor = inputRef.current.selectionStart ?? value.length
    const { partial } = getActiveToken(value, cursor)
    const prefixLen = suggestionType.length
    const beforeToken = value.slice(0, tokenStart)
    const afterCursor = value.slice(tokenStart + prefixLen + partial.length)
    const newVal = beforeToken + suggestionType + suggestion + (afterCursor.startsWith(' ') ? '' : ' ') + afterCursor
    setValue(newVal)
    setSuggestions([])
    setSuggestionType(null)
    setTimeout(() => {
      const pos = beforeToken.length + prefixLen + suggestion.length + 1
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(pos, pos)
    }, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (suggestions.length > 0) {
        applySuggestion(suggestions[activeIdx])
        return
      }
      handleSubmit(e as unknown as React.FormEvent)
      return
    }
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

  function handleDateSelect(ymd: string) {
    if (!inputRef.current) return
    const cursor = inputRef.current.selectionStart ?? value.length
    const { partial } = getActiveToken(value, cursor)
    const prefixLen = 2 // 'd:'
    const beforeToken = value.slice(0, tokenStart)
    const afterCursor = value.slice(tokenStart + prefixLen + partial.length)
    const newVal = beforeToken + 'd:' + ymd + (afterCursor.startsWith(' ') ? '' : ' ') + afterCursor
    setValue(newVal)
    setSuggestions([])
    setSuggestionType(null)
    setTimeout(() => {
      const pos = beforeToken.length + prefixLen + ymd.length + 1
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(pos, pos)
    }, 0)
  }

  function resolveAccountId(name?: string, allowFallback = true): number | undefined {
    if (!name) return allowFallback ? accounts[0]?.id : undefined
    const lower = name.toLowerCase()
    const exact = accounts.find((a) => a.name.toLowerCase() === lower)
    if (exact) return exact.id
    const prefix = accounts.find((a) => a.name.toLowerCase().startsWith(lower + ' '))
    if (prefix) return prefix.id
    return allowFallback ? accounts[0]?.id : undefined
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSuggestions([])
    setError('')

    const parsed = parseTerminalInput(value)
    if (!parsed) return
    if (parsed.error) { setError(parsed.error); return }
    if (!parsed.amount || parsed.amount <= 0) { setError('Amount must be > 0'); return }

    // Determine accountId, preferring pinnedAccountId when appropriate
    let accountId: number | undefined
    // If parsed specifies an account name, resolve it normally
    if (parsed.accountName) {
      accountId = resolveAccountId(parsed.accountName)
    } else if (pinnedAccountId) {
      // Use pinned account if present and exists
      const pinned = accounts.find((a) => a.id === pinnedAccountId)
      if (pinned) {
        accountId = pinned.id
      } else {
        // pinnedAccountId set but account missing — clear local pin
        setPinnedAccountId(null)
      }
    }

    // Fallback to first account if still undefined
    if (!accountId) accountId = resolveAccountId(parsed.accountName)
    if (!accountId) { setError('No accounts found. Create one first.'); return }

    const today = todayYMD()

    if (parsed.type === 'transfer') {
      // For transfers, use pinned account as source when no source provided.
      let fromAccountId = accountId
      // Destination must be explicit — do not allow fallback
      const toAccountId = resolveAccountId(parsed.toAccountName, false)
      if (!toAccountId) {
        setError('Transfer requires an explicit destination account (use @Account)')
        return
      }
      if (toAccountId === fromAccountId) {
        setError('Transfer needs two different accounts')
        return
      }
      addToStaging({
        type: 'transfer',
        accountId: fromAccountId,
        toAccountId,
        amount: parsed.amount,
        date: parsed.date ?? today,
        description: parsed.description,
        tags: parsed.tags,
        transferFee: parsed.transferFee,
      })
    } else {
      addToStaging({
        type: parsed.type,
        accountId,
        amount: parsed.amount,
        date: parsed.date ?? today,
        description: parsed.description,
        tags: parsed.tags,
      })
    }

    setValue('')
    if (inputRef.current) { inputRef.current.style.height = 'auto' }
    inputRef.current?.focus()
  }

  const tokens = tokenize(value)

  const pinnedAccount = pinnedAccountId ? accounts.find((a) => a.id === pinnedAccountId) : null

  return (
    <div className="space-y-2 relative">
      <div className="px-1">
        <div className="flex items-center gap-2">
          <Terminal className="h-3 w-3" />
          <span className="text-xs text-muted-foreground">Quick entry — type a command and press Enter</span>
          <div className="ml-auto">
            <div className="relative inline-block">
              <button
                type="button"
                onClick={() => setPinMenuOpen((v) => !v)}
                className="text-xs px-2 py-1 rounded-full bg-zinc-800/60 hover:bg-zinc-800/80"
                aria-label="Choose default account for terminal input"
              >
                {pinnedAccount ? `Default: ${pinnedAccount.name}` : 'Default: (none)'}
                <span className="ml-2 text-muted-foreground">▾</span>
              </button>
              {pinMenuOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded-md bg-popover border border-border shadow-lg z-50">
                  <div className="p-2">
                    <button
                      type="button"
                      onClick={() => { setPinnedAccountId(null); setPinMenuOpen(false) }}
                      className="block w-full text-left px-2 py-1 text-sm text-muted-foreground hover:bg-accent/10 rounded"
                    >
                      Unset default
                    </button>
                    <div className="border-t my-1" />
                    {accounts.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => { setPinnedAccountId(a.id!); setPinMenuOpen(false) }}
                        className="block w-full text-left px-2 py-1 text-sm hover:bg-accent/10 rounded"
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <div className="relative flex-1">

          {/* ── Actual textarea — sits below, provides bg + border + caret ── */}
          <textarea
            ref={inputRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={hint}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            rows={1}
            className={cn(
              'terminal-input w-full px-3 py-2.5 resize-none overflow-hidden leading-5',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-500/50',
              error ? 'border-red-500/50' : ''
            )}
            style={{ color: 'transparent', caretColor: error ? '#f87171' : '#4ade80', minHeight: '40px' }}
          />

          {/* ── Syntax-highlight mirror — floats on top, pointer-events-none ── */}
          <div
            ref={mirrorRef}
            aria-hidden="true"
            className="absolute inset-0 px-3 py-2.5 pointer-events-none select-none font-mono text-sm whitespace-pre-wrap break-words bg-transparent leading-5 overflow-hidden"
          >
            {value === '' ? null : tokens.map((tok, i) => (
              <span key={i} style={{ color: tok.color }}>{tok.text}</span>
            ))}
          </div>

          {/* ── Autocomplete dropdown ── */}
          {(suggestions.length > 0 || suggestionType === 'd:') && suggestionType && (
            <div
              className="absolute z-50 top-full mt-1 left-0 w-full rounded-md border border-border bg-popover shadow-lg overflow-hidden"
            >
              {suggestionType === 'd:' && (
                <>
                  {suggestions.length > 0 && (
                    <>
                      <div className="flex items-center gap-1 px-3 py-1.5 text-[10px] text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        <span>Quick dates</span>
                      </div>
                      <ul ref={suggestionsRef} className="max-h-40 overflow-y-auto">
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
                              <span className="font-mono text-xs text-sky-400">d:</span>
                              <span>{s}</span>
                              {i === activeIdx && (
                                <span className="ml-auto text-[10px] text-muted-foreground">Tab</span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <Separator />
                  <InlineCalendar onSelectDate={handleDateSelect} />
                </>
              )}
              {suggestionType !== 'd:' && (
                <ul ref={suggestionsRef}>
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
          <span className="text-zinc-400">fee:2.5</span> &nbsp;
          <span className="text-sky-400">d:yesterday</span>
        </p>
        <p className="text-zinc-700">Tab to complete &middot; &uarr;&darr; to navigate &middot; Esc to dismiss</p>
      </div>
    </div>
  )
}
