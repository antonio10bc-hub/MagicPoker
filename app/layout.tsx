import './globals.css'
import type { Metadata } from 'next'
import { clsx } from 'clsx'

export const metadata: Metadata = {
  title: 'Magic Poker',
  description: 'Juego de cartas estratégico',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="h-full">
      <body className={clsx("h-full m-0")}>
        {children}
      </body>
    </html>
  )
}