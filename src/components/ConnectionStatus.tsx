'use client';

import { useRealtime } from '@/lib/realtime-provider';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

interface ConnectionStatusProps {
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export default function ConnectionStatus({ showLabel = true, size = 'sm' }: ConnectionStatusProps) {
  const t = useTranslations();
  const { isConnected, usePolling } = useRealtime();

  const iconSize = size === 'sm' ? 14 : 18;

  if (usePolling) {
    return (
      <div className="flex items-center gap-1.5 text-yellow-500" title="Using polling for real-time updates">
        <RefreshCw size={iconSize} className="animate-spin-slow" />
        {showLabel && <span className="text-xs">Polling</span>}
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-1.5 text-[#3fb950]" title="WebSocket connected">
        <Wifi size={iconSize} />
        {showLabel && <span className="text-xs">Live</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-[#f85149]" title="WebSocket disconnected">
      <WifiOff size={iconSize} />
      {showLabel && <span className="text-xs">Offline</span>}
    </div>
  );
}
