/**
 * Real-time Pool Events Service
 *
 * Subscribes to on-chain events (Swap, Mint, Burn) for pools
 * to trigger real-time Order Book updates.
 *
 * Supports: V2, V3, V4 (EVM) and Solana
 */

import { createPublicClient, http, parseAbiItem, type Log, type Chain } from 'viem';
import { base, mainnet, bsc } from 'viem/chains';

// Event types that affect liquidity
export type PoolEventType = 'swap' | 'mint' | 'burn' | 'sync';

export interface PoolEvent {
  type: PoolEventType;
  poolAddress: string;
  chainId: string;
  timestamp: number;
  txHash?: string;
}

type PoolEventCallback = (event: PoolEvent) => void;

// Chain configurations
const CHAINS: Record<string, Chain> = {
  base,
  ethereum: mainnet,
  bsc,
};

// RPC URLs with WebSocket support
const WS_RPC_URLS: Record<string, string> = {
  base: process.env.NEXT_PUBLIC_BASE_WS_RPC || 'wss://base-mainnet.g.alchemy.com/v2/demo',
  ethereum: process.env.NEXT_PUBLIC_ETH_WS_RPC || 'wss://eth-mainnet.g.alchemy.com/v2/demo',
  bsc: process.env.NEXT_PUBLIC_BSC_WS_RPC || 'wss://bsc-mainnet.nodereal.io/ws/v1/demo',
};

// Fallback HTTP RPC URLs
const HTTP_RPC_URLS: Record<string, string> = {
  base: process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org',
  ethereum: process.env.NEXT_PUBLIC_ETH_RPC || 'https://eth.llamarpc.com',
  bsc: process.env.NEXT_PUBLIC_BSC_RPC || 'https://bsc-dataseed.binance.org',
};

// V2 Pool Events
const V2_SWAP_EVENT = parseAbiItem('event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)');
const V2_SYNC_EVENT = parseAbiItem('event Sync(uint112 reserve0, uint112 reserve1)');
const V2_MINT_EVENT = parseAbiItem('event Mint(address indexed sender, uint amount0, uint amount1)');
const V2_BURN_EVENT = parseAbiItem('event Burn(address indexed sender, uint amount0, uint amount1, address indexed to)');

// V3 Pool Events
const V3_SWAP_EVENT = parseAbiItem('event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)');
const V3_MINT_EVENT = parseAbiItem('event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)');
const V3_BURN_EVENT = parseAbiItem('event Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)');

// V4 uses PoolManager events (different structure)
// V4 events are emitted from the PoolManager contract, not individual pool contracts
const V4_SWAP_EVENT = parseAbiItem('event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)');
const V4_MODIFY_LIQUIDITY_EVENT = parseAbiItem('event ModifyLiquidity(bytes32 indexed id, address indexed sender, int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt)');

// V4 PoolManager addresses
const V4_POOL_MANAGER: Record<string, string> = {
  base: '0x498581fF718922c3f8e6A244956aF099B2652b2b',
  ethereum: '0x000000000004444c5dc75cB358380D2e3dE08A90',
};

interface Subscription {
  chainId: string;
  poolAddress: string;
  poolType: 'v2' | 'v3' | 'v4';
  callbacks: Set<PoolEventCallback>;
  unwatch?: () => void;
}

class PoolEventsService {
  private subscriptions = new Map<string, Subscription>();
  private clients = new Map<string, ReturnType<typeof createPublicClient>>();
  private wsClients = new Map<string, ReturnType<typeof createPublicClient>>();
  private reconnectTimers = new Map<string, NodeJS.Timeout>();
  private isClient = typeof window !== 'undefined';

  private getSubscriptionKey(chainId: string, poolAddress: string): string {
    return `${chainId}:${poolAddress.toLowerCase()}`;
  }

  private getClient(chainId: string, useWebSocket = false): ReturnType<typeof createPublicClient> | null {
    const chain = CHAINS[chainId];
    if (!chain) return null;

    const cacheKey = `${chainId}:${useWebSocket ? 'ws' : 'http'}`;
    const cache = useWebSocket ? this.wsClients : this.clients;

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    try {
      const rpcUrl = useWebSocket ? WS_RPC_URLS[chainId] : HTTP_RPC_URLS[chainId];
      if (!rpcUrl) return null;

      const client = createPublicClient({
        chain,
        transport: http(rpcUrl),
      });

      cache.set(cacheKey, client);
      return client;
    } catch (error) {
      console.error(`[PoolEvents] Failed to create client for ${chainId}:`, error);
      return null;
    }
  }

  /**
   * Subscribe to pool events
   */
  subscribe(
    chainId: string,
    poolAddress: string,
    poolType: 'v2' | 'v3' | 'v4',
    callback: PoolEventCallback
  ): () => void {
    // Skip on server side
    if (!this.isClient) {
      return () => {};
    }

    const key = this.getSubscriptionKey(chainId, poolAddress);

    // Check if subscription already exists
    let subscription = this.subscriptions.get(key);

    if (subscription) {
      // Add callback to existing subscription
      subscription.callbacks.add(callback);
      console.log(`[PoolEvents] Added callback to existing subscription: ${key}`);
    } else {
      // Create new subscription
      subscription = {
        chainId,
        poolAddress,
        poolType,
        callbacks: new Set([callback]),
      };
      this.subscriptions.set(key, subscription);

      // Start watching events
      this.startWatching(subscription);
    }

    // Return unsubscribe function
    return () => {
      const sub = this.subscriptions.get(key);
      if (sub) {
        sub.callbacks.delete(callback);
        if (sub.callbacks.size === 0) {
          // No more callbacks, stop watching
          if (sub.unwatch) {
            sub.unwatch();
          }
          this.subscriptions.delete(key);
          console.log(`[PoolEvents] Removed subscription: ${key}`);
        }
      }
    };
  }

  private async startWatching(subscription: Subscription) {
    const { chainId, poolAddress, poolType } = subscription;
    const key = this.getSubscriptionKey(chainId, poolAddress);

    // For Solana, use polling (no native WebSocket event subscription)
    if (chainId === 'solana') {
      this.startSolanaPolling(subscription);
      return;
    }

    const client = this.getClient(chainId, true) || this.getClient(chainId, false);
    if (!client) {
      console.error(`[PoolEvents] No client available for ${chainId}`);
      return;
    }

    try {
      let unwatch: (() => void) | undefined;

      if (poolType === 'v2') {
        // Watch V2 events
        unwatch = client.watchContractEvent({
          address: poolAddress as `0x${string}`,
          abi: [V2_SWAP_EVENT, V2_SYNC_EVENT, V2_MINT_EVENT, V2_BURN_EVENT],
          onLogs: (logs) => this.handleLogs(logs, subscription, 'v2'),
          onError: (error) => this.handleError(error, subscription),
        });
      } else if (poolType === 'v3') {
        // Watch V3 events
        unwatch = client.watchContractEvent({
          address: poolAddress as `0x${string}`,
          abi: [V3_SWAP_EVENT, V3_MINT_EVENT, V3_BURN_EVENT],
          onLogs: (logs) => this.handleLogs(logs, subscription, 'v3'),
          onError: (error) => this.handleError(error, subscription),
        });
      } else if (poolType === 'v4') {
        // Watch V4 PoolManager events (filter by poolId)
        const poolManager = V4_POOL_MANAGER[chainId];
        if (!poolManager) {
          console.error(`[PoolEvents] No V4 PoolManager for ${chainId}`);
          return;
        }

        unwatch = client.watchContractEvent({
          address: poolManager as `0x${string}`,
          abi: [V4_SWAP_EVENT, V4_MODIFY_LIQUIDITY_EVENT],
          args: {
            id: poolAddress as `0x${string}`, // Filter by poolId
          },
          onLogs: (logs) => this.handleLogs(logs, subscription, 'v4'),
          onError: (error) => this.handleError(error, subscription),
        });
      }

      subscription.unwatch = unwatch;
      console.log(`[PoolEvents] Started watching ${poolType} pool: ${key}`);
    } catch (error) {
      console.error(`[PoolEvents] Failed to start watching ${key}:`, error);
      // Fallback to polling
      this.startPolling(subscription);
    }
  }

  private handleLogs(logs: Log[], subscription: Subscription, poolType: string) {
    for (const log of logs) {
      const eventName = (log as unknown as { eventName?: string }).eventName?.toLowerCase() || '';
      let eventType: PoolEventType = 'swap';

      if (eventName.includes('swap')) {
        eventType = 'swap';
      } else if (eventName.includes('mint') || eventName.includes('modifyliquidity')) {
        eventType = 'mint';
      } else if (eventName.includes('burn')) {
        eventType = 'burn';
      } else if (eventName.includes('sync')) {
        eventType = 'sync';
      }

      const event: PoolEvent = {
        type: eventType,
        poolAddress: subscription.poolAddress,
        chainId: subscription.chainId,
        timestamp: Date.now(),
        txHash: log.transactionHash || undefined,
      };

      console.log(`[PoolEvents] ${poolType} ${eventType} event on ${subscription.poolAddress.slice(0, 10)}...`);

      // Notify all callbacks
      subscription.callbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('[PoolEvents] Callback error:', error);
        }
      });
    }
  }

  private handleError(error: Error, subscription: Subscription) {
    const key = this.getSubscriptionKey(subscription.chainId, subscription.poolAddress);
    console.error(`[PoolEvents] Error for ${key}:`, error);

    // Clear existing timer
    const existingTimer = this.reconnectTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Attempt reconnect after 5 seconds
    const timer = setTimeout(() => {
      console.log(`[PoolEvents] Attempting reconnect for ${key}`);
      this.startWatching(subscription);
    }, 5000);

    this.reconnectTimers.set(key, timer);
  }

  /**
   * Fallback polling for when WebSocket is not available
   */
  private startPolling(subscription: Subscription) {
    const key = this.getSubscriptionKey(subscription.chainId, subscription.poolAddress);
    console.log(`[PoolEvents] Starting polling fallback for ${key}`);

    // Poll every 2 seconds
    const pollInterval = setInterval(async () => {
      if (!this.subscriptions.has(key)) {
        clearInterval(pollInterval);
        return;
      }

      // Emit a synthetic event to trigger refresh
      const event: PoolEvent = {
        type: 'sync',
        poolAddress: subscription.poolAddress,
        chainId: subscription.chainId,
        timestamp: Date.now(),
      };

      subscription.callbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('[PoolEvents] Polling callback error:', error);
        }
      });
    }, 2000);

    // Store cleanup function
    subscription.unwatch = () => clearInterval(pollInterval);
  }

  /**
   * Solana-specific polling (Solana doesn't have native event subscription like EVM)
   */
  private startSolanaPolling(subscription: Subscription) {
    const key = this.getSubscriptionKey(subscription.chainId, subscription.poolAddress);
    console.log(`[PoolEvents] Starting Solana polling for ${key}`);

    // Poll every 2 seconds for Solana
    const pollInterval = setInterval(() => {
      if (!this.subscriptions.has(key)) {
        clearInterval(pollInterval);
        return;
      }

      const event: PoolEvent = {
        type: 'sync',
        poolAddress: subscription.poolAddress,
        chainId: subscription.chainId,
        timestamp: Date.now(),
      };

      subscription.callbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('[PoolEvents] Solana polling callback error:', error);
        }
      });
    }, 2000);

    subscription.unwatch = () => clearInterval(pollInterval);
  }

  /**
   * Cleanup all subscriptions
   */
  cleanup() {
    this.subscriptions.forEach((subscription, key) => {
      if (subscription.unwatch) {
        subscription.unwatch();
      }
    });
    this.subscriptions.clear();

    this.reconnectTimers.forEach(timer => clearTimeout(timer));
    this.reconnectTimers.clear();

    console.log('[PoolEvents] Cleaned up all subscriptions');
  }
}

// Singleton instance
let poolEventsService: PoolEventsService | null = null;

export function getPoolEventsService(): PoolEventsService {
  if (!poolEventsService) {
    poolEventsService = new PoolEventsService();
  }
  return poolEventsService;
}

/**
 * Detect pool type from address
 */
export function detectPoolType(poolAddress: string): 'v2' | 'v3' | 'v4' {
  // V4 pools have 66-character hex ID (0x + 64 chars)
  if (poolAddress.length === 66) {
    return 'v4';
  }
  // For V2/V3, we'd need to check on-chain, but default to V3 for now
  // The actual detection happens in the API
  return 'v3';
}
