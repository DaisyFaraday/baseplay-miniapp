'use client'

import { useMemo } from 'react'
import { useReadContract, useReadContracts } from 'wagmi'
import { BasePlayABI, CONTRACT_ADDRESS, type PoolStruct } from '@/contracts/BasePlayABI'
import PoolCard from './PoolCard'

type PoolListProps = {
  canTransact: boolean
  refreshKey: number
  onActionComplete: () => void
}

export default function PoolList({
  canTransact,
  refreshKey,
  onActionComplete,
}: PoolListProps) {
  const {
    data: poolCount,
    error: countError,
    isLoading: countLoading,
    refetch: refetchCount,
  } = useReadContract({
    abi: BasePlayABI,
    address: CONTRACT_ADDRESS,
    functionName: 'poolCount',
    query: {
      refetchInterval: 15_000,
    },
  })

  const count = Number(poolCount ?? 0n)
  const poolContracts = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        abi: BasePlayABI,
        address: CONTRACT_ADDRESS,
        functionName: 'pools' as const,
        args: [BigInt(index)],
      })),
    [count]
  )

  const {
    data: poolsData,
    error: poolsError,
    isLoading: poolsLoading,
    refetch: refetchPools,
  } = useReadContracts({
    allowFailure: true,
    contracts: poolContracts,
    query: {
      enabled: poolContracts.length > 0,
      refetchInterval: 15_000,
    },
  })

  const pools = useMemo(() => {
    if (!poolsData) return []
    return poolsData
      .map((item, index) => {
        if (item.status !== 'success') return null
        return {
          id: index,
          pool: item.result as PoolStruct,
        }
      })
      .filter(Boolean) as Array<{ id: number; pool: PoolStruct }>
  }, [poolsData])

  function handleRefresh() {
    void refetchCount()
    void refetchPools()
    onActionComplete()
  }

  return (
    <section className="panel-card">
      <div className="section-header">
        <div>
          <span className="eyebrow">Live Pools</span>
          <h2>Pool List</h2>
        </div>
        <button className="secondary-button" onClick={handleRefresh} type="button">
          Refresh
        </button>
      </div>

      {!canTransact && (
        <p className="warning-banner">
          Connect a wallet on Base to place bets or claim rewards.
        </p>
      )}

      {(countError || poolsError) && (
        <p className="error-banner">
          Failed to read pool data from the configured contract. This usually
          means the contract does not expose the expected BasePlay pool methods.
        </p>
      )}

      {(countLoading || poolsLoading) && (
        <p className="loading-banner">Loading pool list...</p>
      )}

      {!countLoading && count === 0 && !countError && (
        <p className="empty-banner">No pools found yet.</p>
      )}

      <div className="pool-stack" key={refreshKey}>
        {pools.map(({ id, pool }) => (
          <PoolCard
            key={id}
            canTransact={canTransact}
            onActionComplete={handleRefresh}
            pool={pool}
            poolId={id}
          />
        ))}
      </div>
    </section>
  )
}
