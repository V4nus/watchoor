import { http, createConfig } from 'wagmi';
import { mainnet, base, arbitrum, polygon, bsc } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

// WalletConnect project ID - you should get your own at https://cloud.walletconnect.com
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo';

// OKX Wallet connector using injected with custom target function
const okxWallet = () => injected({
  target() {
    if (typeof window === 'undefined') return undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const provider = (window as any).okxwallet;
    if (!provider) return undefined;
    return {
      id: 'okxWallet',
      name: 'OKX Wallet',
      provider,
    };
  },
});

// Binance Wallet connector using injected with custom target function
const binanceWallet = () => injected({
  target() {
    if (typeof window === 'undefined') return undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const provider = (window as any).BinanceChain;
    if (!provider) return undefined;
    return {
      id: 'binanceWallet',
      name: 'Binance Wallet',
      provider,
    };
  },
});

// Wallet connectors configuration
export const config = createConfig({
  chains: [mainnet, base, arbitrum, polygon, bsc],
  connectors: [
    // Generic injected connector (auto-detects wallets via EIP-6963)
    injected(),
    // MetaMask specific
    injected({
      target: 'metaMask',
    }),
    // OKX Wallet - uses window.okxwallet provider
    okxWallet(),
    // Binance Wallet - uses window.BinanceChain provider
    binanceWallet(),
    // WalletConnect for mobile wallets
    walletConnect({ projectId }),
  ],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
  },
  // Enable multi-injected provider discovery (EIP-6963)
  multiInjectedProviderDiscovery: true,
});

// Chain ID mapping from our chainId strings to wagmi chain IDs
export const CHAIN_ID_MAP: Record<string, number> = {
  ethereum: mainnet.id,
  base: base.id,
  arbitrum: arbitrum.id,
  polygon: polygon.id,
  bsc: bsc.id,
};

// Reverse mapping
export const CHAIN_NAME_MAP: Record<number, string> = {
  [mainnet.id]: 'ethereum',
  [base.id]: 'base',
  [arbitrum.id]: 'arbitrum',
  [polygon.id]: 'polygon',
  [bsc.id]: 'bsc',
};
