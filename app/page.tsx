'use client'
import { useState, useRef, useCallback } from 'react'

const DAYS = Array.from({ length: 11 }, (_, i) => String(21 + i).padStart(2, '0'))
  .concat(Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(2, '0')))

const JOB_COLS = ['953B', '956', '935', '959']

const emptyRow = (day: string) => ({
  day,
  inTime: '',
  outTime: '',
  jobs: { '953B': { nt: '', ot: '' }, '956': { nt: '', ot: '' }, '935': { nt: '', ot: '' }, '959': { nt: '', ot: '' } },
  totalNT: '',
  totalOT: '',
  remarks: '',
  isSunday: false,
})

const defaultData = () => DAYS.map(emptyRow)

type RowData = ReturnType<typeof emptyRow>

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [rows, setRows] = useState<RowData[]>(defaultData())
  const [meta, setMeta] = useState({ name: '', idNo: '', tradeName: '', monthYear: '', totalNT: '', totalOT: '' })
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    // accept all return
    setFile(f)
    const url = URL.createObjectURL(f)
    setPreview(url)
    setStatus('idle')
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [])

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  const extractData = async () => {
    if (!file) return
    setStatus('processing')
    setStatusMsg('Uploading PDF...')

    const formData = new FormData()
    formData.append('pdf', file)

    try {
      setStatusMsg('Analysing handwriting with AI...')
      const res = await fetch('/api/extract', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setStatusMsg('Populating table...')
      setRows(json.rows || defaultData())
      setMeta(json.meta || meta)
      setStatus('done')
      setStatusMsg('Extraction complete!')
    } catch (err: any) {
      setStatus('error')
      setStatusMsg(err.message || 'Extraction failed')
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
    setStatusMsg('Excel downloaded!')
  }

  const updateCell = (dayIdx: number, field: string, value: string, jobKey?: string, subfield?: string) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== dayIdx) return r
      if (jobKey && subfield) {
        return { ...r, jobs: { ...r.jobs, [jobKey]: { ...r.jobs[jobKey as keyof typeof r.jobs], [subfield]: value } } }
      }
      return { ...r, [field]: value }
    }))
  }

  return (
    <main style={{ minHeight: '100vh', padding: '2.5rem', maxWidth: 1400, margin: '0 auto' }}>

      {/* Header */}
      <header style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '0.5rem' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.02em' }}>MFIT</span>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Timesheet Extractor</span>
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          Upload a handwritten PDF → AI reads it → Download clean Excel
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '2rem', alignItems: 'start' }}>

        {/* Left panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Upload */}
          <div
            className={`drop-zone ${dragging ? 'dragging' : ''}`}
            style={{ padding: '2.5rem 1.5rem', textAlign: 'center', cursor: 'pointer', background: 'var(--surface)', borderRadius: 4 }}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.7 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            {file ? (
              <div>
                <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)', marginBottom: '0.25rem' }}>{file.name}</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(0)} KB — click to change</p>
              </div>
            ) : (
              <div>
                <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.3rem' }}>Drop PDF here</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>or click to browse</p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <button className={`btn-primary ${status === 'processing' ? 'processing' : ''}`} onClick={extractData} disabled={!file || status === 'processing'}>
            {status === 'processing' ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                <span className="spinner" /> Extracting...
              </span>
            ) : '⚡ Extract with AI'}
          </button>

          {status === 'done' && (
            <button className="btn-primary slide-up" onClick={exportExcel} style={{ background: 'var(--success)' }}>
              ↓ Download Excel
            </button>
          )}

          {/* Status */}
          {statusMsg && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.7rem', padding: '0.6rem 0.8rem',
              background: 'var(--surface2)', border: `1px solid ${status === 'error' ? 'var(--error)' : status === 'done' ? 'var(--success)' : 'var(--border)'}`,
              color: status === 'error' ? 'var(--error)' : status === 'done' ? 'var(--success)' : 'var(--text-muted)',
            }}>
              {status === 'error' ? '✗ ' : status === 'done' ? '✓ ' : '→ '}{statusMsg}
            </div>
          )}

          {/* Meta fields */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Document Info</p>
            {[
              ['Name', 'name'],
              ['ID No', 'idNo'],
              ['Trade', 'tradeName'],
              ['Month/Year', 'monthYear'],
            ].map(([label, key]) => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>{label}</label>
                <input
                  value={meta[key as keyof typeof meta]}
                  onChange={e => setMeta(m => ({ ...m, [key]: e.target.value }))}
                  style={{
                    background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)',
                    fontFamily: 'var(--font-mono)', fontSize: '0.75rem', padding: '0.4rem 0.6rem', outline: 'none', borderRadius: 2,
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '1.25rem', display: 'flex', gap: '1rem' }}>
            {[['Total NT', 'totalNT'], ['Total OT', 'totalOT']].map(([label, key]) => (
              <div key={key} style={{ flex: 1 }}>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>{label}</label>
                <input
                  value={meta[key as keyof typeof meta]}
                  onChange={e => setMeta(m => ({ ...m, [key]: e.target.value }))}
                  style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1rem', padding: '0.4rem 0.6rem', outline: 'none', borderRadius: 2, textAlign: 'center' }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            ))}
          </div>

          {/* Instructions */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '1.25rem' }}>
            <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>How it works</p>
            {['Upload MFIT handwritten PDF', 'AI extracts all fields via Claude Vision', 'Review & correct any cells', 'Download formatted Excel sheet'].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent)', minWidth: 16 }}>{i + 1}.</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel - Table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, overflow: 'auto' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Timesheet Data</span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="tag">Editable</span>
              <button className="btn-ghost" onClick={() => setRows(defaultData())}>Reset</button>
            </div>
          </div>

          <div style={{ overflowX: 'auto', padding: '1rem' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.72rem' }}>
              <thead>
                <tr>
                  <th className="table-cell header" style={{ minWidth: 45 }}>DAY</th>
                  <th className="table-cell header" style={{ minWidth: 80 }}>IN TIME</th>
                  <th className="table-cell header" style={{ minWidth: 80 }}>OUT TIME</th>
                  {JOB_COLS.map(j => (
                    <>
                      <th key={`${j}-nt`} className="table-cell header" style={{ minWidth: 44 }}>{j}<br />NT</th>
                      <th key={`${j}-ot`} className="table-cell header" style={{ minWidth: 44 }}>{j}<br />OT</th>
                    </>
                  ))}
                  <th className="table-cell header" style={{ minWidth: 50 }}>TOT NT</th>
                  <th className="table-cell header" style={{ minWidth: 50 }}>TOT OT</th>
                  <th className="table-cell header" style={{ minWidth: 90 }}>REMARKS</th>
                  <th className="table-cell header" style={{ minWidth: 50 }}>SUNDAY</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.day} className={i === 0 ? 'slide-up' : ''}>
                    <td className={`table-cell ${row.isSunday ? 'sunday' : ''}`} style={{ fontWeight: 700, color: row.isSunday ? 'var(--error)' : 'var(--accent)' }}>
                      {row.day}
                    </td>
                    {(['inTime', 'outTime'] as const).map(f => (
                      <td key={f} className={`table-cell ${row.isSunday ? 'sunday' : ''}`}>
                        <input value={row[f]} onChange={e => updateCell(i, f, e.target.value)}
                          style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'inherit' }} />
                      </td>
                    ))}
                    {JOB_COLS.map(j => (
                      <>
                        <td key={`${j}-nt`} className={`table-cell ${row.isSunday ? 'sunday' : ''}`}>
                          <input value={row.jobs[j as keyof typeof row.jobs].nt} onChange={e => updateCell(i, 'jobs', e.target.value, j, 'nt')}
                            style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'inherit' }} />
                        </td>
                        <td key={`${j}-ot`} className={`table-cell ${row.isSunday ? 'sunday' : ''}`}>
                          <input value={row.jobs[j as keyof typeof row.jobs].ot} onChange={e => updateCell(i, 'jobs', e.target.value, j, 'ot')}
                            style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'inherit' }} />
                        </td>
                      </>
                    ))}
                    <td className={`table-cell ${row.isSunday ? 'sunday' : ''}`}>
                      <input value={row.totalNT} onChange={e => updateCell(i, 'totalNT', e.target.value)}
                        style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600 }} />
                    </td>
                    <td className={`table-cell ${row.isSunday ? 'sunday' : ''}`}>
                      <input value={row.totalOT} onChange={e => updateCell(i, 'totalOT', e.target.value)}
                        style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600 }} />
                    </td>
                    <td className={`table-cell ${row.isSunday ? 'sunday' : ''}`}>
                      <input value={row.remarks} onChange={e => updateCell(i, 'remarks', e.target.value)}
                        style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }} />
                    </td>
                    <td className={`table-cell ${row.isSunday ? 'sunday' : ''}`}>
                      <input type="checkbox" checked={row.isSunday} onChange={e => updateCell(i, 'isSunday', String(e.target.checked))}
                        style={{ accentColor: 'var(--error)', cursor: 'pointer' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <footer style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-dim)' }}>MFIT Interior Decoration LLC — Timesheet Automation</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-dim)' }}>Powered by Claude AI</span>
      </footer>
    </main>
  )
}
