import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../stores/auth.store'
import { api } from '../../lib/api'

interface SoItem {
  id: string
  materialCode: string
  materialName: string
  quantity: string
  unit: string
  lotNo: string | null
}

interface SoDocument {
  id: string
  soNo: string
  orderType: 'GENERAL' | 'MTO' | 'MTS'
  status: 'PENDING' | 'CONFIRMED' | 'IN_PRODUCTION' | 'READY' | 'PAID' | 'SHIPPED' | 'CANCELLED'
  customerId: string | null
  createdBy: string
  confirmedBy: string | null
  confirmedAt: string | null
  paidAt: string | null
  shippedAt: string | null
  note: string | null
  createdAt: string
  items: SoItem[]
}

const STATUS_BADGE: Record<string, string> = {
  PENDING:       'badge-yellow',
  CONFIRMED:     'badge-sky',
  IN_PRODUCTION: 'badge-sky',
  READY:         'badge-green',
  PAID:          'badge-green',
  SHIPPED:       'badge-green',
  CANCELLED:     'bg-slate-700 text-slate-400 px-2.5 py-1 rounded-lg text-xs',
}

const STATUS_TH: Record<string, string> = {
  PENDING:       'รอดำเนินการ',
  CONFIRMED:     'ยืนยันแล้ว',
  IN_PRODUCTION: 'กำลังผลิต',
  READY:         'พร้อมจัดส่ง',
  PAID:          'ชำระแล้ว',
  SHIPPED:       'จัดส่งแล้ว',
  CANCELLED:     'ยกเลิก',
}

// ── Modal: สร้าง SO ───────────────────────────────────
function CreateSOModal({ onClose, onSuccess }: {
  onClose: () => void; onSuccess: () => void
}) {
  const { user } = useAuthStore()
  const [form, setForm] = useState({
    orderType: 'GENERAL',
    customerId: '',
    note: '',
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
    mutationFn: () => api.post('/api/v1/order/so', {
      ...form,
      items: items.map(i => ({ ...i, quantity: Number(i.quantity) })),
    }),
    onSuccess: () => { onSuccess(); onClose() },
    onError: (err: any) => setError(err.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-white">สร้าง Sale Order</h3>

        {/* Order type */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">ประเภท Order</label>
          <div className="flex gap-2">
            {[
              { val: 'GENERAL', label: 'General' },
              { val: 'MTO',     label: 'Made to Order' },
              { val: 'MTS',     label: 'Made to Stock' },
            ].map(({ val, label }) => (
              <button
                key={val}
                onClick={() => setForm(f => ({ ...f, orderType: val }))}
                className={`flex-1 py-2.5 rounded-xl text-xs font-medium border transition-colors ${
                  form.orderType === val
                    ? 'bg-sky-500/20 border-sky-500 text-sky-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">ลูกค้า</label>
          <input className="input" placeholder="ชื่อลูกค้า / รหัสลูกค้า"
            value={form.customerId}
            onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))} />
        </div>

        {/* Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-400">รายการสินค้า</label>
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
                <input className="input text-xs" placeholder="รหัสสินค้า"
                  value={item.materialCode}
                  onChange={e => updateItem(idx, 'materialCode', e.target.value)} />
                <input className="input text-xs" placeholder="ชื่อสินค้า"
                  value={item.materialName}
                  onChange={e => updateItem(idx, 'materialName', e.target.value)} />
                <input className="input text-xs" placeholder="จำนวน" type="number"
                  value={item.quantity}
                  onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                <select className="input text-xs"
                  value={item.unit}
                  onChange={e => updateItem(idx, 'unit', e.target.value)}>
                  {['kg', 'g', 'pack', 'box'].map(u => <option key={u}>{u}</option>)}
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
            {mutation.isPending ? 'กำลังสร้าง...' : 'สร้าง SO'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SO Detail + Actions ───────────────────────────────
function SODetail({ so, onClose, onRefresh }: {
  so: SoDocument; onClose: () => void; onRefresh: () => void
}) {
  const { user } = useAuthStore()
  const [error, setError] = useState('')

  const action = useMutation({
    mutationFn: (endpoint: string) => api.patch(endpoint,
      endpoint.includes('confirm') ? { confirmedBy: user?.id } : undefined
    ),
    onSuccess: () => { onRefresh(); onClose() },
    onError: (err: any) => setError(err.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const FLOW = [
    { status: 'PENDING',       label: 'รอดำเนินการ' },
    { status: 'CONFIRMED',     label: 'ยืนยันแล้ว' },
    { status: 'IN_PRODUCTION', label: 'กำลังผลิต' },
    { status: 'PAID',          label: 'ชำระแล้ว' },
    { status: 'SHIPPED',       label: 'จัดส่งแล้ว' },
  ]
  const currentIdx = FLOW.findIndex(f => f.status === so.status)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-sky-400 text-sm">{so.soNo}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {so.customerId || '—'} | {so.orderType}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={STATUS_BADGE[so.status]}>{STATUS_TH[so.status]}</span>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
          </div>
        </div>

        {/* Progress */}
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

        {/* Items */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400">รายการสินค้า</p>
          {so.items.map(item => (
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

        {/* Timestamps */}
        <div className="text-xs text-slate-500 space-y-1">
          <p>สร้าง: {new Date(so.createdAt).toLocaleString('th-TH')}</p>
          {so.confirmedAt && <p>ยืนยัน: {new Date(so.confirmedAt).toLocaleString('th-TH')}</p>}
          {so.paidAt      && <p>ชำระ: {new Date(so.paidAt).toLocaleString('th-TH')}</p>}
          {so.shippedAt   && <p>จัดส่ง: {new Date(so.shippedAt).toLocaleString('th-TH')}</p>}
        </div>

        {so.note && (
          <div className="bg-slate-800 rounded-xl px-4 py-3 text-xs text-slate-400">
            หมายเหตุ: {so.note}
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* Action buttons */}
        <div className="space-y-2 pt-2">
          {so.status === 'PENDING' && (
            <button
              onClick={() => action.mutate(`/api/v1/order/so/${so.soNo}/confirm`)}
              disabled={action.isPending}
              className="btn-primary w-full"
            >
              ✓ WH Confirm SO
            </button>
          )}
          {so.status === 'CONFIRMED' && so.orderType === 'MTO' && (
            <button
              onClick={() => action.mutate(`/api/v1/order/so/${so.soNo}/production`)}
              disabled={action.isPending}
              className="btn-primary w-full"
            >
              🏭 ส่งไปผลิต (MTO)
            </button>
          )}
          {['CONFIRMED', 'READY'].includes(so.status) && (
            <button
              onClick={() => action.mutate(`/api/v1/order/so/${so.soNo}/payment`)}
              disabled={action.isPending}
              className="btn-primary w-full"
            >
              💰 ยืนยันชำระเงิน
            </button>
          )}
          {so.status === 'PAID' && (
            <button
              onClick={() => action.mutate(`/api/v1/order/so/${so.soNo}/ship`)}
              disabled={action.isPending}
              className="btn-primary w-full"
            >
              🚚 จัดส่งสินค้า
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────
export default function OrderPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate]     = useState(false)
  const [selected, setSelected]         = useState<SoDocument | null>(null)
  const [statusFilter, setStatusFilter] = useState('ALL')

  const { data: orders = [], isLoading } = useQuery<SoDocument[]>({
    queryKey: ['orders'],
    queryFn:  () => api.get('/api/v1/order/so').then(r => r.data),
    refetchInterval: 10000,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['orders'] })

  const STATUS_FILTERS = ['ALL', 'PENDING', 'CONFIRMED', 'IN_PRODUCTION', 'PAID', 'SHIPPED']

  const filtered = orders.filter(o =>
    statusFilter === 'ALL' ? true : o.status === statusFilter
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Order / ขาย</h2>
          <p className="text-sm text-slate-400 mt-1">{orders.length} orders ทั้งหมด</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
          + สร้าง Sale Order
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
              <th className="text-left px-4 py-3 font-medium">SO Number</th>
              <th className="text-left px-4 py-3 font-medium">ลูกค้า</th>
              <th className="text-left px-4 py-3 font-medium">ประเภท</th>
              <th className="text-left px-4 py-3 font-medium">รายการ</th>
              <th className="text-left px-4 py-3 font-medium">สถานะ</th>
              <th className="text-left px-4 py-3 font-medium">วันที่</th>
              <th className="text-left px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-500 animate-pulse">กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-500">ไม่พบ orders</td></tr>
            ) : filtered.map(so => (
              <tr key={so.id}
                onClick={() => setSelected(so)}
                className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3 font-mono text-xs text-sky-400">{so.soNo}</td>
                <td className="px-4 py-3 text-slate-300">{so.customerId || '—'}</td>
                <td className="px-4 py-3">
                  <span className="badge-sky">{so.orderType}</span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {so.items.length} รายการ
                </td>
                <td className="px-4 py-3">
                  <span className={STATUS_BADGE[so.status]}>{STATUS_TH[so.status]}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {new Date(so.createdAt).toLocaleDateString('th-TH')}
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
        <CreateSOModal
          onClose={() => setShowCreate(false)}
          onSuccess={refresh}
        />
      )}
      {selected && (
        <SODetail
          so={selected}
          onClose={() => setSelected(null)}
          onRefresh={refresh}
        />
      )}
    </div>
  )
}