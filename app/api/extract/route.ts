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
5. IMPORTANT: Convert ALL fractions to decimals: 3½ = "3.5", 2½ = "2.5", 1½ = "1.5", 8½ = "8.5"
6. NEVER use ½ or fraction characters in JSON values

OUTPUT ONLY RAW JSON starting with { and ending with }. No text before or after:
{"meta":{"name":"","idNo":"","tradeName":"","monthYear":"","totalNT":"","totalOT":""},"jobColumns":["953B","956","935","959"],"rows":[{"day":"21","inTime":"","outTime":"","jobs":{"953B":{"nt":"","ot":""},"956":{"nt":"","ot":""},"935":{"nt":"","ot":""},"959":{"nt":"","ot":""}},"totalNT":"","totalOT":"","remarks":"","isSunday":false}]}

Replace jobColumns with the ACTUAL job numbers from the image. Include all 31 rows.`

function fixFractions(text: string): string {
  // Replace fraction characters with decimals
  return text
    .replace(/(\d+)½/g, (_, n) => String(parseFloat(n) + 0.5))
    .replace(/½/g, '0.5')
    .replace(/(\d+)¼/g, (_, n) => String(parseFloat(n) + 0.25))
    .replace(/¼/g, '0.25')
    .replace(/(\d+)¾/g, (_, n) => String(parseFloat(n) + 0.75))
    .replace(/¾/g, '0.75')
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

    // Fix fraction characters before parsing
    text = fixFractions(text)

    // Strip any text before { and after }
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
