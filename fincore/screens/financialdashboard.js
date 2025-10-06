import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_ENDPOINTS } from '../apiConfig';

const FinancialDashboard = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [hasConsent, setHasConsent] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [currentAccount, setCurrentAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    loadUserDataAndCheckConsent();
    
    const unsubscribe = navigation.addListener('focus', () => {
      loadUserDataAndCheckConsent();
    });
    
    return unsubscribe;
  }, [navigation]);

  const loadUserDataAndCheckConsent = async () => {
    try {
      setLoading(true);
      const email = await AsyncStorage.getItem('userEmail');
      
      if (!email) {
        Alert.alert('Error', 'Please login again');
        return;
      }

      setUserEmail(email);

      // Check if user has consent
      const consentResponse = await axios.post(API_ENDPOINTS.CHECK_USER_CONSENT, {
        email: email
      });

      if (consentResponse.data.hasConsent) {
        setHasConsent(true);
        await loadFinancialData(email);
      } else {
        setHasConsent(false);
      }
    } catch (error) {
      console.error('Error checking consent:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadFinancialData = async (email) => {
    try {
      // Get user's bank accounts
      const accountsResponse = await axios.post(API_ENDPOINTS.GET_USER_ACCOUNTS, {
        email: email
      });

      if (accountsResponse.data.success && accountsResponse.data.accounts.length > 0) {
        const userAccounts = accountsResponse.data.accounts;
        setAccounts(userAccounts);

        // Check if there's a selected account in storage
        const selectedAccountId = await AsyncStorage.getItem('selectedAccountId');
        let accountToShow = userAccounts[0];
        
        if (selectedAccountId) {
          const found = userAccounts.find(acc => acc.id === parseInt(selectedAccountId));
          if (found) accountToShow = found;
        }
        
        setCurrentAccount(accountToShow);

        // Get transactions for this account
        const transactionsResponse = await axios.post(API_ENDPOINTS.GET_ACCOUNT_TRANSACTIONS, {
          accountId: accountToShow.id
        });

        if (transactionsResponse.data.success) {
          setTransactions(transactionsResponse.data.transactions.slice(0, 3));
        }
      }
    } catch (error) {
      console.error('Error loading financial data:', error);
    }
  };

  const handleChangeConsent = () => {
    navigation.navigate('Consent', { userEmail });
  };

  const handleViewTransactions = () => {
    if (currentAccount) {
      navigation.navigate('Transactions', { 
        accountId: currentAccount.id,
        accountName: currentAccount.account_holder_name || 'Account'
      });
    }
  };

  const handleUpdateTransactions = async () => {
    await loadUserDataAndCheckConsent();
    Alert.alert('Success', 'Data refreshed successfully');
  };

  const handleSwitchAccount = () => {
    navigation.navigate('Accounts');
  };

  const formatCurrency = (amount) => {
    const absAmount = Math.abs(amount).toFixed(2);
    return amount >= 0 ? `+₹${absAmount}` : `-₹${absAmount}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  const formatTransactionName = (narration, type) => {
    if (!narration) return type === 'CREDIT' ? 'Money Received' : 'Payment';
    
    // Format: MODE/TYPE/ID/NAME/CODE/NUMBER
    // Example: FT/CR/718148753341/Yashvi Zachariah/QBBL/24459093
    const parts = narration.trim().split('/');
    
    // The name is the 4th element (index 3)
    if (parts.length >= 4) {
      const name = parts[3].trim();
      if (name && name.length > 0) {
        // Capitalize properly
        const formattedName = name.split(' ')
          .filter(word => word.length > 0)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        
        // Limit to 35 characters
        if (formattedName.length > 35) {
          return formattedName.substring(0, 32) + '...';
        }
        
        return formattedName;
      }
    }
    
    // Fallback for unexpected formats
    return type === 'CREDIT' ? 'Money Received' : 'Payment';
  };



  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#00d4d4" />
        <Text style={{ color: '#ffffff', marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  if (!hasConsent) {
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

          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#ffffff', marginBottom: 20 }}>
              Connect Your Accounts
            </Text>
            <Text style={{ fontSize: 16, color: '#9ca3af', textAlign: 'center', marginBottom: 30 }}>
              You haven't connected your bank accounts yet. Connect now to view your financial data and transactions.
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, { paddingVertical: 18, paddingHorizontal: 40 }]}
              onPress={handleChangeConsent}
            >
              <Text style={styles.actionButtonText}>Connect Bank Accounts</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

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
                  {currentAccount ? `****${currentAccount.masked_account_number?.slice(-4) || '0000'}` : 'Account'}
                </Text>
              </View>
              <Text style={styles.balanceAmount}>
                ₹{currentAccount?.current_balance?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>

            {transactions.length > 0 ? transactions.map((transaction) => (
              <View key={transaction.id} style={styles.transactionItem}>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionTitle}>
                    {formatTransactionName(transaction.narration, transaction.transaction_type)}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {formatDate(transaction.transaction_timestamp)} • {transaction.mode || 'Bank'}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.transactionAmount,
                    transaction.transaction_type === 'CREDIT'
                      ? styles.positiveAmount
                      : styles.negativeAmount,
                  ]}
                >
                  {transaction.transaction_type === 'DEBIT' ? '-' : '+'}₹{Math.abs(transaction.amount).toFixed(2)}
                </Text>
              </View>
            )) : (
              <Text style={{ color: '#9ca3af', textAlign: 'center', paddingVertical: 20 }}>
                No transactions found
              </Text>
            )}
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
    color: '#ef4444',
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