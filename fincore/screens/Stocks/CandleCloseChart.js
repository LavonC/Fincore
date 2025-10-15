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
} from 'react-native';
import Svg, { Path, Line, Text as SvgText, G } from 'react-native-svg';
import io from 'socket.io-client';
import axios from 'axios';
import {API_ENDPOINTS} from "../../apiConfig";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Market hours: 9:15 AM to 3:30 PM IST
const isMarketOpen = () => {
  const now = new Date();
  const hours = now.getHours();''
  const minutes = now.getMinutes();
  const currentTime = hours * 60 + minutes;
  
  const marketOpen = 9 * 60 + 15;  // 9:15 AM
  const marketClose = 15 * 60 + 30; // 3:30 PM
  
  // Check if it's a weekday (Monday = 1, Sunday = 0)
  const day = now.getDay();
  const isWeekday = day >= 1 && day <= 5;
  
  return isWeekday && currentTime >= marketOpen && currentTime < marketClose;
};

export default function StockDetailScreen({ route, navigation }) {
  const socketRef = useRef(null);
  const [companies, setCompanies] = useState([]);
  const [showCompanyPicker, setShowCompanyPicker] = useState(false);
  
  const [selectedCompany, setSelectedCompany] = useState({
    name: route?.params?.companyName || "Reliance Industries",
    symbol: route?.params?.symbol || "RELIANCE",
    symboltoken: route?.params?.symboltoken || "2885"
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
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [marketStatus, setMarketStatus] = useState(isMarketOpen());

  const periods = ['1D', '1W', '1M', '3M', '1Y', 'All'];

  // Check market status every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketStatus(isMarketOpen());
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  // Fetch companies list on mount
  useEffect(() => {
    fetchCompanies();
  }, []);

  // Load data when company or period changes
  useEffect(() => {
    loadData();
    
    return () => {
      disconnectSocket();
    };
  }, [selectedCompany, selectedPeriod]);

  const fetchCompanies = async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.COMPANIES);
      setCompanies(response.data);
    } catch (error) {
      console.error('❌ Error fetching companies:', error);
    }
  };

  const loadData = async () => {
    // Always load historical data first
    await fetchHistoricalData(selectedCompany.symboltoken, selectedPeriod);
    
    // Only connect to live stream if:
    // 1. Period is 1D (intraday)
    // 2. Market is open
    if (selectedPeriod === '1D' && marketStatus) {
      connectLiveSocket();
    }
  };

  const fetchHistoricalData = async (symboltoken, dateRange) => {
    try {
      console.log(`📊 Fetching historical data for ${symboltoken}, range: ${dateRange}`);
      setLoading(true);

      const response = await axios.get(API_ENDPOINTS.HISTORY, {
        params: {
          symboltoken: symboltoken,
          date_range: dateRange
        }
      });

      if (response.data.success) {
        const historicalData = response.data.data;
        
        // Format for chart with timestamps
        const formattedData = historicalData.map((candle) => ({
          timestamp: new Date(candle.timestamp).getTime(),
          price: candle.close,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          volume: candle.volume
        }));

        setChartData(formattedData);

        // Update stock data with latest candle
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
            change: change,
            changePercent: changePercent,
            prevClose: firstCandle.close,
          });
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('❌ Error fetching historical data:', error);
      setLoading(false);
    }
  };

  const connectLiveSocket = () => {
    console.log('🔌 Connecting to live socket...');
    
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(API_BASE_URL, {
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
      console.log('📩 Tick received:', message);

      // Don't process if market is closed
      if (!isMarketOpen()) {
        console.log('⏰ Market closed, ignoring tick');
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
              change: change,
              changePercent: changePercent,
              prevClose: prevClose,
            };
          });

          // Append new point to chart data
          setChartData((prev) => {
            const newPoint = {
              timestamp,
              price: ltp,
              open,
              high,
              low,
              volume
            };
            return [...prev, newPoint];
          });
        }
      } catch (err) {
        console.error('❌ Parse error:', err);
      }
    });

    socket.on('status', (data) => {
      console.log('📊 Status:', data);
    });

    socket.on('disconnect', () => {
      console.log('⚠️ Socket disconnected');
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
    });

    socketRef.current = socket;
  };

  const disconnectSocket = () => {
    if (socketRef.current) {
      console.log('🔌 Disconnecting socket');
      socketRef.current.emit('stop_stream');
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
    }
  };

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    setChartData([]);
    disconnectSocket();
  };

  const handleCompanySelect = (company) => {
    console.log('🏢 Selected company:', company);
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

    // Calculate price range
    const prices = chartData.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const pricePadding = priceRange * 0.1;

    const yMin = minPrice - pricePadding;
    const yMax = maxPrice + pricePadding;
    const yRange = yMax - yMin;

    // Scales
    const xScale = (chartWidth - padding.left - padding.right) / (chartData.length - 1);
    const yScale = (chartHeight - padding.top - padding.bottom) / yRange;

    // Generate path
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

    // Generate Y-axis labels
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
        {/* Y-axis grid lines and labels */}
        {yLabels.map((label, i) => (
          <G key={i}>
            <Line
              x1={padding.left}
              y1={label.y}
              x2={chartWidth - padding.right}
              y2={label.y}
              stroke="#2a2a2a"
              strokeWidth="1"
              strokeDasharray="4,4"
            />
            <SvgText
              x={chartWidth - padding.right + 5}
              y={label.y + 4}
              fill="#6b7280"
              fontSize="10"
            >
              ₹{label.price.toFixed(2)}
            </SvgText>
          </G>
        ))}

        {/* Price line */}
        <Path
          d={path}
          stroke={lineColor}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  };

  const isPositive = stockData.changePercent >= 0;

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowCompanyPicker(true)}>
            <Text style={styles.headerTitle}>{selectedCompany.symbol} ▼</Text>
          </TouchableOpacity>
          <View style={styles.placeholder} />
        </View>

        {/* Price Section */}
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

          {/* Chart */}
          {loading ? (
            <ActivityIndicator size="large" color="#4ade80" style={styles.loader} />
          ) : chartData.length > 0 ? (
            <View style={styles.chartContainer}>
              {renderChart()}
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>No data available</Text>
            </View>
          )}

          {/* Period Selector */}
          <View style={styles.periodContainer}>
            {periods.map((period) => (
              <TouchableOpacity
                key={period}
                onPress={() => handlePeriodChange(period)}
                style={[
                  styles.periodButton,
                  selectedPeriod === period && styles.periodButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.periodText,
                    selectedPeriod === period && styles.periodTextActive,
                  ]}
                >
                  {period}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Key Stats */}
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

        {/* Buy/Sell Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.buyButton}>
            <Text style={styles.buyButtonText}>Buy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sellButton}>
            <Text style={styles.sellButtonText}>Sell</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Company Picker Modal */}
      <Modal
        visible={showCompanyPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCompanyPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Company</Text>
              <TouchableOpacity onPress={() => setShowCompanyPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={companies}
              keyExtractor={(item) => item.symboltoken}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.companyItem}
                  onPress={() => handleCompanySelect(item)}
                >
                  <View>
                    <Text style={styles.companySymbol}>{item.symbol}</Text>
                    <Text style={styles.companyNameText}>{item.name}</Text>
                  </View>
                  {selectedCompany.symboltoken === item.symboltoken && (
                    <Text style={styles.selectedCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    fontSize: 24,
    color: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  priceSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  companyName: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 8,
  },
  priceText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  changeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  positive: {
    color: '#4ade80',
  },
  negative: {
    color: '#f87171',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ade80',
  },
  liveText: {
    fontSize: 11,
    color: '#4ade80',
    fontWeight: '600',
  },
  closedIndicator: {
    backgroundColor: '#ef444420',
  },
  closedText: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
  },
  chartContainer: {
    marginVertical: 24,
  },
  loader: {
    marginVertical: 60,
  },
  noDataContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 24,
  },
  noDataText: {
    color: '#6b7280',
    fontSize: 14,
  },
  periodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    backgroundColor: '#1f1f1f',
    borderRadius: 10,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: '#10b981',
  },
  periodText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  periodTextActive: {
    color: '#fff',
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  statsContainer: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    padding: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  statLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 16,
  },
  buyButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  sellButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  sellButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  modalClose: {
    fontSize: 28,
    color: '#9ca3af',
    fontWeight: '300',
  },
  companyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  companySymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  companyNameText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  selectedCheck: {
    fontSize: 24,
    color: '#10b981',
    fontWeight: '700',
  },
});