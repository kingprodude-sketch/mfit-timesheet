import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { rows, meta } = await req.json()

    const wb = XLSX.utils.book_new()
    const wsData: any[][] = []

    // Header rows
    wsData.push(['MFIT INTERIOR DECORATION LLC'])
    wsData.push(['JOB TIME SHEET'])
    wsData.push([
      'ID NO:', meta.idNo || '',
      'NAME:', meta.name || '',
      'TRADE NAME:', meta.tradeName || '',
      'MONTH/YEAR:', meta.monthYear || ''
    ])
    wsData.push([]) // spacer

    // Column headers
    wsData.push([
      'JOB NO.', 'IN TIME', 'OUT TIME',
      '953B NT', '953B OT',
      '956 NT', '956 OT',
      '935 NT', '935 OT',
      '959 NT', '959 OT',
      'TOTAL NT', 'TOTAL OT',
      'REMARKS'
    ])

    // Data rows
    for (const row of rows) {
      if (row.isSunday) {
        wsData.push([row.day, '', '', '', '', '', '', '', '', '', '', '', '', 'SUNDAY'])
      } else {
        wsData.push([
          row.day,
          row.inTime || '',
          row.outTime || '',
          row.jobs?.['953B']?.nt || '',
          row.jobs?.['953B']?.ot || '',
          row.jobs?.['956']?.nt || '',
          row.jobs?.['956']?.ot || '',
          row.jobs?.['935']?.nt || '',
          row.jobs?.['935']?.ot || '',
          row.jobs?.['959']?.nt || '',
          row.jobs?.['959']?.ot || '',
          row.totalNT || '',
          row.totalOT || '',
          row.remarks || '',
        ])
      }
    }

    // Total row
    wsData.push(['TOTAL', '', '', '', '', '', '', '', '', '', '', meta.totalNT || '', meta.totalOT || '', ''])
    wsData.push([])
    wsData.push([`NOTE: Normal Time (NT) = ${meta.totalNT || ''}    |    HOT (OT) = ${meta.totalOT || ''}`])
    wsData.push([])
    wsData.push(['EMPLOYEE SIGNATURE: ___________________________', '', '', '', '', '', '', '', 'VERIFIED BY: ___________________________'])

    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Column widths
    ws['!cols'] = [
      { wch: 8 }, { wch: 12 }, { wch: 12 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 10 }, { wch: 10 }, { wch: 16 }
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Timesheet')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const fileName = `${meta.name || 'Timesheet'}_${meta.monthYear || 'export'}.xlsx`
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_')

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (err: any) {
    console.error('Export error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
