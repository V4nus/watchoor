// Search history utility - stores recently visited pools in localStorage

export interface SearchHistoryItem {
  chainId: string;
  poolAddress: string;
  symbol: string;       // e.g., "DRB"
  pair: string;         // e.g., "DRB/WETH"
  logo?: string;        // Token logo URL
  chainLogo?: string;   // Chain logo URL
  timestamp: number;    // Last visited time
}

const STORAGE_KEY = '0xargus_search_history';
const MAX_HISTORY_ITEMS = 10;

// Chain logos mapping
const CHAIN_LOGOS: Record<string, string> = {
  base: '/chains/base.svg',
  bsc: '/chains/bsc.svg',
  solana: '/chains/solana.png',
  ethereum: '/chains/ethereum.png',
};

/**
 * Get search history from localStorage
 */
export function getSearchHistory(): SearchHistoryItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const items: SearchHistoryItem[] = JSON.parse(stored);
    // Sort by timestamp descending (most recent first)
    return items.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

/**
 * Add a pool to search history
 */
export function addToSearchHistory(item: Omit<SearchHistoryItem, 'timestamp' | 'chainLogo'>): void {
  if (typeof window === 'undefined') return;

  // Validate required fields
  if (!item.poolAddress || !item.chainId || !item.symbol || !item.pair) {
    console.warn('[SearchHistory] Invalid item, missing required fields:', item);
    return;
  }

  try {
    const history = getSearchHistory();

    // Remove existing entry for this pool if it exists
    const filtered = history.filter(
      h => !(h.chainId === item.chainId && h.poolAddress?.toLowerCase() === item.poolAddress.toLowerCase())
    );

    // Add new entry at the beginning
    const newItem: SearchHistoryItem = {
      ...item,
      chainLogo: CHAIN_LOGOS[item.chainId] || CHAIN_LOGOS.ethereum,
      timestamp: Date.now(),
    };

    filtered.unshift(newItem);

    // Keep only the most recent items
    const trimmed = filtered.slice(0, MAX_HISTORY_ITEMS);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    console.log('[SearchHistory] Saved:', newItem.pair, newItem.poolAddress.slice(0, 10) + '...');
  } catch (e) {
    console.error('Failed to save search history:', e);
  }
}

/**
 * Remove a specific item from search history
 */
export function removeFromSearchHistory(chainId: string, poolAddress: string): void {
  if (typeof window === 'undefined') return;

  try {
    const history = getSearchHistory();
    const filtered = history.filter(
      h => !(h.chainId === chainId && h.poolAddress.toLowerCase() === poolAddress.toLowerCase())
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Failed to remove from search history:', e);
  }
}

/**
 * Clear all search history
 */
export function clearSearchHistory(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear search history:', e);
  }
}
