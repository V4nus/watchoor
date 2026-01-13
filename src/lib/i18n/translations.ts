// 翻译文件 - 支持中文/英文
export type Language = 'en' | 'zh';

export interface Translations {
  // Common
  common: {
    loading: string;
    error: string;
    noData: string;
    refresh: string;
    copy: string;
    copied: string;
    wallet: string;
    balance: string;
    price: string;
    volume: string;
    liquidity: string;
    time: string;
    disconnect: string;
    connect: string;
  };

  // Home page
  home: {
    tagline: string;
    title1: string;
    title2: string;
    subtitle: string;
    searchPlaceholder: string;
    chains: string;
    pools: string;
    latency: string;
  };

  // Trade Panel
  trade: {
    swap: string;
    buy: string;
    sell: string;
    market: string;
    bestPrice: string;
    fetchingPrice: string;
    pay: string;
    receive: string;
    rate: string;
    networkFee: string;
    free: string;
    connectWallet: string;
    connecting: string;
    switchTo: string;
    notAvailable: string;
    approve: string;
    approving: string;
    signInWallet: string;
    submitting: string;
    waitingExecution: string;
    tradeExecuted: string;
    sold: string;
    received: string;
    orderValid: string;
    trackOrder: string;
    viewOrder: string;
    poweredBy: string;
    // Slippage
    slippage: string;
    slippageAuto: string;
    slippageCustom: string;
    // Errors
    txCancelled: string;
    insufficientBalance: string;
    notApproved: string;
    quoteExpired: string;
    amountTooSmall: string;
    orderExpired: string;
    orderCancelled: string;
    orderNotFilled: string;
    txFailed: string;
    unableGetQuote: string;
  };

  // Trade History
  tradeHistory: {
    title: string;
    trades: string;
    noTrades: string;
    loadingTrades: string;
    recentVolume: string;
    tx: string;
  };

  // Pool Stats
  pool: {
    volume24h: string;
    liquidity: string;
    buys24h: string;
    sells24h: string;
    poolAddress: string;
  };

  // Search
  search: {
    placeholder: string;
    noResults: string;
    vol: string;
    batchHint: string;
    searching: string;
  };

  // Chart
  chart: {
    orderBook: string;
    depth: string;
    bids: string;
    asks: string;
  };

  // Favorites
  favorites: {
    title: string;
    empty: string;
    remove: string;
    add: string;
  };
}

export const translations: Record<Language, Translations> = {
  en: {
    common: {
      loading: 'Loading...',
      error: 'Error',
      noData: 'No data',
      refresh: 'Refresh',
      copy: 'Copy',
      copied: 'Copied!',
      wallet: 'Wallet',
      balance: 'Balance',
      price: 'Price',
      volume: 'Volume',
      liquidity: 'Liquidity',
      time: 'Time',
      disconnect: 'Disconnect',
      connect: 'Connect',
    },
    home: {
      tagline: 'Live On-Chain Analytics',
      title1: 'Decode',
      title2: 'Order Flow',
      subtitle: 'Transform any AMM liquidity into real-time order book depth. See hidden support and resistance across all DEX pools.',
      searchPlaceholder: 'Search by token name, symbol, or pool address...',
      chains: 'Chains',
      pools: 'Pools',
      latency: 'Latency',
    },
    trade: {
      swap: 'Swap',
      buy: 'Buy',
      sell: 'Sell',
      market: 'Market',
      bestPrice: 'Best available price',
      fetchingPrice: 'Fetching price...',
      pay: 'Pay',
      receive: 'Receive',
      rate: 'Rate',
      networkFee: 'Network Fee',
      free: 'Free (CoW)',
      connectWallet: 'Connect Wallet',
      connecting: 'Connecting...',
      switchTo: 'Switch to',
      notAvailable: 'Trading not available on this chain',
      approve: 'Approve',
      approving: 'Approving...',
      signInWallet: 'Sign in wallet...',
      submitting: 'Submitting...',
      waitingExecution: 'Waiting for execution...',
      tradeExecuted: 'Trade Executed!',
      sold: 'Sold',
      received: 'Received',
      orderValid: 'Order valid for 5 min',
      trackOrder: 'Track order on CoW Explorer',
      viewOrder: 'View on CoW Explorer',
      poweredBy: 'Powered by CoW Protocol',
      slippage: 'Slippage',
      slippageAuto: 'Auto',
      slippageCustom: 'Custom',
      txCancelled: 'Transaction cancelled',
      insufficientBalance: 'Insufficient balance',
      notApproved: 'Token not approved',
      quoteExpired: 'Quote expired, please try again',
      amountTooSmall: 'Amount too small to cover fees',
      orderExpired: 'Order expired (5 min timeout)',
      orderCancelled: 'Order was cancelled',
      orderNotFilled: 'Order not filled - please try again',
      txFailed: 'Transaction failed',
      unableGetQuote: 'Unable to get quote',
    },
    tradeHistory: {
      title: 'Trade History',
      trades: 'trades',
      noTrades: 'No trades yet',
      loadingTrades: 'Loading trades...',
      recentVolume: 'Recent Volume',
      tx: 'tx',
    },
    pool: {
      volume24h: '24h Volume',
      liquidity: 'Liquidity',
      buys24h: '24h Buys',
      sells24h: '24h Sells',
      poolAddress: 'Pool Address',
    },
    search: {
      placeholder: 'Search by token name, symbol, or pool address...',
      noResults: 'No pools found for',
      vol: 'Vol',
      batchHint: 'Tip: Enter multiple tokens separated by commas for batch search',
      searching: 'Searching',
    },
    chart: {
      orderBook: 'Order Book',
      depth: 'Depth',
      bids: 'Bids',
      asks: 'Asks',
    },
    favorites: {
      title: 'Favorites',
      empty: 'No favorites yet',
      remove: 'Remove from favorites',
      add: 'Add to favorites',
    },
  },
  zh: {
    common: {
      loading: '加载中...',
      error: '错误',
      noData: '暂无数据',
      refresh: '刷新',
      copy: '复制',
      copied: '已复制!',
      wallet: '钱包',
      balance: '余额',
      price: '价格',
      volume: '成交量',
      liquidity: '流动性',
      time: '时间',
      disconnect: '断开连接',
      connect: '连接',
    },
    home: {
      tagline: '实时链上分析',
      title1: '解析',
      title2: '订单流',
      subtitle: '将任意AMM流动性转换为实时订单簿深度。发现所有DEX池的隐藏支撑和阻力位。',
      searchPlaceholder: '搜索代币名称、符号或池地址...',
      chains: '链',
      pools: '交易池',
      latency: '延迟',
    },
    trade: {
      swap: '兑换',
      buy: '买入',
      sell: '卖出',
      market: '市价',
      bestPrice: '最优价格',
      fetchingPrice: '获取价格中...',
      pay: '支付',
      receive: '接收',
      rate: '汇率',
      networkFee: '网络费用',
      free: '免费 (CoW)',
      connectWallet: '连接钱包',
      connecting: '连接中...',
      switchTo: '切换至',
      notAvailable: '此链暂不支持交易',
      approve: '授权',
      approving: '授权中...',
      signInWallet: '钱包签名中...',
      submitting: '提交中...',
      waitingExecution: '等待执行...',
      tradeExecuted: '交易完成!',
      sold: '卖出',
      received: '收到',
      orderValid: '订单有效期5分钟',
      trackOrder: '在CoW Explorer追踪订单',
      viewOrder: '在CoW Explorer查看',
      poweredBy: 'Powered by CoW Protocol',
      slippage: '滑点',
      slippageAuto: '自动',
      slippageCustom: '自定义',
      txCancelled: '交易已取消',
      insufficientBalance: '余额不足',
      notApproved: '代币未授权',
      quoteExpired: '报价已过期，请重试',
      amountTooSmall: '金额过小，无法覆盖手续费',
      orderExpired: '订单已过期（5分钟超时）',
      orderCancelled: '订单已被取消',
      orderNotFilled: '订单未成交 - 请重试',
      txFailed: '交易失败',
      unableGetQuote: '无法获取报价',
    },
    tradeHistory: {
      title: '交易历史',
      trades: '笔交易',
      noTrades: '暂无交易',
      loadingTrades: '加载交易中...',
      recentVolume: '近期成交额',
      tx: '详情',
    },
    pool: {
      volume24h: '24小时交易量',
      liquidity: '流动性',
      buys24h: '24小时买入',
      sells24h: '24小时卖出',
      poolAddress: '池地址',
    },
    search: {
      placeholder: '搜索代币名称、符号或池地址...',
      noResults: '未找到相关交易池',
      vol: '成交量',
      batchHint: '提示：用逗号分隔多个代币可进行批量搜索',
      searching: '搜索中',
    },
    chart: {
      orderBook: '订单簿',
      depth: '深度图',
      bids: '买盘',
      asks: '卖盘',
    },
    favorites: {
      title: '收藏',
      empty: '暂无收藏',
      remove: '取消收藏',
      add: '添加收藏',
    },
  },
};
