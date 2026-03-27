import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Photobooth Dashboard',
  description: 'Photobooth Management System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
