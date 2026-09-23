import type { Metadata } from 'next'
import { Rajdhani, Inter } from 'next/font/google'
import AuthProvider from '@/components/AuthProvider'
import './globals.css'

const display = Rajdhani({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-display',
  display: 'swap',
})

const body = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ArenaX — Play Hard. Win Loud.',
  description:
    "India's most electric grassroots esports arena. Squad up, enter the bracket, and make your name impossible to ignore.",
  icons: {
    icon: '/logos/AsCI.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
