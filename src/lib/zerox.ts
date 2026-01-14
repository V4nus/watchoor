/**
 * 0x API integration for instant swaps
 * Used as fallback for small trades where CoW batch auctions may not find solvers
 */

// 0x API endpoints per chain
const ZEROX_API_BASE: Record<number, string> = {
  1: 'https://api.0x.org',      // Ethereum
  8453: 'https://base.api.0x.org', // Base
  42161: 'https://arbitrum.api.0x.org', // Arbitrum
  137: 'https://polygon.api.0x.org', // Polygon
  10: 'https://optimism.api.0x.org', // Optimism
};

// Chains supported by 0x
export const ZEROX_SUPPORTED_CHAINS = [1, 8453, 42161, 137, 10];

export function isZeroXSupported(chainId: number): boolean {
  return ZEROX_SUPPORTED_CHAINS.includes(chainId);
}

export interface ZeroXQuoteParams {
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  takerAddress: string;
  slippageBps?: number;
}

export interface ZeroXQuote {
  sellAmount: string;
  buyAmount: string;
  price: string;
  guaranteedPrice: string;
  to: string;
  data: string;
  value: string;
  gasPrice: string;
  estimatedGas: string;
  allowanceTarget: string;
  sellTokenAddress: string;
  buyTokenAddress: string;
}

/**
 * Get a swap quote from 0x API
 * This returns transaction data ready to be executed
 */
export async function getZeroXQuote(params: ZeroXQuoteParams): Promise<ZeroXQuote> {
  const { chainId, sellToken, buyToken, sellAmount, takerAddress, slippageBps = 50 } = params;

  const baseUrl = ZEROX_API_BASE[chainId];
  if (!baseUrl) {
    throw new Error(`0x API not supported for chain ${chainId}`);
  }

  // Convert slippage from basis points to percentage (0x uses decimal, e.g., 0.01 = 1%)
  const slippagePercentage = slippageBps / 10000;

  const queryParams = new URLSearchParams({
    sellToken,
    buyToken,
    sellAmount,
    takerAddress,
    slippagePercentage: slippagePercentage.toString(),
  });

  const response = await fetch(`${baseUrl}/swap/v1/quote?${queryParams}`, {
    headers: {
      '0x-api-key': process.env.NEXT_PUBLIC_ZEROX_API_KEY || '',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('0x API error:', errorData);
    throw new Error(errorData.reason || `0x API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    sellAmount: data.sellAmount,
    buyAmount: data.buyAmount,
    price: data.price,
    guaranteedPrice: data.guaranteedPrice,
    to: data.to,
    data: data.data,
    value: data.value,
    gasPrice: data.gasPrice,
    estimatedGas: data.estimatedGas,
    allowanceTarget: data.allowanceTarget,
    sellTokenAddress: data.sellTokenAddress,
    buyTokenAddress: data.buyTokenAddress,
  };
}

/**
 * Get a price quote from 0x (no transaction data, just for display)
 */
export async function getZeroXPrice(params: Omit<ZeroXQuoteParams, 'takerAddress'>): Promise<{
  sellAmount: string;
  buyAmount: string;
  price: string;
  estimatedGas: string;
}> {
  const { chainId, sellToken, buyToken, sellAmount, slippageBps = 50 } = params;

  const baseUrl = ZEROX_API_BASE[chainId];
  if (!baseUrl) {
    throw new Error(`0x API not supported for chain ${chainId}`);
  }

  const slippagePercentage = slippageBps / 10000;

  const queryParams = new URLSearchParams({
    sellToken,
    buyToken,
    sellAmount,
    slippagePercentage: slippagePercentage.toString(),
  });

  const response = await fetch(`${baseUrl}/swap/v1/price?${queryParams}`, {
    headers: {
      '0x-api-key': process.env.NEXT_PUBLIC_ZEROX_API_KEY || '',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.reason || `0x API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    sellAmount: data.sellAmount,
    buyAmount: data.buyAmount,
    price: data.price,
    estimatedGas: data.estimatedGas,
  };
}

// Minimum trade amounts for CoW (below this, use 0x)
// Values in USD equivalent
export const COW_MIN_TRADE_USD = 50;

/**
 * Determine which aggregator to use based on trade size
 * @param amountUsd The trade amount in USD
 * @returns 'cow' for batch auction or 'zerox' for instant swap
 */
export function selectAggregator(amountUsd: number): 'cow' | 'zerox' {
  return amountUsd >= COW_MIN_TRADE_USD ? 'cow' : 'zerox';
}
