import { CONTRACT_ADDRESS } from '@/lib/appConfig'

export { CONTRACT_ADDRESS }

export const BasePlayABI = [
  {
    inputs: [
      { internalType: 'uint64', name: 'endTime', type: 'uint64' },
      { internalType: 'address', name: 'token', type: 'address' },
    ],
    name: 'createPool',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'id', type: 'uint256' },
      { internalType: 'bool', name: 'side', type: 'bool' },
      { internalType: 'uint128', name: 'amount', type: 'uint128' },
    ],
    name: 'bet',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'id', type: 'uint256' },
      { internalType: 'uint8', name: 'result', type: 'uint8' },
    ],
    name: 'submitResult',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'id', type: 'uint256' }],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'id', type: 'uint256' }],
    name: 'getOdds',
    outputs: [
      { internalType: 'uint256', name: 'sideAOdds', type: 'uint256' },
      { internalType: 'uint256', name: 'sideBOdds', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'poolCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'id', type: 'uint256' }],
    name: 'pools',
    outputs: [
      { internalType: 'uint64', name: 'endTime', type: 'uint64' },
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint128', name: 'totalSideA', type: 'uint128' },
      { internalType: 'uint128', name: 'totalSideB', type: 'uint128' },
      { internalType: 'uint8', name: 'result', type: 'uint8' },
      { internalType: 'bool', name: 'settled', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'id', type: 'uint256' },
      { internalType: 'address', name: 'user', type: 'address' },
    ],
    name: 'bets',
    outputs: [
      { internalType: 'bool', name: 'side', type: 'bool' },
      { internalType: 'uint128', name: 'amount', type: 'uint128' },
      { internalType: 'bool', name: 'claimed', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'oracle',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export type PoolShape = {
  endTime: bigint
  token: `0x${string}`
  totalSideA: bigint
  totalSideB: bigint
  result: number
  settled: boolean
  rawFlagA: bigint
  rawFlagB: bigint
}

export type BetShape = {
  side: boolean
  amount: bigint
  claimed: boolean
}

export type OddsShape = {
  sideAOdds: bigint
  sideBOdds: bigint
}
