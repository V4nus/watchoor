# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

0xArgus is a DEX liquidity depth analyzer built with Next.js 16. It analyzes AMM (Automated Market Maker) liquidity pools to show real liquidity depth at various price levels - revealing how much actual trading capacity exists beyond surface-level metrics like market cap.

## Commands

```bash
# Development
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Build for production (runs prisma generate first)
npm run lint         # Run ESLint

# Database
npx prisma generate  # Generate Prisma client
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
- `src/app/api/` - Backend API endpoints (liquidity, OHLCV, trades, sync)
- `src/app/pool/[chainId]/[poolAddress]/` - Pool detail page with dynamic routing
- `src/components/` - React components (Chart, LiquidityDepth, TradePanel, etc.)
- `src/lib/` - Core business logic:
  - `api.ts` - DexScreener/GeckoTerminal API clients with caching
  - `liquidity.ts` - Uniswap V3/V4 on-chain liquidity depth calculation
  - `i18n/` - Multi-language support (EN, KO, JA, ES, PT, RU)
- `src/hooks/` - React hooks for real-time data (WebSocket, polling)
- `prisma/` - Database schema and configuration

### Uniswap V3/V4 Integration

The `src/lib/liquidity.ts` module handles on-chain liquidity queries:
- **V3 pools**: Direct RPC calls to pool contracts for slot0, liquidity, tick data
- **V4 pools**: Uses StateView contract to query PoolManager state
- Gerstner wave algorithm converts tick ranges to price-based depth levels
- RPC rotation on failure for reliability

### Database Models (Prisma)

- `Pool` - Cached pool metadata from DexScreener
- `LPPosition` - Mint/Burn events from LP position changes
- `LiquiditySnapshot` - Point-in-time order book snapshots
- `OHLCVCandle` - Pre-computed candlestick data
- `V4Trade` - Uniswap V4 swap events

## Environment Variables

Required in `.env`:
```
DATABASE_URL=postgresql://...
DUNE_API_KEY=...        # For LP position sync
SYNC_API_KEY=...        # Optional: protect sync endpoints
```

## Key Patterns

### Caching Strategy
- In-memory + localStorage dual cache for API responses
- TTLs: Pool info (1 min), OHLCV (30 sec), Search (30 sec), Token info (1 hour)

### Real-time Data
- WebSocket hook with auto-reconnect (`useWebSocket.ts`)
- Polling fallback when WebSocket unavailable (`useRealtimePrice.ts`, `useRealtimeOHLCV.ts`)

### V4 Pool Detection
- V4 pool IDs are 32 bytes (64 hex chars): `0x...{64}`
- V3 pool addresses are 20 bytes (40 hex chars): `0x...{40}`

## Tech Stack

- **Frontend**: Next.js 16, React 19, TailwindCSS 4, Three.js (ocean background)
- **Charts**: lightweight-charts
- **Blockchain**: viem, wagmi (wallet connection)
- **Database**: PostgreSQL with Prisma ORM
- **Trading**: CoW Protocol SDK for swap widget
