/**
 * Uniswap integration via Universal Router
 * Uses Permit2 for token approvals
 * Used for small trades where CoW batch auctions may timeout
 */

// Uniswap Universal Router addresses per chain
const UNIVERSAL_ROUTER: Record<number, string> = {
  1: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',      // Ethereum
  8453: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',   // Base
  42161: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD', // Arbitrum
  137: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',   // Polygon
  10: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',    // Optimism
};

// Permit2 address (same on all chains)
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

// Uniswap Quoter V2 addresses per chain
const UNISWAP_QUOTER: Record<number, string> = {
  1: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  8453: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
  42161: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  137: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  10: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
};

// Chains supported by Uniswap
export const UNISWAP_SUPPORTED_CHAINS = [1, 8453, 42161, 137, 10];

export function isUniswapSupported(chainId: number): boolean {
  return UNISWAP_SUPPORTED_CHAINS.includes(chainId);
}

export interface UniswapQuoteParams {
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  takerAddress: string;
  slippageBps?: number;
}

export interface UniswapQuote {
  sellAmount: string;
  buyAmount: string;
  price: string;
  to: string;
  data: string;
  value: string;
  estimatedGas: string;
  priceImpact: string;
  permit2Address?: string;
  needsPermit2?: boolean;
  universalRouter?: string;
}

/**
 * Get a swap quote from Uniswap via our server-side route
 */
export async function getUniswapQuote(params: UniswapQuoteParams): Promise<UniswapQuote> {
  const { chainId, sellToken, buyToken, sellAmount, takerAddress, slippageBps = 50 } = params;

  const queryParams = new URLSearchParams({
    chainId: chainId.toString(),
    sellToken,
    buyToken,
    sellAmount,
    takerAddress,
    slippageBps: slippageBps.toString(),
  });

  const response = await fetch(`/api/uniswap-quote?${queryParams}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Uniswap error: ${response.status}`);
  }

  return response.json();
}

// Minimum trade amounts for CoW (below this, use Uniswap)
export const COW_MIN_TRADE_USD = 50;

/**
 * Determine which aggregator to use based on trade size
 */
export function selectAggregator(amountUsd: number): 'cow' | 'uniswap' {
  return amountUsd >= COW_MIN_TRADE_USD ? 'cow' : 'uniswap';
}

// Permit2 ABI for approval functions
export const PERMIT2_ABI = [
  // Check allowance granted from token owner to spender via Permit2
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Approve spender to spend tokens via Permit2
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
    ],
    name: 'approve',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Export addresses for use in components
export { UNIVERSAL_ROUTER, PERMIT2_ADDRESS, UNISWAP_QUOTER };
