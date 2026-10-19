import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Pixelify_Sans } from 'next/font/google'

// Fuente píxel libre (OFL) de trazo redondeado. Se usa a 10 px y 20 px internos.
const pixelFont = Pixelify_Sans({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-pixel' })

export const metadata: Metadata = {
  title: 'Magic Poker',
  description: 'Juego de cartas estratégico',
}

export const viewport: Viewport = {
  themeColor: '#1E2638',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`h-full ${pixelFont.variable}`}>
      <body className="h-full m-0 overflow-hidden">
        {children}
      </body>
    </html>
  )
}
