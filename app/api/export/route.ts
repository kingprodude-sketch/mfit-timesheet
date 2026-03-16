import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { pages, meta } = await req.json()
    const wb = XLSX.utils.book_new()

    pages.forEach((page: any, pi: number) => {
      const cols: string[] = page.jobColumns || []
      const hasInOut: boolean = page.hasInOut !== false

      const headerData: any[][] = [
        ['MFIT INTERIOR DECORATION LLC'],
        ['JOB TIME SHEET'],
        ['Name:', meta.name, 'ID No:', meta.idNo, 'Trade:', meta.tradeName, 'Month/Year:', meta.monthYear],
        [`Page ${pi + 1} — Jobs: ${cols.join(', ')}`],
        []
      ]

      // Table header
      const colHeaders: string[] = ['DAY']
      if (hasInOut) { colHeaders.push('IN TIME', 'OUT TIME') }
      cols.forEach(c => { colHeaders.push(`${c} NT`, `${c} OT`) })
      colHeaders.push('TOTAL NT', 'TOTAL OT')
      headerData.push(colHeaders)

      // Data rows
      const dataRows = page.rows.map((r: any) => {
        const row: any[] = [r.day]
        if (hasInOut) { row.push(r.inTime || '', r.outTime || '') }
        cols.forEach(c => { row.push(r.jobs?.[c]?.nt || '', r.jobs?.[c]?.ot || '') })
        row.push(r.totalNT || '', r.totalOT || '')
        return row
      })

      const allData = [...headerData, ...dataRows]
      const ws = XLSX.utils.aoa_to_sheet(allData)

      // Column widths
      const widths: any[] = [{ wch: 6 }]
      if (hasInOut) { widths.push({ wch: 10 }, { wch: 10 }) }
      cols.forEach(() => { widths.push({ wch: 8 }, { wch: 8 }) })
      widths.push({ wch: 10 }, { wch: 10 })
      ws['!cols'] = widths

      XLSX.utils.book_append_sheet(wb, ws, `Page ${pi + 1}`)
    })

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${meta.name || 'timesheet'}.xlsx"`
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
