import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth.store'
import { api } from '../../lib/api'

export default function LoginPage() {
  const [cardId, setCardId]   = useState('')
  const [password, setPass]   = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const cardRef = useRef<HTMLInputElement>(null)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => { cardRef.current?.focus() }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cardId || !password) return
    setLoading(true); setError('')
    try {
      const res = await api.post('/api/v1/auth/login', { cardId, password })
      setAuth(res.data.token, res.data.user)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
      setPass('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/30 mb-4">
            <svg className="w-8 h-8 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">WHSM System</h1>
          <p className="text-slate-400 text-sm mt-1">Food Factory ERP / MES / WMS</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              รหัสบัตรพนักงาน
            </label>
            <input
              ref={cardRef}
              type="text"
              value={cardId}
              onChange={e => setCardId(e.target.value)}
              placeholder="Scan บัตรหรือพิมพ์รหัส..."
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              รหัสผ่าน
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPass(e.target.value)}
              placeholder="รหัสผ่าน"
              className="input"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          System Connected
        </div>
      </div>
    </div>
  )
}