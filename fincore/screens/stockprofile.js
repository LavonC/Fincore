// screens/AccountScreen.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

const AccountScreen = () => {
  return (
    <ScrollView style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Account</Text>
        <TouchableOpacity style={styles.rewardBtn}>
          <Text style={styles.rewardText}>Get ₹200</Text>
        </TouchableOpacity>
      </View>

      {/* Balance Section */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Trading Balance:</Text>
        <Text style={styles.balanceAmount}>₹ 0.00</Text>

        <View style={styles.coinIcon}>
          <FontAwesome5 name="rupee-sign" size={48} color="#ccc" />
        </View>

        <Text style={styles.investText}>Get ready to invest</Text>
        <Text style={styles.investSubText}>Add funds to start trading with Angel One</Text>

        <TouchableOpacity style={styles.addFundsBtn}>
          <Text style={styles.addFundsText}>ADD FUNDS</Text>
        </TouchableOpacity>
      </View>

      {/* Options Section */}
      <View style={styles.optionsContainer}>
        <TouchableOpacity style={styles.optionCard}>
          <MaterialIcons name="folder-special" size={32} color="#007AFF" />
          <Text style={styles.optionTitle}>PLEDGE HOLDINGS</Text>
          <Text style={styles.optionSubText}>
            Pledge stocks or mutual funds you hold to increase trading balance
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionCard}>
          <MaterialIcons name="attach-money" size={32} color="#8E44AD" />
          <Text style={styles.optionTitle}>PAY LATER (MTF)</Text>
          <Text style={styles.optionSubText}>
            View and analyse your MTF stocks
          </Text>
        </TouchableOpacity>
      </View>

      {/* Profile Section */}
      <TouchableOpacity style={styles.profileCard}>
        <MaterialIcons name="person" size={32} color="#007AFF" />
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.profileName}>Parshuram Gooli</Text>
          <Text style={styles.clientId}>Client ID: AAAV325665</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default AccountScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
  rewardBtn: { backgroundColor: '#e5f6e5', padding: 8, borderRadius: 20 },
  rewardText: { color: '#2E8B57', fontWeight: 'bold' },
  balanceCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  balanceLabel: { fontSize: 14, color: '#555' },
  balanceAmount: { fontSize: 20, fontWeight: 'bold', marginVertical: 8 },
  coinIcon: { marginVertical: 16 },
  investText: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  investSubText: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 16 },
  addFundsBtn: { backgroundColor: '#007AFF', padding: 12, borderRadius: 8, width: '80%' },
  addFundsText: { color: '#fff', fontWeight: 'bold', textAlign: 'center' },
  optionsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 16 },
  optionCard: {
    backgroundColor: '#fff',
    width: '48%',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  optionTitle: { fontWeight: 'bold', marginTop: 8, textAlign: 'center' },
  optionSubText: { fontSize: 12, color: '#555', textAlign: 'center', marginTop: 4 },
  profileCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  profileName: { fontWeight: 'bold', fontSize: 16 },
  clientId: { fontSize: 12, color: '#555' },
});
