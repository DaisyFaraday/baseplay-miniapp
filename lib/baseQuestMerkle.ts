import type { Address, PublicClient } from 'viem'
import { isAddress } from 'viem'
import { BaseQuestMerkleABI, CONTRACT_ADDRESS, type QuestShape } from '@/contracts/BaseQuestMerkleABI'

export function formatDateTime(timestamp: bigint) {
  if (!timestamp) return 'Not set'
  return new Date(Number(timestamp) * 1000).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function formatAddress(address?: string | null) {
  if (!address) return 'Not available'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function safeAddress(value: string) {
  return isAddress(value) ? (value as Address) : null
}

export function parseDateTimeInput(value: string) {
  const date = new Date(value)
  const unix = Math.floor(date.getTime() / 1000)
  if (!Number.isFinite(unix) || unix <= 0) return null
  return unix
}

export function toDateTimeLocalValue(date = new Date(Date.now() + 60 * 60 * 1000)) {
  const offset = date.getTimezoneOffset()
  const adjusted = new Date(date.getTime() - offset * 60_000)
  return adjusted.toISOString().slice(0, 16)
}

export function parseProofInput(value: string) {
  const items = value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  for (const item of items) {
    if (!/^0x[a-fA-F0-9]{64}$/.test(item)) {
      throw new Error('Proof entries must be valid bytes32 values.')
    }
  }

  return items as `0x${string}`[]
}

export function parseMerkleRoot(value: string) {
  const normalized = value.trim()
  if (!/^0x[a-fA-F0-9]{64}$/.test(normalized)) return null
  return normalized as `0x${string}`
}

export async function readQuestCount(client: PublicClient) {
  return client.readContract({
    address: CONTRACT_ADDRESS,
    abi: BaseQuestMerkleABI,
    functionName: 'questCount',
  })
}

export async function readPaused(client: PublicClient) {
  return client.readContract({
    address: CONTRACT_ADDRESS,
    abi: BaseQuestMerkleABI,
    functionName: 'paused',
  })
}

export async function readOwner(client: PublicClient) {
  return client.readContract({
    address: CONTRACT_ADDRESS,
    abi: BaseQuestMerkleABI,
    functionName: 'owner',
  })
}

export async function readQuest(client: PublicClient, questId: bigint): Promise<QuestShape> {
  const [reward, startTime, endTime, merkleRoot, active] = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: BaseQuestMerkleABI,
    functionName: 'getQuest',
    args: [questId],
  })

  return {
    reward,
    startTime: BigInt(startTime),
    endTime: BigInt(endTime),
    merkleRoot,
    active,
  }
}

export async function readPoints(client: PublicClient, user: Address) {
  return client.readContract({
    address: CONTRACT_ADDRESS,
    abi: BaseQuestMerkleABI,
    functionName: 'points',
    args: [user],
  })
}

export async function readClaimed(client: PublicClient, questId: bigint, user: Address) {
  return client.readContract({
    address: CONTRACT_ADDRESS,
    abi: BaseQuestMerkleABI,
    functionName: 'claimed',
    args: [questId, user],
  })
}

export function getFriendlyError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Transaction failed.'

  const normalized = message.toLowerCase()

  if (normalized.includes('user rejected')) return 'The transaction was rejected in the wallet.'
  if (normalized.includes('not_owner')) return 'Only the contract owner can perform this action.'
  if (normalized.includes('paused')) return 'The contract is paused right now.'
  if (normalized.includes('invalid_time')) return 'End time must be later than start time.'
  if (normalized.includes('inactive')) return 'This quest is not active.'
  if (normalized.includes('not_started')) return 'This quest has not started yet.'
  if (normalized.includes('ended')) return 'This quest has already ended.'
  if (normalized.includes('already')) return 'This quest has already been claimed by this wallet.'
  if (normalized.includes('invalid_proof')) return 'The Merkle proof is invalid for this wallet.'
  if (normalized.includes('no_points')) return 'There are no claimable points for this wallet.'
  if (normalized.includes('execution reverted')) {
    return 'The contract rejected the transaction. Check the quest status, proof, and wallet permissions.'
  }

  return message
}
