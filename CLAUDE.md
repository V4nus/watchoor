# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Watchoor is a DEX liquidity depth analyzer built with Next.js 16. It analyzes AMM (Automated Market Maker) liquidity pools to show real liquidity depth at various price levels - revealing how much actual trading capacity exists beyond surface-level metrics like market cap.

**Key Features**:
- Unified V2/V3/V4 liquidity depth analysis with auto-detection
- Tick-level liquidity scanning with clustering algorithm
- Dual DEX aggregator (CoW Protocol + Uniswap)
- Real-time WebSocket data streaming with polling fallback
- 3D liquidity visualization with Three.js
- Multi-language support (EN, KO, JA, ES, PT, RU)
- Large trade monitoring and trending pool rankings

## Commands

```bash
# Development
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Build for production (runs prisma generate first)
npm start            # Start production server
npm run lint         # Run ESLint

# Database
npx prisma generate  # Generate Prisma client (auto-runs on postinstall)
npx prisma db push   # Push schema changes to database
npx prisma studio    # Open Prisma Studio GUI

# Data Sync
npm run sync         # Sync LP positions from Dune Analytics (one-time)
npm run sync:watch   # Continuous sync with 2-hour interval
```

## Architecture

### Data Flow

1. **External APIs** (DexScreener, GeckoTerminal, Dune Analytics) → API routes fetch and cache data
2. **PostgreSQL** stores LP positions, OHLCV candles, liquidity snapshots
3. **React components** display real-time charts with polling/WebSocket fallback

### Key Directories

- `src/app/` - Next.js App Router pages and API routes
  - `page.tsx` - Homepage with search, features showcase, and 3D ocean background
  - `layout.tsx` - Global layout with i18n and Wagmi providers
  - `pool/[chainId]/[poolAddress]/` - Pool detail page (SSR + client components)
  - `token/[chain]/[address]/` - Token detail page
- `src/app/api/` - Backend API endpoints (17 routes)
  - **Core APIs**: `liquidity-depth`, `tick-liquidity`, `pool`, `ohlcv`, `trades`
  - **Advanced**: `large-trades`, `trending`, `uniswap-quote`, `tx-amounts`
  - **LP Data**: `lp-positions`, `lp-positions/stream`, `lp-positions/sync`
  - **Utilities**: `quote-price`, `token-icon`, `sync`
- `src/components/` - React components (20 components, ~7,000 lines)
  - **Trading**: `TradePanel` (1,518 lines), `Chart` (795 lines), `LiquidityDepth` (1,131 lines)
  - **3D Viz**: `OceanBackground` (Web Worker textures), `LiquidityVisualization3D`, `ParticleField`
  - **Data Display**: `TradeHistory`, `PoolStats`, `LiquidityInfo`, `RealtimePrice`
  - **Search/Nav**: `SearchBox`, `LiquidityShowcase`, `TokenLogo` (memoized)
  - **Wallet**: `WalletButton`, `WalletProvider`, `ConnectionStatus`
  - **Loading**: `Skeleton` (chart, order book, trade panel, history skeletons)
- `src/lib/` - Core business logic (21 modules, ~7,600 lines)
  - **Blockchain**: `liquidity.ts` (1,407 lines), `tick-liquidity.ts` (476 lines), `cow.ts` (445 lines), `uniswap.ts`
  - **Data Services**: `api.ts`, `ohlcv-service.ts`, `dune.ts` (648 lines), `realtime.ts`
  - **Database**: `db.ts`, `db-sync.ts`, `lp-database.ts`, `lp-positions.ts`
  - **i18n**: `i18n/translations.ts` (976 lines), `i18n/context.tsx`
  - **Charts**: `chart-primitives/` - Custom TradingView primitives
  - **Utilities**: `cache-utils.ts`, `validators.ts`, `errors.ts`, `texture-worker.ts`
- `src/hooks/` - React hooks (3 hooks)
  - `useWebSocket.ts` (216 lines) - Auto-reconnect WebSocket
  - `useRealtimePrice.ts` - Real-time price with polling fallback
  - `useRealtimeOHLCV.ts` - Real-time OHLCV data
- `src/types/` - TypeScript definitions (Chain, PoolInfo, TokenInfo, OHLCVData, etc.)
- `prisma/` - Database schema (9 models, 154 lines)
- `scripts/` - Maintenance scripts
  - `sync-lp-positions.ts` (361 lines) - Dune Analytics sync
  - `download-icons.js` - Token icon caching

### Uniswap V2/V3/V4 Integration

#### Unified Liquidity Depth API (`src/app/api/liquidity-depth/route.ts`, 944 lines)
- **Auto-detection**: Detects pool type (V2/V3/V4) by address format and contract checks
- **V2 pools**: Queries reserves via `getReserves()` and computes constant product curve
- **V3 pools**: Direct RPC calls to pool contracts for slot0, liquidity, tick data
- **V4 pools**: Uses StateView contract to query PoolManager state
- **Optimization**: Multicall3 for batch queries, 5-second cache

#### Tick-Level Liquidity Scanner (`src/lib/tick-liquidity.ts`, 476 lines)
- **Direct on-chain scanning**: Reads TickBitmap to find initialized ticks
- **Clustering algorithm**: Groups nearby liquidity into clusters
- **Use case**: Identifies whale positions and large order walls
- **Performance**: Bitmap-optimized queries reduce RPC calls by 95%

#### Core Algorithms
- **Gerstner wave algorithm**: Converts tick ranges to price-based depth levels
- **RPC rotation**: Auto-failover between primary and backup RPCs
- **Liquidity clustering**: Groups ticks within price thresholds

### Database Models (Prisma, 9 models)

**Core Data**:
- `Pool` - Cached pool metadata from DexScreener
- `LPPosition` - Mint/Burn events from LP position changes
- `LiquiditySnapshot` - Point-in-time order book snapshots
- `OHLCVCandle` - Pre-computed candlestick data (1m/5m/15m/1h/4h/1d intervals)
- `V4Trade` - Uniswap V4 swap events

**System Tables**:
- `QuotePrice` - USD price cache for quote tokens (WETH, USDC, etc.)
- `SyncStatus` - Tracks sync job progress and last update times
- `OHLCVSyncStatus` - OHLCV data sync metadata

**Key Indexes**:
- `Pool`: `chainId_poolAddress_unique`, `baseSymbol`
- `LPPosition`: `poolId`, `owner`, `timestamp`, `blockNumber`
- `V4Trade`: `chainId_poolId`, `timestamp`
- `OHLCVCandle`: `chainId_poolAddress_interval_timestamp_unique`

## Environment Variables

Required in `.env`:
```
DATABASE_URL=postgresql://...     # PostgreSQL connection string
DUNE_API_KEY=...                  # Dune Analytics API key (for V4 LP sync)
```

Optional:
```
SYNC_API_KEY=...                  # Protect sync endpoints with API key
ETHEREUM_RPC_URL=...              # Custom RPC (Alchemy/Infura) for Ethereum
BASE_RPC_URL=...                  # Custom RPC for Base chain
```

## Key Patterns

### Caching Strategy
**Multi-layer cache architecture**:
- **In-memory cache**: Fast access, shared across requests
- **localStorage cache**: Client-side persistence
- **Database cache**: Pre-computed OHLCV, LP snapshots

**TTL Configuration**:
- Pool info: 1 minute
- OHLCV data: 30 seconds
- Search results: 30 seconds
- Token info: 1 hour
- Liquidity depth: 5 seconds
- Trending pools: 1 hour

### Real-time Data Streaming
- **WebSocket** (`useWebSocket.ts`, 216 lines):
  - Auto-reconnect with exponential backoff
  - Heartbeat mechanism for connection health
  - Event-based subscription model
- **Polling fallback**:
  - `useRealtimePrice.ts`: 1-second interval
  - `useRealtimeOHLCV.ts`: 10-second interval
- **React Query integration**: Automatic refetch and invalidation

### Pool Type Detection
- **V4 pools**: 32-byte pool IDs (64 hex chars) → `0x{64 chars}`
- **V3 pools**: 20-byte addresses (40 hex chars) → `0x{40 chars}`
- **V2 pools**: Detected via `getReserves()` method check
- **Auto-fallback**: API automatically tries multiple detection methods

## Tech Stack

**Frontend Framework**:
- Next.js 16.1.1 (App Router)
- React 19.2.3 + React DOM 19.2.3
- TypeScript 5

**Styling & UI**:
- TailwindCSS 4 (JIT, Oxide engine)
- Lucide React (icon library)
- PostCSS + Autoprefixer

**3D Graphics**:
- Three.js 0.182.0
- @react-three/fiber 9.5.0
- @react-three/drei 10.7.7

**Charts & Visualization**:
- lightweight-charts 4.2.0 (TradingView style)
- Custom chart primitives (order book bars)

**Blockchain Integration**:
- **Trading**:
  - CoW Protocol SDK (orderbook, quote, signing)
  - Uniswap SDK v3 + Universal Router SDK
- **On-chain Data**: viem 2.44.1 (RPC calls, contract interactions)
- **Wallet**: wagmi 3.3.2 + @tanstack/react-query 5.90.16
- **Utils**: ethers 6.16.0

**Database & ORM**:
- PostgreSQL (primary database)
- Prisma 7.2.0 (ORM + migrations)
- better-sqlite3 12.6.0 (optional local DB)

**External APIs**:
- DexScreener API (pool metadata, search)
- GeckoTerminal API (OHLCV, trades)
- Dune Analytics API (V4 LP positions)

**Build & Dev Tools**:
- ESLint 9 + TypeScript ESLint
- tsx (TypeScript execution)
- PostCSS plugins

## Supported Chains

**Fully Integrated** (4 chains):
- **Base** (primary network) - Full V2/V3/V4 support
- **Ethereum** - V2/V3 support
- **BNB Chain (BSC)** - V2/V3 support
- **Solana** - Partial support (via external APIs)

**Chain Icons**: Available in `public/chains/` (base.svg, ethereum.png, bsc.svg, solana.png)

## New Features & Advanced APIs

### 1. Unified Liquidity Depth API
**Endpoint**: `/api/liquidity-depth`
**File**: [src/app/api/liquidity-depth/route.ts](src/app/api/liquidity-depth/route.ts) (944 lines)

**Features**:
- Auto-detects pool type (V2/V3/V4)
- Returns standardized order book format
- Multicall3 optimization for batch queries
- 5-second cache for performance

**Response Format**:
```typescript
{
  bids: Array<{ price: number, liquidity: number }>,
  asks: Array<{ price: number, liquidity: number }>,
  currentPrice: number,
  poolType: 'v2' | 'v3' | 'v4'
}
```

### 2. Tick-Level Liquidity Scanner
**Endpoint**: `/api/tick-liquidity`
**File**: [src/lib/tick-liquidity.ts](src/lib/tick-liquidity.ts) (476 lines)

**Features**:
- Direct TickBitmap scanning from smart contracts
- Identifies whale positions and large order walls
- Liquidity clustering algorithm
- 95% RPC call reduction via bitmap optimization

**Use Cases**:
- Detect large LP positions
- Find support/resistance levels
- Identify potential price manipulation

### 3. Large Trade Monitoring
**Endpoint**: `/api/large-trades`
**File**: [src/app/api/large-trades/route.ts](src/app/api/large-trades/route.ts)

**Features**:
- Configurable USD threshold (default: $1,000)
- Real-time trade alerts
- Trade size, direction, and impact analysis
- Data from GeckoTerminal API

### 4. Trending Pools Ranking
**Endpoint**: `/api/trending`
**File**: [src/app/api/trending/route.ts](src/app/api/trending/route.ts) (289 lines)

**Features**:
- DexScreener Boosted Tokens integration
- Fallback to search-based discovery
- Sorted by 24h volume
- 1-hour cache

**Response Fields**:
- Pool metadata, price, volume, liquidity
- 24h price change %
- Market cap and FDV

### 5. Dual DEX Aggregator
**Component**: [src/components/TradePanel.tsx](src/components/TradePanel.tsx) (1,518 lines)

**Aggregators**:
- **CoW Protocol**: Best for trades > $10 (MEV protection)
- **Uniswap Universal Router**: Multi-hop routing, all trade sizes

**Smart Routing**:
- Compares quotes from both aggregators
- Auto-selects best price
- Permit2 signature handling
- Slippage protection

### 6. Multi-language Support
**Files**: [src/lib/i18n/](src/lib/i18n/) (1,045 lines total)

**Supported Languages** (6):
- English (en) - Default
- Korean (ko)
- Japanese (ja)
- Spanish (es)
- Portuguese (pt)
- Russian (ru)

**Implementation**:
- React Context API
- localStorage persistence
- Dynamic component rerender
- Translation file: `translations.ts` (976 lines)

### 7. 3D Liquidity Visualization
**Components**:
- [src/components/OceanBackground.tsx](src/components/OceanBackground.tsx) (593 lines)
- [src/components/LiquidityVisualization3D.tsx](src/components/LiquidityVisualization3D.tsx) (281 lines)
- [src/components/ParticleField.tsx](src/components/ParticleField.tsx) (239 lines)

**Features**:
- Three.js ocean wave animation
- Particle system for data points
- Interactive 3D depth visualization
- Performance-optimized rendering

### 8. Uniswap Quote Engine
**Endpoint**: `/api/uniswap-quote`
**File**: [src/app/api/uniswap-quote/route.ts](src/app/api/uniswap-quote/route.ts) (310 lines)

**Features**:
- Multi-hop routing (up to 3 hops)
- Smart path finding
- Gas-optimized routes
- Universal Router V2 integration

## Advanced Algorithms

### Gerstner Wave Algorithm
**File**: [src/lib/liquidity.ts](src/lib/liquidity.ts)

Converts Uniswap V3/V4 tick ranges into smooth price-based liquidity curves:
```
L(p) = Σ Li × W(pi, σi)
where W is Gerstner wave function
```

**Benefits**:
- Smooth depth visualization
- Realistic order book approximation
- Handles concentrated liquidity ranges

### Liquidity Clustering
**File**: [src/lib/tick-liquidity.ts](src/lib/tick-liquidity.ts)

Groups nearby ticks into clusters:
```typescript
interface LiquidityCluster {
  minTick: number;
  maxTick: number;
  totalLiquidity: bigint;
  tickCount: number;
}
```

**Algorithm**:
1. Scan TickBitmap for initialized ticks
2. Batch query tick data (256 ticks per call)
3. Group ticks within price threshold (default: 1%)
4. Return sorted clusters by liquidity

### Multicall3 Optimization
**Usage**: Batch multiple contract calls into single RPC request

**Example** (from liquidity-depth API):
```typescript
const calls = [
  { target: poolAddress, callData: slot0CallData },
  { target: poolAddress, callData: liquidityCallData },
  // ... more calls
];
const results = await multicall3.aggregate(calls);
```

**Performance**: ~90% reduction in RPC calls for complex queries

## WebSocket Real-time Streaming

### WebSocket Hook
**File**: [src/hooks/useWebSocket.ts](src/hooks/useWebSocket.ts) (216 lines)

**Features**:
- Auto-reconnect with exponential backoff (1s → 2s → 4s → 8s → 30s max)
- Heartbeat ping every 30 seconds
- Event subscription system
- Connection state management

**Usage Example**:
```typescript
const { subscribe, isConnected } = useWebSocket();

useEffect(() => {
  const unsubscribe = subscribe('price', (data) => {
    console.log('Price update:', data);
  });
  return unsubscribe;
}, []);
```

### Polling Fallback
When WebSocket unavailable:
- **Price updates**: Every 1 second
- **OHLCV updates**: Every 10 seconds
- Auto-switch to WebSocket when available

## Database Sync Jobs

### LP Position Sync
**Script**: [scripts/sync-lp-positions.ts](scripts/sync-lp-positions.ts) (361 lines)

**Data Source**: Dune Analytics
**Schedule**: Every 2 hours (in watch mode)
**Query**: Fetches Uniswap V4 Mint/Burn events

**Process**:
1. Query Dune API for recent events
2. Transform data to Prisma schema
3. Upsert to `LPPosition` table
4. Update `SyncStatus` with timestamp

**Run Manually**:
```bash
npm run sync         # One-time sync
npm run sync:watch   # Continuous mode
```

### OHLCV Sync
**Endpoint**: `/api/ohlcv/sync`

**Features**:
- Fetches candle data from GeckoTerminal
- Stores in `OHLCVCandle` table
- Supports 6 intervals: 1m, 5m, 15m, 1h, 4h, 1d
- Tracks sync status per pool+interval

## Error Handling & Resilience

### RPC Failover
**Implementation**: [src/lib/liquidity.ts](src/lib/liquidity.ts)

```typescript
const RPC_URLS = [
  process.env.BASE_RPC_URL,
  'https://mainnet.base.org',
  'https://base.publicnode.com'
];
```

Auto-switches to backup RPC on failure.

### API Retry Logic
- Exponential backoff for external APIs
- Max 3 retries per request
- Fallback to cached data when available

### Graceful Degradation
- WebSocket → Polling fallback
- On-chain data → API fallback
- Fresh data → Cached data fallback

## Code Quality Standards

### TypeScript Configuration
**File**: `tsconfig.json`

- Strict mode enabled
- Path aliases: `@/*` → `src/*`
- ES2022 target
- Module: ESNext

### ESLint Rules
**File**: `eslint.config.mjs`

- TypeScript ESLint recommended rules
- React Hooks rules
- Import sorting
- Unused variable detection

### Component Organization
- Server Components by default
- Client Components marked with `'use client'`
- Hooks in separate files
- Type definitions in `src/types/`

## Performance Optimizations

### Build & Runtime
1. **Next.js App Router**: Automatic code splitting
2. **React 19 Compiler**: Optimized re-renders
3. **Image Optimization**: Next.js Image component
4. **Font Loading**: next/font with display swap, minimal weights
5. **API Caching**: Multi-layer cache strategy
6. **Database Indexing**: Optimized queries on hot paths
7. **Multicall Batching**: Reduced RPC calls
8. **Lazy Loading**: Three.js components load on-demand

### Component Optimizations
9. **React.memo**: Applied to frequently re-rendered components
   - `TokenLogo` with custom comparison function
   - Skeleton components for loading states
10. **Web Worker Texture Generation**: OceanBackground generates 3D textures in background thread
    - Normal map (1024x1024) and foam texture (512x512) generated off main thread
    - Falls back to `requestIdleCallback` if Workers unavailable
    - File: [src/lib/texture-worker.ts](src/lib/texture-worker.ts)
11. **Parallel API Requests**: Multiple fetch calls use `Promise.allSettled()`
    - PoolPageClient fetches deployer + holders data in parallel
12. **Skeleton Loading**: Improves perceived performance during component hydration
    - `ChartSkeleton`, `OrderBookSkeleton`, `TradePanelSkeleton`, `TradeHistorySkeleton`
    - File: [src/components/Skeleton.tsx](src/components/Skeleton.tsx)

### Utility Libraries
- **Cache Utils**: Unified cache management with TTL and auto-cleanup
  - File: [src/lib/cache-utils.ts](src/lib/cache-utils.ts)
- **Validators**: Common validation functions for addresses, numbers, chains
  - File: [src/lib/validators.ts](src/lib/validators.ts)
- **Error Handling**: Centralized error classes and logging
  - File: [src/lib/errors.ts](src/lib/errors.ts)
