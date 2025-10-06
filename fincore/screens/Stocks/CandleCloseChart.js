// StockDetailScreen.js
// React Native Stock Detail Screen with Live WebSocket Data
// 
// Installation required:
// npm install react-native-svg socket.io-client
// 
// Usage:
// <StockDetailScreen route={{ params: { symboltoken: '2885', symbol: 'AAPL' } }} />

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import io from 'socket.io-client';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CandleCloseChart({ route, navigation }) {
  console.log(route?.params, "route params");
const { stockSymbol = "2885", companyName = "Reliance Industries" } = route?.params || {};

 const symbol = stockSymbol; // just an alias

// Use stockSymbol for display and lookup


  const [stockData, setStockData] = useState({
    symbol: symbol,
    price: 0,
    change: 0,
    open: 0,
    high: 0,
    low: 0,
    volume: '0M',
    peRatio: '25.5x',
    divYield: '0.6%',
    eps: 6.85,
    marketCap: '2.8T',
  });

  const [chartData, setChartData] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('1D');
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io('http://192.168.1.2:5000', {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('✅ Socket connected');
      setConnected(true);
      setLoading(false);
      socket.emit('start_stream', { stockSymbol });
    });

    socket.on('live_tick', (message) => {
      console.log('📩 Tick received:', message);

      try {
        const data = typeof message === 'string' ? JSON.parse(message) : message;

        // Angel One WebSocket data structure
        if (data.last_traded_price || data.ltp) {
          const ltp = data.last_traded_price || data.ltp;
          const high = data.high_price || data.high || 0;
          const low = data.low_price || data.low || 0;
          const open = data.open_price || data.open || 0;
          const volume = data.volume_trade || data.volume || 0;

          setStockData((prev) => {
            const prevPrice = prev.price || ltp / 100;
            const newPrice = ltp / 100;
            const change = ((newPrice - prevPrice) / prevPrice) * 100;

            return {
              ...prev,
              price: newPrice,
              high: high / 100,
              low: low / 100,
              open: open / 100,
              volume: (volume / 1000000).toFixed(1) + 'M',
              change: change.toFixed(2),
            };
          });

          setChartData((prev) => {
            const newPoint = { x: prev.length, y: ltp / 100 };
            return [...prev, newPoint].slice(-50); // Keep last 50 points
          });
        }
      } catch (err) {
        console.error('Parse error:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log('⚠️ Socket disconnected');
      setConnected(false);
    });

    return () => socket.disconnect();
  }, [stockSymbol]);

  const periods = ['1D', '1W', '1M', '3M', '1Y', 'All'];

  const generatePath = () => {
    if (chartData.length < 2) return '';

    const chartWidth = SCREEN_WIDTH - 48;
    const chartHeight = 150;
    const padding = 10;

    const xScale = (chartWidth - 2 * padding) / (chartData.length - 1);
    const yMin = Math.min(...chartData.map((d) => d.y));
    const yMax = Math.max(...chartData.map((d) => d.y));
    const yScale = (chartHeight - 2 * padding) / (yMax - yMin || 1);

    let path = '';

    chartData.forEach((point, i) => {
      const x = padding + i * xScale;
      const y = chartHeight - padding - (point.y - yMin) * yScale;

      if (i === 0) {
        path += `M ${x} ${y}`;
      } else {
        const prevPoint = chartData[i - 1];
        const prevX = padding + (i - 1) * xScale;
        const prevY = chartHeight - padding - (prevPoint.y - yMin) * yScale;

        const cpX1 = prevX + (x - prevX) / 3;
        const cpX2 = prevX + (2 * (x - prevX)) / 3;

        path += ` C ${cpX1} ${prevY}, ${cpX2} ${y}, ${x} ${y}`;
      }
    });

    return path;
  };

  const isPositive = stockData.change >= 0;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
  <Text style={styles.backIcon}>←</Text>
</TouchableOpacity>

        <Text style={styles.headerTitle}>{stockData.symbol}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Price Section */}
      <View style={styles.priceSection}>
        <Text style={styles.symbolText}>{stockData.symbol}</Text>
        <Text style={styles.priceText}>₹{stockData.price.toFixed(2)}</Text>
        <View style={styles.changeContainer}>
          <Text style={[styles.changeText, isPositive ? styles.positive : styles.negative]}>
            Today {isPositive ? '+' : ''}{stockData.change}%
          </Text>
          {connected && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          )}
        </View>

        {/* Chart */}
        {loading ? (
          <ActivityIndicator size="large" color="#4ade80" style={styles.loader} />
        ) : chartData.length > 0 ? (
          <View style={styles.chartContainer}>
            <Svg height="150" width={SCREEN_WIDTH - 48}>
              <Defs>
                <LinearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#4ade80" stopOpacity="0.8" />
                  <Stop offset="100%" stopColor="#22c55e" stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Path
                d={generatePath()}
                stroke="url(#lineGradient)"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        ) : (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>Waiting for live data...</Text>
          </View>
        )}

        {/* Period Selector */}
        <View style={styles.periodContainer}>
          {periods.map((period) => (
            <TouchableOpacity
              key={period}
              onPress={() => setSelectedPeriod(period)}
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

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.aboutText}>
          Apple Inc. designs, manufactures, and markets smartphones, personal computers,
          tablets, wearables, and accessories worldwide. It also sells various related
          services.
        </Text>
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
            <Text style={styles.statLabel}>P/E Ratio</Text>
            <Text style={styles.statValue}>{stockData.peRatio}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Div Yield</Text>
            <Text style={styles.statValue}>{stockData.divYield}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>EPS</Text>
            <Text style={styles.statValue}>₹{stockData.eps}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Market Cap</Text>
            <Text style={styles.statValue}>₹{stockData.marketCap}</Text>
          </View>
        </View>
      </View>

      {/* Analyst Ratings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Analyst Ratings</Text>
        <View style={styles.ratingsContainer}>
          <View style={styles.ratingLeft}>
            <Text style={styles.ratingScore}>4.5</Text>
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Text key={star} style={star <= 4 ? styles.starFilled : styles.starEmpty}>
                  ★
                </Text>
              ))}
            </View>
            <Text style={styles.reviewCount}>25 reviews</Text>
          </View>
          <View style={styles.ratingRight}>
            {[
              { rating: 5, percent: 50, color: '#4ade80' },
              { rating: 4, percent: 30, color: '#4ade80' },
              { rating: 3, percent: 10, color: '#fbbf24' },
              { rating: 2, percent: 5, color: '#f87171' },
              { rating: 1, percent: 5, color: '#f87171' },
            ].map((item) => (
              <View key={item.rating} style={styles.ratingBar}>
                <Text style={styles.ratingNumber}>{item.rating}</Text>
                <View style={styles.barBackground}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${item.percent}%`, backgroundColor: item.color },
                    ]}
                  />
                </View>
                <Text style={styles.percentText}>{item.percent}%</Text>
              </View>
            ))}
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
  symbolText: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 4,
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
  },
  changeText: {
    fontSize: 14,
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
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  liveText: {
    fontSize: 12,
    color: '#4ade80',
  },
  chartContainer: {
    marginVertical: 24,
  },
  loader: {
    marginVertical: 40,
  },
  noDataContainer: {
    height: 150,
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
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: '#1f1f1f',
  },
  periodText: {
    fontSize: 14,
    fontWeight: '500',
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
  aboutText: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 22,
  },
  statsContainer: {
    gap: 0,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  statLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  ratingsContainer: {
    flexDirection: 'row',
    gap: 24,
  },
  ratingLeft: {
    alignItems: 'flex-start',
  },
  ratingScore: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 4,
  },
  starFilled: {
    fontSize: 18,
    color: '#fbbf24',
  },
  starEmpty: {
    fontSize: 18,
    color: '#374151',
  },
  reviewCount: {
    fontSize: 12,
    color: '#9ca3af',
  },
  ratingRight: {
    flex: 1,
    gap: 8,
  },
  ratingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingNumber: {
    fontSize: 12,
    color: '#9ca3af',
    width: 12,
  },
  barBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#1f1f1f',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentText: {
    fontSize: 12,
    color: '#9ca3af',
    width: 36,
    textAlign: 'right',
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
  },
  buyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  sellButton: {
    flex: 1,
    backgroundColor: '#374151',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  sellButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});