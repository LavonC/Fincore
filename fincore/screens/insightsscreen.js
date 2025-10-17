import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

const InsightsScreen = ({ navigation }) => {
  const [spendingData] = useState({
    totalSpending: 1250,
    changePercentage: -15,
    categories: [
      { name: 'Groceries', value: 150, percentage: 12 },
      { name: 'Dining', value: 450, percentage: 36 },
      { name: 'Entertainment', value: 100, percentage: 8 },
      { name: 'Utilities', value: 250, percentage: 20 },
      { name: 'Other', value: 300, percentage: 24 },
    ],
  });

  const [incomeData] = useState({
    netFlow: 3500,
    changePercentage: 20,
    monthlyData: [
      { month: 'Jan', value: 2500 },
      { month: 'Feb', value: 1500 },
      { month: 'Mar', value: 3000 },
      { month: 'Apr', value: 2000 },
      { month: 'May', value: 4500 },
      { month: 'Jun', value: 3200 },
    ],
  });

  const [statistics] = useState({
    averageMonthlySpending: 1500,
    largestTransaction: 450,
  });

  const getBarWidth = (percentage) => {
    const maxWidth = width - 180; // Account for padding and labels
    return (percentage / 100) * maxWidth;
  };

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
          <View style={styles.placeholder} />
        </View>

        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {/* Spending by Category Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Spending by Category</Text>

            <View style={styles.spendingCard}>
              <Text style={styles.label}>Spending</Text>
              <Text style={styles.amount}>${spendingData.totalSpending.toLocaleString()}</Text>
              <View style={styles.changeContainer}>
                <Text style={styles.changeLabel}>This Month </Text>
                <Text style={[
                  styles.changePercentage,
                  spendingData.changePercentage < 0 ? styles.negative : styles.positive
                ]}>
                  {spendingData.changePercentage > 0 ? '+' : ''}{spendingData.changePercentage}%
                </Text>
              </View>
            </View>

            {/* Category Bars */}
            <View style={styles.categoriesContainer}>
              {spendingData.categories.map((category, index) => (
                <View key={index} style={styles.categoryRow}>
                  <Text style={styles.categoryLabel}>{category.name}</Text>
                  <View 
                    style={[
                      styles.categoryBar, 
                      { width: getBarWidth(category.percentage) }
                    ]} 
                  />
                </View>
              ))}
            </View>
          </View>

          {/* Income vs Expenses Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Income vs. Expenses</Text>

            <View style={styles.netFlowCard}>
              <Text style={styles.label}>Net Flow</Text>
              <Text style={styles.amount}>${incomeData.netFlow.toLocaleString()}</Text>
              <View style={styles.changeContainer}>
                <Text style={styles.changeLabel}>Last 6 Months </Text>
                <Text style={[
                  styles.changePercentage,
                  incomeData.changePercentage > 0 ? styles.positive : styles.negative
                ]}>
                  {incomeData.changePercentage > 0 ? '+' : ''}{incomeData.changePercentage}%
                </Text>
              </View>
            </View>

            {/* Chart */}
            <View style={styles.chartContainer}>
              <View style={styles.chartLine}>
                {/* Simple line chart representation */}
                <View style={styles.linePath} />
              </View>
              
              {/* Month Labels */}
              <View style={styles.monthLabels}>
                {incomeData.monthlyData.map((item, index) => (
                  <Text key={index} style={styles.monthLabel}>{item.month}</Text>
                ))}
              </View>
            </View>
          </View>

          {/* Key Statistics Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Statistics</Text>

            <View style={styles.statisticsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Average Monthly{'\n'}Spending</Text>
                <Text style={styles.statAmount}>
                  ${statistics.averageMonthlySpending.toLocaleString()}
                </Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Largest{'\n'}Transaction</Text>
                <Text style={styles.statAmount}>
                  ${statistics.largestTransaction.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
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
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
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
    width: 140,
  },
  categoryBar: {
    height: 24,
    backgroundColor: '#3d4f5f',
    borderRadius: 4,
  },
  chartContainer: {
    marginVertical: 16,
  },
  chartLine: {
    height: 120,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  linePath: {
    height: 80,
    borderBottomWidth: 2,
    borderBottomColor: '#4a5f6f',
    borderStyle: 'solid',
  },
  monthLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 8,
  },
  monthLabel: {
    fontSize: 12,
    color: '#9ca3af',
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