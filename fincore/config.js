import { Platform } from 'react-native';

// Your computer's local IP address - this will work for both emulator and physical device
const API_URL = 'http://192.168.1.3:3000/api';
const VOICE_ASSISTANT_URL = 'http://192.168.1.3:8002';

export default {
  API_BASE_URL: API_URL,
  VOICE_ASSISTANT_URL: VOICE_ASSISTANT_URL,
};