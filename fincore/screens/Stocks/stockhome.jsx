import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  RefreshControl,
  AppState,
} from "react-native";
import { 
  ArrowLeft, 
  Plus, 
  Home, 
  Search, 
  Briefcase, 
  User,
  TrendingUp,
  TrendingDown,
  Wallet
} from "lucide-react-native";
import Papa from "papaparse";
import axios from "axios";
import { API_ENDPOINTS, DATA_BASE_URL } from "../../apiConfig";
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';

const isMarketOpen = () => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hours * 60 + minutes;
  const marketOpen = 9 * 60 + 15;
  const marketClose = 15 * 60 + 30;
  const day = now.getDay();
  const isWeekday = day >= 1 && day <= 5;
  return isWeekday && currentTime >= marketOpen && currentTime < marketClose;
};

const StockHome = ({ navigation }) => {
  const [portfolioData, setPortfolioData] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [balance, setBalance] = useState(0);
  const [portfolioSummary, setPortfolioSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [sellHistory, setSellHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("Portfolio");
  const [inSearchMode, setInSearchMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResult, setSearchResult] = useState([]);
  const [activeScreen, setActiveScreen] = useState("Portfolio");
  const [userId, setUserId] = useState(null);
  const [marketStatus, setMarketStatus] = useState(isMarketOpen());
  const [liveConnected, setLiveConnected] = useState(false);

  const socketRef = useRef(null);
  const priceUpdateTimerRef = useRef(null);
  const appState = useRef(AppState.currentState);

  // Fetch all data
  const fetchAllData = async (id) => {
    try {
      setIsLoading(true);
      await Promise.all([
        fetchPortfolioData(),
        fetchBalance(id),
        fetchHoldings(id),
        fetchPortfolioSummary(id),
        fetchTransactions(id),
        fetchSellHistory(id),
      ]);
      setError(null);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const id = userId || await AsyncStorage.getItem('user_id');
      if (id) {
        setUserId(id);
        await fetchAllData(id);
      }
    } catch (err) {
      console.error('Error during refresh:', err);
    } finally {
      setRefreshing(false);
    }
  };


  // Refresh data when screen comes into focus (fixes add money issue)
  useEffect(() => {
    const loadUserIdAndFetchData = async () => {
      try {
        const id = await AsyncStorage.getItem('user_id');
        console.log("✅ Loaded user ID:", id);
        if (id) {
          setUserId(id);
          await fetchAllData(id);
        }
      } catch (err) {
        console.error('Error loading user ID and fetching data:', err);
      }
    };

    // Initial load
    loadUserIdAndFetchData();

    // Refresh data when screen comes into focus (fixes add money issue)
    const unsubscribe = navigation.addListener('focus', async () => {
      console.log('📱 Screen focused, refreshing data...');
      try {
        const id = userId || await AsyncStorage.getItem('user_id');
        if (id) {
          setUserId(id);
          // Specifically fetch balance first
          await fetchBalance(id);
          // Then fetch all other data
          await fetchAllData(id);
        }
      } catch (err) {
        console.error('Error fetching data on focus:', err);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [navigation]);

  // Monitor app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 App came to foreground');
        if (userId) {
          fetchAllData(userId);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [userId]);

  // Market status checker
  useEffect(() => {
    const interval = setInterval(() => {
      const newStatus = isMarketOpen();
      if (newStatus !== marketStatus) {
        setMarketStatus(newStatus);
        if (!newStatus) {
          disconnectWebSocket();
        } else if (holdings.length > 0) {
          connectWebSocket();
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [marketStatus, holdings.length]);

  // Start live price updates when holdings change
  useEffect(() => {
    if (holdings.length > 0 && marketStatus && activeTab === "Portfolio") {
      connectWebSocket();
      startPriceUpdateTimer();
    } else {
      disconnectWebSocket();
      stopPriceUpdateTimer();
    }

    return () => {
      disconnectWebSocket();
      stopPriceUpdateTimer();
    };
  }, [holdings.length, marketStatus, activeTab]);

  // WebSocket connection
  const connectWebSocket = () => {
    if (!marketStatus || holdings.length === 0) return;
    if (socketRef.current) return;

    console.log('🔌 Connecting to WebSocket for', holdings.length, 'holdings');

    const socket = io(DATA_BASE_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setLiveConnected(true);
      
      // Subscribe to all holdings
      holdings.forEach(holding => {
        socket.emit('start_stream', { symboltoken: holding.symbol_token });
      });
    });

    socket.on('live_tick', async (message) => {
      if (!isMarketOpen()) {
        disconnectWebSocket();
        return;
      }

      try {
        const data = typeof message === 'string' ? JSON.parse(message) : message;
        const symbolToken = data.token || data.symbol_token;
        
        if (data.last_traded_price || data.ltp) {
          const ltp = (data.last_traded_price || data.ltp) / 100;
          
          // Update local holdings state
          setHoldings(prevHoldings => 
            prevHoldings.map(holding => {
              if (holding.symbol_token === symbolToken) {
                const currentValue = holding.quantity * ltp;
                const pnl = currentValue - holding.invested_amount;
                const pnlPercent = (pnl / holding.invested_amount) * 100;
                
                return {
                  ...holding,
                  current_price: ltp,
                  current_value: currentValue,
                  pnl: pnl,
                  pnl_percent: pnlPercent
                };
              }
              return holding;
            })
          );

          // Update portfolio summary
          updatePortfolioSummary();
        }
      } catch (err) {
        console.error('❌ WebSocket parse error:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
      setLiveConnected(false);
    });

    socket.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });

    socketRef.current = socket;
  };

  const disconnectWebSocket = () => {
    if (socketRef.current) {
      console.log('🔌 Disconnecting WebSocket');
      socketRef.current.disconnect();
      socketRef.current = null;
      setLiveConnected(false);
    }
  };

  // Update prices in database every 20 seconds
  const startPriceUpdateTimer = () => {
    if (priceUpdateTimerRef.current) return;

    priceUpdateTimerRef.current = setInterval(async () => {
      if (!userId || holdings.length === 0 || !marketStatus) return;

      console.log('🔄 Updating prices in database...');
      
      for (const holding of holdings) {
        try {
          await axios.post(API_ENDPOINTS.UPDATE_HOLDING_PRICE, {
            user_id: userId,
            symbol_token: holding.symbol_token,
            current_price: holding.current_price
          });
        } catch (error) {
          console.error('❌ Error updating price for', holding.symbol, error);
        }
      }

      // Refresh portfolio summary
      await fetchPortfolioSummary(userId);
      
    }, 20000); // Every 20 seconds
  };

  const stopPriceUpdateTimer = () => {
    if (priceUpdateTimerRef.current) {
      clearInterval(priceUpdateTimerRef.current);
      priceUpdateTimerRef.current = null;
    }
  };

  // Update portfolio summary based on current holdings
  const updatePortfolioSummary = () => {
    if (holdings.length === 0) return;

    const totalInvested = holdings.reduce((sum, h) => sum + h.invested_amount, 0);
    const totalCurrent = holdings.reduce((sum, h) => sum + (h.quantity * h.current_price), 0);
    const totalPnl = totalCurrent - totalInvested;

    setPortfolioSummary(prev => ({
      ...prev,
      holdings_value: totalCurrent,
      total_portfolio_value: balance + totalCurrent,
      invested_amount: totalInvested,
      current_pnl: totalPnl
    }));
  };

  const fetchPortfolioData = async () => {
    const response = await fetch(API_ENDPOINTS.GET_COMPANYS);
    console.log("🔄 Fetching portfolio data from:", response);
    if (!response.ok) throw new Error("Failed to fetch portfolio data");
    const text = await response.text();
    
    const parsed = Papa.parse(text, { header: true });
    
    setPortfolioData(parsed.data || []);
  };

  const fetchBalance = async (id) => {
    console.log("🔄 Fetching balance for user ID:", id);
    const response = await axios.get(API_ENDPOINTS.GET_BALANCE, {
      params: { user_id: id }
    });
    console.log("✅ Fetched balance:", response.data.balance);
    setBalance(response.data.balance);
  };

  const fetchHoldings = async (id) => {
    const response = await axios.get(API_ENDPOINTS.GET_HOLDINGS, {
      params: { user_id: id }
    });
    setHoldings(response.data.holdings || []);
  };

  const fetchPortfolioSummary = async (id) => {
    const response = await axios.get(API_ENDPOINTS.PORTFOLIO_SUMMARY, {
      params: { user_id: id }
    });
    setPortfolioSummary(response.data);
  };

  const fetchTransactions = async (id) => {
    const response = await axios.get(API_ENDPOINTS.GET_TRANSACTIONS, {
      params: { user_id: id }
    });
    setTransactions(response.data.transactions || []);
  };

  const fetchSellHistory = async (id) => {
    const response = await axios.get(API_ENDPOINTS.GET_SELL_HISTORY, {
      params: { user_id: id }
    });
    setSellHistory(response.data.sell_history || []);
  };

  const formatCurrency = (amount) => {
    return `₹${Number(amount).toLocaleString("en-IN", { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSearch = (query) => {
    setSearchTerm(query);
    if (!query) {
      setSearchResult([]);
      return;
    }
    const results = portfolioData.filter(
      (stock) =>
        stock["name"]?.toLowerCase().includes(query.toLowerCase()) ||
        stock["SYMBOL"]?.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResult(results);
  };

  const handleNavigation = (screen) => {
    setActiveScreen(screen);
    setInSearchMode(false);
    setSearchTerm("");
    setSearchResult([]);
    if (screen !== "Portfolio") {
      navigation.navigate(screen);
    }
  };

  const renderPortfolioTab = () => (
    <View>
      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <View>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            {liveConnected && marketStatus && (
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live Updates</Text>
              </View>
            )}
          </View>
          <TouchableOpacity 
            style={styles.addMoneyButton}
            onPress={() => navigation.navigate('AddMoney')}
          >
            <Wallet color="white" size={16} />
            <Text style={styles.addMoneyText}>Add Money</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.balanceAmount}>{formatCurrency(balance)}</Text>
      </View>

      {/* Portfolio Summary */}
      {portfolioSummary && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Portfolio Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Value</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(portfolioSummary.total_portfolio_value)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Holdings Value</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(portfolioSummary.holdings_value)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Current P&L</Text>
            <Text style={[
              styles.summaryValue,
              portfolioSummary.current_pnl >= 0 ? styles.profit : styles.loss
            ]}>
              {portfolioSummary.current_pnl >= 0 ? '+' : ''}
              {formatCurrency(portfolioSummary.current_pnl)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Realized P&L</Text>
            <Text style={[
              styles.summaryValue,
              portfolioSummary.realized_pnl >= 0 ? styles.profit : styles.loss
            ]}>
              {portfolioSummary.realized_pnl >= 0 ? '+' : ''}
              {formatCurrency(portfolioSummary.realized_pnl)}
            </Text>
          </View>
        </View>
      )}

      {/* Holdings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Holdings ({holdings.length})</Text>
        {holdings.length > 0 ? (
          holdings.map((holding, index) => (
            <TouchableOpacity
              key={index}
              style={styles.holdingCard}
              onPress={() =>
                navigation.navigate("CandleCloseChart", {
  stockSymbol: holding.symbol,
  companyName: holding.name,
  symboltoken: holding.symboltoken
})

              }
            >
              <View style={styles.holdingHeader}>
                <View>
                  <Text style={styles.holdingSymbol}>{holding.symbol}</Text>
                  <Text style={styles.holdingName}>{holding.name}</Text>
                </View>
                <View style={styles.holdingPnl}>
                  {holding.pnl >= 0 ? (
                    <TrendingUp color="#10b981" size={20} />
                  ) : (
                    <TrendingDown color="#ef4444" size={20} />
                  )}
                  <Text style={[
                    styles.holdingPnlText,
                    holding.pnl >= 0 ? styles.profit : styles.loss
                  ]}>
                    {holding.pnl >= 0 ? '+' : ''}{formatCurrency(holding.pnl)}
                  </Text>
                </View>
              </View>
              <View style={styles.holdingDetails}>
                <View style={styles.holdingDetailItem}>
                  <Text style={styles.holdingDetailLabel}>Qty</Text>
                  <Text style={styles.holdingDetailValue}>{holding.quantity}</Text>
                </View>
                <View style={styles.holdingDetailItem}>
                  <Text style={styles.holdingDetailLabel}>Avg Price</Text>
                  <Text style={styles.holdingDetailValue}>
                    {formatCurrency(holding.avg_buy_price)}
                  </Text>
                </View>
                <View style={styles.holdingDetailItem}>
                  <Text style={styles.holdingDetailLabel}>Current</Text>
                  <Text style={styles.holdingDetailValue}>
                    {formatCurrency(holding.current_price)}
                  </Text>
                </View>
                <View style={styles.holdingDetailItem}>
                  <Text style={styles.holdingDetailLabel}>P&L %</Text>
                  <Text style={[
                    styles.holdingDetailValue,
                    holding.pnl_percent >= 0 ? styles.profit : styles.loss
                  ]}>
                    {holding.pnl_percent >= 0 ? '+' : ''}
                    {holding.pnl_percent.toFixed(2)}%
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>No holdings yet. Start buying stocks!</Text>
        )}
      </View>
    </View>
  );

  const renderTransactionsTab = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Recent Transactions</Text>
      {transactions.length > 0 ? (
        transactions.slice(0, 20).map((txn, index) => (
          <View key={index} style={styles.transactionCard}>
            <View style={styles.transactionHeader}>
              <View>
                <Text style={styles.transactionSymbol}>{txn.symbol}</Text>
                <Text style={styles.transactionDate}>{formatDate(txn.timestamp)}</Text>
              </View>
              <View style={[
                styles.transactionBadge,
                txn.transaction_type === 'BUY' ? styles.buyBadge : styles.sellBadge
              ]}>
                <Text style={styles.transactionBadgeText}>{txn.transaction_type}</Text>
              </View>
            </View>
            <View style={styles.transactionDetails}>
              <Text style={styles.transactionDetailText}>
                {txn.quantity} shares @ {formatCurrency(txn.price)}
              </Text>
              <Text style={[
                styles.transactionAmount,
                txn.transaction_type === 'BUY' ? styles.loss : styles.profit
              ]}>
                {txn.transaction_type === 'BUY' ? '-' : '+'}
                {formatCurrency(txn.total_amount)}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>No transactions yet</Text>
      )}
    </View>
  );

  const renderSellHistoryTab = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Sell History</Text>
      {sellHistory.length > 0 ? (
        <>
          <View style={styles.sellSummaryCard}>
            <View style={styles.sellSummaryRow}>
              <Text style={styles.sellSummaryLabel}>Total Profit</Text>
              <Text style={[styles.sellSummaryValue, styles.profit]}>
                +{formatCurrency(sellHistory.reduce((sum, s) => 
                  sum + (s.profit_loss > 0 ? s.profit_loss : 0), 0))}
              </Text>
            </View>
            <View style={styles.sellSummaryRow}>
              <Text style={styles.sellSummaryLabel}>Total Loss</Text>
              <Text style={[styles.sellSummaryValue, styles.loss]}>
                {formatCurrency(sellHistory.reduce((sum, s) => 
                  sum + (s.profit_loss < 0 ? s.profit_loss : 0), 0))}
              </Text>
            </View>
            <View style={[styles.sellSummaryRow, styles.sellSummaryTotal]}>
              <Text style={styles.sellSummaryTotalLabel}>Net P&L</Text>
              <Text style={[
                styles.sellSummaryTotalValue,
                sellHistory.reduce((sum, s) => sum + s.profit_loss, 0) >= 0 
                  ? styles.profit : styles.loss
              ]}>
                {sellHistory.reduce((sum, s) => sum + s.profit_loss, 0) >= 0 ? '+' : ''}
                {formatCurrency(sellHistory.reduce((sum, s) => sum + s.profit_loss, 0))}
              </Text>
            </View>
          </View>

          {sellHistory.slice(0, 20).map((sell, index) => (
            <View key={index} style={styles.sellCard}>
              <View style={styles.sellHeader}>
                <View>
                  <Text style={styles.sellSymbol}>{sell.symbol}</Text>
                  <Text style={styles.sellDate}>{formatDate(sell.timestamp)}</Text>
                </View>
                <View style={styles.sellPnlContainer}>
                  {sell.profit_loss >= 0 ? (
                    <TrendingUp color="#10b981" size={18} />
                  ) : (
                    <TrendingDown color="#ef4444" size={18} />
                  )}
                  <Text style={[
                    styles.sellPnl,
                    sell.profit_loss >= 0 ? styles.profit : styles.loss
                  ]}>
                    {sell.profit_loss >= 0 ? '+' : ''}{formatCurrency(sell.profit_loss)}
                  </Text>
                </View>
              </View>
              <View style={styles.sellDetails}>
                <View style={styles.sellDetailRow}>
                  <Text style={styles.sellDetailLabel}>Quantity:</Text>
                  <Text style={styles.sellDetailValue}>{sell.quantity} shares</Text>
                </View>
                <View style={styles.sellDetailRow}>
                  <Text style={styles.sellDetailLabel}>Buy Price:</Text>
                  <Text style={styles.sellDetailValue}>{formatCurrency(sell.buy_price)}</Text>
                </View>
                <View style={styles.sellDetailRow}>
                  <Text style={styles.sellDetailLabel}>Sell Price:</Text>
                  <Text style={styles.sellDetailValue}>{formatCurrency(sell.sell_price)}</Text>
                </View>
                <View style={styles.sellDetailRow}>
                  <Text style={styles.sellDetailLabel}>P&L %:</Text>
                  <Text style={[
                    styles.sellDetailValue,
                    sell.profit_loss_percent >= 0 ? styles.profit : styles.loss
                  ]}>
                    {sell.profit_loss_percent >= 0 ? '+' : ''}
                    {sell.profit_loss_percent.toFixed(2)}%
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </>
      ) : (
        <Text style={styles.emptyText}>No sell history yet</Text>
      )}
    </View>
  );

  const renderSearchResults = () => (
    <View style={styles.stockList}>
      {searchResult.length > 0 ? (
        searchResult.map((stock, index) => (
          <TouchableOpacity
            key={index}
            style={styles.stockItem}
            onPress={() =>
              navigation.navigate("CandleCloseChart", {
                stockSymbol: stock.symbol,
                companyName: stock.name,
                symboltoken: stock.symboltoken
              })
            }
          >
            <Text style={styles.stockName}>{stock.name}</Text>
            <Text style={styles.stockShares}>{stock.SYMBOL}</Text>
          </TouchableOpacity>
        ))
      ) : (
        <Text style={styles.emptyText}>
          {searchTerm !== "" ? "No matching company found" : "Start typing to search"}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (inSearchMode) {
              setInSearchMode(false);
              setSearchTerm("");
              setSearchResult([]);
            } else {
              navigation.goBack();
            }
          }}
        >
          <ArrowLeft color="white" size={24} />
        </TouchableOpacity>

        {inSearchMode ? (
          <TextInput
            placeholder="Search company..."
            placeholderTextColor="#cbd5e1"
            value={searchTerm}
            onChangeText={handleSearch}
            style={[styles.searchInput, { flex: 1, marginLeft: 12 }]}
            autoFocus
          />
        ) : (
          <Text style={styles.headerTitle}>Portfolio</Text>
        )}

          <TouchableOpacity
            style={styles.retryButton}
            onPress={async () => {
              try {
                const id = userId || await AsyncStorage.getItem('user_id');
                if (id) {
                  setUserId(id);
                  fetchAllData(id);
                }
              } catch (err) {
                console.error('Error on retry:', err);
              }
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          
        
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchAllData(userId)}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView 
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
          }
        >
          {inSearchMode ? (
            renderSearchResults()
          ) : (
            <>
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[styles.tab, activeTab === "Portfolio" && styles.activeTab]}
                  onPress={() => setActiveTab("Portfolio")}
                >
                  <Text style={[styles.tabText, activeTab === "Portfolio" && styles.activeTabText]}>
                    Portfolio
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === "Transactions" && styles.activeTab]}
                  onPress={() => setActiveTab("Transactions")}
                >
                  <Text style={[styles.tabText, activeTab === "Transactions" && styles.activeTabText]}>
                    Transactions
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === "History" && styles.activeTab]}
                  onPress={() => setActiveTab("History")}
                >
                  <Text style={[styles.tabText, activeTab === "History" && styles.activeTabText]}>
                    Sell History
                  </Text>
                </TouchableOpacity>
              </View>

              {activeTab === "Portfolio" && renderPortfolioTab()}
              {activeTab === "Transactions" && renderTransactionsTab()}
              {activeTab === "History" && renderSellHistoryTab()}
            </>
          )}
        </ScrollView>
      )}

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => handleNavigation("DashboardAnalysis")}>
          <Home color={activeScreen === "Dashboard" ? "#ffffff" : "#6b7280"} size={24} />
          <Text style={[styles.navText, { color: activeScreen === "Dashboard" ? "#ffffff" : "#6b7280" }]}>
            Dashboard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            setActiveScreen("Search");
            setInSearchMode(true);
            setSearchTerm("");
            setSearchResult([]);
          }}
        >
          <Search color={inSearchMode ? "#ffffff" : "#6b7280"} size={24} />
          <Text style={[styles.navText, { color: inSearchMode ? "#ffffff" : "#6b7280" }]}>
            Search
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => handleNavigation("Portfolio")}>
          <Briefcase color={activeScreen === "Portfolio" && !inSearchMode ? "#ffffff" : "#6b7280"} size={24} />
          <Text style={[styles.navText, { color: activeScreen === "Portfolio" && !inSearchMode ? "#ffffff" : "#6b7280" }]}>
            Portfolio
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => handleNavigation("Profile")}>
          <User color={activeScreen === "Profile" ? "#ffffff" : "#6b7280"} size={24} />
          <Text style={[styles.navText, { color: activeScreen === "Profile" ? "#ffffff" : "#6b7280" }]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: "#0f172a",
  },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "white" },
  searchInput: { backgroundColor: "#1e293b", padding: 8, color: "white", borderRadius: 8 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  errorText: { color: "#ef4444", fontSize: 16, marginBottom: 16, textAlign: "center" },
  retryButton: { backgroundColor: "#3b82f6", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { color: "white", fontSize: 16, fontWeight: "600" },
  content: { flex: 1 },
  
  // Live indicator
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  liveText: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
  },

  // Balance Card
  balanceCard: {
    backgroundColor: "#1e293b",
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  balanceLabel: { fontSize: 14, color: "#94a3b8" },
  addMoneyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10b981",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addMoneyText: { color: "white", fontSize: 12, fontWeight: "600" },
  balanceAmount: { fontSize: 32, fontWeight: "700", color: "white" },

  // Summary Card
  summaryCard: {
    backgroundColor: "#1e293b",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  summaryTitle: { fontSize: 16, fontWeight: "600", color: "white", marginBottom: 12 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  summaryLabel: { fontSize: 14, color: "#94a3b8" },
  summaryValue: { fontSize: 14, fontWeight: "600", color: "white" },

  // Tabs
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#1e293b",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTab: { backgroundColor: "#3b82f6" },
  tabText: { fontSize: 14, color: "#94a3b8", fontWeight: "500" },
  activeTabText: { color: "white" },

  // Section
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "white", marginBottom: 12 },
  emptyText: { color: "#6b7280", fontSize: 14, textAlign: "center", paddingVertical: 20 },

  // Holdings
  holdingCard: {
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  holdingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  holdingSymbol: { fontSize: 16, fontWeight: "700", color: "white" },
  holdingName: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  holdingPnl: { flexDirection: "row", alignItems: "center", gap: 6 },
  holdingPnlText: { fontSize: 16, fontWeight: "600" },
  holdingDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  holdingDetailItem: { alignItems: "center" },
  holdingDetailLabel: { fontSize: 11, color: "#6b7280", marginBottom: 4 },
  holdingDetailValue: { fontSize: 13, fontWeight: "600", color: "white" },

  // Transactions
  transactionCard: {
    backgroundColor: "#1e293b",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  transactionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  transactionSymbol: { fontSize: 15, fontWeight: "600", color: "white" },
  transactionDate: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  transactionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  buyBadge: { backgroundColor: "#10b98120" },
  sellBadge: { backgroundColor: "#ef444420" },
  transactionBadgeText: { fontSize: 11, fontWeight: "600", color: "white" },
  transactionDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  transactionDetailText: { fontSize: 13, color: "#94a3b8" },
  transactionAmount: { fontSize: 15, fontWeight: "600" },

  // Sell History
  sellSummaryCard: {
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  sellSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  sellSummaryTotal: {
    borderTopWidth: 2,
    borderTopColor: "#334155",
    marginTop: 8,
    paddingTop: 12,
  },
  sellSummaryLabel: { fontSize: 14, color: "#94a3b8" },
  sellSummaryValue: { fontSize: 14, fontWeight: "600" },
  sellSummaryTotalLabel: { fontSize: 16, fontWeight: "600", color: "white" },
  sellSummaryTotalValue: { fontSize: 16, fontWeight: "700" },

  sellCard: {
    backgroundColor: "#1e293b",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  sellHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sellSymbol: { fontSize: 15, fontWeight: "600", color: "white" },
  sellDate: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  sellPnlContainer: { flexDirection: "row", alignItems: "center", gap: 6 },
  sellPnl: { fontSize: 15, fontWeight: "600" },
  sellDetails: { gap: 6 },
  sellDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sellDetailLabel: { fontSize: 12, color: "#6b7280" },
  sellDetailValue: { fontSize: 12, fontWeight: "500", color: "white" },

  // Common
  profit: { color: "#10b981" },
  loss: { color: "#ef4444" },

  // Search/Stock List
  stockList: { paddingHorizontal: 16, paddingBottom: 100 },
  stockItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  stockName: { fontSize: 15, fontWeight: "500", color: "white" },
  stockShares: { fontSize: 13, color: "#64748b" },

  // Bottom Nav
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 12,
    paddingBottom: 28,
    backgroundColor: "#1e293b",
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  navItem: { alignItems: "center" },
  navText: { fontSize: 12, marginTop: 4 },
});

export default StockHome;