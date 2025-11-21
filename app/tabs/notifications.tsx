// app/(tabs)/notifications.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  ScrollView, 
  Alert, 
  Animated 
} from 'react-native';
import { 
  Text, 
  Button, 
  List, 
  IconButton, 
  useTheme,
  Snackbar 
} from 'react-native-paper';
import * as Notifications from 'expo-notifications';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Screen } from '@/components/screen';
import { useDatabase } from '@/hooks/use-database';
import { usePushNotifications } from '@/hooks/usePushNotifications';

// ✅ ФИКС ЧАСОВОГО ПОЯСА: конвертирует локальную дату → UTC timestamp (для trigger.date в Expo)
const localDateToUtcTimestamp = (localDate: Date): number => {
  return Date.UTC(
    localDate.getFullYear(),
    localDate.getMonth(),
    localDate.getDate(),
    localDate.getHours(),
    localDate.getMinutes(),
    localDate.getSeconds(),
    localDate.getMilliseconds()
  );
};

// ✅ Надёжный парсинг времени "HH:mm" → [hour, minute] | null
const parseTime = (timeStr: string): [number, number] | null => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const trimmed = timeStr.trim();
  const parts = trimmed.split(':');
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return [h, m];
};

// ✅ Функция планирования уведомления за 10 минут до приёма (улучшена: валидация + TZ фикс)
async function scheduleMedicationNotification(
  name: string,
  form: string,
  time: string,
  repeats: boolean
) {
  try {
    const timeParts = parseTime(time);
    if (!timeParts) {
      console.warn(`⚠️ Неверный формат времени: ${time}`);
      return null;
    }

    const [hour, minute] = timeParts;
    const now = new Date();
    const scheduledTime = new Date();

    scheduledTime.setHours(hour);
    scheduledTime.setMinutes(minute - 10); // 🕐 минус 10 минут
    scheduledTime.setSeconds(0);
    scheduledTime.setMilliseconds(0);

    // Если уже прошло — переносим на завтра
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: `💊 ${name}`,
        body: `Через 10 минут нужно принять медикамент (${form || 'лекарство'}) в ${time}`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: repeats
        ? {
            hour: scheduledTime.getHours(),
            minute: scheduledTime.getMinutes(),
            repeats: true,
          }
        : { date: localDateToUtcTimestamp(scheduledTime) }, // ✅ ВОТ ОНО!
    });

    console.log(`⏰ Уведомление запланировано на ${scheduledTime} для ${name}`);
    return { identifier, scheduledTime, name, time, repeats };
  } catch (error: any) {
    console.error("Ошибка при планировании уведомления:", error.message || error);
    return null;
  }
}

export default function NotificationsScreen() {
  const { getMedications } = useDatabase();
  const { expoPushToken } = usePushNotifications();
  const theme = useTheme();

  const [scheduled, setScheduled] = useState<Notifications.NotificationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarType, setSnackbarType] = useState<'success' | 'error'>('success');

  // Анимации: плавное появление заголовка и списка
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const listOpacity = useRef(new Animated.Value(0)).current;

  // 📅 Планируем уведомления по данным из SQLite — ОСНОВНАЯ ЛОГИКА ИЗ ПЕРВОГО ФАЙЛА (улучшена)
  const scheduleAllMedNotifications = async () => {
    setLoading(true);
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      const meds = await getMedications();
      console.log("📋 Найдено лекарств:", meds.length);

      const scheduledList: Notifications.NotificationRequest[] = [];

      for (const med of meds) {
        const times = Array.isArray(med.times_list)
          ? med.times_list
          : typeof med.times_list === "string"
          ? JSON.parse(med.times_list)
          : [];

        for (const time of times) {
          const result = await scheduleMedicationNotification(
            med.name,
            med.form,
            time,
            med.schedule_type === "daily"
          );
          if (result) {
            // Добавляем в локальный список для отображения
            scheduledList.push({
              identifier: result.identifier,
              content: {
                title: `💊 ${result.name}`,
                body: `Через 10 минут нужно принять медикамент (${med.form || 'лекарство'}) в ${result.time}`,
              },
              trigger: result.repeats 
                ? { hour: new Date(result.scheduledTime).getHours(), minute: new Date(result.scheduledTime).getMinutes(), repeats: true }
                : { date: result.scheduledTime },
            });
          }
        }
      }

      const all = await Notifications.getAllScheduledNotificationsAsync();
      setScheduled(all);

      setSnackbarMessage(`✅ Запланировано ${all.length} уведомлений`);
      setSnackbarType('success');
    } catch (error: any) {
      const msg = error.message || 'Неизвестная ошибка';
      console.error('💥 Ошибка планирования:', msg);
      setSnackbarMessage(msg);
      setSnackbarType('error');
    } finally {
      setLoading(false);
      setSnackbarVisible(true);
    }
  };

  // Инициализация: загрузка существующих уведомлений + анимация + слушатели
  useEffect(() => {
    const init = async () => {
      try {
        const existing = await Notifications.getAllScheduledNotificationsAsync();
        setScheduled(existing);

        // Плавное появление
        Animated.parallel([
          Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(listOpacity, { toValue: 1, duration: 400, delay: 100, useNativeDriver: true }),
        ]).start();
      } catch (e) {
        console.warn('⚠️ Не удалось загрузить уведомления:', e);
      }
    };
    init();

    // Слушатели уведомлений
    const sub1 = Notifications.addNotificationReceivedListener(notification => {
      setSnackbarMessage(`🔔 ${notification.request.content.title}`);
      setSnackbarType('success');
      setSnackbarVisible(true);
    });

    const sub2 = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('✅ Уведомление открыто:', response.notification.request.content.title);
    });

    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, [opacityAnim, listOpacity]);

  // Очистка всех уведомлений с подтверждением (улучшено: Alert)
  const cancelAllNotifications = () => {
    Alert.alert(
      'Очистить все уведомления?',
      'Все запланированные напоминания будут удалены.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Очистить',
          style: 'destructive',
          onPress: async () => {
            await Notifications.cancelAllScheduledNotificationsAsync();
            setScheduled([]);
            setSnackbarMessage('🗑️ Уведомления очищены');
            setSnackbarType('success');
            setSnackbarVisible(true);
          },
        },
      ]
    );
  };

  // Безопасное отображение токена
  const getPushTokenPreview = () => {
    if (typeof expoPushToken !== 'string') return '—';
    return expoPushToken.length > 6 ? `${expoPushToken.slice(0, 6)}...` : expoPushToken;
  };

  return (
    <Screen style={{ flex: 1, backgroundColor: "#121212", paddingHorizontal: 16, paddingTop: 20 }}>
      <Animated.View style={{ opacity: opacityAnim, flex: 1 }}>
        <Text style={{ color: "white", fontSize: 20, fontWeight: '600', marginBottom: 16 }}>
          Уведомления о приёме лекарств
        </Text>

        {/* Кнопки */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          <Button 
            mode="contained" 
            onPress={scheduleAllMedNotifications} 
            loading={loading}
            disabled={loading}
            style={{ flex: 1 }}
          >
            {loading ? 'Планируем...' : 'Создать уведомления из базы'}
          </Button>
          
          <IconButton
            icon="delete-outline"
            size={32}
            onPress={cancelAllNotifications}
            disabled={loading}
            iconColor="#FF4444"
            containerColor="rgba(255, 68, 68, 0.15)"
            style={{ width: 52, height: 52, borderRadius: 26 }}
          />
        </View>

        <Text style={{ color: "#aaa", marginBottom: 12 }}>
          Всего запланировано: {scheduled.length}
        </Text>

        {/* Статус push-токена */}
        {expoPushToken !== undefined && (
          <View style={{ 
            backgroundColor: 'rgba(30,41,59,0.4)', 
            borderRadius: 12, 
            padding: 12, 
            marginBottom: 20 
          }}>
            <Text style={{ color: "#888", fontSize: 13 }}>
              Expo Push Token: {getPushTokenPreview()}
            </Text>
          </View>
        )}

        {/* Список уведомлений — улучшенный UI */}
        <Animated.View style={{ opacity: listOpacity }}>
          {scheduled.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ color: "#888", fontSize: 16 }}>
                Нет запланированных уведомлений
              </Text>
            </View>
          ) : (
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {scheduled.map((n) => {
                // Извлекаем дату: либо timestamp, либо Date
                const triggerDate = n.trigger && 'date' in n.trigger 
                  ? (typeof n.trigger.date === 'number' ? new Date(n.trigger.date) : n.trigger.date)
                  : new Date();

                const formattedTime = format(triggerDate, 'dd MMM HH:mm', { locale: ru });

                return (
                  <List.Item
                    key={n.identifier}
                    title={n.content.title}
                    description={n.content.body}
                    left={() => (
                      <View style={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: 20, 
                        backgroundColor: 'rgba(255, 75, 128, 0.15)', 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        marginRight: 12
                      }}>
                        <Text style={{ fontSize: 18, color: '#FF4B80' }}>⏰</Text>
                      </View>
                    )}
                    right={() => (
                      <Text style={{ color: '#888', fontSize: 12, width: 80, textAlign: 'right' }}>
                        {formattedTime}
                      </Text>
                    )}
                    style={{ 
                      backgroundColor: '#1E1E1E', 
                      borderRadius: 12,
                      marginBottom: 10,
                      paddingHorizontal: 8,
                      borderLeftWidth: 3,
                      borderLeftColor: '#63B3ED'
                    }}
                    titleStyle={{ color: '#fff', fontWeight: '600' }}
                    descriptionStyle={{ color: '#ccc', fontSize: 13 }}
                  />
                );
              })}
            </ScrollView>
          )}
        </Animated.View>
      </Animated.View>

      {/* Snackbar — визуальная обратная связь */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={{ 
          backgroundColor: snackbarType === 'success' ? '#1E293B' : '#451A1A',
          marginBottom: 20,
          borderRadius: 12,
        }}
      >
        <Text style={{ 
          color: snackbarType === 'success' ? '#6EE7B7' : '#FCA5A5', 
          fontWeight: '500'
        }}>
          {snackbarMessage}
        </Text>
      </Snackbar>
    </Screen>
  );
}