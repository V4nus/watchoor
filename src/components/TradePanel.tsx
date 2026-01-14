'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain, useBalance, useReadContract, useWriteContract, useSignTypedData, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits, erc20Abi } from 'viem';
import { CHAIN_ID_MAP } from '@/lib/wagmi';
import { formatNumber } from '@/lib/api';
import { useTranslations } from '@/lib/i18n';
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
import {
  getZeroXQuote,
  isZeroXSupported,
  selectAggregator,
  COW_MIN_TRADE_USD,
  type ZeroXQuote,
} from '@/lib/zerox';

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
type AggregatorType = 'cow' | 'zerox';

// Slippage presets in basis points (1 bp = 0.01%)
const SLIPPAGE_PRESETS = [10, 50, 100, 500]; // 0.1%, 0.5%, 1%, 5%

export default function TradePanel({
  chainId,
  baseTokenAddress,
  quoteTokenAddress,
  baseSymbol,
  quoteSymbol,
  currentPrice = 0,
  onTradeSuccess,
}: TradePanelProps) {
  const t = useTranslations();
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
  const [slippageBps, setSlippageBps] = useState(50); // Default 0.5%
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [customSlippage, setCustomSlippage] = useState('');
  const [aggregator, setAggregator] = useState<AggregatorType>('cow');
  const [zeroXQuote, setZeroXQuote] = useState<ZeroXQuote | null>(null);

  const { address, isConnected } = useAccount();
  const { connect, isPending: isConnecting, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const currentChainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();
  const { sendTransactionAsync } = useSendTransaction();

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
    if (!amountNum || amountNum <= 0 || !address) {
      setQuote(null);
      setZeroXQuote(null);
      return;
    }

    setIsLoadingQuote(true);
    setQuoteError(null);

    try {
      const sellToken = tradeType === 'buy' ? quoteTokenAddress : baseTokenAddress;
      const buyToken = tradeType === 'buy' ? baseTokenAddress : quoteTokenAddress;
      const amountWei = parseUnits(amount, inputDecimals).toString();

      // Estimate USD value of trade (rough estimate using quote token if it's a stablecoin)
      // For simplicity, assume quote token is USD-pegged or use current price
      const estimatedUsd = tradeType === 'buy' ? amountNum : amountNum * currentPrice;

      // Select aggregator based on trade size
      const selectedAggregator = selectAggregator(estimatedUsd);
      setAggregator(selectedAggregator);

      if (selectedAggregator === 'zerox' && isZeroXSupported(targetChainId)) {
        // Use 0x for small trades
        try {
          const zeroXResult = await getZeroXQuote({
            chainId: targetChainId,
            sellToken,
            buyToken,
            sellAmount: amountWei,
            takerAddress: address,
            slippageBps,
          });
          setZeroXQuote(zeroXResult);
          setQuote(null);
        } catch (zeroXError) {
          console.error('0x quote error, falling back to CoW:', zeroXError);
          // Fallback to CoW if 0x fails
          setAggregator('cow');
          if (isSupportedChain) {
            const quoteResult = await getQuote({
              chainId: targetChainId,
              sellToken,
              buyToken,
              amount: amountWei,
              kind: 'sell',
              userAddress: address,
              slippageBps,
            });
            setQuote(quoteResult);
            setZeroXQuote(null);
          }
        }
      } else if (isSupportedChain) {
        // Use CoW for larger trades
        const quoteResult = await getQuote({
          chainId: targetChainId,
          sellToken,
          buyToken,
          amount: amountWei,
          kind: 'sell',
          userAddress: address,
          slippageBps,
        });
        setQuote(quoteResult);
        setZeroXQuote(null);
      } else if (isZeroXSupported(targetChainId)) {
        // Chain not supported by CoW, try 0x
        setAggregator('zerox');
        const zeroXResult = await getZeroXQuote({
          chainId: targetChainId,
          sellToken,
          buyToken,
          sellAmount: amountWei,
          takerAddress: address,
          slippageBps,
        });
        setZeroXQuote(zeroXResult);
        setQuote(null);
      } else {
        setQuoteError(t.trade.notAvailable);
      }
    } catch (error) {
      console.error('Quote error:', error);
      // Show specific error message if available
      if (error instanceof Error) {
        setQuoteError(error.message);
      } else {
        setQuoteError(t.trade.unableGetQuote);
      }
      setQuote(null);
      setZeroXQuote(null);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [amount, address, isSupportedChain, tradeType, quoteTokenAddress, baseTokenAddress, inputDecimals, targetChainId, slippageBps, currentPrice]);

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
    : zeroXQuote
      ? parseFloat(formatUnits(BigInt(zeroXQuote.buyAmount), outputDecimals))
      : (tradeType === 'buy'
        ? (currentPrice > 0 ? amountNum / currentPrice : 0)
        : amountNum * currentPrice);

  // Check if we have any valid quote
  const hasQuote = quote !== null || zeroXQuote !== null;

  // Check if approval is needed (for CoW)
  const needsApprovalCow = !isSellTokenNative && quote && allowance !== undefined
    ? BigInt(allowance as bigint) < BigInt(quote.sellAmount)
    : false;

  // For 0x, we need to check allowance against their allowanceTarget
  // Since we'd need a separate allowance check for 0x, we'll handle it in the trade flow
  const needsApproval = aggregator === 'cow' ? needsApprovalCow : false;

  // Handle slider change
  const handleSliderChange = (percent: number) => {
    setSliderValue(percent);
    if (availableBalance > 0) {
      const maxAmount = availableBalance * percent / 100;
      setAmount(maxAmount.toFixed(6));
    }
  };

  const handleConnect = (connector: typeof connectors[0]) => {
    connect({ connector });
    setShowWalletSelector(false);
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

  // Handle 0x direct swap execution
  const handleZeroXTrade = async () => {
    if (!zeroXQuote || !address) return;

    setTradeStatus('signing');
    setTradeError(null);

    try {
      // For 0x, we need to check and approve the allowance target if selling ERC20
      if (!isSellTokenNative) {
        // Check allowance for 0x's allowance target
        // We'll need to approve if allowance is insufficient
        const allowanceTarget = zeroXQuote.allowanceTarget as `0x${string}`;

        // Simple approval flow - approve max
        setTradeStatus('submitting');
        const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

        try {
          await writeContractAsync({
            address: sellTokenAddress as `0x${string}`,
            abi: erc20Abi,
            functionName: 'approve',
            args: [allowanceTarget, maxUint256],
          });
          // Wait for approval to be mined
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (approvalError) {
          // If approval fails, it might already be approved, continue
          console.log('Approval may already exist:', approvalError);
        }
      }

      setTradeStatus('submitting');

      // Execute the swap directly on-chain
      const txHash = await sendTransactionAsync({
        to: zeroXQuote.to as `0x${string}`,
        data: zeroXQuote.data as `0x${string}`,
        value: BigInt(zeroXQuote.value || '0'),
        gas: BigInt(zeroXQuote.estimatedGas) * BigInt(120) / BigInt(100), // Add 20% buffer
      });

      setOrderId(txHash);
      setTradeStatus('pending');

      // Save trade details
      const sellAmountFormatted = formatUnits(BigInt(zeroXQuote.sellAmount), inputDecimals);
      const buyAmountFormatted = formatUnits(BigInt(zeroXQuote.buyAmount), outputDecimals);
      setTradeDetails({
        sellAmount: sellAmountFormatted,
        buyAmount: buyAmountFormatted,
        sellSymbol: tradeType === 'buy' ? quoteSymbol : baseSymbol,
        buySymbol: tradeType === 'buy' ? baseSymbol : quoteSymbol,
      });

      // For 0x, the transaction is immediate - mark as filled
      setTradeStatus('filled');
      onTradeSuccess?.(tradeType);

      // Reset form after success
      setTimeout(() => {
        setAmount('');
        setSliderValue(0);
        setZeroXQuote(null);
        setTradeStatus('idle');
        setTradeDetails(null);
      }, 5000);

    } catch (error: unknown) {
      console.error('0x trade error:', error);
      setTradeStatus('error');
      let errorMessage = t.trade.txFailed;
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      if (errorMessage.includes('User rejected') || errorMessage.includes('user rejected')) {
        setTradeError(t.trade.txCancelled);
      } else {
        setTradeError(errorMessage.length > 100 ? errorMessage.slice(0, 100) + '...' : errorMessage);
      }
    }
  };

  // Handle CoW trade execution with EIP-712 signing
  const handleCowTrade = async () => {
    if (!quote || !address) return;

    setTradeStatus('signing');
    setTradeError(null);
    setOrderId(null);

    try {
      // Create market order data with proper appData (orderClass: "market")
      // CoW Protocol requires feeAmount to be 0 (fee is included in the sell amount)
      // Set validTo to 5 minutes from now - CoW requires at least ~30s buffer
      const validTo = Math.floor(Date.now() / 1000) + 300;

      const { order: orderData, fullAppData } = await createOrderData({
        sellToken: quote.sellToken,
        buyToken: quote.buyToken,
        sellAmount: quote.sellAmount,
        buyAmount: quote.buyAmount,
        validTo,
        receiver: address,
        feeAmount: '0',
        kind: 'sell',
        slippageBps,
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

      // Poll for order execution (wait up to 5 min + buffer)
      const { filled, status } = await waitForOrderFill(targetChainId, newOrderId, {
        maxWaitMs: 310000,
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
          setTradeError(t.trade.orderExpired);
        } else if (status === 'cancelled') {
          setTradeError(t.trade.orderCancelled);
        } else {
          setTradeError(t.trade.orderNotFilled);
        }
      }

    } catch (error: unknown) {
      console.error('Trade error:', error);
      setTradeStatus('error');
      let errorMessage = t.trade.txFailed;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String((error as { message: unknown }).message);
      }
      // User-friendly error messages
      if (errorMessage.includes('User rejected') || errorMessage.includes('user rejected')) {
        setTradeError(t.trade.txCancelled);
      } else if (errorMessage.includes('InsufficientBalance')) {
        setTradeError(t.trade.insufficientBalance);
      } else if (errorMessage.includes('InsufficientAllowance')) {
        setTradeError(t.trade.notApproved);
      } else if (errorMessage.includes('QuoteNotFound') || errorMessage.includes('expired')) {
        setTradeError(t.trade.quoteExpired);
      } else if (errorMessage.includes('SellAmountDoesNotCoverFee')) {
        setTradeError(t.trade.amountTooSmall);
      } else {
        setTradeError(errorMessage.length > 100 ? errorMessage.slice(0, 100) + '...' : errorMessage);
      }
    }
  };

  // Unified trade handler - routes to appropriate aggregator
  const handleTrade = () => {
    if (aggregator === 'zerox' && zeroXQuote) {
      handleZeroXTrade();
    } else if (quote) {
      handleCowTrade();
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
      {/* Header: Swap label + settings */}
      <div className="px-3 py-2 border-b border-[#30363d] flex items-center justify-between">
        <span className="text-base font-medium">{t.trade.swap}</span>
        <div className="flex items-center gap-2 text-gray-400">
          {/* Slippage settings button */}
          <button
            onClick={() => setShowSlippageSettings(!showSlippageSettings)}
            className={`hover:text-white p-1 flex items-center gap-1 text-xs ${showSlippageSettings ? 'text-[#58a6ff]' : ''}`}
            title={t.trade.slippage}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{(slippageBps / 100).toFixed(1)}%</span>
          </button>
          {/* Refresh button */}
          <button
            onClick={fetchQuote}
            className="hover:text-white p-1"
            title={t.common.refresh}
            disabled={isLoadingQuote}
          >
            <svg className={`w-5 h-5 ${isLoadingQuote ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Slippage Settings Panel */}
      {showSlippageSettings && (
        <div className="px-3 py-3 border-b border-[#30363d] bg-[#0d1117]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">{t.trade.slippage}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Preset buttons */}
            {SLIPPAGE_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setSlippageBps(preset);
                  setCustomSlippage('');
                  setQuote(null);
                }}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  slippageBps === preset && !customSlippage
                    ? 'bg-[#58a6ff] text-white'
                    : 'bg-[#21262d] text-gray-300 hover:bg-[#30363d]'
                }`}
              >
                {preset / 100}%
              </button>
            ))}
            {/* Custom input */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={customSlippage}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  setCustomSlippage(value);
                  const numValue = parseFloat(value);
                  if (numValue > 0 && numValue <= 50) {
                    setSlippageBps(Math.round(numValue * 100));
                    setQuote(null);
                  }
                }}
                placeholder={t.trade.slippageCustom}
                className="w-full bg-[#21262d] border border-[#30363d] rounded px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:border-[#58a6ff] focus:outline-none"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
          </div>
          {slippageBps > 500 && (
            <div className="mt-2 text-xs text-yellow-500">
              High slippage may result in unfavorable trades
            </div>
          )}
        </div>
      )}

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
          {t.trade.buy}
        </button>
        <button
          onClick={() => { setTradeType('sell'); setQuote(null); setTradeStatus('idle'); }}
          className={`flex-1 py-3 text-base font-medium transition-colors ${
            tradeType === 'sell'
              ? 'bg-[#f85149]/10 text-[#f85149] border-b-2 border-[#f85149]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {t.trade.sell}
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Pending Message - Order submitted, waiting for fill */}
        {tradeStatus === 'pending' && orderId && (
          <div className="bg-[#58a6ff]/10 border border-[#58a6ff]/30 rounded p-3">
            <div className="text-[#58a6ff] text-base font-medium mb-2 text-center flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
              {t.trade.waitingExecution}
            </div>
            {tradeDetails && (
              <div className="text-sm space-y-1 mb-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">{t.trade.sell}</span>
                  <span className="text-white">{formatNumber(parseFloat(tradeDetails.sellAmount))} {tradeDetails.sellSymbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{t.trade.buy}</span>
                  <span className="text-[#58a6ff]">~{formatNumber(parseFloat(tradeDetails.buyAmount))} {tradeDetails.buySymbol}</span>
                </div>
              </div>
            )}
            <div className="text-xs text-gray-500 text-center mb-2">
              {t.trade.orderValid}
            </div>
            <a
              href={getOrderExplorerUrl(targetChainId, orderId)}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-[#58a6ff] hover:underline text-center"
            >
              {t.trade.trackOrder} →
            </a>
          </div>
        )}

        {/* Filled Message - Order successfully executed */}
        {tradeStatus === 'filled' && orderId && (
          <div className="bg-[#3fb950]/10 border border-[#3fb950]/30 rounded p-3">
            <div className="text-[#3fb950] text-base font-medium mb-2 text-center">{t.trade.tradeExecuted}</div>
            {tradeDetails && (
              <div className="text-sm space-y-1 mb-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">{t.trade.sold}</span>
                  <span className="text-white">{formatNumber(parseFloat(tradeDetails.sellAmount))} {tradeDetails.sellSymbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{t.trade.received}</span>
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
              {t.trade.viewOrder} →
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
          <span className="px-2 py-1 bg-[#30363d] rounded text-white">{t.trade.market}</span>
          <span className="text-gray-500">
            {isLoadingQuote ? t.trade.fetchingPrice : t.trade.bestPrice}
          </span>
        </div>

        {/* Amount Input - Pay */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">
              {tradeType === 'buy' ? t.trade.pay : t.trade.sell}
            </label>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-gray-500">{t.common.balance}:</span>
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
              const newAmount = e.target.value;
              setAmount(newAmount);
              setQuote(null);
              setTradeStatus('idle');
              // 同步更新滑动条百分比（基于输入数量占余额的比例）
              const numAmount = parseFloat(newAmount) || 0;
              if (availableBalance > 0 && numAmount > 0) {
                const percent = Math.min(100, Math.round((numAmount / availableBalance) * 100));
                setSliderValue(percent);
              } else {
                setSliderValue(0);
              }
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
            <label className="text-sm text-gray-400">{t.trade.receive}</label>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-gray-500">{t.common.balance}:</span>
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
        {hasQuote && !isLoadingQuote && (
          <div className="text-sm text-gray-400 bg-[#21262d] rounded px-3 py-2 space-y-1">
            <div className="flex justify-between">
              <span>{t.trade.rate}</span>
              <span className="text-white">
                1 {tradeType === 'buy' ? baseSymbol : quoteSymbol} = {formatNumber(amountNum / estimatedOutput)} {tradeType === 'buy' ? quoteSymbol : baseSymbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{t.trade.networkFee}</span>
              <span className={aggregator === 'cow' ? 'text-[#3fb950]' : 'text-gray-300'}>
                {aggregator === 'cow' ? t.trade.free : '~$0.50'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Router</span>
              <span className="text-[#58a6ff]">
                {aggregator === 'cow' ? 'CoW Protocol' : '0x API'}
              </span>
            </div>
          </div>
        )}

        {/* Action Button */}
        {!isConnected ? (
          <div className="relative">
            <button
              onClick={() => setShowWalletSelector(!showWalletSelector)}
              disabled={isConnecting}
              className="w-full py-3.5 bg-[#58a6ff] hover:bg-[#58a6ff]/80 disabled:opacity-50 text-white text-base font-medium rounded transition-colors"
            >
              {isConnecting ? t.trade.connecting : t.trade.connectWallet}
            </button>
            {showWalletSelector && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl z-50">
                <div className="p-2 border-b border-[#30363d]">
                  <span className="text-sm text-gray-400">Select Wallet</span>
                </div>
                <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                  {connectors
                    // Filter out generic "Injected" connectors
                    .filter((connector) => connector.name.toLowerCase() !== 'injected')
                    // Remove duplicates by name
                    .filter((connector, index, arr) =>
                      arr.findIndex(c => c.name === connector.name) === index
                    )
                    .map((connector) => (
                      <button
                        key={connector.uid}
                        onClick={() => handleConnect(connector)}
                        disabled={isConnecting}
                        className="w-full px-3 py-2 flex items-center gap-3 hover:bg-[#21262d] rounded transition-colors text-left"
                      >
                        <div className="w-6 h-6 rounded bg-[#30363d] flex items-center justify-center">
                          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <span className="text-sm text-white">{connector.name}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : !isCorrectChain ? (
          <button
            onClick={handleSwitchChain}
            className="w-full py-3.5 bg-yellow-600 hover:bg-yellow-600/80 text-white text-base font-medium rounded transition-colors"
          >
            {t.trade.switchTo} {chainId.charAt(0).toUpperCase() + chainId.slice(1)}
          </button>
        ) : !isSupportedChain ? (
          <div className="text-center text-yellow-500 text-base py-3">
            {t.trade.notAvailable}
          </div>
        ) : needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={isApproving || !quote}
            className="w-full py-3.5 bg-[#58a6ff] hover:bg-[#58a6ff]/80 disabled:opacity-50 text-white text-base font-medium rounded transition-colors"
          >
            {isApproving ? t.trade.approving : `${t.trade.approve} ${tradeType === 'buy' ? quoteSymbol : baseSymbol}`}
          </button>
        ) : (
          <button
            onClick={handleTrade}
            disabled={!amount || parseFloat(amount) <= 0 || isLoadingQuote || isTrading || !hasQuote}
            className={`w-full py-3.5 text-base font-medium rounded transition-colors disabled:opacity-50 ${
              tradeType === 'buy'
                ? 'bg-[#3fb950] hover:bg-[#3fb950]/80 text-white'
                : 'bg-[#f85149] hover:bg-[#f85149]/80 text-white'
            }`}
          >
            {tradeStatus === 'signing' ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t.trade.signInWallet}
              </span>
            ) : tradeStatus === 'submitting' ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t.trade.submitting}
              </span>
            ) : (
              tradeType === 'buy' ? `${t.trade.buy} ${baseSymbol}` : `${t.trade.sell} ${baseSymbol}`
            )}
          </button>
        )}
      </div>

      {/* Wallets Section */}
      {isConnected && (
        <div className="px-3 py-2 border-t border-[#30363d] flex items-center justify-between text-sm">
          <span className="text-gray-400">{t.common.wallet}</span>
          <div className="flex items-center gap-2">
            <span className="text-[#58a6ff]">
              {address?.slice(0, 4)}...{address?.slice(-4)}
            </span>
            <button
              onClick={() => disconnect()}
              className="text-gray-400 hover:text-[#f85149] transition-colors"
              title={t.common.disconnect}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Powered by aggregator */}
      <div className="px-3 py-2 border-t border-[#30363d] text-center">
        <a
          href={aggregator === 'cow' ? 'https://cow.fi' : 'https://0x.org'}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
        >
          {aggregator === 'cow' ? t.trade.poweredBy : 'Powered by 0x Protocol'}
        </a>
      </div>
    </div>
  );
}
