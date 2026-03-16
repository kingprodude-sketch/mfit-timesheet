import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

const EXTRACTION_PROMPT = `You are reading a handwritten MFIT Job Time Sheet image.

READ the image carefully:
1. Find the job number column headers (e.g. 953B, 956, 935, 959)
2. Read IN TIME and OUT TIME for each row
3. Read NT and OT values under each job column for each row
4. Dashes mean empty - use ""
5. Read TOTAL NT and TOTAL OT for each row

OUTPUT ONLY RAW JSON - no text before or after, no "Here is", no markdown:
{"meta":{"name":"","idNo":"","tradeName":"","monthYear":"","totalNT":"","totalOT":""},"jobColumns":["953B","956","935","959"],"rows":[{"day":"21","inTime":"","outTime":"","jobs":{"953B":{"nt":"","ot":""},"956":{"nt":"","ot":""},"935":{"nt":"","ot":""},"959":{"nt":"","ot":""}},"totalNT":"","totalOT":"","remarks":"","isSunday":false}]}

Replace the job column names with the ACTUAL ones from the image header.
Include all 31 rows. Start JSON with { and end with }`

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
    console.log('Raw response start:', text.substring(0, 200))

    // Strip any text before the first { and after the last }
    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('AI did not return valid JSON structure')
    }
    text = text.substring(firstBrace, lastBrace + 1)

    // Also clean markdown fences just in case
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    const data = JSON.parse(text)
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('Extraction error:', err.message)
    return NextResponse.json({ error: err.message || 'Extraction failed' }, { status: 500 })
  }
}
