import { Platform } from 'react-native';

// Change this based on your setup
const TESTING_ON = 'device'; // 'emulator', 'simulator', or 'device'

// Your computer's local IP
const LOCAL_IP = '192.168.1.3';

// Function to get base URL depending on port
const getBaseUrl = (port) => {
  if (TESTING_ON === 'emulator') return `http://10.0.2.2:${port}`;
  if (TESTING_ON === 'simulator') return `http://localhost:${port}`;
  return `http://${LOCAL_IP}:${port}`; // physical device
};

// 🔹 Base URLs
export const AUTH_BASE_URL = getBaseUrl(4000);   // login/register
export const CONSENT_BASE_URL = getBaseUrl(5000); // consent/session
export const DATA_BASE_URL = getBaseUrl(6000);   // companies/historical_data

// 🔹 API Endpoints
export const API_ENDPOINTS = {
  // Auth endpoints (port 4000)
  LOGIN: `${AUTH_BASE_URL}/api/auth/login`,
  REGISTER: `${AUTH_BASE_URL}/api/auth/register`,
  VERIFY: `${AUTH_BASE_URL}/api/auth/verify`,

  // Consent & session endpoints (port 5000)
  CREATE_CONSENT: `${CONSENT_BASE_URL}/createConsent`,
  CHECK_USER_CONSENT: `${CONSENT_BASE_URL}/checkUserConsent`,
  CONSENT_CHECK: `${CONSENT_BASE_URL}/consentCheck`,
  SESSION_CHECK: `${CONSENT_BASE_URL}/sessionCheck`,
  GET_TRANSACTIONS: `${CONSENT_BASE_URL}/getTransactions`,
  GET_USER_ACCOUNTS: `${CONSENT_BASE_URL}/getUserAccounts`,
  GET_ACCOUNT_TRANSACTIONS: `${CONSENT_BASE_URL}/getAccountTransactions`,

  // Data endpoints (port 6000)
  COMPANIES: `${DATA_BASE_URL}/companies`,
  HISTORY: `${DATA_BASE_URL}/historical_data`,
  GET_COMPANYS: `${AUTH_BASE_URL}/get_csv`,
};

export default { AUTH_BASE_URL, CONSENT_BASE_URL, DATA_BASE_URL, API_ENDPOINTS };
