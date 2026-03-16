import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

function buildPrompt(pageNum: number, totalPages: number) {
  return `You are reading page ${pageNum} of ${totalPages} of a handwritten MFIT Job Time Sheet.

READ this page carefully:
1. Find the job number column headers on THIS page (e.g. PG141-18, PG142-8, 978, 855, 993)
2. Check if IN TIME and OUT TIME columns exist on this page - they may not
3. Read NT and OT values for each job column per row
4. Dashes or empty = ""
5. Convert fractions: 3½=3.5, 2½=2.5, 8½=8.5
6. NEVER use ½ or fraction characters

Return ONLY raw JSON:
{"hasInOut":true,"jobColumns":["col1","col2"],"rows":[{"day":"21","inTime":"","outTime":"","jobs":{"col1":{"nt":"","ot":""},"col2":{"nt":"","ot":""}},"totalNT":"","totalOT":"","isSunday":false}]}

Rules:
- hasInOut = true only if IN TIME and OUT TIME columns exist on this page
- If hasInOut is false, set inTime and outTime to "" for all rows
- jobColumns = ACTUAL column headers from this page only
- Include all 31 rows (21-31 then 01-20)
- Empty string for blank/dash cells`
}

function sanitize(text: string): string {
  return text
    .replace(/(\d+)\s*½/g, (_, n) => String(parseFloat(n) + 0.5))
    .replace(/½/g, '0.5')
    .replace(/(\d+)\s*¼/g, (_, n) => String(parseFloat(n) + 0.25))
    .replace(/¼/g, '0.25')
    .replace(/(\d+)\s*¾/g, (_, n) => String(parseFloat(n) + 0.75))
    .replace(/¾/g, '0.75')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

async function extractPage(imageUrl: string, pageNum: number, totalPages: number) {
  const response = await client.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageUrl } },
        { type: 'text', text: buildPrompt(pageNum, totalPages) }
      ]
    }]
  } as any)

  let text = response.choices[0]?.message?.content || ''
  text = sanitize(text)
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1) throw new Error(`Page ${pageNum}: AI did not return valid JSON`)
  text = text.substring(firstBrace, lastBrace + 1)
  return JSON.parse(text)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { imageUrls, meta } = body

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json({ error: 'No valid images received.' }, { status: 400 })
    }

    // Extract each page separately
    const pages = await Promise.all(
      imageUrls.map((url: string, i: number) =>
        extractPage(url, i + 1, imageUrls.length)
      )
    )

    return NextResponse.json({ pages, meta })
  } catch (err: any) {
    console.error('Extraction error:', err.message)
    return NextResponse.json({ error: err.message || 'Extraction failed' }, { status: 500 })
  }
}
