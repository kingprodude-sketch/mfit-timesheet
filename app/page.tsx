'use client'
import { useState, useRef, useEffect } from 'react'

const DAYS = [
  '21','22','23','24','25','26','27','28','29','30','31',
  '01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20'
]

type JobData = { [col: string]: { nt: string; ot: string } }
type Row = { day: string; inTime: string; outTime: string; jobs: JobData; totalNT: string; totalOT: string; isSunday: boolean }
type Page = { hasInOut: boolean; jobColumns: string[]; rows: Row[] }
type Meta = { name: string; idNo: string; tradeName: string; monthYear: string; totalNT: string; totalOT: string }

const defaultRow = (day: string, cols: string[]): Row => ({
  day, inTime: '', outTime: '',
  jobs: Object.fromEntries(cols.map(c => [c, { nt: '', ot: '' }])),
  totalNT: '', totalOT: '', isSunday: false
})
const defaultPage = (): Page => ({ hasInOut: true, jobColumns: ['Job1','Job2','Job3','Job4'], rows: DAYS.map(d => defaultRow(d, ['Job1','Job2','Job3','Job4'])) })
const defaultMeta = (): Meta => ({ name:'', idNo:'', tradeName:'', monthYear:'', totalNT:'', totalOT:'' })

export default function App() {
  const [pages, setPages] = useState<Page[]>([defaultPage()])
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
      document.head.appendChild(s)
    } catch(e) { console.error('useEffect error', e) }
  }, [])

  const pageToJpeg = async (pdf: any, pageNum: number): Promise<string> => {
    const page = await pdf.getPage(pageNum)
    const vp = page.getViewport({ scale: 2.5 })
    const canvas = document.createElement('canvas')
    canvas.width = vp.width; canvas.height = vp.height
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
    return canvas.toDataURL('image/jpeg', 0.92)
  }

  const toDataUrl = (f: File): Promise<string> => new Promise((res, rej) => {
    const r = new FileReader(); r.onload = e => res(e.target?.result as string); r.onerror = rej; r.readAsDataURL(f)
  })

  const extract = async () => {
    if (!file || busy) return
    setBusy(true); setDone(false)
    try {
      const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type.includes('pdf')
      let imageUrls: string[] = []

      if (isPdf) {
        setMsg('Loading PDF...')
        const pdfjs = (window as any).pdfjsLib
        if (!pdfjs) throw new Error('PDF engine not ready, please try again')
        const buf = await file.arrayBuffer()
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
        setMsg(`Converting ${pdf.numPages} page(s)...`)
        for (let i = 1; i <= pdf.numPages; i++) {
          imageUrls.push(await pageToJpeg(pdf, i))
        }
      } else {
        imageUrls = [await toDataUrl(file)]
      }

      setMsg('AI reading all pages...')
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Server error')

      // Map each page
      const mappedPages: Page[] = json.pages.map((p: any) => {
        const cols: string[] = p.jobColumns || ['Job1']
        const rows: Row[] = DAYS.map(day => {
          const r = p.rows?.find((x: any) => x.day === day)
          if (!r) return defaultRow(day, cols)
          const jobs: JobData = {}
          cols.forEach(c => { jobs[c] = { nt: r.jobs?.[c]?.nt || '', ot: r.jobs?.[c]?.ot || '' } })
          return { day, inTime: r.inTime || '', outTime: r.outTime || '', jobs, totalNT: r.totalNT || '', totalOT: r.totalOT || '', isSunday: r.isSunday || false }
        })
        return { hasInOut: p.hasInOut !== false, jobColumns: cols, rows }
      })

      setPages(mappedPages)

      // Get meta from first page response if available
      if (json.pages[0]?.meta) {
        setMeta(json.pages[0].meta)
      }

      setMsg(`✓ Extracted ${mappedPages.length} page(s)!`); setMsgType('ok')
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
        body: JSON.stringify({ pages, meta })
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

  const updJob = (pi: number, ri: number, col: string, sub: 'nt'|'ot', v: string) =>
    setPages(prev => prev.map((p, pi2) => pi2 !== pi ? p : {
      ...p, rows: p.rows.map((r, ri2) => ri2 !== ri ? r : {
        ...r, jobs: { ...r.jobs, [col]: { ...r.jobs[col], [sub]: v } }
      })
    }))

  const updRow = (pi: number, ri: number, k: keyof Row, v: string | boolean) =>
    setPages(prev => prev.map((p, pi2) => pi2 !== pi ? p : {
      ...p, rows: p.rows.map((r, ri2) => ri2 !== ri ? r : { ...r, [k]: v })
    }))

  const s = {
    th: { border:'1px solid #333', padding:'4px 6px', background:'#1e1e1e', color:'#666', fontSize:'0.62rem', textAlign:'center' as const, whiteSpace:'nowrap' as const },
    td: (sun: boolean): React.CSSProperties => ({ border:'1px solid #2a2a2a', padding:'1px 2px', background: sun ? 'rgba(239,68,68,0.07)' : 'transparent' }),
    inp: { background:'transparent', border:'none', outline:'none', width:'100%', textAlign:'center' as const, fontSize:'0.68rem', color:'#ccc', fontFamily:'monospace' } as React.CSSProperties,
    metaInp: { width:'100%', background:'#111', border:'1px solid #2a2a2a', color:'#ccc', fontFamily:'monospace', fontSize:'0.72rem', padding:'0.28rem 0.5rem', borderRadius:3, outline:'none', boxSizing:'border-box' as const } as React.CSSProperties,
  }

  return (
    <div style={{ minHeight:'100vh', padding:'1.5rem', maxWidth:1800, margin:'0 auto', fontFamily:'monospace', color:'#ccc' }}>
      <div style={{ marginBottom:'1.5rem' }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:'0.75rem' }}>
          <span style={{ fontSize:'2rem', fontWeight:900, color:'#d4a017' }}>MFIT</span>
          <span style={{ fontSize:'0.75rem', color:'#444', letterSpacing:'0.2em', textTransform:'uppercase' as const }}>Timesheet Extractor</span>
        </div>
        <p style={{ fontSize:'0.65rem', color:'#444', marginTop:'0.2rem' }}>Upload handwritten PDF → AI reads each page separately → Download Excel</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:'1.25rem', alignItems:'start' }}>
        {/* Left panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:'0.7rem', position:'sticky', top:'1rem' }}>
          <div style={{ background:'#1a1a1a', border:'2px dashed #333', borderRadius:6, padding:'1.5rem 1rem', textAlign:'center', cursor:'pointer' }}
            onClick={() => fileRef.current?.click()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if(f){ setFile(f); setMsg(''); setDone(false) }}}
            onDragOver={e => e.preventDefault()}>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:'none' }}
              onChange={e => { const f = e.target.files?.[0]; if(f){ setFile(f); setMsg(''); setDone(false) }}} />
            <div style={{ fontSize:'1.8rem', marginBottom:'0.4rem' }}>📄</div>
            {file ? (
              <>
                <div style={{ color:'#d4a017', fontSize:'0.75rem', fontWeight:700, wordBreak:'break-word' as const }}>{file.name}</div>
                <div style={{ color:'#555', fontSize:'0.6rem' }}>{(file.size/1024).toFixed(0)} KB — click to change</div>
              </>
            ) : (
              <>
                <div style={{ color:'#777', fontSize:'0.8rem', fontWeight:700 }}>Drop PDF or image</div>
                <div style={{ color:'#444', fontSize:'0.6rem' }}>or click to browse</div>
              </>
            )}
          </div>

          {!pdfReady && <div style={{ fontSize:'0.6rem', color:'#d4a017', textAlign:'center' as const }}>⏳ Loading PDF engine...</div>}

          <button disabled={busy || !file} onClick={extract}
            style={{ padding:'0.75rem', background: busy||!file ? '#333' : '#d4a017', color: busy||!file ? '#666' : '#000', fontWeight:800, fontSize:'0.8rem', border:'none', borderRadius:4, cursor: busy||!file ? 'not-allowed':'pointer', width:'100%' }}>
            {busy ? `⏳ ${msg}` : '⚡ EXTRACT WITH AI'}
          </button>

          {done && (
            <button onClick={download}
              style={{ padding:'0.75rem', background:'#22c55e', color:'#000', fontWeight:800, fontSize:'0.8rem', border:'none', borderRadius:4, cursor:'pointer', width:'100%' }}>
              ↓ DOWNLOAD EXCEL
            </button>
          )}

          {msg && !busy && (
            <div style={{ fontSize:'0.68rem', padding:'0.5rem 0.7rem', border:`1px solid ${msgType==='ok'?'#22c55e':msgType==='err'?'#ef4444':'#333'}`, color: msgType==='ok'?'#22c55e':msgType==='err'?'#ef4444':'#666', borderRadius:3, wordBreak:'break-word' as const }}>
              {msg}
            </div>
          )}

          <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:6, padding:'1rem' }}>
            <div style={{ fontSize:'0.6rem', color:'#444', letterSpacing:'0.1em', textTransform:'uppercase' as const, marginBottom:'0.6rem' }}>Document Info</div>
            {[['Name','name'],['ID No','idNo'],['Trade','tradeName'],['Month/Year','monthYear']].map(([l,k]) => (
              <div key={k} style={{ marginBottom:'0.45rem' }}>
                <div style={{ fontSize:'0.55rem', color:'#555', marginBottom:2 }}>{l}</div>
                <input style={s.metaInp} value={meta[k as keyof Meta]} onChange={e => setMeta(m => ({...m,[k]:e.target.value}))} />
              </div>
            ))}
            <div style={{ display:'flex', gap:'0.4rem', marginTop:'0.25rem' }}>
              {[['Total NT','totalNT'],['Total OT','totalOT']].map(([l,k]) => (
                <div key={k} style={{ flex:1 }}>
                  <div style={{ fontSize:'0.55rem', color:'#555', marginBottom:2 }}>{l}</div>
                  <input style={{ ...s.metaInp, color:'#d4a017', fontWeight:700, textAlign:'center' as const }} value={meta[k as keyof Meta]} onChange={e => setMeta(m => ({...m,[k]:e.target.value}))} />
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => { setPages([defaultPage()]); setMeta(defaultMeta()); setDone(false); setMsg('') }}
            style={{ padding:'0.5rem', background:'transparent', color:'#444', fontSize:'0.65rem', border:'1px solid #2a2a2a', borderRadius:4, cursor:'pointer', width:'100%' }}>
            Reset
          </button>
        </div>

        {/* Pages */}
        <div style={{ display:'flex', flexDirection:'column', gap:'2rem' }}>
          {pages.map((page, pi) => (
            <div key={pi} style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:6, overflow:'hidden' }}>
              <div style={{ padding:'0.6rem 1rem', borderBottom:'1px solid #2a2a2a', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:'0.7rem', color:'#555', letterSpacing:'0.1em' }}>
                  PAGE {pi + 1} — <span style={{ color:'#d4a017' }}>{page.jobColumns.join(', ')}</span>
                  {!page.hasInOut && <span style={{ color:'#666', marginLeft:'0.5rem' }}>(no in/out times)</span>}
                </span>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ borderCollapse:'collapse', width:'100%' }}>
                  <thead>
                    <tr>
                      <th style={s.th}>DAY</th>
                      {page.hasInOut && <><th style={s.th}>IN</th><th style={s.th}>OUT</th></>}
                      {page.jobColumns.map(c => (<>
                        <th key={c+'nt'} style={s.th}>{c}<br/>NT</th>
                        <th key={c+'ot'} style={s.th}>{c}<br/>OT</th>
                      </>))}
                      <th style={s.th}>TOT NT</th>
                      <th style={s.th}>TOT OT</th>
                      <th style={s.th}>SUN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.rows.map((r, ri) => (
                      <tr key={r.day}>
                        <td style={{ ...s.td(r.isSunday), fontWeight:700, color: r.isSunday?'#ef4444':'#d4a017', textAlign:'center' as const, fontSize:'0.72rem', minWidth:28 }}>{r.day}</td>
                        {page.hasInOut && <>
                          <td style={{ ...s.td(r.isSunday), minWidth:62 }}><input style={s.inp} value={r.inTime} onChange={e => updRow(pi,ri,'inTime',e.target.value)} /></td>
                          <td style={{ ...s.td(r.isSunday), minWidth:62 }}><input style={s.inp} value={r.outTime} onChange={e => updRow(pi,ri,'outTime',e.target.value)} /></td>
                        </>}
                        {page.jobColumns.map(c => (<>
                          <td key={c+'nt'} style={{ ...s.td(r.isSunday), minWidth:36 }}><input style={s.inp} value={r.jobs[c]?.nt||''} onChange={e => updJob(pi,ri,c,'nt',e.target.value)} /></td>
                          <td key={c+'ot'} style={{ ...s.td(r.isSunday), minWidth:36 }}><input style={s.inp} value={r.jobs[c]?.ot||''} onChange={e => updJob(pi,ri,c,'ot',e.target.value)} /></td>
                        </>))}
                        <td style={{ ...s.td(r.isSunday), minWidth:42 }}><input style={{ ...s.inp, color:'#d4a017' }} value={r.totalNT} onChange={e => updRow(pi,ri,'totalNT',e.target.value)} /></td>
                        <td style={{ ...s.td(r.isSunday), minWidth:42 }}><input style={{ ...s.inp, color:'#d4a017' }} value={r.totalOT} onChange={e => updRow(pi,ri,'totalOT',e.target.value)} /></td>
                        <td style={{ ...s.td(r.isSunday), textAlign:'center' as const, minWidth:28 }}>
                          <input type="checkbox" checked={r.isSunday} onChange={e => updRow(pi,ri,'isSunday',e.target.checked)} style={{ accentColor:'#ef4444' }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop:'1.5rem', paddingTop:'0.75rem', borderTop:'1px solid #1e1e1e', display:'flex', justifyContent:'space-between', fontSize:'0.6rem', color:'#333' }}>
        <span>MFIT Interior Decoration LLC</span>
        <span>Powered by Groq AI</span>
      </div>
    </div>
  )
}
