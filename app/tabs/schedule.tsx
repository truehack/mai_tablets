// app/(tabs)/schedule.tsx

import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { 
  View, 
  FlatList, 
  TouchableOpacity, 
  Alert, 
  Animated, 
  LayoutAnimation, 
  UIManager,
  Dimensions,
  Platform
} from 'react-native';
import { Text, Card, FAB, Icon, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/screen';
import { useDatabase, Medication, IntakeHistory } from '@/hooks/use-database';
import apiClient from '@/services/api';

// Включаем LayoutAnimation для Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ✅ Вспомогательная функция: понедельник текущей недели (локальное время, 00:00:00.000)
const getMondayOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay(); // 0 = ВС, 1 = ПН, ..., 6 = СБ
  const diff = day === 0 ? -6 : 1 - day; // ВС → -6, ПН → 0, ВТ → -1, ..., СБ → -5
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export default function Schedule() {
  const router = useRouter();
  const { getMedications, getIntakeHistory } = useDatabase();
  const theme = useTheme();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [intakeHistory, setIntakeHistory] = useState<IntakeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    return getMondayOfWeek(new Date());
  });
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [isMedFriendMode, setIsMedFriendMode] = useState(false);

  // Анимации
  const itemsOpacity = useRef(new Animated.Value(0)).current;
  const modeIndicatorOpacity = useRef(new Animated.Value(0)).current;
  const fabScale = useRef(new Animated.Value(1)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  const days = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
  const todayDate = new Date();

  // ✅ Инициализация: выбираем "сегодня" как выбранный день
  useEffect(() => {
    const dayIndex = todayDate.getDay(); // 0=ВС, 1=ПН, ..., 6=СБ
    const dayAbbr = days[(dayIndex + 6) % 7]; // 0→6 ("ВС"), 1→0 ("ПН"), ..., 6→5 ("СБ")
    setSelectedDay(dayAbbr);
  }, []);

  // === Загрузка данных ===
  const loadMeds = useCallback(async () => {
    setLoading(true);
    try {
      if (isMedFriendMode) {
        const response = await apiClient.postWithAuth('/medicines/get_medications_for_current_friend', {});
        const meds = response.map((med: any) => ({
          id: med.id,
          server_id: med.id,
          name: med.name,
          form: med.form,
          instructions: med.instructions,
          start_date: med.start_date,
          end_date: med.end_date,
          schedule_type: med.schedule_type,
          weekly_days: med.week_days ? JSON.stringify(med.week_days) : null,
          interval_days: med.interval_days,
          times_list: med.times_per_day ? JSON.stringify(med.times_per_day) : '["09:00"]',
          synced: true,
        }));
        setMedications(meds);
      } else {
        const meds = await getMedications();
        setMedications(meds);
      }
    } catch (e) {
      console.error('Ошибка загрузки медикаментов:', e);
      Alert.alert('Ошибка', 'Не удалось загрузить лекарства');
    } finally {
      setLoading(false);
      Animated.timing(itemsOpacity, { 
        toValue: 1, 
        duration: 400, 
        delay: 100, 
        useNativeDriver: true 
      }).start();
    }
  }, [getMedications, isMedFriendMode]);

  const loadHistory = useCallback(async () => {
    try {
      if (isMedFriendMode) {
        const response = await apiClient.postWithAuth('/intake/get_intakes_for_current_friend', {});
        const history = response.map((item: any) => ({
          id: item.id,
          medication_id: item.medication_id,
          planned_time: item.scheduled_time.split('T')[1]?.slice(0, 5) || '09:00',
          datetime: item.taken_time,
          taken: item.status === 'taken',
          skipped: item.status === 'skipped',
          notes: item.notes,
          synced: true,
        }));
        setIntakeHistory(history);
      } else {
        const history = await getIntakeHistory();
        setIntakeHistory(history);
      }
    } catch (e) {
      console.error('Ошибка загрузки истории приёма:', e);
    }
  }, [getIntakeHistory, isMedFriendMode]);

  useFocusEffect(
    useCallback(() => {
      loadMeds();
      loadHistory();
      Animated.timing(headerOpacity, { 
        toValue: 1, 
        duration: 300, 
        useNativeDriver: true 
      }).start();
    }, [loadMeds, loadHistory])
  );

  // Проверка режима при фокусе
  useFocusEffect(
    useCallback(() => {
      const checkMode = async () => {
        try {
          const response = await apiClient.postWithAuth('/friends/get-patient', {});
          const newMode = !!response.uuid;
          if (newMode !== isMedFriendMode) {
            Animated.timing(modeIndicatorOpacity, {
              toValue: newMode ? 1 : 0,
              duration: 300,
              useNativeDriver: true,
            }).start();
          }
          setIsMedFriendMode(newMode);
        } catch {
          setIsMedFriendMode(false);
          Animated.timing(modeIndicatorOpacity, { 
            toValue: 0, 
            duration: 300, 
            useNativeDriver: true 
          }).start();
        }
      };
      checkMode();
    }, [isMedFriendMode])
  );

  // 🔴🟠✅ Основная логика статусов (сохранена и уточнена)
  const getIntakeStatusWithTime = (medicationId: number, date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayIntakes = intakeHistory.filter(
      intake =>
        intake.medication_id === medicationId &&
        intake.datetime.startsWith(dateStr)
    );

    // 🔴 Не принято (нет записи)
    if (dayIntakes.length === 0) {
      return { status: 'pending', time: null, color: '#FF3B30' };
    }

    const latestIntake = dayIntakes.reduce((a, b) => 
      new Date(a.datetime) > new Date(b.datetime) ? a : b
    );

    const time = new Date(latestIntake.datetime).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    // ✅ Принято
    if (latestIntake.taken) {
      return { status: 'taken', time, color: '#34C759' };
    }

    // 🟠 Пропущено
    if (latestIntake.skipped) {
      return { status: 'skipped', time, color: '#FF9500' };
    }

    // 🔴 Не принято (есть запись, но не marked)
    return { status: 'pending', time, color: '#FF3B30' };
  };

  const getDateForDay = (dayIndex: number) => {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + dayIndex);
    return date;
  };

  const getDayStatus = (dayIndex: number) => {
    const date = getDateForDay(dayIndex);
    const dateStr = date.toISOString().split('T')[0];
    const dayIntakes = intakeHistory.filter(intake => intake.datetime.startsWith(dateStr));

    if (dayIntakes.length === 0) return 'empty';

    const taken = dayIntakes.some(i => i.taken);
    const skipped = dayIntakes.some(i => i.skipped);
    const pending = dayIntakes.some(i => !i.taken && !i.skipped);

    if (taken && skipped) return 'mixed';
    if (taken) return 'taken';
    if (skipped) return 'skipped';
    if (pending) return 'pending';
    return 'unknown';
  };

  // ✅ Сохранена оригинальная логика isMedForSelectedDay (с проверкой start_date/end_date + all schedule types)
  const isMedForSelectedDay = (med: Medication, day: string) => {
    if (!med.start_date) return false;
    const start = new Date(med.start_date);
    if (isNaN(start.getTime())) return false;

    // ✅ Проверяем, что выбранный день >= даты начала (включительно)
    const selectedDate = getDateForDay(days.indexOf(day)); // день, на который ты смотришь
    const startDay = start.toISOString().split('T')[0];
    const selectedDayStr = selectedDate.toISOString().split('T')[0];

    if (selectedDayStr < startDay) return false;

    // ✅ Проверяем, что дата окончания не раньше, чем выбранный день (включительно)
    if (med.end_date) {
      const end = new Date(med.end_date); // строка в формате YYYY-MM-DD
      const endDay = end.toISOString().split('T')[0];

      // Если выбранный день > даты окончания — не показываем
      if (selectedDayStr > endDay) return false;
    }

    if (med.schedule_type === 'daily') {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const startStr = start.toISOString().split('T')[0];
      return startStr <= todayStr;
    }

    if (med.schedule_type === 'weekly_days' && med.weekly_days) {
      try {
        const daysList = typeof med.weekly_days === 'string' ? JSON.parse(med.weekly_days) : med.weekly_days;
        if (Array.isArray(daysList)) {
          return daysList.includes(day);
        }
      } catch {
        return false;
      }
    }

    if (med.schedule_type === 'every_x_days' && med.start_date && med.interval_days) {
      const targetDate = getDateForDay(days.indexOf(day));
      const diffMs = targetDate.getTime() - start.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return false;
      return diffDays % med.interval_days === 0;
    }

    return false;
  };

  const filteredMeds = useMemo(() => {
    return medications.filter(m => isMedForSelectedDay(m, selectedDay));
  }, [medications, selectedDay]);

  // Ограничение навигации (±8 недель)
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - 56);
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 56);
  const canGoBack = currentWeekStart > minDate;
  const canGoForward = currentWeekStart < maxDate;

  const goToPreviousWeek = () => {
    if (canGoBack) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const newDate = getMondayOfWeek(new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000));
      setCurrentWeekStart(newDate);
      const todayIndex = todayDate.getDay();
      const today = days[(todayIndex + 6) % 7];
      setSelectedDay(today);
    }
  };

  const goToNextWeek = () => {
    if (canGoForward) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const newDate = getMondayOfWeek(new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000));
      setCurrentWeekStart(newDate);
      const todayIndex = todayDate.getDay();
      const today = days[(todayIndex + 6) % 7];
      setSelectedDay(today);
    }
  };

  const goToToday = () => {
    if (!isMedFriendMode) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const realToday = new Date();
      const newWeekStart = getMondayOfWeek(realToday);
      setCurrentWeekStart(newWeekStart);
      
      const dayIndex = realToday.getDay();
      const dayAbbr = days[(dayIndex + 6) % 7];
      setSelectedDay(dayAbbr);
    }
  };

  const canModify = !isMedFriendMode;

  useEffect(() => {
    Animated.timing(fabScale, { 
      toValue: canModify ? 1 : 0, 
      duration: 300, 
      useNativeDriver: true 
    }).start();
  }, [canModify]);

  // === Анимированная карточка лекарства ===
  const AnimatedMedicationCard = ({ item, index }: { item: Medication; index: number }) => {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.spring(scaleAnim, { 
          toValue: 1, 
          friction: 6, 
          tension: 100, 
          delay: index * 50, 
          useNativeDriver: true 
        }),
        Animated.timing(opacityAnim, { 
          toValue: 1, 
          duration: 300, 
          delay: index * 50, 
          useNativeDriver: true 
        }),
      ]).start();
    }, [index]);

    const selectedDate = getDateForDay(days.indexOf(selectedDay));
    const { status, time, color } = getIntakeStatusWithTime(item.id, selectedDate);
    
    const times = Array.isArray(item.times_list)
      ? item.times_list.join(', ')
      : typeof item.times_list === 'string'
      ? item.times_list.replace(/[\[\]"]/g, '')
      : '—';
    
    const icon = item.form === 'tablet' ? '💊' : item.form === 'drop' ? '💧' : item.form === 'spray' ? '🧴' : '❓';

    const statusLabels = {
      taken: 'Принято',
      skipped: 'Пропущено',
      pending: 'Не отмечено',
    };

    return (
      <Animated.View
        style={{
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
          marginBottom: 16,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            if (canModify) {
              LayoutAnimation.configureNext({
                duration: 150,
                create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
                update: { type: LayoutAnimation.Types.easeInEaseOut },
              });
              router.push(
                `/modals/take-medication-modal?medicationId=${item.id}&plannedTime=${encodeURIComponent(times)}`
              );
            } else {
              Alert.alert(item.name, `Форма: ${item.form}\nИнструкция: ${item.instructions || '—'}`);
            }
          }}
          disabled={!canModify}
          activeOpacity={canModify ? 0.85 : 1}
        >
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ color: '#aaa', fontSize: 14, fontWeight: '600', marginRight: 6 }}>
                {times}
              </Text>
              
              {status === 'taken' && <Icon source="check-circle" size={16} color={color} />}
              {status === 'skipped' && <Icon source="close-circle" size={16} color={color} />}
              {status === 'pending' && <Icon source="clock-alert-outline" size={16} color={color} />}
              
              <Text style={{ color: color, fontSize: 14, fontWeight: '500', marginLeft: 4 }}>
                {statusLabels[status]}
                {time && ` в ${time}`}
              </Text>
            </View>

            <Card
              mode="contained"
              style={{ 
                backgroundColor: '#1E1E1E',
                borderRadius: 14,
                paddingVertical: 12,
                paddingHorizontal: 16,
                opacity: canModify ? 1 : 0.75,
                transform: [{ scale: canModify ? 1 : 0.98 }],
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.15,
                shadowRadius: 6,
                elevation: 3,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: '#2C2C2C',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 14,
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 2 }}>
                    {item.name}
                  </Text>
                  <Text style={{ color: '#ccc', fontSize: 13 }}>
                    {item.instructions ? `${item.instructions} · ` : ''}{item.form || '—'}
                  </Text>
                </View>
                {isMedFriendMode && (
                  <View style={{ marginLeft: 8 }}>
                    <Icon source="account-heart" size={20} color="#4FC3F7" />
                  </View>
                )}
              </View>
            </Card>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // === Ячейка дня в календаре ===
  const DayCell = ({ day, index }: { day: string; index: number }) => {
    const date = getDateForDay(index);
    const dayNum = date.getDate();
    const month = date.getMonth() + 1;
    const isSelected = selectedDay === day;
    const isToday = date.toDateString() === todayDate.toDateString();
    
    const dayStatus = getDayStatus(index);

    // Цвета статусов дня (для фона ячейки)
    const statusColors = {
      taken: '#10B981',   // success (зелёный)
      skipped: '#EF4444', // error (красный) — день с пропусками
      mixed: '#F59E0B',   // warning (оранжевый)
      pending: '#EF4444', // не принято → красный (согласовано с карточками)
      empty: '#374151',
    };

    const cellColor = isToday 
      ? '#4A3AFF' 
      : isSelected 
        ? '#2D2D2D' 
        : statusColors[dayStatus as keyof typeof statusColors] || '#374151';

    const textColor = isToday 
      ? 'white' 
      : isSelected 
        ? '#4A3AFF' 
        : '#E5E7EB';

    const statusIcon = dayStatus === 'taken' ? '✓' 
      : dayStatus === 'skipped' ? '✗' 
      : dayStatus === 'mixed' ? '±' 
      : '';

    return (
      <TouchableOpacity 
        onPress={() => {
          if (!isMedFriendMode) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setSelectedDay(day);
          }
        }}
        disabled={isMedFriendMode}
        activeOpacity={isMedFriendMode ? 1 : 0.9}
        style={{ alignItems: 'center' }}
      >
        <View
          style={{
            width: (SCREEN_WIDTH - 64) / 7,
            height: 72,
            backgroundColor: cellColor,
            borderRadius: 14,
            justifyContent: 'space-between',
            paddingVertical: 8,
            paddingHorizontal: 2,
            shadowColor: isToday ? '#4A3AFF' : 'transparent',
            shadowOffset: { width: 0, height: isToday ? 4 : 0 },
            shadowOpacity: isToday ? 0.4 : 0,
            shadowRadius: isToday ? 8 : 0,
            elevation: isToday ? 4 : 0,
          }}
        >
          <Text style={{ 
            color: textColor, 
            fontSize: 11, 
            fontWeight: '600',
            textAlign: 'center',
            opacity: 0.8,
          }}>
            {day}
          </Text>
          
          <View style={{ alignItems: 'center' }}>
            <Text style={{ 
              color: textColor, 
              fontSize: 16, 
              fontWeight: isToday ? '800' : '600',
            }}>
              {dayNum}
            </Text>
            {month !== (todayDate.getMonth() + 1) && (
              <Text style={{ 
                color: textColor, 
                fontSize: 8, 
                fontWeight: '500',
                opacity: 0.7,
                marginTop: -2,
              }}>
                /{month}
              </Text>
            )}
          </View>

          {statusIcon && !isToday && (
            <View style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: statusColors[dayStatus as keyof typeof statusColors],
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{
                color: 'white',
                fontSize: 8,
                fontWeight: '700',
                lineHeight: 12,
              }}>
                {statusIcon}
              </Text>
            </View>
          )}

          {isToday && (
            <View style={{
              position: 'absolute',
              bottom: 4,
              left: 4,
              right: 4,
              height: 3,
              borderRadius: 1.5,
              backgroundColor: 'white',
              opacity: 0.8,
            }} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Screen style={{ flex: 1, backgroundColor: '#121212', paddingHorizontal: 16, paddingTop: 16 }}>
      {/* Индикатор режима мед-друга */}
      <Animated.View
        style={{
          opacity: modeIndicatorOpacity,
          transform: [{
            translateY: modeIndicatorOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: [-20, 0],
            }),
          }],
        }}
      >
        {isMedFriendMode && (
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            backgroundColor: '#0F2A45', 
            padding: 14,
            borderRadius: 16, 
            marginBottom: 20,
            borderWidth: 1,
            borderColor: 'rgba(79, 195, 247, 0.3)',
          }}>
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(79, 195, 247, 0.15)',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 10,
            }}>
              <Icon source="account-heart" size={20} color="#4FC3F7" />
            </View>
            <View>
              <Text style={{ 
                color: '#E3F2FD', 
                fontSize: 15, 
                fontWeight: '700',
              }}>
                👨‍⚕️ Режим мед-друга
              </Text>
              <Text style={{ 
                color: '#90CAF9', 
                fontSize: 13, 
                marginTop: 2,
              }}>
                Только просмотр. Данные пациента — под его контролем. 🧠
              </Text>
            </View>
          </View>
        )}
      </Animated.View>

      {/* Улучшенный календарь */}
      <Animated.View style={{ opacity: headerOpacity }}>
        <View style={{ 
          backgroundColor: '#1E1E1E', 
          borderRadius: 20, 
          padding: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 4,
          marginBottom: 24,
        }}>
          {/* Заголовок недели и кнопка "Сегодня" */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity 
                onPress={goToPreviousWeek} 
                disabled={!canGoBack}
                activeOpacity={0.7}
                style={{ marginRight: 8 }}
              >
                <Animated.View style={{ 
                  opacity: canGoBack ? 1 : 0.4,
                  transform: [{ scale: canGoBack ? 1 : 0.85 }],
                }}>
                  <Icon source="chevron-left" size={24} color="#4A3AFF" />
                </Animated.View>
              </TouchableOpacity>

              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 16, 
                fontWeight: '700',
                paddingHorizontal: 4,
              }}>
                {currentWeekStart.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' })} –{' '}
                {new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' })}
              </Text>

              <TouchableOpacity 
                onPress={goToNextWeek} 
                disabled={!canGoForward}
                activeOpacity={0.7}
                style={{ marginLeft: 8 }}
              >
                <Animated.View style={{ 
                  opacity: canGoForward ? 1 : 0.4,
                  transform: [{ scale: canGoForward ? 1 : 0.85 }],
                }}>
                  <Icon source="chevron-right" size={24} color="#4A3AFF" />
                </Animated.View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={goToToday}
              disabled={isMedFriendMode}
              activeOpacity={isMedFriendMode ? 1 : 0.85}
              style={{
                backgroundColor: isMedFriendMode ? '#2C2C2C' : '#4A3AFF',
                paddingHorizontal: 18,
                paddingVertical: 8,
                borderRadius: 14,
                flexDirection: 'row',
                alignItems: 'center',
                opacity: isMedFriendMode ? 0.6 : 1,
              }}
            >
              <Icon source="home" size={16} color="white" />
              <Text style={{ 
                color: 'white', 
                fontWeight: '600', 
                fontSize: 14, 
                marginLeft: 4,
              }}>
                Сегодня
              </Text>
            </TouchableOpacity>
          </View>

          {/* Сетка дней */}
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            marginBottom: 8 
          }}>
            {days.map((day, idx) => (
              <DayCell key={day} day={day} index={idx} />
            ))}
          </View>

          {/* Подпись к иконкам статусов */}
          {!isMedFriendMode && (
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'center', 
              marginTop: 12,
              flexWrap: 'wrap',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
                <View style={{ 
                  width: 10, 
                  height: 10, 
                  borderRadius: 5, 
                  backgroundColor: '#34C759', 
                  marginRight: 4 
                }} />
                <Text style={{ fontSize: 11, color: '#9CA3AF' }}>принято</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
                <View style={{ 
                  width: 10, 
                  height: 10, 
                  borderRadius: 5, 
                  backgroundColor: '#FF9500', 
                  marginRight: 4 
                }} />
                <Text style={{ fontSize: 11, color: '#9CA3AF' }}>пропущено</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ 
                  width: 10, 
                  height: 10, 
                  borderRadius: 5, 
                  backgroundColor: '#FF3B30', 
                  marginRight: 4 
                }} />
                <Text style={{ fontSize: 11, color: '#9CA3AF' }}>не отмечено</Text>
              </View>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Список лекарств */}
      <Animated.View style={{ opacity: itemsOpacity, flex: 1 }}>
        <FlatList<Medication>
          data={filteredMeds}
          extraData={[selectedDay, isMedFriendMode]}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => <AnimatedMedicationCard item={item} index={index} />}
          ListEmptyComponent={
            <Animated.View style={{ opacity: itemsOpacity, flex: 1, justifyContent: 'center' }}>
              {loading ? (
                <View style={{ marginTop: 40, alignItems: 'center' }}>
                  {[...Array(3)].map((_, i) => (
                    <View 
                      key={i}
                      style={{
                        height: 84,
                        backgroundColor: '#1E1E1E',
                        borderRadius: 14,
                        marginBottom: 18,
                        width: '100%',
                        opacity: 0.25,
                      }}
                    />
                  ))}
                </View>
              ) : (
                <Text style={{ 
                  color: '#999', 
                  textAlign: 'center', 
                  marginTop: 40,
                  fontSize: 16,
                  fontWeight: '500',
                  lineHeight: 24,
                }}>
                  {isMedFriendMode 
                    ? `У пациента нет препаратов на ${selectedDay}.\nДанные обновляются в режиме реального времени.` 
                    : `Нет препаратов на ${selectedDay}.\nДобавьте лекарство — и MAI Tablets будет напоминать точно в срок. 💊`}
                </Text>
              )}
            </Animated.View>
          }
          contentContainerStyle={{ paddingBottom: 90 }}
          showsVerticalScrollIndicator={false}
        />
      </Animated.View>

      {/* FAB */}
      <Animated.View
        style={{
          position: 'absolute',
          right: 16,
          bottom: 16,
          transform: [{ scale: fabScale }],
          opacity: fabScale.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
        }}
      >
        {canModify && (
          <TouchableOpacity
            onPress={() => {
              LayoutAnimation.configureNext({
                duration: 150,
                create: { 
                  type: LayoutAnimation.Types.spring, 
                  property: LayoutAnimation.Properties.scaleXY, 
                  springDamping: 0.7 
                },
              });
              router.push('/modals/add');
            }}
            activeOpacity={0.85}
          >
            <FAB
              icon="plus"
              style={{ 
                backgroundColor: '#4A3AFF',
                width: 60,
                height: 60,
                borderRadius: 30,
                shadowColor: '#4A3AFF',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 10,
                elevation: 6,
              }}
            />
          </TouchableOpacity>
        )}
      </Animated.View>
    </Screen>
  );
}