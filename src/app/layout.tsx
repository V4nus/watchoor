import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";
import { I18nProvider } from "@/lib/i18n";
import { RealtimeProvider } from "@/lib/realtime-provider";

export const metadata: Metadata = {
  title: "0xArgus - Decode AMM Liquidity Into Order Flow",
  description: "Transform any AMM liquidity into real-time order book depth. See hidden support and resistance levels across all DEX pools and chains.",
  keywords: ["DeFi", "Order Flow", "AMM", "Liquidity", "Order Book", "DEX", "Trading", "On-Chain Analytics"],
  openGraph: {
    title: "0xArgus - Decode AMM Liquidity Into Order Flow",
    description: "Transform any AMM liquidity into real-time order book depth. See hidden support and resistance across all DEX pools.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "0xArgus - Decode AMM Liquidity Into Order Flow",
    description: "Transform any AMM liquidity into real-time order book depth. See hidden support and resistance across all DEX pools.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <I18nProvider>
          <RealtimeProvider pollingInterval={5000}>
            <WalletProvider>
              {children}
            </WalletProvider>
          </RealtimeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
