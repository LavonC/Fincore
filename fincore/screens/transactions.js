
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  StatusBar,
} from 'react-native';

const TransactionsScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date'); // 'date', 'amount', 'category'

  // Sample transactions data grouped by date
  const [transactions] = useState([
    {
      date: 'Today',
      items: [
        { id: 1, title: 'Supermarket', category: 'Groceries', amount: -45.20 },
        { id: 2, title: 'Supermarket', category: 'Groceries', amount: -45.20 },
        { id: 3, title: 'Restaurant', category: 'Dining', amount: -62.50 },
      ],
    },
    {
      date: 'Yesterday',
      items: [
        { id: 4, title: 'Electricity Bill', category: 'Utilities', amount: -85.00 },
        { id: 5, title: 'Employer', category: 'Salary', amount: 2500.00 },
      ],
    },
    {
      date: 'Sep 20',
      items: [
        { id: 6, title: 'Apartment', category: 'Rent', amount: -1200.00 },
        { id: 7, title: 'Clothing Store', category: 'Shopping', amount: -120.75 },
      ],
    },
  ]);

  const formatCurrency = (amount) => {
    const sign = amount >= 0 ? '+' : '-';
    const absAmount = Math.abs(amount).toFixed(2);
    return `${sign}$${absAmount}`;
  };

  const handleSortByAmount = () => {
    setSortBy('amount');
    // Implement sorting logic here
    console.log('Sort by Amount');
  };

  const handleSortByCategory = () => {
    setSortBy('category');
    // Implement sorting logic here
    console.log('Sort by Category');
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
          <Text style={styles.headerTitle}>Transactions</Text>
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
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {transactions.map((group) => (
            <View key={group.date} style={styles.transactionGroup}>
              <Text style={styles.dateHeader}>{group.date}</Text>
              
              {group.items.map((transaction) => (
                <TouchableOpacity 
                  key={transaction.id} 
                  style={styles.transactionItem}
                  activeOpacity={0.7}
                >
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionTitle}>
                      {transaction.title}
                    </Text>
                    <Text style={styles.transactionCategory}>
                      {transaction.category}
                    </Text>
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
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>

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
    color: '#ffffff',
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