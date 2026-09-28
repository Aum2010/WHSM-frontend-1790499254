import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/auth.store'

// ── Types ─────────────────────────────────────────────
interface PoItem {
  materialCode: string
  materialName: string
  quantity: string
  unit: string
}

interface PurchaseOrder {
  id: string
  poNo: string
  supplierCode: string
  supplierName: string
  status: 'PENDING' | 'APPROVED' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED'
  items: PoItem[]
  createdAt: string
}

// วัตถุดิบ 4 รายการสำหรับหมูปิ้งนมสด
const RECIPE_INGREDIENTS = [
  { materialCode: 'RM-PORK-01',  materialName: 'เนื้อหมู',                  unit: 'kg',  defaultQty: 320 },
  { materialCode: 'RM-FAT-01',   materialName: 'มันหมูแข็งบด',               unit: 'kg',  defaultQty: 80  },
  { materialCode: 'RM-SAUCE-01', materialName: 'ชุดซอสหมักสำเร็จรูป',        unit: 'kg',  defaultQty: 25  },
  { materialCode: 'RM-CHEM-01',  materialName: 'Sodium metabisulphite',      unit: 'kg',  defaultQty: 0.2 },
]

const SUPPLIERS = [
  { code: 'SUP-001', name: 'บริษัท เนื้อสดไทย จำกัด' },
  { code: 'SUP-002', name: 'บริษัท วัตถุดิบอาหาร จำกัด' },
  { code: 'SUP-003', name: 'ห้างหุ้นส่วน เคมีภัณฑ์อาหาร' },
]

const PO_STATUS_BADGE: Record<string, string> = {
  PENDING:   'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  APPROVED:  'bg-sky-500/20 text-sky-400 border border-sky-500/30',
  SHIPPED:   'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  RECEIVED:  'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  CANCELLED: 'bg-slate-700 text-slate-500',
}

const PO_STATUS_LABEL: Record<string, string> = {
  PENDING:   'รอดำเนินการ',
  APPROVED:  'อนุมัติแล้ว',
  SHIPPED:   'จัดส่งแล้ว',
  RECEIVED:  'รับครบแล้ว',
  CANCELLED: 'ยกเลิก',
}

// ── Create PO Modal ────────────────────────────────────
function CreatePoModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuthStore()
  const [supplierCode, setSupplierCode] = useState(SUPPLIERS[0].code)
  const [supplierName, setSupplierName] = useState(SUPPLIERS[0].name)
  const [customSupplier, setCustomSupplier] = useState(false)
  const [items, setItems] = useState(
    RECIPE_INGREDIENTS.map(ing => ({ ...ing, quantity: ing.defaultQty.toString(), selected: true }))
  )
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post('/api/v1/purchase/po', {
      supplierCode,
      supplierName,
      createdBy: user?.id,
      items: items
        .filter(i => i.selected && Number(i.quantity) > 0)
        .map(i => ({ materialCode: i.materialCode, materialName: i.materialName, quantity: Number(i.quantity), unit: i.unit })),
    }),
    onSuccess: () => { onSuccess(); onClose() },
    onError: (err: any) => setError(err.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const handleSupplierSelect = (code: string) => {
    const sup = SUPPLIERS.find(s => s.code === code)
    if (sup) { setSupplierCode(sup.code); setSupplierName(sup.name) }
    setCustomSupplier(false)
  }

  const selectedCount = items.filter(i => i.selected).length

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">🛒 สร้างใบสั่งซื้อ (PO)</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        {/* Supplier */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-400">ผู้จำหน่าย</label>
          <div className="flex flex-wrap gap-2">
            {SUPPLIERS.map(sup => (
              <button
                key={sup.code}
                onClick={() => handleSupplierSelect(sup.code)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                  supplierCode === sup.code && !customSupplier
                    ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                }`}
              >
                {sup.name}
              </button>
            ))}
            <button
              onClick={() => { setCustomSupplier(true); setSupplierCode(''); setSupplierName('') }}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                customSupplier
                  ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
              }`}
            >
              + อื่นๆ
            </button>
          </div>
          {customSupplier && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <input className="input text-sm" placeholder="รหัสผู้จำหน่าย" value={supplierCode} onChange={e => setSupplierCode(e.target.value)} />
              <input className="input text-sm" placeholder="ชื่อผู้จำหน่าย" value={supplierName} onChange={e => setSupplierName(e.target.value)} />
            </div>
          )}
        </div>

        {/* Items */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-400">วัตถุดิบ ({selectedCount} รายการ)</label>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={item.materialCode}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  item.selected
                    ? 'bg-slate-800/80 border-slate-600'
                    : 'bg-slate-900/50 border-slate-800 opacity-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, selected: e.target.checked } : it))}
                  className="w-4 h-4 rounded accent-sky-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.materialName}</p>
                  <p className="text-xs text-slate-500">{item.materialCode}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    className="input w-24 text-sm text-right"
                    value={item.quantity}
                    disabled={!item.selected}
                    onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: e.target.value } : it))}
                  />
                  <span className="text-xs text-slate-400 w-6">{item.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn-ghost flex-1">ยกเลิก</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || selectedCount === 0}
            className="btn-primary flex-1"
          >
            {mutation.isPending ? 'กำลังสร้าง...' : `สร้าง PO (${selectedCount} รายการ)`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Receive PO Modal ───────────────────────────────────
function ReceivePoModal({ po, onClose, onSuccess }: { po: PurchaseOrder; onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuthStore()
  const [receivedQtys, setReceivedQtys] = useState<Record<string, string>>(
    Object.fromEntries(po.items.map(item => [item.materialCode, item.quantity]))
  )
  const [location, setLocation] = useState('Zone-RM-01')
  const [expiryDate, setExpiryDate] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      // Step 1: mark PO as RECEIVED
      await api.patch(`/api/v1/purchase/po/${po.poNo}/received`)
      // Step 2: สร้าง StockLot ทีละ item ผ่าน RO
      for (const item of po.items) {
        const qty = Number(receivedQtys[item.materialCode] ?? item.quantity)
        if (qty <= 0) continue
        await api.post('/api/v1/inventory/ro', {
          materialCode: item.materialCode,
          materialName: item.materialName,
          quantity: qty,
          unit: item.unit,
          location,
          receivedBy: user?.id ?? '',
          poNo: po.poNo,
          supplierCode: po.supplierCode,
          expiryDate: expiryDate || undefined,
        })
      }
    },
    onSuccess: () => { onSuccess(); onClose() },
    onError: (err: any) => setError(err.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">📦 รับสินค้า</h3>
            <p className="text-xs text-slate-400 mt-0.5">{po.poNo} · {po.supplierName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        {/* Location + Expiry */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">สถานที่จัดเก็บ</label>
            <select className="input text-sm" value={location} onChange={e => setLocation(e.target.value)}>
              {['Zone-RM-01', 'Chill-Room-01', 'DC01', 'Quarantine'].map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">วันหมดอายุ (ถ้ามี)</label>
            <input type="date" className="input text-sm" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
          </div>
        </div>

        {/* Items */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-400">จำนวนที่รับจริง</label>
          {po.items.map(item => (
            <div key={item.materialCode} className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-xl border border-slate-700">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{item.materialName}</p>
                <p className="text-xs text-slate-500">สั่ง: {item.quantity} {item.unit}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="input w-24 text-sm text-right"
                  value={receivedQtys[item.materialCode] ?? item.quantity}
                  onChange={e => setReceivedQtys(prev => ({ ...prev, [item.materialCode]: e.target.value }))}
                />
                <span className="text-xs text-slate-400 w-6">{item.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn-ghost flex-1">ยกเลิก</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary flex-1">
            {mutation.isPending ? 'กำลังบันทึก...' : '✅ ยืนยันรับสินค้า'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Quick Order Bot ────────────────────────────────────
function QuickOrderBot({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuthStore()
  const [step, setStep] = useState<'confirm' | 'loading' | 'done' | 'error'>('confirm')
  const [result, setResult] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const run = async () => {
    setStep('loading')
    try {
      // สั่งซื้อ 4 รายการสำหรับ 1 batch หมูปิ้งนมสด (ปริมาณ 1 batch = 400 kg)
      const res = await api.post('/api/v1/purchase/po', {
        supplierCode: 'SUP-001',
        supplierName: 'บริษัท เนื้อสดไทย จำกัด',
        createdBy: user?.id,
        items: RECIPE_INGREDIENTS.map(ing => ({
          materialCode: ing.materialCode,
          materialName: ing.materialName,
          quantity: ing.defaultQty,
          unit: ing.unit,
        })),
      })
      setResult(res.data)
      setStep('done')
      onSuccess()
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'เกิดข้อผิดพลาด')
      setStep('error')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md space-y-4">
        {step === 'confirm' && (
          <>
            <div className="text-center space-y-2">
              <div className="text-4xl">🤖</div>
              <h3 className="text-lg font-bold text-white">Auto-Order Bot</h3>
              <p className="text-sm text-slate-400">สั่งซื้อวัตถุดิบครบชุดสำหรับ 1 batch<br /><span className="text-sky-400 font-medium">หมูปิ้งนมสด</span></p>
            </div>
            <div className="bg-slate-800/60 rounded-xl border border-slate-700 overflow-hidden">
              {RECIPE_INGREDIENTS.map((ing, i) => (
                <div key={ing.materialCode} className={`flex items-center justify-between px-4 py-3 ${i < RECIPE_INGREDIENTS.length - 1 ? 'border-b border-slate-700' : ''}`}>
                  <div>
                    <p className="text-sm text-white">{ing.materialName}</p>
                    <p className="text-xs text-slate-500">{ing.materialCode}</p>
                  </div>
                  <span className="text-sm font-mono text-sky-400">{ing.defaultQty} {ing.unit}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-ghost flex-1">ยกเลิก</button>
              <button onClick={run} className="btn-primary flex-1">🚀 สั่งซื้อเลย!</button>
            </div>
          </>
        )}

        {step === 'loading' && (
          <div className="text-center py-8 space-y-3">
            <div className="text-4xl animate-spin">⚙️</div>
            <p className="text-slate-400">กำลังสร้างใบสั่งซื้อ...</p>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center space-y-4">
            <div className="text-4xl">✅</div>
            <div>
              <h3 className="text-lg font-bold text-white">สร้าง PO สำเร็จ!</h3>
              {result?.poNo && <p className="text-sky-400 font-mono text-sm mt-1">{result.poNo}</p>}
            </div>
            <p className="text-sm text-slate-400">ใบสั่งซื้อถูกสร้างแล้ว รอผู้จำหน่ายจัดส่ง</p>
            <button onClick={onClose} className="btn-primary w-full">เสร็จสิ้น</button>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center space-y-4">
            <div className="text-4xl">❌</div>
            <h3 className="text-lg font-bold text-white">เกิดข้อผิดพลาด</h3>
            <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{errorMsg}</p>
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-ghost flex-1">ปิด</button>
              <button onClick={() => setStep('confirm')} className="btn-primary flex-1">ลองใหม่</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────
export default function PurchasePage() {
  const [showCreate, setShowCreate] = useState(false)
  const [showBot, setShowBot] = useState(false)
  const [receivingPo, setReceivingPo] = useState<PurchaseOrder | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const queryClient = useQueryClient()

  const { data: orders = [], isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchase-orders'],
    queryFn: () => api.get('/api/v1/purchase/po').then(r => r.data),
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })

  const approveMutation = useMutation({
    mutationFn: (poNo: string) => api.patch(`/api/v1/purchase/po/${poNo}/approve`),
    onSuccess: refresh,
  })

  const shippedMutation = useMutation({
    mutationFn: (poNo: string) => api.patch(`/api/v1/purchase/po/${poNo}/shipped`),
    onSuccess: refresh,
  })

  const cancelMutation = useMutation({
    mutationFn: (poNo: string) => api.patch(`/api/v1/purchase/po/${poNo}/cancel`),
    onSuccess: refresh,
  })

  const filtered = statusFilter === 'ALL' ? orders : orders.filter(o => o.status === statusFilter)

  const stats = {
    total:    orders.length,
    pending:  orders.filter(o => o.status === 'PENDING').length,
    received: orders.filter(o => o.status === 'RECEIVED').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">จัดซื้อ (Purchase)</h1>
          <p className="text-sm text-slate-400 mt-0.5">ใบสั่งซื้อวัตถุดิบ · หมูปิ้งนมสด</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setShowBot(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-all text-sm font-medium"
          >
            🤖 Auto-Order
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
            + สร้าง PO
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'PO ทั้งหมด',      value: stats.total,    color: 'text-white' },
          { label: 'รอรับสินค้า',      value: stats.pending,  color: 'text-yellow-400' },
          { label: 'รับครบแล้ว',       value: stats.received, color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="card text-center py-4">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {['ALL', 'PENDING', 'APPROVED', 'SHIPPED', 'RECEIVED', 'CANCELLED'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
              statusFilter === s
                ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
            }`}
          >
            {s === 'ALL' ? 'ทั้งหมด' : PO_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400">กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16 space-y-3">
          <div className="text-4xl">📋</div>
          <p className="text-slate-400">ยังไม่มีใบสั่งซื้อ</p>
          <button onClick={() => setShowBot(true)} className="btn-primary mx-auto">
            🤖 สั่งซื้อชุดหมูปิ้งนมสด
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(po => (
            <div key={po.id} className="card space-y-3">
              {/* PO header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sky-400 font-medium text-sm">{po.poNo}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-md ${PO_STATUS_BADGE[po.status]}`}>
                      {PO_STATUS_LABEL[po.status]}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-0.5">{po.supplierName}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {new Date(po.createdAt).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {po.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => approveMutation.mutate(po.poNo)}
                        disabled={approveMutation.isPending}
                        className="px-3 py-1.5 rounded-lg text-xs bg-sky-500/20 text-sky-400 border border-sky-500/30 hover:bg-sky-500/30 transition-all"
                      >
                        ✅ อนุมัติ
                      </button>
                      <button
                        onClick={() => { if (confirm('ยืนยันยกเลิก PO?')) cancelMutation.mutate(po.poNo) }}
                        className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                      >
                        ยกเลิก
                      </button>
                    </>
                  )}
                  {po.status === 'APPROVED' && (
                    <>
                      <button
                        onClick={() => shippedMutation.mutate(po.poNo)}
                        disabled={shippedMutation.isPending}
                        className="px-3 py-1.5 rounded-lg text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-all"
                      >
                        🚚 Supplier ส่งแล้ว
                      </button>
                      <button
                        onClick={() => { if (confirm('ยืนยันยกเลิก PO?')) cancelMutation.mutate(po.poNo) }}
                        className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                      >
                        ยกเลิก
                      </button>
                    </>
                  )}
                  {po.status === 'SHIPPED' && (
                    <button
                      onClick={() => setReceivingPo(po)}
                      className="px-3 py-1.5 rounded-lg text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
                    >
                      📦 รับสินค้า
                    </button>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700/50">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">วัตถุดิบ</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-slate-500">จำนวนสั่ง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.items.map((item, i) => (
                      <tr key={item.materialCode} className={i < po.items.length - 1 ? 'border-b border-slate-700/50' : ''}>
                        <td className="px-3 py-2.5">
                          <p className="text-white">{item.materialName}</p>
                          <p className="text-xs text-slate-500">{item.materialCode}</p>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-sky-300">
                          {item.quantity} {item.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate   && <CreatePoModal   onClose={() => setShowCreate(false)}   onSuccess={refresh} />}
      {showBot      && <QuickOrderBot   onClose={() => setShowBot(false)}       onSuccess={refresh} />}
      {receivingPo  && <ReceivePoModal  po={receivingPo} onClose={() => setReceivingPo(null)} onSuccess={refresh} />}
    </div>
  )
}