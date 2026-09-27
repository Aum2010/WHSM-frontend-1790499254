import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../stores/auth.store'
import { api } from '../../lib/api'

interface PoItem {
  id: string
  materialCode: string
  materialName: string
  quantity: string
  unit: string
}

interface PoDocument {
  id: string
  poNo: string
  supplierCode: string
  supplierName: string
  status: 'PENDING' | 'APPROVED' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED'
  createdBy: string
  expectedDate: string | null
  receivedAt: string | null
  note: string | null
  createdAt: string
  items: PoItem[]
}

const STATUS_BADGE: Record<string, string> = {
  PENDING:   'badge-yellow',
  APPROVED:  'badge-sky',
  SHIPPED:   'badge-sky',
  RECEIVED:  'badge-green',
  CANCELLED: 'bg-slate-700 text-slate-400 px-2.5 py-1 rounded-lg text-xs',
}

const STATUS_TH: Record<string, string> = {
  PENDING:   'รออนุมัติ',
  APPROVED:  'อนุมัติแล้ว',
  SHIPPED:   'Supplier ส่งแล้ว',
  RECEIVED:  'รับของแล้ว',
  CANCELLED: 'ยกเลิก',
}

// ── Modal: สร้าง PO ───────────────────────────────────
function CreatePOModal({ onClose, onSuccess }: {
  onClose: () => void; onSuccess: () => void
}) {
  const { user } = useAuthStore()
  const [form, setForm] = useState({
    supplierCode: '', supplierName: '',
    expectedDate: '', note: '',
    createdBy: user?.id ?? '',
  })
  const [items, setItems] = useState([
    { materialCode: '', materialName: '', quantity: '', unit: 'kg' }
  ])
  const [error, setError] = useState('')

  const addItem = () =>
    setItems(i => [...i, { materialCode: '', materialName: '', quantity: '', unit: 'kg' }])

  const removeItem = (idx: number) =>
    setItems(i => i.filter((_, j) => j !== idx))

  const updateItem = (idx: number, key: string, val: string) =>
    setItems(i => i.map((item, j) => j === idx ? { ...item, [key]: val } : item))

  const mutation = useMutation({
    mutationFn: () => api.post('/api/v1/purchase/po', {
      ...form,
      expectedDate: form.expectedDate || undefined,
      note: form.note || undefined,
      items: items.map(i => ({ ...i, quantity: Number(i.quantity) })),
    }),
    onSuccess: () => { onSuccess(); onClose() },
    onError: (err: any) => setError(err.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-white">สร้าง Purchase Order</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">รหัส Supplier</label>
            <input className="input" placeholder="SUP-001"
              value={form.supplierCode}
              onChange={e => setForm(f => ({ ...f, supplierCode: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">ชื่อ Supplier</label>
            <input className="input" placeholder="บริษัท ABC จำกัด"
              value={form.supplierName}
              onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">วันที่คาดว่าจะได้รับ</label>
          <input type="date" className="input"
            value={form.expectedDate}
            onChange={e => setForm(f => ({ ...f, expectedDate: e.target.value }))} />
        </div>

        {/* Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-400">รายการสั่งซื้อ</label>
            <button onClick={addItem} className="text-xs text-sky-400 hover:text-sky-300">
              + เพิ่มรายการ
            </button>
          </div>
          {items.map((item, idx) => (
            <div key={idx} className="bg-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">รายการที่ {idx + 1}</span>
                {items.length > 1 && (
                  <button onClick={() => removeItem(idx)} className="text-xs text-red-400 hover:text-red-300">
                    ลบ
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className="input text-xs" placeholder="รหัสวัตถุดิบ"
                  value={item.materialCode}
                  onChange={e => updateItem(idx, 'materialCode', e.target.value)} />
                <input className="input text-xs" placeholder="ชื่อวัตถุดิบ"
                  value={item.materialName}
                  onChange={e => updateItem(idx, 'materialName', e.target.value)} />
                <input type="number" className="input text-xs" placeholder="จำนวน"
                  value={item.quantity}
                  onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                <select className="input text-xs"
                  value={item.unit}
                  onChange={e => updateItem(idx, 'unit', e.target.value)}>
                  {['kg', 'g', 'pack', 'box', 'ลัง'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">หมายเหตุ</label>
          <input className="input" placeholder="หมายเหตุ (ไม่บังคับ)"
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
        </div>

        <div className="bg-slate-800 rounded-xl px-4 py-2 text-xs text-slate-400">
          ผู้สร้าง: <span className="text-sky-400">{user?.name}</span>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-ghost flex-1">ยกเลิก</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="btn-primary flex-1"
          >
            {mutation.isPending ? 'กำลังสร้าง...' : 'สร้าง PO'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PO Detail + Actions ───────────────────────────────
function PODetail({ po, onClose, onRefresh }: {
  po: PoDocument; onClose: () => void; onRefresh: () => void
}) {
  const [error, setError] = useState('')

  const action = useMutation({
    mutationFn: (endpoint: string) => api.patch(endpoint),
    onSuccess: () => { onRefresh(); onClose() },
    onError: (err: any) => setError(err.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const FLOW = [
    { status: 'PENDING',  label: 'รออนุมัติ' },
    { status: 'APPROVED', label: 'อนุมัติ' },
    { status: 'SHIPPED',  label: 'ส่งของแล้ว' },
    { status: 'RECEIVED', label: 'รับของแล้ว' },
  ]
  const currentIdx = FLOW.findIndex(f => f.status === po.status)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-sky-400 text-sm">{po.poNo}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {po.supplierName} ({po.supplierCode})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={STATUS_BADGE[po.status]}>{STATUS_TH[po.status]}</span>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
          </div>
        </div>

        {/* Progress */}
        {po.status !== 'CANCELLED' && (
          <>
            <div className="flex items-center gap-1">
              {FLOW.map((f, i) => (
                <div key={f.status} className="flex items-center gap-1 flex-1">
                  <div className={`flex-1 h-1.5 rounded-full ${
                    i <= currentIdx ? 'bg-sky-500' : 'bg-slate-700'
                  }`} />
                  {i === FLOW.length - 1 && (
                    <div className={`w-2 h-2 rounded-full ${
                      i <= currentIdx ? 'bg-sky-500' : 'bg-slate-700'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 -mt-2">
              {FLOW.map(f => <span key={f.status}>{f.label}</span>)}
            </div>
          </>
        )}

        {/* Info */}
        <div className="text-xs text-slate-400 space-y-1 bg-slate-800 rounded-xl px-4 py-3">
          {po.expectedDate && (
            <p>วันที่คาดรับ: <span className="text-slate-300">
              {new Date(po.expectedDate).toLocaleDateString('th-TH')}
            </span></p>
          )}
          <p>สร้างเมื่อ: <span className="text-slate-300">
            {new Date(po.createdAt).toLocaleString('th-TH')}
          </span></p>
          {po.receivedAt && (
            <p>รับของเมื่อ: <span className="text-emerald-400">
              {new Date(po.receivedAt).toLocaleString('th-TH')}
            </span></p>
          )}
        </div>

        {/* Items */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400">รายการสั่งซื้อ</p>
          {po.items.map(item => (
            <div key={item.id} className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm text-white">{item.materialName}</p>
                <p className="text-xs text-slate-500">{item.materialCode}</p>
              </div>
              <p className="font-mono text-sm text-sky-400">
                {Number(item.quantity).toFixed(3)} {item.unit}
              </p>
            </div>
          ))}
        </div>

        {po.note && (
          <div className="bg-slate-800 rounded-xl px-4 py-3 text-xs text-slate-400">
            หมายเหตุ: {po.note}
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* Action buttons */}
        <div className="space-y-2 pt-2">
          {po.status === 'PENDING' && (
            <>
              <button
                onClick={() => action.mutate(`/api/v1/purchase/po/${po.poNo}/approve`)}
                disabled={action.isPending}
                className="btn-primary w-full"
              >
                ✓ Approve PO
              </button>
              <button
                onClick={() => action.mutate(`/api/v1/purchase/po/${po.poNo}/cancel`)}
                disabled={action.isPending}
                className="btn-danger w-full"
              >
                ✕ ยกเลิก PO
              </button>
            </>
          )}
          {po.status === 'APPROVED' && (
            <button
              onClick={() => action.mutate(`/api/v1/purchase/po/${po.poNo}/shipped`)}
              disabled={action.isPending}
              className="btn-primary w-full"
            >
              🚚 Supplier ส่งของแล้ว
            </button>
          )}
          {po.status === 'SHIPPED' && (
            <button
              onClick={() => action.mutate(`/api/v1/purchase/po/${po.poNo}/received`)}
              disabled={action.isPending}
              className="btn-primary w-full"
            >
              📦 รับของเข้าคลัง
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────
export default function PurchasePage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate]     = useState(false)
  const [selected, setSelected]         = useState<PoDocument | null>(null)
  const [statusFilter, setStatusFilter] = useState('ALL')

  const { data: pos = [], isLoading } = useQuery<PoDocument[]>({
    queryKey: ['pos'],
    queryFn:  () => api.get('/api/v1/purchase/po').then(r => r.data),
    refetchInterval: 10000,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['pos'] })

  const STATUS_FILTERS = ['ALL', 'PENDING', 'APPROVED', 'SHIPPED', 'RECEIVED', 'CANCELLED']

  const filtered = pos.filter(p =>
    statusFilter === 'ALL' ? true : p.status === statusFilter
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">จัดซื้อ (Purchase)</h2>
          <p className="text-sm text-slate-400 mt-1">{pos.length} PO ทั้งหมด</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
          + สร้าง Purchase Order
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              statusFilter === s
                ? 'bg-sky-500/20 border-sky-500 text-sky-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            {s === 'ALL' ? 'ทั้งหมด' : STATUS_TH[s] ?? s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-400">
              <th className="text-left px-4 py-3 font-medium">PO Number</th>
              <th className="text-left px-4 py-3 font-medium">Supplier</th>
              <th className="text-left px-4 py-3 font-medium">รายการ</th>
              <th className="text-left px-4 py-3 font-medium">วันที่คาดรับ</th>
              <th className="text-left px-4 py-3 font-medium">สถานะ</th>
              <th className="text-left px-4 py-3 font-medium">วันที่สร้าง</th>
              <th className="text-left px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-500 animate-pulse">กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-500">ไม่พบ Purchase Orders</td></tr>
            ) : filtered.map(po => (
              <tr key={po.id}
                onClick={() => setSelected(po)}
                className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3 font-mono text-xs text-sky-400">{po.poNo}</td>
                <td className="px-4 py-3">
                  <p className="text-white">{po.supplierName}</p>
                  <p className="text-xs text-slate-500">{po.supplierCode}</p>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {po.items.length} รายการ
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {po.expectedDate
                    ? new Date(po.expectedDate).toLocaleDateString('th-TH')
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={STATUS_BADGE[po.status]}>{STATUS_TH[po.status]}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {new Date(po.createdAt).toLocaleDateString('th-TH')}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-slate-500">ดูรายละเอียด →</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreatePOModal
          onClose={() => setShowCreate(false)}
          onSuccess={refresh}
        />
      )}
      {selected && (
        <PODetail
          po={selected}
          onClose={() => setSelected(null)}
          onRefresh={refresh}
        />
      )}
    </div>
  )
}