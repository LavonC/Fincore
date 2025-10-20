import { Platform } from 'react-native';

// Change this based on your setup
const TESTING_ON = 'device'; // 'emulator', 'simulator', or 'device'

// ⚠️ CONFIGURE YOUR SERVER IPs HERE ⚠️
// All servers running on the same computer: 192.168.1.3
const SERVER_IPS = {
  AUTH_IP: '192.168.1.3',      // Port 4000 - login/register server IP
  CONSENT_IP: '192.168.1.3',   // Port 5000 - AA.py server IP (FIXED: was .5, should be .3)
  DATA_IP: '192.168.1.3',      // Port 6000 - stock/historical server IP (FIXED: was .5, should be .3)
  ADVISOR_IP: '192.168.1.3',   // Port 7000 - advisor.py server IP
  INSIGHTS_IP: '192.168.1.3',  // Port 8001 - insights.py server IP
};

// Function to get base URL for specific server
const getBaseUrl = (port, serverIP) => {
  if (TESTING_ON === 'emulator') return `http://10.0.2.2:${port}`;
  if (TESTING_ON === 'simulator') return `http://localhost:${port}`;
  return `http://${serverIP}:${port}`; // physical device - ⚠️ Must use http:// not https://
};

// 🔹 Base URLs
export const AUTH_BASE_URL = getBaseUrl(4000, SERVER_IPS.AUTH_IP);       // login/register (FIXED: was 3000, should be 4000)
export const CONSENT_BASE_URL = getBaseUrl(5000, SERVER_IPS.CONSENT_IP); // consent/session (AA.py)
export const DATA_BASE_URL = getBaseUrl(6000, SERVER_IPS.DATA_IP);       // companies/historical_data
export const ADVISOR_BASE_URL = getBaseUrl(7000, SERVER_IPS.ADVISOR_IP); // financial advisor AI (advisor.py)
export const INSIGHTS_BASE_URL = getBaseUrl(8001, SERVER_IPS.INSIGHTS_IP); // financial insights AI (insights.py)

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

  // Advisor endpoints (port 7000)
  ADVISOR_LIST_CHATS: `${ADVISOR_BASE_URL}/advisor/chats/list`,
  ADVISOR_CREATE_CHAT: `${ADVISOR_BASE_URL}/advisor/chats/create`,
  ADVISOR_DELETE_CHAT: `${ADVISOR_BASE_URL}/advisor/chats/delete`,
  ADVISOR_LIST_MESSAGES: `${ADVISOR_BASE_URL}/advisor/messages/list`,
  ADVISOR_SEND_MESSAGE: `${ADVISOR_BASE_URL}/advisor/messages/send`,
  ADVISOR_HEALTH: `${ADVISOR_BASE_URL}/advisor/health`,

  // Insights endpoints (port 8000)
  INSIGHTS_GENERATE: `${INSIGHTS_BASE_URL}/insights/generate`,
  INSIGHTS_LIST: `${INSIGHTS_BASE_URL}/insights/list`,
  INSIGHTS_LATEST: `${INSIGHTS_BASE_URL}/insights/latest`,
  INSIGHTS_FINANCIAL_SUMMARY: `${INSIGHTS_BASE_URL}/insights/financial-summary`,
  INSIGHTS_HEALTH: `${INSIGHTS_BASE_URL}/insights/health`,
};

export default { AUTH_BASE_URL, CONSENT_BASE_URL, DATA_BASE_URL, ADVISOR_BASE_URL, INSIGHTS_BASE_URL, API_ENDPOINTS };
