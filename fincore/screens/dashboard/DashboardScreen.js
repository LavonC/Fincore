import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, SafeAreaView, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const DashboardScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [hasConsent, setHasConsent] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState(null);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    checkUserConsentAndLoadData();
  }, []);

  const checkUserConsentAndLoadData = async () => {
    try {
      setLoading(true);
      const email = await AsyncStorage.getItem('userEmail');
      
      if (!email) {
        setError('Please login again');
        setLoading(false);
        return;
      }

      setUserEmail(email);

      // Check if user has active consent
      const consentResponse = await axios.post('http://localhost:5000/checkUserConsent', {
        email: email
      });

      if (consentResponse.data.hasConsent) {
        setHasConsent(true);
        // Load user's financial data
        await loadFinancialData(email);
      } else {
        setHasConsent(false);
      }
    } catch (error) {
      console.error('Error checking consent:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFinancialData = async (email) => {
    try {
      // Get user's bank accounts
      const accountsResponse = await axios.post('http://localhost:5000/getUserAccounts', {
        email: email
      });

      if (accountsResponse.data.success && accountsResponse.data.accounts.length > 0) {
        setAccounts(accountsResponse.data.accounts);

        // Get transactions for first account
        const firstAccountId = accountsResponse.data.accounts[0].id;
        const transactionsResponse = await axios.post('http://localhost:5000/getAccountTransactions', {
          accountId: firstAccountId
        });

        if (transactionsResponse.data.success) {
          setTransactions(transactionsResponse.data.transactions);
        }
      }
    } catch (error) {
      console.error('Error loading financial data:', error);
      setError('Error loading financial data');
    }
  };

  const handleCreateConsent = () => {
    navigation.navigate('Consent', { userEmail: userEmail });
  };

  const handleViewAllAccounts = () => {
    navigation.navigate('Accounts', { accounts: accounts });
  };

  const handleViewAllTransactions = () => {
    navigation.navigate('Transactions', { 
      accountId: accounts[0]?.id,
      accountName: accounts[0]?.account_holder_name 
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading your financial data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={checkUserConsentAndLoadData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!hasConsent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noConsentContainer}>
          <Text style={styles.title}>Financial Dashboard</Text>
          <Text style={styles.noConsentText}>
            You haven't connected your bank accounts yet.
          </Text>
          <Text style={styles.subtitle}>
            Connect your accounts to view your financial data, transactions, and get personalized insights.
          </Text>
          
          <TouchableOpacity style={styles.connectButton} onPress={handleCreateConsent}>
            <Text style={styles.connectButtonText}>Connect Bank Accounts</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Show financial dashboard with data
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Financial Dashboard</Text>
          <TouchableOpacity onPress={checkUserConsentAndLoadData}>
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Accounts Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Bank Accounts</Text>
            {accounts.length > 1 && (
              <TouchableOpacity onPress={handleViewAllAccounts}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            )}
          </View>

          {accounts.length > 0 ? (
            <View style={styles.accountCard}>
              <Text style={styles.accountName}>{accounts[0].account_holder_name || 'Account'}</Text>
              <Text style={styles.accountNumber}>****{accounts[0].masked_account_number?.slice(-4) || '0000'}</Text>
              <Text style={styles.balance}>₹{accounts[0].current_balance?.toLocaleString('en-IN') || '0.00'}</Text>
              <Text style={styles.accountType}>{accounts[0].account_type || 'DEPOSIT'}</Text>
            </View>
          ) : (
            <Text style={styles.noDataText}>No accounts found</Text>
          )}
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            {transactions.length > 0 && (
              <TouchableOpacity onPress={handleViewAllTransactions}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            )}
          </View>

          {transactions.length > 0 ? (
            transactions.slice(0, 5).map((txn, index) => (
              <View key={txn.id || index} style={styles.transactionItem}>
                <View style={styles.transactionLeft}>
                  <Text style={styles.transactionNarration} numberOfLines={1}>
                    {txn.narration || 'Transaction'}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {new Date(txn.transaction_timestamp).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[
                  styles.transactionAmount,
                  txn.transaction_type === 'DEBIT' ? styles.debit : styles.credit
                ]}>
                  {txn.transaction_type === 'DEBIT' ? '-' : '+'}₹{Math.abs(txn.amount).toLocaleString('en-IN')}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>No transactions found</Text>
          )}
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.actionButton} onPress={handleCreateConsent}>
            <Text style={styles.actionButtonText}>Change Consent</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  noConsentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  noConsentText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
    lineHeight: 20,
  },
  connectButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
  },
  connectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
  },
  refreshText: {
    color: '#007AFF',
    fontSize: 16,
  },
  section: {
    backgroundColor: 'white',
    marginTop: 10,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  viewAllText: {
    color: '#007AFF',
    fontSize: 14,
  },
  accountCard: {
    backgroundColor: '#007AFF',
    padding: 20,
    borderRadius: 12,
  },
  accountName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  accountNumber: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 15,
  },
  balance: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  accountType: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  transactionLeft: {
    flex: 1,
  },
  transactionNarration: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#666',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  debit: {
    color: '#FF3B30',
  },
  credit: {
    color: '#34C759',
  },
  noDataText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  actionButton: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
});

export default DashboardScreen;
