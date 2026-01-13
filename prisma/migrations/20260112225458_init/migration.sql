-- CreateTable
CREATE TABLE "Pool" (
    "id" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "poolAddress" TEXT NOT NULL,
    "dex" TEXT NOT NULL,
    "baseSymbol" TEXT NOT NULL,
    "quoteSymbol" TEXT NOT NULL,
    "baseAddress" TEXT NOT NULL,
    "quoteAddress" TEXT NOT NULL,
    "baseDecimals" INTEGER NOT NULL DEFAULT 18,
    "quoteDecimals" INTEGER NOT NULL DEFAULT 18,
    "baseImageUrl" TEXT,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "liquidity" DOUBLE PRECISION NOT NULL,
    "volume24h" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquiditySnapshot" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "bidsJson" TEXT NOT NULL,
    "asksJson" TEXT NOT NULL,
    "token0Symbol" TEXT NOT NULL,
    "token1Symbol" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiquiditySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LPPosition" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "tickLower" INTEGER NOT NULL,
    "tickUpper" INTEGER NOT NULL,
    "liquidity" TEXT NOT NULL,
    "amount0" TEXT NOT NULL,
    "amount1" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LPPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotePrice" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncStatus" (
    "id" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "poolAddress" TEXT NOT NULL,
    "lastBlock" INTEGER NOT NULL,
    "syncType" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pool_chainId_idx" ON "Pool"("chainId");

-- CreateIndex
CREATE INDEX "Pool_baseSymbol_idx" ON "Pool"("baseSymbol");

-- CreateIndex
CREATE UNIQUE INDEX "Pool_chainId_poolAddress_key" ON "Pool"("chainId", "poolAddress");

-- CreateIndex
CREATE INDEX "LiquiditySnapshot_poolId_idx" ON "LiquiditySnapshot"("poolId");

-- CreateIndex
CREATE INDEX "LiquiditySnapshot_createdAt_idx" ON "LiquiditySnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "LPPosition_poolId_idx" ON "LPPosition"("poolId");

-- CreateIndex
CREATE INDEX "LPPosition_owner_idx" ON "LPPosition"("owner");

-- CreateIndex
CREATE INDEX "LPPosition_timestamp_idx" ON "LPPosition"("timestamp");

-- CreateIndex
CREATE INDEX "LPPosition_blockNumber_idx" ON "LPPosition"("blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LPPosition_txHash_tickLower_tickUpper_type_key" ON "LPPosition"("txHash", "tickLower", "tickUpper", "type");

-- CreateIndex
CREATE UNIQUE INDEX "QuotePrice_symbol_key" ON "QuotePrice"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "SyncStatus_chainId_poolAddress_syncType_key" ON "SyncStatus"("chainId", "poolAddress", "syncType");

-- AddForeignKey
ALTER TABLE "LiquiditySnapshot" ADD CONSTRAINT "LiquiditySnapshot_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LPPosition" ADD CONSTRAINT "LPPosition_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
