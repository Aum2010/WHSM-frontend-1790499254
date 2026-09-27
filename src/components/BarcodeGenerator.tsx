import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

interface BarcodeGeneratorProps {
  value: string
  label?: string
  sublabel?: string
  onDownload?: () => void
}

export default function BarcodeGenerator({
  value, label, sublabel, onDownload,
}: BarcodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !value) return
    try {
      JsBarcode(canvasRef.current, value, {
        format:      'CODE128',
        width:       2,
        height:      60,
        displayValue: true,
        fontSize:    12,
        margin:      10,
        background:  '#ffffff',
        lineColor:   '#000000',
      })
    } catch (e) {
      console.error('Barcode generate failed:', e)
    }
  }, [value])

  const handleDownload = () => {
    if (!canvasRef.current) return
    const link = document.createElement('a')
    link.download = `barcode-${value}.png`
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
    onDownload?.()
  }

  if (!value) return null

  return (
    <div className="bg-white rounded-xl p-4 space-y-3">
      {/* Label */}
      {(label || sublabel) && (
        <div className="text-center">
          {label    && <p className="text-xs font-bold text-slate-800">{label}</p>}
          {sublabel && <p className="text-[10px] text-slate-500">{sublabel}</p>}
        </div>
      )}

      {/* Barcode canvas */}
      <div className="flex justify-center">
        <canvas ref={canvasRef} />
      </div>

      {/* Download button */}
      <button
        onClick={handleDownload}
        className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download PNG
      </button>
    </div>
  )
}