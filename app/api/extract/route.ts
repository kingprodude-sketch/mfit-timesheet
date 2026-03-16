import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

const EXTRACTION_PROMPT = `You are reading a handwritten MFIT Job Time Sheet image.

READ the image carefully:
1. Find the actual job number column headers in the image (e.g. 953B, 956, 935, 959)
2. Read IN TIME and OUT TIME for each row
3. Read NT and OT values under each job column
4. Dashes or blank cells = use empty string ""
5. Convert ALL fractions to decimals: 3½=3.5, 2½=2.5, 1½=1.5, 8½=8.5
6. NEVER use ½ or any fraction characters in JSON values
7. ALL values must be plain strings like "8", "3.5", "2", ""

OUTPUT ONLY RAW JSON starting with { and ending with }. No text before or after:
{"meta":{"name":"","idNo":"","tradeName":"","monthYear":"","totalNT":"","totalOT":""},"jobColumns":["953B","956","935","959"],"rows":[{"day":"21","inTime":"","outTime":"","jobs":{"953B":{"nt":"","ot":""},"956":{"nt":"","ot":""},"935":{"nt":"","ot":""},"959":{"nt":"","ot":""}},"totalNT":"","totalOT":"","remarks":"","isSunday":false}]}

Replace jobColumns with ACTUAL job numbers from the image. Include all 31 rows.`

function sanitize(text: string): string {
  return text
    .replace(/(\d+)\s*½/g, (_, n) => String(parseFloat(n) + 0.5))
    .replace(/½/g, '0.5')
    .replace(/(\d+)\s*¼/g, (_, n) => String(parseFloat(n) + 0.25))
    .replace(/¼/g, '0.25')
    .replace(/(\d+)\s*¾/g, (_, n) => String(parseFloat(n) + 0.75))
    .replace(/¾/g, '0.75')
    // Remove control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

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

    let text = response.choices[0]?.message?.content || ''

    // Log around position 13470 where the error occurs
    console.log('Response length:', text.length)
    console.log('Around error position:', text.substring(13400, 13550))

    // Sanitize
    text = sanitize(text)

    // Strip text before { and after }
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
