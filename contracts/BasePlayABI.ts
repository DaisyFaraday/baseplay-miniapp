export const CONTRACT_ADDRESS = '0x53420899c0b98105e0fe4ab5ae09033b5ef5880d' as const

export const BasePlayABI = [
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
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
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'pools',
    outputs: [
      {
        components: [
          { internalType: 'string', name: 'title', type: 'string' },
          { internalType: 'string', name: 'optionA', type: 'string' },
          { internalType: 'string', name: 'optionB', type: 'string' },
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
          { internalType: 'bool', name: 'settled', type: 'bool' },
          { internalType: 'uint256', name: 'totalA', type: 'uint256' },
          { internalType: 'uint256', name: 'totalB', type: 'uint256' },
        ],
        internalType: 'struct BasePlay.Pool',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'title', type: 'string' },
      { internalType: 'string', name: 'optionA', type: 'string' },
      { internalType: 'string', name: 'optionB', type: 'string' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'createPool',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'poolId', type: 'uint256' },
      { internalType: 'uint8', name: 'option', type: 'uint8' },
    ],
    name: 'bet',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'poolId', type: 'uint256' }],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

export type PoolStruct = {
  title: string
  optionA: string
  optionB: string
  deadline: bigint
  settled: boolean
  totalA: bigint
  totalB: bigint
}
