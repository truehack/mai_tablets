// app/tabs/profile.tsx
import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Alert, 
  Animated, 
  Platform,
  TouchableOpacity,
  Modal
} from 'react-native';
import { 
  Button, 
  Card, 
  Snackbar, 
  Switch, 
  List, 
  useTheme 
} from 'react-native-paper';
import { AppBar } from '@/components/app-bar';
import { Screen } from '@/components/screen';
import { useDatabase } from '@/hooks/use-database';
import apiClient from '@/services/api';
import { useRouter } from 'expo-router';

// QR-код (чистый JS, работает в Expo Go)
import QRCode from 'react-native-qrcode-svg';

// Только встроенный Share — работает без нативных модулей
import { Share } from 'react-native';

export default function Profile() {
  const db = useDatabase();
  const router = useRouter();
  const theme = useTheme();

  // Анимации
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  const [login, setLogin] = useState<string | null>(null);
  const [screen, setScreen] = useState<'profile' | 'invite'>('profile');

  const [code, setCode] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarType, setSnackbarType] = useState<'success' | 'error' | 'info'>('success');
  const [qrVisible, setQrVisible] = useState(false);

  // Мед-друг режим
  const [isMedFriendMode, setIsMedFriendMode] = useState(false);
  const [medFriendInfo, setMedFriendInfo] = useState<{ uuid: string; username: string } | null>(null);
  const [patientInfo, setPatientInfo] = useState<{ uuid: string; username: string } | null>(null);

  // Загрузка профиля
  useEffect(() => {
    const loadProfile = async () => {
      const localUser = await db.getLocalUser();
      if (localUser) {
        const cleanLogin = localUser.patient_uuid.replace(/^UUID-/, '');
        setLogin(cleanLogin);
      }

      try {
        const response = await apiClient.postWithAuth('/friends/get-med-friend', {});
        if (response.uuid && response.username) setMedFriendInfo({ uuid: response.uuid, username: response.username });
      } catch { /* silent */ }

      try {
        const response = await apiClient.postWithAuth('/friends/get-patient', {});
        if (response.uuid && response.username) setPatientInfo({ uuid: response.uuid, username: response.username });
      } catch { /* silent */ }
    };
    loadProfile();
  }, [db]);

  // Анимация входа
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(contentAnim, {
        toValue: 1,
        duration: 400,
        delay: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Генерация кода (авто при переходе)
  useEffect(() => {
    if (screen === 'invite') generateCode();
  }, [screen]);

  const generateCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.postWithAuth('/friends/invitation', {});
      setCode(response.code);
      setExpiresIn(response.expires_in_seconds);
    } catch (err: any) {
      setError(err.message || 'Не удалось создать код');
      setCode(null);
      setSnackbarMessage('❌ Ошибка генерации кода');
      setSnackbarType('error');
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (code) {
      Alert.alert(
        'Код приглашения',
        code,
        [{ text: 'Закрыть', style: 'default' }],
        { cancelable: true }
      );
      setSnackbarMessage('✅ Код показан — удерживайте текст для копирования');
      setSnackbarType('success');
    }
  };

  const shareCode = async () => {
    if (!code) return;

    const message = `Привет! Добавь меня как мед. друга в SmartDoctor. Мой код: ${code}\nДействует ${Math.floor((expiresIn || 300) / 60)} мин.`;
    const title = 'Пригласить в SmartDoctor';

    try {
      // 1. Веб: navigator.share()
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text: message });
        setSnackbarMessage('✅ Отправлено');
        setSnackbarType('success');
        return;
      }

      // 2. Мобилка: React Native Share
      if (Platform.OS !== 'web') {
        const result = await Share.share({ message, title });
        if (result.action === Share.sharedAction) {
          setSnackbarMessage('✅ Отправлено');
          setSnackbarType('success');
        } else if (result.action === Share.dismissedAction) {
          setSnackbarMessage('ℹ️ Отменено');
          setSnackbarType('info');
        }
        return;
      }

      // 3. Fallback: показ кода в Alert
      Alert.alert(
        'Поделиться кодом',
        `Ваш код: ${code}\n\nНажмите «OK», затем удерживайте текст, чтобы скопировать.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setSnackbarMessage('📋 Скопируйте код вручную');
              setSnackbarType('info');
            },
          },
        ],
        { cancelable: true }
      );
    } catch (error: any) {
      console.warn('Все методы шаринга не сработали:', error);
      Alert.alert(
        'Код приглашения',
        `Ваш код: ${code}\n\nОтправьте его в WhatsApp, Telegram или другому приложению вручную.`,
        [{ text: 'Закрыть', style: 'cancel' }]
      );
      setSnackbarMessage('ℹ️ Код показан');
      setSnackbarType('info');
    }
  };

  const goBack = () => {
    setScreen('profile');
    setCode(null);
    setError(null);
  };

  const handleMedFriendSwitch = () => {
    if (patientInfo) {
      setIsMedFriendMode(!isMedFriendMode);
    } else {
      Alert.alert(
        'Нет пациента',
        'Сначала добавьте пациента по коду приглашения',
        [{ text: 'OK', onPress: () => router.push('/profile/add') }]
      );
    }
  };

  const handleRemoveMedFriend = async () => {
    Alert.alert('Удалить мед-друга?', 'Вы уверены?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.postWithAuth('/friends/remove-for-patient', {});
            setMedFriendInfo(null);
            setSnackbarMessage('✅ Мед-друг удалён');
            setSnackbarType('success');
            setSnackbarVisible(true);
          } catch (err: any) {
            setSnackbarMessage(err.message || 'Ошибка удаления');
            setSnackbarType('error');
            setSnackbarVisible(true);
          }
        },
      },
    ]);
  };

  const handleUnsubscribe = async () => {
    Alert.alert('Отписаться от пациента?', 'Вы перестанете видеть его медикаменты', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Отписаться',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.postWithAuth('/friends/unsubscribe-from-patient', {});
            setPatientInfo(null);
            setIsMedFriendMode(false);
            setSnackbarMessage('✅ Отписка успешна');
            setSnackbarType('success');
            setSnackbarVisible(true);
          } catch (err: any) {
            setSnackbarMessage(err.message || 'Ошибка отписки');
            setSnackbarType('error');
            setSnackbarVisible(true);
          }
        },
      },
    ]);
  };

  return (
    <Screen style={styles.container}>
      <Animated.View style={[styles.animatedContainer, { opacity: opacityAnim }]}>
        <AppBar 
          title={screen === 'profile' ? 'Профиль' : 'Код приглашения'}
          back={screen === 'invite'}
          onBack={screen === 'invite' ? goBack : undefined}
        />

        {screen === 'profile' ? (
          <Animated.View style={{ opacity: contentAnim, flex: 1 }}>
            <View style={styles.headerSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>👤</Text>
              </View>
              <Text style={styles.welcome}>Добро пожаловать!</Text>
              <Text style={styles.login}>{login ?? '—'}</Text>
            </View>

            <Card style={styles.card}>
              <Card.Content>
                {patientInfo && (
                  <View style={styles.switchRow}>
                    <View style={styles.switchLabelContainer}>
                      <Text style={styles.switchTitle}>Режим мед-друга</Text>
                      <Text style={styles.switchSubtitle}>
                        {isMedFriendMode
                          ? 'Вы просматриваете лекарства пациента'
                          : 'Включите для просмотра лекарств пациента'}
                      </Text>
                    </View>
                    <Switch value={isMedFriendMode} onValueChange={handleMedFriendSwitch} color={theme.colors.primary} />
                  </View>
                )}

                {medFriendInfo && (
                  <List.Item
                    title="Ваш мед-друг"
                    description={medFriendInfo.username}
                    left={() => (
                      <View style={styles.listIconBadge}>
                        <Text style={styles.listIcon}>🧑‍⚕️</Text>
                      </View>
                    )}
                    right={() => (
                      <Button
                        mode="text"
                        textColor={theme.colors.error}
                        onPress={handleRemoveMedFriend}
                        labelStyle={{ fontWeight: '600' }}
                      >
                        Удалить
                      </Button>
                    )}
                    style={styles.listItem}
                    titleStyle={styles.listTitle}
                    descriptionStyle={styles.listDescription}
                  />
                )}

                {patientInfo && (
                  <List.Item
                    title="Ваш пациент"
                    description={patientInfo.username}
                    left={() => (
                      <View style={[styles.listIconBadge, { backgroundColor: 'rgba(52, 199, 89, 0.15)' }]}>
                        <Text style={styles.listIcon}>🩺</Text>
                      </View>
                    )}
                    right={() => (
                      <Button
                        mode="text"
                        textColor={theme.colors.error}
                        onPress={handleUnsubscribe}
                        labelStyle={{ fontWeight: '600' }}
                      >
                        Отписаться
                      </Button>
                    )}
                    style={styles.listItem}
                    titleStyle={styles.listTitle}
                    descriptionStyle={styles.listDescription}
                  />
                )}

                {!isMedFriendMode && (
                  <>
                    <Button
                      mode="contained"
                      onPress={() => router.push('/profile/add')}
                      style={styles.actionButton}
                      contentStyle={{ paddingVertical: 12 }}
                      icon="account-plus"
                      labelStyle={{ fontWeight: '600' }}
                    >
                      Добавить мед. друга
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={() => setScreen('invite')}
                      style={[styles.actionButton, { marginTop: 12 }]}
                      contentStyle={{ paddingVertical: 12 }}
                      icon="link-variant"
                      labelStyle={{ fontWeight: '600', color: theme.colors.primary }}
                    >
                      Показать свой код приглашения
                    </Button>
                  </>
                )}
              </Card.Content>
            </Card>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                {isMedFriendMode
                  ? '💡 Вы в режиме мед-друга: только просмотр лекарств пациента'
                  : '💡 Переключитесь в режим мед-друга, чтобы видеть лекарства пациента'}
              </Text>
            </View>
          </Animated.View>
        ) : (
          <Animated.View style={{ opacity: contentAnim, flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
            <View style={styles.iconCircle}>
              <Text style={styles.icon}>🔗</Text>
            </View>

            <Text style={styles.inviteTitle}>Ваш код приглашения</Text>

            {loading && (
              <Text style={styles.inviteSubtitle}>Генерация кода...</Text>
            )}

            {error && !loading && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <Button
                  mode="contained"
                  onPress={generateCode}
                  style={{ marginTop: 16, borderRadius: 14 }}
                  contentStyle={{ paddingVertical: 8 }}
                  icon="reload"
                  labelStyle={{ fontWeight: '600' }}
                >
                  Повторить
                </Button>
              </View>
            )}

            {code && !loading && (
              <>
                <TouchableOpacity onPress={() => setQrVisible(true)} activeOpacity={0.9}>
                  <View style={styles.codeBox}>
                    <Text style={styles.codeText}>{code}</Text>
                    <Text style={styles.codeHint}>👆 Нажмите для QR-кода</Text>
                  </View>
                </TouchableOpacity>
                <Text style={styles.expiryText}>
                  Действителен {expiresIn ? Math.floor(expiresIn / 60) : 5} мин
                </Text>

                <View style={styles.buttonRow}>
                  <Button
                    mode="contained"
                    onPress={copyToClipboard}
                    style={{ flex: 1, borderRadius: 14 }}
                    contentStyle={{ paddingVertical: 12 }}
                    icon="eye-outline"
                    labelStyle={{ fontWeight: '600' }}
                  >
                    Показать
                  </Button>
                  <Button
                    mode="contained-tonal"
                    onPress={shareCode}
                    style={{ flex: 1, marginLeft: 12, borderRadius: 14 }}
                    contentStyle={{ paddingVertical: 12 }}
                    icon="share-variant"
                    labelStyle={{ fontWeight: '600' }}
                  >
                    Поделиться
                  </Button>
                </View>

                <Text style={styles.hintText}>
                  Передайте код мед. другу — он введёт его в своём приложении.
                </Text>
              </>
            )}
          </Animated.View>
        )}

        {/* Модалка QR */}
        <Modal
          visible={qrVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setQrVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>QR-код приглашения</Text>
              <Text style={styles.modalSubtitle}>Отсканируйте в SmartDoctor</Text>

              <View style={styles.qrContainer}>
                <QRCode
                  value={JSON.stringify({
                    type: 'med_friend_invitation',
                    code: code,
                    expires_in: expiresIn,
                  })}
                  size={200}
                  color="#000"
                  backgroundColor="#fff"
                  logoBackgroundColor="#4A3AFF"
                />
              </View>

              <Text style={styles.qrText}>
                Код: <Text style={styles.qrCode}>{code}</Text>
              </Text>

              <Button
                mode="text"
                onPress={() => setQrVisible(false)}
                labelStyle={{ color: '#4A3AFF', fontWeight: '600' }}
              >
                Закрыть
              </Button>
            </View>
          </View>
        </Modal>

        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={2500}
          style={[
            styles.snackbar,
            { 
              backgroundColor: 
                snackbarType === 'success' ? '#252D25' : 
                snackbarType === 'error' ? '#2D2525' : 
                '#2A2A3A'
            }
          ]}
        >
          <Text style={{ 
            color: 
              snackbarType === 'success' ? '#6EE7B7' : 
              snackbarType === 'error' ? '#FCA5A5' : 
              '#B0B0FF',
            fontWeight: '500' 
          }}>
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
    backgroundColor: '#121212',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  animatedContainer: {
    flex: 1,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#2D2D2D',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarText: {
    fontSize: 42,
    color: '#FFFFFF',
  },
  welcome: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  login: {
    fontSize: 20,
    fontWeight: '500',
    color: '#63B3ED',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    marginBottom: 24,
    elevation: 0,
    shadowOpacity: 0,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  switchSubtitle: {
    fontSize: 13,
    color: '#888',
  },
  listItem: {
    backgroundColor: '#242424',
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  listIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(74, 58, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listIcon: {
    fontSize: 20,
    color: '#4A3AFF',
  },
  listTitle: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  listDescription: {
    color: '#AAA',
    fontSize: 13,
  },
  actionButton: {
    borderRadius: 14,
    marginTop: 16,
  },
  infoBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginTop: 'auto',
  },
  infoText: {
    color: '#A0C4FF',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
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
  inviteTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  inviteSubtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
  },
  errorBox: {
    alignItems: 'center',
    marginVertical: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 16,
  },
  codeBox: {
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 20,
    minWidth: 260,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  codeText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  codeHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  expiryText: {
    fontSize: 15,
    color: '#888',
    marginBottom: 28,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 340,
    marginBottom: 24,
  },
  hintText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  snackbar: {
    marginBottom: 20,
    borderRadius: 12,
  },
  // Modal QR
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
  },
  qrContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  qrText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  qrCode: {
    color: '#63B3ED',
    fontWeight: '600',
  },
});