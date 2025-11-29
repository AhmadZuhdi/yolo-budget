# Yolo Budget (mobile-first PWA)

Your live, Optimzed (YoLO)

Lightweight double-entry budgeting app built with React + Vite + TypeScript. Track your finances offline with automatic cloud sync, recurring transactions, budget tracking, and comprehensive reports.

## Features

### Core Budgeting
- **Offline-first storage** using IndexedDB (`idb`) — see `src/db/indexeddb.ts`
- **Flexible transaction modes** — Toggle between double-entry accounting (balanced transactions) and simple mode (quick income/expense tracking)
- **Multi-currency support** — configure your preferred currency with automatic formatting
- **Account management** — Track bank, cash, credit, and other account types with real-time balances
- **Budget categorization** — Assign transactions to budgets for better tracking and organization

### Advanced Features
- **Recurring Transactions** — Set up daily, weekly, monthly, or yearly automatic transactions
- **Budget Tracking** — Create budgets and track actual spending vs planned amounts with visual progress bars
- **Reports & Insights** — Comprehensive analytics with:
  - Income vs expenses analysis
  - Spending by account (pie charts)
  - Transaction trends over time (line charts)
  - Account balance distribution
  - Top active accounts
  - Time-range filtering (week, month, year, all-time)
- **Enhanced Dashboard** — Quick overview with summary cards, charts, and recent transactions
- **Search & Filter** — Find transactions by description, date, or account

### PWA & Sync
- **Progressive Web App** — Install on mobile devices, works offline
- **Automatic Service Worker** — Powered by vite-plugin-pwa for robust offline caching
- **Firebase sync stub** — Basic cloud sync infrastructure (requires configuration)

## Getting Started

### Install dependencies

```bash
npm install
```

### Run dev server

```bash
npm run dev
```

### Build for production

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── db/
│   └── indexeddb.ts          # IndexedDB wrapper, models, bookkeeping
├── services/
│   └── firebase.ts           # Firebase sync stubs
├── utils/
│   └── currency.ts           # Currency formatting utility
├── pages/
│   ├── Dashboard.tsx         # Overview with charts and summaries
│   ├── Accounts.tsx          # Account management
│   ├── Budgets.tsx           # Budget creation and tracking
│   ├── Transactions.tsx      # Transaction recording with search/filter
│   ├── RecurringTransactions.tsx  # Recurring transaction management
│   ├── Reports.tsx           # Analytics and insights
│   └── Settings.tsx          # Currency settings, import/export
├── components/
│   └── Nav.tsx               # Navigation component
├── App.tsx                   # Main app and routing
└── main.tsx                  # Entry point
```

## Data Management

### Transaction Modes
The app supports two transaction modes (configurable in Settings):

**Double-Entry Mode (Default)**
- Requires balanced transactions where debits equal credits
- Each transaction has two lines: one positive, one negative (sum = 0)
- Provides accurate bookkeeping and automatic balance tracking
- Best for: Detailed financial tracking, transfers between accounts

**Simple Mode**
- Quick income/expense tracking with single-entry transactions
- Positive amounts = income, negative amounts = expenses
- Easier for beginners or casual budgeting
- Best for: Simple personal finance, quick expense logging

Toggle modes in Settings → Transaction Mode. Changes apply after page refresh.

### Export & Import
The Settings page allows you to:
- **Export** all data as JSON (accounts, budgets, transactions, recurring transactions, metadata)
- **Import** data from JSON (clears existing data — always backup first!)

### Recurring Transactions
1. Navigate to the Recurring page
2. Create a transaction template with frequency (daily/weekly/monthly/yearly)
3. Set start and optional end dates
4. Click "Process Due Transactions Now" to generate transactions from active recurring templates

### Budget Tracking
Budgets automatically track spending from transactions assigned to them. When creating a transaction, select a budget from the dropdown to categorize it. Spending is calculated from the current month's transactions. Progress bars show:
- Green: Within budget
- Red: Over budget
- Percentage of budget used

## PWA Installation

The app includes a `manifest.json` and automatic service worker generation via `vite-plugin-pwa`. To make it fully installable:

1. Add icons to `public/icons/` (192x192 and 512x512)
2. Build the app: `npm run build`
3. Serve from HTTPS (required for PWA)
4. Install from browser menu on mobile devices

## Firebase Sync (Optional)

The repo includes basic Firebase/Firestore sync stubs in `src/services/firebase.ts`:

- `pushChanges()` — Drains sync queue to Firestore
- `pullChanges()` — Fetches remote transactions

**Production requirements:**
- Add Firebase Authentication
- Implement per-user data namespacing
- Add conflict resolution logic
- Configure Firebase project and add credentials

## Technologies

- **React 18** with TypeScript
- **Vite 5** for fast builds and HMR
- **IndexedDB** via `idb` for offline storage
- **Chart.js** with react-chartjs-2 for visualizations
- **React Router DOM 6** for routing
- **vite-plugin-pwa** for service worker generation
- **Firebase 10** for optional cloud sync

## Caveats & Notes

- **Account deletion** cascades to associated transactions (with confirmation)
- **Currency** is stored in meta but applied site-wide through `formatCurrency` utility
- **Budget matching** uses name similarity between budgets and accounts
- **Concurrent updates** may have race conditions in balance calculations (use transactions for critical operations)
- **Recurring processing** is manual via button click (could be automated with background sync)

## Future Enhancements

Consider adding:
- Firebase Authentication for multi-device sync
- Conflict resolution for offline sync
- Tests (unit, integration, E2E)
- Multi-currency transaction support
- Receipt attachments
- Undo/redo functionality
- Category tags for better reporting
- Scheduled automatic recurring transaction processing

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```
