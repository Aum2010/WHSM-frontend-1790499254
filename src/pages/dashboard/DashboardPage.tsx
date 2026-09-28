import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

interface KPI {
  inventory:  { totalStock: number; holdCount: number; expiryCount: number }
  production: { activeBatches: number }
  orders:     { pendingSo: number; pendingPo: number }
  qa:         { openDeviations: number }
}

function StatCard({ label, value, color = 'sky', sub }: {
  label: string; value: number; color?: string; sub?: string
}) {
  const colors: Record<string, string> = {
    sky:    'text-sky-400',
    green:  'text-emerald-400',
    red:    'text-red-400',
    yellow: 'text-yellow-400',
    purple: 'text-purple-400',
  }
  return (
    <div className="card">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const { data: kpi, isLoading, isError } = useQuery<KPI>({
    queryKey: ['kpi'],
    queryFn:  () => api.get('/api/v1/dashboard/kpi').then(r => r.data),
    refetchInterval: 5000,
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-400 text-sm animate-pulse">กำลังโหลด...</p>
    </div>
  )

  if (isError) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-red-400 text-sm">โหลด KPI ไม่ได้ — ตรวจสอบ API</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Dashboard</h2>
        <p className="text-sm text-slate-400 mt-1">ภาพรวมทุก module — อัปเดตทุก 5 วินาที</p>
      </div>

      {/* Expiry warning */}
      {(kpi?.inventory.expiryCount ?? 0) > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-5 py-4 flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse flex-shrink-0" />
          <p className="text-yellow-400 text-sm font-medium">
            ⚠ มี {kpi!.inventory.expiryCount} lot ใกล้หมดอายุภายใน 7 วัน
          </p>
        </div>
      )}

      {/* KPI Grid */}
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">📦 Inventory</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Stock Lots พร้อมใช้"   value={kpi?.inventory.totalStock  ?? 0} color="sky"    />
          <StatCard label="Lot ถูกกักกัน (HOLD)"  value={kpi?.inventory.holdCount   ?? 0} color="red"    />
          <StatCard label="ใกล้หมดอายุ (7 วัน)"   value={kpi?.inventory.expiryCount ?? 0} color="yellow" />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">🏭 Production & Orders</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Batch กำลังผลิต"      value={kpi?.production.activeBatches ?? 0} color="yellow" />
          <StatCard label="SO รอดำเนินการ"       value={kpi?.orders.pendingSo         ?? 0} color="purple" />
          <StatCard label="PO รอดำเนินการ"       value={kpi?.orders.pendingPo         ?? 0} color="sky"    />
          <StatCard label="Deviation เปิดอยู่"    value={kpi?.qa.openDeviations        ?? 0} color="red"    />
        </div>
      </div>
    </div>
  )
}