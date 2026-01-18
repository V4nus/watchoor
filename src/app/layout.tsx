import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";
import { I18nProvider } from "@/lib/i18n";
import { RealtimeProvider } from "@/lib/realtime-provider";

// IBM Plex Sans - Similar to Binance's font
// Optimized: Only load weights we actually use
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

// IBM Plex Mono - For numbers and code
// Optimized: Minimal weights for monospace
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Watchoor - Liquidity Intelligence",
  description: "Transform any AMM liquidity into real-time order book depth. See hidden support and resistance levels across all DEX pools and chains.",
  keywords: ["Liquidity", "Order Book", "AMM", "DEX", "Trading", "On-Chain Analytics", "AI Agent"],
  openGraph: {
    title: "Watchoor - Liquidity Intelligence",
    description: "Transform any AMM liquidity into real-time order book depth. See hidden support and resistance across all DEX pools.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Watchoor - Liquidity Intelligence",
    description: "Transform any AMM liquidity into real-time order book depth. See hidden support and resistance across all DEX pools.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
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
