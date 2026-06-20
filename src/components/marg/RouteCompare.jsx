import { Clock, IndianRupee, Shield, Leaf } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Compact side-by-side comparison of the top routes so the fast/cheap/green/safe
 * trade-off is obvious at a glance. Best value in each column is highlighted.
 * `rows` = [{ id, label, time, fare, safety, co2Kg }] (numbers, not formatted).
 */
export function RouteCompare({ rows, onPick }) {
  if (!rows?.length) return null
  const best = {
    time: Math.min(...rows.map((r) => r.time)),
    fare: Math.min(...rows.map((r) => r.fare)),
    safety: Math.max(...rows.map((r) => r.safety ?? 0)),
    co2Kg: Math.max(...rows.map((r) => r.co2Kg ?? 0)),
  }
  const cols = [
    { key: 'time', icon: Clock, label: 'Time', fmt: (v) => `${v}m`, win: (v) => v === best.time },
    { key: 'fare', icon: IndianRupee, label: 'Fare', fmt: (v) => `₹${v}`, win: (v) => v === best.fare },
    { key: 'safety', icon: Shield, label: 'Safety', fmt: (v) => `${v}`, win: (v) => (v ?? 0) === best.safety },
    { key: 'co2Kg', icon: Leaf, label: 'CO₂ saved', fmt: (v) => `${(v ?? 0).toFixed(1)}kg`, win: (v) => (v ?? 0) === best.co2Kg && best.co2Kg > 0 },
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-marg-border bg-white">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b border-marg-border bg-gray-50 text-marg-muted">
            <th className="w-[34%] px-3 py-2 text-left text-xs font-semibold">Route</th>
            {cols.map((c) => (
              <th key={c.key} className="px-1 py-2 text-center text-[11px] font-semibold">
                <c.icon className="mx-auto mb-0.5 size-3.5" />
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onPick?.(r.id)}
              className="cursor-pointer border-b border-marg-border last:border-0 hover:bg-emerald-50/50"
            >
              <td className="px-3 py-2.5 text-left text-xs font-medium text-marg-text">{r.label}</td>
              {cols.map((c) => {
                const v = r[c.key]
                const win = c.win(v)
                return (
                  <td
                    key={c.key}
                    className={cn(
                      'px-1 py-2.5 text-center tabular-nums',
                      win ? 'font-bold text-emerald-600' : 'text-marg-text',
                    )}
                  >
                    {c.fmt(v)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
