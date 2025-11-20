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
import { format, addDays, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Screen } from '@/components/screen';
import { useDatabase, Medication } from '@/hooks/use-database';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const MAX_LOOKAHEAD_DAYS = 56;

// Тип для совместимости: объект, возвращаемый getAllScheduledNotificationsAsync + доп. поля
type ScheduledNotification = {
  identifier: string;
  date: number; // timestamp
  content: {
    title: string;
    body: string;
    data?: Record<string, any>;
    sound?: boolean | string;
    color?: string;
  };
  trigger: { date: Date | number }; // может быть Date или number (timestamp)
  medicationName?: string; // для отображения
};

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

export default function NotificationsScreen() {
  const { getMedications } = useDatabase();
  const { expoPushToken } = usePushNotifications();
  const theme = useTheme();

  const [scheduled, setScheduled] = useState<ScheduledNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarType, setSnackbarType] = useState<'success' | 'error'>('success');

  // Анимации: плавное появление заголовка и списка
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const listOpacity = useRef(new Animated.Value(0)).current;

  // Парсит строку времени в формате "HH:mm" → [час, минута], с валидацией
  const parseTime = useCallback((timeStr: string): [number, number] | null => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const trimmed = timeStr.trim();
    const parts = trimmed.split(':');
    if (parts.length !== 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
    return [h, m];
  }, []);

  // Находит ближайшую дату приёма после `afterDate`, учитывая тип расписания
  const getNextScheduledDate = useCallback((
    med: Medication,
    afterDateInput: Date
  ): Date | null => {
    // ✅ Обнуляем время — работаем с календарными днями
    const afterDate = new Date(afterDateInput);
    afterDate.setHours(0, 0, 0, 0);

    const startDate = med.start_date ? parseISO(med.start_date) : new Date();
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = med.end_date ? parseISO(med.end_date) : null;
    if (endDate) {
      endDate.setHours(0, 0, 0, 0);
      if (afterDate > endDate) return null;
    }

    let nextDate = new Date(afterDate);

    if (nextDate < startDate) {
      nextDate = new Date(startDate);
    }

    for (let i = 0; i <= MAX_LOOKAHEAD_DAYS; i++) {
      const candidate = addDays(nextDate, i);
      if (endDate && candidate > endDate) return null;

      let matches = false;

      if (med.schedule_type === 'daily') {
        matches = candidate >= startDate;
      } else if (med.schedule_type === 'weekly_days' && med.weekly_days) {
        try {
          const daysList = typeof med.weekly_days === 'string' 
            ? JSON.parse(med.weekly_days) 
            : med.weekly_days;
          const dayAbbr = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'][candidate.getDay()];
          matches = Array.isArray(daysList) && daysList.includes(dayAbbr);
        } catch (e) {
          matches = false;
        }
      } else if (med.schedule_type === 'every_x_days' && med.interval_days) {
        const diffMs = candidate.getTime() - startDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        matches = diffDays >= 0 && diffDays % med.interval_days === 0;
      }

      if (matches) {
        return candidate;
      }
    }

    return null;
  }, []);

  // Планирует одно уведомление за 10 минут до приёма.
  const scheduleSingleNotification = useCallback(async (
    med: Medication,
    timeStr: string,
    targetDate: Date
  ) => {
    const timeParts = parseTime(timeStr);
    if (!timeParts) return null;

    const [hour, minute] = timeParts;

    // ✅ Чистое время приёма (локальное)
    const intakeTime = new Date(targetDate);
    intakeTime.setHours(hour, minute, 0, 0); // 000 мс

    // ✅ Время уведомления (локальное)
    const notificationTime = new Date(intakeTime);
    notificationTime.setMinutes(minute - 10);

    const now = new Date();

    // ✅ Если приём уже прошёл — не планируем
    if (intakeTime < now) {
      return null;
    }

    try {
      // ✅ КЛЮЧЕВОЙ ФИКС: передаём UTC timestamp, а не локальную дату
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: `💊 ${med.name}`,
          body: `Через 10 минут нужно принять ${med.form?.trim() || 'лекарство'} в ${timeStr}`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          color: theme.colors.primary,
          data: {
            medicationId: med.id,
            scheduledTime: timeStr,
            date: format(targetDate, 'yyyy-MM-dd'),
          },
        },
        trigger: { 
          date: localDateToUtcTimestamp(notificationTime) // ✅ ВОТ ОНО!
        },
      });

      return {
        identifier,
        date: notificationTime.getTime(),
        content: {
          title: `💊 ${med.name}`,
          body: `Через 10 минут нужно принять ${med.form?.trim() || 'лекарство'} в ${timeStr}`,
          data: {
            medicationId: med.id,
            scheduledTime: timeStr,
            date: format(targetDate, 'yyyy-MM-dd'),
          },
          sound: true,
          color: theme.colors.primary,
        },
        trigger: { date: notificationTime },
        medicationName: med.name,
      };

    } catch (error: any) {
      console.error(`❌ Ошибка уведомления для ${med.name} (${timeStr})`, error.message);
      return null;
    }
  }, [parseTime, theme.colors.primary]);

  // Перепланирует все уведомления на основе текущего списка лекарств
  const scheduleAllMedNotifications = useCallback(async () => {
    setLoading(true);
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      const meds = await getMedications();
      const allScheduled: ScheduledNotification[] = [];

      for (const med of meds) {
        const times = Array.isArray(med.times_list)
          ? med.times_list
          : typeof med.times_list === 'string'
          ? JSON.parse(med.times_list)
          : ['09:00'];

        for (const time of times) {
          let dayOffset = 0;
          while (dayOffset < MAX_LOOKAHEAD_DAYS) {
            const candidateDate = getNextScheduledDate(med, addDays(new Date(), dayOffset));
            if (!candidateDate) break;

            const notification = await scheduleSingleNotification(med, time, candidateDate);
            if (notification) {
              allScheduled.push(notification);
              if (med.schedule_type === 'daily') break; // достаточно одного
            }
            dayOffset++;
          }
        }
      }

      setScheduled(allScheduled);
      setSnackbarMessage(`✅ Запланировано ${allScheduled.length} уведомлений`);
      setSnackbarType('success');
      setSnackbarVisible(true);
    } catch (error: any) {
      const msg = error.message || 'Не удалось запланировать уведомления';
      console.error('💥 Ошибка планирования:', msg);
      setSnackbarMessage(msg);
      setSnackbarType('error');
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
    }
  }, [getMedications, getNextScheduledDate, scheduleSingleNotification]);

  // Инициализация: загрузка существующих уведомлений + анимация
  useEffect(() => {
    const init = async () => {
      try {
        const existing = await Notifications.getAllScheduledNotificationsAsync();
        // Преобразуем в наш тип ScheduledNotification
        const mapped = existing.map(n => ({
          identifier: n.identifier,
          date: typeof n.trigger === 'object' && 'date' in n.trigger
            ? (n.trigger.date instanceof Date ? n.trigger.date.getTime() : n.trigger.date)
            : Date.now(),
          content: n.content,
          trigger: n.trigger,
          medicationName: n.content.data?.medicationName || n.content.title?.replace('💊 ', '') || '',
        }));
        setScheduled(mapped);

        // Плавное появление интерфейса
        Animated.parallel([
          Animated.timing(opacityAnim, { 
            toValue: 1, 
            duration: 300, 
            useNativeDriver: true 
          }),
          Animated.timing(listOpacity, { 
            toValue: 1, 
            duration: 400, 
            delay: 100, 
            useNativeDriver: true 
          }),
        ]).start();
      } catch (e) {
        console.warn('Не удалось загрузить уведомления:', e);
      }
    };

    init();

    // Слушатель — уведомление получено в фоне
    const sub1 = Notifications.addNotificationReceivedListener(notification => {
      setSnackbarMessage(`🔔 ${notification.request.content.title}`);
      setSnackbarType('success');
      setSnackbarVisible(true);
    });

    // Слушатель — пользователь открыл уведомление
    const sub2 = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('✅ Уведомление открыто:', response);
      // Здесь можно добавить навигацию к деталям препарата
    });

    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, [opacityAnim, listOpacity]);

  // Очистка всех уведомлений с подтверждением
  const cancelAllNotifications = async () => {
    Alert.alert(
      'Очистить уведомления?',
      'Все запланированные уведомления будут удалены',
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

  // Безопасное отображение первых 6 символов токена (никаких .substring(undefined))
  const getPushTokenPreview = () => {
    if (typeof expoPushToken !== 'string') return '—';
    return expoPushToken.length > 6 ? `${expoPushToken.slice(0, 6)}...` : expoPushToken;
  };

  return (
    <Screen style={{ flex: 1, backgroundColor: '#121212', paddingHorizontal: 16, paddingTop: 20 }}>
      <Animated.View style={{ opacity: opacityAnim, flex: 1 }}>
        {/* Заголовок с эмодзи */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingHorizontal: 4 }}>
          <View style={{
            width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255, 75, 128, 0.15)',
            justifyContent: 'center', alignItems: 'center', marginRight: 12
          }}>
            <Text style={{ fontSize: 20, color: '#FF4B80' }}>🔔</Text>
          </View>
          <View>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', lineHeight: 30 }}>Уведомления</Text>
            <Text style={{ color: '#888', fontSize: 14, marginTop: 4 }}>
              Напоминания о приёме в <Text style={{ fontWeight: '600' }}>MAI Tablets</Text>
            </Text>
          </View>
        </View>

        {/* Кнопки */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 28 }}>
          <Button
            mode="contained"
            onPress={scheduleAllMedNotifications}
            loading={loading}
            disabled={loading}
            style={{ flex: 1, borderRadius: 14, backgroundColor: '#4A3AFF' }}
            contentStyle={{ paddingVertical: 8 }}
            labelStyle={{ fontWeight: '600', color: '#fff' }}
          >
            {loading ? 'Планируем...' : '🔁 Обновить'}
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

        {/* Статистика и push-статус */}
        <View style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', borderRadius: 16, padding: 16, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: '#888', fontSize: 14 }}>Запланировано</Text>
            <Text style={{ 
              color: scheduled.length > 0 ? '#63B3ED' : '#888', 
              fontSize: 18, 
              fontWeight: '600' 
            }}>
              {scheduled.length}
            </Text>
          </View>

          {/* Push-статус: 3 состояния */}
          {typeof expoPushToken === 'string' ? (
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              marginTop: 12, 
              backgroundColor: 'rgba(99, 179, 237, 0.1)', 
              padding: 12, 
              borderRadius: 12 
            }}>
              <View style={{ 
                width: 24, 
                height: 24, 
                borderRadius: 12, 
                backgroundColor: 'rgba(99, 179, 237, 0.2)', 
                justifyContent: 'center', 
                alignItems: 'center', 
                marginRight: 8 
              }}>
                <Text style={{ color: '#63B3ED', fontSize: 12 }}>📱</Text>
              </View>
              <Text style={{ color: '#63B3ED', fontSize: 13, flex: 1 }}>
                Push включён: {getPushTokenPreview()}
              </Text>
            </View>
          ) : expoPushToken === null ? (
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              marginTop: 12, 
              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
              padding: 12, 
              borderRadius: 12 
            }}>
              <View style={{ 
                width: 24, 
                height: 24, 
                borderRadius: 12, 
                backgroundColor: 'rgba(239, 68, 68, 0.2)', 
                justifyContent: 'center', 
                alignItems: 'center', 
                marginRight: 8 
              }}>
                <Text style={{ color: '#EF4444', fontSize: 12 }}>⚠️</Text>
              </View>
              <Text style={{ color: '#EF4444', fontSize: 13, flex: 1 }}>
                Push отключён или не поддерживается
              </Text>
            </View>
          ) : (
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              marginTop: 12, 
              backgroundColor: 'rgba(148, 163, 184, 0.1)', 
              padding: 12, 
              borderRadius: 12 
            }}>
              <View style={{ 
                width: 24, 
                height: 24, 
                borderRadius: 12, 
                backgroundColor: 'rgba(148, 163, 184, 0.2)', 
                justifyContent: 'center', 
                alignItems: 'center', 
                marginRight: 8 
              }}>
                <Text style={{ color: '#94A3B8', fontSize: 12 }}>⏳</Text>
              </View>
              <Text style={{ color: '#94A3B8', fontSize: 13, flex: 1 }}>
                Проверка push-статуса...
              </Text>
            </View>
          )}
        </View>

        {/* Список уведомлений */}
        <Animated.View style={{ opacity: listOpacity }}>
          {scheduled.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40, marginTop: 20 }}>
              <View style={{ 
                width: 60, 
                height: 60, 
                borderRadius: 30, 
                backgroundColor: 'rgba(99, 179, 237, 0.1)', 
                justifyContent: 'center', 
                alignItems: 'center', 
                marginBottom: 16 
              }}>
                <Text style={{ fontSize: 28, color: '#63B3ED' }}>🔔</Text>
              </View>
              <Text style={{ color: '#888', fontSize: 16, textAlign: 'center', maxWidth: 280 }}>
                Нет запланированных уведомлений
              </Text>
              <Text style={{ color: '#555', fontSize: 14, textAlign: 'center', marginTop: 8, maxWidth: 280 }}>
                Нажмите «Обновить», чтобы <Text style={{ fontWeight: '600' }}>MAI Tablets</Text> создал напоминания из вашего расписания
              </Text>
            </View>
          ) : (
            <ScrollView 
              style={{ flex: 1 }} 
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
              {scheduled.map((n) => {
                // Формат даты: "21 ноя 08:50"
                const dateValue = 
                  typeof n.trigger.date === 'number' 
                    ? new Date(n.trigger.date) 
                    : n.trigger.date;
                const datePart = format(dateValue, 'dd MMM HH:mm', { locale: ru });

                return (
                  <Animated.View
                    key={n.identifier}
                    style={{
                      opacity: listOpacity,
                      transform: [{
                        translateY: listOpacity.interpolate({ 
                          inputRange: [0, 1], 
                          outputRange: [10, 0] 
                        }),
                      }],
                      marginBottom: 12,
                    }}
                  >
                    <List.Item
                      title={n.content.title || 'Без названия'}
                      description={n.content.body || '—'}
                      left={() => (
                        <View style={{ 
                          width: 44, 
                          height: 44, 
                          borderRadius: 22, 
                          backgroundColor: 'rgba(255, 75, 128, 0.15)', 
                          justifyContent: 'center', 
                          alignItems: 'center', 
                          marginRight: 12 
                        }}>
                          <Text style={{ fontSize: 18, color: '#FF4B80' }}>⏰</Text>
                        </View>
                      )}
                      right={() => (
                        <View style={{ alignItems: 'flex-end', justifyContent: 'center', width: 80 }}>
                          <Text style={{ 
                            color: '#888', 
                            fontSize: 12, 
                            textAlign: 'right'
                          }}>
                            {datePart}
                          </Text>
                        </View>
                      )}
                      style={{ 
                        backgroundColor: '#1E1E1E', 
                        borderRadius: 12, 
                        paddingHorizontal: 12,
                        borderLeftWidth: 3,
                        borderLeftColor: '#63B3ED'
                      }}
                      titleStyle={{ color: '#fff', fontWeight: '600', fontSize: 15 }}
                      descriptionStyle={{ color: '#aaa', fontSize: 13, lineHeight: 18 }}
                    />
                  </Animated.View>
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
          elevation: 4,
        }}
      >
        <Text style={{ 
          color: snackbarType === 'success' ? '#6EE7B7' : '#FCA5A5', 
          fontWeight: '500',
          fontSize: 14
        }}>
          {snackbarMessage}
        </Text>
      </Snackbar>
    </Screen>
  );
}