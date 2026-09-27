import { useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

interface BarcodeScannerProps {
  onScan: (value: string) => void
  placeholder?: string
  label?: string
}

export default function BarcodeScanner({
  onScan, placeholder = 'Scan หรือพิมพ์...', label,
}: BarcodeScannerProps) {
  const fileRef  = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError]       = useState('')
  const [manual, setManual]     = useState('')

  const handleFile = async (file: File) => {
    setScanning(true)
    setError('')
    try {
      const reader = new BrowserMultiFormatReader()
      const img    = new Image()
      const url    = URL.createObjectURL(file)
      img.src      = url

      await new Promise<void>((resolve, reject) => {
        img.onload  = () => resolve()
        img.onerror = () => reject(new Error('โหลดรูปไม่ได้'))
      })

      const result = await reader.decodeFromImageElement(img)
      URL.revokeObjectURL(url)
      onScan(result.getText())
      setManual(result.getText())
    } catch {
      setError('อ่าน Barcode ไม่ได้ — ลองพิมพ์เองแทน')
    } finally {
      setScanning(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handleManual = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && manual.trim()) {
      onScan(manual.trim())
    }
  }

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-xs font-medium text-slate-400">{label}</label>
      )}

      {/* Input + scan button */}
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder={placeholder}
          value={manual}
          onChange={e => setManual(e.target.value)}
          onKeyDown={handleManual}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={scanning}
          title="ถ่ายรูปหรือเลือกรูป barcode"
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-colors flex items-center gap-1.5 text-sm disabled:opacity-50 whitespace-nowrap"
        >
          {scanning ? (
            <span className="animate-pulse">⏳</span>
          ) : (
            <>
              {/* Camera icon */}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs">สแกน</span>
            </>
          )}
        </button>
      </div>

      {/* Hidden file input — accept image + camera */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"   // เปิดกล้องหลังบน mobile ก่อน แต่ยังเลือกจาก gallery ได้
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Error */}
      {error && (
        <p className="text-red-400 text-xs">{error}</p>
      )}

      {/* Hint */}
      <p className="text-[10px] text-slate-600">
        กด Enter หลังพิมพ์ หรือกด สแกน เพื่อถ่ายรูป/เลือกรูป barcode
      </p>
    </div>
  )
}