'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Loader2, History, Star } from 'lucide-react';
import { SearchResult, SUPPORTED_CHAINS } from '@/types';
import { searchPools, formatNumber, formatPrice } from '@/lib/api';
import TokenLogo, { TokenPairLogos } from '@/components/TokenLogo';
import { useTranslations, Translations } from '@/lib/i18n';
import { getSearchHistory, SearchHistoryItem } from '@/lib/search-history';
import { getFavorites, FavoriteItem } from '@/lib/favorites';

// Get DEX display name with version (V2/V3/V4)
function getDexDisplayName(dex: string, poolAddress: string): string {
  const dexLower = dex.toLowerCase();

  // Check if it's a Uniswap-based DEX
  if (dexLower.includes('uniswap')) {
    // V4 pools have 64-character hex ID (0x + 64 = 66 chars)
    if (poolAddress.length === 66) {
      return 'Uniswap V4';
    }
    // V2 is labeled as 'uniswapv2' or 'uniswap_v2'
    if (dexLower.includes('v2') || dexLower.includes('_v2')) {
      return 'Uniswap V2';
    }
    // Default to V3 for standard address format
    return 'Uniswap V3';
  }

  // PancakeSwap versions
  if (dexLower.includes('pancakeswap')) {
    if (poolAddress.length === 66) {
      return 'PancakeSwap V4';
    }
    if (dexLower.includes('v2') || dexLower.includes('_v2')) {
      return 'PancakeSwap V2';
    }
    if (dexLower.includes('v3') || dexLower.includes('_v3')) {
      return 'PancakeSwap V3';
    }
    return 'PancakeSwap';
  }

  // SushiSwap versions
  if (dexLower.includes('sushiswap') || dexLower.includes('sushi')) {
    if (dexLower.includes('v2') || dexLower.includes('_v2')) {
      return 'SushiSwap V2';
    }
    if (dexLower.includes('v3') || dexLower.includes('_v3')) {
      return 'SushiSwap V3';
    }
    return 'SushiSwap';
  }

  // For other DEXes, just capitalize first letter
  return dex.charAt(0).toUpperCase() + dex.slice(1);
}

interface GroupedResults {
  query: string;
  results: SearchResult[];
}

export default function SearchBox() {
  const t = useTranslations();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [groupedResults, setGroupedResults] = useState<GroupedResults[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isBatchSearch, setIsBatchSearch] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load search history and favorites on mount
  useEffect(() => {
    setSearchHistory(getSearchHistory());
    setFavorites(getFavorites());
  }, []);

  // Debounced search - supports batch search with commas
  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setResults([]);
      setGroupedResults([]);
      setIsBatchSearch(false);
      return;
    }

    // Check if batch search (contains comma)
    const queries = trimmedQuery.split(',').map(q => q.trim()).filter(q => q.length >= 2);
    const batchMode = queries.length > 1;
    setIsBatchSearch(batchMode);

    const timer = setTimeout(async () => {
      setLoading(true);

      if (batchMode) {
        // Batch search: search all queries in parallel
        const searchPromises = queries.map(async (q) => {
          const searchResults = await searchPools(q);
          return { query: q, results: searchResults.slice(0, 5) }; // Limit each query to 5 results
        });

        const batchResults = await Promise.all(searchPromises);
        setGroupedResults(batchResults);
        // Flatten for compatibility
        setResults(batchResults.flatMap(g => g.results));
      } else {
        // Single search
        const searchResults = await searchPools(trimmedQuery);
        setResults(searchResults);
        setGroupedResults([]);
      }

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

  const handleHistorySelect = (item: SearchHistoryItem) => {
    router.push(`/pool/${item.chainId}/${item.poolAddress}`);
    setShowResults(false);
    setQuery('');
  };

  const handleFavoriteSelect = (item: FavoriteItem) => {
    router.push(`/pool/${item.chainId}/${item.poolAddress}`);
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
          placeholder={t.search.placeholder}
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
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#161b22] border border-[#30363d] rounded-xl shadow-xl overflow-hidden z-50 max-h-[500px] overflow-y-auto">
          {/* Batch search grouped results */}
          {isBatchSearch && groupedResults.length > 0 ? (
            groupedResults.map((group, groupIdx) => (
              <div key={group.query}>
                {/* Group header */}
                <div className="px-4 py-2 bg-[#0d1117] border-b border-[#30363d] sticky top-0">
                  <span className="text-sm text-[#58a6ff] font-medium">
                    {t.search.searching}: {group.query}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({group.results.length} results)
                  </span>
                </div>
                {group.results.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    {t.search.noResults} &quot;{group.query}&quot;
                  </div>
                ) : (
                  group.results.map((result, index) => (
                    <SearchResultItem
                      key={`${group.query}-${result.chainId}-${result.poolAddress}-${index}`}
                      result={result}
                      onSelect={handleSelect}
                      getChainIcon={getChainIcon}
                      t={t}
                    />
                  ))
                )}
              </div>
            ))
          ) : (
            /* Single search results */
            results.map((result, index) => (
              <SearchResultItem
                key={`${result.chainId}-${result.poolAddress}-${index}`}
                result={result}
                onSelect={handleSelect}
                getChainIcon={getChainIcon}
                t={t}
              />
            ))
          )}
        </div>
      )}

      {/* Favorites & History Dropdown - show when focused with no query */}
      {showResults && query.length < 2 && !loading && (favorites.length > 0 || searchHistory.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#161b22] border border-[#30363d] rounded-xl shadow-xl overflow-hidden z-50 max-h-[400px] overflow-y-auto">
          {/* Favorites section */}
          {favorites.length > 0 && (
            <>
              <div className="px-4 py-2 border-b border-[#30363d] flex items-center gap-1.5 text-xs text-gray-500">
                <Star size={14} className="text-yellow-400" fill="currentColor" />
                <span>Favorites</span>
              </div>
              {favorites.slice(0, 5).map((item) => (
                <button
                  key={`fav-${item.chainId}-${item.poolAddress}`}
                  onClick={() => handleFavoriteSelect(item)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#21262d] transition-colors text-left"
                >
                  {item.logo ? (
                    <img src={item.logo} alt={item.symbol} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#30363d] flex items-center justify-center text-sm">
                      {item.symbol.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{item.pair}</span>
                      {item.chainLogo && (
                        <img src={item.chainLogo} alt="" className="w-4 h-4 opacity-60" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Recent history section */}
          {searchHistory.length > 0 && (
            <>
              <div className="px-4 py-2 border-b border-[#30363d] flex items-center gap-1.5 text-xs text-gray-500">
                <History size={14} />
                <span>Recent</span>
              </div>
              {searchHistory.slice(0, 5).map((item) => (
                <button
                  key={`history-${item.chainId}-${item.poolAddress}`}
                  onClick={() => handleHistorySelect(item)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#21262d] transition-colors text-left"
                >
                  {item.logo ? (
                    <img src={item.logo} alt={item.symbol} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#30363d] flex items-center justify-center text-sm">
                      {item.symbol.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{item.pair}</span>
                      {item.chainLogo && (
                        <img src={item.chainLogo} alt="" className="w-4 h-4 opacity-60" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* No results message */}
      {showResults && query.length >= 2 && !loading && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#161b22] border border-[#30363d] rounded-xl p-4 text-center text-gray-400">
          {t.search.noResults} &quot;{query}&quot;
        </div>
      )}

      {/* Batch search hint */}
      {showResults && !loading && query.length >= 2 && !isBatchSearch && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-[420px] px-4 py-2 text-xs text-gray-500 text-center">
          {t.search.batchHint}
        </div>
      )}
    </div>
  );
}

// Separate component for search result item to reduce duplication
function SearchResultItem({
  result,
  onSelect,
  getChainIcon,
  t,
}: {
  result: SearchResult;
  onSelect: (result: SearchResult) => void;
  getChainIcon: (chainId: string) => string;
  t: Translations;
}) {
  return (
    <button
      onClick={() => onSelect(result)}
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
            {getDexDisplayName(result.dex, result.poolAddress)}
          </span>
        </div>
        <p className="text-sm text-gray-400 truncate">
          {result.baseToken.name}
        </p>
      </div>
      <div className="text-right">
        <p className="font-medium">${formatPrice(result.priceUsd)}</p>
        <p className="text-xs text-gray-400">
          {t.search.vol}: ${formatNumber(result.volume24h)}
        </p>
      </div>
    </button>
  );
}
