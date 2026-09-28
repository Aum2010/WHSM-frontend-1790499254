import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../stores/auth.store'
import { api } from '../../lib/api'
import BarcodeGenerator from '../../components/BarcodeGenerator'

// ── Types ─────────────────────────────────────────────
interface StockLot {
  id: string; rmNo: string; materialCode: string; materialName: string
  quantity: string; remainingQty: string; unit: string
  location: string; status: string; expiryDate: string | null
  holdReason: string | null; poNo: string | null; supplierCode: string | null
}
interface StockTransaction {
  id: string; rmNo: string; transactionType: string
  documentNo: string; quantity: string; unit: string
  fromLocation: string | null; toLocation: string | null
  performedBy: string; createdAt: string
  lot: { materialName: string; materialCode: string; poNo: string | null }
}

interface PoDocument {
  id: string; poNo: string; supplierCode: string; supplierName: string
  status: string; items: { materialCode: string; materialName: string; quantity: string; unit: string }[]
}

// ── Constants ─────────────────────────────────────────
const LOCATIONS = ['Zone-RM-01', 'Zone-FG-01', 'MES-Line-01', 'Chill-Room-01', 'DC01', 'Quarantine']

const TX_BADGE: Record<string, { label: string; cls: string }> = {
  RO: { label: 'RECEIVED', cls: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  RM: { label: 'REQUISITION', cls: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
  FGT: { label: 'TRANSFER', cls: 'bg-sky-500/20 text-sky-400 border border-sky-500/30' },
  SO_DISPATCH: { label: 'DISPATCH', cls: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
  RETURN_WHRM: { label: 'RETURN', cls: 'bg-slate-500/20 text-slate-400 border border-slate-500/30' },
  REWORK: { label: 'REWORK', cls: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
}

const LOT_STATUS_BADGE: Record<string, string> = {
  AVAILABLE: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  HOLD: 'bg-red-500/10 text-red-400 border border-red-500/20',
  REWORK: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  CONSUMED: 'bg-slate-700 text-slate-500',
}

function LotDetailModal({ lot, onClose, onSuccess }: {
  lot: StockLot; onClose: () => void; onSuccess: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [showBarcode, setShowBarcode] = useState(false)
  const [form, setForm] = useState({
    materialName: lot.materialName,
    materialCode: lot.materialCode,
    location: lot.location,
    expiryDate: lot.expiryDate ? lot.expiryDate.slice(0, 10) : '',
    supplierCode: lot.supplierCode ?? '',
    poNo: lot.poNo ?? '',
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.patch(
      `/api/v1/inventory/lots/${lot.rmNo}`, form
    ),
    onSuccess: () => { onSuccess(); setEditing(false) },
    onError: (err: any) => setError(err.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const handleCancel = () => {
    if (!confirm(`ยืนยันยกเลิก Lot ${lot.rmNo}?\nจะถูก mark เป็น EXPIRED และซ่อนจาก list`)) return
    api.patch(`/api/v1/inventory/lots/${lot.rmNo}`, { status: 'EXPIRED' })
      .then(() => onSuccess())
      .catch((err: any) => alert(err.response?.data?.message || 'เกิดข้อผิดพลาด'))
  }

  // barcode screen
  if (showBarcode) return (
    <div className="card w-full max-w-md space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">พิมพ์ Barcode</h3>
        <button onClick={() => setShowBarcode(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
      </div>
      <BarcodeGenerator
        value={lot.rmNo}
        label={lot.materialName}
        sublabel={`${lot.materialCode} | ${lot.location} | ${Number(lot.remainingQty).toFixed(3)} ${lot.unit}`}
        onDownload={() => setShowBarcode(false)}
      />
      {lot.status === 'CONSUMED' && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 text-xs text-yellow-400">
          ⚠ Lot นี้ถูกใช้ไปแล้วในการผลิต ใช้ barcode นี้แปะถุงที่เข้า batch
        </div>
      )}
      <button onClick={() => setShowBarcode(false)} className="btn-ghost w-full text-sm">กลับ</button>
    </div>
  )

  return (
    <div className="card w-full max-w-md space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">รายละเอียด Lot</h3>
        <div className="flex items-center gap-2">
          {!editing && (
            <>
              <button
                onClick={() => setShowBarcode(true)}
                className="text-xs text-amber-400 hover:text-amber-300 border border-amber-500/30 px-3 py-1 rounded-lg"
              >
                🏷 Barcode
              </button>
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-sky-400 hover:text-sky-300 border border-sky-500/30 px-3 py-1 rounded-lg"
              >
                แก้ไข
              </button>
            </>
          )}
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          {[
            { label: 'ชื่อวัตถุดิบ', key: 'materialName' },
            { label: 'รหัสวัตถุดิบ', key: 'materialCode' },
            { label: 'Supplier', key: 'supplierCode' },
            { label: 'PO อ้างอิง', key: 'poNo' },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
              <input className="input" value={form[key as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Location</label>
            <select className="input" value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}>
              {LOCATIONS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">วันหมดอายุ</label>
            <input type="date" className="input" value={form.expiryDate}
              onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
          </div>

          <div className="bg-slate-800 rounded-xl px-4 py-3 text-xs space-y-1 text-slate-400">
            <p>รหัสสินค้า: <span className="text-slate-300 font-mono">{lot.rmNo}</span></p>
            <p>จำนวนคงเหลือ: <span className="text-white">{Number(lot.remainingQty).toFixed(3)} {lot.unit}</span></p>
            <p className="text-[10px] text-slate-600">* จำนวนและ รหัสสินค้า แก้ไขไม่ได้</p>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3">
            <button onClick={() => { setEditing(false); setError('') }} className="btn-ghost flex-1">
              ยกเลิก
            </button>
            <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary flex-1">
              {mutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          {[
            { label: 'RM Number', value: lot.rmNo },
            { label: 'วัตถุดิบ', value: `${lot.materialName} (${lot.materialCode})` },
            { label: 'คงเหลือ', value: `${Number(lot.remainingQty).toFixed(3)} ${lot.unit}` },
            { label: 'รวม', value: `${Number(lot.quantity).toFixed(3)} ${lot.unit}` },
            { label: 'Location', value: lot.location },
            { label: 'PO อ้างอิง', value: lot.poNo ?? '—' },
            { label: 'Supplier', value: lot.supplierCode ?? '—' },
            { label: 'สถานะ', value: lot.status },
            { label: 'หมดอายุ', value: lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString('th-TH') : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">{label}</span>
              <span className="text-white font-medium">{value}</span>
            </div>
          ))}

          {lot.status === 'CONSUMED' && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 space-y-2">
              <p className="text-slate-300 text-xs font-medium">📦 Lot นี้ถูกเบิกเข้า Batch แล้ว</p>
              <p className="text-slate-500 text-xs">กด Barcode เพื่อพิมพ์ label แปะถุงวัตถุดิบที่ส่งเข้าสายการผลิต</p>
              <button onClick={() => setShowBarcode(true)} className="btn-primary w-full text-xs">
                🏷 พิมพ์ Barcode สำหรับถุงที่เข้า Batch
              </button>
            </div>
          )}

          {lot.status === 'HOLD' && lot.holdReason && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <p className="text-red-400 text-xs font-medium">เหตุผลที่กักกัน</p>
              <p className="text-red-300 text-sm mt-1">{lot.holdReason}</p>
            </div>
          )}

          {lot.status === 'AVAILABLE' &&
            Number(lot.remainingQty) === Number(lot.quantity) && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 space-y-2">
                <p className="text-yellow-400 text-xs font-medium">⚠ พิมพ์ รหัสสินค้า ผิด?</p>
                <p className="text-slate-400 text-xs">
                  รหัสสินค้า แก้ตรงๆ ไม่ได้เพราะผูกกับ transaction history
                  กด "ยกเลิก Lot" แล้วสร้าง RO ใหม่ด้วยเลขที่ถูกต้อง
                </p>
                <button onClick={handleCancel} className="btn-danger w-full text-xs">
                  ยกเลิก Lot นี้ (Mark EXPIRED)
                </button>
              </div>
            )}

          <button onClick={onClose} className="btn-ghost w-full">ปิด</button>
        </div>
      )}
    </div>
  )
}

// ── Modal: RO รับสินค้าเข้าจาก PO ───────────────────
function CreateROModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuthStore()
  const [form, setForm] = useState({
    materialCode: '', materialName: '',
    quantity: '', unit: 'kg', location: 'Zone-RM-01',
    receivedBy: user?.id ?? '', expiryDate: '',
    poNo: '', supplierCode: '',
  })
  const [error, setError] = useState('')
  const [createdRmNo, setCreatedRmNo] = useState('')

  const { data: pos = [] } = useQuery<PoDocument[]>({
    queryKey: ['pos-received'],
    queryFn: () => api.get('/api/v1/purchase/po').then(r =>
      r.data.filter((p: PoDocument) => ['RECEIVED', 'SHIPPED'].includes(p.status))
    ),
  })

  const selectPO = (poNo: string) => {
    const po = pos.find(p => p.poNo === poNo)
    if (!po) return
    setForm(f => ({
      ...f,
      poNo: po.poNo,
      supplierCode: po.supplierCode,
      materialCode: po.items[0]?.materialCode ?? '',
      materialName: po.items[0]?.materialName ?? '',
      unit: po.items[0]?.unit ?? 'kg',
    }))
  }

  const mutation = useMutation({
    mutationFn: () => {
      if (!form.materialCode.trim())
        throw new Error('กรุณาระบุรหัสวัตถุดิบ')
      if (!form.materialName.trim())
        throw new Error('กรุณาระบุชื่อวัตถุดิบ')
      if (!form.quantity || Number(form.quantity) <= 0)
        throw new Error('กรุณาระบุจำนวนที่ถูกต้อง')

      return api.post('/api/v1/inventory/ro', {
        ...form, quantity: Number(form.quantity),
      })
    },
    onSuccess: (res) => {
      onSuccess()
      // backend ส่ง rmNo กลับมาใน response
      setCreatedRmNo(res.data?.rmNo ?? res.data?.lot?.rmNo ?? '')
    },
    onError: (err: any) => setError(
      err.message || err.response?.data?.message || 'เกิดข้อผิดพลาด'
    ),
  })

  if (createdRmNo) return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md space-y-4">
        <div className="text-center space-y-1">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white">RO สำเร็จแล้ว</h3>
          <p className="text-xs text-slate-400">Download barcode แล้วปริ้นท์แปะถุงวัตถุดิบ</p>
        </div>
        <BarcodeGenerator
          value={createdRmNo}
          label={form.materialName}
          sublabel={`${form.materialCode} | ${form.location} | ${Number(form.quantity).toFixed(3)} ${form.unit}`}
          onDownload={onClose}
        />
        <button onClick={onClose} className="btn-ghost w-full text-sm">ปิดโดยไม่ download</button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-white">รับสินค้าเข้า (RO)</h3>

        {/* PO selector */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">อ้างอิง PO</label>
          <select className="input" value={form.poNo}
            onChange={e => selectPO(e.target.value)}>
            <option value="">— เลือก PO (ไม่บังคับ) —</option>
            {pos.map(po => (
              <option key={po.poNo} value={po.poNo}>
                {po.poNo} | {po.supplierCode}
              </option>
            ))}
          </select>
        </div>

        {[
          { label: 'รหัสวัตถุดิบ', key: 'materialCode', placeholder: 'RM-PORK-01' },
          { label: 'ชื่อวัตถุดิบ', key: 'materialName', placeholder: 'เนื้อหมู' },
          { label: 'จำนวน', key: 'quantity', placeholder: '0.000', type: 'number' },
          { label: 'วันหมดอายุ', key: 'expiryDate', placeholder: '', type: 'date' },
        ].map(({ label, key, placeholder, type }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
            <input type={type || 'text'} className="input" placeholder={placeholder}
              value={form[key as keyof typeof form]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
          </div>
        ))}

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Location</label>
          <select className="input" value={form.location}
            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}>
            {LOCATIONS.map(l => <option key={l}>{l}</option>)}
          </select>
        </div>

        <div className="bg-slate-800 rounded-xl px-4 py-2 text-xs text-slate-400">
          ผู้รับ: <span className="text-sky-400">{user?.name}</span>
          {form.supplierCode && <span className="ml-3">Supplier: <span className="text-slate-300">{form.supplierCode}</span></span>}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-ghost flex-1">ยกเลิก</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary flex-1">
            {mutation.isPending ? 'กำลังบันทึก...' : 'บันทึก RO'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Modal: FGT โอนย้าย ───────────────────────────────
function CreateFGTModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuthStore()
  const [form, setForm] = useState({
    rmNo: '', quantity: '', unit: 'kg',
    fromLocation: 'Zone-RM-01', toLocation: 'Zone-FG-01',
    performedBy: user?.id ?? '',
  })
  const [lotSearch, setLotSearch] = useState('')
  const [showDrop, setShowDrop] = useState(false)
  const [error, setError] = useState('')

  const { data: lots = [] } = useQuery<StockLot[]>({
    queryKey: ['lots'],
    queryFn: () => api.get('/api/v1/inventory/lots').then(r => r.data),
  })

  const filteredLots = lots.filter(l =>
    l.status === 'AVAILABLE' && (
      l.rmNo.includes(lotSearch) ||
      l.materialName.toLowerCase().includes(lotSearch.toLowerCase()) ||
      l.materialCode.toLowerCase().includes(lotSearch.toLowerCase())
    )
  )

  const selectLot = (lot: StockLot) => {
    setForm(f => ({ ...f, rmNo: lot.rmNo, unit: lot.unit, fromLocation: lot.location }))
    setLotSearch(lot.rmNo)
    setShowDrop(false)
  }

  const mutation = useMutation({
    mutationFn: () => api.post('/api/v1/inventory/fgt', { ...form, quantity: Number(form.quantity) }),
    onSuccess: () => { onSuccess(); onClose() },
    onError: (err: any) => setError(err.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md space-y-4">
        <h3 className="text-lg font-bold text-white">โอนย้ายพิกัด (Transfer)</h3>

        {/* Lot search */}
        <div className="relative">
          <label className="block text-xs font-medium text-slate-400 mb-1">Lot Number</label>
          <input className="input" placeholder="พิมพ์เพื่อค้นหา Lot..."
            value={lotSearch}
            onChange={e => { setLotSearch(e.target.value); setForm(f => ({ ...f, rmNo: '' })); setShowDrop(true) }}
            onFocus={() => setShowDrop(true)} />
          {showDrop && lotSearch && filteredLots.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
              {filteredLots.slice(0, 5).map(lot => (
                <button key={lot.id} onClick={() => selectLot(lot)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0">
                  <p className="font-mono text-xs text-sky-400">{lot.rmNo}</p>
                  <p className="text-sm text-white mt-0.5">{lot.materialName}</p>
                  <p className="text-xs text-slate-400">คงเหลือ: {Number(lot.remainingQty).toFixed(3)} {lot.unit} | {lot.location}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {form.rmNo && (() => {
          const lot = lots.find(l => l.rmNo === form.rmNo)
          return lot ? (
            <div className="bg-slate-800 rounded-xl px-4 py-2 text-xs space-y-1">
              <p className="text-white font-medium">{lot.materialName}</p>
              <p className="text-slate-400">คงเหลือ: <span className="text-emerald-400">{Number(lot.remainingQty).toFixed(3)} {lot.unit}</span></p>
            </div>
          ) : null
        })()}

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">จำนวน</label>
          <input type="number" className="input" placeholder="0.000"
            value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">จาก</label>
            <select className="input" value={form.fromLocation}
              onChange={e => setForm(f => ({ ...f, fromLocation: e.target.value }))}>
              {LOCATIONS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">ไปยัง</label>
            <select className="input" value={form.toLocation}
              onChange={e => setForm(f => ({ ...f, toLocation: e.target.value }))}>
              {LOCATIONS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl px-4 py-2 text-xs text-slate-400">
          ผู้โอนย้าย: <span className="text-sky-400">{user?.name}</span>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-ghost flex-1">ยกเลิก</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.rmNo} className="btn-primary flex-1">
            {mutation.isPending ? 'กำลังโอนย้าย...' : 'โอนย้าย'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Quick Barcode Modal ───────────────────────────────
function QuickBarcodeModal({ lot, onClose }: { lot: StockLot; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">🏷 Barcode</h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{lot.rmNo}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>
        <BarcodeGenerator
          value={lot.rmNo}
          label={lot.materialName}
          sublabel={`${lot.materialCode} | ${lot.location} | ${Number(lot.remainingQty).toFixed(3)} ${lot.unit}`}
          onDownload={onClose}
        />
        <button onClick={onClose} className="btn-ghost w-full text-sm">ปิดโดยไม่ download</button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────
export default function InventoryPage() {
  const qc = useQueryClient()
  const [showRO, setShowRO] = useState(false)
  const [showFGT, setShowFGT] = useState(false)
  const [selected, setSelected] = useState<StockLot | null>(null)
  const [barcodeTarget, setBarcodeTarget] = useState<StockLot | null>(null)
  const [txFilter, setTxFilter] = useState('ALL')
  const [lotFilter, setLotFilter] = useState('')
  const [showExpired, setShowExpired] = useState(false)

  const { data: lots = [], isLoading: lotsLoading } = useQuery<StockLot[]>({
    queryKey: ['lots', showExpired],
    queryFn: () => api.get(
      showExpired
        ? '/api/v1/inventory/lots?status=EXPIRED'
        : '/api/v1/inventory/lots'
    ).then(r => r.data),
    refetchInterval: 10000,
    staleTime: 0,
  })

  const { data: txData, isLoading: txLoading } = useQuery<{ data: StockTransaction[]; total: number }>({
    queryKey: ['transactions', txFilter],
    queryFn: () => api.get(`/api/v1/inventory/transactions${txFilter !== 'ALL' ? `?type=${txFilter}` : ''}`).then(r => r.data),
    refetchInterval: 10000,
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['lots'] })
    qc.invalidateQueries({ queryKey: ['transactions'] })
  }

  const filteredLots = lots.filter(l =>
    (l.rmNo ?? '').includes(lotFilter) ||
    l.materialName.toLowerCase().includes(lotFilter.toLowerCase()) ||
    l.materialCode.toLowerCase().includes(lotFilter.toLowerCase())
  )

  const ACTION_CARDS = [
    {
      no: 1, title: 'Received (รับสินค้าเข้า)', tag: 'INBOUND',
      tagCls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      desc: 'รับวัตถุดิบจาก PO สแกนบาร์โค้ด ติด Label ติดตามอุณหภูมิ',
      btn: '+ บันทึกรับเข้าจาก PO', btnCls: 'btn-primary', onClick: () => setShowRO(true),
    },
    {
      no: 2, title: 'Transfer (โอนย้ายพิกัด)', tag: 'LOCATION',
      tagCls: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
      desc: 'ย้ายสินค้าระหว่าง Bin / Rack / Chill Room / Quarantine Zone',
      btn: '+ ย้ายตำแหน่ง Bin/Zone', btnCls: 'btn-ghost', onClick: () => setShowFGT(true),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">ระบบบริหารจัดการคลังสินค้า (Warehouse Operations Engine)</h2>
        <p className="text-sm text-slate-400 mt-1">ควบคุม 4 งานหลัก: รับเข้า (Received), เบิกเข้าผลิต (Requisition), โอนย้ายพิกัด (Transfer) และ จัดส่งคำสั่งซื้อ (Sale Order)</p>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {ACTION_CARDS.map(card => (
          <div key={card.no} className="card space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-white">{card.title}</p>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-full border font-mono font-bold ${card.tagCls}`}>
                {card.tag}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
            <button onClick={card.onClick} className={`${card.btnCls} w-full text-xs`}>
              {card.btn}
            </button>
          </div>
        ))}
      </div>

      {/* Stock Lots Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-300">
            Stock Lots ({lots.length})
            {showExpired && <span className="ml-2 text-slate-500 font-normal">(EXPIRED)</span>}
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowExpired(v => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${showExpired
                ? 'bg-slate-600 border-slate-500 text-slate-300'
                : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'
                }`}
            >
              {showExpired ? '← กลับ Stock ปกติ' : 'ดู EXPIRED'}
            </button>
            <input
              className="input max-w-xs text-xs py-2"
              placeholder="ค้นหา Lot / วัตถุดิบ..."
              value={lotFilter}
              onChange={e => setLotFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400">
                <th className="text-left px-4 py-3 font-medium">รหัสสินค้า</th>
                <th className="text-left px-4 py-3 font-medium">วัตถุดิบ</th>
                <th className="text-left px-4 py-3 font-medium">คงเหลือ / รวม</th>
                <th className="text-left px-4 py-3 font-medium">Location</th>
                <th className="text-left px-4 py-3 font-medium">PO อ้างอิง</th>
                <th className="text-left px-4 py-3 font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {lotsLoading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500 animate-pulse">กำลังโหลด...</td></tr>
              ) : filteredLots.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">ไม่พบข้อมูล</td></tr>
              ) : filteredLots.map(lot => (
                <tr key={lot.id} onClick={() => setSelected(lot)}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-sky-400">{lot.rmNo}</span>
                      <button
                        onClick={e => { e.stopPropagation(); setBarcodeTarget(lot) }}
                        title="พิมพ์ Barcode"
                        className="text-slate-600 hover:text-amber-400 transition-colors"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                          <rect x="2" y="4" width="2" height="16"/><rect x="5" y="4" width="1" height="16"/>
                          <rect x="7" y="4" width="2" height="16"/><rect x="11" y="4" width="1" height="16"/>
                          <rect x="13" y="4" width="3" height="16"/><rect x="17" y="4" width="1" height="16"/>
                          <rect x="19" y="4" width="1" height="16"/><rect x="21" y="4" width="1" height="16"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{lot.materialName}</p>
                    <p className="text-xs text-slate-500">{lot.materialCode}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">
                    <span className="text-white">{Number(lot.remainingQty).toFixed(3)}</span>
                    <span className="text-slate-500 text-xs"> / {Number(lot.quantity).toFixed(3)} {lot.unit}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge-sky text-xs">{lot.location}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                    {lot.poNo ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-mono ${LOT_STATUS_BADGE[lot.status] ?? 'text-slate-400'}`}>
                      {lot.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Ledger */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-300">สมุดบัญชีเคลื่อนไหวคลังสินค้า (WAREHOUSE TRANSACTION LEDGER)</h3>
            <p className="text-xs text-slate-500 mt-0.5">รวม {txData?.total ?? 0} รายการ</p>
          </div>
          <div className="flex gap-2">
            {['ALL', 'RO', 'RM', 'FGT', 'SO_DISPATCH', 'RETURN_WHRM'].map(t => (
              <button key={t} onClick={() => setTxFilter(t)}
                className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${txFilter === t
                  ? 'bg-sky-500/20 border-sky-500 text-sky-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}>
                {t === 'ALL' ? 'ทั้งหมด' : TX_BADGE[t]?.label ?? t}
              </button>
            ))}
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400">
                <th className="text-left px-4 py-3 font-medium">เวลาธุรกรรม</th>
                <th className="text-left px-4 py-3 font-medium">ประเภท</th>
                <th className="text-left px-4 py-3 font-medium">อ้างอิงเอกสาร</th>
                <th className="text-left px-4 py-3 font-medium">รหัสสินค้า / LOT</th>
                <th className="text-left px-4 py-3 font-medium">จำนวน</th>
                <th className="text-left px-4 py-3 font-medium">ต้นทาง → ปลายทาง</th>
                <th className="text-left px-4 py-3 font-medium">ผู้ปฏิบัติงาน</th>
              </tr>
            </thead>
            <tbody>
              {txLoading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500 animate-pulse">กำลังโหลด...</td></tr>
              ) : !txData?.data.length ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">ไม่พบรายการ</td></tr>
              ) : txData.data.map(tx => {
                const badge = TX_BADGE[tx.transactionType]
                const isOut = ['RM', 'SO_DISPATCH'].includes(tx.transactionType)
                return (
                  <tr key={tx.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      {new Date(tx.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      <p className="text-[10px] text-slate-600">
                        {new Date(tx.createdAt).toLocaleDateString('th-TH')}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${badge?.cls}`}>
                        {badge?.label ?? tx.transactionType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">
                      {tx.documentNo}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-sky-400">{tx.rmNo}</p>
                      <p className="text-xs text-slate-500">{tx.lot.materialName}</p>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-sm">
                      <span className={isOut ? 'text-red-400' : 'text-emerald-400'}>
                        {isOut ? '-' : '+'}{Number(tx.quantity).toFixed(3)}
                      </span>
                      <span className="text-slate-500 text-xs ml-1">{tx.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {tx.fromLocation ?? 'Vendor'} → {tx.toLocation ?? 'MES-Line-01'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                      {tx.performedBy.slice(0, 8)}...
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lot Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <LotDetailModal
            lot={selected}
            onClose={() => setSelected(null)}
            onSuccess={() => {
              refresh()
              setSelected(null)
            }}
          />
        </div>
      )}

      {/* Modals */}
      {showRO && <CreateROModal onClose={() => setShowRO(false)} onSuccess={refresh} />}
      {showFGT && <CreateFGTModal onClose={() => setShowFGT(false)} onSuccess={refresh} />}
      {barcodeTarget && <QuickBarcodeModal lot={barcodeTarget} onClose={() => setBarcodeTarget(null)} />}
    </div>
  )
}