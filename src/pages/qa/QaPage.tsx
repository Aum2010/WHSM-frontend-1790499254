import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../stores/auth.store'
import { api } from '../../lib/api'

interface DeviationReport {
  id: string
  reportNo: string
  lotNo: string
  description: string
  status: 'OPEN' | 'APPROVED_REWORK' | 'APPROVED_MOVE' | 'CLOSED'
  reportedBy: string
  resolvedBy: string | null
  resolvedAt: string | null
  resolution: string | null
  reworkCount: number
  createdAt: string
}

interface SystemHold {
  id: string
  isActive: boolean
  reason: string | null
  activatedBy: string | null
  activatedAt: string | null
}

const STATUS_BADGE: Record<string, string> = {
  OPEN:             'badge-red',
  APPROVED_REWORK:  'badge-yellow',
  APPROVED_MOVE:    'badge-sky',
  CLOSED:           'badge-green',
}

// ── Modal: ออก Deviation ─────────────────────────────
function CreateDeviationModal({ onClose, onSuccess }: {
  onClose: () => void; onSuccess: () => void
}) {
  const { user } = useAuthStore()
  const [form, setForm] = useState({
    lotNo: '', description: '', reportedBy: user?.id ?? '',
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post('/api/v1/qa/deviation', form),
    onSuccess: () => { onSuccess(); onClose() },
    onError: (err: any) => setError(err.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md space-y-4">
        <div>
          <h3 className="text-lg font-bold text-white">ออก Deviation Report</h3>
          <p className="text-xs text-slate-400 mt-1">Lot จะถูกกักกัน (HOLD) ทันทีหลังบันทึก</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Lot Number</label>
          <input className="input" placeholder="เช่น 01092026/001"
            value={form.lotNo}
            onChange={e => setForm(f => ({ ...f, lotNo: e.target.value }))} />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">รายละเอียดปัญหา</label>
          <textarea
            className="input min-h-[80px] resize-none"
            placeholder="อธิบายปัญหาที่พบ..."
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>

        <div className="bg-slate-800 rounded-xl px-4 py-2 text-xs text-slate-400">
          ผู้รายงาน: <span className="text-sky-400">{user?.name}</span>
        </div>

        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400">
          ⚠ Lot จะถูกล็อคทันที — ห้ามจ่ายสินค้าจนกว่า QA จะปลดล็อค
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-ghost flex-1">ยกเลิก</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="btn-danger flex-1"
          >
            {mutation.isPending ? 'กำลังบันทึก...' : '🔒 กักกัน Lot'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: Release / Rework ──────────────────────────
function ResolveModal({ report, onClose, onSuccess }: {
  report: DeviationReport; onClose: () => void; onSuccess: () => void
}) {
  const { user } = useAuthStore()
  const [action, setAction] = useState<'release' | 'rework'>('release')
  const [resolution, setResolution] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      const endpoint = action === 'release'
        ? `/api/v1/qa/lots/${report.lotNo}/release`
        : `/api/v1/qa/lots/${report.lotNo}/rework`
      return api.patch(endpoint, { resolvedBy: user?.id, resolution })
    },
    onSuccess: () => { onSuccess(); onClose() },
    onError: (err: any) => setError(err.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md space-y-4">
        <div>
          <h3 className="text-lg font-bold text-white">จัดการ Deviation</h3>
          <p className="text-xs text-sky-400 font-mono mt-1">{report.reportNo}</p>
          <p className="text-xs text-slate-400 mt-1">Lot: {report.lotNo}</p>
        </div>

        {/* Problem summary */}
        <div className="bg-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300">
          <p className="text-xs text-slate-500 mb-1">ปัญหาที่พบ</p>
          {report.description}
        </div>

        {/* Action select */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">การดำเนินการ</label>
          <div className="flex gap-3">
            <button
              onClick={() => setAction('release')}
              className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors ${
                action === 'release'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              ✓ ปลดล็อค (Release)
            </button>
            <button
              onClick={() => setAction('rework')}
              className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors ${
                action === 'rework'
                  ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              🔄 ส่ง Rework
            </button>
          </div>
        </div>

        {/* Rework count warning */}
        {action === 'rework' && report.reworkCount > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 text-xs text-yellow-400">
            ⚠ Lot นี้ผ่าน Rework มาแล้ว {report.reworkCount} ครั้ง
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            {action === 'release' ? 'เหตุผลที่อนุมัติ' : 'รายละเอียด Rework'}
          </label>
          <textarea
            className="input min-h-[80px] resize-none"
            placeholder={action === 'release' ? 'ตรวจสอบแล้วไม่พบปัญหา...' : 'ส่งกลับแก้ไข...'}
            value={resolution}
            onChange={e => setResolution(e.target.value)}
          />
        </div>

        <div className="bg-slate-800 rounded-xl px-4 py-2 text-xs text-slate-400">
          QA: <span className="text-sky-400">{user?.name}</span>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-ghost flex-1">ยกเลิก</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className={`flex-1 ${action === 'release' ? 'btn-primary' : 'btn-danger'}`}
          >
            {mutation.isPending ? 'กำลังบันทึก...' : action === 'release' ? 'ปลดล็อค' : 'ส่ง Rework'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── System Hold Panel ────────────────────────────────
function SystemHoldPanel({ sysHold, onRefresh }: {
  sysHold: SystemHold; onRefresh: () => void
}) {
  const { user } = useAuthStore()
  const [reason, setReason] = useState('')
  const [error, setError]   = useState('')

  const mutation = useMutation({
    mutationFn: (hold: boolean) => api.patch('/api/v1/qa/system-hold', {
      hold,
      reason:      hold ? reason : undefined,
      activatedBy: hold ? user?.id : undefined,
    }),
    onSuccess: () => { setReason(''); onRefresh() },
    onError: (err: any) => setError(err.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  return (
    <div className={`rounded-2xl border p-5 space-y-4 ${
      sysHold.isActive
        ? 'bg-red-500/10 border-red-500/40'
        : 'bg-slate-900 border-slate-800'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full flex-shrink-0 ${
            sysHold.isActive ? 'bg-red-500 animate-pulse' : 'bg-slate-600'
          }`} />
          <div>
            <p className={`font-bold text-sm ${sysHold.isActive ? 'text-red-400' : 'text-slate-300'}`}>
              System-wide HOLD
            </p>
            <p className="text-xs text-slate-500">
              {sysHold.isActive ? `เหตุผล: ${sysHold.reason}` : 'ระบบทำงานปกติ'}
            </p>
          </div>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full border font-medium ${
          sysHold.isActive
            ? 'bg-red-500/20 border-red-500/40 text-red-400'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        }`}>
          {sysHold.isActive ? 'HOLD' : 'NORMAL'}
        </span>
      </div>

      {sysHold.isActive ? (
        <div className="space-y-3">
          <div className="text-xs text-slate-400 space-y-1">
            {sysHold.activatedBy && <p>ผู้สั่ง HOLD: <span className="text-slate-300">{sysHold.activatedBy}</span></p>}
            {sysHold.activatedAt && <p>เวลา: <span className="text-slate-300">{new Date(sysHold.activatedAt).toLocaleString('th-TH')}</span></p>}
          </div>
          <button
            onClick={() => mutation.mutate(false)}
            disabled={mutation.isPending}
            className="btn-primary w-full"
          >
            {mutation.isPending ? 'กำลังปลดล็อค...' : '✓ ปลด System HOLD'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            className="input"
            placeholder="ระบุเหตุผล HOLD ทั้งระบบ..."
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
          <button
            onClick={() => mutation.mutate(true)}
            disabled={mutation.isPending || !reason}
            className="btn-danger w-full"
          >
            {mutation.isPending ? 'กำลัง HOLD...' : '⚠ HOLD ทั้งระบบ (Emergency)'}
          </button>
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────
export default function QaPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate]   = useState(false)
  const [selected, setSelected]       = useState<DeviationReport | null>(null)
  const [statusFilter, setStatusFilter] = useState('ALL')

  const { data: deviations = [], isLoading } = useQuery<DeviationReport[]>({
    queryKey: ['deviations'],
    queryFn:  () => api.get('/api/v1/qa/deviations').then(r => r.data),
    refetchInterval: 10000,
  })

  const { data: sysHold, refetch: refetchHold } = useQuery<SystemHold>({
    queryKey: ['system-hold'],
    queryFn:  () => api.get('/api/v1/qa/system-hold').then(r => r.data),
    refetchInterval: 5000,
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['deviations'] })
    qc.invalidateQueries({ queryKey: ['lots'] })
    refetchHold()
  }

  const filtered = deviations.filter(d =>
    statusFilter === 'ALL' ? true : d.status === statusFilter
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">QA / กักกันสินค้า</h2>
          <p className="text-sm text-slate-400 mt-1">{deviations.length} deviation reports ทั้งหมด</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-danger text-sm">
          + ออก Deviation Report
        </button>
      </div>

      {/* System Hold Panel */}
      {sysHold && (
        <SystemHoldPanel sysHold={sysHold} onRefresh={refresh} />
      )}

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['ALL', 'OPEN', 'APPROVED_REWORK', 'CLOSED'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              statusFilter === s
                ? 'bg-sky-500/20 border-sky-500 text-sky-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            {s === 'ALL' ? 'ทั้งหมด' : s}
          </button>
        ))}
      </div>

      {/* Deviation table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-400">
              <th className="text-left px-4 py-3 font-medium">Report No.</th>
              <th className="text-left px-4 py-3 font-medium">Lot</th>
              <th className="text-left px-4 py-3 font-medium">ปัญหา</th>
              <th className="text-left px-4 py-3 font-medium">สถานะ</th>
              <th className="text-left px-4 py-3 font-medium">Rework</th>
              <th className="text-left px-4 py-3 font-medium">วันที่</th>
              <th className="text-left px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-500 animate-pulse">กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-500">ไม่พบ deviation reports</td></tr>
            ) : filtered.map(dev => (
              <tr key={dev.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-sky-400">{dev.reportNo}</td>
                <td className="px-4 py-3 font-mono text-xs">{dev.lotNo}</td>
                <td className="px-4 py-3 text-slate-300 max-w-[200px] truncate">{dev.description}</td>
                <td className="px-4 py-3">
                  <span className={STATUS_BADGE[dev.status]}>{dev.status}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  {dev.reworkCount > 0
                    ? <span className="badge-yellow">{dev.reworkCount}x</span>
                    : <span className="text-slate-600">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {new Date(dev.createdAt).toLocaleDateString('th-TH')}
                </td>
                <td className="px-4 py-3">
                  {dev.status === 'OPEN' && (
                    <button
                      onClick={() => setSelected(dev)}
                      className="btn-ghost text-xs py-1.5 px-3"
                    >
                      จัดการ
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateDeviationModal
          onClose={() => setShowCreate(false)}
          onSuccess={refresh}
        />
      )}
      {selected && (
        <ResolveModal
          report={selected}
          onClose={() => setSelected(null)}
          onSuccess={refresh}
        />
      )}
    </div>
  )
}