'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { formatEther, parseEther } from 'viem'
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import toast from 'react-hot-toast'
import {
  BasePlayABI,
  CONTRACT_ADDRESS,
  type PoolStruct,
} from '@/contracts/BasePlayABI'
import { trackTransaction } from '@/utils/track'

type PoolCardProps = {
  canTransact: boolean
  onActionComplete: () => void
  pool: PoolStruct
  poolId: number
}

export default function PoolCard({
  canTransact,
  onActionComplete,
  pool,
  poolId,
}: PoolCardProps) {
  const { address } = useAccount()
  const [betAmount, setBetAmount] = useState('0.001')
  const [pendingAction, setPendingAction] = useState<'bet' | 'claim' | null>(null)

  const {
    data: hash,
    error: writeError,
    isPending,
    reset,
    writeContract,
  } = useWriteContract()

  const handledHashRef = useRef<`0x${string}` | null>(null)

  const {
    data: receipt,
    error: receiptError,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({
    hash,
    query: {
      enabled: Boolean(hash),
    },
  })

  useEffect(() => {
    if (writeError) {
      toast.error(writeError.message || 'Transaction failed.')
      setPendingAction(null)
    }
  }, [writeError])

  useEffect(() => {
    if (!receiptError) return
    toast.error(receiptError.message || 'Transaction confirmation failed.')
    setPendingAction(null)
  }, [receiptError])

  useEffect(() => {
    if (!isConfirmed || !receipt?.transactionHash) return
    if (handledHashRef.current === receipt.transactionHash) return

    handledHashRef.current = receipt.transactionHash

    void (async () => {
      if (address) {
        await trackTransaction('app-001', 'BasePlay', address, receipt.transactionHash)
      }
      toast.success(
        pendingAction === 'claim'
          ? 'Claim completed successfully.'
          : 'Bet placed successfully.'
      )
      setPendingAction(null)
      onActionComplete()
      reset()
    })()
  }, [address, isConfirmed, onActionComplete, pendingAction, receipt, reset])

  const isExpired = Number(pool.deadline) * 1000 <= Date.now()
  const totalPool = pool.totalA + pool.totalB
  const optionAPercent =
    totalPool > 0n ? Number((pool.totalA * 100n) / totalPool) : 50
  const optionBPercent =
    totalPool > 0n ? Number((pool.totalB * 100n) / totalPool) : 50
  const isBusy = isPending || isConfirming

  const deadlineText = useMemo(
    () => new Date(Number(pool.deadline) * 1000).toLocaleString(),
    [pool.deadline]
  )

  function handleBet(option: 0 | 1) {
    if (!address || !canTransact) {
      toast.error('Connect a wallet on Base before betting.')
      return
    }

    if (!betAmount || Number(betAmount) <= 0) {
      toast.error('Enter a valid bet amount.')
      return
    }

    setPendingAction('bet')
    writeContract({
      abi: BasePlayABI,
      address: CONTRACT_ADDRESS,
      functionName: 'bet',
      args: [BigInt(poolId), option],
      value: parseEther(betAmount),
    })
  }

  function handleClaim() {
    if (!address || !canTransact) {
      toast.error('Connect a wallet on Base before claiming.')
      return
    }

    setPendingAction('claim')
    writeContract({
      abi: BasePlayABI,
      address: CONTRACT_ADDRESS,
      functionName: 'claim',
      args: [BigInt(poolId)],
    })
  }

  return (
    <article className="pool-card">
      <div className="pool-card-header">
        <div>
          <span className="eyebrow">Pool #{poolId}</span>
          <h3>{pool.title}</h3>
        </div>
        <span className={pool.settled ? 'status-pill settled' : 'status-pill live'}>
          {pool.settled ? 'Settled' : isExpired ? 'Waiting Settlement' : 'Open'}
        </span>
      </div>

      <div className="pool-meta">
        <p>Deadline: {deadlineText}</p>
        <p>Total Pool: {formatEther(totalPool)} ETH</p>
      </div>

      <div className="option-grid">
        <div className="option-card option-a">
          <strong>{pool.optionA}</strong>
          <span>{formatEther(pool.totalA)} ETH</span>
          <small>{optionAPercent}%</small>
        </div>
        <div className="option-card option-b">
          <strong>{pool.optionB}</strong>
          <span>{formatEther(pool.totalB)} ETH</span>
          <small>{optionBPercent}%</small>
        </div>
      </div>

      {!isExpired ? (
        <div className="action-block">
          <label>
            <span>Bet Amount (ETH)</span>
            <input
              disabled={isBusy || !canTransact}
              min="0.000001"
              onChange={(event) => setBetAmount(event.target.value)}
              step="0.0001"
              type="number"
              value={betAmount}
            />
          </label>
          <div className="button-row">
            <button
              className="primary-button"
              disabled={isBusy || !canTransact}
              onClick={() => handleBet(0)}
              type="button"
            >
              {isBusy && pendingAction === 'bet' ? 'Submitting...' : `Bet ${pool.optionA}`}
            </button>
            <button
              className="secondary-button"
              disabled={isBusy || !canTransact}
              onClick={() => handleBet(1)}
              type="button"
            >
              {isBusy && pendingAction === 'bet' ? 'Submitting...' : `Bet ${pool.optionB}`}
            </button>
          </div>
        </div>
      ) : (
        <div className="action-block">
          <p className="muted-text">
            Betting has ended. Claim is available after the pool is settled on-chain.
          </p>
          <button
            className="primary-button"
            disabled={isBusy || !canTransact || !pool.settled}
            onClick={handleClaim}
            type="button"
          >
            {isBusy && pendingAction === 'claim' ? 'Claiming...' : 'Claim'}
          </button>
        </div>
      )}
    </article>
  )
}
