'use client'

import { useMemo, useState } from 'react'
import { base } from 'wagmi/chains'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from 'wagmi'
import CreatePoolForm from '@/components/CreatePoolForm'
import PoolList from '@/components/PoolList'

export default function HomePage() {
  const { address, chainId, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const [refreshKey, setRefreshKey] = useState(0)

  const isOnBase = chainId === base.id
  const shortAddress = useMemo(() => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }, [address])

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">Base Mini App</span>
          <h1>BasePlay</h1>
          <p>
            Connect a wallet on Base, view live pools from the configured
            contract, create new pools as the owner, place bets, and claim
            payouts after settlement.
          </p>
        </div>

        <div className="wallet-panel">
          {!isConnected ? (
            <>
              <p className="panel-title">Connect your wallet to get started.</p>
              <div className="button-stack">
                {connectors.map((connector) => (
                  <button
                    key={connector.uid}
                    className="primary-button"
                    disabled={isConnecting}
                    onClick={() => connect({ connector })}
                    type="button"
                  >
                    {isConnecting ? 'Connecting...' : `Connect ${connector.name}`}
                  </button>
                ))}
              </div>
              <p className="muted-text">Wallet not connected.</p>
            </>
          ) : (
            <>
              <p className="panel-title">Connected wallet</p>
              <p className="address-pill">{shortAddress}</p>
              {!isOnBase ? (
                <>
                  <p className="warning-text">
                    You are not on Base. Switch chains before creating pools,
                    betting, or claiming.
                  </p>
                  <button
                    className="primary-button"
                    disabled={isSwitching}
                    onClick={() => switchChain({ chainId: base.id })}
                    type="button"
                  >
                    {isSwitching ? 'Switching...' : 'Switch To Base'}
                  </button>
                </>
              ) : (
                <p className="success-text">You are connected to Base mainnet.</p>
              )}
              <button
                className="secondary-button"
                onClick={() => disconnect()}
                type="button"
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      </section>

      <section className="content-grid">
        <CreatePoolForm
          canTransact={Boolean(isConnected && isOnBase)}
          onCreated={() => setRefreshKey((value) => value + 1)}
        />
        <PoolList
          canTransact={Boolean(isConnected && isOnBase)}
          refreshKey={refreshKey}
          onActionComplete={() => setRefreshKey((value) => value + 1)}
        />
      </section>
    </main>
  )
}
