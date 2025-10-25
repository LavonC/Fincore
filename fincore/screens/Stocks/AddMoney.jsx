import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import axios from 'axios';
import { API_ENDPOINTS } from '../../apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';


const AddMoneyScreen = ({ navigation }) => {
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);

  const predefinedAmounts = [1000, 5000, 10000, 25000, 50000, 100000];

  useEffect(() => {
    const loadUserId = async () => {
      try {
        const id = await AsyncStorage.getItem('user_id');
        if (id) setUserId(id);
      } catch (error) {
        console.error('Error fetching user_id:', error);
      }
    };

    loadUserId();
  }, []); 


  const handleAddMoney = async () => {
    const amount = selectedAmount || parseFloat(customAmount);

    if (!amount || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!pin) {
      Alert.alert('Error', 'Please enter your demo PIN');
      return;
    }
   
    try {
      setLoading(true);
      const response = await axios.post(API_ENDPOINTS.ADD_BALANCE, {
        user_id: userId,
        amount: amount,
        demo_pin: pin,
      });

      if (response.data.success) {
        Alert.alert(
          'Success',
          `₹${amount.toLocaleString('en-IN')} added to your account!\n\nNew Balance: ₹${response.data.new_balance.toLocaleString('en-IN')}`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error adding money:', error);
      if (error.response?.data?.error === 'Invalid PIN') {
        Alert.alert('Error', 'Invalid PIN. Please try again.');
      } else {
        Alert.alert('Error', error.response?.data?.error || 'Failed to add money');
      }
    } finally {
      setLoading(false);
    }
  };

  const getAmount = () => {
    if (selectedAmount) return selectedAmount;
    if (customAmount) return parseFloat(customAmount);
    return 0;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft color="white" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Money</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* KeyboardAvoidingView helps when keyboard is open */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info Card */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Demo Account</Text>
            <Text style={styles.infoText}>
              Add virtual money to your demo trading account. This is not real money.
            </Text>
          </View>

          {/* Predefined Amounts */}
          <Text style={styles.sectionTitle}>Select Amount</Text>
          <View style={styles.amountGrid}>
            {predefinedAmounts.map((amount) => (
              <TouchableOpacity
                key={amount}
                style={[
                  styles.amountButton,
                  selectedAmount === amount && styles.amountButtonSelected,
                ]}
                onPress={() => {
                  setSelectedAmount(amount);
                  setCustomAmount('');
                }}
              >
                <Text
                  style={[
                    styles.amountText,
                    selectedAmount === amount && styles.amountTextSelected,
                  ]}
                >
                  ₹{amount.toLocaleString('en-IN')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom Amount */}
          <Text style={styles.sectionTitle}>Or Enter Custom Amount</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter amount"
            placeholderTextColor="#6b7280"
            keyboardType="numeric"
            value={customAmount}
            onChangeText={(text) => {
              setCustomAmount(text);
              setSelectedAmount(null);
            }}
          />

          {/* PIN Input */}
          <Text style={styles.sectionTitle}>Demo PIN</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter 4-digit PIN (default: 1234)"
            placeholderTextColor="#6b7280"
            keyboardType="numeric"
            maxLength={4}
            secureTextEntry
            value={pin}
            onChangeText={setPin}
          />

          {/* Summary */}
          {getAmount() > 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Amount to Add</Text>
              <Text style={styles.summaryAmount}>
                ₹{getAmount().toLocaleString('en-IN')}
              </Text>
            </View>
          )}

          {/* Add Money Button */}
          <TouchableOpacity
            style={[
              styles.addButton,
              (!getAmount() || !pin || loading) && styles.addButtonDisabled,
            ]}
            onPress={handleAddMoney}
            disabled={!getAmount() || !pin || loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.addButtonText}>Add Money</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#0f172a',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: 'white' },
  content: { flex: 1, padding: 20 },
  infoCard: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  infoTitle: { fontSize: 16, fontWeight: '600', color: 'white', marginBottom: 8 },
  infoText: { fontSize: 14, color: '#94a3b8', lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: 'white', marginBottom: 12, marginTop: 8 },
  amountGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24 },
  amountButton: {
    backgroundColor: '#1e293b',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#334155',
    minWidth: '30%',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 12,
  },
  amountButtonSelected: { borderColor: '#3b82f6', backgroundColor: '#1e40af' },
  amountText: { fontSize: 16, fontWeight: '600', color: '#94a3b8' },
  amountTextSelected: { color: 'white' },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: 'white',
    marginBottom: 20,
  },
  summaryCard: { backgroundColor: '#1e293b', padding: 20, borderRadius: 12, marginVertical: 20, alignItems: 'center' },
  summaryLabel: { fontSize: 14, color: '#94a3b8', marginBottom: 8 },
  summaryAmount: { fontSize: 32, fontWeight: 'bold', color: '#10b981' },
  addButton: { backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  addButtonDisabled: { backgroundColor: '#374151' },
  addButtonText: { fontSize: 18, fontWeight: '700', color: 'white' },
});

export default AddMoneyScreen;
