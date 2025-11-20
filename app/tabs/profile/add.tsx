// app/tabs/profile/add.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Alert,
  Keyboard,
  Animated,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import {
  TextInput,
  Button,
  Snackbar,
  useTheme,
  IconButton,
  Surface,
} from 'react-native-paper';
import { AppBar } from '@/components/app-bar';
import { Screen } from '@/components/screen';
import apiClient from '@/services/api';
import { useRouter } from 'expo-router';

interface MedFriendQRData {
  type: 'med_friend_invitation';
  code: string;
}

export default function AddMedFriend() {
  const theme = useTheme();
  const router = useRouter();

  const opacityAnim = useRef(new Animated.Value(0)).current;
  const inputScale = useRef(new Animated.Value(1)).current;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarType, setSnackbarType] = useState<'success' | 'error'>('success');
  const [scanning, setScanning] = useState(false);
  const [scannerLoading, setScannerLoading] = useState(false);

  // Анимация появления
  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, []);

  // 🛡️ ПОЛНОСТЬЮ ИЗОЛИРОВАННАЯ ЗАГРУЗКА СКАНЕРА
  const loadAndStartScanner = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Веб-версия', 'Сканирование QR недоступно в браузере.');
      return;
    }

    setScannerLoading(true);

    try {
      // 🔒 Используем динамический require через Function — обходит статический анализ
      // Это единственный способ избежать ошибки при typedRoutes: true
      const getScanner = new Function(`
        try {
          const { BarCodeScanner } = require('expo-barcode-scanner');
          return BarCodeScanner;
        } catch (e) {
          throw new Error('native_module_missing');
        }
      `);

      const BarCodeScanner = getScanner();

      // Запрос разрешения
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Доступ к камере', 'Пожалуйста, разрешите доступ к камере в настройках.');
        setScannerLoading(false);
        return;
      }

      setScanning(true);
      setScannerLoading(false);
    } catch (err: any) {
      setScannerLoading(false);
      if (err.message === 'native_module_missing') {
        Alert.alert(
          'Сканер недоступен',
          'Функция сканирования работает только в dev-сборке приложения.\n\n✅ Соберите приложение командой:\n\nnpx expo run:android'
        );
      } else {
        Alert.alert('Ошибка', err.message || 'Неизвестная ошибка инициализации камеры');
      }
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setScanning(false);
    try {
      const parsed = JSON.parse(data);
      if (
        parsed?.type === 'med_friend_invitation' &&
        typeof parsed.code === 'string' &&
        /^\d{6}$/.test(parsed.code)
      ) {
        setCode(parsed.code);
        triggerSuccess('✅ Код получен из QR');
      } else {
        throw new Error();
      }
    } catch {
      Alert.alert(
        'Неверный QR-код',
        'Код должен быть сгенерирован в SmartDoctor.\nУбедитесь, что это QR приглашения мед-друга.'
      );
    }
  };

  const handleSubmit = async () => {
    const cleanCode = code.trim();
    if (!cleanCode) {
      triggerError('Введите 6-значный код');
      return;
    }
    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      triggerError('Код должен содержать ровно 6 цифр');
      return;
    }

    setLoading(true);
    try {
      await apiClient.postWithAuth('/friends/add', { code: cleanCode });
      triggerSuccess('✅ Мед-друг добавлен!');
      setTimeout(() => router.back(), 1200);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Ошибка сервера';
      triggerError(msg.includes('expired') ? 'Срок действия кода истёк' : msg);
    } finally {
      setLoading(false);
    }
  };

  const triggerSuccess = (msg: string) => {
    setSnackbarMessage(msg);
    setSnackbarType('success');
    setSnackbarVisible(true);
  };

  const triggerError = (msg: string) => {
    setSnackbarMessage(msg);
    setSnackbarType('error');
    setSnackbarVisible(true);
    Animated.sequence([
      Animated.timing(inputScale, { toValue: 0.94, duration: 60, useNativeDriver: true }),
      Animated.timing(inputScale, { toValue: 1.03, duration: 50, useNativeDriver: true }),
      Animated.spring(inputScale, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }),
    ]).start();
  };

  // ✅ Экран сканирования (рендерим только после успешной загрузки)
  if (scanning) {
    // 🎯 Динамически создаём компонент внутри рендера — безопасно
    const ScannerComponent = React.memo(() => {
      const Scanner = React.useMemo(() => {
        try {
          // Повторно загружаем — теперь точно есть в runtime
          const { BarCodeScanner } = require('expo-barcode-scanner');
          return BarCodeScanner;
        } catch {
          return null;
        }
      }, []);

      if (!Scanner) {
        return (
          <View style={StyleSheet.absoluteFill}>
            <Text style={styles.scanError}>Ошибка: сканер не загружен</Text>
          </View>
        );
      }

      return (
        <Scanner
          onBarCodeScanned={handleBarCodeScanned}
          barCodeTypes={[Scanner.Constants.BarCodeType.qr]}
          style={StyleSheet.absoluteFill}
        />
      );
    });

    return (
      <Screen style={styles.container}>
        <ScannerComponent />
        <View style={styles.overlay}>
          <AppBar
            title="Сканирование QR"
            back
            onBack={() => setScanning(false)}
            style={styles.appBar}
          />
          <View style={styles.scanFrameContainer}>
            <View style={styles.scanFrame} />
          </View>
          <View style={styles.scanInfo}>
            <Surface style={styles.scanCard} elevation={2}>
              <Text style={styles.scanTitle}>Наведите на QR-код</Text>
              <Text style={styles.scanSubtitle}>Из раздела «Профиль → Поделиться»</Text>
            </Surface>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <Animated.View style={{ opacity: opacityAnim, flex: 1 }}>
        <AppBar title="Добавить мед. друга" back />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.content}>
              <View style={styles.iconCircle}>
                <Text style={styles.icon}>🧑‍⚕️</Text>
              </View>

              <Text style={styles.title}>Код приглашения</Text>
              <Text style={styles.subtitle}>
                Введите 6-значный код или отсканируйте QR
              </Text>

              <Animated.View style={{ transform: [{ scale: inputScale }], width: '100%', maxWidth: 320 }}>
                <View style={styles.inputWithQr}>
                  <TextInput
                    mode="outlined"
                    label="Код (6 цифр)"
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={[styles.input, { flex: 1 }]}
                    theme={{
                      colors: {
                        primary: theme.colors.primary,
                        outline: theme.colors.outline,
                        background: theme.colors.background,
                        placeholder: theme.colors.placeholder ?? '#888',
                        text: theme.colors.text ?? '#FFF', // ✅ БЕЛЫЙ ТЕКСТ В ТЁМНОЙ ТЕМЕ
                      },
                    }}
                    autoFocus
                    error={snackbarType === 'error' && !!code}
                    onSubmitEditing={handleSubmit}
                  />
                  <IconButton
                    icon="qrcode-scan"
                    size={36}
                    onPress={loadAndStartScanner}
                    style={styles.qrButton}
                    iconColor={theme.colors.primary}
                    containerColor={`${theme.colors.primary}20`}
                    disabled={scannerLoading}
                  />
                </View>
              </Animated.View>

              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={loading}
                disabled={loading}
                style={styles.button}
                contentStyle={{ paddingVertical: 12 }}
                labelStyle={{ fontWeight: '600' }}
              >
                {loading ? 'Добавление...' : 'Добавить мед-друга'}
              </Button>

              {scannerLoading && (
                <View style={styles.loadingIndicator}>
                  <ActivityIndicator color={theme.colors.primary} />
                  <Text style={[styles.loadingText, { color: theme.colors.text ?? '#FFF' }]}>
                    Загрузка сканера...
                  </Text>
                </View>
              )}

              <View style={styles.infoBox}>
                <Text style={[styles.hint, { color: theme.colors.text ?? '#AAA' }]}>
                  ⏰ Код действителен 3 минуты
                </Text>
                <Text style={[styles.hint, { color: theme.colors.text ?? '#AAA', marginTop: 4 }]}>
                  💡 После добавления вы увидите лекарства пациента
                </Text>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>

        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={2500}
          style={[
            styles.snackbar,
            {
              backgroundColor:
                snackbarType === 'success'
                  ? `${theme.colors.success}20`
                  : `${theme.colors.error}20`,
            },
          ]}
          action={{
            label: 'OK',
            onPress: () => setSnackbarVisible(false),
            labelStyle: {
              color: snackbarType === 'success' ? theme.colors.success : theme.colors.error,
            },
          }}
        >
          <Text
            style={{
              color: snackbarType === 'success' ? theme.colors.success : theme.colors.error,
              fontWeight: '500',
            }}
          >
            {snackbarMessage}
          </Text>
        </Snackbar>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(74, 58, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 28,
    color: '#4A3AFF',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF', // ✅ БЕЛЫЙ
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#A0C4FF', // ✅ СВЕТЛО-ГОЛУБОЙ ДЛЯ ЧИТАЕМОСТИ
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  inputWithQr: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    fontSize: 16,
    color: '#FFFFFF', // ✅ БЕЛЫЙ ТЕКСТ В ИНПУТЕ
  },
  qrButton: {
    marginLeft: 8,
    borderRadius: 12,
  },
  button: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 14,
    backgroundColor: '#4A3AFF',
  },
  loadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  loadingText: {
    fontSize: 14,
    marginLeft: 8,
  },
  infoBox: {
    marginTop: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  snackbar: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  appBar: {
    backgroundColor: 'transparent',
    elevation: 0,
  },
  scanFrameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: '#4A3AFF',
    borderRadius: 16,
  },
  scanInfo: {
    paddingBottom: 60,
    alignItems: 'center',
  },
  scanCard: {
    padding: 16,
    backgroundColor: 'rgba(30,30,30,0.8)',
    borderRadius: 16,
    marginHorizontal: 20,
  },
  scanTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF', // ✅ БЕЛЫЙ
    textAlign: 'center',
  },
  scanSubtitle: {
    fontSize: 14,
    color: '#AAA', // ✅ СЕРЫЙ, НО ЧИТАЕМЫЙ
    textAlign: 'center',
    marginTop: 6,
  },
  scanError: {
    color: '#FF6B6B',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
});