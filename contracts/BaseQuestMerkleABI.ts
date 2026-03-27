import { CONTRACT_ADDRESS } from '@/lib/appConfig'

export { CONTRACT_ADDRESS }

export const BaseQuestMerkleABI = [
  {
    inputs: [],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'questId', type: 'uint256' },
    ],
    name: 'Claimed',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: 'bool', name: 'status', type: 'bool' }],
    name: 'Paused',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, internalType: 'uint256', name: 'id', type: 'uint256' }],
    name: 'QuestCreated',
    type: 'event',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'questId', type: 'uint256' },
      { internalType: 'bytes32[]', name: 'proof', type: 'bytes32[]' },
    ],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'claimPoints',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint64', name: 'reward', type: 'uint64' },
      { internalType: 'uint32', name: 'startTime', type: 'uint32' },
      { internalType: 'uint32', name: 'endTime', type: 'uint32' },
      { internalType: 'bytes32', name: 'merkleRoot', type: 'bytes32' },
    ],
    name: 'createQuest',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'id', type: 'uint256' },
      { internalType: 'address', name: 'user', type: 'address' },
    ],
    name: 'claimed',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'id', type: 'uint256' }],
    name: 'getQuest',
    outputs: [
      { internalType: 'uint64', name: '', type: 'uint64' },
      { internalType: 'uint32', name: '', type: 'uint32' },
      { internalType: 'uint32', name: '', type: 'uint32' },
      { internalType: 'bytes32', name: '', type: 'bytes32' },
      { internalType: 'bool', name: '', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'points',
    outputs: [{ internalType: 'uint128', name: '', type: 'uint128' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'paused',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'questCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bool', name: '_paused', type: 'bool' }],
    name: 'setPaused',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'id', type: 'uint256' },
      { internalType: 'bool', name: 'active', type: 'bool' },
    ],
    name: 'setQuestActive',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

export type QuestShape = {
  reward: bigint
  startTime: bigint
  endTime: bigint
  merkleRoot: `0x${string}`
  active: boolean
}
