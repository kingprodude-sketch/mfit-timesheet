import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EXTRACTION_PROMPT = `You are extracting data from a handwritten MFIT Interior Decoration LLC Job Time Sheet PDF.

The form has these fields at the top:
- ID NO (employee ID)
- NAME (employee name)
- TRADE NAME (job trade, e.g. CARPENTER)
- MONTH/YEAR (period, e.g. SEP/OCT)

The table has columns:
- JOB NO (day number, 21-31 for Sep, 01-20 for Oct)
- IN TIME (start time)
- OUT TIME (end time)
- For each job number (953B, 956, 935, 959): NT (normal time) and OT (overtime)
- TOTAL NT and TOTAL OT
- REMARKS

At the bottom there may be totals like "NOT 77.5" (normal overall total) and "HOT 20" (overtime overall total).

Extract ALL data and return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "meta": {
    "name": "",
    "idNo": "",
    "tradeName": "",
    "monthYear": "",
    "totalNT": "",
    "totalOT": ""
  },
  "rows": [
    {
      "day": "21",
      "inTime": "6:00 PM",
      "outTime": "12:00 PM",
      "jobs": {
        "953B": { "nt": "", "ot": "5" },
        "956": { "nt": "", "ot": "" },
        "935": { "nt": "", "ot": "" },
        "959": { "nt": "", "ot": "" }
      },
      "totalNT": "",
      "totalOT": "5",
      "remarks": "MULESH",
      "isSunday": false
    }
  ]
}

Rules:
- Use fractions like "3½" not "3.5"  
- Use "—" or "" for empty dashes
- If a row is SUNDAY, set isSunday: true and leave fields empty
- Include all 31 rows (days 21-31 Sep + days 01-20 Oct)
- day field should be zero-padded string like "01", "21"
- Return ONLY the JSON object, nothing else`

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('pdf') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text)
      .join('')

    // Strip any accidental markdown fences
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const data = JSON.parse(clean)

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('Extraction error:', err)
    return NextResponse.json({ error: err.message || 'Extraction failed' }, { status: 500 })
  }
}
