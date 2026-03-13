# MFIT Timesheet Extractor

A web app that reads handwritten MFIT Interior Decoration LLC Job Time Sheet PDFs using Claude AI and exports clean Excel files.

## Features

- Upload handwritten PDF timesheets
- AI-powered extraction via Claude Vision (claude-opus-4-5)
- Editable data table for corrections
- One-click Excel download
- Designed for MFIT's specific timesheet format

---

## Local Development

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/mfit-timesheet.git
cd mfit-timesheet
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
```

Get your API key at: https://console.anthropic.com

### 3. Run locally

```bash
npm run dev
```

Open http://localhost:3000

---

## Deploy to Vercel

### Option A: One-click via Vercel CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts. When asked, add your environment variable:
```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
```

### Option B: Deploy via GitHub + Vercel Dashboard

1. Push this repo to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mfit-timesheet.git
git push -u origin main
```

2. Go to https://vercel.com/new
3. Import your GitHub repository
4. Add Environment Variable:
   - Name: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-xxxxxxxxxxxx`
5. Click **Deploy**

That's it! Vercel will auto-deploy on every push to main.

---

## Project Structure

```
mfit-timesheet/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main UI (upload, table, export)
│   ├── globals.css         # Design system & styles
│   └── api/
│       ├── extract/
│       │   └── route.ts    # Claude Vision PDF extraction
│       └── export/
│           └── route.ts    # Excel file generation
├── vercel.json             # Vercel config (60s timeout for AI)
├── next.config.js
├── package.json
└── .env.example
```

---

## How It Works

1. **Upload** — User uploads a handwritten MFIT timesheet PDF
2. **Extract** — `/api/extract` sends the PDF to Claude claude-opus-4-5 with a detailed prompt
3. **Parse** — Claude returns structured JSON with all timesheet data
4. **Review** — User can edit any cell in the table
5. **Export** — `/api/export` builds an `.xlsx` file using SheetJS and returns it for download

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ Yes | Your Anthropic API key from console.anthropic.com |

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **AI**: Anthropic Claude claude-opus-4-5 (Vision)
- **Excel**: SheetJS (xlsx)
- **Styling**: Custom CSS + Tailwind
- **Deployment**: Vercel

---

## Customising for Other Form Types

To adapt for a different timesheet or form:

1. Edit the `EXTRACTION_PROMPT` in `app/api/extract/route.ts`
2. Update the column structure in `app/page.tsx` (`JOB_COLS` array)
3. Adjust the Excel layout in `app/api/export/route.ts`
