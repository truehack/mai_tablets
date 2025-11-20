// src/config/api.ts

// Expo даёт __DEV__ глобально (true в dev, false в prod)
const IS_DEV = __DEV__;

// Определяем IP в зависимости от платформы и среды
let API_BASE_URL = 'https://api.maisafe.app'; // ← prod

if (IS_DEV) {
  // Для физического устройства (iOS/Android) в той же Wi-Fi
  API_BASE_URL = 'http://192.168.31.174:8000';

  // Опционально: если хочешь поддерживать эмуляторы — раскомментируй:
  // if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
  //   API_BASE_URL = 'http://10.0.2.2:8000'; // Android эмулятор → хост
  // }
}

export { API_BASE_URL };