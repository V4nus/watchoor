'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Loader2 } from 'lucide-react';
import { SearchResult, SUPPORTED_CHAINS } from '@/types';
import { searchPools, formatNumber, formatPrice } from '@/lib/api';
import TokenLogo, { TokenPairLogos } from '@/components/TokenLogo';

export default function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Debounced search
  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const searchResults = await searchPools(trimmedQuery);
      setResults(searchResults);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (result: SearchResult) => {
    router.push(`/pool/${result.chainId}/${result.poolAddress}`);
    setShowResults(false);
    setQuery('');
  };

  const getChainIcon = (chainId: string) => {
    return SUPPORTED_CHAINS.find((c) => c.id === chainId)?.icon || '🔗';
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl">
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          size={20}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowResults(true)}
          placeholder="Search by token name, symbol, or pool address..."
          className="w-full pl-12 pr-12 py-4 bg-[#161b22] border border-[#30363d] rounded-xl text-[#c9d1d9] placeholder-gray-500 focus:outline-none focus:border-[#58a6ff] transition-colors"
        />
        {loading && (
          <Loader2
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 animate-spin"
            size={20}
          />
        )}
        {!loading && query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Search results dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#161b22] border border-[#30363d] rounded-xl shadow-xl overflow-hidden z-50 max-h-[400px] overflow-y-auto">
          {results.map((result, index) => (
            <button
              key={`${result.chainId}-${result.poolAddress}-${index}`}
              onClick={() => handleSelect(result)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#21262d] transition-colors text-left"
            >
              <TokenPairLogos
                baseSymbol={result.baseToken.symbol}
                quoteSymbol={result.quoteToken.symbol}
                baseImageUrl={result.baseToken.imageUrl}
                chainId={result.chainId}
                size={32}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {result.baseToken.symbol}/{result.quoteToken.symbol}
                  </span>
                  <span className="text-xl" title={result.chainId}>{getChainIcon(result.chainId)}</span>
                  <span className="text-xs text-gray-400 bg-[#0d1117] px-2 py-0.5 rounded">
                    {result.dex}
                  </span>
                </div>
                <p className="text-sm text-gray-400 truncate">
                  {result.baseToken.name}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">${formatPrice(result.priceUsd)}</p>
                <p className="text-xs text-gray-400">
                  Vol: ${formatNumber(result.volume24h)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {showResults && query.length >= 2 && !loading && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#161b22] border border-[#30363d] rounded-xl p-4 text-center text-gray-400">
          No pools found for &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}
