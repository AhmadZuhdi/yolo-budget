import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, Wallet, Target, Settings, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/',            label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/transactions',label: 'Transactions',icon: ArrowLeftRight },
  { to: '/accounts',    label: 'Accounts',    icon: Wallet },
  { to: '/budgets',     label: 'Budgets',     icon: Target },
  { to: '/recurring',   label: 'Recurring',   icon: RefreshCw },
  { to: '/settings',    label: 'Settings',    icon: Settings },
]

export function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-card border-r border-border px-3 py-6 shrink-0">
      {/* Logo */}
      <div className="px-3 mb-8">
        <span className="text-xl font-bold text-primary tracking-tight">Yolo</span>
        <span className="text-xl font-bold text-foreground tracking-tight"> Tracker</span>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
