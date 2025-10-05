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

const AccountsScreen = ({ navigation }) => {
  const [accounts] = useState([
    {
      id: 1,
      name: 'Main Account',
      type: 'Checking',
      lastDigits: '1234',
      balance: 1234.56,
      icon: '🏛️',
    },
    {
      id: 2,
      name: 'Savings Account',
      type: 'Savings',
      lastDigits: '5678',
      balance: 5678.90,
      icon: '🏛️',
    },
    {
      id: 3,
      name: 'Credit Card',
      type: 'Credit',
      lastDigits: '9012',
      balance: 9012.34,
      icon: '💳',
    },
  ]);

  const handleAccountSelect = (account) => {
    // Here you would:
    // 1. Update the selected account in state/context
    // 2. Navigate back to dashboard with new account data
    console.log('Selected account:', account.name);
    navigation.goBack();
  };

  const formatCurrency = (amount) => {
    return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
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
          <Text style={styles.headerTitle}>Accounts</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Accounts List */}
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.accountsList}>
            {accounts.map((account) => (
              <TouchableOpacity
                key={account.id}
                style={styles.accountCard}
                onPress={() => handleAccountSelect(account)}
                activeOpacity={0.7}
              >
                <View style={styles.accountIcon}>
                  <Text style={styles.iconText}>{account.icon}</Text>
                </View>
                
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{account.name}</Text>
                  <Text style={styles.accountDetails}>
                    {account.type} ••• {account.lastDigits}
                  </Text>
                </View>

                <Text style={styles.accountBalance}>
                  {formatCurrency(account.balance)}
                </Text>
              </TouchableOpacity>
            ))}
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
  accountsList: {
    padding: 20,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d3f4f',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  accountIcon: {
    width: 56,
    height: 56,
    backgroundColor: '#374151',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconText: {
    fontSize: 28,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  accountDetails: {
    fontSize: 14,
    color: '#9ca3af',
  },
  accountBalance: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default AccountsScreen;