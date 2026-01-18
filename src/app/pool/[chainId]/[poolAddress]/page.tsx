import { getPoolInfo } from '@/lib/api';
import { notFound } from 'next/navigation';
import PoolPageClient from './PoolPageClient';

interface PoolPageProps {
  params: Promise<{
    chainId: string;
    poolAddress: string;
  }>;
}

export async function generateMetadata({ params }: PoolPageProps) {
  const { chainId, poolAddress } = await params;
  const pool = await getPoolInfo(chainId, poolAddress);

  if (!pool) {
    return { title: 'Pool Not Found' };
  }

  return {
    title: `${pool.baseToken.symbol}/${pool.quoteToken.symbol} - Watchoor`,
    description: `View ${pool.baseToken.symbol}/${pool.quoteToken.symbol} order flow, liquidity depth and trading data on ${pool.dex}`,
  };
}

export default async function PoolPage({ params }: PoolPageProps) {
  const { chainId, poolAddress } = await params;
  const pool = await getPoolInfo(chainId, poolAddress);

  if (!pool) {
    notFound();
  }

  return <PoolPageClient pool={pool} />;
}
