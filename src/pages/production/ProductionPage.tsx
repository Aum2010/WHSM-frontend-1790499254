import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/auth.store'
import BarcodeGenerator from '../../components/BarcodeGenerator'

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

interface BatchIngredient {
  id: string
  rmNo: string
  plannedQty: string
  actualQty: string
  unit: string
  stock?: { materialCode: string; materialName: string }
}

interface Batch {
  id: string
  lotNo: string
  productCode: string
  productName: string
  recipeId: string | null
  status: 'PREPARING' | 'MIXING' | 'SKEWERING' | 'PACKING' | 'COMPLETED' | 'CANCELLED'
  startedBy: string
  startedAt: string
  completedAt: string | null
  records: BatchRecord[]
  ingredients: BatchIngredient[]
}

const STATUS_BADGE: Record<string, string> = {
  PREPARING: 'badge-sky',
  MIXING:    'badge-yellow',
  SKEWERING: 'badge-yellow',
  PACKING:   'badge-yellow',
  COMPLETED: 'badge-green',
  CANCELLED: 'bg-slate-700 text-slate-400 px-2.5 py-1 rounded-lg text-xs',
}

const STAGE_LABEL: Record<string, string> = {
  PREPARING: 'Stage 1: เตรียมวัตถุดิบ',
  MIXING:    'Stage 2: หมัก',
  SKEWERING: 'Stage 3: เสียบไม้',
  PACKING:   'Stage 4: บรรจุ',
}

const NEXT_STAGE_ENDPOINT: Record<string, string> = {
  PREPARING: 'prepare',
  MIXING:    'mix',
  SKEWERING: 'skewer',
  PACKING:   'pack',
}

// ── Modal: สร้าง Batch ───────────────────────────────
function CreateBatchModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ productCode: '', productName: '', recipeId: '', startedBy: '' })
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
          { label: 'รหัสสินค้า',           key: 'productCode', placeholder: 'PROD-001' },
          { label: 'ชื่อสินค้า',            key: 'productName', placeholder: 'หมูปิ้งนมสด' },
          { label: 'Recipe ID',             key: 'recipeId',    placeholder: 'uuid ของ recipe' },
          { label: 'รหัสผู้เริ่ม (User ID)', key: 'startedBy',   placeholder: 'user-id' },
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
  const isPreparing = batch.status === 'PREPARING'
  const isPacking   = batch.status === 'PACKING'
  const endpoint    = NEXT_STAGE_ENDPOINT[batch.status]

  // per-ingredient weights (PREPARING only)
  const [weights, setWeights] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    if (isPreparing) {
      batch.ingredients.forEach(ing => {
        init[ing.rmNo] = Number(ing.plannedQty).toFixed(3)
      })
    }
    return init
  })
  const [scalingFor, setScalingFor] = useState<string | null>(null)

  const [form, setForm] = useState({
    goodQty: '', wasteQty: '', unit: 'kg',
    performedBy: user?.id ?? '', blastMode: 'BLAST', note: '',
  })
  const [scaleValue, setScaleValue] = useState('0.000')
  const [scanning, setScanning]     = useState(false)
  const [error, setError] = useState('')
  const [fgNo, setFgNo] = useState<string | null>(null)

  const simulateScale = (rmNo?: string) => {
    setScanning(true)
    if (rmNo) setScalingFor(rmNo)
    setTimeout(() => {
      const mockWeight = (Math.random() * 10 + 0.5).toFixed(3)
      setScaleValue(mockWeight)
      if (rmNo) {
        setWeights(w => ({ ...w, [rmNo]: mockWeight }))
      } else {
        setForm(f => ({ ...f, goodQty: mockWeight }))
      }
      setScanning(false)
      setScalingFor(null)
    }, 1200)
  }

  const totalWeighed = Object.values(weights).reduce((s, v) => s + (Number(v) || 0), 0)
  const allWeighed = isPreparing
    ? batch.ingredients.every(ing => Number(weights[ing.rmNo] ?? 0) > 0)
    : true

  const mutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        goodQty:     isPreparing ? totalWeighed : Number(form.goodQty),
        wasteQty:    Number(form.wasteQty),
        unit:        form.unit,
        performedBy: form.performedBy,
        note:        form.note || undefined,
        ...(isPacking ? { blastMode: form.blastMode } : {}),
      }
      if (isPreparing && batch.ingredients.length > 0) {
        payload.ingredientWeights = batch.ingredients.map(ing => ({
          rmNo:      ing.rmNo,
          actualQty: Number(weights[ing.rmNo] ?? ing.plannedQty),
        }))
      }
      return api.patch(`/api/v1/production/batches/${batch.lotNo}/${endpoint}`, payload)
    },
    onSuccess: (res) => {
      onSuccess()
      if (isPacking && res.data?.fgNo) {
        setFgNo(res.data.fgNo)
      } else {
        onClose()
      }
    },
    onError: (err: any) => setError(err.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  // FG barcode screen after pack complete
  if (fgNo) return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-4xl mb-2">✅</div>
          <h3 className="text-lg font-bold text-white">Batch เสร็จสมบูรณ์</h3>
          <p className="text-xs text-slate-400 mt-1">สินค้าสำเร็จรูปถูกเพิ่มเข้า Warehouse แล้ว</p>
        </div>
        <div className="bg-slate-900 rounded-xl p-3 space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-slate-400">FG Number</span><span className="font-mono text-emerald-400">{fgNo}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">สินค้า</span><span className="text-white">{batch.productName}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">จาก Batch</span><span className="font-mono text-sky-400">{batch.lotNo}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">ของดี</span><span className="text-white">{Number(form.goodQty).toFixed(3)} {form.unit}</span></div>
        </div>
        <BarcodeGenerator
          value={fgNo}
          label={batch.productName}
          sublabel={`${batch.productCode} | ${batch.lotNo} | ${Number(form.goodQty).toFixed(3)} ${form.unit}`}
          onDownload={onClose}
        />
        <button onClick={onClose} className="btn-primary w-full">เสร็จสิ้น</button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div>
          <h3 className="text-lg font-bold text-white">{STAGE_LABEL[batch.status]}</h3>
          <p className="text-xs text-slate-400 mt-1 font-mono">{batch.lotNo}</p>
        </div>

        {/* ── PREPARING: ชั่งน้ำหนักแต่ละ RM ── */}
        {isPreparing && batch.ingredients.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">⚖ ชั่งน้ำหนักวัตถุดิบ</p>
              <span className="text-xs text-slate-500">{batch.ingredients.length} รายการ</span>
            </div>

            {batch.ingredients.map(ing => {
              const isScaling = scalingFor === ing.rmNo && scanning
              const val = weights[ing.rmNo] ?? ''
              const planned = Number(ing.plannedQty)
              const actual  = Number(val) || 0
              const diff    = actual - planned
              const diffColor = Math.abs(diff) < 0.01 ? 'text-slate-500'
                : diff > 0 ? 'text-yellow-400' : 'text-red-400'
              return (
                <div key={ing.rmNo} className="bg-slate-900 rounded-xl border border-slate-800 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-xs text-sky-400">{ing.rmNo}</p>
                      {ing.stock && <p className="text-xs text-slate-300 mt-0.5">{ing.stock.materialName}</p>}
                    </div>
                    <span className="text-xs text-slate-500">แผน: <span className="text-slate-300">{planned.toFixed(3)} {ing.unit}</span></span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      step="0.001"
                      className="input flex-1 font-mono text-sm"
                      placeholder="0.000"
                      value={val}
                      onChange={e => setWeights(w => ({ ...w, [ing.rmNo]: e.target.value }))}
                    />
                    <span className="text-xs text-slate-500">{ing.unit}</span>
                    <button
                      onClick={() => simulateScale(ing.rmNo)}
                      disabled={scanning}
                      className="px-3 py-2 rounded-xl border border-sky-500/40 bg-sky-500/10 text-sky-400 text-xs font-medium hover:bg-sky-500/20 transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {isScaling ? '⏳' : '📡 ชั่ง'}
                    </button>
                  </div>
                  {actual > 0 && (
                    <p className={`text-xs ${diffColor}`}>
                      จริง: {actual.toFixed(3)} {ing.unit}
                      {Math.abs(diff) >= 0.001 && ` (${diff > 0 ? '+' : ''}${diff.toFixed(3)})`}
                    </p>
                  )}
                </div>
              )
            })}

            {/* summary */}
            <div className="bg-slate-950 rounded-xl border border-slate-700 p-3 flex items-center justify-between">
              <p className="text-xs text-slate-400">รวมน้ำหนักทั้งหมด</p>
              <p className="text-sm font-bold font-mono text-emerald-400">{totalWeighed.toFixed(3)} kg</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">ของเสีย (kg)</label>
                <input type="number" className="input" placeholder="0.000"
                  value={form.wasteQty} onChange={e => setForm(f => ({ ...f, wasteQty: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">หน่วย</label>
                <input className="input" value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
              </div>
            </div>
          </div>
        ) : (
          /* ── Other stages: scale for goodQty ── */
          <div className="space-y-4">
            <div className="bg-slate-950 rounded-xl border border-slate-700 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">⚖ Scale Integration (Mock)</p>
                <span className="text-[10px] text-yellow-400 border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 rounded-full">รอเชื่อมต่อเครื่องชั่งจริง</span>
              </div>
              <div className="bg-slate-900 rounded-xl p-4 text-center border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Net Weight (หลังหัก Tare)</p>
                <p className={`text-4xl font-bold font-mono transition-all ${scanning ? 'text-yellow-400 animate-pulse' : 'text-emerald-400'}`}>
                  {scanning ? '------' : scaleValue}
                  <span className="text-lg text-slate-400 ml-2">kg</span>
                </p>
                {!scanning && scaleValue !== '0.000' && (
                  <p className="text-xs text-emerald-500 mt-1">✓ รับค่าจากเครื่องชั่งแล้ว</p>
                )}
              </div>
              <button onClick={() => simulateScale()} disabled={scanning}
                className="w-full py-3 rounded-xl border border-sky-500/40 bg-sky-500/10 text-sky-400 text-sm font-medium hover:bg-sky-500/20 transition-colors disabled:opacity-50">
                {scanning ? '⏳ กำลังอ่านค่า...' : '📡 อ่านค่าจากเครื่องชั่ง'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">ของดี (kg)</label>
                <input type="number" className="input" placeholder="0.000"
                  value={form.goodQty} onChange={e => setForm(f => ({ ...f, goodQty: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">ของเสีย (kg)</label>
                <input type="number" className="input" placeholder="0.000"
                  value={form.wasteQty} onChange={e => setForm(f => ({ ...f, wasteQty: e.target.value }))} />
              </div>
            </div>
          </div>
        )}

        {isPacking && (
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Blast Mode</label>
            <div className="flex gap-3">
              {['BLAST', 'NON_BLAST'].map(mode => (
                <button key={mode} onClick={() => setForm(f => ({ ...f, blastMode: mode }))}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors ${
                    form.blastMode === mode
                      ? 'bg-sky-500/20 border-sky-500 text-sky-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}>
                  {mode === 'BLAST' ? '❄ BLAST' : '🌡 NON BLAST'}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">หมายเหตุ (ไม่บังคับ)</label>
          <input className="input" placeholder="หมายเหตุ..."
            value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
        </div>

        <div className="bg-slate-800 rounded-xl px-4 py-2 text-xs text-slate-400">
          ผู้ปฏิบัติ: <span className="text-sky-400">{user?.name}</span>
        </div>

        {isPreparing && !allWeighed && (
          <p className="text-yellow-400 text-xs">⚠ กรุณากรอกน้ำหนักให้ครบทุก RM ก่อนบันทึก</p>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-ghost flex-1">ยกเลิก</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || (isPreparing && !allWeighed)}
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
  const { user } = useAuthStore()
  const [showRecord, setShowRecord]   = useState(false)
  const [pickResult, setPickResult]   = useState<any>(null)
  const [barcodeRmNo, setBarcodeRmNo] = useState<string | null>(null)

  const canRecord = !['COMPLETED', 'CANCELLED'].includes(batch.status)
  const canPick   = batch.status === 'PREPARING' && batch.recipeId && batch.ingredients.length === 0

  const packRecord = batch.records.find(r => r.stage === 'PACK')

  const pickMutation = useMutation({
    mutationFn: () => api.post(`/api/v1/production/batches/${batch.lotNo}/pick-from-recipe`, {
      performedBy: user?.id ?? '',
    }),
    onSuccess: (res) => { setPickResult(res.data); onRefresh() },
  })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">{batch.lotNo}</h3>
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

        {/* Ingredients */}
        {batch.ingredients.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">วัตถุดิบที่เบิก</p>
            {batch.ingredients.map(ing => {
              const planned = Number(ing.plannedQty)
              const actual  = Number(ing.actualQty)
              const hasWeighed = actual > 0 && Math.abs(actual - planned) >= 0.001
              return (
                <div key={ing.id} className="flex items-center justify-between bg-slate-900 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setBarcodeRmNo(ing.rmNo)}
                      title="พิมพ์ Barcode"
                      className="text-slate-600 hover:text-amber-400 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                        <rect x="2" y="4" width="2" height="16"/>
                        <rect x="5" y="4" width="1" height="16"/>
                        <rect x="7" y="4" width="2" height="16"/>
                        <rect x="10" y="4" width="1" height="16"/>
                        <rect x="12" y="4" width="3" height="16"/>
                        <rect x="16" y="4" width="1" height="16"/>
                        <rect x="18" y="4" width="2" height="16"/>
                        <rect x="21" y="4" width="1" height="16"/>
                      </svg>
                    </button>
                    <span className="font-mono text-xs text-sky-400">{ing.rmNo}</span>
                    {ing.stock && <span className="text-xs text-slate-500">{ing.stock.materialName}</span>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-300">{actual.toFixed(3)} {ing.unit}</p>
                    {hasWeighed && (
                      <p className="text-[10px] text-slate-500">แผน: {planned.toFixed(3)}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pick from recipe */}
        {canPick && (
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 space-y-3">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">🔄 เบิกวัตถุดิบอัตโนมัติ (FEFO)</p>
            {pickResult ? (
              <div className={`rounded-xl p-3 border ${pickResult.hasShortage ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                <p className={`text-sm font-medium ${pickResult.hasShortage ? 'text-red-400' : 'text-emerald-400'}`}>
                  {pickResult.hasShortage ? '⚠ เบิกได้บางส่วน — ของไม่พอ' : '✓ เบิกครบทุก ingredient'}
                </p>
                {pickResult.items.map((item: any) => (
                  <p key={item.materialCode} className="text-xs text-slate-400 mt-1">
                    {item.materialName}: {item.pickedQty}/{item.neededQty} {item.shortage > 0 ? `(ขาด ${item.shortage})` : ''}
                  </p>
                ))}
              </div>
            ) : (
              <button
                onClick={() => pickMutation.mutate()}
                disabled={pickMutation.isPending}
                className="w-full py-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
              >
                {pickMutation.isPending ? '⏳ กำลังเบิก...' : '🧾 เบิกวัตถุดิบจาก Recipe'}
              </button>
            )}
          </div>
        )}

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
                      ดี: {Number(record.goodQty).toFixed(3)} kg | เสีย: {Number(record.wasteQty).toFixed(3)} kg
                      {record.blastMode && ` | ${record.blastMode}`}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* FG info when COMPLETED */}
        {batch.status === 'COMPLETED' && packRecord && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-2">
            <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider">📦 สินค้าสำเร็จรูป (FG)</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-slate-400">ของดี: </span><span className="text-white">{Number(packRecord.goodQty).toFixed(3)} {packRecord.unit}</span></div>
              <div><span className="text-slate-400">ของเสีย: </span><span className="text-white">{Number(packRecord.wasteQty).toFixed(3)} {packRecord.unit}</span></div>
              {packRecord.blastMode && <div><span className="text-slate-400">Blast: </span><span className="text-white">{packRecord.blastMode}</span></div>}
              <div><span className="text-slate-400">Location: </span><span className="text-white">Zone-FG-01</span></div>
            </div>
          </div>
        )}

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

      {/* RM Barcode Modal */}
      {barcodeRmNo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="card w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Barcode วัตถุดิบ</h3>
              <button onClick={() => setBarcodeRmNo(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <BarcodeGenerator
              value={barcodeRmNo}
              label={batch.ingredients.find(i => i.rmNo === barcodeRmNo)?.stock?.materialName ?? barcodeRmNo}
              sublabel={`Batch: ${batch.lotNo}`}
              onDownload={() => setBarcodeRmNo(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────
export default function ProductionPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate]     = useState(false)
  const [selected, setSelected]         = useState<Batch | null>(null)
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">การผลิต (Production)</h2>
          <p className="text-sm text-slate-400 mt-1">{batches.length} batches ทั้งหมด</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">+ สร้าง Batch</button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              statusFilter === s
                ? 'bg-sky-500/20 border-sky-500 text-sky-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
            }`}>
            {s === 'ALL' ? 'ทั้งหมด' : s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-500 animate-pulse">กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">ไม่พบ batch</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(batch => (
            <div key={batch.id} onClick={() => setSelected(batch)}
              className="card cursor-pointer hover:border-slate-600 transition-colors space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-xs text-sky-400">{batch.lotNo}</p>
                  <p className="font-medium text-white mt-0.5">{batch.productName}</p>
                  <p className="text-xs text-slate-500">{batch.productCode}</p>
                </div>
                <span className={STATUS_BADGE[batch.status]}>{batch.status}</span>
              </div>

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

              <p className="text-xs text-slate-500">
                เริ่ม: {new Date(batch.startedAt).toLocaleString('th-TH')}
              </p>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateBatchModal onClose={() => setShowCreate(false)} onSuccess={refresh} />}
      {selected && (
        <BatchDetail batch={selected} onClose={() => setSelected(null)} onRefresh={refresh} />
      )}
    </div>
  )
}