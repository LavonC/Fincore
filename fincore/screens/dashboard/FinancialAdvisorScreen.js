import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const FinancialAdvisorScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Financial Advisor</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default FinancialAdvisorScreen;
