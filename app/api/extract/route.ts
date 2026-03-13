import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EXTRACTION_PROMPT = `You are extracting data from a handwritten MFIT Interior Decoration LLC Job Time Sheet PDF.

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
      "inTime": "",
      "outTime": "",
      "jobs": {
        "953B": { "nt": "", "ot": "" },
        "956": { "nt": "", "ot": "" },
        "935": { "nt": "", "ot": "" },
        "959": { "nt": "", "ot": "" }
      },
      "totalNT": "",
      "totalOT": "",
      "remarks": "",
      "isSunday": false
    }
  ]
}`

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
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64,
              },
            } as any,
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    })

    const text = response.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')

    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const data = JSON.parse(clean)
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('Extraction error:', err)
    return NextResponse.json({ error: err.message || 'Extraction failed' }, { status: 500 })
  }
}
