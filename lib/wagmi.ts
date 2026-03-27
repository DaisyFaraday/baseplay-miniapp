import { createConfig, http } from 'wagmi'
import { base } from 'wagmi/chains'
import { coinbaseWallet, injected } from 'wagmi/connectors'
import { APP_NAME } from '@/lib/appConfig'

export const config = createConfig({
  chains: [base],
  connectors: [coinbaseWallet({ appName: APP_NAME }), injected()],
  transports: {
    [base.id]: http('https://mainnet.base.org', {
      batch: false,
      timeout: 12_000,
    }),
  },
})
