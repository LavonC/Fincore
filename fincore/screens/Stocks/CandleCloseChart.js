import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
  Alert,
} from 'react-native';
import Svg, { Path, Line, Text as SvgText, G } from 'react-native-svg';
import io from 'socket.io-client';
import axios from 'axios';
import { API_ENDPOINTS, DATA_BASE_URL } from "../../apiConfig";
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

export default function CandleCloseChart({ route, navigation }) {
  const socketRef = useRef(null);
  const [showBuySellModal, setShowBuySellModal] = useState(false);
  const [tradeType, setTradeType] = useState('BUY');
  const [quantity, setQuantity] = useState('');
  const [balance, setBalance] = useState(0);
  const [holdingInfo, setHoldingInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  
  const [selectedCompany, setSelectedCompany] = useState({
    name: route?.params?.companyName,
    symbol: route?.params?.stockSymbol,
    symboltoken: route?.params?.symboltoken 
  });

  const [stockData, setStockData] = useState({
    price: 0,
    change: 0,
    changePercent: 0,
    open: 0,
    high: 0,
    low: 0,
    volume: '0M',
    prevClose: 0,
  });

  const [chartData, setChartData] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('1D');
  const [loadingData, setLoadingData] = useState(true);
  const [connected, setConnected] = useState(false);
  const [marketStatus, setMarketStatus] = useState(isMarketOpen());

  const periods = ['1D', '1W', '1M', '3M', '1Y', 'All'];

  useEffect(() => {
    const loadUserId = async () => {
      const id = await AsyncStorage.getItem('user_id');
      console.log("✅ Loaded user ID:", id);
      if (id) {
        setUserId(id);
      } else {
        Alert.alert('Error', 'User ID not found. Please login again.');
        navigation.navigate('Login');
      }
    };
    loadUserId();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMarketStatus(isMarketOpen());
    }, 60000);
    return () => clearInterval(interval);
  }, []);



  useEffect(() => {
    if (userId) {
      fetchBalance();
    }
  }, [userId]);

  useEffect(() => {
    loadData();
    if (userId) {
      fetchHoldingInfo();
    }
    return () => {
      disconnectSocket();
    };
  }, [selectedCompany, selectedPeriod, userId]);



  const fetchBalance = async () => {
    if (!userId) return;
    try {
      const response = await axios.get(API_ENDPOINTS.GET_BALANCE, {
        params: { user_id: userId }
      });
      if (response.data.success) {
        setBalance(response.data.balance);
      }
    } catch (error) {
      console.error('❌ Error fetching balance:', error);
    }
  };

  const fetchHoldingInfo = async () => {
    if (!userId) return;
    try {
      const response = await axios.get(API_ENDPOINTS.GET_HOLDINGS, {
        params: { user_id: userId }
      });
      const holding = response.data.holdings.find(
        h => h.symbol_token === selectedCompany.symboltoken
      );
      setHoldingInfo(holding || null);
    } catch (error) {
      console.error('❌ Error fetching holding:', error);
    }
  };

  // NEW: Update holding price in database for live P&L
  const updateHoldingPrice = async (price) => {
    if (!userId || !holdingInfo) return;
    
    try {
      await axios.post(API_ENDPOINTS.UPDATE_HOLDING_PRICE || `${DATA_BASE_URL}/update_holding_price`, {
        user_id: userId,
        symbol_token: selectedCompany.symboltoken,
        current_price: price
      });
    } catch (error) {
      console.error('❌ Error updating holding price:', error);
    }
  };

  const loadData = async () => {
    await fetchHistoricalData(selectedCompany.symboltoken, selectedPeriod);
    if (selectedPeriod === '1D' && marketStatus) {
      connectLiveSocket();
    }
  };

  const fetchHistoricalData = async (symboltoken, dateRange) => {
    try {
      setLoadingData(true);
      const response = await axios.get(API_ENDPOINTS.HISTORY, {
        params: { symboltoken, date_range: dateRange }
      });

      if (response.data.success) {
        const historicalData = response.data.data;
        const formattedData = historicalData.map((candle) => ({
          timestamp: new Date(candle.timestamp).getTime(),
          price: candle.close,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          volume: candle.volume
        }));

        setChartData(formattedData);

        if (historicalData.length > 0) {
          const latestCandle = historicalData[historicalData.length - 1];
          const firstCandle = historicalData[0];
          const change = latestCandle.close - firstCandle.close;
          const changePercent = (change / firstCandle.close) * 100;

          setStockData({
            price: latestCandle.close,
            open: latestCandle.open,
            high: latestCandle.high,
            low: latestCandle.low,
            volume: ((latestCandle.volume || 0) / 1000000).toFixed(1) + 'M',
            change,
            changePercent,
            prevClose: firstCandle.close,
          });

          // Update holding price if user owns this stock
          if (holdingInfo) {
            updateHoldingPrice(latestCandle.close);
          }
        }
      }
      setLoadingData(false);
    } catch (error) {
      console.error('❌ Error fetching historical data:', error);
      setLoadingData(false);
    }
  };

  const connectLiveSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(DATA_BASE_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('✅ Socket connected');
      setConnected(true);
      socket.emit('start_stream', { symboltoken: selectedCompany.symboltoken });
    });

    socket.on('live_tick', (message) => {
      if (!isMarketOpen()) {
        disconnectSocket();
        return;
      }

      try {
        const data = typeof message === 'string' ? JSON.parse(message) : message;
        if (data.last_traded_price || data.ltp) {
          const ltp = (data.last_traded_price || data.ltp) / 100;
          const high = (data.high_price || data.high || 0) / 100;
          const low = (data.low_price || data.low || 0) / 100;
          const open = (data.open_price || data.open || 0) / 100;
          const volume = data.volume_trade_for_the_day || data.volume || 0;
          const timestamp = new Date().getTime();

          setStockData((prev) => {
            const prevClose = prev.prevClose || ltp;
            const change = ltp - prevClose;
            const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

            return {
              price: ltp,
              high: Math.max(high, prev.high),
              low: low > 0 ? Math.min(low, prev.low || low) : prev.low,
              open: prev.open || open,
              volume: (volume / 1000000).toFixed(1) + 'M',
              change,
              changePercent,
              prevClose,
            };
          });

          setChartData((prev) => [...prev, { timestamp, price: ltp, open, high, low, volume }]);

          // IMPORTANT: Update holding price in real-time for live P&L
          if (holdingInfo) {
            updateHoldingPrice(ltp);
            // Update local holding info
            setHoldingInfo(prevHolding => {
              if (!prevHolding) return null;
              const currentValue = prevHolding.quantity * ltp;
              const pnl = currentValue - prevHolding.invested_amount;
              const pnl_percent = (pnl / prevHolding.invested_amount) * 100;
              
              return {
                ...prevHolding,
                current_price: ltp,
                current_value: currentValue,
                pnl: pnl,
                pnl_percent: pnl_percent
              };
            });
          }
        }
      } catch (err) {
        console.error('❌ Parse error:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
      setConnected(false);
    });

    socketRef.current = socket;
  };

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.emit('stop_stream');
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
    }
  };

  const handleBuySell = (type) => {
    if (!userId) {
      Alert.alert('Error', 'Please login first');
      return;
    }
    setTradeType(type);
    setQuantity('');
    setShowBuySellModal(true);
  };

  const executeTrade = async () => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found. Please login again.');
      return;
    }

    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    const totalAmount = qty * stockData.price;

    if (tradeType === 'BUY') {
      if (totalAmount > balance) {
        Alert.alert('Insufficient Balance', `You need ₹${totalAmount.toFixed(2)} but have ₹${balance.toFixed(2)}`);
        return;
      }
    } else {
      if (!holdingInfo || holdingInfo.quantity < qty) {
        Alert.alert('Insufficient Shares', `You have ${holdingInfo?.quantity || 0} shares`);
        return;
      }
    }

    try {
      setLoading(true);
      const endpoint = tradeType === 'BUY' ? API_ENDPOINTS.BUY_STOCK : API_ENDPOINTS.SELL_STOCK;
      
      const payload = {
        user_id: userId,
        symbol: selectedCompany.symbol,
        symbol_token: selectedCompany.symboltoken,
        company_name: selectedCompany.name,
        quantity: qty,
        price: stockData.price
      };

      console.log('🔄 Executing trade:', payload);

      const response = await axios.post(endpoint, payload);

      if (response.data.success) {
        Alert.alert(
          'Success',
          `${tradeType === 'BUY' ? 'Bought' : 'Sold'} ${qty} shares of ${selectedCompany.symbol}`,
          [{ text: 'OK', onPress: () => {
            setShowBuySellModal(false);
            fetchBalance();
            fetchHoldingInfo();
          }}]
        );
      }
    } catch (error) {
      console.error('❌ Trade error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    setChartData([]);
    disconnectSocket();
  };

  const handleCompanySelect = (company) => {
    setSelectedCompany(company);
    setShowCompanyPicker(false);
    setChartData([]);
    setSelectedPeriod('1D');
  };

  const renderChart = () => {
    if (chartData.length < 2) return null;

    const chartWidth = SCREEN_WIDTH - 48;
    const chartHeight = 200;
    const padding = { top: 10, right: 50, bottom: 20, left: 10 };

    const prices = chartData.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const pricePadding = priceRange * 0.1;

    const yMin = minPrice - pricePadding;
    const yMax = maxPrice + pricePadding;
    const yRange = yMax - yMin;

    const xScale = (chartWidth - padding.left - padding.right) / (chartData.length - 1);
    const yScale = (chartHeight - padding.top - padding.bottom) / yRange;

    let path = '';
    chartData.forEach((point, i) => {
      const x = padding.left + i * xScale;
      const y = chartHeight - padding.bottom - (point.price - yMin) * yScale;

      if (i === 0) {
        path += `M ${x} ${y}`;
      } else {
        const prevPoint = chartData[i - 1];
        const prevX = padding.left + (i - 1) * xScale;
        const prevY = chartHeight - padding.bottom - (prevPoint.price - yMin) * yScale;
        const cpX1 = prevX + (x - prevX) / 3;
        const cpX2 = prevX + (2 * (x - prevX)) / 3;
        path += ` C ${cpX1} ${prevY}, ${cpX2} ${y}, ${x} ${y}`;
      }
    });

    const numYLabels = 5;
    const yLabels = [];
    for (let i = 0; i < numYLabels; i++) {
      const price = yMin + (yRange * i / (numYLabels - 1));
      const y = chartHeight - padding.bottom - (price - yMin) * yScale;
      yLabels.push({ price, y });
    }

    const isPositive = stockData.changePercent >= 0;
    const lineColor = isPositive ? "#4ade80" : "#f87171";

    return (
      <Svg height={chartHeight} width={chartWidth}>
        {yLabels.map((label, i) => (
          <G key={i}>
            <Line x1={padding.left} y1={label.y} x2={chartWidth - padding.right} y2={label.y}
              stroke="#2a2a2a" strokeWidth="1" strokeDasharray="4,4" />
            <SvgText x={chartWidth - padding.right + 5} y={label.y + 4} fill="#6b7280" fontSize="10">
              ₹{label.price.toFixed(2)}
            </SvgText>
          </G>
        ))}
        <Path d={path} stroke={lineColor} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  };

  const isPositive = stockData.changePercent >= 0;

  return (
    <View style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          
          <View style={styles.placeholder} />
        </View>

        <View style={styles.priceSection}>
          <Text style={styles.companyName}>{selectedCompany.name}</Text>
          <Text style={styles.priceText}>₹{stockData.price.toFixed(2)}</Text>
          <View style={styles.changeContainer}>
            <Text style={[styles.changeText, isPositive ? styles.positive : styles.negative]}>
              {isPositive ? '+' : ''}₹{stockData.change.toFixed(2)} ({isPositive ? '+' : ''}{stockData.changePercent.toFixed(2)}%)
            </Text>
            {connected && marketStatus && (
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live</Text>
              </View>
            )}
            {!marketStatus && (
              <View style={[styles.liveIndicator, styles.closedIndicator]}>
                <Text style={styles.closedText}>Market Closed</Text>
              </View>
            )}
          </View>

          {loadingData ? (
            <ActivityIndicator size="large" color="#4ade80" style={styles.loader} />
          ) : chartData.length > 0 ? (
            <View style={styles.chartContainer}>{renderChart()}</View>
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>No data available</Text>
            </View>
          )}

          <View style={styles.periodContainer}>
            {periods.map((period) => (
              <TouchableOpacity key={period} onPress={() => handlePeriodChange(period)}
                style={[styles.periodButton, selectedPeriod === period && styles.periodButtonActive]}>
                <Text style={[styles.periodText, selectedPeriod === period && styles.periodTextActive]}>
                  {period}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Balance & Holdings Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Available Balance</Text>
            <Text style={styles.infoValue}>₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
          {holdingInfo && (
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Your Holdings</Text>
              <Text style={styles.infoValue}>{holdingInfo.quantity} shares</Text>
              <Text style={styles.infoSubtext}>Avg: ₹{holdingInfo.avg_buy_price.toFixed(2)}</Text>
              {/* LIVE P&L DISPLAY */}
              <Text style={[
                styles.infoPnl,
                holdingInfo.pnl >= 0 ? styles.positive : styles.negative
              ]}>
                {holdingInfo.pnl >= 0 ? '+' : ''}₹{holdingInfo.pnl?.toFixed(2) || '0.00'} 
                ({holdingInfo.pnl_percent >= 0 ? '+' : ''}{holdingInfo.pnl_percent?.toFixed(2) || '0.00'}%)
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Stats</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Open</Text>
              <Text style={styles.statValue}>₹{stockData.open.toFixed(2)}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>High</Text>
              <Text style={styles.statValue}>₹{stockData.high.toFixed(2)}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Low</Text>
              <Text style={styles.statValue}>₹{stockData.low.toFixed(2)}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Volume</Text>
              <Text style={styles.statValue}>{stockData.volume}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Prev Close</Text>
              <Text style={styles.statValue}>₹{stockData.prevClose.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.buyButton} onPress={() => handleBuySell('BUY')}>
            <Text style={styles.buyButtonText}>Buy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sellButton} onPress={() => handleBuySell('SELL')}
            disabled={!holdingInfo || holdingInfo.quantity === 0}>
            <Text style={styles.sellButtonText}>Sell</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Company Picker Modal */}
   

      {/* Buy/Sell Modal */}
      <Modal visible={showBuySellModal} animationType="slide" transparent={true}
        onRequestClose={() => setShowBuySellModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.tradeModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{tradeType} {selectedCompany.symbol}</Text>
              <TouchableOpacity onPress={() => setShowBuySellModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tradeInfo}>
              <Text style={styles.tradePrice}>Current Price: ₹{stockData.price.toFixed(2)}</Text>
              {tradeType === 'BUY' ? (
                <Text style={styles.tradeBalance}>Available: ₹{balance.toFixed(2)}</Text>
              ) : (
                <Text style={styles.tradeBalance}>Holdings: {holdingInfo?.quantity || 0} shares</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Quantity</Text>
              <TextInput style={styles.tradeInput} placeholder="Enter quantity"
                placeholderTextColor="#6b7280" keyboardType="numeric"
                value={quantity} onChangeText={setQuantity} />
            </View>

            {quantity && parseInt(quantity) > 0 && (
              <View style={styles.tradeSummary}>
                <View style={styles.tradeSummaryRow}>
                  <Text style={styles.tradeSummaryLabel}>Total Amount</Text>
                  <Text style={styles.tradeSummaryValue}>
                    ₹{(parseInt(quantity) * stockData.price).toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity style={[
              tradeType === 'BUY' ? styles.confirmBuyButton : styles.confirmSellButton,
              loading && styles.buttonDisabled
            ]} onPress={executeTrade} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.confirmButtonText}>
                  Confirm {tradeType}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f1f1f',
  },
  backButton: { padding: 8 },
  backIcon: { fontSize: 24, color: '#fff' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  placeholder: { width: 40 },
  priceSection: { paddingHorizontal: 24, paddingTop: 24 },
  companyName: { fontSize: 14, color: '#9ca3af', marginBottom: 8 },
  priceText: { fontSize: 36, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  changeContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
  changeText: { fontSize: 14, fontWeight: '500' },
  positive: { color: '#4ade80' },
  negative: { color: '#f87171' },
  liveIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8,
    paddingVertical: 4, backgroundColor: '#1f1f1f', borderRadius: 12,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' },
  liveText: { fontSize: 11, color: '#4ade80', fontWeight: '600' },
  closedIndicator: { backgroundColor: '#ef444420' },
  closedText: { fontSize: 11, color: '#ef4444', fontWeight: '600' },
  chartContainer: { marginVertical: 24 },
  loader: { marginVertical: 60 },
  noDataContainer: { height: 200, justifyContent: 'center', alignItems: 'center', marginVertical: 24 },
  noDataText: { color: '#6b7280', fontSize: 14 },
  periodContainer: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24,
    backgroundColor: '#1f1f1f', borderRadius: 10, padding: 4,
  },
  periodButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  periodButtonActive: { backgroundColor: '#10b981' },
  periodText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  periodTextActive: { color: '#fff' },
  infoSection: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, marginBottom: 16 },
  infoCard: { flex: 1, backgroundColor: '#1f1f1f', padding: 14, borderRadius: 12 },
  infoLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 6 },
  infoValue: { fontSize: 18, fontWeight: '700', color: '#fff' },
  infoSubtext: { fontSize: 11, color: '#6b7280', marginTop: 4 },
  infoPnl: { fontSize: 13, fontWeight: '600', marginTop: 6 },
  section: { paddingHorizontal: 24, marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 16 },
  statsContainer: { backgroundColor: '#1f1f1f', borderRadius: 12, padding: 16 },
  statRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#2a2a2a',
  },
  statLabel: { fontSize: 14, color: '#9ca3af' },
  statValue: { fontSize: 14, fontWeight: '600', color: '#fff' },
  actionButtons: { flexDirection: 'row', paddingHorizontal: 24, paddingBottom: 32, gap: 16 },
  buyButton: {
    flex: 1, backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', elevation: 3, shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  buyButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  sellButton: {
    flex: 1, backgroundColor: '#ef4444', paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', elevation: 3, shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  sellButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '80%', paddingBottom: 20,
  },
  tradeModalContent: {
    backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#2a2a2a',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  modalClose: { fontSize: 28, color: '#9ca3af', fontWeight: '300' },
  companyItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#2a2a2a',
  },
  companySymbol: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 4 },
  companyNameText: { fontSize: 13, color: '#9ca3af' },
  selectedCheck: { fontSize: 24, color: '#10b981', fontWeight: '700' },
  tradeInfo: { padding: 20, backgroundColor: '#0f172a', marginHorizontal: 20, marginTop: 16, borderRadius: 12 },
  tradePrice: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 },
  tradeBalance: { fontSize: 14, color: '#94a3b8' },
  inputContainer: { paddingHorizontal: 20, marginTop: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 8 },
  tradeInput: {
    backgroundColor: '#0f172a', borderWidth: 2, borderColor: '#334155', borderRadius: 12,
    padding: 16, fontSize: 16, color: '#fff',
  },
  tradeSummary: {
    marginHorizontal: 20, marginTop: 20, padding: 16,
    backgroundColor: '#0f172a', borderRadius: 12,
  },
  tradeSummaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tradeSummaryLabel: { fontSize: 14, color: '#94a3b8' },
  tradeSummaryValue: { fontSize: 18, fontWeight: '700', color: '#fff' },
  confirmBuyButton: {
    backgroundColor: '#10b981', marginHorizontal: 20, marginTop: 24,
    paddingVertical: 16, borderRadius: 12, alignItems: 'center',
  },
  confirmSellButton: {
    backgroundColor: '#ef4444', marginHorizontal: 20, marginTop: 24,
    paddingVertical: 16, borderRadius: 12, alignItems: 'center',
  },
  confirmButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  buttonDisabled: { opacity: 0.5 },
});