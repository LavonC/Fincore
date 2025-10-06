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

const AccountsScreen = ({ navigation }) => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const email = await AsyncStorage.getItem('userEmail');
      
      if (!email) {
        Alert.alert('Error', 'Please login again');
        return;
      }

      const response = await axios.post(API_ENDPOINTS.GET_USER_ACCOUNTS, {
        email: email
      });

      if (response.data.success) {
        setAccounts(response.data.accounts);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
      Alert.alert('Error', 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountSelect = async (account) => {
    try {
      await AsyncStorage.setItem('selectedAccountId', account.id.toString());
      navigation.goBack();
    } catch (error) {
      console.error('Error selecting account:', error);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '₹0.00';
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const getAccountIcon = (type) => {
    if (!type) return '🏛️';
    if (type.toUpperCase().includes('CREDIT')) return '💳';
    if (type.toUpperCase().includes('SAVINGS')) return '💰';
    return '🏛️';
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
          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#00d4d4" />
              <Text style={{ color: '#ffffff', marginTop: 10 }}>Loading accounts...</Text>
            </View>
          ) : accounts.length > 0 ? (
            <View style={styles.accountsList}>
              {accounts.map((account) => (
                <TouchableOpacity
                  key={account.id}
                  style={styles.accountCard}
                  onPress={() => handleAccountSelect(account)}
                  activeOpacity={0.7}
                >
                  <View style={styles.accountIcon}>
                    <Text style={styles.iconText}>
                      {getAccountIcon(account.account_type)}
                    </Text>
                  </View>
                  
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName}>
                      {account.account_holder_name || 'Account'}
                    </Text>
                    <Text style={styles.accountDetails}>
                      {account.account_type || 'DEPOSIT'} ••• {account.masked_account_number?.slice(-4) || '0000'}
                    </Text>
                  </View>

                  <Text style={styles.accountBalance}>
                    {formatCurrency(account.current_balance)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: '#9ca3af', fontSize: 16, textAlign: 'center' }}>
                No accounts found. Please connect your bank accounts first.
              </Text>
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