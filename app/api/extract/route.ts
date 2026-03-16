import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

const EXTRACTION_PROMPT = `You are extracting data from a handwritten MFIT Interior Decoration LLC Job Time Sheet image.

IMPORTANT: The job number columns vary per timesheet. Read the actual column headers from the image carefully.

Return ONLY valid JSON, no markdown, no explanation:
{
  "meta": {
    "name": "",
    "idNo": "",
    "tradeName": "",
    "monthYear": "",
    "totalNT": "",
    "totalOT": ""
  },
  "jobColumns": ["764", "782", "963"],
  "rows": [
    {
      "day": "21",
      "inTime": "",
      "outTime": "",
      "jobs": {
        "764": { "nt": "8", "ot": "2" },
        "782": { "nt": "", "ot": "" },
        "963": { "nt": "", "ot": "" }
      },
      "totalNT": "8",
      "totalOT": "2",
      "remarks": "",
      "isSunday": false
    }
  ]
}

Rules:
- Read the ACTUAL job number column headers from the image (e.g. 764, 782, 963, 968, 993)
- List them in "jobColumns" array in the order they appear
- Each row's "jobs" object must have a key for EVERY job column
- Include all 31 rows (days 21-31 then 01-20)
- Empty string for blank cells
- Set isSunday true for Sunday rows`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { imageUrl } = body

    if (!imageUrl || !imageUrl.startsWith('data:')) {
      return NextResponse.json({ error: 'No valid image received.' }, { status: 400 })
    }

    const response = await client.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
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
    console.error('Extraction error:', err.message)
    return NextResponse.json({ error: err.message || 'Extraction failed' }, { status: 500 })
  }
}
