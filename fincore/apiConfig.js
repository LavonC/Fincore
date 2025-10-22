import { Platform } from 'react-native';

// 🚀 PRODUCTION CONFIGURATION FOR RENDER.COM
// Switch between local development and production
const USE_PRODUCTION = true; // Set to false for local development

// =====================================
// PRODUCTION URLs (Render.com)
// =====================================
const PRODUCTION_URLS = {
  AUTH_URL: 'https://fincore-authentication.onrender.com',      // Port 3000 - server.js
  CONSENT_URL: 'https://fincore-axgh.onrender.com',         // Port 5000 - AA.py
  HISTORICAL_URL: 'https://fincore-historical.onrender.com', // Port 4000 - historicalserver.py
  DATA_URL: 'https://fincore-ml.onrender.com',            // Port 6000 - ml.py
  ADVISOR_URL: 'https://fincore-1.onrender.com',    // Port 7000 - advisor.py
  INSIGHTS_URL: 'https://fincore-2.onrender.com',  // Port 8001 - insights.py
};

// =====================================
// LOCAL DEVELOPMENT URLs
// =====================================
const TESTING_ON = 'device'; // 'emulator', 'simulator', or 'device'

const SERVER_IPS = {
  AUTH_IP: '192.168.1.3',      // Port 3000 - server.js
  CONSENT_IP: '192.168.1.3',   // Port 5000 - AA.py
  HISTORICAL_IP: '192.168.1.3', // Port 4000 - historicalserver.py
  DATA_IP: '192.168.1.3',      // Port 6000 - ml.py
  ADVISOR_IP: '192.168.1.3',   // Port 7000 - advisor.py
  INSIGHTS_IP: '192.168.1.3',  // Port 8001 - insights.py
};

// Function to get base URL for local development
const getLocalUrl = (port, serverIP) => {
  if (TESTING_ON === 'emulator') return `http://10.0.2.2:${port}`;
  if (TESTING_ON === 'simulator') return `http://localhost:${port}`;
  return `http://${serverIP}:${port}`;
};

const LOCAL_URLS = {
  AUTH_URL: getLocalUrl(3000, SERVER_IPS.AUTH_IP),
  CONSENT_URL: getLocalUrl(5000, SERVER_IPS.CONSENT_IP),
  HISTORICAL_URL: getLocalUrl(4000, SERVER_IPS.HISTORICAL_IP),
  DATA_URL: getLocalUrl(6000, SERVER_IPS.DATA_IP),
  ADVISOR_URL: getLocalUrl(7000, SERVER_IPS.ADVISOR_IP),
  INSIGHTS_URL: getLocalUrl(8001, SERVER_IPS.INSIGHTS_IP),
};

// =====================================
// SELECT ENVIRONMENT
// =====================================
const URLS = USE_PRODUCTION ? PRODUCTION_URLS : LOCAL_URLS;

// 🔹 Base URLs
export const AUTH_BASE_URL = URLS.AUTH_URL;           // Main API (server.js)
export const CONSENT_BASE_URL = URLS.CONSENT_URL;     // Account Aggregator (AA.py)
export const HISTORICAL_BASE_URL = URLS.HISTORICAL_URL; // Historical data (historicalserver.py)
export const DATA_BASE_URL = URLS.DATA_URL;           // Stock ML data (ml.py)
export const ADVISOR_BASE_URL = URLS.ADVISOR_URL;     // Financial Advisor (advisor.py)
export const INSIGHTS_BASE_URL = URLS.INSIGHTS_URL;   // Financial Insights (insights.py)

// 🔹 API Endpoints
export const API_ENDPOINTS = {
  // Auth endpoints (server.js - port 3000)
  LOGIN: `${AUTH_BASE_URL}/api/auth/login`,
  REGISTER: `${AUTH_BASE_URL}/api/auth/register`,
  VERIFY: `${AUTH_BASE_URL}/api/auth/verify`,
  SEND_OTP: `${AUTH_BASE_URL}/api/auth/send-otp`,
  VERIFY_OTP: `${AUTH_BASE_URL}/api/auth/verify-otp`,
  SIGNUP: `${AUTH_BASE_URL}/api/auth/signup`,
  CHECK_EMAIL: `${AUTH_BASE_URL}/api/auth/check-email`,

  // Consent & session endpoints (AA.py - port 5000)
  CREATE_CONSENT: `${CONSENT_BASE_URL}/createConsent`,
  CHECK_USER_CONSENT: `${CONSENT_BASE_URL}/checkUserConsent`,
  CONSENT_CHECK: `${CONSENT_BASE_URL}/consentCheck`,
  SESSION_CHECK: `${CONSENT_BASE_URL}/sessionCheck`,
  GET_TRANSACTIONS: `${CONSENT_BASE_URL}/getTransactions`,
  GET_USER_ACCOUNTS: `${CONSENT_BASE_URL}/getUserAccounts`,
  GET_ACCOUNT_TRANSACTIONS: `${CONSENT_BASE_URL}/getAccountTransactions`,

  // Historical data endpoints (historicalserver.py - port 4000)
  HISTORICAL_DATA: `${HISTORICAL_BASE_URL}/historical_data`,
  LIVE_STOCK: `${HISTORICAL_BASE_URL}/live_stock`,

  // Stock ML data endpoints (ml.py - port 6000)
  COMPANIES: `${DATA_BASE_URL}/companies`,
  HISTORY: `${DATA_BASE_URL}/historical_data`,
  GET_COMPANYS: `${AUTH_BASE_URL}/get_csv`,

  // Advisor endpoints (advisor.py - port 7000)
  ADVISOR_LIST_CHATS: `${ADVISOR_BASE_URL}/advisor/chats/list`,
  ADVISOR_CREATE_CHAT: `${ADVISOR_BASE_URL}/advisor/chats/create`,
  ADVISOR_DELETE_CHAT: `${ADVISOR_BASE_URL}/advisor/chats/delete`,
  ADVISOR_LIST_MESSAGES: `${ADVISOR_BASE_URL}/advisor/messages/list`,
  ADVISOR_SEND_MESSAGE: `${ADVISOR_BASE_URL}/advisor/messages/send`,
  ADVISOR_HEALTH: `${ADVISOR_BASE_URL}/advisor/health`,

  // Insights endpoints (insights.py - port 8001)
  INSIGHTS_GENERATE: `${INSIGHTS_BASE_URL}/insights/generate`,
  INSIGHTS_LIST: `${INSIGHTS_BASE_URL}/insights/list`,
  INSIGHTS_LATEST: `${INSIGHTS_BASE_URL}/insights/latest`,
  INSIGHTS_FINANCIAL_SUMMARY: `${INSIGHTS_BASE_URL}/insights/financial-summary`,
  INSIGHTS_HEALTH: `${INSIGHTS_BASE_URL}/insights/health`,
};

// 🔹 Helper function for WebSocket URLs
export const getWebSocketUrl = (baseUrl) => {
  return baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
};

export default { 
  AUTH_BASE_URL, 
  CONSENT_BASE_URL, 
  HISTORICAL_BASE_URL,
  DATA_BASE_URL, 
  ADVISOR_BASE_URL, 
  INSIGHTS_BASE_URL, 
  API_ENDPOINTS,
  getWebSocketUrl
};
