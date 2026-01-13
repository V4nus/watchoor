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
  waitForOrderFill,
  type QuoteResult,
  type OrderStatus,
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
  onTradeSuccess?: (tradeType: 'buy' | 'sell') => void;
}

type TradeStatus = 'idle' | 'signing' | 'submitting' | 'pending' | 'filled' | 'error';

export default function TradePanel({
  chainId,
  baseTokenAddress,
  quoteTokenAddress,
  baseSymbol,
  quoteSymbol,
  currentPrice = 0,
  onTradeSuccess,
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
  const [tradeDetails, setTradeDetails] = useState<{
    sellAmount: string;
    buyAmount: string;
    sellSymbol: string;
    buySymbol: string;
  } | null>(null);

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

  // Calculate available balance for input token (pay/sell)
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

  // Calculate output token balance (receive)
  const getOutputBalance = () => {
    if (tradeType === 'buy') {
      // Buying base token, show base balance
      if (isBaseNative) {
        return nativeBalance?.value ? parseFloat(formatUnits(nativeBalance.value, 18)) : 0;
      }
      return baseBalance ? parseFloat(formatUnits(baseBalance as bigint, (baseDecimals as number) || 18)) : 0;
    } else {
      // Selling base token, show quote balance
      if (isQuoteNative) {
        return nativeBalance?.value ? parseFloat(formatUnits(nativeBalance.value, 18)) : 0;
      }
      return quoteBalance ? parseFloat(formatUnits(quoteBalance as bigint, (quoteDecimals as number) || 6)) : 0;
    }
  };

  const availableBalance = getAvailableBalance();
  const outputBalance = getOutputBalance();

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
      // Show specific error message if available
      if (error instanceof Error) {
        setQuoteError(error.message);
      } else {
        setQuoteError('Unable to get quote');
      }
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
      // Create market order data with proper appData (orderClass: "market")
      // CoW Protocol requires feeAmount to be 0 (fee is included in the sell amount)
      // Set validTo to 60 seconds from now - order auto-expires, no manual cancellation needed
      const validTo = Math.floor(Date.now() / 1000) + 60;

      const { order: orderData, fullAppData } = await createOrderData({
        sellToken: quote.sellToken,
        buyToken: quote.buyToken,
        sellAmount: quote.sellAmount,
        buyAmount: quote.buyAmount,
        validTo,
        receiver: address,
        feeAmount: '0',
        kind: 'sell',
        slippageBps: 50, // 0.5% slippage
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

      // Submit the signed market order
      const newOrderId = await submitOrder({
        chainId: targetChainId,
        order: orderData,
        signature,
        signingScheme: 'eip712',
        from: address,
        fullAppData, // Include appData for market order classification
      });

      setOrderId(newOrderId);
      setTradeStatus('pending');

      // Save trade details for display
      const sellAmountFormatted = formatUnits(BigInt(quote.sellAmount), inputDecimals);
      const buyAmountFormatted = formatUnits(BigInt(quote.buyAmount), outputDecimals);
      setTradeDetails({
        sellAmount: sellAmountFormatted,
        buyAmount: buyAmountFormatted,
        sellSymbol: tradeType === 'buy' ? quoteSymbol : baseSymbol,
        buySymbol: tradeType === 'buy' ? baseSymbol : quoteSymbol,
      });

      // Poll for order execution (wait up to 65s - slightly longer than validTo to catch expiry)
      const { filled, status } = await waitForOrderFill(targetChainId, newOrderId, {
        maxWaitMs: 65000,
        pollIntervalMs: 2000,
        onStatusChange: (newStatus) => {
          console.log('Order status changed:', newStatus);
        },
      });

      if (filled) {
        setTradeStatus('filled');
        // Trigger chart beam effect only when actually filled!
        onTradeSuccess?.(tradeType);

        // Reset form after success
        setTimeout(() => {
          setAmount('');
          setSliderValue(0);
          setQuote(null);
          setTradeStatus('idle');
          setTradeDetails(null);
        }, 5000);
      } else {
        // Order not filled (cancelled, expired, or timeout)
        console.log('Order not filled, status:', status);
        setTradeStatus('error');
        if (status === 'expired') {
          setTradeError('Order expired (60s timeout)');
        } else if (status === 'cancelled') {
          setTradeError('Order was cancelled');
        } else {
          setTradeError('Order not filled - please try again');
        }
      }

    } catch (error: unknown) {
      console.error('Trade error:', error);
      setTradeStatus('error');
      let errorMessage = 'Transaction failed';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String((error as { message: unknown }).message);
      }
      // User-friendly error messages
      if (errorMessage.includes('User rejected') || errorMessage.includes('user rejected')) {
        setTradeError('Transaction cancelled');
      } else if (errorMessage.includes('InsufficientBalance')) {
        setTradeError('Insufficient balance');
      } else if (errorMessage.includes('InsufficientAllowance')) {
        setTradeError('Token not approved');
      } else if (errorMessage.includes('QuoteNotFound') || errorMessage.includes('expired')) {
        setTradeError('Quote expired, please try again');
      } else if (errorMessage.includes('SellAmountDoesNotCoverFee')) {
        setTradeError('Amount too small to cover fees');
      } else {
        setTradeError(errorMessage.length > 100 ? errorMessage.slice(0, 100) + '...' : errorMessage);
      }
    }
  };

  const formatBalance = (value: number) => {
    if (value === 0) return '0';
    if (value < 0.0001) return '<0.0001';
    if (value < 1) return value.toFixed(6);
    return formatNumber(value);
  };

  const isTrading = tradeStatus === 'signing' || tradeStatus === 'submitting' || tradeStatus === 'pending';

  return (
    <div className="bg-[#161b22] rounded-lg border border-[#30363d] overflow-hidden relative">
      {/* Header: Swap label + refresh */}
      <div className="px-3 py-2 border-b border-[#30363d] flex items-center justify-between">
        <span className="text-base font-medium">Swap</span>
        <div className="flex items-center gap-2 text-gray-400">
          <button
            onClick={fetchQuote}
            className="hover:text-white p-1"
            title="Refresh quote"
            disabled={isLoadingQuote}
          >
            <svg className={`w-5 h-5 ${isLoadingQuote ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Buy/Sell Toggle */}
      <div className="flex border-b border-[#30363d]">
        <button
          onClick={() => { setTradeType('buy'); setQuote(null); setTradeStatus('idle'); }}
          className={`flex-1 py-3 text-base font-medium transition-colors ${
            tradeType === 'buy'
              ? 'bg-[#3fb950]/10 text-[#3fb950] border-b-2 border-[#3fb950]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => { setTradeType('sell'); setQuote(null); setTradeStatus('idle'); }}
          className={`flex-1 py-3 text-base font-medium transition-colors ${
            tradeType === 'sell'
              ? 'bg-[#f85149]/10 text-[#f85149] border-b-2 border-[#f85149]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Sell
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Pending Message - Order submitted, waiting for fill */}
        {tradeStatus === 'pending' && orderId && (
          <div className="bg-[#58a6ff]/10 border border-[#58a6ff]/30 rounded p-3">
            <div className="text-[#58a6ff] text-base font-medium mb-2 text-center flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
              Waiting for execution...
            </div>
            {tradeDetails && (
              <div className="text-sm space-y-1 mb-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Sell</span>
                  <span className="text-white">{formatNumber(parseFloat(tradeDetails.sellAmount))} {tradeDetails.sellSymbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Buy</span>
                  <span className="text-[#58a6ff]">~{formatNumber(parseFloat(tradeDetails.buyAmount))} {tradeDetails.buySymbol}</span>
                </div>
              </div>
            )}
            <div className="text-xs text-gray-500 text-center mb-2">
              Order valid for 60s • Auto-expires if not filled
            </div>
            <a
              href={getOrderExplorerUrl(targetChainId, orderId)}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-[#58a6ff] hover:underline text-center"
            >
              Track order on CoW Explorer →
            </a>
          </div>
        )}

        {/* Filled Message - Order successfully executed */}
        {tradeStatus === 'filled' && orderId && (
          <div className="bg-[#3fb950]/10 border border-[#3fb950]/30 rounded p-3">
            <div className="text-[#3fb950] text-base font-medium mb-2 text-center">Trade Executed!</div>
            {tradeDetails && (
              <div className="text-sm space-y-1 mb-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Sold</span>
                  <span className="text-white">{formatNumber(parseFloat(tradeDetails.sellAmount))} {tradeDetails.sellSymbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Received</span>
                  <span className="text-[#3fb950]">{formatNumber(parseFloat(tradeDetails.buyAmount))} {tradeDetails.buySymbol}</span>
                </div>
              </div>
            )}
            <a
              href={getOrderExplorerUrl(targetChainId, orderId)}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-[#58a6ff] hover:underline text-center"
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
        <div className="flex items-center justify-between text-sm">
          <span className="px-2 py-1 bg-[#30363d] rounded text-white">Market</span>
          <span className="text-gray-500">
            {isLoadingQuote ? 'Fetching price...' : 'Best available price'}
          </span>
        </div>

        {/* Amount Input - Pay */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">
              {tradeType === 'buy' ? `Pay` : `Sell`}
            </label>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-gray-500">Balance:</span>
              <span className={tradeType === 'buy' ? 'text-[#3fb950]' : 'text-[#f85149]'}>
                {isConnected ? formatBalance(availableBalance) : '--'}
              </span>
              <span className="text-gray-500">{tradeType === 'buy' ? quoteSymbol : baseSymbol}</span>
            </div>
          </div>
          <input
            type="text"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setQuote(null);
              setTradeStatus('idle');
            }}
            className="w-full bg-[#21262d] border border-[#30363d] rounded px-3 py-3 text-base text-white placeholder-gray-500 focus:border-[#58a6ff] focus:outline-none"
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
            className="w-full h-1.5 bg-[#21262d] rounded-lg appearance-none cursor-pointer slider-thumb"
            disabled={!isConnected || isTrading}
          />
          <div className="flex justify-between text-sm text-gray-400">
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
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">Receive</label>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-gray-500">Balance:</span>
              <span className="text-white">
                {isConnected ? formatBalance(outputBalance) : '--'}
              </span>
              <span className="text-gray-500">{tradeType === 'buy' ? baseSymbol : quoteSymbol}</span>
            </div>
          </div>
          <div className="relative">
            <input
              type="text"
              value={estimatedOutput > 0 ? `~${formatNumber(estimatedOutput)}` : ''}
              readOnly
              className="w-full bg-[#21262d] border border-[#30363d] rounded px-3 py-3 text-base text-gray-400 placeholder-gray-500"
              placeholder="0.00"
            />
            {isLoadingQuote && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Quote Error */}
        {quoteError && (
          <div className="text-sm text-[#f85149] text-center py-1">
            {quoteError}
          </div>
        )}

        {/* Price Impact / Rate */}
        {quote && !isLoadingQuote && (
          <div className="text-sm text-gray-400 bg-[#21262d] rounded px-3 py-2 space-y-1">
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
            className="w-full py-3.5 bg-[#58a6ff] hover:bg-[#58a6ff]/80 disabled:opacity-50 text-white text-base font-medium rounded transition-colors"
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        ) : !isCorrectChain ? (
          <button
            onClick={handleSwitchChain}
            className="w-full py-3.5 bg-yellow-600 hover:bg-yellow-600/80 text-white text-base font-medium rounded transition-colors"
          >
            Switch to {chainId.charAt(0).toUpperCase() + chainId.slice(1)}
          </button>
        ) : !isSupportedChain ? (
          <div className="text-center text-yellow-500 text-base py-3">
            Trading not available on this chain
          </div>
        ) : needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={isApproving || !quote}
            className="w-full py-3.5 bg-[#58a6ff] hover:bg-[#58a6ff]/80 disabled:opacity-50 text-white text-base font-medium rounded transition-colors"
          >
            {isApproving ? 'Approving...' : `Approve ${tradeType === 'buy' ? quoteSymbol : baseSymbol}`}
          </button>
        ) : (
          <button
            onClick={handleTrade}
            disabled={!amount || parseFloat(amount) <= 0 || isLoadingQuote || isTrading || !quote}
            className={`w-full py-3.5 text-base font-medium rounded transition-colors disabled:opacity-50 ${
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
        <div className="px-3 py-2 border-t border-[#30363d] flex items-center justify-between text-sm">
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
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
