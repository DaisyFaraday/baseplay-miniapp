import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'
import Providers from './providers'

const siteUrl = 'https://baseplay-miniapp.vercel.app'

export const metadata: Metadata = {
  title: 'BasePlay',
  description: 'A Base mini app for creating pools, betting, and claiming rewards.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: 'BasePlay',
    description: 'A Base mini app for creating pools, betting, and claiming rewards.',
    url: siteUrl,
    images: ['/og.png'],
  },
  icons: {
    icon: '/icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="base:app_id" content="69c0b55d3beb94a927e63d55" />
        <meta
          name="talentapp:project_verification"
          content="4a7fa9b0d878fcc46a71871a111b21cadbbb0f420867fb883105a57d0e39cf183bf1ff06ba079dbd84a8a61e9795e4ebfd7b9203fcba763ca57c378d758aaa97"
        />
      </head>
      <body>
        <Providers>
          {children}
          <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        </Providers>
      </body>
    </html>
  )
}
