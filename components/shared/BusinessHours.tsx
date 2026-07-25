/**
 * Business hours table (playbook S081, spec v2/03 §3.4 section 6):
 * 7-row table, today highlighted, "Open now" chip computed in Port of Spain
 * time.
 *
 * The stored shape is V1's `Record<day, string>` with free-text values
 * ("8:00 AM - 5:00 PM", "Closed", "By appointment"). The chip therefore only
 * renders when today's value parses as a recognisable AM/PM range — a value we
 * cannot parse gets the table row verbatim and no chip, never a guess. Server
 * component: "today" and "now" are computed per-request in America/Port_of_Spain
 * regardless of server locale.
 */
import { Badge } from '@/components/ui/Badge'

const DAY_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

const DAY_LABEL: Record<(typeof DAY_ORDER)[number], string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

/** "8:00 AM" → minutes since midnight, or null when unparseable. */
function parseClock(value: string): number | null {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i.exec(value.trim())
  if (!match) return null
  const rawHour = Number(match[1])
  const minute = Number(match[2] ?? '0')
  if (rawHour < 1 || rawHour > 12 || minute > 59) return null
  const isPm = (match[3] ?? '').toLowerCase() === 'pm'
  const hour = (rawHour % 12) + (isPm ? 12 : 0)
  return hour * 60 + minute
}

/** "8:00 AM - 5:00 PM" → [start, end] minutes, or null. */
function parseRange(value: string): [number, number] | null {
  const parts = value.split(/[-–—]/)
  if (parts.length !== 2) return null
  const start = parseClock(parts[0] ?? '')
  const end = parseClock(parts[1] ?? '')
  if (start === null || end === null) return null
  return [start, end]
}

/** Now in Port of Spain, as { day key, minutes since midnight }. */
function nowInPortOfSpain(): { day: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Port_of_Spain',
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const day = get('weekday').toLowerCase()
  const hour = Number(get('hour')) % 24
  const minute = Number(get('minute'))
  return { day, minutes: hour * 60 + minute }
}

export function BusinessHours({ hours }: { hours: Record<string, string> }) {
  const now = nowInPortOfSpain()
  const todayValue = hours[now.day]
  const todayRange = todayValue ? parseRange(todayValue) : null
  const openNow = todayRange !== null && now.minutes >= todayRange[0] && now.minutes < todayRange[1]

  return (
    <div>
      {openNow && (
        <div className="mb-3">
          <Badge variant="verified">Open now</Badge>
        </div>
      )}
      <table className="w-full text-sm">
        <caption className="sr-only">Business hours, Port of Spain time</caption>
        <tbody>
          {DAY_ORDER.map((day) => {
            const isToday = day === now.day
            return (
              <tr key={day} className={isToday ? 'text-foreground font-medium' : 'text-body'}>
                <th scope="row" className="py-1.5 pr-4 text-left font-normal">
                  <span className={isToday ? 'font-medium' : undefined}>{DAY_LABEL[day]}</span>
                  {isToday && <span className="text-muted ml-2 text-xs">Today</span>}
                </th>
                <td className="py-1.5 text-right font-mono tabular-nums">
                  {hours[day] ?? 'Closed'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
