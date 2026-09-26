import type { ReactNode } from 'react'

export const metadata = {
  title: 'Lumenva Social Brain',
  description: 'Internal social content engine',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT">
      <body>{children}</body>
    </html>
  )
}
