import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
} from 'react-native';

const FinancialDashboard = ({ navigation }) => {
  const [accountData] = useState({
    accountNumber: '1234567890',
    currentBalance: 5432.10,
    recentTransactions: [
      {
        id: 1,
        title: 'Grocery Store',
        date: '2023-09-15',
        amount: -75.50,
      },
      {
        id: 2,
        title: 'Salary Deposit',
        date: '2023-09-14',
        amount: 2500.00,
      },
      {
        id: 3,
        title: 'Online Purchase',
        date: '2023-09-13',
        amount: -120.00,
      },
    ],
  });

  const handleChangeConsent = () => {
    navigation.navigate('Consent');
  };

  const handleViewTransactions = () => {
    navigation.navigate('Transactions');
  };

  const handleUpdateTransactions = () => {
    console.log('Update Transactions');
  };

  const handleSwitchAccount = () => {
    navigation.navigate('Accounts');
  };

  const formatCurrency = (amount) => {
    const sign = amount >= 0 ? '+' : '-';
    const absAmount = Math.abs(amount).toFixed(2);
    return amount >= 0 ? `+$${absAmount}` : `-$${absAmount}`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1f2e" />
      
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Explore')}
            style={styles.backButton}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Financial Dashboard</Text>
          <TouchableOpacity style={styles.profileButton}>
            <Text style={styles.profileIcon}>👤</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Account Overview</Text>
              <Text style={styles.insightLink}>Insight</Text>
            </View>

            <View style={styles.balanceCard}>
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceLabel}>Current Balance</Text>
                <Text style={styles.accountNumber}>
                  Account Number: {accountData.accountNumber}
                </Text>
              </View>
              <Text style={styles.balanceAmount}>
                ${accountData.currentBalance.toFixed(2)}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>

            {accountData.recentTransactions.map((transaction) => (
              <View key={transaction.id} style={styles.transactionItem}>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionTitle}>{transaction.title}</Text>
                  <Text style={styles.transactionDate}>{transaction.date}</Text>
                </View>
                <Text
                  style={[
                    styles.transactionAmount,
                    transaction.amount >= 0
                      ? styles.positiveAmount
                      : styles.negativeAmount,
                  ]}
                >
                  {formatCurrency(transaction.amount)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleChangeConsent}
            >
              <Text style={styles.actionButtonText}>Change Consent</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleViewTransactions}
            >
              <Text style={styles.actionButtonText}>View Transactions</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleUpdateTransactions}
            >
              <Text style={styles.actionButtonText}>Update Transactions</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleSwitchAccount}
            >
              <Text style={styles.actionButtonText}>Switch Account</Text>
            </TouchableOpacity>
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
    borderBottomWidth: 1,
    borderBottomColor: '#2d3748',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: '#ffffff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  profileButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  profileIcon: {
    fontSize: 20,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  insightLink: {
    fontSize: 18,
    color: '#00d4d4',
    fontWeight: '500',
  },
  balanceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  balanceInfo: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 4,
  },
  accountNumber: {
    fontSize: 14,
    color: '#9ca3af',
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3748',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 14,
    color: '#9ca3af',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: '600',
  },
  positiveAmount: {
    color: '#10b981',
  },
  negativeAmount: {
    color: '#ffffff',
  },
  actionsContainer: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 32,
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#00d4d4',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1f2e',
  },
});

export default FinancialDashboard;