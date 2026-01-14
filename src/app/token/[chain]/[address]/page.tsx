'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface TokenPageProps {
  params: Promise<{
    chain: string;
    address: string;
  }>;
}

export default function TokenPage({ params }: TokenPageProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function findPool() {
      const { chain, address } = await params;

      try {
        // Search for pools with this token using DexScreener API
        const response = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${address}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch token data');
        }

        const data = await response.json();

        if (data.pairs && data.pairs.length > 0) {
          // Find a pool on the specified chain, or use the first one
          const chainPool = data.pairs.find(
            (p: { chainId: string }) => p.chainId === chain
          );
          const pool = chainPool || data.pairs[0];

          // Redirect to the pool page
          router.replace(`/pool/${pool.chainId}/${pool.pairAddress}`);
        } else {
          setError('No pools found for this token');
          setLoading(false);
        }
      } catch (err) {
        console.error('Error finding pool:', err);
        setError('Failed to find pools for this token');
        setLoading(false);
      }
    }

    findPool();
  }, [params, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0b0e] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Finding best pool...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0b0b0e] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return null;
}
