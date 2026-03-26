import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import { APP_NAME, BASE_APP_ID, PROJECT_VERIFICATION, SITE_URL } from '@/lib/appConfig'
import './globals.css'
import Providers from './providers'

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'BasePlay is a live onchain betting desk for Base Mini App users.',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: APP_NAME,
    description:
      'Create pools, bet with ETH or ERC20, submit results, claim rewards, and read live odds on Base.',
    url: SITE_URL,
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
    <html lang="en">
      <head>
        <meta name="base:app_id" content={BASE_APP_ID} />
        <meta
          name="talentapp:project_verification"
          content={PROJECT_VERIFICATION}
        />
      </head>
      <body>
        <Providers>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
