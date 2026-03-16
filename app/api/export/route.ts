import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { rows, meta, jobCols } = await req.json()
    const cols: string[] = jobCols || ['953B','956','935','959']

    const wb = XLSX.utils.book_new()

    // Header rows
    const headerData = [
      ['MFIT INTERIOR DECORATION LLC'],
      ['JOB TIME SHEET'],
      ['Name:', meta.name, '', 'ID No:', meta.idNo, '', 'Trade:', meta.tradeName, '', 'Month/Year:', meta.monthYear],
      [],
    ]

    // Table header
    const colHeaders = ['DAY', 'IN TIME', 'OUT TIME']
    cols.forEach(c => { colHeaders.push(`${c} NT`); colHeaders.push(`${c} OT`) })
    colHeaders.push('TOTAL NT', 'TOTAL OT', 'REMARKS')
    headerData.push(colHeaders as any)

    // Data rows
    const dataRows = rows.map((r: any) => {
      const row: any[] = [r.day, r.inTime, r.outTime]
      cols.forEach(c => {
        row.push(r.jobs?.[c]?.nt || '')
        row.push(r.jobs?.[c]?.ot || '')
      })
      row.push(r.totalNT, r.totalOT, r.remarks)
      return row
    })

    // Totals row
    const totalsRow: any[] = ['TOTAL', '', '']
    cols.forEach(() => { totalsRow.push('', '') })
    totalsRow.push(meta.totalNT, meta.totalOT, '')

    const allData = [...headerData, ...dataRows, [], totalsRow]
    const ws = XLSX.utils.aoa_to_sheet(allData)

    // Column widths
    ws['!cols'] = [
      { wch: 6 }, { wch: 10 }, { wch: 10 },
      ...cols.flatMap(() => [{ wch: 8 }, { wch: 8 }]),
      { wch: 10 }, { wch: 10 }, { wch: 20 }
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Timesheet')
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
