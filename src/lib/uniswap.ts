/**
 * Uniswap integration for instant swaps
 * Used for small trades where CoW batch auctions may timeout
 */

// Uniswap Universal Router addresses per chain
const UNISWAP_ROUTER: Record<number, string> = {
  1: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',      // Ethereum
  8453: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',   // Base
  42161: '0x5E325eDA8064b456f4781070C0738d849c824258', // Arbitrum
  137: '0xec7BE89e9d109e7e3Fec59c222CF297125FEFda2',   // Polygon
  10: '0xCb1355ff08Ab38bBCE60111F1bb2B784bE25D7e8',    // Optimism
};

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

// Export router addresses for use in components
export { UNISWAP_ROUTER, UNISWAP_QUOTER };
