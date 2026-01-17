/**
 * Solana Liquidity Depth - Support for all major Solana DEXs
 *
 * Supported DEXs:
 * - PumpSwap (AMM x*y=k)
 * - Raydium AMM V4 (AMM x*y=k)
 * - Raydium CLMM (Concentrated Liquidity)
 * - Orca Whirlpool (Concentrated Liquidity)
 * - Meteora DLMM (Dynamic Liquidity Market Maker)
 */

import { Connection, PublicKey } from '@solana/web3.js';
import DLMM from '@meteora-ag/dlmm';

// ============ Types ============

export interface LiquidityLevel {
  price: number;
  priceUpper?: number;
  priceLower?: number;
  token0Amount: number;
  token1Amount: number;
  liquidityUSD: number;
}

export interface SolanaDepthData {
  bids: LiquidityLevel[];
  asks: LiquidityLevel[];
  currentPrice: number;
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  poolType: 'pumpswap' | 'raydium-amm' | 'raydium-clmm' | 'orca' | 'meteora';
}

// ============ Program IDs ============

const PROGRAM_IDS = {
  // PumpSwap AMM
  PUMPSWAP: new PublicKey('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA'),

  // Raydium
  RAYDIUM_AMM_V4: new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'),
  RAYDIUM_CLMM: new PublicKey('CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK'),

  // Orca Whirlpool
  ORCA_WHIRLPOOL: new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc'),

  // Meteora DLMM
  METEORA_DLMM: new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'),
};

// ============ RPC Configuration ============

const SOLANA_RPC_URLS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-mainnet.rpc.extrnode.com',
  'https://mainnet.helius-rpc.com/?api-key=1d8740dc-e5f4-421c-b823-e1bad1889eff', // Free tier
];

// Track which RPC is currently working best
let currentRpcIndex = 0;
let lastRpcSuccess = Date.now();

function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || SOLANA_RPC_URLS[currentRpcIndex];
  return new Connection(rpcUrl, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 10000, // 10 second timeout
  });
}

// Try next RPC if current one fails
function rotateRpc(): void {
  currentRpcIndex = (currentRpcIndex + 1) % SOLANA_RPC_URLS.length;
  console.log(`[Solana RPC] Rotating to: ${SOLANA_RPC_URLS[currentRpcIndex]}`);
}

// Helper: retry with multiple RPCs
async function withRpcRetry<T>(
  operation: (connection: Connection) => Promise<T>,
  maxRetries: number = 3
): Promise<T | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const connection = getConnection();
      const result = await Promise.race([
        operation(connection),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('RPC timeout')), 8000)
        )
      ]);
      lastRpcSuccess = Date.now();
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Solana RPC] Attempt ${attempt + 1}/${maxRetries} failed: ${errorMsg}`);
      rotateRpc();
    }
  }
  return null;
}

// ============ Account Layouts ============

// PumpSwap Pool Layout (simplified - key fields)
interface PumpSwapPoolState {
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseReserve: bigint;
  quoteReserve: bigint;
}

// Raydium AMM V4 Pool Layout
interface RaydiumAmmPoolState {
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseVault: PublicKey;
  quoteVault: PublicKey;
  baseReserve: bigint;
  quoteReserve: bigint;
}

// Raydium CLMM Pool Layout
interface RaydiumClmmPoolState {
  tokenMint0: PublicKey;
  tokenMint1: PublicKey;
  tickSpacing: number;
  liquidity: bigint;
  sqrtPriceX64: bigint;
  tickCurrent: number;
}

// Orca Whirlpool Layout
interface WhirlpoolState {
  tokenMintA: PublicKey;
  tokenMintB: PublicKey;
  tickSpacing: number;
  liquidity: bigint;
  sqrtPrice: bigint;
  tickCurrentIndex: number;
}

// Meteora DLMM Layout
interface MeteoraDlmmState {
  tokenXMint: PublicKey;
  tokenYMint: PublicKey;
  binStep: number;
  activeId: number;
  reserveX: bigint;
  reserveY: bigint;
}

// ============ DEX Detection ============

export type SolanaDexType = 'pumpswap' | 'raydium-amm' | 'raydium-clmm' | 'orca' | 'meteora' | 'unknown';

export function detectSolanaDexType(dexId?: string): SolanaDexType {
  if (!dexId) return 'unknown';

  const dexLower = dexId.toLowerCase();

  if (dexLower.includes('pumpswap') || dexLower.includes('pump_swap') || dexLower.includes('pump.fun')) {
    return 'pumpswap';
  }
  if (dexLower.includes('raydium')) {
    if (dexLower.includes('clmm')) return 'raydium-clmm';
    return 'raydium-amm';
  }
  if (dexLower.includes('orca') || dexLower.includes('whirlpool')) {
    return 'orca';
  }
  // Meteora - match "meteora", "meteora_dlmm", "meteora-dlmm", etc.
  if (dexLower.includes('meteora')) {
    return 'meteora';
  }

  return 'unknown';
}

// ============ Constant Product AMM (V2 style) ============

/**
 * Generate order book from constant product AMM reserves (x*y=k)
 * Works for: PumpSwap, Raydium AMM V4
 */
function generateConstantProductOrderBook(
  reserve0: number,
  reserve1: number,
  priceUsd: number,
  maxLevels: number = 50
): { bids: LiquidityLevel[]; asks: LiquidityLevel[] } {
  const k = reserve0 * reserve1;
  const poolPrice = reserve1 / reserve0; // price of token0 in terms of token1

  const bids: LiquidityLevel[] = [];
  const asks: LiquidityLevel[] = [];
  const effectiveLevels = Math.min(maxLevels, 50);
  const maxPct = 50; // Max 50% price change

  for (let i = 1; i <= effectiveLevels; i++) {
    const ratio = i / effectiveLevels;
    const pctChange = maxPct * Math.pow(ratio, 1.5); // Non-linear distribution

    // BID (price goes down, buying token0)
    const bidPriceRatio = 1 - pctChange / 100;
    if (bidPriceRatio > 0) {
      const newPoolPrice = poolPrice * bidPriceRatio;
      const newReserve0 = Math.sqrt(k / newPoolPrice);
      const newReserve1 = Math.sqrt(k * newPoolPrice);
      const token0Bought = newReserve0 - reserve0;
      const token1Spent = reserve1 - newReserve1;

      if (token0Bought > 0 && token1Spent > 0) {
        const bidPrice = priceUsd * bidPriceRatio;
        bids.push({
          price: bidPrice,
          token0Amount: token0Bought,
          token1Amount: token1Spent,
          liquidityUSD: token0Bought * bidPrice,
        });
      }
    }

    // ASK (price goes up, selling token0)
    const askPriceRatio = 1 + pctChange / 100;
    const newPoolPriceAsk = poolPrice * askPriceRatio;
    const newReserve0Ask = Math.sqrt(k / newPoolPriceAsk);
    const newReserve1Ask = Math.sqrt(k * newPoolPriceAsk);
    const token0Sold = reserve0 - newReserve0Ask;
    const token1Gained = newReserve1Ask - reserve1;

    if (token0Sold > 0 && token1Gained > 0) {
      const askPrice = priceUsd * askPriceRatio;
      asks.push({
        price: askPrice,
        token0Amount: token0Sold,
        token1Amount: token1Gained,
        liquidityUSD: token0Sold * priceUsd,
      });
    }
  }

  bids.sort((a, b) => b.price - a.price);
  asks.sort((a, b) => a.price - b.price);

  return { bids, asks };
}

// ============ PumpSwap ============

async function getPumpSwapPoolState(
  connection: Connection,
  poolAddress: string
): Promise<PumpSwapPoolState | null> {
  try {
    const accountInfo = await connection.getAccountInfo(new PublicKey(poolAddress));
    if (!accountInfo || !accountInfo.data) return null;

    const data = accountInfo.data;

    // PumpSwap pool layout (based on pump-public-docs)
    // Offset values may need adjustment based on actual layout
    const baseMint = new PublicKey(data.slice(8, 40));
    const quoteMint = new PublicKey(data.slice(40, 72));
    const baseReserve = data.readBigUInt64LE(72);
    const quoteReserve = data.readBigUInt64LE(80);

    return {
      baseMint,
      quoteMint,
      baseReserve,
      quoteReserve,
    };
  } catch (error) {
    console.error('[PumpSwap] Failed to get pool state:', error);
    return null;
  }
}

export async function getPumpSwapDepth(
  poolAddress: string,
  priceUsd: number,
  baseSymbol: string,
  quoteSymbol: string,
  baseDecimals: number = 9,
  quoteDecimals: number = 9,
  maxLevels: number = 50
): Promise<SolanaDepthData | null> {
  try {
    const connection = getConnection();
    const poolState = await getPumpSwapPoolState(connection, poolAddress);

    if (!poolState) {
      console.log('[PumpSwap] Pool state not found, using fallback');
      return null;
    }

    const reserve0 = Number(poolState.baseReserve) / Math.pow(10, baseDecimals);
    const reserve1 = Number(poolState.quoteReserve) / Math.pow(10, quoteDecimals);

    console.log(`[PumpSwap] Reserves: ${reserve0} ${baseSymbol}, ${reserve1} ${quoteSymbol}`);

    const { bids, asks } = generateConstantProductOrderBook(reserve0, reserve1, priceUsd, maxLevels);

    return {
      bids,
      asks,
      currentPrice: priceUsd,
      token0Symbol: baseSymbol,
      token1Symbol: quoteSymbol,
      token0Decimals: baseDecimals,
      token1Decimals: quoteDecimals,
      poolType: 'pumpswap',
    };
  } catch (error) {
    console.error('[PumpSwap] Error fetching depth:', error);
    return null;
  }
}

// ============ Raydium AMM V4 ============

// Extended pool state with decimals
interface RaydiumAmmPoolStateWithDecimals extends RaydiumAmmPoolState {
  baseDecimals: number;
  quoteDecimals: number;
}

async function getRaydiumAmmPoolState(
  connection: Connection,
  poolAddress: string
): Promise<RaydiumAmmPoolStateWithDecimals | null> {
  try {
    const accountInfo = await connection.getAccountInfo(new PublicKey(poolAddress));
    if (!accountInfo || !accountInfo.data) return null;

    const data = accountInfo.data;

    // Raydium AMM V4 layout (simplified)
    // Based on: https://github.com/raydium-io/raydium-sdk
    const baseMint = new PublicKey(data.slice(400, 432));
    const quoteMint = new PublicKey(data.slice(432, 464));
    const baseVault = new PublicKey(data.slice(336, 368));
    const quoteVault = new PublicKey(data.slice(368, 400));

    // Get vault balances - these include decimals info
    const [baseVaultInfo, quoteVaultInfo] = await Promise.all([
      connection.getTokenAccountBalance(baseVault),
      connection.getTokenAccountBalance(quoteVault),
    ]);

    return {
      baseMint,
      quoteMint,
      baseVault,
      quoteVault,
      baseReserve: BigInt(baseVaultInfo.value.amount),
      quoteReserve: BigInt(quoteVaultInfo.value.amount),
      baseDecimals: baseVaultInfo.value.decimals,
      quoteDecimals: quoteVaultInfo.value.decimals,
    };
  } catch (error) {
    console.error('[Raydium AMM] Failed to get pool state:', error);
    return null;
  }
}

export async function getRaydiumAmmDepth(
  poolAddress: string,
  priceUsd: number,
  baseSymbol: string,
  quoteSymbol: string,
  baseDecimals: number = 9,
  quoteDecimals: number = 9,
  maxLevels: number = 50,
  baseTokenAddress?: string
): Promise<SolanaDepthData | null> {
  try {
    const connection = getConnection();
    const poolState = await getRaydiumAmmPoolState(connection, poolAddress);

    if (!poolState) {
      console.log('[Raydium AMM] Pool state not found');
      return null;
    }

    // Use on-chain decimals from token accounts (more accurate than DexScreener)
    let poolBaseDecimals = poolState.baseDecimals;
    let poolQuoteDecimals = poolState.quoteDecimals;

    // Check if we need to swap the order based on actual mint addresses
    // Raydium pools have their own base/quote ordering which may differ from DexScreener
    let reserve0 = Number(poolState.baseReserve) / Math.pow(10, poolBaseDecimals);
    let reserve1 = Number(poolState.quoteReserve) / Math.pow(10, poolQuoteDecimals);

    // If baseTokenAddress is provided, check if it matches the pool's baseMint
    // If not, swap the reserves
    if (baseTokenAddress) {
      const poolBaseMint = poolState.baseMint.toBase58();
      if (poolBaseMint.toLowerCase() !== baseTokenAddress.toLowerCase()) {
        // The pool's base is actually our quote, swap them
        console.log(`[Raydium AMM] Token order mismatch - swapping reserves`);
        console.log(`  Pool baseMint: ${poolBaseMint.slice(0, 10)}... (decimals: ${poolBaseDecimals})`);
        console.log(`  Expected base: ${baseTokenAddress.slice(0, 10)}... (pool quote decimals: ${poolQuoteDecimals})`);
        [reserve0, reserve1] = [reserve1, reserve0];
        // Also swap decimals
        [poolBaseDecimals, poolQuoteDecimals] = [poolQuoteDecimals, poolBaseDecimals];
      }
    }

    console.log(`[Raydium AMM] Reserves: ${reserve0} ${baseSymbol}, ${reserve1} ${quoteSymbol} (decimals: ${poolBaseDecimals}/${poolQuoteDecimals})`);

    const { bids, asks } = generateConstantProductOrderBook(reserve0, reserve1, priceUsd, maxLevels);

    return {
      bids,
      asks,
      currentPrice: priceUsd,
      token0Symbol: baseSymbol,
      token1Symbol: quoteSymbol,
      token0Decimals: poolBaseDecimals,
      token1Decimals: poolQuoteDecimals,
      poolType: 'raydium-amm',
    };
  } catch (error) {
    console.error('[Raydium AMM] Error fetching depth:', error);
    return null;
  }
}

// ============ CLMM Helper Functions ============

function sqrtPriceX64ToPrice(sqrtPriceX64: bigint, decimals0: number, decimals1: number): number {
  const price = Number(sqrtPriceX64) ** 2 / 2 ** 128;
  return price * Math.pow(10, decimals0 - decimals1);
}

function tickToPrice(tick: number, decimals0: number, decimals1: number): number {
  const price = Math.pow(1.0001, tick);
  return price * Math.pow(10, decimals0 - decimals1);
}

// ============ Raydium CLMM ============

async function getRaydiumClmmPoolState(
  connection: Connection,
  poolAddress: string
): Promise<RaydiumClmmPoolState | null> {
  try {
    const accountInfo = await connection.getAccountInfo(new PublicKey(poolAddress));
    if (!accountInfo || !accountInfo.data) return null;

    const data = accountInfo.data;

    // Raydium CLMM layout (based on raydium-clmm)
    // Skip discriminator (8 bytes)
    const tokenMint0 = new PublicKey(data.slice(73, 105));
    const tokenMint1 = new PublicKey(data.slice(105, 137));
    const tickSpacing = data.readUInt16LE(137);
    const liquidity = data.readBigUInt64LE(169) + (data.readBigUInt64LE(177) << 64n);
    const sqrtPriceX64 = data.readBigUInt64LE(185) + (data.readBigUInt64LE(193) << 64n);
    const tickCurrent = data.readInt32LE(201);

    return {
      tokenMint0,
      tokenMint1,
      tickSpacing,
      liquidity,
      sqrtPriceX64,
      tickCurrent,
    };
  } catch (error) {
    console.error('[Raydium CLMM] Failed to get pool state:', error);
    return null;
  }
}

export async function getRaydiumClmmDepth(
  poolAddress: string,
  priceUsd: number,
  baseSymbol: string,
  quoteSymbol: string,
  baseDecimals: number = 9,
  quoteDecimals: number = 6,
  maxLevels: number = 50
): Promise<SolanaDepthData | null> {
  try {
    const connection = getConnection();
    const poolState = await getRaydiumClmmPoolState(connection, poolAddress);

    if (!poolState) {
      console.log('[Raydium CLMM] Pool state not found');
      return null;
    }

    const currentTick = poolState.tickCurrent;
    const tickSpacing = poolState.tickSpacing;
    const liquidity = poolState.liquidity;

    console.log(`[Raydium CLMM] Current tick: ${currentTick}, spacing: ${tickSpacing}, liquidity: ${liquidity}`);

    // Generate synthetic order book from current liquidity
    // For CLMM, we'd ideally scan tick arrays, but for now use simplified approach
    const bids: LiquidityLevel[] = [];
    const asks: LiquidityLevel[] = [];

    const L = Number(liquidity);
    if (L === 0) {
      return {
        bids: [],
        asks: [],
        currentPrice: priceUsd,
        token0Symbol: baseSymbol,
        token1Symbol: quoteSymbol,
        token0Decimals: baseDecimals,
        token1Decimals: quoteDecimals,
        poolType: 'raydium-clmm',
      };
    }

    // Generate levels based on tick spacing
    for (let i = 1; i <= maxLevels; i++) {
      const tickOffset = i * tickSpacing;

      // Ask (price up)
      const askTick = currentTick + tickOffset;
      const askPrice = priceUsd * Math.pow(1.0001, tickOffset);
      const sqrtPriceCurrent = Math.pow(1.0001, currentTick / 2);
      const sqrtPriceAsk = Math.pow(1.0001, askTick / 2);
      const token0Amount = L * (sqrtPriceAsk - sqrtPriceCurrent) / Math.pow(10, baseDecimals);

      if (token0Amount > 0 && isFinite(token0Amount)) {
        asks.push({
          price: askPrice,
          token0Amount,
          token1Amount: 0,
          liquidityUSD: token0Amount * priceUsd,
        });
      }

      // Bid (price down)
      const bidTick = currentTick - tickOffset;
      const bidPrice = priceUsd * Math.pow(1.0001, -tickOffset);
      const sqrtPriceBid = Math.pow(1.0001, bidTick / 2);
      const token1Amount = L * (1 / sqrtPriceBid - 1 / sqrtPriceCurrent) / Math.pow(10, quoteDecimals);

      if (token1Amount > 0 && isFinite(token1Amount)) {
        bids.push({
          price: bidPrice,
          token0Amount: 0,
          token1Amount,
          liquidityUSD: token1Amount * (priceUsd / sqrtPriceX64ToPrice(poolState.sqrtPriceX64, baseDecimals, quoteDecimals)),
        });
      }
    }

    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);

    return {
      bids,
      asks,
      currentPrice: priceUsd,
      token0Symbol: baseSymbol,
      token1Symbol: quoteSymbol,
      token0Decimals: baseDecimals,
      token1Decimals: quoteDecimals,
      poolType: 'raydium-clmm',
    };
  } catch (error) {
    console.error('[Raydium CLMM] Error fetching depth:', error);
    return null;
  }
}

// ============ Orca Whirlpool ============

async function getWhirlpoolState(
  connection: Connection,
  poolAddress: string
): Promise<WhirlpoolState | null> {
  try {
    const accountInfo = await connection.getAccountInfo(new PublicKey(poolAddress));
    if (!accountInfo || !accountInfo.data) return null;

    const data = accountInfo.data;

    // Orca Whirlpool layout
    // Skip discriminator (8 bytes)
    const tokenMintA = new PublicKey(data.slice(101, 133));
    const tokenMintB = new PublicKey(data.slice(181, 213));
    const tickSpacing = data.readUInt16LE(41);
    const liquidity = data.readBigUInt64LE(49) + (data.readBigUInt64LE(57) << 64n);
    const sqrtPrice = data.readBigUInt64LE(65) + (data.readBigUInt64LE(73) << 64n);
    const tickCurrentIndex = data.readInt32LE(81);

    return {
      tokenMintA,
      tokenMintB,
      tickSpacing,
      liquidity,
      sqrtPrice,
      tickCurrentIndex,
    };
  } catch (error) {
    console.error('[Orca Whirlpool] Failed to get pool state:', error);
    return null;
  }
}

export async function getOrcaWhirlpoolDepth(
  poolAddress: string,
  priceUsd: number,
  baseSymbol: string,
  quoteSymbol: string,
  baseDecimals: number = 9,
  quoteDecimals: number = 6,
  maxLevels: number = 50
): Promise<SolanaDepthData | null> {
  try {
    const connection = getConnection();
    const poolState = await getWhirlpoolState(connection, poolAddress);

    if (!poolState) {
      console.log('[Orca Whirlpool] Pool state not found');
      return null;
    }

    const currentTick = poolState.tickCurrentIndex;
    const tickSpacing = poolState.tickSpacing;
    const liquidity = poolState.liquidity;

    console.log(`[Orca Whirlpool] Current tick: ${currentTick}, spacing: ${tickSpacing}, liquidity: ${liquidity}`);

    // Similar to Raydium CLMM - generate synthetic order book
    const bids: LiquidityLevel[] = [];
    const asks: LiquidityLevel[] = [];

    const L = Number(liquidity);
    if (L === 0) {
      return {
        bids: [],
        asks: [],
        currentPrice: priceUsd,
        token0Symbol: baseSymbol,
        token1Symbol: quoteSymbol,
        token0Decimals: baseDecimals,
        token1Decimals: quoteDecimals,
        poolType: 'orca',
      };
    }

    // Generate levels
    for (let i = 1; i <= maxLevels; i++) {
      const tickOffset = i * tickSpacing;

      // Ask
      const askTick = currentTick + tickOffset;
      const askPrice = priceUsd * Math.pow(1.0001, tickOffset);
      const sqrtPriceCurrent = Math.pow(1.0001, currentTick / 2);
      const sqrtPriceAsk = Math.pow(1.0001, askTick / 2);
      const token0Amount = L * (sqrtPriceAsk - sqrtPriceCurrent) / Math.pow(10, baseDecimals);

      if (token0Amount > 0 && isFinite(token0Amount)) {
        asks.push({
          price: askPrice,
          token0Amount,
          token1Amount: 0,
          liquidityUSD: token0Amount * priceUsd,
        });
      }

      // Bid
      const bidTick = currentTick - tickOffset;
      const bidPrice = priceUsd * Math.pow(1.0001, -tickOffset);
      const sqrtPriceBid = Math.pow(1.0001, bidTick / 2);
      const token1Amount = L * (1 / sqrtPriceBid - 1 / sqrtPriceCurrent) / Math.pow(10, quoteDecimals);

      if (token1Amount > 0 && isFinite(token1Amount)) {
        bids.push({
          price: bidPrice,
          token0Amount: 0,
          token1Amount,
          liquidityUSD: token1Amount,
        });
      }
    }

    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);

    return {
      bids,
      asks,
      currentPrice: priceUsd,
      token0Symbol: baseSymbol,
      token1Symbol: quoteSymbol,
      token0Decimals: baseDecimals,
      token1Decimals: quoteDecimals,
      poolType: 'orca',
    };
  } catch (error) {
    console.error('[Orca Whirlpool] Error fetching depth:', error);
    return null;
  }
}

// ============ Meteora DLMM ============

// Meteora API response type
interface MeteoraApiResponse {
  bin_step: number;
  current_price: number;
  liquidity: string;
  reserve_x_amount: number;
  reserve_y_amount: number;
  name: string;
  active_bin_id: number;
}

// Cache for Meteora bins data
interface MeteoraBinsCache {
  bins: Array<{
    binId: number;
    price: number;
    xAmount: number;
    yAmount: number;
    liquidityUSD: number;
  }>;
  activeBinId: number;
  timestamp: number;
}

const meteoraBinsCache = new Map<string, MeteoraBinsCache>();
const METEORA_BINS_CACHE_TTL = 15000; // 15 seconds

// Cache for Meteora API responses (longer TTL since it's external API)
const meteoraApiCache = new Map<string, { data: MeteoraApiResponse; timestamp: number }>();
const METEORA_API_CACHE_TTL = 30000; // 30 seconds

async function getMeteoraDlmmFromApi(poolAddress: string): Promise<MeteoraApiResponse | null> {
  // Check cache first
  const cached = meteoraApiCache.get(poolAddress);
  if (cached && Date.now() - cached.timestamp < METEORA_API_CACHE_TTL) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(
      `https://dlmm-api.meteora.ag/pair/${poolAddress}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[Meteora API] HTTP ${response.status} for ${poolAddress}`);
      return null;
    }

    const data = await response.json() as MeteoraApiResponse;

    // Cache the response
    meteoraApiCache.set(poolAddress, { data, timestamp: Date.now() });

    console.log(`[Meteora API] Pool ${poolAddress.slice(0, 10)}...: bin_step=${data.bin_step}, price=${data.current_price}`);

    return data;
  } catch (error) {
    console.error('[Meteora API] Failed to fetch:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Get real bin data from Meteora DLMM using official SDK
 */
async function getMeteoraBinsData(
  poolAddress: string,
  priceUsd: number,
  _baseDecimals: number, // May be incorrect from DexScreener, we'll get real decimals from SDK
  _quoteDecimals: number
): Promise<MeteoraBinsCache | null> {
  // Check cache first
  const cached = meteoraBinsCache.get(poolAddress);
  if (cached && Date.now() - cached.timestamp < METEORA_BINS_CACHE_TTL) {
    return cached;
  }

  try {
    const connection = getConnection();
    const dlmmPool = await DLMM.create(connection, new PublicKey(poolAddress));

    // Fetch real decimals from token mint accounts - NEVER use fixed values
    const tokenXMint = dlmmPool.lbPair?.tokenXMint;
    const tokenYMint = dlmmPool.lbPair?.tokenYMint;

    if (!tokenXMint || !tokenYMint) {
      console.log('[Meteora SDK] Token mint addresses not found in pool');
      return null;
    }

    // Fetch both mint infos in parallel for efficiency
    const [tokenXMintInfo, tokenYMintInfo] = await Promise.all([
      connection.getParsedAccountInfo(tokenXMint),
      connection.getParsedAccountInfo(tokenYMint),
    ]);

    // Extract decimals - must get real values, no defaults
    let tokenXDecimals: number | null = null;
    let tokenYDecimals: number | null = null;

    if (tokenXMintInfo.value?.data && 'parsed' in tokenXMintInfo.value.data) {
      tokenXDecimals = tokenXMintInfo.value.data.parsed.info.decimals;
      console.log(`[Meteora SDK] Token X (${tokenXMint.toBase58().slice(0, 8)}...) decimals: ${tokenXDecimals}`);
    }
    if (tokenYMintInfo.value?.data && 'parsed' in tokenYMintInfo.value.data) {
      tokenYDecimals = tokenYMintInfo.value.data.parsed.info.decimals;
      console.log(`[Meteora SDK] Token Y (${tokenYMint.toBase58().slice(0, 8)}...) decimals: ${tokenYDecimals}`);
    }

    if (tokenXDecimals === null || tokenYDecimals === null) {
      console.log('[Meteora SDK] Failed to fetch token decimals from chain');
      return null;
    }

    console.log(`[Meteora SDK] Using decimals: X=${tokenXDecimals}, Y=${tokenYDecimals}`);

    // Get active bin
    const activeBin = await dlmmPool.getActiveBin();
    const activeBinId = activeBin.binId;

    // Get bins around active bin (500 bins on each side for very wide coverage)
    // TRUMP pool has liquidity spread across $2.5 to $11+ range
    const binsResult = await dlmmPool.getBinsAroundActiveBin(500, 500);

    if (!binsResult || !binsResult.bins || binsResult.bins.length === 0) {
      console.log('[Meteora SDK] No bins data returned');
      return null;
    }

    // Process bins data using REAL decimals from chain
    const bins = binsResult.bins.map((bin: { binId: number; xAmount: bigint | string; yAmount: bigint | string; pricePerToken: string }) => {
      const xAmount = Number(bin.xAmount) / Math.pow(10, tokenXDecimals);
      const yAmount = Number(bin.yAmount) / Math.pow(10, tokenYDecimals);
      const price = parseFloat(bin.pricePerToken);
      const liquidityUSD = xAmount * priceUsd + yAmount;

      return {
        binId: bin.binId,
        price,
        xAmount,
        yAmount,
        liquidityUSD,
      };
    }).filter((bin: { liquidityUSD: number }) => bin.liquidityUSD > 0); // Only keep bins with liquidity

    // Calculate totals to verify against Meteora official data
    const totalXAmount = bins.reduce((sum: number, bin: { xAmount: number }) => sum + bin.xAmount, 0);
    const totalYAmount = bins.reduce((sum: number, bin: { yAmount: number }) => sum + bin.yAmount, 0);
    console.log(`[Meteora SDK] Got ${bins.length} bins with liquidity, activeBinId=${activeBinId}`);
    console.log(`[Meteora SDK] Total X (base token): ${totalXAmount.toLocaleString()} | Total Y (quote token): ${totalYAmount.toLocaleString()}`);

    const result: MeteoraBinsCache = {
      bins,
      activeBinId,
      timestamp: Date.now(),
    };

    // Cache the result
    meteoraBinsCache.set(poolAddress, result);

    return result;
  } catch (error) {
    console.error('[Meteora SDK] Failed to get bins:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

export async function getMeteoraDlmmDepth(
  poolAddress: string,
  priceUsd: number,
  baseSymbol: string,
  quoteSymbol: string,
  baseDecimals: number = 9,
  quoteDecimals: number = 6,
  _maxLevels: number = 150,
  _liquidityUsd: number = 0
): Promise<SolanaDepthData | null> {
  try {
    // Get real bin data from Meteora SDK - NO SIMULATION
    const binsData = await getMeteoraBinsData(poolAddress, priceUsd, baseDecimals, quoteDecimals);

    if (!binsData || binsData.bins.length === 0) {
      console.error('[Meteora DLMM] Failed to get real bin data from SDK');
      return null;
    }

    // Use real bin data from SDK
    const bids: LiquidityLevel[] = [];
    const asks: LiquidityLevel[] = [];

    // Get current price from API for comparison
    const apiData = await getMeteoraDlmmFromApi(poolAddress);
    const currentPrice = apiData?.current_price || priceUsd;

    // Sort bins by price
    const sortedBins = [...binsData.bins].sort((a, b) => a.price - b.price);

    // Find active bin index (closest to current price)
    let activeBinIndex = sortedBins.findIndex(bin => bin.binId === binsData.activeBinId);
    if (activeBinIndex === -1) {
      // Fallback: find bin closest to current price
      activeBinIndex = sortedBins.findIndex(bin => bin.price >= currentPrice);
      if (activeBinIndex === -1) activeBinIndex = sortedBins.length - 1;
    }

    // Split into bids (below current price) and asks (above current price)
    for (let i = 0; i < sortedBins.length; i++) {
      const bin = sortedBins[i];

      if (i < activeBinIndex) {
        // Bids: bins below current price (have Y token / USDC)
        // token0Amount = how much base token you can buy with this USDC at this price
        const baseTokenBuyable = bin.price > 0 ? bin.yAmount / bin.price : 0;
        bids.push({
          price: bin.price,
          token0Amount: baseTokenBuyable, // TRUMP you can buy
          token1Amount: bin.yAmount,       // USDC available
          liquidityUSD: bin.yAmount,       // USDC is already USD
        });
      } else if (i > activeBinIndex) {
        // Asks: bins above current price (have X token / base)
        asks.push({
          price: bin.price,
          token0Amount: bin.xAmount,           // TRUMP for sale
          token1Amount: bin.xAmount * bin.price, // USDC value
          liquidityUSD: bin.xAmount * bin.price, // Value in USD
        });
      }
      // Skip active bin (it contains both tokens)
    }

    // Sort: bids descending (highest first), asks ascending (lowest first)
    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);

    console.log(`[Meteora DLMM] Real data: ${bids.length} bids, ${asks.length} asks from ${binsData.bins.length} bins`);

    return {
      bids,
      asks,
      currentPrice,
      token0Symbol: baseSymbol,
      token1Symbol: quoteSymbol,
      token0Decimals: baseDecimals,
      token1Decimals: quoteDecimals,
      poolType: 'meteora',
    };
  } catch (error) {
    console.error('[Meteora DLMM] Error fetching real bin data:', error);
    return null;
  }
}

// ============ Unified Entry Point ============

export async function getSolanaLiquidityDepth(
  poolAddress: string,
  priceUsd: number,
  baseSymbol: string,
  quoteSymbol: string,
  baseDecimals: number,
  quoteDecimals: number,
  dexId?: string,
  maxLevels: number = 50,
  baseTokenAddress?: string,
  liquidityUsd: number = 0 // DexScreener reported liquidity
): Promise<SolanaDepthData | null> {
  const dexType = detectSolanaDexType(dexId);

  console.log(`[Solana Liquidity] Pool: ${poolAddress.slice(0, 10)}..., DEX: ${dexType}, decimals: ${baseDecimals}/${quoteDecimals}, liquidity: $${liquidityUsd}`);

  switch (dexType) {
    case 'pumpswap':
      return getPumpSwapDepth(poolAddress, priceUsd, baseSymbol, quoteSymbol, baseDecimals, quoteDecimals, maxLevels);

    case 'raydium-amm':
      return getRaydiumAmmDepth(poolAddress, priceUsd, baseSymbol, quoteSymbol, baseDecimals, quoteDecimals, maxLevels, baseTokenAddress);

    case 'raydium-clmm':
      return getRaydiumClmmDepth(poolAddress, priceUsd, baseSymbol, quoteSymbol, baseDecimals, quoteDecimals, maxLevels);

    case 'orca':
      return getOrcaWhirlpoolDepth(poolAddress, priceUsd, baseSymbol, quoteSymbol, baseDecimals, quoteDecimals, maxLevels);

    case 'meteora':
      return getMeteoraDlmmDepth(poolAddress, priceUsd, baseSymbol, quoteSymbol, baseDecimals, quoteDecimals, maxLevels, liquidityUsd);

    default:
      // Try PumpSwap as default for unknown Solana pools
      console.log(`[Solana Liquidity] Unknown DEX type: ${dexId}, trying PumpSwap`);
      return getPumpSwapDepth(poolAddress, priceUsd, baseSymbol, quoteSymbol, baseDecimals, quoteDecimals, maxLevels);
  }
}

// ============ Fallback: Generate from DexScreener data ============

export function generateFallbackDepth(
  priceUsd: number,
  liquidityUsd: number,
  baseSymbol: string,
  quoteSymbol: string,
  baseDecimals: number = 9,
  quoteDecimals: number = 6,
  maxLevels: number = 50,
  dexType: SolanaDexType = 'pumpswap'
): SolanaDepthData {
  // For fallback, use DexScreener's reported liquidity directly
  // Distribute across price levels with exponential decay (more near current price)
  const bids: LiquidityLevel[] = [];
  const asks: LiquidityLevel[] = [];

  // Use reasonable bin step for price distribution
  const binStepBps = 0.01; // 1% steps

  // Calculate total weight for normalization
  const totalWeight = Array.from({ length: maxLevels }, (_, i) => Math.exp(-i / 15)).reduce((a, b) => a + b, 0);

  for (let i = 1; i <= maxLevels; i++) {
    // Weight decreases exponentially with distance from current price
    const weight = Math.exp(-(i - 1) / 15) / totalWeight;
    const levelLiquidity = liquidityUsd * weight;

    // Ask (price up) - selling base token
    const askPrice = priceUsd * Math.pow(1 + binStepBps, i);
    const askBaseAmount = levelLiquidity / askPrice;
    asks.push({
      price: askPrice,
      token0Amount: askBaseAmount,
      token1Amount: askBaseAmount * askPrice,
      liquidityUSD: levelLiquidity,
    });

    // Bid (price down) - buying base token
    const bidPrice = priceUsd * Math.pow(1 + binStepBps, -i);
    const bidBaseAmount = levelLiquidity / bidPrice;
    bids.push({
      price: bidPrice,
      token0Amount: bidBaseAmount,
      token1Amount: bidBaseAmount * bidPrice,
      liquidityUSD: levelLiquidity,
    });
  }

  bids.sort((a, b) => b.price - a.price);
  asks.sort((a, b) => a.price - b.price);

  return {
    bids,
    asks,
    currentPrice: priceUsd,
    token0Symbol: baseSymbol,
    token1Symbol: quoteSymbol,
    token0Decimals: baseDecimals,
    token1Decimals: quoteDecimals,
    poolType: dexType === 'unknown' ? 'pumpswap' : dexType,
  };
}
