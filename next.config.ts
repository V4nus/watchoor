import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.coingecko.com',
        pathname: '/coins/images/**',
      },
      {
        protocol: 'https',
        hostname: 'dd.dexscreener.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.dexscreener.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'tokens.1inch.io',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
