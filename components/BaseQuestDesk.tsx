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
import { BaseQuestMerkleABI, CONTRACT_ADDRESS, type QuestShape } from '@/contracts/BaseQuestMerkleABI'
import { APP_NAME, BUILDER_CODE, BUILDER_HEX } from '@/lib/appConfig'
import {
  formatAddress,
  formatDateTime,
  getFriendlyError,
  parseDateTimeInput,
  parseMerkleRoot,
  parseProofInput,
  readClaimed,
  readOwner,
  readPaused,
  readPoints,
  readQuest,
  readQuestCount,
  safeAddress,
  toDateTimeLocalValue,
} from '@/lib/baseQuestMerkle'

type TxKind = 'createQuest' | 'setQuestActive' | 'setPaused' | 'claim' | 'claimPoints' | null

type QuestView = {
  id: bigint
  quest: QuestShape
  claimed: boolean | null
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
        <h2>Quest Desk</h2>
      </div>

      {!isConnected ? (
        <>
          <p className="panel-copy">
            Connect with Base embedded wallet, injected wallet, or Coinbase Wallet to use the live quest contract.
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

function QuestSnapshotCard({
  questView,
  onUse,
}: {
  questView: QuestView
  onUse: (questId: bigint) => void
}) {
  const { id, quest, claimed } = questView
  const now = BigInt(Math.floor(Date.now() / 1000))
  const statusLabel = !quest.active
    ? 'Inactive'
    : now < quest.startTime
      ? 'Upcoming'
      : now > quest.endTime
        ? 'Ended'
        : 'Live'

  return (
    <article className="pool-list-card">
      <div className="pool-list-top">
        <div>
          <span className="micro-kicker">Quest #{id.toString()}</span>
          <h3>Merkle Reward Quest</h3>
        </div>
        <span className={`mini-status mini-status-${statusLabel.toLowerCase()}`}>{statusLabel}</span>
      </div>

      <div className="pool-list-grid">
        <div>
          <span>Reward</span>
          <strong>{quest.reward.toString()} pts</strong>
        </div>
        <div>
          <span>Starts</span>
          <strong>{formatDateTime(quest.startTime)}</strong>
        </div>
        <div>
          <span>Ends</span>
          <strong>{formatDateTime(quest.endTime)}</strong>
        </div>
        <div>
          <span>Active</span>
          <strong>{quest.active ? 'Yes' : 'No'}</strong>
        </div>
        <div>
          <span>Merkle Root</span>
          <strong>{formatAddress(quest.merkleRoot)}</strong>
        </div>
        <div>
          <span>Your Claim</span>
          <strong>{claimed == null ? 'Connect wallet' : claimed ? 'Claimed' : 'Not claimed'}</strong>
        </div>
      </div>

      <div className="quick-actions">
        <button className="button button-secondary" onClick={() => onUse(id)} type="button">
          Use This Quest
        </button>
      </div>
    </article>
  )
}

export default function BaseQuestDesk() {
  const publicClient = usePublicClient({ chainId: base.id })
  const { address, chainId, isConnected } = useAccount()
  const canTransact = Boolean(isConnected && chainId === base.id)
  const [owner, setOwner] = useState<Address | null>(null)
  const [paused, setPaused] = useState(false)
  const [questCount, setQuestCount] = useState<bigint>(0n)
  const [walletPoints, setWalletPoints] = useState<bigint>(0n)
  const [latestQuests, setLatestQuests] = useState<QuestView[]>([])
  const [inspectorId, setInspectorId] = useState('0')
  const [inspectedQuest, setInspectedQuest] = useState<QuestView | null>(null)
  const [inspectorLoading, setInspectorLoading] = useState(false)
  const [createReward, setCreateReward] = useState('100')
  const [createStartTime, setCreateStartTime] = useState(toDateTimeLocalValue())
  const [createEndTime, setCreateEndTime] = useState(toDateTimeLocalValue(new Date(Date.now() + 2 * 60 * 60 * 1000)))
  const [createMerkleRoot, setCreateMerkleRoot] = useState('')
  const [manageQuestId, setManageQuestId] = useState('0')
  const [manageQuestActive, setManageQuestActive] = useState<'true' | 'false'>('true')
  const [pauseValue, setPauseValue] = useState<'true' | 'false'>('true')
  const [claimQuestId, setClaimQuestId] = useState('0')
  const [claimProof, setClaimProof] = useState('')
  const [checkAddressInput, setCheckAddressInput] = useState('')
  const [checkClaimedResult, setCheckClaimedResult] = useState<string>('Load a quest to inspect its live status.')
  const [summaryMessage, setSummaryMessage] = useState('Load a quest or use the latest quest cards below.')
  const [pendingKind, setPendingKind] = useState<TxKind>(null)
  const [pendingSuccessMessage, setPendingSuccessMessage] = useState('Transaction confirmed.')
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
  }, [writeError])

  useEffect(() => {
    if (!receiptError) return
    toast.error(getFriendlyError(receiptError))
    setPendingKind(null)
  }, [receiptError])

  useEffect(() => {
    if (!isConfirmed || !receipt?.transactionHash) return
    if (handledHashRef.current === receipt.transactionHash) return
    handledHashRef.current = receipt.transactionHash

    toast.success(pendingSuccessMessage)
    setPendingKind(null)
    reset()
    void refreshDashboard()
    if (inspectorId) {
      void loadQuest(inspectorId, false)
    }
  }, [inspectorId, isConfirmed, pendingSuccessMessage, receipt, reset])

  async function refreshDashboard() {
    if (!publicClient) return

    try {
      const [nextOwner, nextPaused, nextCount] = await Promise.all([
        readOwner(publicClient),
        readPaused(publicClient),
        readQuestCount(publicClient),
      ])

      setOwner(nextOwner)
      setPaused(nextPaused)
      setQuestCount(nextCount)

      if (address) {
        setWalletPoints(await readPoints(publicClient, address))
      } else {
        setWalletPoints(0n)
      }

      const total = Number(nextCount)
      if (total === 0) {
        setLatestQuests([])
        return
      }

      const ids = Array.from({ length: Math.min(total, 3) }, (_, index) => BigInt(total - 1 - index))
      const items = await Promise.all(ids.map((id) => resolveQuestView(id)))
      setLatestQuests(items)
    } catch (error) {
      toast.error(getFriendlyError(error))
    }
  }

  async function resolveQuestView(questId: bigint): Promise<QuestView> {
    if (!publicClient) throw new Error('Public client is not ready.')

    const quest = await readQuest(publicClient, questId)
    const nextClaimed = address ? await readClaimed(publicClient, questId, address).catch(() => null) : null

    return {
      id: questId,
      quest,
      claimed: nextClaimed,
    }
  }

  async function loadQuest(questIdValue: string, announce = true) {
    if (!publicClient) return
    const parsed = BigInt(questIdValue || '0')
    setInspectorLoading(true)

    try {
      const count = await readQuestCount(publicClient)
      setQuestCount(count)
      if (parsed >= count) {
        throw new Error('Quest does not exist.')
      }

      const questView = await resolveQuestView(parsed)
      setInspectedQuest(questView)
      setSummaryMessage(`Quest #${parsed.toString()} loaded. You can reuse it in the action forms below.`)
      setClaimQuestId(parsed.toString())
      setManageQuestId(parsed.toString())
      if (!checkAddressInput && address) {
        setCheckAddressInput(address)
      }
      if (announce) toast.success('Quest loaded from chain.')
    } catch (error) {
      setInspectedQuest(null)
      toast.error(getFriendlyError(error))
    } finally {
      setInspectorLoading(false)
    }
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

  async function handleCreateQuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!requireWallet()) return

    const reward = BigInt(createReward || '0')
    if (reward <= 0n || reward > 2n ** 64n - 1n) {
      toast.error('Reward must be a valid uint64 value.')
      return
    }

    const startTime = parseDateTimeInput(createStartTime)
    const endTime = parseDateTimeInput(createEndTime)
    if (!startTime || !endTime || endTime <= startTime) {
      toast.error('End time must be later than start time.')
      return
    }

    const merkleRoot = parseMerkleRoot(createMerkleRoot)
    if (!merkleRoot) {
      toast.error('Enter a valid bytes32 Merkle root.')
      return
    }

    setPendingKind('createQuest')
    setPendingSuccessMessage('Quest created successfully.')
    await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: BaseQuestMerkleABI,
      functionName: 'createQuest',
      args: [reward, startTime, endTime, merkleRoot],
    })
  }

  async function handleSetQuestActive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!requireWallet() || !publicClient) return

    const questId = BigInt(manageQuestId || '0')
    const count = await readQuestCount(publicClient)
    if (questId >= count) {
      toast.error('Quest does not exist.')
      return
    }

    setPendingKind('setQuestActive')
    setPendingSuccessMessage('Quest active state updated.')
    await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: BaseQuestMerkleABI,
      functionName: 'setQuestActive',
      args: [questId, manageQuestActive === 'true'],
    })
  }

  async function handleSetPaused(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!requireWallet()) return

    setPendingKind('setPaused')
    setPendingSuccessMessage('Pause status updated.')
    await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: BaseQuestMerkleABI,
      functionName: 'setPaused',
      args: [pauseValue === 'true'],
    })
  }

  async function handleClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!requireWallet() || !publicClient || !address) return

    const questId = BigInt(claimQuestId || '0')
    const count = await readQuestCount(publicClient)
    if (questId >= count) {
      toast.error('Quest does not exist.')
      return
    }

    const proof = parseProofInput(claimProof)
    const [quest, alreadyClaimed] = await Promise.all([
      readQuest(publicClient, questId),
      readClaimed(publicClient, questId, address),
    ])

    const now = BigInt(Math.floor(Date.now() / 1000))
    if (!quest.active) {
      toast.error('This quest is inactive.')
      return
    }
    if (now < quest.startTime) {
      toast.error('This quest has not started yet.')
      return
    }
    if (now > quest.endTime) {
      toast.error('This quest has already ended.')
      return
    }
    if (alreadyClaimed) {
      toast.error('This quest is already claimed by this wallet.')
      return
    }

    setPendingKind('claim')
    setPendingSuccessMessage('Quest claimed successfully.')
    await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: BaseQuestMerkleABI,
      functionName: 'claim',
      args: [questId, proof],
    })
  }

  async function handleClaimPoints() {
    if (!requireWallet()) return

    setPendingKind('claimPoints')
    setPendingSuccessMessage('Points claim transaction submitted.')
    await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: BaseQuestMerkleABI,
      functionName: 'claimPoints',
    })
  }

  async function handleClaimedLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!publicClient) return

    const questId = BigInt((inspectedQuest?.id ?? BigInt(inspectorId || '0')).toString())
    const lookupAddress = safeAddress(checkAddressInput)
    if (!lookupAddress) {
      toast.error('Enter a valid wallet address to check claim status.')
      return
    }

    const claimed = await readClaimed(publicClient, questId, lookupAddress)
    setCheckClaimedResult(
      claimed
        ? `Address ${formatAddress(lookupAddress)} has already claimed quest #${questId.toString()}.`
        : `Address ${formatAddress(lookupAddress)} has not claimed quest #${questId.toString()} yet.`
    )
  }

  const isBusy = isPending || isConfirming
  const isOwnerWallet = address && owner ? address.toLowerCase() === owner.toLowerCase() : false

  return (
    <main className="page-shell">
      <section className="hero-grid">
        <div className="hero-card paper-card">
          <span className="section-kicker">Base Mini App</span>
          <h1>{APP_NAME}</h1>
          <p className="hero-copy">
            A clean onchain quest desk for creating Merkle quests, toggling live quest status, claiming with proofs,
            and tracking wallet points on Base.
          </p>

          <div className="hero-stats">
            <div className="paper-tile">
              <span>Contract</span>
              <strong>{CONTRACT_ADDRESS}</strong>
            </div>
            <div className="paper-tile">
              <span>Owner</span>
              <strong>{owner ? formatAddress(owner) : 'Loading...'}</strong>
            </div>
            <div className="paper-tile">
              <span>Quest Count</span>
              <strong>{questCount.toString()}</strong>
            </div>
            <div className="paper-tile">
              <span>Paused</span>
              <strong>{paused ? 'Yes' : 'No'}</strong>
            </div>
            <div className="paper-tile">
              <span>Your Points</span>
              <strong>{walletPoints.toString()}</strong>
            </div>
            <div className="paper-tile">
              <span>Build Code</span>
              <strong>{BUILDER_CODE}</strong>
            </div>
            <div className="paper-tile">
              <span>Encoded String</span>
              <strong>{BUILDER_HEX}</strong>
            </div>
          </div>

          <div className={`status-chip ${isOwnerWallet ? 'status-ok' : 'status-note'}`}>
            {isOwnerWallet
              ? 'Connected wallet matches the live owner account.'
              : 'Owner-only actions remain visible, but the contract will enforce owner permissions.'}
          </div>

          <div className="guide-grid">
            <div className="guide-card">
              <strong>1. Create</strong>
              <p>Set reward, start time, end time, and a bytes32 Merkle root.</p>
            </div>
            <div className="guide-card">
              <strong>2. Claim</strong>
              <p>Users claim with `questId` plus a Merkle proof for their wallet address.</p>
            </div>
            <div className="guide-card">
              <strong>3. Withdraw</strong>
              <p>Claimed quest rewards accumulate as points and can be cleared with `claimPoints()`.</p>
            </div>
          </div>
        </div>

        <ConnectPanel />
      </section>

      <section className="content-grid">
        <section className="paper-card inspector-card">
          <div className="inspector-top">
            <div className="panel-heading">
              <span className="section-kicker">Quest Desk</span>
              <h2>Inspect A Quest</h2>
            </div>
            <button className="button button-secondary" onClick={() => void refreshDashboard()} type="button">
              Refresh Quests
            </button>
          </div>
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault()
              void loadQuest(inspectorId)
            }}
          >
            <input
              className="text-input"
              inputMode="numeric"
              onChange={(event) => setInspectorId(event.target.value)}
              placeholder="Quest ID"
              value={inspectorId}
            />
            <button className="button button-primary" disabled={inspectorLoading} type="submit">
              {inspectorLoading ? 'Loading...' : 'Load Quest'}
            </button>
          </form>

          <p className="helper-text helper-strong">{summaryMessage}</p>

          {inspectedQuest ? (
            <div className="pool-sheet">
              <div className="detail-row">
                <span>Reward</span>
                <strong>{inspectedQuest.quest.reward.toString()} pts</strong>
              </div>
              <div className="detail-row">
                <span>Starts</span>
                <strong>{formatDateTime(inspectedQuest.quest.startTime)}</strong>
              </div>
              <div className="detail-row">
                <span>Ends</span>
                <strong>{formatDateTime(inspectedQuest.quest.endTime)}</strong>
              </div>
              <div className="detail-row">
                <span>Merkle Root</span>
                <strong>{inspectedQuest.quest.merkleRoot}</strong>
              </div>
              <div className="detail-row">
                <span>Active</span>
                <strong>{inspectedQuest.quest.active ? 'Yes' : 'No'}</strong>
              </div>
              {address && (
                <div className="detail-box">
                  <span>Your Claim State</span>
                  <strong>{inspectedQuest.claimed ? 'Already claimed' : 'Not claimed yet'}</strong>
                  <small>Read from `claimed(questId, address)`.</small>
                </div>
              )}
            </div>
          ) : (
            <p className="panel-copy">
              Load a quest to view reward, start time, end time, Merkle root, active status, and claim state.
            </p>
          )}
        </section>

        <section className="paper-card market-board">
          <div className="panel-heading">
            <span className="section-kicker">Quests</span>
            <h2>Latest Quests</h2>
          </div>

          {latestQuests.length === 0 ? (
            <p className="panel-copy">No quests have been created yet on the bound contract.</p>
          ) : (
            <div className="pool-list">
              {latestQuests.map((questView) => (
                <QuestSnapshotCard
                  key={questView.id.toString()}
                  onUse={(questId) => {
                    const nextValue = questId.toString()
                    setInspectorId(nextValue)
                    setClaimQuestId(nextValue)
                    setManageQuestId(nextValue)
                    void loadQuest(nextValue)
                  }}
                  questView={questView}
                />
              ))}
            </div>
          )}
        </section>

        <section className="actions-grid">
          <form className="paper-card action-card" onSubmit={(event) => void handleCreateQuest(event)}>
            <div className="panel-heading">
              <span className="section-kicker">Action</span>
              <h2>Create Quest</h2>
            </div>
            <label className="field">
              <span>Reward</span>
              <input
                className="text-input"
                inputMode="numeric"
                onChange={(event) => setCreateReward(event.target.value)}
                placeholder="100"
                value={createReward}
              />
            </label>
            <label className="field">
              <span>Start Time</span>
              <input
                className="text-input"
                onChange={(event) => setCreateStartTime(event.target.value)}
                type="datetime-local"
                value={createStartTime}
              />
            </label>
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
              <span>Merkle Root</span>
              <input
                className="text-input"
                onChange={(event) => setCreateMerkleRoot(event.target.value)}
                placeholder="0x..."
                value={createMerkleRoot}
              />
            </label>
            <p className="helper-text">
              Matches `createQuest(reward, startTime, endTime, merkleRoot)` exactly.
            </p>
            <button className="button button-primary" disabled={!canTransact || isBusy} type="submit">
              {isBusy && pendingKind === 'createQuest' ? 'Submitting...' : 'Create Quest'}
            </button>
          </form>

          <form className="paper-card action-card" onSubmit={(event) => void handleSetQuestActive(event)}>
            <div className="panel-heading">
              <span className="section-kicker">Owner</span>
              <h2>Set Quest Active</h2>
            </div>
            <label className="field">
              <span>Quest ID</span>
              <input
                className="text-input"
                inputMode="numeric"
                onChange={(event) => setManageQuestId(event.target.value)}
                value={manageQuestId}
              />
            </label>
            <label className="field">
              <span>Active</span>
              <select
                className="text-input"
                onChange={(event) => setManageQuestActive(event.target.value as 'true' | 'false')}
                value={manageQuestActive}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </label>
            <p className="helper-text">Owner-only action for `setQuestActive(id, active)`.</p>
            <button className="button button-primary" disabled={!canTransact || isBusy} type="submit">
              {isBusy && pendingKind === 'setQuestActive' ? 'Submitting...' : 'Update Quest'}
            </button>
          </form>

          <form className="paper-card action-card" onSubmit={(event) => void handleSetPaused(event)}>
            <div className="panel-heading">
              <span className="section-kicker">Owner</span>
              <h2>Set Paused</h2>
            </div>
            <label className="field">
              <span>Status</span>
              <select
                className="text-input"
                onChange={(event) => setPauseValue(event.target.value as 'true' | 'false')}
                value={pauseValue}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </label>
            <p className="helper-text">Owner-only action for `setPaused(_paused)`.</p>
            <button className="button button-primary" disabled={!canTransact || isBusy} type="submit">
              {isBusy && pendingKind === 'setPaused' ? 'Submitting...' : 'Update Pause'}
            </button>
          </form>

          <form className="paper-card action-card" onSubmit={(event) => void handleClaim(event)}>
            <div className="panel-heading">
              <span className="section-kicker">Action</span>
              <h2>Claim Quest</h2>
            </div>
            <label className="field">
              <span>Quest ID</span>
              <input
                className="text-input"
                inputMode="numeric"
                onChange={(event) => setClaimQuestId(event.target.value)}
                value={claimQuestId}
              />
            </label>
            <label className="field">
              <span>Merkle Proof</span>
              <textarea
                className="text-input"
                onChange={(event) => setClaimProof(event.target.value)}
                placeholder="Paste bytes32 proof values separated by commas, spaces, or new lines"
                rows={4}
                value={claimProof}
              />
            </label>
            <p className="helper-text">
              This replaces the old completion flow. Claims now require `claim(questId, proof)` with a valid Merkle proof.
            </p>
            <button className="button button-primary" disabled={!canTransact || isBusy} type="submit">
              {isBusy && pendingKind === 'claim' ? 'Claiming...' : 'Claim Quest'}
            </button>
          </form>

          <section className="paper-card action-card">
            <div className="panel-heading">
              <span className="section-kicker">Action</span>
              <h2>Claim Points</h2>
            </div>
            <p className="helper-text">
              Current wallet points: <strong>{walletPoints.toString()}</strong>
            </p>
            <p className="helper-text">Calls `claimPoints()` and clears the wallet's accumulated points onchain.</p>
            <button
              className="button button-primary"
              disabled={!canTransact || isBusy}
              onClick={() => void handleClaimPoints()}
              type="button"
            >
              {isBusy && pendingKind === 'claimPoints' ? 'Submitting...' : 'Claim Points'}
            </button>
          </section>

          <form className="paper-card action-card" onSubmit={(event) => void handleClaimedLookup(event)}>
            <div className="panel-heading">
              <span className="section-kicker">Read</span>
              <h2>Check Claimed</h2>
            </div>
            <label className="field">
              <span>Address</span>
              <input
                className="text-input"
                onChange={(event) => setCheckAddressInput(event.target.value)}
                placeholder="0x..."
                value={checkAddressInput}
              />
            </label>
            <p className="helper-text">{checkClaimedResult}</p>
            <button className="button button-secondary" type="submit">
              Check Claim Status
            </button>
          </form>
        </section>
      </section>
    </main>
  )
}
