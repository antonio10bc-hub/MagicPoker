import type { Metadata } from "next";
// Usamos una fuente estilo "handwritten/comic"
import { Amatic_SC } from "next/font/google";
import "./globals.css";

// Configuramos la fuente (puedes probar Patrick Hand o Gochi Hand también)
const comicFont = Amatic_SC({ 
  subsets: ["latin"], 
  weight: ['400', '700'],
  variable: '--font-comic'
});

export const metadata: Metadata = {
  title: "Card Battle Doodle",
  description: "A webcomic style card game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      {/* Fondo blanco hueso y fuente de cómic */}
      <body className={`${comicFont.variable} font-comic bg-[#F7F5E6] text-black antialiased selection:bg-yellow-300 selection:text-black`}>
        {children}
      </body>
    </html>
  );
}