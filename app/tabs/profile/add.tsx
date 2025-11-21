// app/tabs/profile/add.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  TextInput,
  Button,
  Snackbar,
  useTheme,
  IconButton,
  Card,
} from 'react-native-paper';
import { AppBar } from '@/components/app-bar';
import { Screen } from '@/components/screen';
import apiClient from '@/services/api';
import { useRouter } from 'expo-router';
import { saveMedFriend, removeMedFriend } from '@/database';

// 🎨 MAI Tablets — кастомная палитра
const MAI_COLORS = {
  primary: '#4A3AFF',
  primaryLight: '#7D70FF',
  primaryDark: '#3024CC',
  success: '#22C55E',
  successLight: '#6EE7B7',
  error: '#EF4444',
  warning: '#F59E0B',
  background: '#0F0F0F',
  surface: '#1A1A1A',
  text: '#FFFFFF',
  textSecondary: '#A0A0A0',
  border: '#2A2A2A',
};

interface MedFriendQRData {
  type: 'med_friend_invitation';
  code: string;
}

type FriendStatus = 
  | { type: 'none' }
  | { type: 'patient'; friendName: string }
  | { type: 'friend'; patientName: string };

// ✅ ScannerComponent — вынесен НА УРОВЕНЬ МОДУЛЯ
const ScannerComponent = React.memo((
  { onScanSuccess, onScanError }: { 
    onScanSuccess: (code: string) => void; 
    onScanError: (message: string) => void; 
  }
) => {
  const Scanner = React.useMemo(() => {
    try {
      const { BarCodeScanner } = require('expo-barcode-scanner');
      return BarCodeScanner;
    } catch {
      return null;
    }
  }, []);

  const handleBarCodeScanned = useCallback(({ data }: { data: string }) => {
    try {
      const parsed = JSON.parse(data);
      if (
        parsed?.type === 'med_friend_invitation' &&
        typeof parsed.code === 'string' &&
        /^\d{6}$/.test(parsed.code)
      ) {
        onScanSuccess(parsed.code);
      } else {
        throw new Error();
      }
    } catch {
      onScanError(
        'Код должен быть сгенерирован в MAI Tablets.\nУбедитесь, что это QR приглашения мед-друга.'
      );
    }
  }, [onScanSuccess, onScanError]);

  if (!Scanner) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <Text style={styles.scanError}>❌ Сканер не загружен</Text>
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

export default function AddMedFriend() {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // ✅ ВСЕ ХУКИ — ТОЛЬКО НА ВЕРХНЕМ УРОВНЕ
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const inputScale = useRef(new Animated.Value(1)).current;
  const qrPulseAnim = useRef(new Animated.Value(1)).current;

  // ✅ Добавлены rowDelay* на верхнем уровне (ранее были внутри if)
  const rowDelay1 = useRef(new Animated.Value(0));
  const rowDelay2 = useRef(new Animated.Value(0));
  const rowDelay3 = useRef(new Animated.Value(0));

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarType, setSnackbarType] = useState<'success' | 'error'>('success');
  const [scanning, setScanning] = useState(false);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [status, setStatus] = useState<FriendStatus>({ type: 'none' });
  const [relationUuid, setRelationUuid] = useState<string | null>(null);

  // Проверка связи при монтировании
  useEffect(() => {
    checkExistingRelation();
  }, []);

  useEffect(() => {
    if (status.type === 'patient' || status.type === 'friend') {
      fetchRelationUuid();
    } else {
      setRelationUuid(null);
    }
  }, [status.type]);

  // ✅ Анимация stagger — запускается при изменении status.type на 'patient'/'friend'
  useEffect(() => {
    if (status.type === 'patient' || status.type === 'friend') {
      // Сбросить анимации
      rowDelay1.current.setValue(0);
      rowDelay2.current.setValue(0);
      rowDelay3.current.setValue(0);

      Animated.stagger(120, [
        Animated.timing(rowDelay1.current, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(rowDelay2.current, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(rowDelay3.current, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [status.type]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(inputScale, {
        toValue: 1,
        friction: 7,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    let pulseId: Animated.CompositeAnimation | undefined;
    if (!scanning && !scannerLoading) {
      pulseId = Animated.loop(
        Animated.sequence([
          Animated.timing(qrPulseAnim, {
            toValue: 1.06,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(qrPulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseId.start();
    }
    return () => pulseId?.stop();
  }, [scanning, scannerLoading]);

  const checkExistingRelation = async () => {
    try {
      const medFriendRes = await apiClient.getWithAuth('/friends/get-med-friend');
      if (medFriendRes.uuid) {
        setStatus({ type: 'patient', friendName: medFriendRes.username || 'Мед-друг' });
        return;
      }

      const patientRes = await apiClient.getWithAuth('/friends/get-patient');
      if (patientRes.uuid) {
        setStatus({ type: 'friend', patientName: patientRes.username || 'Пациент' });
        return;
      }

      setStatus({ type: 'none' });
    } catch (err) {
      console.warn('Проверка связи:', err);
      setStatus({ type: 'none' });
    }
  };

  const fetchRelationUuid = async () => {
    try {
      const res = status.type === 'patient'
        ? await apiClient.getWithAuth('/friends/get-med-friend')
        : await apiClient.getWithAuth('/friends/get-patient');
      setRelationUuid(res.uuid || null);
    } catch (err) {
      console.warn('Не удалось получить UUID связи', err);
      setRelationUuid(null);
    }
  };

  const loadAndStartScanner = async () => {
    Keyboard.dismiss();

    if (Platform.OS === 'web') {
      Alert.alert('Веб-версия', 'Сканирование QR недоступно в браузере.');
      return;
    }

    setScannerLoading(true);
    try {
      let BarCodeScanner;
      try {
        BarCodeScanner = require('expo-barcode-scanner').BarCodeScanner;
      } catch (e) {
        throw new Error('native_module_missing');
      }

      const { status: permStatus } = await BarCodeScanner.requestPermissionsAsync();
      if (permStatus !== 'granted') {
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
      const response = await apiClient.postWithAuth('/friends/add', { code: cleanCode });
      const { success, message } = response;

      if (!success) {
        throw new Error(message || 'Неизвестная ошибка сервера');
      }

      triggerSuccess('✅ Мед-друг добавлен!');
      
      const medFriendRes = await apiClient.getWithAuth('/friends/get-med-friend');
      if (medFriendRes.uuid) {
        await saveMedFriend(medFriendRes.uuid);
        setStatus({ type: 'patient', friendName: medFriendRes.username || 'Мед-друг' });
        setRelationUuid(medFriendRes.uuid);
      }
    } catch (err: any) {
      console.error('❌ Ошибка добавления мед-друга:', err);
      const msg = err.message || 'Ошибка сервера';
      triggerError(msg.includes('expired') ? 'Срок действия кода истёк' : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    Alert.alert(
      'Подтверждение',
      status.type === 'patient'
        ? 'Вы уверены, что хотите удалить мед-друга?'
        : 'Вы уверены, что хотите отписаться от пациента?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Да',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const endpoint =
                status.type === 'patient'
                  ? '/friends/remove-for-patient'
                  : '/friends/unsubscribe-from-patient';

              await apiClient.postWithAuth(endpoint, {});
              await removeMedFriend();

              triggerSuccess(
                status.type === 'patient'
                  ? '✅ Мед-друг удалён'
                  : '✅ Отписка успешна'
              );

              setTimeout(() => {
                setStatus({ type: 'none' });
                setRelationUuid(null);
                router.back();
              }, 1000);
            } catch (err: any) {
              const msg = err.message || 'Ошибка удаления';
              triggerError(msg);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
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
      Animated.timing(inputScale, { toValue: 0.94, duration: 70, useNativeDriver: true }),
      Animated.timing(inputScale, { toValue: 1.04, duration: 60, useNativeDriver: true }),
      Animated.spring(inputScale, { toValue: 1, friction: 6, tension: 220, useNativeDriver: true }),
    ]).start();
  };

  // ✅ РАННИЕ ВОЗВРАТЫ ПОСЛЕ ВСЕХ ХУКОВ — теперь безопасны
  if (scanning) {
    return (
      <Screen style={styles.container}>
        <ScannerComponent
          onScanSuccess={(scannedCode) => {
            setCode(scannedCode);
            setScanning(false);
            triggerSuccess('✅ Код получен из QR');
          }}
          onScanError={(message) => {
            setScanning(false);
            Alert.alert('Неверный QR-код', message);
          }}
        />
        <View style={styles.overlay}>
          <AppBar
            title="Сканирование QR"
            back
            onBack={() => setScanning(false)}
            style={styles.appBar}
          />
          <View style={styles.scanFrameContainer}>
            <View style={styles.scanFrame}>
              <View style={styles.scanFrameOverlay}>
                <View style={[styles.scanCorner, styles.scanCornerTopLeft]} />
                <View style={[styles.scanCorner, styles.scanCornerTopRight]} />
                <View style={[styles.scanCorner, styles.scanCornerBottomLeft]} />
                <View style={[styles.scanCorner, styles.scanCornerBottomRight]} />
                <Animated.View
                  style={[
                    styles.scanLine,
                    {
                      top: qrPulseAnim.interpolate({
                        inputRange: [1, 1.06],
                        outputRange: [30, 210],
                      }),
                    },
                  ]}
                />
              </View>
            </View>
          </View>
          <View style={styles.scanInfo}>
            <Card style={styles.scanCard} elevation={3}>
              <Text style={styles.scanTitle}>📲 Наведите на QR-код</Text>
              <Text style={styles.scanSubtitle}>
                Сгенерированный в MAI Tablets → «Профиль → Поделиться»
              </Text>
            </Card>
          </View>
        </View>
      </Screen>
    );
  }

  if (status.type === 'patient' || status.type === 'friend') {
    const isPatient = status.type === 'patient';
    const name = isPatient ? status.friendName : status.patientName;

    const title = isPatient ? '✅ Мед-друг подключён!' : '✅ Пациент подключён!';
    const subtitle = isPatient
      ? `Теперь вы видите лекарства и напоминания ${name}.`
      : `Теперь вы получаете уведомления о приёме ${name}.`;

    return (
      <Screen style={styles.container}>
        <Animated.View
          style={[
            styles.successContainer,
            {
              opacity: opacityAnim,
              transform: [
                { scale: opacityAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
                { translateY: opacityAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
              ],
            },
          ]}
        >
          <AppBar title={isPatient ? 'Мед-друг' : 'Пациент'} back onBack={() => router.back()} />

          <View style={styles.successContent}>
            <View style={styles.iconCircleSuccess}>
              <Text style={styles.iconSuccess}>{isPatient ? '🧑‍⚕️' : '🧑'}</Text>
            </View>

            <Text style={styles.titleSuccess}>{title}</Text>
            <Text style={styles.subtitleSuccess}>{subtitle}</Text>

            <Card style={styles.successCard} elevation={3}>
              <Animated.View style={{ opacity: rowDelay1.current }}>
                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>
                    {isPatient ? '🧑‍⚕️ Мед-друг:' : '🧑 Пациент:'}
                  </Text>
                  <Text style={styles.successValue}>{name}</Text>
                </View>
              </Animated.View>
              <Animated.View style={{ opacity: rowDelay2.current, marginTop: 8 }}>
                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>📅 Подключён:</Text>
                  <Text style={styles.successValue}>
                    {new Date().toLocaleDateString('ru-RU')}
                  </Text>
                </View>
              </Animated.View>
              {relationUuid && (
                <Animated.View style={{ opacity: rowDelay3.current, marginTop: 8 }}>
                  <View style={styles.successRow}>
                    <Text style={styles.successLabel}>🔗 UUID:</Text>
                    <TouchableOpacity
                      onPress={async () => {
                        await Clipboard.setStringAsync(relationUuid);
                        triggerSuccess('✅ UUID скопирован!');
                      }}
                      activeOpacity={0.85}
                      style={styles.uuidTouchable}
                    >
                      <Text style={styles.successUuid} selectable suppressHighlighting>
                        {relationUuid}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )}
            </Card>

            <Button
              mode="contained"
              disabled
              style={[styles.greenButton, { marginBottom: 16 }]}
              labelStyle={{ fontWeight: '600', color: '#FFFFFF' }}
            >
              🎉 Всё готово!
            </Button>

            <Button
              mode="outlined"
              textColor={theme.colors.error}
              onPress={handleRemove}
              loading={loading}
              disabled={loading}
              style={styles.removeButton}
              labelStyle={{ fontWeight: '600' }}
            >
              {isPatient ? '❌ Удалить мед-друга' : '❌ Отписаться от пациента'}
            </Button>

            <Button
              mode="text"
              onPress={() => router.back()}
              style={styles.backButton}
              labelStyle={{ color: theme.colors.text, fontWeight: '500' }}
              rippleColor={`${MAI_COLORS.primary}40`}
              delayPressIn={0}
            >
              ← Вернуться в профиль
            </Button>
          </View>
        </Animated.View>

        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={2200}
          style={[
            styles.snackbar,
            {
              backgroundColor:
                snackbarType === 'success'
                  ? `${MAI_COLORS.success}18`
                  : `${MAI_COLORS.error}18`,
            },
          ]}
          action={{
            label: 'OK',
            onPress: () => setSnackbarVisible(false),
            labelStyle: {
              color: snackbarType === 'success' ? MAI_COLORS.success : MAI_COLORS.error,
              fontWeight: '600',
            },
          }}
        >
          <Text
            style={{
              color: snackbarType === 'success' ? MAI_COLORS.success : MAI_COLORS.error,
              fontWeight: '600',
            }}
          >
            {snackbarMessage}
          </Text>
        </Snackbar>
      </Screen>
    );
  }

  const getMainIcon = () => {
    if (status.type === 'none') return '🤝';
    if (status.type === 'patient') return '🧑‍⚕️';
    if (status.type === 'friend') return '🧑';
    return '🤝';
  };

  return (
    <Screen style={styles.container}>
      <Animated.View
        style={[
          { flex: 1 },
          {
            opacity: opacityAnim,
            transform: [
              { scale: inputScale },
              { translateY: opacityAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
            ],
          },
        ]}
      >
        <AppBar title="🤝 Добавить мед. друга" back onBack={() => router.back()} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.content}>
              <View style={styles.iconCircle}>
                <Text style={styles.icon}>{getMainIcon()}</Text>
              </View>

              <Text style={styles.title}>Код приглашения</Text>
              <Text style={styles.subtitle}>
                Введите 6-значный код или отсканируйте QR
              </Text>

              <Animated.View
                style={[
                  { width: '100%', maxWidth: isTablet ? 400 : 320 },
                  { transform: [{ scale: inputScale }] },
                ]}
              >
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
                        primary: MAI_COLORS.primary,
                        outline: MAI_COLORS.border,
                        background: MAI_COLORS.surface,
                        placeholder: MAI_COLORS.textSecondary,
                        text: MAI_COLORS.text,
                      },
                    }}
                    autoFocus
                    error={snackbarType === 'error' && !!code}
                    onSubmitEditing={handleSubmit}
                  />
                  <Animated.View style={{ transform: [{ scale: qrPulseAnim }] }}>
                    <IconButton
                      icon="qrcode-scan"
                      size={38}
                      onPress={loadAndStartScanner}
                      onPressIn={() => inputScale.setValue(0.94)}
                      onPressOut={() =>
                        Animated.spring(inputScale, {
                          toValue: 1,
                          friction: 7,
                          tension: 120,
                          useNativeDriver: true,
                        }).start()
                      }
                      style={styles.qrButton}
                      iconColor="#FFFFFF"
                      containerColor={`rgba(74, 58, 255, 0.25)`}
                      disabled={scannerLoading}
                    />
                  </Animated.View>
                </View>
              </Animated.View>

              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={loading}
                disabled={loading}
                style={styles.button}
                contentStyle={{ paddingVertical: 14 }}
                labelStyle={{ fontWeight: '600', fontSize: 16 }}
              >
                {loading ? 'Добавление...' : '➕ Добавить мед-друга'}
              </Button>

              {scannerLoading && (
                <View style={styles.loadingIndicator}>
                  <ActivityIndicator color={MAI_COLORS.primary} />
                  <Text style={styles.loadingText}>Загрузка сканера…</Text>
                </View>
              )}

              <Card style={styles.infoCard} elevation={1}>
                <Text style={styles.hint}>⏳ Код живёт 3 минуты</Text>
                <Text style={[styles.hint, { marginTop: 4 }]}>
                  📲 После подключения — лекарства и напоминания в реальном времени
                </Text>
              </Card>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>

        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={2200}
          style={[
            styles.snackbar,
            {
              backgroundColor:
                snackbarType === 'success'
                  ? `${MAI_COLORS.success}18`
                  : `${MAI_COLORS.error}18`,
            },
          ]}
          action={{
            label: 'OK',
            onPress: () => setSnackbarVisible(false),
            labelStyle: {
              color: snackbarType === 'success' ? MAI_COLORS.success : MAI_COLORS.error,
              fontWeight: '600',
            },
          }}
        >
          <Text
            style={{
              color: snackbarType === 'success' ? MAI_COLORS.success : MAI_COLORS.error,
              fontWeight: '600',
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
    backgroundColor: MAI_COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    alignSelf: 'center',
    width: '100%',
  },
  successContainer: {
    flex: 1,
  },
  successContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    alignSelf: 'center',
    width: '100%',
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: `rgba(${parseInt(MAI_COLORS.primary.slice(1, 3), 16)}, ${parseInt(MAI_COLORS.primary.slice(3, 5), 16)}, ${parseInt(MAI_COLORS.primary.slice(5, 7), 16)}, 0.2)`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 32,
    color: MAI_COLORS.primary,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: MAI_COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: MAI_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 24,
    lineHeight: 22,
  },
  inputWithQr: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  input: {
    backgroundColor: MAI_COLORS.surface,
    borderRadius: 14,
    fontSize: 16,
    color: MAI_COLORS.text,
  },
  qrButton: {
    marginLeft: 8,
    borderRadius: 14,
    width: 56,
    height: 56,
  },
  button: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 14,
    backgroundColor: MAI_COLORS.primary,
  },
  loadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  loadingText: {
    fontSize: 14,
    marginLeft: 8,
    color: MAI_COLORS.text,
  },
  infoCard: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: `${MAI_COLORS.surface}CC`,
    borderRadius: 12,
    maxWidth: 320,
    width: '100%',
  },
  hint: {
    fontSize: 13,
    color: MAI_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  snackbar: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  iconCircleSuccess: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: `${MAI_COLORS.success}40`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  iconSuccess: {
    fontSize: 34,
    color: MAI_COLORS.success,
  },
  titleSuccess: {
    fontSize: 26,
    fontWeight: '700',
    color: MAI_COLORS.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitleSuccess: {
    fontSize: 16,
    color: MAI_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 24,
    lineHeight: 22,
  },
  successCard: {
    width: '100%',
    maxWidth: 340,
    padding: 18,
    backgroundColor: MAI_COLORS.surface,
    borderRadius: 16,
    marginBottom: 24,
  },
  successRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  successLabel: {
    color: MAI_COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  successValue: {
    color: MAI_COLORS.text,
    fontWeight: '600',
    fontSize: 14,
  },
  uuidTouchable: {
    flex: 1,
    alignItems: 'flex-end',
  },
  successUuid: {
    color: MAI_COLORS.successLight,
    fontWeight: '500',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flexShrink: 1,
    textAlign: 'right',
  },
  greenButton: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 14,
    backgroundColor: MAI_COLORS.success,
  },
  removeButton: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 14,
    borderColor: MAI_COLORS.error,
    borderWidth: 1,
    marginBottom: 12,
  },
  backButton: {
    width: '100%',
    maxWidth: 320,
  },
  overlay: {
    flex: 1,
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
    borderRadius: 16,
    position: 'relative',
  },
  scanFrameOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scanCorner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: MAI_COLORS.primary,
    borderWidth: 3,
  },
  scanCornerTopLeft: {
    top: 4,
    left: 4,
    borderLeftWidth: 3,
    borderTopWidth: 3,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  scanCornerTopRight: {
    top: 4,
    right: 4,
    borderRightWidth: 3,
    borderTopWidth: 3,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  scanCornerBottomLeft: {
    bottom: 4,
    left: 4,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  scanCornerBottomRight: {
    bottom: 4,
    right: 4,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: MAI_COLORS.primary,
    borderRadius: 1,
    opacity: 0.85,
  },
  scanInfo: {
    paddingBottom: 60,
    alignItems: 'center',
  },
  scanCard: {
    padding: 18,
    backgroundColor: 'rgba(26, 26, 26, 0.88)',
    borderRadius: 16,
    marginHorizontal: 24,
    alignItems: 'center',
  },
  scanTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: MAI_COLORS.text,
    textAlign: 'center',
  },
  scanSubtitle: {
    fontSize: 14,
    color: MAI_COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  scanError: {
    color: MAI_COLORS.error,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    fontWeight: '600',
  },
});