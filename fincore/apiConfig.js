// API Configuration for Backend
// Use your computer's local IP address for React Native to access the backend

// For Android Emulator: use 10.0.2.2
// For iOS Simulator: use localhost
// For Physical Device: use your computer's IP address (192.168.1.5)

import { Platform } from 'react-native';

// Change this based on your testing environment:
// - 'emulator' for Android Emulator
// - 'simulator' for iOS Simulator  
// - 'device' for Physical Device
const TESTING_ON = 'device'; // Change to 'emulator' or 'simulator' if needed

const getBaseUrl = () => {
  if (TESTING_ON === 'emulator') {
    return 'http://10.0.2.2:5000';
  } else if (TESTING_ON === 'simulator') {
    return 'http://localhost:5000';
  } else {
    // Physical device - use computer's IP
    return 'http://192.168.1.5:5000';
  }
};

export const API_BASE_URL = getBaseUrl();

// API Endpoints
export const API_ENDPOINTS = {
  CREATE_CONSENT: `${API_BASE_URL}/createConsent`,
  CHECK_USER_CONSENT: `${API_BASE_URL}/checkUserConsent`,
  CONSENT_CHECK: `${API_BASE_URL}/consentCheck`,
  SESSION_CHECK: `${API_BASE_URL}/sessionCheck`,
  GET_TRANSACTIONS: `${API_BASE_URL}/getTransactions`,
  GET_USER_ACCOUNTS: `${API_BASE_URL}/getUserAccounts`,
  GET_ACCOUNT_TRANSACTIONS: `${API_BASE_URL}/getAccountTransactions`,
};

export default API_BASE_URL;
