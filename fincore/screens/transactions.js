
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import axios from 'axios';
import { API_ENDPOINTS } from '../apiConfig';

const TransactionsScreen = ({ navigation, route }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [transactions, setTransactions] = useState([]);
  const [groupedTransactions, setGroupedTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const accountId = route?.params?.accountId;
  const accountName = route?.params?.accountName || 'Account';

  useEffect(() => {
    if (accountId) {
      loadTransactions();
    } else {
      Alert.alert('Error', 'No account selected');
      navigation.goBack();
    }
  }, [accountId]);

  useEffect(() => {
    groupTransactionsByDate();
  }, [transactions, searchQuery]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const response = await axios.post(API_ENDPOINTS.GET_ACCOUNT_TRANSACTIONS, {
        accountId: accountId
      });

      if (response.data.success) {
        setTransactions(response.data.transactions);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      Alert.alert('Error', 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const groupTransactionsByDate = () => {
    let filtered = transactions;
    
    // Filter by search query
    if (searchQuery) {
      filtered = transactions.filter(txn => 
        (txn.narration || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Group by date
    const groups = {};
    filtered.forEach(txn => {
      const date = new Date(txn.transaction_timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let dateKey;
      if (date.toDateString() === today.toDateString()) {
        dateKey = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateKey = 'Yesterday';
      } else {
        dateKey = date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      }

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(txn);
    });

    // Convert to array format
    const grouped = Object.keys(groups).map(date => ({
      date,
      items: groups[date]
    }));

    setGroupedTransactions(grouped);
  };

  const formatCurrency = (amount) => {
    const absAmount = Math.abs(amount).toFixed(2);
    return amount >= 0 ? `+₹${absAmount}` : `-₹${absAmount}`;
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
        
        // Limit to 40 characters for transactions page
        if (formattedName.length > 40) {
          return formattedName.substring(0, 37) + '...';
        }
        
        return formattedName;
      }
    }
    
    // Fallback for unexpected formats
    return type === 'CREDIT' ? 'Money Received' : 'Payment';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const handleSortByAmount = () => {
    setSortBy('amount');
    const sorted = [...transactions].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    setTransactions(sorted);
  };

  const handleSortByCategory = () => {
    setSortBy('category');
    const sorted = [...transactions].sort((a, b) => {
      const catA = a.transaction_type || '';
      const catB = b.transaction_type || '';
      return catA.localeCompare(catB);
    });
    setTransactions(sorted);
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
          <Text style={styles.headerTitle}>{accountName}</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search transactions"
              placeholderTextColor="#6B7280"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Transactions List */}
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#00d4d4" />
            <Text style={{ color: '#ffffff', marginTop: 10 }}>Loading transactions...</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {groupedTransactions.length > 0 ? groupedTransactions.map((group, groupIndex) => (
              <View key={groupIndex} style={styles.transactionGroup}>
                <Text style={styles.dateHeader}>{group.date}</Text>
                
                {group.items.map((transaction) => (
                  <TouchableOpacity 
                    key={transaction.id} 
                    style={styles.transactionItem}
                    activeOpacity={0.7}
                  >
                    <View style={styles.transactionInfo}>
                      <Text style={styles.transactionTitle}>
                        {formatTransactionName(transaction.narration, transaction.transaction_type)}
                      </Text>
                      <Text style={styles.transactionCategory}>
                        {formatDate(transaction.transaction_timestamp)} • {formatTime(transaction.transaction_timestamp)} • {transaction.mode || 'Bank'}
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
                  </TouchableOpacity>
                ))}
              </View>
            )) : (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ color: '#9ca3af', fontSize: 16, textAlign: 'center' }}>
                  {searchQuery ? 'No transactions match your search' : 'No transactions found'}
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* Sort Buttons */}
        <View style={styles.sortContainer}>
          <TouchableOpacity
            style={[
              styles.sortButton,
              sortBy === 'amount' && styles.sortButtonActive,
            ]}
            onPress={handleSortByAmount}
          >
            <Text style={styles.sortButtonText}>Sort by Amount</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sortButton,
              sortBy === 'category' && styles.sortButtonActive,
            ]}
            onPress={handleSortByCategory}
          >
            <Text style={styles.sortButtonText}>Sort by Category</Text>
          </TouchableOpacity>
        </View>
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
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d3f4f',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  transactionGroup: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  dateHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
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
  transactionCategory: {
    fontSize: 14,
    color: '#9ca3af',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 16,
  },
  positiveAmount: {
    color: '#10b981',
  },
  negativeAmount: {
    color: '#ef4444',
  },
  sortContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#2d3748',
  },
  sortButton: {
    flex: 1,
    backgroundColor: '#2d3f4f',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sortButtonActive: {
    backgroundColor: '#00d4d4',
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default TransactionsScreen;