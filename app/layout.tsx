import './globals.css'
import type { Metadata } from 'next'
// import { Inter } from 'next/font/google' // O la fuente que uses
import { clsx } from 'clsx'

// const inter = Inter({ subsets: ['latin'] })

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
    <html lang="es" className="h-full"> {/* Asegura altura completa */}
      <body className={clsx("h-full m-0", /* inter.className */)}> {/* Altura completa y sin margen */}
        {children}
      </body>
    </html>
  )
}