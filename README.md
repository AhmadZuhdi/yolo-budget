# Yolo Budget (mobile-first PWA)

Your live, Optimzed (YoLO)

Lightweight double-entry budgeting app built with React + Vite + TypeScript. Track your finances offline with automatic cloud sync, recurring transactions, budget tracking, and comprehensive reports.

## Features

### Core Budgeting
- **Offline-first storage** using IndexedDB (`idb`) — see `src/db/indexeddb.ts`
- **Flexible transaction modes** — Toggle between double-entry accounting (balanced transactions) and simple mode (quick income/expense tracking)
- **Multi-currency support** — Configure your preferred currency (USD/IDR) with automatic formatting
- **Account management** — Track bank, cash, credit, and other account types with real-time balances
- **Budget categorization** — Assign transactions to budgets for better tracking and organization
- **Transaction tags** — Add comma-separated tags to transactions for flexible categorization and filtering
- **Quick transfers** — Transfer money between accounts with a dedicated transfer tool

### Advanced Features
- **Recurring Transactions** — Set up daily, weekly, monthly, or yearly automatic transactions
- **Budget Tracking** — Create budgets and track actual spending vs planned amounts with visual progress bars
- **Reports & Insights** — Comprehensive analytics with:
  - Income vs expenses analysis (excludes transfers)
  - Spending by account (pie charts)
  - Transaction trends over time (line charts)
  - Account balance distribution
  - Top active accounts
  - Time-range filtering (week, month, year, all-time, custom date range)
  - Tag-based filtering
  - Support for both transaction modes
- **Enhanced Dashboard** — Quick overview with summary cards, charts, and recent transactions
- **Search & Filter** — Find transactions by description, date, account, or tag
- **Dark Mode** — Full dark theme support with toggle in Settings

### User Experience
- **Hamburger Navigation** — Side menu with version info in footer
- **Floating Action Button** — Quick access to create transactions
- **Default Settings** — Set default account and budget for new transactions
- **Responsive Design** — Mobile-first, works on all screen sizes

### PWA & Data Management
- **Progressive Web App** — Install on mobile devices, works offline
- **Automatic Service Worker** — Powered by vite-plugin-pwa for robust offline caching
- **Export/Import** — Backup and restore all data via JSON files
- **Factory Reset** — Clear all data and start fresh
- **Firebase sync stub** — Basic cloud sync infrastructure (requires configuration)

### Developer Tools
- **Version Management** — CLI tools to bump major, minor, or patch versions
- **Firebase Hosting** — Pre-configured for easy deployment

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

### Deploy to Firebase Hosting

```bash
npm run deploy
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

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

### Quick Transaction Defaults
Save time when creating transactions by setting default values in Settings:
- **Default Account** — Pre-fills the account field when creating new transactions
- **Default Budget** — Pre-fills the budget field for automatic categorization

These settings are optional and can be changed on a per-transaction basis.

## Feature Status

### ✅ Implemented Features

**Core Functionality**
- ✅ Offline-first storage with IndexedDB
- ✅ Double-entry and simple transaction modes (toggle in Settings)
- ✅ Multi-currency support (USD, IDR)
- ✅ Account management (create, edit, delete with balance tracking)
- ✅ Budget creation and tracking with progress bars
- ✅ Transaction tags (CSV format input, filter by tags)
- ✅ Quick transfer between accounts

**User Experience**
- ✅ Dark mode toggle (Settings → Appearance)
- ✅ Hamburger side navigation menu
- ✅ Floating Action Button (FAB) for quick transaction creation
- ✅ Default account and budget settings
- ✅ Version display in menu footer

**Transactions**
- ✅ Create/edit/delete transactions
- ✅ Search by description or date
- ✅ Filter by account
- ✅ Filter by tags
- ✅ Budget assignment per transaction
- ✅ Transaction tags support

**Reports & Analytics**
- ✅ Income vs expenses analysis
- ✅ Spending by account (pie charts)
- ✅ Transaction trends over time (line charts)
- ✅ Account balance distribution
- ✅ Top active accounts
- ✅ Time-range filtering (week, month, year, all-time, custom)
- ✅ Tag-based filtering in reports
- ✅ Transfer exclusion from expense calculations
- ✅ Simple mode support in reports

**Data Management**
- ✅ Export all data to JSON file
- ✅ Import data from JSON file
- ✅ Factory reset functionality
- ✅ Recurring transactions (daily, weekly, monthly, yearly)
- ✅ Manual processing of recurring transactions

**PWA Features**
- ✅ Progressive Web App with manifest.json
- ✅ Service worker for offline caching
- ✅ Mobile-first responsive design

**Developer Tools**
- ✅ Version bump CLI (major, minor, patch)
- ✅ Firebase hosting configuration
- ✅ Deployment scripts

### ⚠️ Partially Implemented

**Firebase Sync**
- ⚠️ Basic sync infrastructure exists but requires configuration
- ⚠️ No authentication implemented
- ⚠️ No per-user data namespacing
- ⚠️ No conflict resolution
- ⚠️ Sync queue exists but not fully integrated

### ❌ Not Implemented (Future Enhancements)

**Authentication & Sync**
- ❌ Firebase Authentication
- ❌ Multi-device sync with conflict resolution
- ❌ Per-user data isolation

**Advanced Features**
- ❌ Multi-currency transactions (single transaction with multiple currencies)
- ❌ Receipt attachments
- ❌ Undo/redo functionality
- ❌ Automatic recurring transaction processing (background)
- ❌ Budget templates
- ❌ Spending limits and alerts
- ❌ Bill reminders
- ❌ Savings goals tracking

**Testing & Quality**
- ❌ Unit tests
- ❌ Integration tests
- ❌ End-to-end tests
- ❌ Performance optimization audit

**UX Enhancements**
- ❌ Drag-and-drop transaction reordering
- ❌ Bulk transaction operations
- ❌ Transaction splitting
- ❌ Custom currency addition
- ❌ CSV import/export for transactions
- ❌ PDF export for reports

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
- **Transfers** are automatically excluded from expense calculations in reports
- **Transaction tags** support comma-separated values for flexible categorization
- **Dark mode** persists across sessions and applies immediately
- **Concurrent updates** may have race conditions in balance calculations (use transactions for critical operations)
- **Recurring processing** is manual via button click (could be automated with background sync)
- **Reports** automatically adapt to transaction mode (double-entry vs simple)

## Roadmap & Future Enhancements

See the **Feature Status** section above for a complete breakdown of implemented vs planned features.

Priority enhancements under consideration:
1. **Firebase Authentication** - Enable multi-user support and cloud sync
2. **Automated recurring transactions** - Background processing without manual trigger
3. **Testing suite** - Unit, integration, and E2E tests
4. **Receipt attachments** - Photo/file uploads linked to transactions
5. **Advanced budgeting** - Templates, alerts, spending limits
6. **Enhanced export** - CSV and PDF formats
7. **Transaction splitting** - Split single transaction across multiple budgets/categories

For detailed feature requests or contributions, see the repository issues.

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
