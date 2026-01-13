'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain, useBalance, useReadContract, useWriteContract, useSignTypedData } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { formatUnits, parseUnits, erc20Abi } from 'viem';
import { CHAIN_ID_MAP } from '@/lib/wagmi';
import { formatNumber } from '@/lib/api';
import {
  getQuote,
  isChainSupported,
  VAULT_RELAYER,
  NATIVE_TOKEN_ADDRESS,
  createOrderData,
  getEIP712Domain,
  COW_ORDER_TYPES,
  submitOrder,
  getOrderExplorerUrl,
  type QuoteResult,
} from '@/lib/cow';

// Native token symbols per chain
const NATIVE_SYMBOLS: Record<number, string> = {
  1: 'ETH',
  8453: 'ETH',
  42161: 'ETH',
  137: 'MATIC',
  56: 'BNB',
};

interface TradePanelProps {
  chainId: string;
  baseTokenAddress: string;
  quoteTokenAddress: string;
  baseSymbol: string;
  quoteSymbol: string;
  currentPrice?: number;
}

type TradeStatus = 'idle' | 'signing' | 'submitting' | 'success' | 'error';

export default function TradePanel({
  chainId,
  baseTokenAddress,
  quoteTokenAddress,
  baseSymbol,
  quoteSymbol,
  currentPrice = 0,
}: TradePanelProps) {
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [sliderValue, setSliderValue] = useState(0);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [tradeStatus, setTradeStatus] = useState<TradeStatus>('idle');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);

  const { address, isConnected } = useAccount();
  const { connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const currentChainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();

  const targetChainId = CHAIN_ID_MAP[chainId] || 1;
  const isSupportedChain = isChainSupported(targetChainId);
  const isCorrectChain = currentChainId === targetChainId;

  // Native balance (for gas)
  const { data: nativeBalance } = useBalance({
    address,
    chainId: targetChainId,
  });

  // Quote token balance (USDC/USDT for buying)
  const isQuoteNative = quoteTokenAddress === NATIVE_TOKEN_ADDRESS;
  const { data: quoteBalance } = useReadContract({
    address: !isQuoteNative ? quoteTokenAddress as `0x${string}` : undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: targetChainId,
    query: { enabled: !isQuoteNative && !!address },
  });
  const { data: quoteDecimals } = useReadContract({
    address: !isQuoteNative ? quoteTokenAddress as `0x${string}` : undefined,
    abi: erc20Abi,
    functionName: 'decimals',
    chainId: targetChainId,
    query: { enabled: !isQuoteNative },
  });

  // Base token balance (for selling)
  const isBaseNative = baseTokenAddress === NATIVE_TOKEN_ADDRESS;
  const { data: baseBalance } = useReadContract({
    address: !isBaseNative ? baseTokenAddress as `0x${string}` : undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: targetChainId,
    query: { enabled: !isBaseNative && !!address },
  });
  const { data: baseDecimals } = useReadContract({
    address: !isBaseNative ? baseTokenAddress as `0x${string}` : undefined,
    abi: erc20Abi,
    functionName: 'decimals',
    chainId: targetChainId,
    query: { enabled: !isBaseNative },
  });

  // Check allowance for the sell token
  const sellTokenAddress = tradeType === 'buy' ? quoteTokenAddress : baseTokenAddress;
  const isSellTokenNative = sellTokenAddress === NATIVE_TOKEN_ADDRESS;
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: !isSellTokenNative ? sellTokenAddress as `0x${string}` : undefined,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && VAULT_RELAYER[targetChainId] ? [address, VAULT_RELAYER[targetChainId]] : undefined,
    chainId: targetChainId,
    query: { enabled: !isSellTokenNative && !!address && !!VAULT_RELAYER[targetChainId] },
  });

  // Get decimals for input token
  const inputDecimals = tradeType === 'buy'
    ? (isQuoteNative ? 18 : (quoteDecimals as number) || 6)
    : (isBaseNative ? 18 : (baseDecimals as number) || 18);

  const outputDecimals = tradeType === 'buy'
    ? (isBaseNative ? 18 : (baseDecimals as number) || 18)
    : (isQuoteNative ? 18 : (quoteDecimals as number) || 6);

  // Calculate available balance
  const getAvailableBalance = () => {
    if (tradeType === 'buy') {
      if (isQuoteNative) {
        return nativeBalance?.value ? parseFloat(formatUnits(nativeBalance.value, 18)) : 0;
      }
      return quoteBalance ? parseFloat(formatUnits(quoteBalance as bigint, (quoteDecimals as number) || 6)) : 0;
    } else {
      if (isBaseNative) {
        return nativeBalance?.value ? parseFloat(formatUnits(nativeBalance.value, 18)) : 0;
      }
      return baseBalance ? parseFloat(formatUnits(baseBalance as bigint, (baseDecimals as number) || 18)) : 0;
    }
  };

  const availableBalance = getAvailableBalance();
  const availableSymbol = tradeType === 'buy' ? quoteSymbol : baseSymbol;

  // Fetch quote when amount changes
  const fetchQuote = useCallback(async () => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0 || !address || !isSupportedChain) {
      setQuote(null);
      return;
    }

    setIsLoadingQuote(true);
    setQuoteError(null);

    try {
      const sellToken = tradeType === 'buy' ? quoteTokenAddress : baseTokenAddress;
      const buyToken = tradeType === 'buy' ? baseTokenAddress : quoteTokenAddress;
      const amountWei = parseUnits(amount, inputDecimals).toString();

      const quoteResult = await getQuote({
        chainId: targetChainId,
        sellToken,
        buyToken,
        amount: amountWei,
        kind: 'sell',
        userAddress: address,
        slippageBps: 50, // 0.5% slippage
      });

      setQuote(quoteResult);
    } catch (error) {
      console.error('Quote error:', error);
      setQuoteError('Unable to get quote');
      setQuote(null);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [amount, address, isSupportedChain, tradeType, quoteTokenAddress, baseTokenAddress, inputDecimals, targetChainId]);

  // Debounce quote fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isConnected && isCorrectChain && isSupportedChain) {
        fetchQuote();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [fetchQuote, isConnected, isCorrectChain, isSupportedChain]);

  // Calculate estimated output
  const amountNum = parseFloat(amount) || 0;
  const estimatedOutput = quote
    ? parseFloat(formatUnits(BigInt(quote.buyAmount), outputDecimals))
    : (tradeType === 'buy'
      ? (currentPrice > 0 ? amountNum / currentPrice : 0)
      : amountNum * currentPrice);

  // Check if approval is needed
  const needsApproval = !isSellTokenNative && quote && allowance !== undefined
    ? BigInt(allowance as bigint) < BigInt(quote.sellAmount)
    : false;

  // Handle slider change
  const handleSliderChange = (percent: number) => {
    setSliderValue(percent);
    if (availableBalance > 0) {
      const maxAmount = availableBalance * percent / 100;
      setAmount(maxAmount.toFixed(6));
    }
  };

  const handleConnect = () => {
    connect({ connector: injected() });
  };

  const handleSwitchChain = () => {
    switchChain({ chainId: targetChainId });
  };

  // Handle approval
  const handleApprove = async () => {
    if (!quote || !address || isSellTokenNative) return;

    setIsApproving(true);
    try {
      const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

      await writeContractAsync({
        address: sellTokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [VAULT_RELAYER[targetChainId], maxUint256],
      });

      // Wait a bit and refetch allowance
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refetchAllowance();
    } catch (error) {
      console.error('Approval error:', error);
    } finally {
      setIsApproving(false);
    }
  };

  // Handle trade execution with EIP-712 signing
  const handleTrade = async () => {
    if (!quote || !address) return;

    setTradeStatus('signing');
    setTradeError(null);
    setOrderId(null);

    try {
      // Create order data
      const orderData = createOrderData({
        sellToken: quote.sellToken,
        buyToken: quote.buyToken,
        sellAmount: quote.sellAmount,
        buyAmount: quote.buyAmount,
        validTo: quote.validTo,
        receiver: address,
        feeAmount: quote.feeAmount,
        kind: 'sell',
      });

      // Get EIP-712 domain
      const domain = getEIP712Domain(targetChainId);

      // Sign the order using EIP-712
      const signature = await signTypedDataAsync({
        domain: {
          name: domain.name,
          version: domain.version,
          chainId: domain.chainId,
          verifyingContract: domain.verifyingContract,
        },
        types: COW_ORDER_TYPES,
        primaryType: 'Order',
        message: {
          sellToken: orderData.sellToken as `0x${string}`,
          buyToken: orderData.buyToken as `0x${string}`,
          receiver: orderData.receiver as `0x${string}`,
          sellAmount: BigInt(orderData.sellAmount),
          buyAmount: BigInt(orderData.buyAmount),
          validTo: orderData.validTo,
          appData: orderData.appData as `0x${string}`,
          feeAmount: BigInt(orderData.feeAmount),
          kind: orderData.kind,
          partiallyFillable: orderData.partiallyFillable,
          sellTokenBalance: orderData.sellTokenBalance,
          buyTokenBalance: orderData.buyTokenBalance,
        },
      });

      setTradeStatus('submitting');

      // Submit the signed order
      const newOrderId = await submitOrder({
        chainId: targetChainId,
        order: orderData,
        signature,
        signingScheme: 'eip712',
        from: address,
      });

      setOrderId(newOrderId);
      setTradeStatus('success');

      // Reset form after success
      setTimeout(() => {
        setAmount('');
        setSliderValue(0);
        setQuote(null);
        setTradeStatus('idle');
      }, 5000);

    } catch (error: unknown) {
      console.error('Trade error:', error);
      setTradeStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      setTradeError(errorMessage.includes('User rejected') ? 'Transaction cancelled' : errorMessage);
    }
  };

  const formatBalance = (value: number) => {
    if (value === 0) return '0';
    if (value < 0.0001) return '<0.0001';
    if (value < 1) return value.toFixed(6);
    return formatNumber(value);
  };

  const isTrading = tradeStatus === 'signing' || tradeStatus === 'submitting';

  return (
    <div className="bg-[#161b22] rounded-lg border border-[#30363d] overflow-hidden">
      {/* Header: Swap label + refresh */}
      <div className="px-3 py-2 border-b border-[#30363d] flex items-center justify-between">
        <span className="text-sm font-medium">Swap</span>
        <div className="flex items-center gap-2 text-gray-400">
          <button
            onClick={fetchQuote}
            className="hover:text-white p-1"
            title="Refresh quote"
            disabled={isLoadingQuote}
          >
            <svg className={`w-4 h-4 ${isLoadingQuote ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Buy/Sell Toggle */}
      <div className="flex border-b border-[#30363d]">
        <button
          onClick={() => { setTradeType('buy'); setQuote(null); setTradeStatus('idle'); }}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            tradeType === 'buy'
              ? 'bg-[#3fb950]/10 text-[#3fb950] border-b-2 border-[#3fb950]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => { setTradeType('sell'); setQuote(null); setTradeStatus('idle'); }}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            tradeType === 'sell'
              ? 'bg-[#f85149]/10 text-[#f85149] border-b-2 border-[#f85149]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Sell
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Success Message */}
        {tradeStatus === 'success' && orderId && (
          <div className="bg-[#3fb950]/10 border border-[#3fb950]/30 rounded p-3 text-center">
            <div className="text-[#3fb950] text-sm font-medium mb-1">Order Submitted!</div>
            <a
              href={getOrderExplorerUrl(targetChainId, orderId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#58a6ff] hover:underline"
            >
              View on CoW Explorer →
            </a>
          </div>
        )}

        {/* Error Message */}
        {tradeStatus === 'error' && tradeError && (
          <div className="bg-[#f85149]/10 border border-[#f85149]/30 rounded p-3 text-center">
            <div className="text-[#f85149] text-sm">{tradeError}</div>
          </div>
        )}

        {/* Market Order Label */}
        <div className="flex items-center justify-between text-xs">
          <span className="px-2 py-1 bg-[#30363d] rounded text-white">Market</span>
          <span className="text-gray-500">
            {isLoadingQuote ? 'Fetching price...' : 'Best available price'}
          </span>
        </div>

        {/* Available Balance */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Available</span>
          <span className="text-white">
            {isConnected ? (
              <>
                <span className={tradeType === 'buy' ? 'text-[#3fb950]' : 'text-[#f85149]'}>
                  {formatBalance(availableBalance)}
                </span>
                {' '}{availableSymbol}
              </>
            ) : (
              '--'
            )}
          </span>
        </div>

        {/* Amount Input - Pay */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-400">
              {tradeType === 'buy' ? `Pay` : `Sell`}
            </label>
            <span className="text-xs text-gray-500">
              {tradeType === 'buy' ? quoteSymbol : baseSymbol}
            </span>
          </div>
          <input
            type="text"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setQuote(null);
              setTradeStatus('idle');
            }}
            className="w-full bg-[#21262d] border border-[#30363d] rounded px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#58a6ff] focus:outline-none"
            placeholder="0.00"
            disabled={isTrading}
          />
        </div>

        {/* Slider */}
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max="100"
            value={sliderValue}
            onChange={(e) => handleSliderChange(parseInt(e.target.value))}
            className="w-full h-1 bg-[#21262d] rounded-lg appearance-none cursor-pointer slider-thumb"
            disabled={!isConnected || isTrading}
          />
          <div className="flex justify-between text-xs text-gray-400">
            {[0, 25, 50, 75, 100].map((percent) => (
              <button
                key={percent}
                onClick={() => handleSliderChange(percent)}
                className={`hover:text-white transition-colors ${
                  sliderValue === percent ? 'text-white' : ''
                }`}
                disabled={!isConnected || isTrading}
              >
                {percent}%
              </button>
            ))}
          </div>
        </div>

        {/* Estimated Output - Receive */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-400">Receive</label>
            <span className="text-xs text-gray-500">
              {tradeType === 'buy' ? baseSymbol : quoteSymbol}
            </span>
          </div>
          <div className="relative">
            <input
              type="text"
              value={estimatedOutput > 0 ? `~${formatNumber(estimatedOutput)}` : ''}
              readOnly
              className="w-full bg-[#21262d] border border-[#30363d] rounded px-3 py-2.5 text-sm text-gray-400 placeholder-gray-500"
              placeholder="0.00"
            />
            {isLoadingQuote && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Quote Error */}
        {quoteError && (
          <div className="text-xs text-[#f85149] text-center py-1">
            {quoteError}
          </div>
        )}

        {/* Price Impact / Rate */}
        {quote && !isLoadingQuote && (
          <div className="text-xs text-gray-400 bg-[#21262d] rounded px-3 py-2 space-y-1">
            <div className="flex justify-between">
              <span>Rate</span>
              <span className="text-white">
                1 {tradeType === 'buy' ? baseSymbol : quoteSymbol} = {formatNumber(amountNum / estimatedOutput)} {tradeType === 'buy' ? quoteSymbol : baseSymbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Network Fee</span>
              <span className="text-[#3fb950]">Free (CoW)</span>
            </div>
          </div>
        )}

        {/* Action Button */}
        {!isConnected ? (
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full py-3 bg-[#58a6ff] hover:bg-[#58a6ff]/80 disabled:opacity-50 text-white font-medium rounded transition-colors"
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        ) : !isCorrectChain ? (
          <button
            onClick={handleSwitchChain}
            className="w-full py-3 bg-yellow-600 hover:bg-yellow-600/80 text-white font-medium rounded transition-colors"
          >
            Switch to {chainId.charAt(0).toUpperCase() + chainId.slice(1)}
          </button>
        ) : !isSupportedChain ? (
          <div className="text-center text-yellow-500 text-sm py-3">
            Trading not available on this chain
          </div>
        ) : needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={isApproving || !quote}
            className="w-full py-3 bg-[#58a6ff] hover:bg-[#58a6ff]/80 disabled:opacity-50 text-white font-medium rounded transition-colors"
          >
            {isApproving ? 'Approving...' : `Approve ${tradeType === 'buy' ? quoteSymbol : baseSymbol}`}
          </button>
        ) : (
          <button
            onClick={handleTrade}
            disabled={!amount || parseFloat(amount) <= 0 || isLoadingQuote || isTrading || !quote}
            className={`w-full py-3 font-medium rounded transition-colors disabled:opacity-50 ${
              tradeType === 'buy'
                ? 'bg-[#3fb950] hover:bg-[#3fb950]/80 text-white'
                : 'bg-[#f85149] hover:bg-[#f85149]/80 text-white'
            }`}
          >
            {tradeStatus === 'signing' ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sign in wallet...
              </span>
            ) : tradeStatus === 'submitting' ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </span>
            ) : (
              tradeType === 'buy' ? `Buy ${baseSymbol}` : `Sell ${baseSymbol}`
            )}
          </button>
        )}
      </div>

      {/* Wallets Section */}
      {isConnected && (
        <div className="px-3 py-2 border-t border-[#30363d] flex items-center justify-between text-xs">
          <span className="text-gray-400">Wallet</span>
          <div className="flex items-center gap-2">
            <span className="text-[#58a6ff]">
              {address?.slice(0, 4)}...{address?.slice(-4)}
            </span>
            <button
              onClick={() => disconnect()}
              className="text-gray-400 hover:text-[#f85149] transition-colors"
              title="Disconnect"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Powered by CoW */}
      <div className="px-3 py-2 border-t border-[#30363d] text-center">
        <a
          href="https://cow.fi"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
        >
          Powered by CoW Protocol
        </a>
      </div>
    </div>
  );
}
