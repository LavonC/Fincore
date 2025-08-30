import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import axios from 'axios';
import { TextInput, Button } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

const DashboardScreen = () => {
  const [step, setStep] = useState(1); 
  const [phoneNumber, setPhoneNumber] = useState('');
  const [consentUrl, setConsentUrl] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  let consent_id;
  let session_id;
  const handlePhoneNumberSubmit = async () => {
    if (!phoneNumber) {
      alert('Please enter a valid phone number.');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post('helpful-vastly-shark.ngrok-free.app/createConsent', { "PhoneNumber": phoneNumber });
      setConsentUrl(response.data.consentUrl);
      consent_id = response.data.consentId;
      setLoading(false);
      setStep(2); 
    } catch (error) {
      setLoading(false);
      setError(error.message);
    }
  };

  const handleConsentApproval = async () => {
    while(1){
      const response = await axios.post('helpful-vastly-shark.ngrok-free.app/consentCheck', {"consentId": consent_id});
      if(response.data.status == 'ACTIVE'){
        setStep(3);
        while(1){
          const sessResponse = await axios.post('helpful-vastly-shark.ngrok-free.app/sessionCheck', {"session_id": session_id});
          if(sessResponse.data.status == 'ACTIVE'){
            session_id = sessResponse.data.sessionId;
            fetchTransactionData();
            return;
          }
        }
      }
    }
  };

  const fetchTransactionData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('helpful-vastly-shark.ngrok-free.app/getTransactions', { "sessionId": session_id});
      setTransactions(response.data); 
      setLoading(false);
    } catch (error) {
      setLoading(false);
      setError(error.message);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" />;
  }

  if (step === 1) {
    return (
      <View style={{ padding: 20 }}>
        <Text>Enter Phone Number:</Text>
        <TextInput
          style={{ height: 40, borderColor: 'gray', borderWidth: 1, marginBottom: 10, paddingLeft: 10 }}
          keyboardType="phone-pad"
          placeholder="Enter phone number"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
        />
        <Button title="Submit" onPress={handlePhoneNumberSubmit} />
        {error && <Text style={{ color: 'red' }}>{error}</Text>}
      </View>
    );
  }

  if (step === 2) {
    return (
      <View style={{ flex: 1 }}>
        <Text>Consent Required</Text>
        <WebView
          source={{ uri: consentUrl }}
          onNavigationStateChange={(event) => {
            if (event.url.includes('setu.co')) {
              handleConsentApproval(); 
            }
          }}
        />
      </View>
    );
  }

  if (step === 3) {
    return (
      <View style={{ padding: 20 }}>
        <Text>Transaction Data:</Text>
        {transactions.length > 0 ? (
          transactions.map((transaction) => (
            <View key={transaction.txnId} style={{ marginBottom: 15 }}>
              <Text>Date: {transaction.startDate}</Text>
              <Text>Description: {transaction.narration}</Text>
              <Text>Amount: ${transaction.amount.toFixed(2)}</Text>
            </View>
          ))
        ) : (
          <Text>No transactions found.</Text>
        )}
      </View>
    );
  }

  return null;
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
  confirm:{
    fontSize: 18,
    color: "#007BFF",
  }
});

export default DashboardScreen;
