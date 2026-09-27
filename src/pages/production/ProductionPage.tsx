import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/auth.store'

interface BatchRecord {
  id: string
  stage: string
  goodQty: string
  wasteQty: string
  unit: string
  blastMode: string | null
  startTime: string | null
  endTime: string | null
  performedBy: string
  note: string | null
}

interface Batch {
  id: string
  batchNo: string
  productCode: string
  productName: string
  status: 'PREPARING' | 'MIXING' | 'SKEWERING' | 'PACKING' | 'COMPLETED' | 'CANCELLED'
  startedBy: string
  startedAt: string
  completedAt: string | null
  records: BatchRecord[]
}

const STATUS_BADGE: Record<string, string> = {
  PREPARING:  'badge-sky',
  MIXING:     'badge-yellow',
  SKEWERING:  'badge-yellow',
  PACKING:    'badge-yellow',
  COMPLETED:  'badge-green',
  CANCELLED:  'bg-slate-700 text-slate-400 px-2.5 py-1 rounded-lg text-xs',
}

const STAGE_LABEL: Record<string, string> = {
  PREPARING:  'Stage 1: เตรียมวัตถุดิบ',
  MIXING:     'Stage 2: หมัก',
  SKEWERING:  'Stage 3: เสียบไม้',
  PACKING:    'Stage 4: บรรจุ',
}

const NEXT_STAGE_ENDPOINT: Record<string, string> = {
  PREPARING:  'prepare',
  MIXING:     'mix',
  SKEWERING:  'skewer',
  PACKING:    'pack',
}

// ── Modal: สร้าง Batch ───────────────────────────────
function CreateBatchModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ productCode: '', productName: '', startedBy: '' })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post('/api/v1/production/batches', form),
    onSuccess: () => { onSuccess(); onClose() },
    onError: (err: any) => setError(err.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md space-y-4">
        <h3 className="text-lg font-bold text-white">สร้าง Batch ใหม่</h3>

        {[
          { label: 'รหัสสินค้า',       key: 'productCode', placeholder: 'PROD-001' },
          { label: 'ชื่อสินค้า',        key: 'productName', placeholder: 'หมูปิ้งนมสด' },
          { label: 'รหัสผู้เริ่ม (User ID)', key: 'startedBy', placeholder: 'user-id' },
        ].map(({ label, key, placeholder }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
            <input
              className="input"
              placeholder={placeholder}
              value={form[key as keyof typeof form]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            />
          </div>
        ))}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-ghost flex-1">ยกเลิก</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="btn-primary flex-1"
          >
            {mutation.isPending ? 'กำลังสร้าง...' : 'สร้าง Batch'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: บันทึก Stage ──────────────────────────────
function RecordStageModal({
  batch, onClose, onSuccess,
}: { batch: Batch; onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuthStore()
  const [form, setForm] = useState({
    goodQty: '', wasteQty: '', unit: 'kg',
    performedBy: user?.id ?? '', blastMode: 'BLAST', note: '',
  })
  const [scaleValue, setScaleValue] = useState('0.000')   // mock scale
  const [scanning, setScanning]     = useState(false)
  const [barcode, setBarcode]       = useState('')
  const [printed, setPrinted]       = useState(false)
  const [error, setError] = useState('')

  const isPacking  = batch.status === 'PACKING'
  const endpoint   = NEXT_STAGE_ENDPOINT[batch.status]

  // ── Mock: จำลองเครื่องชั่งส่งค่ามา ──────────────────
  const simulateScale = () => {
    setScanning(true)
    setTimeout(() => {
      const mockWeight = (Math.random() * 200 + 100).toFixed(3)
      setScaleValue(mockWeight)
      setForm(f => ({ ...f, goodQty: mockWeight }))
      setScanning(false)
    }, 1200)
  }

  // ── Mock: จำลอง print barcode ────────────────────────
  const simulatePrint = () => {
    const bc = `WH-${batch.batchNo}-${Date.now().toString().slice(-6)}`
    setBarcode(bc)
    setPrinted(true)
  }

  const mutation = useMutation({
    mutationFn: () => api.post(`/api/v1/production/batches/${batch.batchNo}/${endpoint}`, {
      goodQty:     Number(form.goodQty),
      wasteQty:    Number(form.wasteQty),
      unit:        form.unit,
      performedBy: form.performedBy,
      note:        form.note || undefined,
      ...(isPacking ? { blastMode: form.blastMode } : {}),
    }),
    onSuccess: () => { onSuccess(); onClose() },
    onError: (err: any) => setError(err.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div>
          <h3 className="text-lg font-bold text-white">{STAGE_LABEL[batch.status]}</h3>
          <p className="text-xs text-slate-400 mt-1 font-mono">{batch.batchNo}</p>
        </div>

        {/* ── Scale Display (mock) ─────────────────────── */}
        <div className="bg-slate-950 rounded-xl border border-slate-700 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              ⚖ Scale Integration (Mock)
            </p>
            <span className="text-[10px] text-yellow-400 border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 rounded-full">
              รอเชื่อมต่อเครื่องชั่งจริง
            </span>
          </div>

          {/* Weight display */}
          <div className="bg-slate-900 rounded-xl p-4 text-center border border-slate-800">
            <p className="text-xs text-slate-500 mb-1">Net Weight (หลังหัก Tare)</p>
            <p className={`text-4xl font-bold font-mono transition-all ${
              scanning ? 'text-yellow-400 animate-pulse' : 'text-emerald-400'
            }`}>
              {scanning ? '------' : scaleValue}
              <span className="text-lg text-slate-400 ml-2">kg</span>
            </p>
            {!scanning && scaleValue !== '0.000' && (
              <p className="text-xs text-emerald-500 mt-1">✓ รับค่าจากเครื่องชั่งแล้ว</p>
            )}
          </div>

          <button
            onClick={simulateScale}
            disabled={scanning}
            className="w-full py-3 rounded-xl border border-sky-500/40 bg-sky-500/10 text-sky-400 text-sm font-medium hover:bg-sky-500/20 transition-colors disabled:opacity-50"
          >
            {scanning ? '⏳ กำลังอ่านค่า...' : '📡 อ่านค่าจากเครื่องชั่ง'}
          </button>
        </div>

        {/* ── Good / Waste input ───────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">ของดี (kg)</label>
            <input type="number" className="input" placeholder="0.000"
              value={form.goodQty}
              onChange={e => setForm(f => ({ ...f, goodQty: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">ของเสีย (kg)</label>
            <input type="number" className="input" placeholder="0.000"
              value={form.wasteQty}
              onChange={e => setForm(f => ({ ...f, wasteQty: e.target.value }))} />
          </div>
        </div>

        {/* ── Blast Mode (Pack stage only) ─────────────── */}
        {isPacking && (
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Blast Mode</label>
            <div className="flex gap-3">
              {['BLAST', 'NON_BLAST'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setForm(f => ({ ...f, blastMode: mode }))}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors ${
                    form.blastMode === mode
                      ? 'bg-sky-500/20 border-sky-500 text-sky-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {mode === 'BLAST' ? '❄ BLAST' : '🌡 NON BLAST'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Barcode Print (mock) ─────────────────────── */}
        <div className="bg-slate-950 rounded-xl border border-slate-700 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              🖨 Barcode Printer (Mock)
            </p>
            <span className="text-[10px] text-yellow-400 border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 rounded-full">
              รอเชื่อมต่อ printer จริง
            </span>
          </div>

          {printed ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 space-y-2">
              <p className="text-emerald-400 text-xs font-medium">✓ Print สำเร็จ</p>
              <div className="flex items-center gap-3">
                {/* mock barcode visual */}
                <div className="flex gap-0.5">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i}
                      className="bg-white"
                      style={{
                        width:  Math.random() > 0.5 ? '3px' : '1.5px',
                        height: '32px',
                      }}
                    />
                  ))}
                </div>
                <div>
                  <p className="font-mono text-xs text-white">{barcode}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{batch.productName}</p>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={simulatePrint}
              className="w-full py-3 rounded-xl border border-slate-600 bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors"
            >
              🖨 Print Barcode แปะถุง
            </button>
          )}
        </div>

        {/* ── Note ────────────────────────────────────── */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">หมายเหตุ (ไม่บังคับ)</label>
          <input className="input" placeholder="หมายเหตุ..."
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
        </div>

        {/* ── User ────────────────────────────────────── */}
        <div className="bg-slate-800 rounded-xl px-4 py-2 text-xs text-slate-400">
          ผู้ปฏิบัติ: <span className="text-sky-400">{user?.name}</span>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-ghost flex-1">ยกเลิก</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="btn-primary flex-1"
          >
            {mutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Batch Detail Panel ────────────────────────────────
function BatchDetail({ batch, onClose, onRefresh }: {
  batch: Batch; onClose: () => void; onRefresh: () => void
}) {
  const [showRecord, setShowRecord] = useState(false)
  const canRecord = !['COMPLETED', 'CANCELLED'].includes(batch.status)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">{batch.batchNo}</h3>
            <p className="text-sm text-slate-400">{batch.productName} ({batch.productCode})</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        {/* Status */}
        <div className="flex items-center gap-3">
          <span className={STATUS_BADGE[batch.status]}>{batch.status}</span>
          <span className="text-xs text-slate-500">
            เริ่ม: {new Date(batch.startedAt).toLocaleString('th-TH')}
          </span>
          {batch.completedAt && (
            <span className="text-xs text-emerald-400">
              เสร็จ: {new Date(batch.completedAt).toLocaleString('th-TH')}
            </span>
          )}
        </div>

        {/* Stage timeline */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">ขั้นตอนการผลิต</p>
          {['PREPARE', 'MIX', 'SKEWER', 'PACK'].map((stage, i) => {
            const record = batch.records.find(r => r.stage === stage)
            return (
              <div key={stage} className={`flex items-start gap-3 p-3 rounded-xl border ${
                record ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-slate-800 bg-slate-900'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                  record ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-500'
                }`}>
                  {record ? '✓' : i + 1}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${record ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {['เตรียมวัตถุดิบ', 'หมัก', 'เสียบไม้', 'บรรจุ'][i]}
                  </p>
                  {record && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      ดี: {Number(record.goodQty).toFixed(3)} kg |
                      เสีย: {Number(record.wasteQty).toFixed(3)} kg
                      {record.blastMode && ` | ${record.blastMode}`}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Actions */}
        {canRecord && (
          <button onClick={() => setShowRecord(true)} className="btn-primary w-full">
            บันทึก {STAGE_LABEL[batch.status]}
          </button>
        )}
      </div>

      {showRecord && (
        <RecordStageModal
          batch={batch}
          onClose={() => setShowRecord(false)}
          onSuccess={() => { onRefresh(); onClose() }}
        />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────
export default function ProductionPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected]     = useState<Batch | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  const { data: batches = [], isLoading } = useQuery<Batch[]>({
    queryKey: ['batches'],
    queryFn:  () => api.get('/api/v1/production/batches').then(r => r.data),
    refetchInterval: 10000,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['batches'] })

  const STATUS_FILTERS = ['ALL', 'PREPARING', 'MIXING', 'SKEWERING', 'PACKING', 'COMPLETED']

  const filtered = batches.filter(b =>
    statusFilter === 'ALL' ? true : b.status === statusFilter
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">การผลิต (Production)</h2>
          <p className="text-sm text-slate-400 mt-1">{batches.length} batches ทั้งหมด</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
          + สร้าง Batch
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
            {s === 'ALL' ? 'ทั้งหมด' : s}
          </button>
        ))}
      </div>

      {/* Batch cards */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-500 animate-pulse">กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">ไม่พบ batch</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(batch => (
            <div
              key={batch.id}
              onClick={() => setSelected(batch)}
              className="card cursor-pointer hover:border-slate-600 transition-colors space-y-3"
            >
              {/* Batch header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-xs text-sky-400">{batch.batchNo}</p>
                  <p className="font-medium text-white mt-0.5">{batch.productName}</p>
                  <p className="text-xs text-slate-500">{batch.productCode}</p>
                </div>
                <span className={STATUS_BADGE[batch.status]}>{batch.status}</span>
              </div>

              {/* Stage progress */}
              <div className="flex gap-1.5">
                {['PREPARE', 'MIX', 'SKEWER', 'PACK'].map((stage, i) => {
                  const done = batch.records.some(r => r.stage === stage)
                  return (
                    <div key={stage} className="flex-1 space-y-1">
                      <div className={`h-1.5 rounded-full ${done ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                      <p className={`text-[9px] text-center ${done ? 'text-emerald-400' : 'text-slate-600'}`}>
                        {['ชั่ง', 'หมัก', 'เสียบ', 'บรรจุ'][i]}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Time */}
              <p className="text-xs text-slate-500">
                เริ่ม: {new Date(batch.startedAt).toLocaleString('th-TH')}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateBatchModal
          onClose={() => setShowCreate(false)}
          onSuccess={refresh}
        />
      )}
      {selected && (
        <BatchDetail
          batch={selected}
          onClose={() => setSelected(null)}
          onRefresh={refresh}
        />
      )}
    </div>
  )
}