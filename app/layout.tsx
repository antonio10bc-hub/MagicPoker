import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Bebas_Neue, Special_Elite } from 'next/font/google'

// Tipografías libres (OFL): máquina de escribir con tinta irregular para el texto y
// una condensada para cifras y títulos. Se usan a 10 px y 20 px internos.
const typeFont = Special_Elite({ subsets: ['latin'], weight: '400', variable: '--font-type' })
const displayFont = Bebas_Neue({ subsets: ['latin'], weight: '400', variable: '--font-display' })

export const metadata: Metadata = {
  title: 'Magic Poker',
  description: 'Juego de cartas estratégico',
  // Instalable en iOS: pantalla completa y barra de estado sobre el negro del juego
  appleWebApp: { capable: true, title: 'Magic Poker', statusBarStyle: 'black-translucent' },
}

// Juego a pantalla completa en móvil: sin zoom por gestos ni doble toque
export const viewport: Viewport = {
  themeColor: '#0B0D0C',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`h-full ${typeFont.variable} ${displayFont.variable}`}>
      <body className="h-full m-0 overflow-hidden">
        {/* Pantalla de carga: HTML puro, visible antes de que arranque React */}
        <div id="splash" aria-hidden>
          <div className="splash-logo">
            <span className="splash-magic">MAGIC</span>
            <span className="splash-poker">POKER</span>
          </div>
          <div className="splash-bar"><span /></div>
        </div>
        {children}
      </body>
    </html>
  )
}
