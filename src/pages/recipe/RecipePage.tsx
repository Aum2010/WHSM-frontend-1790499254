import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../stores/auth.store'
import { api } from '../../lib/api'

interface RecipeItem {
  id: string
  materialCode: string
  materialName: string
  quantity: string
  unit: string
  note: string | null
}

interface Recipe {
  id: string
  productCode: string
  productName: string
  description: string | null
  yieldQty: string
  yieldUnit: string
  isActive: boolean
  items: RecipeItem[]
}

interface StockCheck {
  productCode: string
  productName: string
  allSufficient: boolean
  yieldQty: number
  yieldUnit: string
  items: {
    materialCode: string
    materialName: string
    required: number
    unit: string
    inStock: number
    sufficient: boolean
    shortage: number
    lots: { lotNo: string; remainingQty: number; location: string }[]
  }[]
}

// ── Modal: สร้าง/แก้ไข Recipe ───────────────────────
function RecipeModal({ recipe, onClose, onSuccess }: {
  recipe?: Recipe; onClose: () => void; onSuccess: () => void
}) {
  const [form, setForm] = useState({
    productCode: recipe?.productCode ?? '',
    productName: recipe?.productName ?? '',
    description: recipe?.description ?? '',
    yieldQty:    recipe ? String(Number(recipe.yieldQty)) : '',
    yieldUnit:   recipe?.yieldUnit ?? 'kg',
  })
  const [items, setItems] = useState<Omit<RecipeItem, 'id'>[]>(
    recipe?.items.map(i => ({
      materialCode: i.materialCode,
      materialName: i.materialName,
      quantity:     String(Number(i.quantity)),
      unit:         i.unit,
      note:         i.note ?? '',
    })) ?? [{ materialCode: '', materialName: '', quantity: '', unit: 'kg', note: '' }]
  )
  const [error, setError] = useState('')

  const addItem = () =>
    setItems(i => [...i, { materialCode: '', materialName: '', quantity: '', unit: 'kg', note: '' }])

  const removeItem = (idx: number) =>
    setItems(i => i.filter((_, j) => j !== idx))

  const updateItem = (idx: number, key: string, val: string) =>
    setItems(i => i.map((item, j) => j === idx ? { ...item, [key]: val } : item))

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        yieldQty: Number(form.yieldQty),
        items: items.map(i => ({ ...i, quantity: Number(i.quantity) })),
      }
      return recipe
        ? api.put(`/api/v1/recipe/${recipe.productCode}`, payload)
        : api.post('/api/v1/recipe', payload)
    },
    onSuccess: () => { onSuccess(); onClose() },
    onError: (err: any) => setError(err.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-white">
          {recipe ? 'แก้ไขสูตร' : 'สร้างสูตรใหม่'}
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">รหัสสินค้า</label>
            <input className="input" placeholder="PROD-001"
              value={form.productCode} disabled={!!recipe}
              onChange={e => setForm(f => ({ ...f, productCode: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">ชื่อสินค้า</label>
            <input className="input" placeholder="หมูปิ้งนมสด"
              value={form.productName}
              onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">รายละเอียด</label>
          <input className="input" placeholder="รายละเอียดสูตร (ไม่บังคับ)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Yield ต่อ batch</label>
            <input type="number" className="input" placeholder="0.000"
              value={form.yieldQty}
              onChange={e => setForm(f => ({ ...f, yieldQty: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">หน่วย</label>
            <select className="input" value={form.yieldUnit}
              onChange={e => setForm(f => ({ ...f, yieldUnit: e.target.value }))}>
              {['kg', 'g', 'pack', 'box'].map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {/* Recipe Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300">
              ส่วนประกอบ ({items.length} รายการ)
            </label>
            <button onClick={addItem} className="text-xs text-sky-400 hover:text-sky-300">
              + เพิ่มส่วนประกอบ
            </button>
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="bg-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">ส่วนประกอบที่ {idx + 1}</span>
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
                <input type="number" className="input text-xs" placeholder="ปริมาณ"
                  value={item.quantity}
                  onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                <select className="input text-xs" value={item.unit}
                  onChange={e => updateItem(idx, 'unit', e.target.value)}>
                  {['kg', 'g', 'ml', 'l', 'pack'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <input className="input text-xs" placeholder="หมายเหตุ (ไม่บังคับ)"
                value={item.note ?? ''}
                onChange={e => updateItem(idx, 'note', e.target.value)} />
            </div>
          ))}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-ghost flex-1">ยกเลิก</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary flex-1">
            {mutation.isPending ? 'กำลังบันทึก...' : recipe ? 'บันทึกการแก้ไข' : 'สร้างสูตร'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Stock Check Panel ────────────────────────────────
function StockCheckPanel({ check }: { check: StockCheck }) {
  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
        check.allSufficient
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-red-500/10 border-red-500/30'
      }`}>
        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${
          check.allSufficient ? 'bg-emerald-500' : 'bg-red-500'
        }`} />
        <div>
          <p className={`text-sm font-bold ${check.allSufficient ? 'text-emerald-400' : 'text-red-400'}`}>
            {check.allSufficient ? '✓ Stock พร้อมผลิต' : '✗ Stock ไม่เพียงพอ'}
          </p>
          <p className="text-xs text-slate-400">
            Yield: {check.yieldQty} {check.yieldUnit} / batch
          </p>
        </div>
      </div>

      {check.items.map(item => (
        <div key={item.materialCode}
          className={`rounded-xl border p-3 space-y-2 ${
            item.sufficient
              ? 'border-slate-700 bg-slate-800/50'
              : 'border-red-500/30 bg-red-500/5'
          }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">{item.materialName}</p>
              <p className="text-xs text-slate-500">{item.materialCode}</p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold font-mono ${
                item.sufficient ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {item.inStock.toFixed(3)} / {item.required.toFixed(3)} {item.unit}
              </p>
              <p className="text-xs text-slate-500">มี / ต้องการ</p>
            </div>
          </div>

          {!item.sufficient && (
            <p className="text-xs text-red-400">ขาด {item.shortage.toFixed(3)} {item.unit}</p>
          )}

          {/* Lots available */}
          {item.lots.length > 0 && (
            <div className="space-y-1">
              {item.lots.map(lot => (
                <div key={lot.lotNo} className="flex justify-between text-xs text-slate-400 bg-slate-800 rounded-lg px-3 py-1.5">
                  <span className="font-mono text-sky-400">{lot.lotNo}</span>
                  <span>{lot.remainingQty.toFixed(3)} {item.unit}</span>
                  <span className="text-slate-500">{lot.location}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────
export default function RecipePage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [showCreate, setShowCreate]   = useState(false)
  const [editing, setEditing]         = useState<Recipe | null>(null)
  const [selected, setSelected]       = useState<Recipe | null>(null)
  const [stockCheck, setStockCheck]   = useState<StockCheck | null>(null)
  const [checking, setChecking]       = useState(false)

  const { data: recipes = [], isLoading } = useQuery<Recipe[]>({
    queryKey: ['recipes'],
    queryFn:  () => api.get('/api/v1/recipe').then(r => r.data),
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['recipes'] })

  const handleCheckStock = async (recipe: Recipe) => {
    setSelected(recipe)
    setChecking(true)
    setStockCheck(null)
    try {
      const res = await api.get(`/api/v1/recipe/${recipe.productCode}/check-stock`)
      setStockCheck(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">สูตรการผลิต (Recipe)</h2>
          <p className="text-sm text-slate-400 mt-1">{recipes.length} สูตร</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
          + สร้างสูตรใหม่
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recipe List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-12 text-slate-500 animate-pulse">กำลังโหลด...</div>
          ) : recipes.length === 0 ? (
            <div className="card text-center py-12 text-slate-500">
              <p>ยังไม่มีสูตรการผลิต</p>
              <button onClick={() => setShowCreate(true)} className="btn-primary text-sm mt-4">
                + สร้างสูตรแรก
              </button>
            </div>
          ) : recipes.map(recipe => (
            <div
              key={recipe.id}
              onClick={() => handleCheckStock(recipe)}
              className={`card cursor-pointer transition-colors space-y-3 ${
                selected?.id === recipe.id
                  ? 'border-sky-500/50 bg-sky-500/5'
                  : 'hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-white">{recipe.productName}</p>
                  <p className="text-xs text-slate-500 font-mono">{recipe.productCode}</p>
                  {recipe.description && (
                    <p className="text-xs text-slate-400 mt-1">{recipe.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge-sky text-xs">
                    {Number(recipe.yieldQty).toFixed(0)} {recipe.yieldUnit}/batch
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); setEditing(recipe) }}
                    className="text-xs text-slate-400 hover:text-sky-400 border border-slate-700 px-2 py-1 rounded-lg"
                  >
                    แก้ไข
                  </button>
                </div>
              </div>

              {/* Items summary */}
              <div className="space-y-1">
                {recipe.items.map(item => (
                  <div key={item.id} className="flex justify-between text-xs">
                    <span className="text-slate-300">{item.materialName}</span>
                    <span className="font-mono text-slate-400">
                      {Number(item.quantity).toFixed(3)} {item.unit}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-600">คลิกเพื่อเช็ค Stock</p>
            </div>
          ))}
        </div>

        {/* Stock Check Panel */}
        <div>
          {checking ? (
            <div className="card text-center py-12 text-slate-500 animate-pulse">
              กำลังเช็ค Stock...
            </div>
          ) : stockCheck ? (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-300">
                  เช็ค Stock — {stockCheck.productName}
                </h3>
              </div>
              <StockCheckPanel check={stockCheck} />
            </div>
          ) : (
            <div className="card text-center py-12 text-slate-500">
              <p className="text-sm">เลือกสูตรทางซ้าย</p>
              <p className="text-xs mt-1">เพื่อเช็ค Stock ว่าพอผลิตไหม</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <RecipeModal onClose={() => setShowCreate(false)} onSuccess={refresh} />
      )}
      {editing && (
        <RecipeModal
          recipe={editing}
          onClose={() => setEditing(null)}
          onSuccess={refresh}
        />
      )}
    </div>
  )
}