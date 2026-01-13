'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Loader2 } from 'lucide-react';
import { SearchResult, SUPPORTED_CHAINS } from '@/types';
import { searchPools, formatNumber, formatPrice } from '@/lib/api';
import TokenLogo, { TokenPairLogos } from '@/components/TokenLogo';
import { useTranslations, Translations } from '@/lib/i18n';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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
          {t.search.vol}: ${formatNumber(result.volume24h)}
        </p>
      </div>
    </button>
  );
}
