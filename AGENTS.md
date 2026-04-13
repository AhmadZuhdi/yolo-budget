You are an expert full-stack developer working on **Yolo Expense Tracker** — a modern, offline-first PWA built with React, Vite, TypeScript, Tailwind CSS, Dexie.js, and Zustand.

This document is the single source of truth for the project's architecture, conventions, and rules. Read it in full before making any changes.

---

## 1. Project Identity

| Field | Value |
|---|---|
| App name | Yolo Expense Tracker |
| Package name | `yolo-expense-tracker` |
| Version | `0.1.0` |
| Runtime | Node 18+ / npm |
| Dev server | `npm run dev` → http://localhost:5173 |
| Build | `npm run build` (tsc -b && vite build) |
| Preview | `npm run preview` |

---

## 2. Technology Stack

| Layer | Choice | Version |
|---|---|---|
| Framework | React | 18.3 |
| Language | TypeScript | 5.7 |
| Bundler | Vite | 6.x |
| Styling | Tailwind CSS (dark-first) | 3.4 |
| UI primitives | Radix UI (manual shadcn-style) | various |
| Database | Dexie.js (IndexedDB wrapper) | 4.x |
| DB hooks | dexie-react-hooks (`useLiveQuery`) | 1.1 |
| Global state | Zustand | 5.x |
| Routing | React Router v6 | 6.28 |
| PWA | vite-plugin-pwa + Workbox | 0.21 |
| Date utils | date-fns | 4.x |
| Icons | lucide-react | 0.469 |
| Class utils | clsx + tailwind-merge + cva | latest |

**Do not upgrade Vite beyond 6.x** — `vite-plugin-pwa` does not yet support Vite 7/8.

---

## 3. Repository Structure

```
yolo-client-react/
├── public/
│   └── icons/               # PWA icons — icon-192.png, icon-512.png, icon-512-maskable.png
├── src/
│   ├── db/
│   │   ├── types.ts         # All TypeScript interfaces and type aliases
│   │   └── db.ts            # Dexie DB class, helpers, seed data
│   ├── hooks/
│   │   ├── useAccounts.ts
│   │   ├── useBudgets.ts
│   │   ├── useRecurring.ts
│   │   ├── useSettings.ts
│   │   ├── useToast.ts      # Toast state manager (singleton, no Context)
│   │   └── useTransactions.ts
│   ├── store/
│   │   └── stagingStore.ts  # Zustand store + terminal input parser
│   ├── utils/
│   │   ├── gistSync.ts      # GitHub Gist export / import / restore
│   │   └── recurringEngine.ts # On-load recurring transaction processor
│   ├── lib/
│   │   └── utils.ts         # cn(), formatCurrency(), formatDate(), formatDateShort()
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx    # Root layout — sidebar + main + nav + FAB + toaster
│   │   │   ├── Sidebar.tsx      # Desktop left nav (hidden on mobile)
│   │   │   ├── BottomNav.tsx    # Mobile bottom tab bar (hidden on md+)
│   │   │   └── FAB.tsx          # Floating action button with mini-menu
│   │   ├── staging/
│   │   │   ├── StagingSheet.tsx       # Slide-up bottom sheet (mobile) / side panel (desktop)
│   │   │   ├── TerminalInput.tsx      # Terminal-style rapid entry input
│   │   │   ├── StagingQueue.tsx       # Staged items list + CommitButton
│   │   │   └── TransactionFormDialog.tsx  # Full form dialog (expense/income/transfer)
│   │   ├── dashboard/
│   │   │   ├── NetWorthCard.tsx
│   │   │   └── RecentTransactions.tsx
│   │   └── ui/                  # Primitive UI components (shadcn-style, hand-written)
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── progress.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── switch.tsx
│   │       ├── textarea.tsx
│   │       ├── toast.tsx        # Radix Toast primitives + variants
│   │       └── toaster.tsx      # Renders active toasts from useToast
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Transactions.tsx
│   │   ├── Accounts.tsx
│   │   ├── Budgets.tsx
│   │   ├── Recurring.tsx
│   │   └── Settings.tsx
│   ├── App.tsx                  # BrowserRouter + Routes + AppInit (seed + recurring engine)
│   ├── main.tsx                 # createRoot, adds `dark` class to <html>
│   └── index.css                # Tailwind directives + CSS custom properties (design tokens)
├── index.html
├── vite.config.ts               # Vite + vite-plugin-pwa config
├── tailwind.config.js           # darkMode: ['class'], custom colors/animations
├── tsconfig.app.json            # App TS config — baseUrl ".", paths "@/*" → "./src/*"
├── tsconfig.node.json           # Node TS config for vite.config.ts
└── package.json
```

---

## 4. Database Schema

The database is named `YoloExpenseTracker` (Dexie v1).

### `accounts`
```ts
interface Account {
  id?: number
  name: string
  type: 'cash' | 'bank' | 'credit_card' | 'savings' | 'investment' | 'other'
  initialBalance: number
  currency: string       // e.g. "USD"
  color: string          // hex, used for visual differentiation
  icon: string           // lucide-react icon name string
  createdAt: string      // ISO timestamp
}
```
Index: `++id, name, type, createdAt`

### `transactions`
```ts
interface Transaction {
  id?: number
  accountId: number
  type: 'income' | 'expense' | 'transfer'
  amount: number
  date: string           // YYYY-MM-DD
  description: string
  tags: string[]
  isCommitted: boolean   // false = staged/draft, true = finalized
  toAccountId?: number   // transfer destination account
  transferFee?: number   // optional fee, debited from source account
  createdAt: string
}
```
Index: `++id, accountId, toAccountId, type, date, isCommitted, *tags, createdAt`

### `budgets`
```ts
interface Budget {
  id?: number
  name: string
  targetTags: string[]   // spending tracked for these tags
  limitAmount: number
  period: 'weekly' | 'monthly' | 'yearly'
  createdAt: string
}
```
Index: `++id, name, period, createdAt`

### `recurring`
```ts
interface Recurring {
  id?: number
  templateTransaction: RecurringTemplate  // subset of Transaction fields
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  nextOccurrence: string  // YYYY-MM-DD — advanced each cycle
  isActive: boolean
  createdAt: string
}
```
Index: `++id, nextOccurrence, isActive, createdAt`

### `settings`
```ts
interface Setting {
  key: 'githubPat' | 'gistId' | 'currency' | 'theme' | 'lastSyncAt'
  value: string
}
```
Primary key: `key`

### Computed types (never stored)
- `AccountWithBalance` — `Account` + `balance: number` (computed from transactions)
- `BudgetWithSpending` — `Budget` + `spent`, `percentage`, `status: 'safe'|'warning'|'danger'`
- `StagedTransaction` — in-memory only, has a temporary `id: string` (UUID)
- `GistSyncPayload` — serialized snapshot: `{ version, exportedAt, accounts, transactions, budgets, recurring }`

---

## 5. Key Architectural Decisions

### Offline-first
All reads and writes go directly to IndexedDB via Dexie. There is no API layer, no server, no cache-aside. The app works fully offline from first load.

### Dark mode
The app defaults to dark mode. `document.documentElement.classList.add('dark')` is called in `main.tsx`. Tailwind uses `darkMode: ['class']`. Do not add light-mode conditionals without explicit instruction.

### Mobile-first layout
- `< md` breakpoint: **BottomNav** (5 tabs), content full-width, FAB at `bottom-20 right-4`
- `>= md` breakpoint: **Sidebar** (left, 224px wide), FAB at `bottom-6 right-6`
- All touch targets are minimum 44×44px
- Bottom sheet uses `max-h-[85svh]` and `pb-safe` for notch safety

### Staging / Commit pattern
Transactions are not written to the DB until explicitly committed. The staging area is held in **Zustand** (`useStagingStore`) — it is ephemeral (lost on page reload by design). There are two entry paths:
1. **Terminal input** — rapid text commands parsed by `parseTerminalInput()` in `stagingStore.ts`
2. **Form dialog** — `TransactionFormDialog` with type tabs, tag suggestions, and stage vs. direct-save toggle

### Balance computation
Account balances are computed on-the-fly in `computeAccountBalance()` (`db.ts`) by scanning all committed transactions. There is no stored balance field. This keeps the DB simple and avoids drift.

### Toast system
`useToast` (`src/hooks/useToast.ts`) is a singleton module-level store — no React Context needed. Call `toast.success()`, `toast.error()`, `toast.warning()`, `toast.info()` from anywhere. The `<Toaster />` component in `AppLayout` renders them.

### Recurring engine
`processRecurringTransactions()` (`src/utils/recurringEngine.ts`) is called once on app load in `App.tsx`. It loops through all active recurring entries, generates committed transactions for every missed cycle, and advances `nextOccurrence`.

### GitHub Gist sync
`gistSync.ts` uses the GitHub REST API (`PATCH /gists/:id`) to export the entire DB as a single JSON file (`yolo-expense-tracker-backup.json`). Import fetches the Gist, validates the payload version, then **clears and repopulates** all four data tables. Settings (PAT, Gist ID) are preserved during import. Payload version is currently `1`.

---

## 6. Routing

All routes are nested under `<AppLayout>` (which provides sidebar, bottom nav, FAB, staging sheet, and toaster).

| Path | Page | Description |
|---|---|---|
| `/` | `Dashboard` | Net worth, cash flow, budget bars, recent transactions |
| `/transactions` | `Transactions` | Full history with filter by date/account/type/tags |
| `/accounts` | `Accounts` | Account cards, add account dialog, transfer dialog |
| `/budgets` | `Budgets` | Budget cards with progress bars (green/yellow/red) |
| `/recurring` | `Recurring` | Recurring templates, toggle active, next occurrence |
| `/settings` | `Settings` | Currency pref, GitHub PAT/Gist config, export/import |

---

## 7. Styling Conventions

- **Design tokens** are CSS custom properties defined in `src/index.css` under `@layer base { :root { ... } }` using HSL values. Tailwind references them via `hsl(var(--token))`.
- **Color palette**: zinc-950 background, violet/purple primary, emerald for income, red for expenses, blue for transfers.
- **Component classes**: use `cn()` from `src/lib/utils.ts` for all conditional className merging.
- **Animations**: `animate-slide-up`, `animate-fade-in` are defined in `tailwind.config.js` keyframes.
- **Badge variants**: `income`, `expense`, `transfer`, `tag` — defined in `src/components/ui/badge.tsx`.
- **Button variants**: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, `income`, `expense`, `transfer`.

---

## 8. Adding New Features — Checklist

When adding a new feature, follow this order:

1. **Types** — add/extend interfaces in `src/db/types.ts`
2. **DB migration** — if schema changes, bump the Dexie version in `src/db/db.ts` (e.g. `this.version(2).stores(...)`)
3. **Hook** — add or extend a hook in `src/hooks/` using `useLiveQuery`
4. **Store** — if it needs ephemeral state, add to `stagingStore.ts` or create a new Zustand store
5. **Component / Page** — build UI, use existing `src/components/ui/` primitives
6. **Toast** — use `toast.success/error/warning/info()` for all user-facing feedback; never use `alert()` or `console.log` for UX
7. **Build check** — always run `npm run build` before considering a feature done; zero TS errors required

---

## 9. Terminal Input Syntax

The `parseTerminalInput()` function in `src/store/stagingStore.ts` supports:

| Syntax | Type | Example |
|---|---|---|
| `-<amount> <desc> #tag @account` | Expense | `-50 Coffee #food @Cash` |
| `+<amount> <desc> #tag @account` | Income | `+2000 Salary #income @Bank` |
| `><amount> @from to @to #tag fee:<n>` | Transfer | `>500 @Bank to @Cash #atm fee:2.5` |

Rules:
- Prefix `-` = expense, `+` = income, `>` = transfer
- `#word` tokens are extracted as tags (lowercased)
- `@word` tokens are matched case-insensitively against existing account names
- `fee:<number>` sets `transferFee` on transfer transactions
- Unrecognised account names fall back to the first account in the DB

---

## 10. Gist Sync Payload Format

```json
{
  "version": 1,
  "exportedAt": "2026-04-08T00:00:00.000Z",
  "accounts": [...],
  "transactions": [...],
  "budgets": [...],
  "recurring": [...]
}
```

- File name in Gist: `yolo-expense-tracker-backup.json`
- Import strips all `id` fields before re-inserting to avoid primary key conflicts
- `version` must equal `1` or import throws — bump when schema changes incompatibly

---

## 11. PWA Configuration

- Plugin: `vite-plugin-pwa` v0.21 with `registerType: 'autoUpdate'`
- Strategy: `GenerateSW` (Workbox)
- Precaches: all JS, CSS, HTML, images, icons
- Theme color: `#09090b` (zinc-950)
- Display: `standalone`
- Icons: `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`
- Apple meta tags are set in `index.html` (`apple-mobile-web-app-capable`, `viewport-fit=cover`)

---

## 12. What NOT To Do

- Do not use `alert()`, `confirm()`, or `console.log()` for user-facing feedback — use `toast.*`
- Do not store computed values (balances, budget spending) in the DB — always compute them
- Do not add a backend, API, or remote database — this app is intentionally offline-first
- Do not import from `@radix-ui` directly in pages/components — use the wrappers in `src/components/ui/`
- Do not upgrade `vite` beyond `^6.x` — `vite-plugin-pwa` compatibility constraint
- Do not use `cd && command` patterns in shell commands — use the `workdir` parameter
- Do not create new files when editing an existing one would suffice

---

## 13. Potential Next Steps (Backlog)

These features have been identified but not yet implemented. Pick one up when the user is ready:

| # | Feature | Description |
|---|---|---|
| 1 | **Swipe-to-delete transactions** | Add swipe-left gesture on mobile transaction rows to reveal a delete action (no confirmation required, or with an undo toast) |
| 2 | **Transaction detail / edit sheet** | Tap any committed transaction to open a bottom sheet or dialog pre-filled with its data; allow editing all fields and saving back to the DB |
| 3 | **Charts / spending trends** | Visual graphs on the Dashboard or a dedicated Analytics page — monthly spending bar chart, category pie/donut chart, net worth over time line chart |
| 4 | **Category icons on transactions** | Map common tags (`food`, `transport`, `coffee`, `salary`, etc.) to a lucide-react icon; display the icon next to each transaction row |
| 5 | **Search transactions** | Full-text search input on the Transactions page that filters rows by description (case-insensitive substring match against `transaction.description`) |
