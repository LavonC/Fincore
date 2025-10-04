// ==========================================
// PLACEHOLDER SCREENS
// Create these as separate files or keep them here temporarily
// ==========================================

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, BackHandler } from 'react-native';

// Dashboard Screen
export const DashboardScreen = ({ navigation }) => {
  useEffect(() => {
    const backAction = () => {
      navigation.navigate('Explore');
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>📊 Dashboard</Text>
        <Text style={styles.subtitle}>Track your financial health at a glance</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.navigate('Explore')}
        >
          <Text style={styles.backButtonText}>← Back to Explore</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// Stocks Screen
export const StocksScreen = ({ navigation }) => {
  useEffect(() => {
    const backAction = () => {
      navigation.navigate('Explore');
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>📈 Stocks</Text>
        <Text style={styles.subtitle}>Manage your investments and portfolio</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.navigate('Explore')}
        >
          <Text style={styles.backButtonText}>← Back to Explore</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// Advisor Connect Screen
export const AdvisorConnectScreen = ({ navigation }) => {
  useEffect(() => {
    const backAction = () => {
      navigation.navigate('Explore');
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>👥 Advisor Connect</Text>
        <Text style={styles.subtitle}>Get personalized financial advice</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.navigate('Explore')}
        >
          <Text style={styles.backButtonText}>← Back to Explore</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// Tax Center Screen
export const TaxCenterScreen = ({ navigation }) => {
  useEffect(() => {
    const backAction = () => {
      navigation.navigate('Explore');
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>📄 Tax Center</Text>
        <Text style={styles.subtitle}>Simplify your tax filing process</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.navigate('Explore')}
        >
          <Text style={styles.backButtonText}>← Back to Explore</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1f2e',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 48,
    color: '#ffffff',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 32,
  },
  backButton: {
    backgroundColor: '#00d4d4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#1a1f2e',
    fontSize: 16,
    fontWeight: '600',
  },
});