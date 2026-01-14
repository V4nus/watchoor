import { http, createConfig } from 'wagmi';
import { mainnet, base, arbitrum, polygon, bsc } from 'wagmi/chains';
import { walletConnect } from 'wagmi/connectors';

// WalletConnect project ID - you should get your own at https://cloud.walletconnect.com
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo';

// Wallet connectors configuration
// Uses EIP-6963 for automatic wallet discovery (MetaMask, OKX, Binance, Coinbase, etc.)
// All modern wallets that support EIP-6963 will be auto-detected
export const config = createConfig({
  chains: [mainnet, base, arbitrum, polygon, bsc],
  connectors: [
    // WalletConnect for mobile wallets and QR code scanning
    walletConnect({ projectId }),
  ],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
  },
  // Enable EIP-6963 multi-injected provider discovery
  // This automatically detects: MetaMask, OKX Wallet, Binance Wallet, Coinbase Wallet, etc.
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
