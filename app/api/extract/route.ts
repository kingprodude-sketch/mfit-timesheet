import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

const EXTRACTION_PROMPT = `You are extracting data from a handwritten MFIT Interior Decoration LLC Job Time Sheet image. Read every handwritten value carefully including times, numbers and fractions like 3.5 or 3½.

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
    const body = await req.json()
    const { imageUrl } = body

    if (!imageUrl || !imageUrl.startsWith('data:')) {
      return NextResponse.json({ error: 'No valid image received. Please wait a moment for PDF.js to load and try again.' }, { status: 400 })
    }

    console.log('Image URL length:', imageUrl.length)
    console.log('Image type:', imageUrl.substring(0, 30))

    const response = await client.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            },
            { type: 'text', text: EXTRACTION_PROMPT }
          ]
        }
      ]
    } as any)

    const text = response.choices[0]?.message?.content || ''
    console.log('Groq response length:', text.length)

    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const data = JSON.parse(clean)
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('Extraction error:', err.message)
    return NextResponse.json({ error: err.message || 'Extraction failed' }, { status: 500 })
  }
}
