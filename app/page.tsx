'use client'
import { useState, useRef, useEffect } from 'react'

const DAYS = [
  '21','22','23','24','25','26','27','28','29','30','31',
  '01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20'
]
const JOBS = ['953B','956','935','959']

function emptyRow(day: string) {
  return {
    day, inTime: '', outTime: '',
    j953B_nt:'', j953B_ot:'',
    j956_nt:'', j956_ot:'',
    j935_nt:'', j935_ot:'',
    j959_nt:'', j959_ot:'',
    totalNT:'', totalOT:'', remarks:'', isSunday: false
  }
}

type Row = ReturnType<typeof emptyRow>
type Meta = { name:string, idNo:string, tradeName:string, monthYear:string, totalNT:string, totalOT:string }

const defaultRows = () => DAYS.map(emptyRow)
const defaultMeta = (): Meta => ({ name:'', idNo:'', tradeName:'', monthYear:'', totalNT:'', totalOT:'' })

export default function App() {
  const [rows, setRows] = useState<Row[]>(defaultRows())
  const [meta, setMeta] = useState<Meta>(defaultMeta())
  const [file, setFile] = useState<File | null>(null)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'info'|'ok'|'err'>('info')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [pdfReady, setPdfReady] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      if ((window as any).pdfjsLib) { setPdfReady(true); return }
      const s = document.createElement('script')
      s.src = '/pdf.min.js'
      s.onload = () => {
        try {
          ;(window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
          setPdfReady(true)
        } catch(e) { console.error('PDF worker error', e) }
      }
      s.onerror = (e) => console.error('PDF script load error', e)
      document.head.appendChild(s)
    } catch(e) { console.error('useEffect error', e) }
  }, [])

  const pickFile = (f: File) => {
    setFile(f)
    setMsg('')
    setDone(false)
  }

  const toDataUrl = (f: File): Promise<string> => new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = e => res(e.target?.result as string)
    reader.onerror = rej
    reader.readAsDataURL(f)
  })

  const pdfToJpeg = async (f: File): Promise<string> => {
    const pdfjs = (window as any).pdfjsLib
    if (!pdfjs) throw new Error('PDF engine not ready, please try again')
    const buf = await f.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
    const page = await pdf.getPage(1)
    const vp = page.getViewport({ scale: 2.5 })
    const canvas = document.createElement('canvas')
    canvas.width = vp.width
    canvas.height = vp.height
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
    return canvas.toDataURL('image/jpeg', 0.92)
  }

  const extract = async () => {
    if (!file || busy) return
    setBusy(true); setDone(false)
    try {
      setMsg('Converting PDF...'); setMsgType('info')
      const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type.includes('pdf')
      const imageUrl = isPdf ? await pdfToJpeg(file) : await toDataUrl(file)

      setMsg('AI reading handwriting...')
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Server error')

      // Map JSON rows to flat row format
      const mapped: Row[] = DAYS.map(day => {
        const r = json.rows?.find((x: any) => x.day === day)
        if (!r) return emptyRow(day)
        return {
          day,
          inTime: r.inTime || '',
          outTime: r.outTime || '',
          j953B_nt: r.jobs?.['953B']?.nt || '',
          j953B_ot: r.jobs?.['953B']?.ot || '',
          j956_nt: r.jobs?.['956']?.nt || '',
          j956_ot: r.jobs?.['956']?.ot || '',
          j935_nt: r.jobs?.['935']?.nt || '',
          j935_ot: r.jobs?.['935']?.ot || '',
          j959_nt: r.jobs?.['959']?.nt || '',
          j959_ot: r.jobs?.['959']?.ot || '',
          totalNT: r.totalNT || '',
          totalOT: r.totalOT || '',
          remarks: r.remarks || '',
          isSunday: r.isSunday || false
        }
      })
      setRows(mapped)
      setMeta({
        name: json.meta?.name || '',
        idNo: json.meta?.idNo || '',
        tradeName: json.meta?.tradeName || '',
        monthYear: json.meta?.monthYear || '',
        totalNT: json.meta?.totalNT || '',
        totalOT: json.meta?.totalOT || '',
      })
      setMsg('✓ Extraction complete!'); setMsgType('ok')
      setDone(true)
    } catch(e: any) {
      setMsg(e.message || 'Failed'); setMsgType('err')
    } finally {
      setBusy(false)
    }
  }

  const download = async () => {
    setMsg('Building Excel...'); setMsgType('info')
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, meta })
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${meta.name || 'Timesheet'}_${meta.monthYear || 'export'}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      setMsg('✓ Downloaded!'); setMsgType('ok')
    } catch(e: any) {
      setMsg(e.message); setMsgType('err')
    }
  }

  const upd = (i: number, k: keyof Row, v: string | boolean) =>
    setRows(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r))

  const s = {
    page: { minHeight:'100vh', padding:'1.5rem', maxWidth:1500, margin:'0 auto', fontFamily:'monospace' } as React.CSSProperties,
    card: { background:'#1a1a1a', border:'1px solid #333', borderRadius:6, padding:'1.25rem' } as React.CSSProperties,
    btn: (color: string, disabled?: boolean): React.CSSProperties => ({
      width:'100%', padding:'0.8rem', background: disabled ? '#555' : color,
      color: color === '#d4a017' || color === '#22c55e' ? '#000' : '#fff',
      fontWeight:800, fontSize:'0.85rem', letterSpacing:'0.08em',
      border:'none', borderRadius:4, cursor: disabled ? 'not-allowed' : 'pointer'
    }),
    th: { border:'1px solid #333', padding:'4px 6px', background:'#222', color:'#888', fontSize:'0.65rem', textAlign:'center' as const, whiteSpace:'nowrap' as const },
    td: (sunday: boolean): React.CSSProperties => ({ border:'1px solid #2a2a2a', padding:'1px 3px', background: sunday ? 'rgba(239,68,68,0.07)' : 'transparent' }),
    inp: { background:'transparent', border:'none', outline:'none', width:'100%', textAlign:'center' as const, fontSize:'0.68rem', color:'#ccc', fontFamily:'monospace' } as React.CSSProperties,
    label: { fontSize:'0.6rem', color:'#666', letterSpacing:'0.08em', textTransform:'uppercase' as const, display:'block', marginBottom:3 } as React.CSSProperties,
    metaInp: { width:'100%', background:'#111', border:'1px solid #333', color:'#ccc', fontFamily:'monospace', fontSize:'0.75rem', padding:'0.3rem 0.5rem', borderRadius:3, outline:'none', boxSizing:'border-box' as const } as React.CSSProperties,
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ marginBottom:'2rem' }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:'0.75rem' }}>
          <span style={{ fontSize:'2rem', fontWeight:900, color:'#d4a017', letterSpacing:'-0.02em' }}>MFIT</span>
          <span style={{ fontSize:'0.8rem', color:'#555', letterSpacing:'0.2em', textTransform:'uppercase' as const }}>Timesheet Extractor</span>
        </div>
        <p style={{ fontSize:'0.7rem', color:'#444', marginTop:'0.2rem' }}>Upload handwritten PDF → AI reads it → Download Excel</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:'1.5rem', alignItems:'start' }}>
        {/* Left panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
          {/* Drop zone */}
          <div style={{ ...s.card, textAlign:'center', cursor:'pointer', border:'2px dashed #333' }}
            onClick={() => fileRef.current?.click()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if(f) pickFile(f) }}
            onDragOver={e => e.preventDefault()}>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:'none' }}
              onChange={e => { const f = e.target.files?.[0]; if(f) pickFile(f) }} />
            <div style={{ fontSize:'1.8rem', marginBottom:'0.4rem' }}>📄</div>
            {file ? (
              <>
                <div style={{ color:'#d4a017', fontSize:'0.8rem', fontWeight:700, wordBreak:'break-word' as const }}>{file.name}</div>
                <div style={{ color:'#555', fontSize:'0.65rem' }}>{(file.size/1024).toFixed(0)} KB — click to change</div>
              </>
            ) : (
              <>
                <div style={{ color:'#888', fontSize:'0.85rem', fontWeight:700 }}>Drop PDF or image here</div>
                <div style={{ color:'#555', fontSize:'0.65rem' }}>or click to browse</div>
              </>
            )}
          </div>

          {!pdfReady && <div style={{ fontSize:'0.65rem', color:'#d4a017', textAlign:'center' as const }}>⏳ Loading PDF engine...</div>}

          <button style={s.btn('#d4a017', busy || !file)} onClick={extract} disabled={busy || !file}>
            {busy ? `⏳ ${msg}` : '⚡ EXTRACT WITH AI'}
          </button>

          {done && <button style={s.btn('#22c55e')} onClick={download}>↓ DOWNLOAD EXCEL</button>}

          {msg && !busy && (
            <div style={{ fontSize:'0.7rem', padding:'0.5rem 0.75rem', border:`1px solid ${msgType==='ok'?'#22c55e':msgType==='err'?'#ef4444':'#333'}`, color: msgType==='ok'?'#22c55e':msgType==='err'?'#ef4444':'#888', borderRadius:3, wordBreak:'break-word' as const }}>
              {msg}
            </div>
          )}

          {/* Meta */}
          <div style={s.card}>
            <div style={{ fontSize:'0.65rem', color:'#555', letterSpacing:'0.1em', textTransform:'uppercase' as const, marginBottom:'0.75rem' }}>Document Info</div>
            {(['name','idNo','tradeName','monthYear'] as const).map(k => (
              <div key={k} style={{ marginBottom:'0.5rem' }}>
                <label style={s.label}>{k === 'idNo' ? 'ID No' : k === 'tradeName' ? 'Trade' : k === 'monthYear' ? 'Month/Year' : 'Name'}</label>
                <input style={s.metaInp} value={meta[k]} onChange={e => setMeta(m => ({...m, [k]: e.target.value}))} />
              </div>
            ))}
            <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.25rem' }}>
              {(['totalNT','totalOT'] as const).map(k => (
                <div key={k} style={{ flex:1 }}>
                  <label style={s.label}>{k === 'totalNT' ? 'Total NT' : 'Total OT'}</label>
                  <input style={{ ...s.metaInp, color:'#d4a017', fontWeight:700, textAlign:'center' as const }} value={meta[k]} onChange={e => setMeta(m => ({...m, [k]: e.target.value}))} />
                </div>
              ))}
            </div>
          </div>

          <button style={{ ...s.btn('#333'), color:'#888', fontSize:'0.7rem' }} onClick={() => { setRows(defaultRows()); setMeta(defaultMeta()); setDone(false); setMsg('') }}>
            Reset Table
          </button>
        </div>

        {/* Table */}
        <div style={{ ...s.card, padding:0, overflow:'hidden' }}>
          <div style={{ padding:'0.75rem 1rem', borderBottom:'1px solid #333', fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.1em', color:'#888' }}>
            TIMESHEET DATA <span style={{ color:'#444', fontWeight:400, fontSize:'0.65rem', marginLeft:'0.5rem' }}>— all cells editable</span>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ borderCollapse:'collapse', width:'100%' }}>
              <thead>
                <tr>
                  <th style={s.th}>DAY</th>
                  <th style={s.th}>IN</th>
                  <th style={s.th}>OUT</th>
                  <th style={s.th}>953B NT</th><th style={s.th}>953B OT</th>
                  <th style={s.th}>956 NT</th><th style={s.th}>956 OT</th>
                  <th style={s.th}>935 NT</th><th style={s.th}>935 OT</th>
                  <th style={s.th}>959 NT</th><th style={s.th}>959 OT</th>
                  <th style={s.th}>TOT NT</th>
                  <th style={s.th}>TOT OT</th>
                  <th style={s.th}>REMARKS</th>
                  <th style={s.th}>SUN</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.day}>
                    <td style={{ ...s.td(r.isSunday), fontWeight:700, color: r.isSunday ? '#ef4444' : '#d4a017', textAlign:'center' as const, fontSize:'0.72rem', minWidth:32 }}>{r.day}</td>
                    {(['inTime','outTime','j953B_nt','j953B_ot','j956_nt','j956_ot','j935_nt','j935_ot','j959_nt','j959_ot','totalNT','totalOT'] as const).map(k => (
                      <td key={k} style={{ ...s.td(r.isSunday), minWidth: k.includes('Time') ? 65 : 38 }}>
                        <input style={s.inp} value={r[k] as string} onChange={e => upd(i, k, e.target.value)} />
                      </td>
                    ))}
                    <td style={{ ...s.td(r.isSunday), minWidth:80 }}>
                      <input style={{ ...s.inp, textAlign:'left' as const }} value={r.remarks} onChange={e => upd(i, 'remarks', e.target.value)} />
                    </td>
                    <td style={{ ...s.td(r.isSunday), textAlign:'center' as const, minWidth:32 }}>
                      <input type="checkbox" checked={r.isSunday} onChange={e => upd(i, 'isSunday', e.target.checked)} style={{ accentColor:'#ef4444' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ marginTop:'2rem', paddingTop:'1rem', borderTop:'1px solid #222', display:'flex', justifyContent:'space-between', fontSize:'0.62rem', color:'#444' }}>
        <span>MFIT Interior Decoration LLC</span>
        <span>Powered by Groq AI</span>
      </div>
    </div>
  )
}
