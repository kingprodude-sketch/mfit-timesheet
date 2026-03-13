import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MFIT Timesheet Extractor',
  description: 'Extract handwritten timesheets into Excel automatically',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="grain" />
        {children}
      </body>
    </html>
  )
}
