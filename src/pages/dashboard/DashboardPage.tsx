import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

interface KPI {
  inventory:  { totalLots: number; holdLots: number; availableLots: number }
  production: { activeBatches: number; completedToday: number }
  order:      { pendingSO: number; shippedToday: number }
  purchase:   { pendingPO: number; receivedPO: number }
  qa:         { openDeviations: number; systemOnHold: boolean; holdReason: string | null }
}

function StatCard({ label, value, color = 'sky' }: {
  label: string; value: number; color?: string
}) {
  const colors: Record<string, string> = {
    sky:    'text-sky-400',
    green:  'text-emerald-400',
    red:    'text-red-400',
    yellow: 'text-yellow-400',
  }
  return (
    <div className="card">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colors[color]}`}>{value}</p>
    </div>
  )
}

export default function DashboardPage() {
  const { data: kpi, isLoading } = useQuery<KPI>({
    queryKey: ['kpi'],
    queryFn:  () => api.get('/api/v1/dashboard/kpi').then(r => r.data),
    refetchInterval: 5000,
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-400 text-sm animate-pulse">กำลังโหลด...</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Dashboard</h2>
        <p className="text-sm text-slate-400 mt-1">ภาพรวมทุก module — อัปเดตทุก 5 วินาที</p>
      </div>

      {/* System HOLD banner */}
      {kpi?.qa.systemOnHold && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4 flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          <div>
            <p className="text-red-400 font-bold text-sm">⚠ ระบบถูก HOLD ทั้งหมด</p>
            <p className="text-red-400/70 text-xs mt-0.5">{kpi.qa.holdReason}</p>
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Stock Lots ทั้งหมด"   value={kpi?.inventory.totalLots ?? 0}      color="sky" />
        <StatCard label="Lot ถูกกักกัน (HOLD)" value={kpi?.inventory.holdLots ?? 0}       color="red" />
        <StatCard label="Batch กำลังผลิต"       value={kpi?.production.activeBatches ?? 0} color="yellow" />
        <StatCard label="ผลิตเสร็จวันนี้"        value={kpi?.production.completedToday ?? 0} color="green" />
        <StatCard label="SO รอดำเนินการ"        value={kpi?.order.pendingSO ?? 0}          color="yellow" />
        <StatCard label="จัดส่งวันนี้"           value={kpi?.order.shippedToday ?? 0}       color="green" />
        <StatCard label="PO รอดำเนินการ"        value={kpi?.purchase.pendingPO ?? 0}       color="yellow" />
        <StatCard label="Deviation เปิดอยู่"     value={kpi?.qa.openDeviations ?? 0}        color="red" />
      </div>
    </div>
  )
}