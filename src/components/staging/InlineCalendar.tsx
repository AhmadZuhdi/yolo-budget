import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, dateToYMD } from '@/lib/utils'

interface InlineCalendarProps {
  onSelectDate: (ymd: string) => void
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function InlineCalendar({ onSelectDate }: InlineCalendarProps) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const todayYMD = dateToYMD(today)

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  return (
    <div className="p-2 select-none">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={prevMonth}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs font-medium">
          {monthNames[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={nextMonth}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px">
        {DAYS.map((d) => (
          <div key={d} className="text-[10px] text-muted-foreground text-center py-1">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />
          const date = new Date(viewYear, viewMonth, day)
          const ymd = dateToYMD(date)
          const isToday = ymd === todayYMD
          return (
            <button
              key={ymd}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelectDate(ymd)}
              className={cn(
                'text-xs w-7 h-7 rounded flex items-center justify-center transition-colors',
                isToday
                  ? 'bg-sky-500/20 text-sky-400 font-semibold'
                  : 'text-foreground hover:bg-accent'
              )}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
