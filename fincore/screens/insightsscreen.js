import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_ENDPOINTS } from '../apiConfig';
import { LineChart } from 'react-native-chart-kit';

const { width } = Dimensions.get('window');

const InsightsScreen = ({ navigation, route }) => {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [accountId, setAccountId] = useState(null);
  const [accountInfo, setAccountInfo] = useState(null);
  const [insight, setInsight] = useState(null);
  const [financialSummary, setFinancialSummary] = useState(null);
  
  // Load account and generate/fetch insight
  useEffect(() => {
    loadAccountAndInsight();
  }, []);
  
  const loadAccountAndInsight = async () => {
    try {
      // Get accountId from route params
      const accId = route?.params?.accountId;
      
      if (!accId) {
        Alert.alert('Error', 'No account selected');
        navigation.goBack();
        return;
      }
      
      setAccountId(accId);
      
      // Fetch financial summary and generate insight for this account
      await Promise.all([
        fetchFinancialSummary(accId),
        generateInsight(accId)
      ]);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading insight:', error);
      Alert.alert('Error', 'Failed to load insights');
      setLoading(false);
    }
  };
  
  const fetchFinancialSummary = async (accId) => {
    try {
      const response = await axios.post(API_ENDPOINTS.INSIGHTS_FINANCIAL_SUMMARY, { 
        account_id: accId 
      });
      
      if (response.data.success) {
        setFinancialSummary(response.data.summary);
        if (response.data.account_info) {
          setAccountInfo(response.data.account_info);
        }
      }
    } catch (error) {
      console.error('Error fetching financial summary:', error);
    }
  };
  
  const generateInsight = async (accId) => {
    try {
      setGenerating(true);
      
      const response = await axios.post(API_ENDPOINTS.INSIGHTS_GENERATE, { 
        account_id: accId 
      });
      
      if (response.data.success) {
        setInsight(response.data.insight);
        if (response.data.account_info) {
          setAccountInfo(response.data.account_info);
        }
        
        if (response.data.cached) {
          console.log('📊 Using cached insight');
        } else {
          console.log('✨ New insight generated');
        }
      }
    } catch (error) {
      console.error('Error generating insight:', error);
      Alert.alert('Error', 'Failed to generate insight');
    } finally {
      setGenerating(false);
    }
  };
  
  const handleRefreshInsight = async () => {
    if (!accountId) return;
    
    setGenerating(true);
    try {
      await Promise.all([
        fetchFinancialSummary(accountId),
        generateInsight(accountId)
      ]);
    } catch (error) {
      console.error('Error refreshing insight:', error);
      Alert.alert('Error', 'Failed to refresh insight');
    } finally {
      setGenerating(false);
    }
  };

  const getBarWidth = (percentage) => {
    const maxWidth = width - 180; // Account for padding and labels
    return (percentage / 100) * maxWidth;
  };
  
  const formatCurrency = (amount) => {
    return `₹${amount?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}`;
  };
  
  const formatMonth = (monthStr) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames[parseInt(month) - 1];
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1a1f2e" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Insights</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#16A085" />
            <Text style={styles.loadingText}>Generating your financial insights...</Text>
            <Text style={styles.loadingSubtext}>Analyzing transactions and patterns (20-30 seconds)</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1f2e" />
      
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.closeButton}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Insights</Text>
          <TouchableOpacity 
            onPress={handleRefreshInsight}
            style={styles.refreshButton}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator size="small" color="#16A085" />
            ) : (
              <Text style={styles.refreshIcon}>↻</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {/* AI Insight Section */}
          {insight && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💡 AI Insight</Text>
              <View style={styles.insightCard}>
                <Text style={styles.insightTitle}>{insight.title}</Text>
                <Text style={styles.insightSummary}>{insight.summary}</Text>
                
                {insight.ai_analysis && (
                  <View style={styles.analysisContainer}>
                    <Text style={styles.analysisTitle}>Analysis:</Text>
                    <Text style={styles.analysisText}>{insight.ai_analysis}</Text>
                  </View>
                )}
                
                {insight.recommendations && insight.recommendations.length > 0 && (
                  <View style={styles.recommendationsContainer}>
                    <Text style={styles.recommendationsTitle}>Recommendations:</Text>
                    {insight.recommendations.map((rec, index) => (
                      <Text key={index} style={styles.recommendationText}>{rec}</Text>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}
          
          {/* Spending by Category Section */}
          {financialSummary && financialSummary.categories && financialSummary.categories.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Spending by Category</Text>

              <View style={styles.spendingCard}>
                <Text style={styles.label}>Total Spending (90 days)</Text>
                <Text style={styles.amount}>{formatCurrency(financialSummary.total_expenses)}</Text>
                <View style={styles.changeContainer}>
                  <Text style={styles.changeLabel}>Savings Rate: </Text>
                  <Text style={[
                    styles.changePercentage,
                    financialSummary.savings_rate > 0 ? styles.positive : styles.negative
                  ]}>
                    {financialSummary.savings_rate?.toFixed(1)}%
                  </Text>
                </View>
              </View>

              {/* Category Bars */}
              <View style={styles.categoriesContainer}>
                {financialSummary.categories.slice(0, 5).map((category, index) => (
                  <View key={index} style={styles.categoryRow}>
                    <Text style={styles.categoryLabel}>{category.name}</Text>
                    <View 
                      style={[
                        styles.categoryBar, 
                        { width: getBarWidth(category.percentage) }
                      ]} 
                    />
                    <Text style={styles.categoryValue}>
                      {formatCurrency(category.value)} ({category.percentage}%)
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Income vs Expenses Section */}
          {financialSummary && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Financial Overview</Text>

              {/* Summary Stats Grid */}
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statIcon}>💰</Text>
                  <Text style={styles.statValue}>{formatCurrency(financialSummary.total_income)}</Text>
                  <Text style={styles.statLabel}>Total Income</Text>
                </View>
                
                <View style={styles.statBox}>
                  <Text style={styles.statIcon}>💸</Text>
                  <Text style={styles.statValue}>{formatCurrency(financialSummary.total_expenses)}</Text>
                  <Text style={styles.statLabel}>Total Expenses</Text>
                </View>
                
                <View style={styles.statBox}>
                  <Text style={styles.statIcon}>📊</Text>
                  <Text style={[
                    styles.statValue,
                    financialSummary.net_savings >= 0 ? styles.positive : styles.negative
                  ]}>
                    {formatCurrency(financialSummary.net_savings)}
                  </Text>
                  <Text style={styles.statLabel}>Net Savings</Text>
                  <Text style={styles.statSubtext}>{financialSummary.savings_rate?.toFixed(1)}% rate</Text>
                </View>
                
                <View style={styles.statBox}>
                  <Text style={styles.statIcon}>🏦</Text>
                  <Text style={styles.statValue}>{formatCurrency(financialSummary.account_balance)}</Text>
                  <Text style={styles.statLabel}>Current Balance</Text>
                </View>
              </View>

              {/* Balance Line Graph */}
              {financialSummary.balance_history && financialSummary.balance_history.length > 1 && (
                <View style={styles.lineGraphContainer}>
                  <Text style={styles.graphTitle}>Balance Trend (Last 90 Days)</Text>
                  
                  <LineChart
                    data={{
                      labels: (() => {
                        const history = financialSummary.balance_history;
                        const maxLabels = 6;
                        const step = Math.ceil(history.length / maxLabels);
                        return history
                          .filter((_, i) => i % step === 0 || i === history.length - 1)
                          .map(item => {
                            const date = new Date(item.date);
                            return `${date.getDate()}/${date.getMonth() + 1}`;
                          });
                      })(),
                      datasets: [{
                        data: (() => {
                          const history = financialSummary.balance_history;
                          const maxLabels = 6;
                          const step = Math.ceil(history.length / maxLabels);
                          return history
                            .filter((_, i) => i % step === 0 || i === history.length - 1)
                            .map(item => item.balance);
                        })()
                      }]
                    }}
                    width={width - 64}
                    height={280}
                    yAxisLabel="₹"
                    yAxisSuffix=""
                    chartConfig={{
                      backgroundColor: '#1e293b',
                      backgroundGradientFrom: '#1e293b',
                      backgroundGradientTo: '#0f172a',
                      decimalPlaces: 0,
                      color: (opacity = 1) => `rgba(22, 160, 133, ${opacity})`,
                      labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
                      style: {
                        borderRadius: 16,
                      },
                      propsForDots: {
                        r: '5',
                        strokeWidth: '2',
                        stroke: '#16A085'
                      },
                      propsForBackgroundLines: {
                        strokeDasharray: '',
                        stroke: '#334155',
                        strokeOpacity: 0.3,
                      },
                    }}
                    bezier
                    style={{
                      marginVertical: 8,
                      borderRadius: 16,
                    }}
                    formatYLabel={(value) => {
                      const num = parseFloat(value);
                      if (num >= 100000) return `${(num / 100000).toFixed(1)}L`;
                      if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
                      return num.toFixed(0);
                    }}
                  />
                  
                  {/* Balance Summary */}
                  <View style={styles.balanceSummary}>
                    <View style={styles.balanceStat}>
                      <Text style={styles.balanceStatLabel}>Highest</Text>
                      <Text style={styles.balanceStatValue}>
                        {formatCurrency(Math.max(...financialSummary.balance_history.map(b => b.balance)))}
                      </Text>
                    </View>
                    <View style={styles.balanceStat}>
                      <Text style={styles.balanceStatLabel}>Lowest</Text>
                      <Text style={styles.balanceStatValue}>
                        {formatCurrency(Math.min(...financialSummary.balance_history.map(b => b.balance)))}
                      </Text>
                    </View>
                    <View style={styles.balanceStat}>
                      <Text style={styles.balanceStatLabel}>Current Balance</Text>
                      <Text style={[styles.balanceStatValue, styles.currentBalance]}>
                        {formatCurrency(financialSummary.account_balance)}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Monthly Data Removed - graph shows the trend now */}

          {/* Key Statistics Section */}
          {financialSummary && financialSummary.statistics && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Key Statistics</Text>

              <View style={styles.statisticsContainer}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Average Monthly{'\n'}Spending</Text>
                  <Text style={styles.statAmount}>
                    {formatCurrency(financialSummary.statistics.average_monthly_spending)}
                  </Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Largest{'\n'}Transaction</Text>
                  <Text style={styles.statAmount}>
                    {formatCurrency(financialSummary.statistics.largest_transaction)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.statisticsContainer}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Total{'\n'}Transactions</Text>
                  <Text style={styles.statAmount}>
                    {financialSummary.statistics.transaction_count || 0}
                  </Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Average{'\n'}Transaction</Text>
                  <Text style={styles.statAmount}>
                    {formatCurrency(financialSummary.statistics.average_transaction)}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1f2e',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  closeIcon: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  placeholder: {
    width: 40,
  },
  refreshButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshIcon: {
    fontSize: 24,
    color: '#16A085',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9ca3af',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  insightCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#16A085',
  },
  insightTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  insightSummary: {
    fontSize: 16,
    color: '#d1d5db',
    lineHeight: 24,
    marginBottom: 16,
  },
  analysisContainer: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  analysisTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16A085',
    marginBottom: 8,
  },
  analysisText: {
    fontSize: 15,
    color: '#d1d5db',
    lineHeight: 24,
  },
  recommendationsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16A085',
    marginBottom: 12,
  },
  recommendationText: {
    fontSize: 15,
    color: '#d1d5db',
    lineHeight: 24,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  spendingCard: {
    marginBottom: 24,
  },
  netFlowCard: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 8,
  },
  amount: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  changePercentage: {
    fontSize: 14,
    fontWeight: '600',
  },
  positive: {
    color: '#10b981',
  },
  negative: {
    color: '#ef4444',
  },
  categoriesContainer: {
    gap: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryLabel: {
    fontSize: 16,
    color: '#9ca3af',
    width: 100,
  },
  categoryBar: {
    height: 24,
    backgroundColor: '#16A085',
    borderRadius: 4,
    marginRight: 8,
    minWidth: 10,
  },
  categoryValue: {
    fontSize: 14,
    color: '#d1d5db',
    width: 120,
    textAlign: 'right',
  },
  monthlyDataContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    flexWrap: 'wrap',
  },
  monthlyDataItem: {
    width: (width - 60) / 3,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  monthLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  monthIncome: {
    fontSize: 13,
    color: '#10b981',
    marginBottom: 4,
  },
  monthExpense: {
    fontSize: 13,
    color: '#ef4444',
    marginBottom: 4,
  },
  monthNet: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  
  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 12,
  },
  statBox: {
    flex: 1,
    minWidth: (width - 60) / 2,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
  statSubtext: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  
  // Line Graph Styles
  lineGraphContainer: {
    marginTop: 24,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  graphTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 12,
    textAlign: 'center',
  },
  balanceSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  balanceStat: {
    alignItems: 'center',
  },
  balanceStatLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  balanceStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  currentBalance: {
    color: '#16A085',
  },
  
  // Old balance graph styles (can be removed eventually)
  balanceGraphContainer: {
    marginTop: 20,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
  },
  balanceGraph: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 150,
    paddingHorizontal: 8,
  },
  balanceBarContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  balanceBarWrapper: {
    height: 100,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  balanceBar: {
    backgroundColor: '#16A085',
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 4,
  },
  balanceGraphMonth: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 6,
  },
  balanceGraphValue: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  statisticsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  statLabel: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 12,
    lineHeight: 20,
  },
  statAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});

export default InsightsScreen;