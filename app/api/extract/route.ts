import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

const EXTRACTION_PROMPT = `You are extracting data from a handwritten MFIT Interior Decoration LLC Job Time Sheet image. Read every handwritten value carefully including times, numbers and fractions like 3½.

Return ONLY valid JSON, no markdown, no explanation:
{
  "meta": { "name": "", "idNo": "", "tradeName": "", "monthYear": "", "totalNT": "", "totalOT": "" },
  "rows": [
    {
      "day": "21", "inTime": "", "outTime": "",
      "jobs": {
        "953B": { "nt": "", "ot": "" },
        "956": { "nt": "", "ot": "" },
        "935": { "nt": "", "ot": "" },
        "959": { "nt": "", "ot": "" }
      },
      "totalNT": "", "totalOT": "", "remarks": "", "isSunday": false
    }
  ]
}
Include all 31 rows (days 21-31 then 01-20). Empty string for blank cells. isSunday true for Sunday rows.`

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('pdf') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const response = await client.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}` }
            },
            { type: 'text', text: EXTRACTION_PROMPT }
          ]
        }
      ]
    } as any)

    const text = response.choices[0]?.message?.content || ''
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const data = JSON.parse(clean)
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('Extraction error:', err)
    return NextResponse.json({ error: err.message || 'Extraction failed' }, { status: 500 })
  }
}
