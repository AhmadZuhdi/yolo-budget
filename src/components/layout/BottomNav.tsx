import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, Wallet, Target, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/',             label: 'Home',    icon: LayoutDashboard },
  { to: '/transactions', label: 'History', icon: ArrowLeftRight },
  { to: '/accounts',     label: 'Accounts',icon: Wallet },
  { to: '/budgets',      label: 'Budgets', icon: Target },
  { to: '/settings',     label: 'Settings',icon: Settings },
]

export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border pb-safe">
      <div className="flex items-stretch">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors min-h-[56px]',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
