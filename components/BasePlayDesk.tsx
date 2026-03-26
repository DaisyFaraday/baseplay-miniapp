'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import type { Address } from 'viem'
import {
  useAccount,
  useConnect,
  useDisconnect,
  usePublicClient,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { base } from 'wagmi/chains'
import { BasePlayABI, CONTRACT_ADDRESS, type OddsShape, type PoolShape } from '@/contracts/BasePlayABI'
import { APP_NAME } from '@/lib/appConfig'
import {
  buildApproveRequest,
  formatAddress,
  formatDateTime,
  formatOddsValue,
  formatTokenAmount,
  getFriendlyError,
  isNativeToken,
  parseEndTimeInput,
  parseTokenAmount,
  readAllowance,
  readBet,
  readOdds,
  readOracle,
  readPool,
  readPoolCount,
  readTokenMeta,
  safeAddress,
  toDateTimeLocalValue,
} from '@/lib/basePlay'

type TxKind = 'createPool' | 'approve' | 'bet' | 'submitResult' | 'claim' | null

type PoolView = {
  id: bigint
  pool: PoolShape
  odds: OddsShape
  bet: {
    side: boolean
    amount: bigint
    claimed: boolean
  } | null
  tokenMeta: {
    decimals: number
    symbol: string
  }
}

type QueuedBet = {
  poolId: bigint
  side: boolean
  amount: bigint
  nativeToken: boolean
}

function ConnectPanel() {
  const { address, chainId, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const filteredConnectors = useMemo(() => {
    const preferred = ['coinbase wallet', 'injected']
    return [...connectors].sort((left, right) => {
      const leftIndex = preferred.findIndex((item) => left.name.toLowerCase().includes(item))
      const rightIndex = preferred.findIndex((item) => right.name.toLowerCase().includes(item))
      return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex)
    })
  }, [connectors])

  const onBase = chainId === base.id

  return (
    <aside className="wallet-card paper-card">
      <div className="panel-heading">
        <span className="section-kicker">Wallet</span>
        <h2>Trading Desk</h2>
      </div>

      {!isConnected ? (
        <>
          <p className="panel-copy">
            Connect with Base embedded wallet, injected wallet, or Coinbase Wallet to use the live contract.
          </p>
          <div className="stack">
            {filteredConnectors.map((connector) => (
              <button
                key={connector.uid}
                className="button button-primary"
                disabled={isConnecting}
                onClick={() => connect({ connector })}
                type="button"
              >
                {isConnecting ? 'Connecting...' : `Connect ${connector.name}`}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="stat-strip">
            <span>Wallet</span>
            <strong>{formatAddress(address)}</strong>
          </div>
          <div className={`status-chip ${onBase ? 'status-ok' : 'status-warn'}`}>
            {onBase ? 'Base network ready' : 'Switch to Base to transact'}
          </div>
          {!onBase && (
            <button
              className="button button-primary"
              disabled={isSwitching}
              onClick={() => switchChain({ chainId: base.id })}
              type="button"
            >
              {isSwitching ? 'Switching...' : 'Switch To Base'}
            </button>
          )}
          <button className="button button-secondary" onClick={() => disconnect()} type="button">
            Disconnect
          </button>
        </>
      )}
    </aside>
  )
}

function PoolSnapshotCard({
  poolView,
  onUse,
  onOdds,
}: {
  poolView: PoolView
  onUse: (poolId: bigint) => void
  onOdds: (poolId: bigint) => void
}) {
  const { id, pool, odds, tokenMeta, bet } = poolView
  const statusLabel =
    pool.result !== 0
      ? 'Settled'
      : BigInt(Math.floor(Date.now() / 1000)) >= pool.endTime
        ? 'Ended'
        : 'Open'

  return (
    <article className="pool-list-card">
      <div className="pool-list-top">
        <div>
          <span className="micro-kicker">Pool #{id.toString()}</span>
          <h3>{isNativeToken(pool.token) ? 'ETH Market' : `${tokenMeta.symbol} Market`}</h3>
        </div>
        <span className={`mini-status mini-status-${statusLabel.toLowerCase()}`}>{statusLabel}</span>
      </div>

      <div className="pool-list-grid">
        <div>
          <span>Ends</span>
          <strong>{formatDateTime(pool.endTime)}</strong>
        </div>
        <div>
          <span>Result</span>
          <strong>{pool.result === 0 ? 'Pending' : `Side ${pool.result}`}</strong>
        </div>
        <div>
          <span>Side A</span>
          <strong>{formatTokenAmount(pool.totalSideA, tokenMeta.decimals, tokenMeta.symbol)}</strong>
        </div>
        <div>
          <span>Side B</span>
          <strong>{formatTokenAmount(pool.totalSideB, tokenMeta.decimals, tokenMeta.symbol)}</strong>
        </div>
        <div>
          <span>Odds</span>
          <strong>
            {formatOddsValue(odds.sideAOdds)} / {formatOddsValue(odds.sideBOdds)}
          </strong>
        </div>
        <div>
          <span>Your Bet</span>
          <strong>
            {bet && bet.amount > 0n
              ? `${bet.side ? 'Side A' : 'Side B'} · ${formatTokenAmount(
                  bet.amount,
                  tokenMeta.decimals,
                  tokenMeta.symbol
                )}`
              : 'No bet yet'}
          </strong>
        </div>
      </div>

      <div className="quick-actions">
        <button className="button button-secondary" onClick={() => onUse(id)} type="button">
          Use This Pool
        </button>
        <button className="button button-secondary" onClick={() => onOdds(id)} type="button">
          View Odds
        </button>
      </div>
    </article>
  )
}

export default function BasePlayDesk() {
  const publicClient = usePublicClient({ chainId: base.id })
  const { address, chainId, isConnected } = useAccount()
  const canTransact = Boolean(isConnected && chainId === base.id)
  const [oracle, setOracle] = useState<Address | null>(null)
  const [poolCount, setPoolCount] = useState<bigint>(0n)
  const [latestPools, setLatestPools] = useState<PoolView[]>([])
  const [inspectorId, setInspectorId] = useState('0')
  const [inspectedPool, setInspectedPool] = useState<PoolView | null>(null)
  const [inspectorLoading, setInspectorLoading] = useState(false)
  const [createEndTime, setCreateEndTime] = useState(toDateTimeLocalValue())
  const [createToken, setCreateToken] = useState('0x0000000000000000000000000000000000000000')
  const [betPoolId, setBetPoolId] = useState('0')
  const [betSide, setBetSide] = useState<'true' | 'false'>('true')
  const [betAmount, setBetAmount] = useState('0.001')
  const [submitPoolId, setSubmitPoolId] = useState('0')
  const [submitResult, setSubmitResult] = useState<'1' | '2'>('1')
  const [claimPoolId, setClaimPoolId] = useState('0')
  const [oddsPoolId, setOddsPoolId] = useState('0')
  const [oddsResult, setOddsResult] = useState<PoolView | null>(null)
  const [summaryMessage, setSummaryMessage] = useState('Load a pool or use the latest market cards below.')
  const [pendingKind, setPendingKind] = useState<TxKind>(null)
  const [pendingSuccessMessage, setPendingSuccessMessage] = useState('Transaction confirmed.')
  const [queuedBet, setQueuedBet] = useState<QueuedBet | null>(null)
  const handledHashRef = useRef<`0x${string}` | null>(null)

  const {
    data: hash,
    error: writeError,
    isPending,
    reset,
    writeContractAsync,
  } = useWriteContract()

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
    if (!publicClient) return

    void refreshDashboard()
  }, [publicClient, address])

  useEffect(() => {
    if (!writeError) return
    toast.error(getFriendlyError(writeError))
    setPendingKind(null)
    setQueuedBet(null)
  }, [writeError])

  useEffect(() => {
    if (!receiptError) return
    toast.error(getFriendlyError(receiptError))
    setPendingKind(null)
    setQueuedBet(null)
  }, [receiptError])

  useEffect(() => {
    if (!isConfirmed || !receipt?.transactionHash) return
    if (handledHashRef.current === receipt.transactionHash) return
    handledHashRef.current = receipt.transactionHash

    if (pendingKind === 'approve' && queuedBet) {
      toast.success('Approval confirmed. Sending the bet transaction now.')
      void submitBetFromQueue(queuedBet)
      return
    }

    toast.success(pendingSuccessMessage)
    setPendingKind(null)
    reset()
    void refreshDashboard()
    if (inspectorId) {
      void loadPool(inspectorId, false)
    }
    if (oddsPoolId) {
      void loadOdds(oddsPoolId, false)
    }
  }, [inspectorId, isConfirmed, oddsPoolId, pendingKind, pendingSuccessMessage, queuedBet, receipt, reset])

  async function refreshDashboard() {
    if (!publicClient) return
    const [nextOracle, nextCount] = await Promise.all([readOracle(publicClient), readPoolCount(publicClient)])
    setOracle(nextOracle)
    setPoolCount(nextCount)

    const total = Number(nextCount)
    if (total === 0) {
      setLatestPools([])
      return
    }

    const ids = Array.from({ length: Math.min(total, 4) }, (_, index) => BigInt(total - 1 - index))
    const items = await Promise.all(ids.map((id) => resolvePoolView(id)))
    setLatestPools(items)
  }

  async function resolvePoolView(poolId: bigint) {
    if (!publicClient) throw new Error('Public client is not ready.')
    const pool = await readPool(publicClient, poolId)
    const odds = await readOdds(publicClient, poolId)
    const tokenMeta = await readTokenMeta(publicClient, pool.token)
    const bet = address ? await readBet(publicClient, poolId, address) : null
    return { id: poolId, pool, odds, tokenMeta, bet }
  }

  async function loadPool(poolIdValue: string, announce = true) {
    if (!publicClient) return
    const parsed = BigInt(poolIdValue || '0')
    setInspectorLoading(true)

    try {
      const count = await readPoolCount(publicClient)
      setPoolCount(count)
      if (parsed >= count) {
        throw new Error('Pool does not exist.')
      }
      const poolView = await resolvePoolView(parsed)
      setInspectedPool(poolView)
      setSummaryMessage(`Pool #${parsed.toString()} loaded. You can reuse it in the action forms below.`)
      if (announce) toast.success('Pool loaded from chain.')
    } catch (error) {
      setInspectedPool(null)
      toast.error(getFriendlyError(error))
    } finally {
      setInspectorLoading(false)
    }
  }

  async function loadOdds(poolIdValue: string, announce = true) {
    if (!publicClient) return
    const parsed = BigInt(poolIdValue || '0')

    try {
      const count = await readPoolCount(publicClient)
      if (parsed >= count) {
        throw new Error('Pool does not exist.')
      }
      const poolView = await resolvePoolView(parsed)
      setOddsResult(poolView)
      if (announce) {
        toast.success('Live odds loaded.')
      }
    } catch (error) {
      setOddsResult(null)
      toast.error(getFriendlyError(error))
    }
  }

  async function submitBetFromQueue(nextBet: QueuedBet) {
    setQueuedBet(null)
    setPendingKind('bet')
    setPendingSuccessMessage(
      nextBet.nativeToken ? 'Native-token bet sent successfully.' : 'ERC20 bet sent successfully.'
    )

    await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: BasePlayABI,
      functionName: 'bet',
      args: [nextBet.poolId, nextBet.side, nextBet.amount],
      ...(nextBet.nativeToken ? { value: nextBet.amount } : {}),
    })
  }

  function applyPoolIdEverywhere(poolId: bigint) {
    const nextValue = poolId.toString()
    setInspectorId(nextValue)
    setBetPoolId(nextValue)
    setSubmitPoolId(nextValue)
    setClaimPoolId(nextValue)
    setOddsPoolId(nextValue)
  }

  function requireWallet() {
    if (!isConnected || !address) {
      toast.error('Connect a wallet first.')
      return false
    }
    if (chainId !== base.id) {
      toast.error('Switch to Base before sending transactions.')
      return false
    }
    return true
  }

  async function handleCreatePool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!requireWallet()) return

    const token = safeAddress(createToken)
    if (!token) {
      toast.error('Enter a valid token address or the zero address for ETH.')
      return
    }

    const endTime = parseEndTimeInput(createEndTime)
    if (!endTime || endTime <= BigInt(Math.floor(Date.now() / 1000))) {
      toast.error('End time must be in the future.')
      return
    }

    setPendingKind('createPool')
    setPendingSuccessMessage('Pool created successfully.')
    await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: BasePlayABI,
      functionName: 'createPool',
      args: [endTime, token],
    })
  }

  async function handleBet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!requireWallet() || !publicClient || !address) return

    const poolId = BigInt(betPoolId || '0')
    const count = await readPoolCount(publicClient)
    if (poolId >= count) {
      toast.error('Pool does not exist.')
      return
    }

    const pool = await readPool(publicClient, poolId)
    if (BigInt(Math.floor(Date.now() / 1000)) >= pool.endTime) {
      toast.error('Market already ended.')
      return
    }

    if (pool.settled || pool.result !== 0) {
      toast.error('This pool is already settled.')
      return
    }

    const tokenMeta = await readTokenMeta(publicClient, pool.token)
    const nativeToken = isNativeToken(pool.token)
    const amount = parseTokenAmount(betAmount, tokenMeta.decimals, nativeToken)
    if (!amount || amount <= 0n) {
      toast.error('Enter a valid amount.')
      return
    }

    if (amount > 2n ** 128n - 1n) {
      toast.error('Amount exceeds the uint128 limit.')
      return
    }

    const nextBet: QueuedBet = {
      poolId,
      side: betSide === 'true',
      amount,
      nativeToken,
    }

    if (nativeToken) {
      await submitBetFromQueue(nextBet)
      return
    }

    const allowance = await readAllowance(publicClient, pool.token, address)
    if (allowance < amount) {
      setQueuedBet(nextBet)
      setPendingKind('approve')
      setPendingSuccessMessage('Token approval confirmed.')
      await writeContractAsync(buildApproveRequest(pool.token, amount))
      return
    }

    await submitBetFromQueue(nextBet)
  }

  async function handleSubmitResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!requireWallet() || !publicClient || !address) return

    const poolId = BigInt(submitPoolId || '0')
    const count = await readPoolCount(publicClient)
    if (poolId >= count) {
      toast.error('Pool does not exist.')
      return
    }

    const pool = await readPool(publicClient, poolId)
    if (BigInt(Math.floor(Date.now() / 1000)) < pool.endTime) {
      toast.error('Market already running. Result can only be submitted after the end time.')
      return
    }

    if (pool.settled || pool.result !== 0) {
      toast.error('This pool is already settled.')
      return
    }

    const liveOracle = await readOracle(publicClient)
    setOracle(liveOracle)
    if (address.toLowerCase() !== liveOracle.toLowerCase()) {
      toast.error('Permission denied. Only the live oracle address can submit results.')
      return
    }

    setPendingKind('submitResult')
    setPendingSuccessMessage('Result submitted successfully.')
    await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: BasePlayABI,
      functionName: 'submitResult',
      args: [poolId, Number(submitResult)],
    })
  }

  async function handleClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!requireWallet() || !publicClient || !address) return

    const poolId = BigInt(claimPoolId || '0')
    const count = await readPoolCount(publicClient)
    if (poolId >= count) {
      toast.error('Pool does not exist.')
      return
    }

    const [pool, bet] = await Promise.all([
      readPool(publicClient, poolId),
      readBet(publicClient, poolId, address),
    ])

    if (!pool.settled && pool.result === 0) {
      toast.error('This pool is not settled yet.')
      return
    }

    if (bet.amount <= 0n) {
      toast.error('No bet record found for this wallet.')
      return
    }

    if (bet.claimed) {
      toast.error('This reward is already claimed.')
      return
    }

    setPendingKind('claim')
    setPendingSuccessMessage('Claim completed successfully.')
    await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: BasePlayABI,
      functionName: 'claim',
      args: [poolId],
    })
  }

  async function handleOddsLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadOdds(oddsPoolId)
  }

  const isBusy = isPending || isConfirming
  const oracleHint =
    address && oracle ? address.toLowerCase() === oracle.toLowerCase() : false

  return (
    <main className="page-shell">
      <section className="hero-grid">
        <div className="hero-card paper-card">
          <span className="section-kicker">Base Mini App</span>
          <h1>{APP_NAME}</h1>
          <p className="hero-copy">
            A clean, vintage-styled onchain market desk for creating pools, placing ETH or ERC20 bets, submitting outcomes, claiming rewards, and checking live odds on Base.
          </p>

          <div className="hero-stats">
            <div className="paper-tile">
              <span>Contract</span>
              <strong>{CONTRACT_ADDRESS}</strong>
            </div>
            <div className="paper-tile">
              <span>Oracle</span>
              <strong>{oracle ? formatAddress(oracle) : 'Loading...'}</strong>
            </div>
            <div className="paper-tile">
              <span>Pool Count</span>
              <strong>{poolCount.toString()}</strong>
            </div>
          </div>

          <div className={`status-chip ${oracleHint ? 'status-ok' : 'status-note'}`}>
            {oracleHint
              ? 'Connected wallet matches the live oracle.'
              : 'Oracle status is read from chain. No admin role is hardcoded in the UI.'}
          </div>

          <div className="guide-grid">
            <div className="guide-card">
              <strong>1. Create</strong>
              <p>Set an end time and token address. Use the zero address for ETH pools.</p>
            </div>
            <div className="guide-card">
              <strong>2. Bet</strong>
              <p>Pick a pool, choose Side A or Side B, and enter the amount.</p>
            </div>
            <div className="guide-card">
              <strong>3. Settle & Claim</strong>
              <p>After the market ends, the oracle submits the result and users claim.</p>
            </div>
          </div>
        </div>

        <ConnectPanel />
      </section>

      <section className="content-grid">
        <section className="paper-card inspector-card">
          <div className="inspector-top">
            <div className="panel-heading">
              <span className="section-kicker">Pool Desk</span>
              <h2>Inspect A Pool</h2>
            </div>
            <button className="button button-secondary" onClick={() => void refreshDashboard()} type="button">
              Refresh Markets
            </button>
          </div>
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault()
              void loadPool(inspectorId)
            }}
          >
            <input
              className="text-input"
              inputMode="numeric"
              onChange={(event) => setInspectorId(event.target.value)}
              placeholder="Pool ID"
              value={inspectorId}
            />
            <button className="button button-primary" disabled={inspectorLoading} type="submit">
              {inspectorLoading ? 'Loading...' : 'Load Pool'}
            </button>
          </form>

          <p className="helper-text helper-strong">{summaryMessage}</p>

          {inspectedPool ? (
            <div className="pool-sheet">
              <div className="detail-row">
                <span>Ends</span>
                <strong>{formatDateTime(inspectedPool.pool.endTime)}</strong>
              </div>
              <div className="detail-row">
                <span>Token</span>
                <strong>
                  {isNativeToken(inspectedPool.pool.token)
                    ? 'Native ETH'
                    : `${inspectedPool.tokenMeta.symbol} (${formatAddress(inspectedPool.pool.token)})`}
                </strong>
              </div>
              <div className="detail-row">
                <span>Side A Total</span>
                <strong>
                  {formatTokenAmount(
                    inspectedPool.pool.totalSideA,
                    inspectedPool.tokenMeta.decimals,
                    inspectedPool.tokenMeta.symbol
                  )}
                </strong>
              </div>
              <div className="detail-row">
                <span>Side B Total</span>
                <strong>
                  {formatTokenAmount(
                    inspectedPool.pool.totalSideB,
                    inspectedPool.tokenMeta.decimals,
                    inspectedPool.tokenMeta.symbol
                  )}
                </strong>
              </div>
              <div className="detail-row">
                <span>Status</span>
                <strong>{inspectedPool.pool.result !== 0 ? 'Settled' : 'Open / Pending'}</strong>
              </div>
              <div className="detail-row">
                <span>Result</span>
                <strong>
                  {inspectedPool.pool.result === 0
                    ? 'Unresolved'
                    : `Side ${inspectedPool.pool.result}`}
                </strong>
              </div>
              <div className="detail-row">
                <span>Odds</span>
                <strong>
                  {formatOddsValue(inspectedPool.odds.sideAOdds)} /{' '}
                  {formatOddsValue(inspectedPool.odds.sideBOdds)}
                </strong>
              </div>
              {inspectedPool.bet && address && (
                <div className="detail-box">
                  <span>Your Bet</span>
                  <strong>
                    {inspectedPool.bet.amount > 0n
                      ? `${inspectedPool.bet.side ? 'Side A' : 'Side B'} · ${formatTokenAmount(
                          inspectedPool.bet.amount,
                          inspectedPool.tokenMeta.decimals,
                          inspectedPool.tokenMeta.symbol
                        )}`
                      : 'No active bet'}
                  </strong>
                  <small>{inspectedPool.bet.claimed ? 'Already claimed' : 'Claim not used yet'}</small>
                </div>
              )}
            </div>
          ) : (
            <p className="panel-copy">
              Load a pool to view live end time, token mode, side totals, result state, odds, and your wallet bet record.
            </p>
          )}
        </section>

        <section className="paper-card market-board">
          <div className="panel-heading">
            <span className="section-kicker">Markets</span>
            <h2>Latest Pools</h2>
          </div>

          {latestPools.length === 0 ? (
            <p className="panel-copy">No pools have been created yet on the bound contract.</p>
          ) : (
            <div className="pool-list">
              {latestPools.map((poolView) => (
                <PoolSnapshotCard
                  key={poolView.id.toString()}
                  onOdds={(poolId) => {
                    applyPoolIdEverywhere(poolId)
                    void loadOdds(poolId.toString())
                  }}
                  onUse={(poolId) => {
                    applyPoolIdEverywhere(poolId)
                    setSummaryMessage(`Pool #${poolId.toString()} copied into the action forms below.`)
                  }}
                  poolView={poolView}
                />
              ))}
            </div>
          )}
        </section>

        <section className="actions-grid">
          <form className="paper-card action-card" onSubmit={(event) => void handleCreatePool(event)}>
            <div className="panel-heading">
              <span className="section-kicker">Action</span>
              <h2>Create Pool</h2>
            </div>
            <label className="field">
              <span>End Time</span>
              <input
                className="text-input"
                onChange={(event) => setCreateEndTime(event.target.value)}
                type="datetime-local"
                value={createEndTime}
              />
            </label>
            <label className="field">
              <span>Token Address</span>
              <input
                className="text-input"
                onChange={(event) => setCreateToken(event.target.value)}
                placeholder="Zero address for ETH"
                value={createToken}
              />
            </label>
            <p className="helper-text">
              Use `0x000...000` for native ETH pools, or an ERC20 token contract for token-denominated pools.
            </p>
            <button className="button button-primary" disabled={!canTransact || isBusy} type="submit">
              {isBusy && pendingKind === 'createPool' ? 'Submitting...' : 'Create Pool'}
            </button>
          </form>

          <form className="paper-card action-card" onSubmit={(event) => void handleBet(event)}>
            <div className="panel-heading">
              <span className="section-kicker">Action</span>
              <h2>Place Bet</h2>
            </div>
            <label className="field">
              <span>Pool ID</span>
              <input
                className="text-input"
                inputMode="numeric"
                onChange={(event) => setBetPoolId(event.target.value)}
                value={betPoolId}
              />
            </label>
            <label className="field">
              <span>Side</span>
              <select
                className="text-input"
                onChange={(event) => setBetSide(event.target.value as 'true' | 'false')}
                value={betSide}
              >
                <option value="true">Side A / true</option>
                <option value="false">Side B / false</option>
              </select>
            </label>
            <label className="field">
              <span>Amount</span>
              <input
                className="text-input"
                onChange={(event) => setBetAmount(event.target.value)}
                placeholder="0.001"
                value={betAmount}
              />
            </label>
            <p className="helper-text">
              ETH pools send `value = amount`. ERC20 pools auto-approve first if allowance is too low, then the bet is sent automatically.
            </p>
            <button className="button button-primary" disabled={!canTransact || isBusy} type="submit">
              {isBusy && (pendingKind === 'approve' || pendingKind === 'bet')
                ? pendingKind === 'approve'
                  ? 'Approving...'
                  : 'Betting...'
                : 'Place Bet'}
            </button>
          </form>

          <form className="paper-card action-card" onSubmit={(event) => void handleSubmitResult(event)}>
            <div className="panel-heading">
              <span className="section-kicker">Oracle</span>
              <h2>Submit Result</h2>
            </div>
            <label className="field">
              <span>Pool ID</span>
              <input
                className="text-input"
                inputMode="numeric"
                onChange={(event) => setSubmitPoolId(event.target.value)}
                value={submitPoolId}
              />
            </label>
            <label className="field">
              <span>Result</span>
              <select
                className="text-input"
                onChange={(event) => setSubmitResult(event.target.value as '1' | '2')}
                value={submitResult}
              >
                <option value="1">1 - Side A</option>
                <option value="2">2 - Side B</option>
              </select>
            </label>
            <p className="helper-text">
              Oracle access is checked live from chain. The current oracle is {oracle ? formatAddress(oracle) : 'loading'}.
            </p>
            <button className="button button-primary" disabled={!canTransact || isBusy} type="submit">
              {isBusy && pendingKind === 'submitResult' ? 'Submitting...' : 'Submit Result'}
            </button>
          </form>

          <form className="paper-card action-card" onSubmit={(event) => void handleClaim(event)}>
            <div className="panel-heading">
              <span className="section-kicker">Reward</span>
              <h2>Claim Reward</h2>
            </div>
            <label className="field">
              <span>Pool ID</span>
              <input
                className="text-input"
                inputMode="numeric"
                onChange={(event) => setClaimPoolId(event.target.value)}
                value={claimPoolId}
              />
            </label>
            <p className="helper-text">
              Claim checks pool existence, settlement status, your bet record, and already-claimed state before sending the transaction.
            </p>
            <button className="button button-primary" disabled={!canTransact || isBusy} type="submit">
              {isBusy && pendingKind === 'claim' ? 'Claiming...' : 'Claim Reward'}
            </button>
          </form>

          <form className="paper-card action-card" onSubmit={(event) => void handleOddsLookup(event)}>
            <div className="panel-heading">
              <span className="section-kicker">Read</span>
              <h2>View Odds</h2>
            </div>
            <label className="field">
              <span>Pool ID</span>
              <input
                className="text-input"
                inputMode="numeric"
                onChange={(event) => setOddsPoolId(event.target.value)}
                value={oddsPoolId}
              />
            </label>
            <button className="button button-secondary" type="submit">
              View Odds
            </button>
            {oddsResult && (
              <div className="detail-box">
                <span>Live Odds</span>
                <strong>
                  Side A: {formatOddsValue(oddsResult.odds.sideAOdds)} | Side B:{' '}
                  {formatOddsValue(oddsResult.odds.sideBOdds)}
                </strong>
                <small>
                  Pool token: {isNativeToken(oddsResult.pool.token) ? 'ETH' : oddsResult.tokenMeta.symbol}
                </small>
              </div>
            )}
          </form>
        </section>
      </section>
    </main>
  )
}
