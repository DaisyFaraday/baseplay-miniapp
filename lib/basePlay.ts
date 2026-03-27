import {
  type Address,
  decodeFunctionResult,
  encodeFunctionData,
  formatUnits,
  isAddress,
  parseEther,
  parseUnits,
  zeroAddress,
} from 'viem'
import type { PublicClient } from 'viem'
import {
  BasePlayABI,
  CONTRACT_ADDRESS,
  type BetShape,
  type OddsShape,
  type PoolShape,
} from '@/contracts/BasePlayABI'

const ERC20_METADATA_ABI = [
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

const tokenMetaCache = new Map<string, { decimals: number; symbol: string }>()

function getWord(data: `0x${string}`, index: number) {
  const start = 2 + index * 64
  return BigInt(`0x${data.slice(start, start + 64)}`)
}

function getAddressWord(data: `0x${string}`, index: number) {
  const start = 2 + index * 64 + 24
  return `0x${data.slice(start, start + 40)}` as Address
}

export function isNativeToken(token: Address) {
  return token.toLowerCase() === zeroAddress
}

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

export function parseEndTimeInput(value: string) {
  const date = new Date(value)
  const unix = Math.floor(date.getTime() / 1000)
  if (!Number.isFinite(unix) || unix <= 0) return null
  return BigInt(unix)
}

export function toDateTimeLocalValue(date = new Date(Date.now() + 60 * 60 * 1000)) {
  const offset = date.getTimezoneOffset()
  const adjusted = new Date(date.getTime() - offset * 60_000)
  return adjusted.toISOString().slice(0, 16)
}

export async function readPoolCount(client: PublicClient) {
  const data = encodeFunctionData({
    abi: BasePlayABI,
    functionName: 'poolCount',
  })
  const result = await client.call({
    to: CONTRACT_ADDRESS,
    data,
  })
  return getWord(result.data as `0x${string}`, 0)
}

export async function readOracle(client: PublicClient) {
  const data = encodeFunctionData({
    abi: BasePlayABI,
    functionName: 'oracle',
  })
  const result = await client.call({
    to: CONTRACT_ADDRESS,
    data,
  })
  return getAddressWord(result.data as `0x${string}`, 0)
}

export async function readPool(client: PublicClient, poolId: bigint): Promise<PoolShape> {
  const data = encodeFunctionData({
    abi: BasePlayABI,
    functionName: 'pools',
    args: [poolId],
  })
  const result = await client.call({
    to: CONTRACT_ADDRESS,
    data,
  })
  const raw = result.data as `0x${string}`
  const words = Array.from({ length: 6 }, (_, index) => getWord(raw, index))
  const plausibleEndTimeIndex = words.findIndex(
    (value) => value >= 1_700_000_000n && value <= 5_000_000_000n
  )
  const endTimeIndex = plausibleEndTimeIndex >= 0 ? plausibleEndTimeIndex : 2
  const tokenIndex = endTimeIndex === 2 ? 3 : 1
  const totalAIndex = endTimeIndex === 2 ? 0 : 2
  const totalBIndex = endTimeIndex === 2 ? 1 : 3
  const rawFlagA = getWord(raw, 4)
  const rawFlagB = getWord(raw, 5)
  const candidateA = Number(rawFlagA)
  const candidateB = Number(rawFlagB)
  const resultValue =
    candidateA >= 0 && candidateA <= 2
      ? candidateA
      : candidateB >= 0 && candidateB <= 2
        ? candidateB
        : 0

  return {
    endTime: words[endTimeIndex],
    token: getAddressWord(raw, tokenIndex),
    totalSideA: words[totalAIndex],
    totalSideB: words[totalBIndex],
    result: resultValue,
    settled: resultValue !== 0 || rawFlagA === 1n || rawFlagB === 1n,
    rawFlagA,
    rawFlagB,
  }
}

export async function readBet(
  client: PublicClient,
  poolId: bigint,
  user: Address
): Promise<BetShape> {
  const data = encodeFunctionData({
    abi: BasePlayABI,
    functionName: 'bets',
    args: [poolId, user],
  })
  const result = await client.call({
    to: CONTRACT_ADDRESS,
    data,
  })
  const raw = result.data as `0x${string}`
  return {
    side: getWord(raw, 0) === 1n,
    amount: getWord(raw, 1),
    claimed: getWord(raw, 2) !== 0n,
  }
}

export async function readOdds(client: PublicClient, poolId: bigint): Promise<OddsShape> {
  const data = encodeFunctionData({
    abi: BasePlayABI,
    functionName: 'getOdds',
    args: [poolId],
  })
  const result = await client.call({
    to: CONTRACT_ADDRESS,
    data,
  })
  const raw = result.data as `0x${string}`
  return {
    sideAOdds: getWord(raw, 0),
    sideBOdds: getWord(raw, 1),
  }
}

export async function readTokenMeta(client: PublicClient, token: Address) {
  if (isNativeToken(token)) {
    return { decimals: 18, symbol: 'ETH' }
  }

  const cacheKey = token.toLowerCase()
  const cached = tokenMetaCache.get(cacheKey)
  if (cached) return cached

  const decimalsData = encodeFunctionData({
    abi: ERC20_METADATA_ABI,
    functionName: 'decimals',
  })
  const symbolData = encodeFunctionData({
    abi: ERC20_METADATA_ABI,
    functionName: 'symbol',
  })

  const [decimalsRaw, symbolRaw] = await Promise.all([
    client.call({ to: token, data: decimalsData }),
    client.call({ to: token, data: symbolData }),
  ])

  const decimals = decodeFunctionResult({
    abi: ERC20_METADATA_ABI,
    functionName: 'decimals',
    data: decimalsRaw.data as `0x${string}`,
  })
  const symbol = decodeFunctionResult({
    abi: ERC20_METADATA_ABI,
    functionName: 'symbol',
    data: symbolRaw.data as `0x${string}`,
  })

  const meta = { decimals: Number(decimals), symbol }
  tokenMetaCache.set(cacheKey, meta)

  return meta
}

export async function readAllowance(client: PublicClient, token: Address, owner: Address) {
  if (isNativeToken(token)) return 0n
  const data = encodeFunctionData({
    abi: ERC20_METADATA_ABI,
    functionName: 'allowance',
    args: [owner, CONTRACT_ADDRESS],
  })
  const result = await client.call({
    to: token,
    data,
  })
  return decodeFunctionResult({
    abi: ERC20_METADATA_ABI,
    functionName: 'allowance',
    data: result.data as `0x${string}`,
  })
}

export function buildApproveRequest(token: Address, amount: bigint) {
  return {
    address: token,
    abi: ERC20_METADATA_ABI,
    functionName: 'approve' as const,
    args: [CONTRACT_ADDRESS, amount] as const,
  }
}

export function parseTokenAmount(value: string, decimals: number, nativeToken: boolean) {
  if (!value || Number(value) <= 0) return null
  return nativeToken ? parseEther(value) : parseUnits(value, decimals)
}

export function formatTokenAmount(value: bigint, decimals: number, symbol: string) {
  return `${formatUnits(value, decimals)} ${symbol}`
}

export function formatOddsValue(value: bigint) {
  return Number(value) === 0 ? '0' : value.toString()
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
  if (normalized.includes('insufficient funds')) return 'The wallet balance is too low for this transaction.'
  if (normalized.includes('execution reverted')) return 'The contract rejected the transaction. Review the form values and pool status.'
  if (normalized.includes('eth value')) return 'ETH value mismatch. Native-token bets must send the same value as the bet amount.'
  if (normalized.includes('already settled')) return 'This pool has already been settled.'
  if (normalized.includes('already claimed')) return 'This reward has already been claimed.'
  if (normalized.includes('permission')) return 'Permission denied for the requested action.'

  return message
}
