'use client'
import { useState, useRef, useCallback, useEffect } from 'react'

const DAYS = Array.from({ length: 11 }, (_, i) => String(21 + i).padStart(2, '0'))
  .concat(Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(2, '0')))
const JOB_COLS = ['953B', '956', '935', '959']
const emptyRow = (day: string) => ({
  day, inTime: '', outTime: '',
  jobs: { '953B': { nt: '', ot: '' }, '956': { nt: '', ot: '' }, '935': { nt: '', ot: '' }, '959': { nt: '', ot: '' } },
  totalNT: '', totalOT: '', remarks: '', isSunday: false,
})
const defaultData = () => DAYS.map(emptyRow)
type RowData = ReturnType<typeof emptyRow>

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [rows, setRows] = useState<RowData[]>(defaultData())
  const [meta, setMeta] = useState({ name: '', idNo: '', tradeName: '', monthYear: '', totalNT: '', totalOT: '' })
  const [dragging, setDragging] = useState(false)
  const [pdfReady, setPdfReady] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if ((window as any).pdfjsLib) { setPdfReady(true); return }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      ;(window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      setPdfReady(true)
    }
    document.head.appendChild(script)
  }, [])

  const handleFile = (f: File) => { setFile(f); setStatus('idle'); setStatusMsg('') }
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]; if (f) handleFile(f)
  }, [])

  const convertToDataUrl = async (f: File): Promise<string> => {
    const isPdf = f.type.includes('pdf') || f.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = e => resolve(e.target?.result as string)
        reader.onerror = reject
        reader.readAsDataURL(f)
      })
    }

    if (!pdfReady) throw new Error('PDF.js still loading, please try again in 3 seconds')
    const pdfjsLib = (window as any).pdfjsLib
    const arrayBuffer = await f.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 2.5 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise
    return canvas.toDataURL('image/jpeg', 0.92)
  }

  const extractData = async () => {
    if (!file) return
    setStatus('processing')
    try {
      setStatusMsg('Converting PDF to image...')
      const imageUrl = await convertToDataUrl(file)
      console.log('Image URL length:', imageUrl.length, 'starts with:', imageUrl.substring(0, 40))

      setStatusMsg('AI reading handwriting...')
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setRows(json.rows || defaultData())
      setMeta(json.meta || meta)
      setStatus('done')
      setStatusMsg('Extraction complete!')
    } catch (err: any) {
      setStatus('error')
      setStatusMsg(err.message)
    }
  }

  const exportExcel = async () => {
    setStatusMsg('Generating Excel...')
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, meta }),
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${meta.name || 'Timesheet'}_${meta.monthYear || 'export'}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    setStatusMsg('Downloaded!')
  }

  const updateCell = (i: number, field: string, value: string, jobKey?: string, sub?: string) => {
    setRows(prev => prev.map((r, idx) => {
      if (idx !== i) return r
      if (jobKey && sub) return { ...r, jobs: { ...r.jobs, [jobKey]: { ...r.jobs[jobKey as keyof typeof r.jobs], [sub]: value } } }
      return { ...r, [field]: value }
    }))
  }

  const cell: React.CSSProperties = { border: '1px solid var(--border)', padding: '2px 4px', textAlign: 'center' }
  const inp: React.CSSProperties = { background: 'transparent', border: 'none', outline: 'none', width: '100%', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'inherit' }

  return (
    <main style={{ minHeight: '100vh', padding: '2rem', maxWidth: 1400, margin: '0 auto' }}>
      <header style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 800, color: 'var(--accent)' }}>MFIT</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>Timesheet Extractor</span>
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Upload a handwritten PDF → AI reads it → Download clean Excel
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '2rem', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{ padding: '2rem 1.5rem', textAlign: 'center', cursor: 'pointer', background: 'var(--surface)', border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 4 }}
            onDrop={onDrop} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
            {file ? (
              <>
                <p style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '0.85rem' }}>{file.name}</p>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{(file.size/1024).toFixed(0)} KB — click to change</p>
              </>
            ) : (
              <>
                <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>Drop PDF here</p>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>or click to browse</p>
              </>
            )}
          </div>

          {!pdfReady && <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent)', textAlign: 'center' }}>⏳ Loading PDF engine...</p>}

          <button onClick={extractData} disabled={!file || status === 'processing'}
            style={{ padding: '0.85rem', background: 'var(--accent)', color: '#000', fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.1em', border: 'none', cursor: file ? 'pointer' : 'not-allowed', opacity: file ? 1 : 0.5, borderRadius: 2 }}>
            {status === 'processing' ? `⏳ ${statusMsg}` : '⚡ EXTRACT WITH AI'}
          </button>

          {status === 'done' && (
            <button onClick={exportExcel}
              style={{ padding: '0.85rem', background: '#22c55e', color: '#000', fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.1em', border: 'none', cursor: 'pointer', borderRadius: 2 }}>
              ↓ DOWNLOAD EXCEL
            </button>
          )}

          {statusMsg && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', padding: '0.6rem 0.8rem', background: 'var(--surface)', border: `1px solid ${status === 'error' ? '#ef4444' : status === 'done' ? '#22c55e' : 'var(--border)'}`, color: status === 'error' ? '#ef4444' : status === 'done' ? '#22c55e' : 'var(--text-muted)', borderRadius: 2, wordBreak: 'break-word' as const }}>
              {status === 'error' ? '✗ ' : status === 'done' ? '✓ ' : '→ '}{statusMsg}
            </div>
          )}

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', borderRadius: 4 }}>
            <p style={{ fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--text-dim)', marginBottom: '0.25rem' }}>Document Info</p>
            {[['NAME', 'name'], ['ID NO', 'idNo'], ['TRADE', 'tradeName'], ['MONTH/YEAR', 'monthYear']].map(([label, key]) => (
              <div key={key}>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.15rem' }}>{label}</label>
                <input value={meta[key as keyof typeof meta]} onChange={e => setMeta(m => ({ ...m, [key]: e.target.value }))}
                  style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', padding: '0.35rem 0.5rem', outline: 'none', borderRadius: 2, boxSizing: 'border-box' as const }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[['TOTAL NT', 'totalNT'], ['TOTAL OT', 'totalOT']].map(([label, key]) => (
                <div key={key} style={{ flex: 1 }}>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.15rem' }}>{label}</label>
                  <input value={meta[key as keyof typeof meta]} onChange={e => setMeta(m => ({ ...m, [key]: e.target.value }))}
                    style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', padding: '0.35rem 0.5rem', outline: 'none', borderRadius: 2, textAlign: 'center' as const, boxSizing: 'border-box' as const }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Timesheet Data</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', padding: '0.2rem 0.6rem', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>EDITABLE</span>
              <button onClick={() => { setRows(defaultData()); setMeta({ name: '', idNo: '', tradeName: '', monthYear: '', totalNT: '', totalOT: '' }); setStatus('idle'); setStatusMsg('') }}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', padding: '0.2rem 0.6rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>Reset</button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  <th style={cell}>DAY</th>
                  <th style={cell}>IN TIME</th>
                  <th style={cell}>OUT TIME</th>
                  {JOB_COLS.map(j => (<>
                    <th key={`${j}nt`} style={cell}>{j}<br/>NT</th>
                    <th key={`${j}ot`} style={cell}>{j}<br/>OT</th>
                  </>))}
                  <th style={cell}>TOT NT</th>
                  <th style={cell}>TOT OT</th>
                  <th style={cell}>REMARKS</th>
                  <th style={cell}>SUN</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.day} style={{ background: row.isSunday ? 'rgba(239,68,68,0.08)' : 'transparent' }}>
                    <td style={{ ...cell, fontWeight: 700, color: row.isSunday ? '#ef4444' : 'var(--accent)', minWidth: 36 }}>{row.day}</td>
                    <td style={{ ...cell, minWidth: 70 }}><input style={inp} value={row.inTime} onChange={e => updateCell(i, 'inTime', e.target.value)} /></td>
                    <td style={{ ...cell, minWidth: 70 }}><input style={inp} value={row.outTime} onChange={e => updateCell(i, 'outTime', e.target.value)} /></td>
                    {JOB_COLS.map(j => (<>
                      <td key={`${j}nt`} style={{ ...cell, minWidth: 40 }}><input style={inp} value={row.jobs[j as keyof typeof row.jobs].nt} onChange={e => updateCell(i, 'jobs', e.target.value, j, 'nt')} /></td>
                      <td key={`${j}ot`} style={{ ...cell, minWidth: 40 }}><input style={inp} value={row.jobs[j as keyof typeof row.jobs].ot} onChange={e => updateCell(i, 'jobs', e.target.value, j, 'ot')} /></td>
                    </>))}
                    <td style={{ ...cell, minWidth: 46, color: 'var(--accent)', fontWeight: 600 }}><input style={{ ...inp, color: 'var(--accent)' }} value={row.totalNT} onChange={e => updateCell(i, 'totalNT', e.target.value)} /></td>
                    <td style={{ ...cell, minWidth: 46, color: 'var(--accent)', fontWeight: 600 }}><input style={{ ...inp, color: 'var(--accent)' }} value={row.totalOT} onChange={e => updateCell(i, 'totalOT', e.target.value)} /></td>
                    <td style={{ ...cell, minWidth: 90 }}><input style={{ ...inp, textAlign: 'left' as const }} value={row.remarks} onChange={e => updateCell(i, 'remarks', e.target.value)} /></td>
                    <td style={{ ...cell, minWidth: 36 }}><input type="checkbox" checked={row.isSunday} onChange={e => updateCell(i, 'isSunday', String(e.target.checked))} style={{ accentColor: '#ef4444', cursor: 'pointer' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <footer style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-dim)' }}>MFIT Interior Decoration LLC</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-dim)' }}>Powered by Groq AI</span>
      </footer>
    </main>
  )
}
