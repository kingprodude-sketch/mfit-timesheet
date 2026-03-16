import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

const EXTRACTION_PROMPT = `You are reading a handwritten MFIT Job Time Sheet image.

STEP 1 - Read the column headers row carefully:
- There is a "JOB NO." section with multiple job number columns (e.g. 953, 956, 935, 959 OR 764, 782, 963, 968, 993 etc.)
- Each job number has TWO sub-columns: NT (normal time) and OT (overtime)
- There is also IN TIME, OUT TIME, TOTAL NT, TOTAL OT, REMARKS

STEP 2 - Read each row carefully:
- Each row is one day (21-31 then 01-20)
- Read the IN TIME and OUT TIME (e.g. "7:00Am", "6:15Pm")
- For each job column, read the NT and OT values (numbers like 8, 2, 3½, 5, etc.)
- Dashes "—" mean empty/zero, write ""
- Read TOTAL NT and TOTAL OT at the end of each row

STEP 3 - Return ONLY this JSON, no markdown, no explanation:
{
  "meta": {
    "name": "DURGA RAM",
    "idNo": "TE2501989",
    "tradeName": "CARPENTER",
    "monthYear": "SEP/OCT",
    "totalNT": "77.5",
    "totalOT": "20"
  },
  "jobColumns": ["953B", "956", "935", "959"],
  "rows": [
    {
      "day": "21",
      "inTime": "7:00AM",
      "outTime": "6:15PM",
      "jobs": {
        "953B": { "nt": "8", "ot": "2" },
        "956": { "nt": "", "ot": "" },
        "935": { "nt": "", "ot": "" },
        "959": { "nt": "", "ot": "" }
      },
      "totalNT": "8",
      "totalOT": "2",
      "remarks": "",
      "isSunday": false
    }
  ]
}

CRITICAL RULES:
- jobColumns must be the ACTUAL job numbers you see in the header row of the image
- Every row must have ALL job columns listed in jobColumns
- Use "" for empty cells, NOT dashes or null
- isSunday = true only if the row is marked SUNDAY
- Include ALL 31 rows even if some are empty
- Do NOT put job data in remarks field`

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
    console.log('Groq raw response:', text.substring(0, 500))
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const data = JSON.parse(clean)
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('Extraction error:', err.message)
    return NextResponse.json({ error: err.message || 'Extraction failed' }, { status: 500 })
  }
}
