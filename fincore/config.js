import { Platform } from 'react-native';

// 🚀 PRODUCTION CONFIGURATION FOR RENDER.COM
// Switch between local development and production by changing USE_PRODUCTION

const USE_PRODUCTION = false; // Set to false for local development

// Production URLs (Render.com)
const PRODUCTION_API_URL = 'https://fincore-authentication.onrender.com/api';
const PRODUCTION_VOICE_URL = 'https://fincore-voice-assistant.onrender.com';

// Local Development URLs
const LOCAL_API_URL = 'http://192.168.1.5:3000/api';
const LOCAL_VOICE_URL = 'http://192.168.1.5:8002';

// Select URLs based on environment
const API_URL = USE_PRODUCTION ? PRODUCTION_API_URL : LOCAL_API_URL;
const VOICE_ASSISTANT_URL = USE_PRODUCTION ? PRODUCTION_VOICE_URL : LOCAL_VOICE_URL;

export default {
  API_BASE_URL: API_URL,
  VOICE_ASSISTANT_URL: VOICE_ASSISTANT_URL,
};