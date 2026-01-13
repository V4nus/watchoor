// Translation file - Multi-language support
export type Language = 'en' | 'ko' | 'ja' | 'es' | 'pt' | 'ru';

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
  // English
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

  // Korean
  ko: {
    common: {
      loading: '로딩 중...',
      error: '오류',
      noData: '데이터 없음',
      refresh: '새로고침',
      copy: '복사',
      copied: '복사됨!',
      wallet: '지갑',
      balance: '잔액',
      price: '가격',
      volume: '거래량',
      liquidity: '유동성',
      time: '시간',
      disconnect: '연결 해제',
      connect: '연결',
    },
    home: {
      tagline: '실시간 온체인 분석',
      title1: '디코드',
      title2: '주문 흐름',
      subtitle: 'AMM 유동성을 실시간 주문장 깊이로 변환합니다. 모든 DEX 풀에서 숨겨진 지지/저항을 확인하세요.',
      searchPlaceholder: '토큰 이름, 심볼 또는 풀 주소로 검색...',
      chains: '체인',
      pools: '풀',
      latency: '지연시간',
    },
    trade: {
      swap: '스왑',
      buy: '매수',
      sell: '매도',
      market: '시장가',
      bestPrice: '최적가',
      fetchingPrice: '가격 조회 중...',
      pay: '지불',
      receive: '수령',
      rate: '환율',
      networkFee: '네트워크 수수료',
      free: '무료 (CoW)',
      connectWallet: '지갑 연결',
      connecting: '연결 중...',
      switchTo: '전환',
      notAvailable: '이 체인에서는 거래를 지원하지 않습니다',
      approve: '승인',
      approving: '승인 중...',
      signInWallet: '지갑에서 서명하세요...',
      submitting: '제출 중...',
      waitingExecution: '실행 대기 중...',
      tradeExecuted: '거래 완료!',
      sold: '매도',
      received: '수령',
      orderValid: '주문 유효시간 5분',
      trackOrder: 'CoW Explorer에서 주문 추적',
      viewOrder: 'CoW Explorer에서 보기',
      poweredBy: 'Powered by CoW Protocol',
      slippage: '슬리피지',
      slippageAuto: '자동',
      slippageCustom: '직접 설정',
      txCancelled: '거래 취소됨',
      insufficientBalance: '잔액 부족',
      notApproved: '토큰 미승인',
      quoteExpired: '견적 만료, 다시 시도하세요',
      amountTooSmall: '금액이 수수료를 충당하기에 너무 작습니다',
      orderExpired: '주문 만료 (5분 시간 초과)',
      orderCancelled: '주문이 취소되었습니다',
      orderNotFilled: '주문 미체결 - 다시 시도하세요',
      txFailed: '거래 실패',
      unableGetQuote: '견적을 가져올 수 없습니다',
    },
    tradeHistory: {
      title: '거래 내역',
      trades: '거래',
      noTrades: '거래 없음',
      loadingTrades: '거래 로딩 중...',
      recentVolume: '최근 거래량',
      tx: 'tx',
    },
    pool: {
      volume24h: '24시간 거래량',
      liquidity: '유동성',
      buys24h: '24시간 매수',
      sells24h: '24시간 매도',
      poolAddress: '풀 주소',
    },
    search: {
      placeholder: '토큰 이름, 심볼 또는 풀 주소로 검색...',
      noResults: '풀을 찾을 수 없습니다',
      vol: '거래량',
      batchHint: '팁: 쉼표로 구분하여 여러 토큰을 일괄 검색할 수 있습니다',
      searching: '검색 중',
    },
    chart: {
      orderBook: '주문장',
      depth: '깊이',
      bids: '매수',
      asks: '매도',
    },
    favorites: {
      title: '즐겨찾기',
      empty: '즐겨찾기 없음',
      remove: '즐겨찾기 제거',
      add: '즐겨찾기 추가',
    },
  },

  // Japanese
  ja: {
    common: {
      loading: '読み込み中...',
      error: 'エラー',
      noData: 'データなし',
      refresh: '更新',
      copy: 'コピー',
      copied: 'コピーしました！',
      wallet: 'ウォレット',
      balance: '残高',
      price: '価格',
      volume: '取引量',
      liquidity: '流動性',
      time: '時間',
      disconnect: '切断',
      connect: '接続',
    },
    home: {
      tagline: 'リアルタイムオンチェーン分析',
      title1: 'デコード',
      title2: 'オーダーフロー',
      subtitle: 'AMM流動性をリアルタイムオーダーブックに変換。すべてのDEXプールで隠れたサポートとレジスタンスを確認。',
      searchPlaceholder: 'トークン名、シンボル、プールアドレスで検索...',
      chains: 'チェーン',
      pools: 'プール',
      latency: 'レイテンシ',
    },
    trade: {
      swap: 'スワップ',
      buy: '購入',
      sell: '売却',
      market: '成行',
      bestPrice: '最良価格',
      fetchingPrice: '価格取得中...',
      pay: '支払い',
      receive: '受取',
      rate: 'レート',
      networkFee: 'ネットワーク手数料',
      free: '無料 (CoW)',
      connectWallet: 'ウォレット接続',
      connecting: '接続中...',
      switchTo: '切り替え',
      notAvailable: 'このチェーンでは取引できません',
      approve: '承認',
      approving: '承認中...',
      signInWallet: 'ウォレットで署名してください...',
      submitting: '送信中...',
      waitingExecution: '実行待ち...',
      tradeExecuted: '取引完了！',
      sold: '売却',
      received: '受取',
      orderValid: '注文有効期限 5分',
      trackOrder: 'CoW Explorerで注文を追跡',
      viewOrder: 'CoW Explorerで表示',
      poweredBy: 'Powered by CoW Protocol',
      slippage: 'スリッページ',
      slippageAuto: '自動',
      slippageCustom: 'カスタム',
      txCancelled: '取引がキャンセルされました',
      insufficientBalance: '残高不足',
      notApproved: 'トークン未承認',
      quoteExpired: '見積期限切れ、再試行してください',
      amountTooSmall: '手数料を賄うには金額が少なすぎます',
      orderExpired: '注文期限切れ（5分タイムアウト）',
      orderCancelled: '注文がキャンセルされました',
      orderNotFilled: '注文未約定 - 再試行してください',
      txFailed: '取引失敗',
      unableGetQuote: '見積を取得できません',
    },
    tradeHistory: {
      title: '取引履歴',
      trades: '取引',
      noTrades: '取引なし',
      loadingTrades: '取引を読み込み中...',
      recentVolume: '最近の取引量',
      tx: 'tx',
    },
    pool: {
      volume24h: '24時間取引量',
      liquidity: '流動性',
      buys24h: '24時間購入',
      sells24h: '24時間売却',
      poolAddress: 'プールアドレス',
    },
    search: {
      placeholder: 'トークン名、シンボル、プールアドレスで検索...',
      noResults: 'プールが見つかりません',
      vol: '取引量',
      batchHint: 'ヒント: カンマ区切りで複数トークンを一括検索できます',
      searching: '検索中',
    },
    chart: {
      orderBook: 'オーダーブック',
      depth: '深度',
      bids: '買い',
      asks: '売り',
    },
    favorites: {
      title: 'お気に入り',
      empty: 'お気に入りなし',
      remove: 'お気に入りから削除',
      add: 'お気に入りに追加',
    },
  },

  // Spanish
  es: {
    common: {
      loading: 'Cargando...',
      error: 'Error',
      noData: 'Sin datos',
      refresh: 'Actualizar',
      copy: 'Copiar',
      copied: '¡Copiado!',
      wallet: 'Cartera',
      balance: 'Saldo',
      price: 'Precio',
      volume: 'Volumen',
      liquidity: 'Liquidez',
      time: 'Hora',
      disconnect: 'Desconectar',
      connect: 'Conectar',
    },
    home: {
      tagline: 'Análisis On-Chain en Vivo',
      title1: 'Decodifica',
      title2: 'Flujo de Órdenes',
      subtitle: 'Transforma la liquidez de AMM en profundidad de libro de órdenes en tiempo real. Ve soporte y resistencia ocultos en todos los pools DEX.',
      searchPlaceholder: 'Buscar por nombre de token, símbolo o dirección del pool...',
      chains: 'Cadenas',
      pools: 'Pools',
      latency: 'Latencia',
    },
    trade: {
      swap: 'Intercambiar',
      buy: 'Comprar',
      sell: 'Vender',
      market: 'Mercado',
      bestPrice: 'Mejor precio disponible',
      fetchingPrice: 'Obteniendo precio...',
      pay: 'Pagar',
      receive: 'Recibir',
      rate: 'Tasa',
      networkFee: 'Comisión de Red',
      free: 'Gratis (CoW)',
      connectWallet: 'Conectar Cartera',
      connecting: 'Conectando...',
      switchTo: 'Cambiar a',
      notAvailable: 'Trading no disponible en esta cadena',
      approve: 'Aprobar',
      approving: 'Aprobando...',
      signInWallet: 'Firmar en cartera...',
      submitting: 'Enviando...',
      waitingExecution: 'Esperando ejecución...',
      tradeExecuted: '¡Operación Ejecutada!',
      sold: 'Vendido',
      received: 'Recibido',
      orderValid: 'Orden válida por 5 min',
      trackOrder: 'Rastrear orden en CoW Explorer',
      viewOrder: 'Ver en CoW Explorer',
      poweredBy: 'Powered by CoW Protocol',
      slippage: 'Deslizamiento',
      slippageAuto: 'Auto',
      slippageCustom: 'Personalizado',
      txCancelled: 'Transacción cancelada',
      insufficientBalance: 'Saldo insuficiente',
      notApproved: 'Token no aprobado',
      quoteExpired: 'Cotización expirada, intente de nuevo',
      amountTooSmall: 'Cantidad muy pequeña para cubrir comisiones',
      orderExpired: 'Orden expirada (tiempo límite 5 min)',
      orderCancelled: 'La orden fue cancelada',
      orderNotFilled: 'Orden no ejecutada - intente de nuevo',
      txFailed: 'Transacción fallida',
      unableGetQuote: 'No se puede obtener cotización',
    },
    tradeHistory: {
      title: 'Historial de Trading',
      trades: 'operaciones',
      noTrades: 'Sin operaciones',
      loadingTrades: 'Cargando operaciones...',
      recentVolume: 'Volumen Reciente',
      tx: 'tx',
    },
    pool: {
      volume24h: 'Volumen 24h',
      liquidity: 'Liquidez',
      buys24h: 'Compras 24h',
      sells24h: 'Ventas 24h',
      poolAddress: 'Dirección del Pool',
    },
    search: {
      placeholder: 'Buscar por nombre de token, símbolo o dirección del pool...',
      noResults: 'No se encontraron pools para',
      vol: 'Vol',
      batchHint: 'Consejo: Ingrese múltiples tokens separados por comas para búsqueda masiva',
      searching: 'Buscando',
    },
    chart: {
      orderBook: 'Libro de Órdenes',
      depth: 'Profundidad',
      bids: 'Compras',
      asks: 'Ventas',
    },
    favorites: {
      title: 'Favoritos',
      empty: 'Sin favoritos',
      remove: 'Quitar de favoritos',
      add: 'Agregar a favoritos',
    },
  },

  // Portuguese
  pt: {
    common: {
      loading: 'Carregando...',
      error: 'Erro',
      noData: 'Sem dados',
      refresh: 'Atualizar',
      copy: 'Copiar',
      copied: 'Copiado!',
      wallet: 'Carteira',
      balance: 'Saldo',
      price: 'Preço',
      volume: 'Volume',
      liquidity: 'Liquidez',
      time: 'Hora',
      disconnect: 'Desconectar',
      connect: 'Conectar',
    },
    home: {
      tagline: 'Análise On-Chain ao Vivo',
      title1: 'Decodifique',
      title2: 'Fluxo de Ordens',
      subtitle: 'Transforme a liquidez AMM em profundidade de livro de ordens em tempo real. Veja suporte e resistência ocultos em todos os pools DEX.',
      searchPlaceholder: 'Pesquisar por nome de token, símbolo ou endereço do pool...',
      chains: 'Redes',
      pools: 'Pools',
      latency: 'Latência',
    },
    trade: {
      swap: 'Trocar',
      buy: 'Comprar',
      sell: 'Vender',
      market: 'Mercado',
      bestPrice: 'Melhor preço disponível',
      fetchingPrice: 'Obtendo preço...',
      pay: 'Pagar',
      receive: 'Receber',
      rate: 'Taxa',
      networkFee: 'Taxa de Rede',
      free: 'Grátis (CoW)',
      connectWallet: 'Conectar Carteira',
      connecting: 'Conectando...',
      switchTo: 'Mudar para',
      notAvailable: 'Trading não disponível nesta rede',
      approve: 'Aprovar',
      approving: 'Aprovando...',
      signInWallet: 'Assinar na carteira...',
      submitting: 'Enviando...',
      waitingExecution: 'Aguardando execução...',
      tradeExecuted: 'Trade Executado!',
      sold: 'Vendido',
      received: 'Recebido',
      orderValid: 'Ordem válida por 5 min',
      trackOrder: 'Rastrear ordem no CoW Explorer',
      viewOrder: 'Ver no CoW Explorer',
      poweredBy: 'Powered by CoW Protocol',
      slippage: 'Slippage',
      slippageAuto: 'Auto',
      slippageCustom: 'Personalizado',
      txCancelled: 'Transação cancelada',
      insufficientBalance: 'Saldo insuficiente',
      notApproved: 'Token não aprovado',
      quoteExpired: 'Cotação expirada, tente novamente',
      amountTooSmall: 'Valor muito pequeno para cobrir taxas',
      orderExpired: 'Ordem expirada (tempo limite 5 min)',
      orderCancelled: 'A ordem foi cancelada',
      orderNotFilled: 'Ordem não executada - tente novamente',
      txFailed: 'Transação falhou',
      unableGetQuote: 'Não foi possível obter cotação',
    },
    tradeHistory: {
      title: 'Histórico de Trading',
      trades: 'trades',
      noTrades: 'Sem trades',
      loadingTrades: 'Carregando trades...',
      recentVolume: 'Volume Recente',
      tx: 'tx',
    },
    pool: {
      volume24h: 'Volume 24h',
      liquidity: 'Liquidez',
      buys24h: 'Compras 24h',
      sells24h: 'Vendas 24h',
      poolAddress: 'Endereço do Pool',
    },
    search: {
      placeholder: 'Pesquisar por nome de token, símbolo ou endereço do pool...',
      noResults: 'Nenhum pool encontrado para',
      vol: 'Vol',
      batchHint: 'Dica: Insira múltiplos tokens separados por vírgulas para pesquisa em lote',
      searching: 'Pesquisando',
    },
    chart: {
      orderBook: 'Livro de Ordens',
      depth: 'Profundidade',
      bids: 'Compras',
      asks: 'Vendas',
    },
    favorites: {
      title: 'Favoritos',
      empty: 'Sem favoritos',
      remove: 'Remover dos favoritos',
      add: 'Adicionar aos favoritos',
    },
  },

  // Russian
  ru: {
    common: {
      loading: 'Загрузка...',
      error: 'Ошибка',
      noData: 'Нет данных',
      refresh: 'Обновить',
      copy: 'Копировать',
      copied: 'Скопировано!',
      wallet: 'Кошелек',
      balance: 'Баланс',
      price: 'Цена',
      volume: 'Объем',
      liquidity: 'Ликвидность',
      time: 'Время',
      disconnect: 'Отключить',
      connect: 'Подключить',
    },
    home: {
      tagline: 'Анализ On-Chain в реальном времени',
      title1: 'Декодируй',
      title2: 'Поток Ордеров',
      subtitle: 'Преобразуйте ликвидность AMM в глубину книги ордеров в реальном времени. Увидьте скрытые уровни поддержки и сопротивления во всех DEX пулах.',
      searchPlaceholder: 'Поиск по названию токена, символу или адресу пула...',
      chains: 'Сети',
      pools: 'Пулы',
      latency: 'Задержка',
    },
    trade: {
      swap: 'Обмен',
      buy: 'Купить',
      sell: 'Продать',
      market: 'Рыночная',
      bestPrice: 'Лучшая доступная цена',
      fetchingPrice: 'Получение цены...',
      pay: 'Оплата',
      receive: 'Получить',
      rate: 'Курс',
      networkFee: 'Комиссия сети',
      free: 'Бесплатно (CoW)',
      connectWallet: 'Подключить кошелек',
      connecting: 'Подключение...',
      switchTo: 'Переключить на',
      notAvailable: 'Торговля недоступна в этой сети',
      approve: 'Одобрить',
      approving: 'Одобрение...',
      signInWallet: 'Подпишите в кошельке...',
      submitting: 'Отправка...',
      waitingExecution: 'Ожидание исполнения...',
      tradeExecuted: 'Сделка выполнена!',
      sold: 'Продано',
      received: 'Получено',
      orderValid: 'Ордер действителен 5 мин',
      trackOrder: 'Отследить ордер на CoW Explorer',
      viewOrder: 'Смотреть на CoW Explorer',
      poweredBy: 'Powered by CoW Protocol',
      slippage: 'Проскальзывание',
      slippageAuto: 'Авто',
      slippageCustom: 'Вручную',
      txCancelled: 'Транзакция отменена',
      insufficientBalance: 'Недостаточный баланс',
      notApproved: 'Токен не одобрен',
      quoteExpired: 'Котировка истекла, попробуйте снова',
      amountTooSmall: 'Сумма слишком мала для покрытия комиссий',
      orderExpired: 'Ордер истек (тайм-аут 5 мин)',
      orderCancelled: 'Ордер был отменен',
      orderNotFilled: 'Ордер не исполнен - попробуйте снова',
      txFailed: 'Транзакция не удалась',
      unableGetQuote: 'Не удается получить котировку',
    },
    tradeHistory: {
      title: 'История торгов',
      trades: 'сделок',
      noTrades: 'Нет сделок',
      loadingTrades: 'Загрузка сделок...',
      recentVolume: 'Недавний объем',
      tx: 'tx',
    },
    pool: {
      volume24h: 'Объем 24ч',
      liquidity: 'Ликвидность',
      buys24h: 'Покупки 24ч',
      sells24h: 'Продажи 24ч',
      poolAddress: 'Адрес пула',
    },
    search: {
      placeholder: 'Поиск по названию токена, символу или адресу пула...',
      noResults: 'Пулы не найдены для',
      vol: 'Объем',
      batchHint: 'Совет: Введите несколько токенов через запятую для пакетного поиска',
      searching: 'Поиск',
    },
    chart: {
      orderBook: 'Книга ордеров',
      depth: 'Глубина',
      bids: 'Покупки',
      asks: 'Продажи',
    },
    favorites: {
      title: 'Избранное',
      empty: 'Нет избранного',
      remove: 'Удалить из избранного',
      add: 'Добавить в избранное',
    },
  },
};
