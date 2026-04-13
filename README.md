# Yolo Expense Tracker

A modern, offline-first Progressive Web App (PWA) for personal expense tracking. Built with React, TypeScript, and Tailwind CSS — no account required, no server, all data lives on your device.

## Features

### Dashboard
- **Net worth overview** — aggregate balance across all accounts with per-account breakdown
- **Monthly cash flow** — current month's total income vs. expenses at a glance
- **Budget overview** — up to 4 inline progress bars with color-coded status (safe / warning / danger)
- **Recent transactions** — the 8 most recent committed transactions with quick "View all" link

### Transactions
- Full transaction history grouped by date
- **Filter panel** — filter by account, type (income / expense / transfer), date range, and tags
- **Edit transactions** — click any row to open a pre-filled edit dialog
- **Delete transactions** — inline delete with toast confirmation
- **Reconcile tool** — match tracked balance to real-world balance; auto-creates an adjustment transaction for the delta

### Accounts
- Account cards with computed live balance (never stored, always derived)
- **Add / edit / delete accounts** — with type, currency, initial balance, and color picker
- **Transfer between accounts** — create a staged transfer with optional fee directly from the Accounts page
- Delete cascades to all linked transactions

### Budgets
- Tag-based spending limits with weekly / monthly / yearly periods
- Live progress bars with contextual status messages ("Over budget by X", "X remaining")
- Spending computed dynamically from committed expense transactions matching the budget's tags

### Recurring Transactions
- Template-based recurring income and expense automation
- Frequency options: daily, weekly, monthly, yearly
- Enable / disable individual recurring entries with a toggle
- On app load, all missed cycles are auto-generated as committed transactions

### Settings
- **Currency preference** — searchable dropdown with 46 world currencies
- **GitHub Gist sync** — bidirectional cloud backup using your own GitHub PAT and a private Gist
- **Danger zone** — clear all local data with a single action

---

## Staging / Terminal Entry System

The app's standout feature is a two-path, draft-before-commit transaction workflow.

### Terminal Input

A keyboard-driven rapid entry field with live syntax highlighting:

| Syntax | Type | Example |
|---|---|---|
| `-<amount> <desc> #tag @account` | Expense | `-50 Coffee #food @Cash` |
| `+<amount> <desc> #tag @account` | Income | `+2000 Salary #income @Bank` |
| `><amount> @from to @to #tag fee:<n>` | Transfer | `>500 @Bank to @Cash #atm fee:2.5` |

- Tokens are color-coded as you type (amount, description, tags, accounts, fee)
- `@` and `#` trigger autocomplete dropdowns (navigate with arrow keys, complete with Tab)
- Placeholder hints rotate every 3 seconds with example commands

### Form Entry

A full dialog form for less frequent or more complex transactions:
- Segmented type tabs (Expense / Income / Transfer)
- Tag chip suggestions per type
- Toggle between "Stage for review" and "Save directly"

### Staging Queue

Staged transactions accumulate in a queue before being committed:
- Inline remove per item
- **Balance impact preview** — real-time before/after/delta for every affected account
- **Commit all** — bulk-writes all staged transactions to the database at once

---

## GitHub Gist Sync

Optional cloud backup via the GitHub REST API (requires a Personal Access Token with `gist` scope):

- **Export** — serializes all accounts, transactions, budgets, and recurring entries to a single JSON file in a private Gist
- **Import** — fetches and fully restores from the Gist (destructive — overwrites all local data)
- **Create new Gist** — one-click provisioning directly from the Settings page
- Settings (PAT, Gist ID) are never included in the backup payload

---

## PWA

- Installable on iOS, Android, and desktop
- Fully offline — all data is stored in IndexedDB via Dexie.js
- Auto-updating service worker (Workbox `GenerateSW`)
- Portrait-optimized standalone display with safe-area insets for notched devices

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript 5.7 |
| Bundler | Vite 6 |
| Styling | Tailwind CSS 3.4 (dark-first) |
| UI primitives | Radix UI (shadcn-style, hand-written) |
| Database | Dexie.js 4 (IndexedDB) |
| Global state | Zustand 5 |
| Routing | React Router v6 |
| PWA | vite-plugin-pwa 0.21 + Workbox |
| Date utilities | date-fns 4 |
| Icons | lucide-react |

---

## Getting Started

**Requirements:** Node 18+

```bash
# Install dependencies
npm install

# Start the dev server (http://localhost:5173)
npm run dev

# Type-check and build for production
npm run build

# Preview the production build
npm run preview
```

---

## Roadmap

| Feature | Description |
|---|---|
| Swipe-to-delete | Swipe-left gesture on mobile transaction rows to reveal a delete action with optional undo toast |
| Charts & spending trends | Monthly spending bar chart, category pie/donut chart, and net worth over time line chart |
| Category icons | Map common tags (food, transport, coffee, salary, etc.) to icons displayed next to transaction rows |
| Transaction search | Full-text search on the Transactions page filtering by description |
