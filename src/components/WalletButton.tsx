'use client';

import { useState, useRef, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useBalance, useChainId, useSwitchChain, useReadContract, useConnectors } from 'wagmi';
import { formatUnits, erc20Abi } from 'viem';
import { CHAIN_ID_MAP } from '@/lib/wagmi';
import { formatNumber } from '@/lib/api';

// Wallet icons (SVG data URIs for common wallets)
const WALLET_ICONS: Record<string, string> = {
  metaMask: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjcuMiA0TDE3LjYgMTEuMkwxOS40IDdMMjcuMiA0WiIgZmlsbD0iI0U4ODIxRSIvPjxwYXRoIGQ9Ik00LjggNEwxNC40IDExLjJMMTIuNiA3TDQuOCA0WiIgZmlsbD0iI0U4ODIxRSIvPjwvc3ZnPg==',
  okx: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIGZpbGw9ImJsYWNrIi8+PHJlY3QgeD0iNiIgeT0iNiIgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSIxOCIgeT0iNiIgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSI2IiB5PSIxOCIgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSIxOCIgeT0iMTgiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IndoaXRlIi8+PC9zdmc+',
  binance: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNiIgZmlsbD0iI0YzQkEyRiIvPjxwYXRoIGQ9Ik0xNiA3TDEyLjUgMTAuNUwxNC41IDEyLjVMMTYgMTFMMTcuNSAxMi41TDE5LjUgMTAuNUwxNiA3WiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=',
  coinbase: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNiIgZmlsbD0iIzAwNTJGRiIvPjxjaXJjbGUgY3g9IjE2IiBjeT0iMTYiIHI9IjgiIGZpbGw9IndoaXRlIi8+PC9zdmc+',
  walletConnect: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNiIgZmlsbD0iIzMzOThGRiIvPjxwYXRoIGQ9Ik0xMCAxM0MxMyAxMCAxOSAxMCAyMiAxM0wxNiAxOUwxMCAxM1oiIGZpbGw9IndoaXRlIi8+PC9zdmc+',
};

// Native token symbols per chain
const NATIVE_SYMBOLS: Record<number, string> = {
  1: 'ETH',
  8453: 'ETH',
  42161: 'ETH',
  137: 'MATIC',
  56: 'BNB',
};

// Stablecoin addresses per chain
const STABLECOINS: Record<number, { address: `0x${string}`; symbol: string; decimals: number }[]> = {
  1: [
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 },
  ],
  8453: [
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
  ],
  42161: [
    { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', decimals: 6 },
    { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', decimals: 6 },
  ],
  137: [
    { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', symbol: 'USDC', decimals: 6 },
    { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', decimals: 6 },
  ],
  56: [
    { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC', decimals: 18 },
    { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', decimals: 18 },
  ],
};

interface WalletButtonProps {
  chainId: string;
  baseTokenAddress?: string;
  baseSymbol?: string;
}

export default function WalletButton({
  chainId,
  baseTokenAddress,
  baseSymbol,
}: WalletButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const walletSelectorRef = useRef<HTMLDivElement>(null);

  const { address, isConnected } = useAccount();
  const { connect, isPending: isConnecting, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const currentChainId = useChainId();
  const { switchChain } = useSwitchChain();

  const targetChainId = CHAIN_ID_MAP[chainId] || 1;
  const isCorrectChain = currentChainId === targetChainId;
  const nativeSymbol = NATIVE_SYMBOLS[targetChainId] || 'ETH';

  // Get wallet icon based on connector name
  const getWalletIcon = (connectorName: string): string => {
    const name = connectorName.toLowerCase();
    if (name.includes('metamask')) return WALLET_ICONS.metaMask;
    if (name.includes('okx') || name.includes('okex')) return WALLET_ICONS.okx;
    if (name.includes('binance') || name.includes('bnb')) return WALLET_ICONS.binance;
    if (name.includes('coinbase')) return WALLET_ICONS.coinbase;
    if (name.includes('walletconnect')) return WALLET_ICONS.walletConnect;
    return '';
  };

  // Native token balance
  const { data: nativeBalance } = useBalance({
    address,
    chainId: targetChainId,
  });

  // Base token balance (the token being viewed) - use useReadContract for ERC20
  const isERC20Token = baseTokenAddress && baseTokenAddress !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
  const { data: baseTokenBalance } = useReadContract({
    address: isERC20Token ? baseTokenAddress as `0x${string}` : undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: targetChainId,
    query: {
      enabled: !!isERC20Token && !!address,
    },
  });

  const { data: baseTokenDecimals } = useReadContract({
    address: isERC20Token ? baseTokenAddress as `0x${string}` : undefined,
    abi: erc20Abi,
    functionName: 'decimals',
    chainId: targetChainId,
    query: {
      enabled: !!isERC20Token,
    },
  });

  // Stablecoin balances
  const stablecoins = STABLECOINS[targetChainId] || [];
  const { data: stablecoin1Balance } = useReadContract({
    address: stablecoins[0]?.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: targetChainId,
    query: {
      enabled: !!stablecoins[0] && !!address,
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (walletSelectorRef.current && !walletSelectorRef.current.contains(event.target as Node)) {
        setShowWalletSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleConnect = (connector: typeof connectors[0]) => {
    connect({ connector });
    setShowWalletSelector(false);
  };

  const handleSwitchChain = () => {
    switchChain({ chainId: targetChainId });
  };

  const formatBalance = (balance: bigint | undefined, decimals: number) => {
    if (!balance) return '0';
    const value = parseFloat(formatUnits(balance, decimals));
    if (value === 0) return '0';
    if (value < 0.0001) return '<0.0001';
    return formatNumber(value);
  };

  // Not connected - show connect button with wallet selector
  if (!isConnected) {
    return (
      <div className="relative" ref={walletSelectorRef}>
        <button
          onClick={() => setShowWalletSelector(!showWalletSelector)}
          disabled={isConnecting}
          className="px-3 py-1.5 bg-[#58a6ff] hover:bg-[#58a6ff]/80 disabled:opacity-50 text-white text-xs sm:text-sm font-medium rounded transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="hidden sm:inline">{isConnecting ? 'Connecting...' : 'Connect'}</span>
        </button>

        {/* Wallet selector dropdown */}
        {showWalletSelector && (
          <div className="absolute right-0 mt-2 w-64 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl z-50">
            <div className="p-3 border-b border-[#30363d]">
              <div className="text-sm font-medium text-white">Connect Wallet</div>
              <div className="text-xs text-gray-400 mt-1">Choose your preferred wallet</div>
            </div>
            <div className="p-2 space-y-1">
              {connectors.map((connector) => {
                const icon = getWalletIcon(connector.name);
                return (
                  <button
                    key={connector.uid}
                    onClick={() => handleConnect(connector)}
                    disabled={isConnecting}
                    className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-[#21262d] rounded-lg transition-colors text-left"
                  >
                    {icon ? (
                      <img src={icon} alt={connector.name} className="w-8 h-8 rounded-lg" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-[#30363d] flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{connector.name}</div>
                      {connector.name.toLowerCase().includes('walletconnect') && (
                        <div className="text-xs text-gray-400">Scan with mobile wallet</div>
                      )}
                    </div>
                    {isConnecting && (
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Wrong chain - show switch button
  if (!isCorrectChain) {
    return (
      <button
        onClick={handleSwitchChain}
        className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-600/80 text-white text-xs sm:text-sm font-medium rounded transition-colors flex items-center gap-1.5"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="hidden sm:inline">Switch Chain</span>
      </button>
    );
  }

  // Connected - show wallet with dropdown
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-2 sm:px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-white text-xs sm:text-sm font-medium rounded transition-colors flex items-center gap-1.5"
      >
        {/* Green dot indicator */}
        <span className="w-2 h-2 rounded-full bg-[#3fb950]" />
        <span className="hidden sm:inline">
          {address?.slice(0, 4)}...{address?.slice(-4)}
        </span>
        <span className="sm:hidden">
          {address?.slice(0, 4)}..
        </span>
        <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl z-50">
          {/* Balances */}
          <div className="p-3 border-b border-[#30363d]">
            <div className="text-xs text-gray-400 mb-2">Balances</div>
            <div className="space-y-1.5">
              {/* Native token */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{nativeSymbol}</span>
                <span className="text-white font-medium">
                  {formatBalance(nativeBalance?.value, 18)}
                </span>
              </div>

              {/* Base token (if viewing a specific token) */}
              {baseSymbol && isERC20Token && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#58a6ff]">{baseSymbol}</span>
                  <span className="text-white font-medium">
                    {formatBalance(baseTokenBalance as bigint | undefined, baseTokenDecimals as number || 18)}
                  </span>
                </div>
              )}

              {/* Stablecoin */}
              {stablecoins[0] && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#3fb950]">{stablecoins[0].symbol}</span>
                  <span className="text-white font-medium">
                    {formatBalance(stablecoin1Balance as bigint | undefined, stablecoins[0].decimals)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Address */}
          <div className="p-3 border-b border-[#30363d]">
            <div className="text-xs text-gray-400 mb-1">Address</div>
            <div className="flex items-center gap-2">
              <code className="text-xs text-[#58a6ff] flex-1 truncate">
                {address}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(address || '');
                }}
                className="p-1 hover:bg-[#30363d] rounded"
                title="Copy address"
              >
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Disconnect */}
          <div className="p-2">
            <button
              onClick={() => {
                disconnect();
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-sm text-[#f85149] hover:bg-[#f85149]/10 rounded transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
