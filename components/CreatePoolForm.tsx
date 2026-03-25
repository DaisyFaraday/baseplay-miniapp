'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import toast from 'react-hot-toast'
import { BasePlayABI, CONTRACT_ADDRESS } from '@/contracts/BasePlayABI'
import { trackTransaction } from '@/utils/track'

function getDefaultDeadline() {
  const date = new Date(Date.now() + 60_000)
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function toDeadlineTimestamp(value: string) {
  return BigInt(Math.floor(new Date(value).getTime() / 1000))
}

type CreatePoolFormProps = {
  canTransact: boolean
  onCreated: () => void
}

export default function CreatePoolForm({
  canTransact,
  onCreated,
}: CreatePoolFormProps) {
  const { address } = useAccount()
  const [title, setTitle] = useState('')
  const [optionA, setOptionA] = useState('')
  const [optionB, setOptionB] = useState('')
  const [deadline, setDeadline] = useState(getDefaultDeadline())
  const { data: ownerAddress, isLoading: ownerLoading, error: ownerError } =
    useReadContract({
      address: CONTRACT_ADDRESS,
      abi: BasePlayABI,
      functionName: 'owner',
      query: {
        enabled: Boolean(address),
      },
    })

  const {
    data: hash,
    error: writeError,
    isPending,
    writeContract,
    reset,
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
      toast.error(writeError.message || 'Pool creation failed.')
    }
  }, [writeError])

  useEffect(() => {
    if (!receiptError) return
    toast.error(receiptError.message || 'Pool creation confirmation failed.')
  }, [receiptError])

  useEffect(() => {
    if (!isConfirmed || !receipt?.transactionHash) return
    if (handledHashRef.current === receipt.transactionHash) return

    handledHashRef.current = receipt.transactionHash

    void (async () => {
      if (address) {
        await trackTransaction('app-001', 'BasePlay', address, receipt.transactionHash)
      }
      toast.success('Pool created successfully.')
      setTitle('')
      setOptionA('')
      setOptionB('')
      setDeadline(getDefaultDeadline())
      onCreated()
      reset()
    })()
  }, [address, isConfirmed, onCreated, receipt, reset])

  const isOwner = useMemo(() => {
    if (!address || !ownerAddress) return false
    return address.toLowerCase() === ownerAddress.toLowerCase()
  }, [address, ownerAddress])

  const isBusy = isPending || isConfirming

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canTransact || !address) {
      toast.error('Connect a wallet on Base before creating a pool.')
      return
    }

    if (!isOwner) {
      toast.error('Only the contract owner can create a pool.')
      return
    }

    if (!title || !optionA || !optionB || !deadline) {
      toast.error('Fill in title, options, and deadline.')
      return
    }

    const deadlineTimestamp = toDeadlineTimestamp(deadline)
    const now = BigInt(Math.floor(Date.now() / 1000))
    if (deadlineTimestamp <= now) {
      toast.error('Deadline must be in the future.')
      return
    }

    writeContract({
      address: CONTRACT_ADDRESS,
      abi: BasePlayABI,
      functionName: 'createPool',
      args: [title, optionA, optionB, deadlineTimestamp],
    })
  }

  return (
    <section className="panel-card">
      <div className="section-header">
        <div>
          <span className="eyebrow">Owner Action</span>
          <h2>Create Pool</h2>
        </div>
        <p className="muted-text">
          Default deadline is set to current time plus 60 seconds.
        </p>
      </div>

      {!address ? (
        <p className="warning-banner">Connect your wallet to create a pool.</p>
      ) : ownerLoading ? (
        <p className="loading-banner">Loading owner permissions...</p>
      ) : ownerError ? (
        <p className="error-banner">
          Failed to read owner status from the configured contract.
        </p>
      ) : !isOwner ? (
        <p className="warning-banner">
          Owner-only create logic is active. The connected wallet is not the owner.
        </p>
      ) : null}

      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          <span>Title</span>
          <input
            disabled={isBusy}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Will ETH close above $3k this week?"
            value={title}
          />
        </label>

        <label>
          <span>Option A</span>
          <input
            disabled={isBusy}
            onChange={(event) => setOptionA(event.target.value)}
            placeholder="Yes"
            value={optionA}
          />
        </label>

        <label>
          <span>Option B</span>
          <input
            disabled={isBusy}
            onChange={(event) => setOptionB(event.target.value)}
            placeholder="No"
            value={optionB}
          />
        </label>

        <label>
          <span>Deadline</span>
          <input
            disabled={isBusy}
            onChange={(event) => setDeadline(event.target.value)}
            type="datetime-local"
            value={deadline}
          />
        </label>

        <button
          className="primary-button"
          disabled={isBusy || !address || !canTransact || !isOwner}
          type="submit"
        >
          {isBusy ? 'Submitting...' : 'Create Pool'}
        </button>
      </form>
    </section>
  )
}
