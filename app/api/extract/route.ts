import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

const EXTRACTION_PROMPT = `You are reading a handwritten MFIT Job Time Sheet. Multiple images of the same sheet may be provided (different pages or sections).

READ all images carefully and combine the data:
1. Find the actual job number column headers (e.g. 953B, 956, 935, 959)
2. Read IN TIME and OUT TIME for each row
3. Read NT and OT values under each job column
4. Dashes or empty = ""
5. Convert fractions to decimals: 3½=3.5, 2½=2.5, 8½=8.5
6. NEVER use ½ or fraction characters

Return ONLY raw JSON, no text before or after:
{"meta":{"name":"","idNo":"","tradeName":"","monthYear":"","totalNT":"","totalOT":""},"jobColumns":["953B","956","935","959"],"rows":[{"day":"21","inTime":"","outTime":"","jobs":{"953B":{"nt":"","ot":""},"956":{"nt":"","ot":""},"935":{"nt":"","ot":""},"959":{"nt":"","ot":""}},"totalNT":"","totalOT":"","isSunday":false}]}

Use ACTUAL job numbers from image. Include all 31 rows (21-31 then 01-20).`

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { imageUrls } = body

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json({ error: 'No valid images received.' }, { status: 400 })
    }

    // Build content array with all images
    const content: any[] = imageUrls.map((url: string) => ({
      type: 'image_url',
      image_url: { url }
    }))
    content.push({ type: 'text', text: EXTRACTION_PROMPT })

    const response = await client.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 8000,
      messages: [{ role: 'user', content }]
    } as any)

    let text = response.choices[0]?.message?.content || ''
    console.log('Response length:', text.length)

    text = sanitize(text)

    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('AI did not return valid JSON')
    }
    text = text.substring(firstBrace, lastBrace + 1)

    const data = JSON.parse(text)
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('Extraction error:', err.message)
    return NextResponse.json({ error: err.message || 'Extraction failed' }, { status: 500 })
  }
}
