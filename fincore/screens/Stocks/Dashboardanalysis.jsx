import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from "react-native";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from "lucide-react-native";
import { LineChart } from "react-native-chart-kit";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_ENDPOINTS } from "../../apiConfig";

const screenWidth = Dimensions.get("window").width;

const DashboardAnalysis = ({ navigation }) => {
  const [userId, setUserId] = useState(null);
  const [portfolioSummary, setPortfolioSummary] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);
  const [performanceLabels, setPerformanceLabels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState("1W");
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // 🔑 ADD YOUR GEMINI API KEY HERE
  const GEMINI_API_KEY = "AIzaSyDj9Mi1URoSkdsgIkDmMKL7gBtXqcc_JII";

  // Market indices data (mock - replace with real API)
  const [marketIndices] = useState([
    {
      name: "S&P 500",
      value: 4500.25,
      change: 0.5,
      changeValue: 22.5,
    },
    {
      name: "Dow Jones",
      value: 34000.75,
      change: -0.2,
      changeValue: -68.15,
    },
    {
      name: "NIFTY 50",
      value: 19850.3,
      change: 1.2,
      changeValue: 235.8,
    },
  ]);

  // Top movers data (calculated from holdings)
  const [topMovers, setTopMovers] = useState([]);

  useEffect(() => {
    loadUserIdAndFetchData();
  }, []);

  useEffect(() => {
    if (holdings.length > 0) {
      calculateTopMovers();
    }
  }, [holdings]);

  useEffect(() => {
    if (userId && holdings.length > 0) {
      fetchHistoricalPerformance();
    }
  }, [selectedTimeframe, holdings]);

  const loadUserIdAndFetchData = async () => {
    try {
      setIsLoading(true);
      const id = await AsyncStorage.getItem("user_id");
      if (id) {
        setUserId(id);
        await fetchAllData(id);
      }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllData = async (id) => {
    try {
      await Promise.all([
        fetchPortfolioSummary(id),
        fetchHoldings(id),
      ]);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  const fetchPortfolioSummary = async (id) => {
    try {
      const response = await axios.get(API_ENDPOINTS.PORTFOLIO_SUMMARY, {
        params: { user_id: id },
      });
      setPortfolioSummary(response.data);
    } catch (err) {
      console.error("Error fetching portfolio summary:", err);
    }
  };

  const fetchHoldings = async (id) => {
    try {
      const response = await axios.get(API_ENDPOINTS.GET_HOLDINGS, {
        params: { user_id: id },
      });
      setHoldings(response.data.holdings || []);
    } catch (err) {
      console.error("Error fetching holdings:", err);
    }
  };

  const fetchHistoricalPerformance = async () => {
    try {
      console.log("📊 Fetching historical performance for", holdings.length, "holdings");
      
      if (holdings.length === 0) {
        setPerformanceData([]);
        return;
      }

      // Fetch historical data for all holdings
      const historicalDataPromises = holdings.map(holding =>
        axios.get(API_ENDPOINTS.GET_HISTORICAL_DATA, {
          params: {
            symboltoken: holding.symbol_token,
            date_range: selectedTimeframe
          }
        }).catch(err => {
          console.error(`Error fetching data for ${holding.symbol}:`, err);
          return { data: { data: [] } };
        })
      );

      const historicalResponses = await Promise.all(historicalDataPromises);

      // Create a map of dates to portfolio values
      const datePortfolioMap = {};

      holdings.forEach((holding, index) => {
        const historicalData = historicalResponses[index]?.data?.data || [];
        
        historicalData.forEach(candle => {
          const date = candle.timestamp.split('T')[0]; // Get just the date
          const price = candle.close;
          
          if (!datePortfolioMap[date]) {
            datePortfolioMap[date] = 0;
          }

          // Calculate value: (current price - buy price) * quantity + invested amount
          // This gives us the actual portfolio value for that holding on that date
          const holdingValue = price * holding.quantity;
          datePortfolioMap[date] += holdingValue;
        });
      });

      // Sort dates and extract portfolio values
      const sortedDates = Object.keys(datePortfolioMap).sort();
      const portfolioValues = sortedDates.map(date => datePortfolioMap[date]);

      // Generate labels based on timeframe
      let labels = [];
      if (selectedTimeframe === "1W") {
        labels = sortedDates.map(date => {
          const d = new Date(date);
          return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
        });
      } else if (selectedTimeframe === "1M") {
        // Sample every few days
        labels = sortedDates.filter((_, i) => i % Math.ceil(sortedDates.length / 7) === 0)
          .map(date => {
            const d = new Date(date);
            return `${d.getDate()}/${d.getMonth() + 1}`;
          });
        const sampledValues = portfolioValues.filter((_, i) => i % Math.ceil(portfolioValues.length / 7) === 0);
        setPerformanceData(sampledValues);
        setPerformanceLabels(labels);
        return;
      } else if (selectedTimeframe === "3M" || selectedTimeframe === "6M") {
        // Sample to show key points
        labels = sortedDates.filter((_, i) => i % Math.ceil(sortedDates.length / 6) === 0)
          .map(date => {
            const d = new Date(date);
            return `${d.getDate()}/${d.getMonth() + 1}`;
          });
        const sampledValues = portfolioValues.filter((_, i) => i % Math.ceil(portfolioValues.length / 6) === 0);
        setPerformanceData(sampledValues);
        setPerformanceLabels(labels);
        return;
      } else if (selectedTimeframe === "1Y") {
        // Show monthly labels
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        labels = sortedDates.filter((_, i) => i % Math.ceil(sortedDates.length / 12) === 0)
          .map(date => {
            const d = new Date(date);
            return months[d.getMonth()];
          });
        const sampledValues = portfolioValues.filter((_, i) => i % Math.ceil(portfolioValues.length / 12) === 0);
        setPerformanceData(sampledValues);
        setPerformanceLabels(labels);
        return;
      }

      setPerformanceData(portfolioValues);
      setPerformanceLabels(labels);

      console.log("✅ Performance data calculated:", portfolioValues.length, "points");
    } catch (err) {
      console.error("Error fetching historical performance:", err);
      // Fallback to mock data
      generateMockPerformanceData();
    }
  };

  const generateMockPerformanceData = () => {
    // Fallback mock data if API fails
    const dataPoints = selectedTimeframe === "1Y" ? 12 : 
                      selectedTimeframe === "6M" ? 6 : 
                      selectedTimeframe === "3M" ? 3 : 
                      selectedTimeframe === "1M" ? 30 : 7;
    
    const data = [];
    let baseValue = portfolioSummary?.total_portfolio_value || 10000;
    
    for (let i = 0; i < dataPoints; i++) {
      const variation = (Math.random() - 0.4) * 500;
      baseValue += variation;
      data.push(baseValue);
    }
    
    setPerformanceData(data);
  };

  const calculateTopMovers = () => {
    const movers = holdings
      .map((holding) => ({
        name: holding.symbol,
        sector: holding.company_name,
        change: holding.pnl_percent || 0,
      }))
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 5);
    
    setTopMovers(movers);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (userId) {
      await fetchAllData(userId);
      if (holdings.length > 0) {
        await fetchHistoricalPerformance();
      }
    }
    setIsRefreshing(false);
  };

  const handleTimeframeChange = async (timeframe) => {
    setSelectedTimeframe(timeframe);
    // Historical data will be fetched automatically by useEffect
  };

  const generateAIAnalysis = async () => {
    // Check if API key is configured
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
      setAiAnalysis("⚠️ API Key not configured. Please add your Gemini API key in the code.");
      return;
    }

    setIsAnalyzing(true);
    try {
      // Prepare portfolio data for AI analysis
      const analysisData = {
        totalValue: portfolioSummary?.total_portfolio_value || 0,
        currentPnL: portfolioSummary?.current_pnl || 0,
        realizedPnL: portfolioSummary?.realized_pnl || 0,
        holdings: holdings.map(h => ({
          symbol: h.symbol,
          pnl: h.pnl || 0,
          pnlPercent: h.pnl_percent || 0,
          quantity: h.quantity,
        })),
        topMovers: topMovers,
      };

      const prompt = `Analyze this investment portfolio and provide a brief summary (max 150 words):
      
Portfolio Summary:
- Total Value: ₹${analysisData.totalValue.toFixed(2)}
- Current P&L: ₹${analysisData.currentPnL.toFixed(2)}
- Realized P&L: ₹${analysisData.realizedPnL.toFixed(2)}

Holdings: ${analysisData.holdings.map(h => `${h.symbol} (P&L: ${h.pnlPercent.toFixed(2)}%)`).join(", ")}

Top Movers: ${analysisData.topMovers.map(m => `${m.name} (${m.change > 0 ? '+' : ''}${m.change.toFixed(2)}%)`).join(", ")}

Provide: 
1. Overall portfolio health assessment
2. Risk analysis
3. One actionable recommendation`;

      console.log("🤖 Sending request to Gemini API...");
     const response = await axios.post(
  `https://generativelanguage.googleapis.com/v1beta/models/chat-bison-001:generateMessage?key=${GEMINI_API_KEY}`,
  {
    messages: [
      {
        author: "user",
        content: [{ text: prompt }]
      }
    ],
    temperature: 0.7,
    max_output_tokens: 500
  },
  { headers: { 'Content-Type': 'application/json' } }
);

      console.log("✅ Gemini API Response:", response.data);

      if (response.data.candidates && response.data.candidates[0]?.content?.parts[0]?.text) {
        const analysisText = response.data.candidates[0].content.parts[0].text;
        setAiAnalysis(analysisText);
      } else {
        console.error("Unexpected response format:", response.data);
        setAiAnalysis("⚠️ Received unexpected response from AI. Please try again.");
      }
    } catch (err) {
      console.error("❌ Full Error:", err);
      console.error("❌ Error Response:", err.response?.data);
      
      let errorMessage = "Failed to generate analysis. ";
      
      if (err.response) {
        // The request was made and the server responded with a status code
        const status = err.response.status;
        const errorData = err.response.data;
        
        if (status === 400) {
          errorMessage += `Invalid API key or request format. Error: ${errorData.error?.message || 'Bad Request'}`;
        } else if (status === 403) {
          errorMessage += "API key doesn't have permission. Please check:\n1. API key is valid\n2. Generative Language API is enabled\n3. Billing is set up";
        } else if (status === 429) {
          errorMessage += "Rate limit exceeded. Please try again later.";
        } else {
          errorMessage += `Server error (${status}): ${errorData.error?.message || 'Unknown error'}`;
        }
      } else if (err.request) {
        // The request was made but no response was received
        errorMessage += "No response from server. Check your internet connection.";
      } else {
        // Something happened in setting up the request
        errorMessage += `Request setup error: ${err.message}`;
      }
      
      setAiAnalysis(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatCurrency = (amount) => {
    return `₹${Number(amount).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
      </View>
    );
  }

  const portfolioChange = portfolioSummary?.current_pnl || 0;
  const portfolioChangePercent = portfolioSummary?.invested_amount > 0
    ? (portfolioChange / portfolioSummary.invested_amount) * 100
    : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft color="white" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <TouchableOpacity onPress={handleRefresh}>
          <RefreshCw color="white" size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Portfolio Section */}
        <Text style={styles.sectionTitle}>My Portfolio</Text>
        
        <View style={styles.portfolioCard}>
          <Text style={styles.portfolioLabel}>Total Value</Text>
          <Text style={styles.portfolioValue}>
            {formatCurrency(portfolioSummary?.total_portfolio_value || 0)}
          </Text>
          <View style={styles.portfolioChangeContainer}>
            {portfolioChangePercent >= 0 ? (
              <TrendingUp color="#10b981" size={18} />
            ) : (
              <TrendingDown color="#ef4444" size={18} />
            )}
            <Text
              style={[
                styles.portfolioChange,
                portfolioChangePercent >= 0 ? styles.profit : styles.loss,
              ]}
            >
              {portfolioChangePercent >= 0 ? "+" : ""}
              {portfolioChangePercent.toFixed(2)}%
            </Text>
          </View>
        </View>

        {/* Portfolio Performance Chart */}
        <View style={styles.performanceSection}>
          <View style={styles.performanceHeader}>
            <Text style={styles.sectionTitle}>Portfolio Performance</Text>
            <View style={styles.timeframeButtons}>
              {["1W", "1M", "3M", "6M", "1Y"].map((tf) => (
                <TouchableOpacity
                  key={tf}
                  style={[
                    styles.timeframeButton,
                    selectedTimeframe === tf && styles.timeframeButtonActive,
                  ]}
                  onPress={() => handleTimeframeChange(tf)}
                >
                  <Text
                    style={[
                      styles.timeframeButtonText,
                      selectedTimeframe === tf && styles.timeframeButtonTextActive,
                    ]}
                  >
                    {tf}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.performanceStats}>
            <Text style={[
              styles.performanceValue,
              portfolioChangePercent >= 0 ? styles.profit : styles.loss
            ]}>
              {portfolioChangePercent >= 0 ? "+" : ""}
              {portfolioChangePercent.toFixed(2)}%
            </Text>
            <Text style={[
              styles.performanceLabel,
              portfolioChangePercent >= 0 ? styles.profit : styles.loss
            ]}>
              {selectedTimeframe} {portfolioChangePercent >= 0 ? "+" : ""}
              {formatCurrency(portfolioChange)}
            </Text>
          </View>

          {performanceData.length > 0 ? (
            <LineChart
              data={{
                labels: performanceLabels.length > 0 ? performanceLabels : [""],
                datasets: [
                  {
                    data: performanceData.length > 0 ? performanceData : [0],
                  },
                ],
              }}
              width={screenWidth - 32}
              height={220}
              chartConfig={{
                backgroundColor: "#1e293b",
                backgroundGradientFrom: "#1e293b",
                backgroundGradientTo: "#1e293b",
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: "0",
                },
                propsForBackgroundLines: {
                  strokeDasharray: "",
                  stroke: "#334155",
                  strokeWidth: 1,
                },
              }}
              bezier
              style={styles.chart}
              withInnerLines={true}
              withOuterLines={false}
              withVerticalLabels={true}
              withHorizontalLabels={true}
              withDots={false}
            />
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>
                {holdings.length === 0 
                  ? "No holdings to display performance chart"
                  : "Loading historical data..."}
              </Text>
            </View>
          )}
        </View>

        {/* AI Analysis Section */}
        <View style={styles.aiSection}>
          <View style={styles.aiHeader}>
            <Text style={styles.sectionTitle}>AI Portfolio Analysis</Text>
            <TouchableOpacity
              style={styles.analyzeButton}
              onPress={generateAIAnalysis}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.analyzeButtonText}>Analyze</Text>
              )}
            </TouchableOpacity>
          </View>
          
          {aiAnalysis ? (
            <View style={styles.aiAnalysisCard}>
              <Text style={styles.aiAnalysisText}>{aiAnalysis}</Text>
            </View>
          ) : (
            <View style={styles.aiPlaceholder}>
              <Text style={styles.aiPlaceholderText}>
                Get AI-powered insights about your portfolio performance, risk assessment, and recommendations.
              </Text>
            </View>
          )}
        </View>

        {/* Market Indices */}
        <Text style={styles.sectionTitle}>Market Indices</Text>
        <View style={styles.indicesContainer}>
          {marketIndices.map((index, idx) => (
            <View key={idx} style={styles.indexCard}>
              <Text style={styles.indexName}>{index.name}</Text>
              <Text style={styles.indexValue}>
                {index.value.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
              <View style={styles.indexChange}>
                {index.change >= 0 ? (
                  <TrendingUp color="#10b981" size={16} />
                ) : (
                  <TrendingDown color="#ef4444" size={16} />
                )}
                <Text
                  style={[
                    styles.indexChangeText,
                    index.change >= 0 ? styles.profit : styles.loss,
                  ]}
                >
                  {index.change >= 0 ? "+" : ""}
                  {index.change.toFixed(1)}%
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Top Movers */}
        <Text style={styles.sectionTitle}>Top Movers</Text>
        <View style={styles.moversContainer}>
          {topMovers.length > 0 ? (
            topMovers.map((mover, index) => (
              <View key={index} style={styles.moverCard}>
                <View style={styles.moverInfo}>
                  <Text style={styles.moverName}>{mover.name}</Text>
                  <Text style={styles.moverSector}>{mover.sector}</Text>
                </View>
                <View style={styles.moverChange}>
                  {mover.change >= 0 ? (
                    <TrendingUp color="#10b981" size={18} />
                  ) : (
                    <TrendingDown color="#ef4444" size={18} />
                  )}
                  <Text
                    style={[
                      styles.moverChangeText,
                      mover.change >= 0 ? styles.profit : styles.loss,
                    ]}
                  >
                    {mover.change >= 0 ? "+" : ""}
                    {mover.change.toFixed(2)}%
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>
              No holdings to show top movers
            </Text>
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: "#0f172a",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "white",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
  loadingText: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
    marginTop: 24,
    marginBottom: 12,
  },
  portfolioCard: {
    backgroundColor: "#1e3a3a",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#2d4a4a",
  },
  portfolioLabel: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 8,
  },
  portfolioValue: {
    fontSize: 36,
    fontWeight: "700",
    color: "white",
    marginBottom: 12,
  },
  portfolioChangeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  portfolioChange: {
    fontSize: 18,
    fontWeight: "600",
  },
  performanceSection: {
    marginTop: 8,
  },
  performanceHeader: {
    marginBottom: 16,
  },
  timeframeButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  timeframeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#1e293b",
  },
  timeframeButtonActive: {
    backgroundColor: "#10b981",
  },
  timeframeButtonText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "500",
  },
  timeframeButtonTextActive: {
    color: "white",
  },
  performanceStats: {
    marginBottom: 16,
  },
  performanceValue: {
    fontSize: 32,
    fontWeight: "700",
  },
  performanceLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  noDataContainer: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
    borderStyle: "dashed",
  },
  noDataText: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
  },
  aiSection: {
    marginTop: 8,
  },
  aiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  analyzeButton: {
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },
  analyzeButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  aiAnalysisCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  aiAnalysisText: {
    color: "#e2e8f0",
    fontSize: 14,
    lineHeight: 22,
  },
  aiPlaceholder: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    borderStyle: "dashed",
  },
  aiPlaceholderText: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  indicesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  indexCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    flex: 1,
    minWidth: "30%",
    borderWidth: 1,
    borderColor: "#334155",
  },
  indexName: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 8,
    fontWeight: "500",
  },
  indexValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "white",
    marginBottom: 8,
  },
  indexChange: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  indexChangeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  moversContainer: {
    gap: 10,
  },
  moverCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  moverInfo: {
    flex: 1,
  },
  moverName: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
    marginBottom: 4,
  },
  moverSector: {
    fontSize: 12,
    color: "#64748b",
  },
  moverChange: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  moverChangeText: {
    fontSize: 16,
    fontWeight: "600",
  },
  profit: {
    color: "#10b981",
  },
  loss: {
    color: "#ef4444",
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 20,
  },
});

export default DashboardAnalysis;