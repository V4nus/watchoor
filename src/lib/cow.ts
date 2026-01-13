'use client';

import { OrderBookApi, OrderQuoteRequest, OrderQuoteSideKindSell, OrderQuoteSideKindBuy, SigningScheme, OrderKind, SellTokenSource, BuyTokenDestination } from '@cowprotocol/cow-sdk';

// CoW Protocol supported chains
export const COW_SUPPORTED_CHAINS: Record<number, string> = {
  1: 'mainnet',
  100: 'gnosis',
  42161: 'arbitrum',
  8453: 'base',
  11155111: 'sepolia',
};

// CoW API base URLs per chain
const COW_API_URLS: Record<number, string> = {
  1: 'https://api.cow.fi/mainnet',
  100: 'https://api.cow.fi/gnosis',
  42161: 'https://api.cow.fi/arbitrum_one',
  8453: 'https://api.cow.fi/base',
  11155111: 'https://api.cow.fi/sepolia',
};

// Vault relayer addresses (for token approvals)
export const VAULT_RELAYER: Record<number, `0x${string}`> = {
  1: '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110',
  100: '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110',
  42161: '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110',
  8453: '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110',
  11155111: '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110',
};

// Native token wrapper addresses (WETH)
export const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
export const WRAPPED_NATIVE: Record<number, `0x${string}`> = {
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  100: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d', // WXDAI
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
  8453: '0x4200000000000000000000000000000000000006', // WETH
  11155111: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', // WETH Sepolia
};

export interface QuoteParams {
  chainId: number;
  sellToken: string;
  buyToken: string;
  amount: string; // in wei
  kind: 'sell' | 'buy';
  userAddress: string;
  slippageBps?: number; // basis points, e.g., 50 = 0.5%
}

export interface QuoteResult {
  sellAmount: string;
  buyAmount: string;
  feeAmount: string;
  validTo: number;
  quoteId: string;
  sellToken: string;
  buyToken: string;
}

export interface OrderParams {
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  validTo: number;
  userAddress: string;
  receiver?: string;
  feeAmount: string;
  quoteId?: string;
}

// Get OrderBookApi instance for a chain
function getOrderBookApi(chainId: number): OrderBookApi {
  const baseUrl = COW_API_URLS[chainId];
  if (!baseUrl) {
    throw new Error(`Chain ${chainId} not supported by CoW Protocol`);
  }
  return new OrderBookApi({ chainId });
}

// Convert native token to wrapped version for CoW
function normalizeToken(token: string, chainId: number): string {
  if (token.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()) {
    return WRAPPED_NATIVE[chainId] || token;
  }
  return token;
}

// Get a quote for a swap
export async function getQuote(params: QuoteParams): Promise<QuoteResult> {
  const { chainId, sellToken, buyToken, amount, kind, userAddress, slippageBps = 50 } = params;

  const orderBookApi = getOrderBookApi(chainId);

  // Normalize tokens (convert native to wrapped)
  const normalizedSellToken = normalizeToken(sellToken, chainId);
  const normalizedBuyToken = normalizeToken(buyToken, chainId);

  const quoteRequest: OrderQuoteRequest = {
    sellToken: normalizedSellToken,
    buyToken: normalizedBuyToken,
    from: userAddress,
    receiver: userAddress,
    signingScheme: SigningScheme.EIP712,
    ...(kind === 'sell'
      ? { kind: OrderQuoteSideKindSell.SELL, sellAmountBeforeFee: amount }
      : { kind: OrderQuoteSideKindBuy.BUY, buyAmountAfterFee: amount }
    ),
  };

  try {
    const quote = await orderBookApi.getQuote(quoteRequest);

    // Apply slippage to buy amount for sell orders
    let adjustedBuyAmount = quote.quote.buyAmount;
    if (kind === 'sell' && slippageBps > 0) {
      const buyAmountBigInt = BigInt(quote.quote.buyAmount);
      const slippageMultiplier = BigInt(10000 - slippageBps);
      adjustedBuyAmount = ((buyAmountBigInt * slippageMultiplier) / BigInt(10000)).toString();
    }

    return {
      sellAmount: quote.quote.sellAmount,
      buyAmount: adjustedBuyAmount,
      feeAmount: quote.quote.feeAmount,
      validTo: quote.quote.validTo,
      quoteId: String(quote.id || ''),
      sellToken: normalizedSellToken,
      buyToken: normalizedBuyToken,
    };
  } catch (error) {
    console.error('Failed to get quote:', error);
    throw error;
  }
}

// Check if chain is supported by CoW
export function isChainSupported(chainId: number): boolean {
  return chainId in COW_SUPPORTED_CHAINS;
}

// Get chain name for CoW
export function getChainName(chainId: number): string | undefined {
  return COW_SUPPORTED_CHAINS[chainId];
}

// Format amount with decimals
export function formatTokenAmount(amount: string, decimals: number): string {
  const value = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;

  if (fractionalPart === BigInt(0)) {
    return integerPart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const trimmedFractional = fractionalStr.replace(/0+$/, '');

  return `${integerPart}.${trimmedFractional}`;
}

// Parse amount to wei
export function parseTokenAmount(amount: string, decimals: number): string {
  const [integerPart, fractionalPart = ''] = amount.split('.');
  const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals);
  const combinedStr = integerPart + paddedFractional;
  return BigInt(combinedStr).toString();
}

// Settlement contract addresses
export const SETTLEMENT_CONTRACT: Record<number, `0x${string}`> = {
  1: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41',
  100: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41',
  42161: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41',
  8453: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41',
  11155111: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41',
};

// Domain separator for EIP-712 signing
export const COW_PROTOCOL_DOMAIN = {
  name: 'Gnosis Protocol',
  version: 'v2',
};

// Order structure for signing
export interface CowOrder {
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  validTo: number;
  appData: string;
  feeAmount: string;
  kind: string;
  partiallyFillable: boolean;
  receiver: string;
  sellTokenBalance: string;
  buyTokenBalance: string;
}

// EIP-712 types for CoW order
export const COW_ORDER_TYPES = {
  Order: [
    { name: 'sellToken', type: 'address' },
    { name: 'buyToken', type: 'address' },
    { name: 'receiver', type: 'address' },
    { name: 'sellAmount', type: 'uint256' },
    { name: 'buyAmount', type: 'uint256' },
    { name: 'validTo', type: 'uint32' },
    { name: 'appData', type: 'bytes32' },
    { name: 'feeAmount', type: 'uint256' },
    { name: 'kind', type: 'string' },
    { name: 'partiallyFillable', type: 'bool' },
    { name: 'sellTokenBalance', type: 'string' },
    { name: 'buyTokenBalance', type: 'string' },
  ],
} as const;

// Default app data hash (empty app data)
export const DEFAULT_APP_DATA = '0x0000000000000000000000000000000000000000000000000000000000000000';

// Create order data for signing
export function createOrderData(params: {
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  validTo: number;
  receiver: string;
  feeAmount: string;
  kind: 'sell' | 'buy';
}): CowOrder {
  return {
    sellToken: params.sellToken,
    buyToken: params.buyToken,
    sellAmount: params.sellAmount,
    buyAmount: params.buyAmount,
    validTo: params.validTo,
    appData: DEFAULT_APP_DATA,
    feeAmount: params.feeAmount,
    kind: params.kind,
    partiallyFillable: false,
    receiver: params.receiver,
    sellTokenBalance: 'erc20',
    buyTokenBalance: 'erc20',
  };
}

// Get EIP-712 domain for a specific chain
export function getEIP712Domain(chainId: number) {
  return {
    name: COW_PROTOCOL_DOMAIN.name,
    version: COW_PROTOCOL_DOMAIN.version,
    chainId: chainId,
    verifyingContract: SETTLEMENT_CONTRACT[chainId],
  };
}

// Submit a signed order to CoW Protocol
export async function submitOrder(params: {
  chainId: number;
  order: CowOrder;
  signature: string;
  signingScheme: 'eip712' | 'ethsign' | 'presign';
  from: string;
}): Promise<string> {
  const { chainId, order, signature, signingScheme, from } = params;

  const orderBookApi = getOrderBookApi(chainId);

  try {
    const orderId = await orderBookApi.sendOrder({
      sellToken: order.sellToken,
      buyToken: order.buyToken,
      sellAmount: order.sellAmount,
      buyAmount: order.buyAmount,
      validTo: order.validTo,
      appData: order.appData,
      feeAmount: order.feeAmount,
      kind: order.kind as OrderKind,
      partiallyFillable: order.partiallyFillable,
      receiver: order.receiver,
      signature: signature,
      signingScheme: signingScheme === 'eip712' ? SigningScheme.EIP712 :
                     signingScheme === 'ethsign' ? SigningScheme.ETHSIGN :
                     SigningScheme.PRESIGN,
      from: from,
      sellTokenBalance: SellTokenSource.ERC20,
      buyTokenBalance: BuyTokenDestination.ERC20,
    });

    return orderId;
  } catch (error) {
    console.error('Failed to submit order:', error);
    throw error;
  }
}

// Get order status
export async function getOrderStatus(chainId: number, orderId: string) {
  const orderBookApi = getOrderBookApi(chainId);

  try {
    const order = await orderBookApi.getOrder(orderId);
    return order;
  } catch (error) {
    console.error('Failed to get order status:', error);
    throw error;
  }
}

// Get CoW Explorer URL for an order
export function getOrderExplorerUrl(chainId: number, orderId: string): string {
  const chainName = COW_SUPPORTED_CHAINS[chainId] || 'mainnet';
  return `https://explorer.cow.fi/${chainName === 'mainnet' ? '' : chainName + '/'}orders/${orderId}`;
}
