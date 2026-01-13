'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { getFavorites, removeFavorite, FavoritePool } from '@/lib/favorites';
import TokenLogo from '@/components/TokenLogo';

interface FavoritesSidebarProps {
  currentPoolAddress?: string;
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function FavoritesSidebar({ currentPoolAddress, isCollapsed, onToggle }: FavoritesSidebarProps) {
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoritePool[]>([]);

  // Load favorites on mount and listen for updates
  useEffect(() => {
    const loadFavorites = () => {
      setFavorites(getFavorites());
    };

    loadFavorites();

    // Listen for favorites updates from other components
    window.addEventListener('favorites-updated', loadFavorites);
    return () => window.removeEventListener('favorites-updated', loadFavorites);
  }, []);

  const handleRemove = (e: React.MouseEvent, chainId: string, poolAddress: string) => {
    e.preventDefault();
    e.stopPropagation();
    removeFavorite(chainId, poolAddress);
  };

  // Always render the toggle button, even if no favorites
  return (
    <div className={`h-full flex-shrink-0 flex transition-all duration-200 ${isCollapsed ? 'w-8' : 'w-48'}`}>
      {/* Collapsed state - just show toggle button */}
      {isCollapsed ? (
        <button
          onClick={onToggle}
          className="w-8 h-full bg-[#161b22] border-r border-[#30363d] flex flex-col items-center justify-center hover:bg-[#21262d] transition-colors"
          title="Show favorites"
        >
          <Star size={14} className="text-yellow-500 fill-yellow-500 mb-1" />
          <ChevronRight size={14} className="text-gray-400" />
          {favorites.length > 0 && (
            <span className="text-[10px] text-gray-500 mt-1">{favorites.length}</span>
          )}
        </button>
      ) : (
        /* Expanded state */
        <div className="w-48 h-full bg-[#161b22] border-r border-[#30363d] flex flex-col">
          {/* Header with collapse button */}
          <div className="flex items-center justify-between p-2 border-b border-[#30363d]">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-300">
              <Star size={14} className="text-yellow-500 fill-yellow-500" />
              <span>Favorites ({favorites.length})</span>
            </div>
            <button
              onClick={onToggle}
              className="p-1 hover:bg-[#30363d] rounded transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft size={14} className="text-gray-400" />
            </button>
          </div>

          {/* Favorites List */}
          <div className="flex-1 overflow-y-auto">
            {favorites.length === 0 ? (
              <div className="p-3 text-xs text-gray-500 text-center">
                No favorites yet
              </div>
            ) : (
              favorites.map((pool) => {
                const isActive = currentPoolAddress?.toLowerCase() === pool.poolAddress.toLowerCase();

                const handleNavigate = () => {
                  router.push(`/pool/${pool.chainId}/${pool.poolAddress}`);
                };

                return (
                  <div
                    key={`${pool.chainId}-${pool.poolAddress}`}
                    onClick={handleNavigate}
                    className={`flex items-center gap-2 p-2 hover:bg-[#21262d] transition-colors group cursor-pointer ${
                      isActive ? 'bg-[#21262d] border-l-2 border-[#58a6ff]' : ''
                    }`}
                  >
                    <TokenLogo
                      symbol={pool.baseSymbol}
                      imageUrl={pool.baseImageUrl}
                      chainId={pool.chainId}
                      size={20}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {pool.baseSymbol}/{pool.quoteSymbol}
                      </div>
                      <div className="text-[10px] text-gray-500 uppercase">
                        {pool.chainId}
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleRemove(e, pool.chainId, pool.poolAddress)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#30363d] rounded text-gray-500 hover:text-[#f85149] transition-opacity"
                      title="Remove from favorites"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
