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
  Platform,
  Pressable,
} from 'react-native';
import { Text, Card, FAB, Icon, useTheme, Surface } from 'react-native-paper';
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

// ─── УТИЛИТЫ ────────────────────────────────────────────────────────────────

/**
 * Возвращает понедельник текущей недели (локальное время, 00:00:00.000)
 */
const getMondayOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay(); // 0 = ВС, 1 = ПН, ..., 6 = СБ
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Форматирует дату как 'YYYY-MM-DD' в локальном часовом поясе
 */
const toLocalDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Дни недели: индекс → аббревиатура
 */
const DAY_ABBRS = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'] as const;
type DayAbbr = typeof DAY_ABBRS[number];

/**
 * Получает аббревиатуру дня по дате (локально)
 */
const getDayAbbrFromDate = (d: Date): DayAbbr => {
  return DAY_ABBRS[d.getDay()];
};

/**
 * Индекс дня по аббревиатуре
 */
const getDayIndexFromAbbr = (abbr: string): number => {
  const index = DAY_ABBRS.indexOf(abbr as DayAbbr);
  return index === -1 ? 0 : index;
};

/**
 * Нормализует times_list в массив строк
 */
const normalizeTimesList = (input: unknown): string[] => {
  if (Array.isArray(input)) return input.map(t => String(t));
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed.map(t => String(t));
    } catch {}
    // Если строка — попробуем разделить по запятым/пробелам
    return input.split(/[,;\s]+/).filter(Boolean);
  }
  return ['09:00'];
};

/**
 * Нормализует weekly_days в массив строк (ПН, ВТ и т.д.)
 */
const normalizeWeeklyDays = (input: unknown): string[] => {
  if (Array.isArray(input)) return input.map(d => String(d));
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed.map(d => String(d));
    } catch {}
    return input.split(/[,;\s]+/).filter(Boolean);
  }
  return [];
};

// ─── КОМПОНЕНТЫ ─────────────────────────────────────────────────────────────

interface DayCellProps {
  day: DayAbbr;
  index: number;
  isSelected: boolean;
  isToday: boolean;
  dayStatus: 'empty' | 'taken' | 'skipped' | 'mixed' | 'pending';
  onPress: () => void;
  disabled: boolean;
}

const DayCell: React.FC<DayCellProps> = React.memo(({ 
  day, 
  index, 
  isSelected, 
  isToday, 
  dayStatus, 
  onPress, 
  disabled 
}) => {
  const theme = useTheme();

  // Рассчитываем дату для этого дня
  const todayDate = useRef(new Date()).current;
  const currentWeekStart = useRef(getMondayOfWeek(todayDate)).current;
  const date = new Date(currentWeekStart);
  date.setDate(currentWeekStart.getDate() + index);
  
  const dayNum = date.getDate();
  const month = date.getMonth() + 1;
  const currentMonth = todayDate.getMonth() + 1;

  // Цвета статусов
  const statusColors = {
    taken: '#10B981',
    skipped: '#EF4444',
    mixed: '#F59E0B',
    pending: '#EF4444',
    empty: '#374151',
  };

  const cellColor = isToday
    ? 'transparent'
    : isSelected
      ? theme.colors.surface
      : statusColors[dayStatus];

  const textColor = isToday
    ? theme.colors.primary
    : isSelected
      ? theme.colors.primary
      : dayStatus === 'empty' ? '#9CA3AF' : 'white';

  const statusIcon = dayStatus === 'taken' ? '✓'
    : dayStatus === 'skipped' ? '✗'
    : dayStatus === 'mixed' ? '±'
    : '';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{ alignItems: 'center' }}
    >
      <View
        style={{
          width: (SCREEN_WIDTH - 64) / 7,
          height: 72,
          backgroundColor: cellColor,
          borderRadius: 18,
          justifyContent: 'space-between',
          paddingVertical: 8,
          paddingHorizontal: 2,
          borderWidth: isToday ? 2 : 0,
          borderColor: isToday ? theme.colors.primary : 'transparent',
        }}
      >
        {/* Аббревиатура дня */}
        <Text style={{ 
          color: textColor, 
          fontSize: 11, 
          fontWeight: '600',
          textAlign: 'center',
          opacity: 0.8,
        }}>
          {day}
        </Text>

        {/* Число и месяц */}
        <View style={{ alignItems: 'center' }}>
          <Text style={{ 
            color: textColor, 
            fontSize: 16, 
            fontWeight: isToday ? '800' : '600',
          }}>
            {dayNum}
          </Text>
          {month !== currentMonth && (
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

        {/* Статус-иконка */}
        {statusIcon && !isToday && (
          <View style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: statusColors[dayStatus],
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: statusColors[dayStatus],
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.3,
            shadowRadius: 2,
            elevation: 2,
          }}>
            <Text style={{
              color: 'white',
              fontSize: 9,
              fontWeight: '700',
              lineHeight: 12,
            }}>
              {statusIcon}
            </Text>
          </View>
        )}

        {/* Индикатор "сегодня" */}
        {isToday && (
          <View style={{
            position: 'absolute',
            bottom: 6,
            left: 6,
            right: 6,
            height: 2,
            borderRadius: 1,
            backgroundColor: theme.colors.primary,
            opacity: 0.9,
          }} />
        )}
      </View>
    </Pressable>
  );
});

interface MedicationCardProps {
  item: Medication;
  intakeStatus: { status: 'taken' | 'skipped' | 'pending'; time: string | null; color: string };
  canModify: boolean;
  onPress: () => void;
}

const MedicationCard: React.FC<MedicationCardProps> = React.memo(({ 
  item, 
  intakeStatus, 
  canModify, 
  onPress 
}) => {
  const theme = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (canModify) {
      Animated.spring(scaleAnim, {
        toValue: 0.97,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (canModify) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }).start();
    }
  };

  // Нормализуем времена
  const timesList = useMemo(() => normalizeTimesList(item.times_list), [item.times_list]);
  const times = timesList.join(', ') || '—';

  // Эмодзи по форме
  const icon = item.form === 'tablet' ? '💊' 
    : item.form === 'drop' ? '💧' 
    : item.form === 'spray' ? '🧴' 
    : item.form === 'injection' ? '💉' 
    : '💊';

  const statusLabels = {
    taken: 'Принято',
    skipped: 'Пропущено',
    pending: 'Не отмечено',
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!canModify}
      style={{ 
        marginBottom: 16,
        opacity: canModify ? 1 : 0.85,
      }}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {/* Строка статуса */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingHorizontal: 4 }}>
          <Text style={{ 
            color: theme.colors.outline, 
            fontSize: 13, 
            fontWeight: '500',
            flex: 1,
          }}>
            {times}
          </Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {intakeStatus.status === 'taken' && (
              <Icon source="check-circle" size={16} color={intakeStatus.color} />
            )}
            {intakeStatus.status === 'skipped' && (
              <Icon source="close-circle" size={16} color={intakeStatus.color} />
            )}
            {intakeStatus.status === 'pending' && (
              <Icon source="clock-outline" size={16} color={intakeStatus.color} />
            )}
            
            <Text style={{ 
              color: intakeStatus.color, 
              fontSize: 13, 
              fontWeight: '500', 
              marginLeft: 4,
            }}>
              {statusLabels[intakeStatus.status]}
              {intakeStatus.time && ` в ${intakeStatus.time}`}
            </Text>
          </View>
        </View>

        <Surface
          elevation={2}
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 20,
            overflow: 'hidden',
          }}
        >
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center',
            padding: 16,
            backgroundColor: canModify 
              ? 'rgba(255, 255, 255, 0.03)' 
              : 'rgba(100, 100, 100, 0.05)',
            borderLeftWidth: 4,
            borderLeftColor: intakeStatus.color,
          }}>
            {/* Иконка */}
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 16,
              }}
            >
              <Text style={{ fontSize: 24 }}>{icon}</Text>
            </View>

            {/* Контент */}
            <View style={{ flex: 1 }}>
              <Text 
                style={{ 
                  color: theme.colors.onSurface, 
                  fontSize: 16, 
                  fontWeight: '600',
                  marginBottom: 2,
                }}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text 
                style={{ 
                  color: theme.colors.outline, 
                  fontSize: 13,
                }}
                numberOfLines={2}
              >
                {item.instructions || item.form || '—'}
              </Text>
            </View>

            {/* Иконка MedFriend */}
            {!canModify && (
              <View style={{ 
                width: 32, 
                height: 32,
                borderRadius: 16,
                backgroundColor: 'rgba(79, 195, 247, 0.15)',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Icon source="account-heart" size={18} color="#4FC3F7" />
              </View>
            )}
          </View>
        </Surface>
      </Animated.View>
    </Pressable>
  );
});

// ─── ОСНОВНОЙ ЭКРАН ─────────────────────────────────────────────────────────

export default function Schedule() {
  const router = useRouter();
  const { getMedications, getIntakeHistory } = useDatabase();
  const theme = useTheme();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [intakeHistory, setIntakeHistory] = useState<IntakeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()));
  const [selectedDay, setSelectedDay] = useState<DayAbbr>('ПН');
  const [isMedFriendMode, setIsMedFriendMode] = useState(false);

  // Анимации
  const itemsOpacity = useRef(new Animated.Value(0)).current;
  const modeIndicatorOpacity = useRef(new Animated.Value(0)).current;
  const fabScale = useRef(new Animated.Value(1)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const currentWeekAnim = useRef(new Animated.Value(0)).current;

  const todayDate = new Date();
  const todayAbbr = getDayAbbrFromDate(todayDate);

  // Инициализация: выбираем "сегодня"
  useEffect(() => {
    setSelectedDay(todayAbbr);
  }, [todayAbbr]);

  // ─── ЗАГРУЗКА ДАННЫХ ─────────────────────────────────────────────────────

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
          weekly_days: normalizeWeeklyDays(med.week_days),
          interval_days: med.interval_days,
          times_list: normalizeTimesList(med.times_per_day),
          synced: true,
        }));
        setMedications(meds);
      } else {
        const meds = await getMedications();
        // Нормализуем локальные данные тоже
        setMedications(meds.map(med => ({
          ...med,
          weekly_days: normalizeWeeklyDays(med.weekly_days),
          times_list: normalizeTimesList(med.times_list),
        })));
      }
    } catch (e) {
      console.error('Ошибка загрузки медикаментов:', e);
      Alert.alert('Ошибка', 'Не удалось загрузить лекарства');
    } finally {
      setLoading(false);
      Animated.spring(itemsOpacity, { 
        toValue: 1, 
        friction: 6,
        tension: 100,
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
      Animated.spring(headerOpacity, { 
        toValue: 1, 
        friction: 5,
        tension: 80,
        useNativeDriver: true 
      }).start();
    }, [loadMeds, loadHistory])
  );

  // Проверка режима
  useFocusEffect(
    useCallback(() => {
      const checkMode = async () => {
        try {
          const response = await apiClient.postWithAuth('/friends/get-patient', {});
          const newMode = !!response.uuid;
          if (newMode !== isMedFriendMode) {
            Animated.spring(modeIndicatorOpacity, {
              toValue: newMode ? 1 : 0,
              friction: 5,
              tension: 80,
              useNativeDriver: true,
            }).start();
          }
          setIsMedFriendMode(newMode);
        } catch {
          setIsMedFriendMode(false);
          Animated.spring(modeIndicatorOpacity, { 
            toValue: 0, 
            friction: 5,
            tension: 80,
            useNativeDriver: true 
          }).start();
        }
      };
      checkMode();
    }, [isMedFriendMode])
  );

  // ─── ЛОГИКА СТАТУСОВ ──────────────────────────────────────────────────────

  const getIntakeStatusWithTime = (medicationId: number, date: Date) => {
    const dateStr = toLocalDateStr(date);
    const dayIntakes = intakeHistory.filter(
      intake =>
        intake.medication_id === medicationId &&
        intake.datetime.startsWith(dateStr)
    );

    if (dayIntakes.length === 0) {
      return { status: 'pending' as const, time: null, color: theme.colors.error };
    }

    const latestIntake = dayIntakes.reduce((a, b) => 
      new Date(a.datetime) > new Date(b.datetime) ? a : b
    );

    const time = new Date(latestIntake.datetime).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (latestIntake.taken) {
      return { status: 'taken' as const, time, color: theme.colors.success };
    }
    if (latestIntake.skipped) {
      return { status: 'skipped' as const, time, color: theme.colors.warning };
    }
    return { status: 'pending' as const, time, color: theme.colors.error };
  };

  const getDateForDay = (dayIndex: number) => {
    const date = new (Date as any)(currentWeekStart.getTime());
    date.setDate(currentWeekStart.getDate() + dayIndex);
    return date;
  };

  const getDayStatus = (dayIndex: number) => {
    const date = getDateForDay(dayIndex);
    const dateStr = toLocalDateStr(date);
    const dayIntakes = intakeHistory.filter(intake => 
      intake.datetime.startsWith(dateStr)
    );

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

  const isMedForSelectedDay = (med: Medication, day: DayAbbr) => {
    if (!med.start_date) return false;
    const start = new Date(med.start_date);
    if (isNaN(start.getTime())) return false;

    const selectedDate = getDateForDay(getDayIndexFromAbbr(day));
    const startDay = toLocalDateStr(start);
    const selectedDayStr = toLocalDateStr(selectedDate);

    if (selectedDayStr < startDay) return false;

    if (med.end_date) {
      const end = new Date(med.end_date);
      const endDay = toLocalDateStr(end);
      if (selectedDayStr > endDay) return false;
    }

    if (med.schedule_type === 'daily') {
      return true;
    }

    if (med.schedule_type === 'weekly_days' && med.weekly_days) {
      return (med.weekly_days as string[]).includes(day);
    }

    if (med.schedule_type === 'every_x_days' && med.start_date && med.interval_days) {
      const targetDate = getDateForDay(getDayIndexFromAbbr(day));
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

  // ─── НАВИГАЦИЯ ПО НЕДЕЛЯМ ─────────────────────────────────────────────────

  const minDate = new Date();
  minDate.setDate(minDate.getDate() - 56);
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 56);
  const canGoBack = currentWeekStart > minDate;
  const canGoForward = currentWeekStart < maxDate;

  const goToPreviousWeek = () => {
    if (canGoBack) {
      LayoutAnimation.configureNext({
        duration: 250,
        create: { type: 'linear', property: 'opacity' },
        update: { type: 'spring', springDamping: 0.7 },
      });
      const newDate = getMondayOfWeek(new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000));
      setCurrentWeekStart(newDate);
      setSelectedDay(todayAbbr);
      currentWeekAnim.setValue(-SCREEN_WIDTH * 0.05);
      Animated.spring(currentWeekAnim, {
        toValue: 0,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }).start();
    }
  };

  const goToNextWeek = () => {
    if (canGoForward) {
      LayoutAnimation.configureNext({
        duration: 250,
        create: { type: 'linear', property: 'opacity' },
        update: { type: 'spring', springDamping: 0.7 },
      });
      const newDate = getMondayOfWeek(new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000));
      setCurrentWeekStart(newDate);
      setSelectedDay(todayAbbr);
      currentWeekAnim.setValue(SCREEN_WIDTH * 0.05);
      Animated.spring(currentWeekAnim, {
        toValue: 0,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }).start();
    }
  };

  const goToToday = () => {
    if (!isMedFriendMode) {
      LayoutAnimation.configureNext({
        duration: 250,
        create: { type: 'linear', property: 'opacity' },
        update: { type: 'spring', springDamping: 0.7 },
      });
      const realToday = new Date();
      const newWeekStart = getMondayOfWeek(realToday);
      setCurrentWeekStart(newWeekStart);
      setSelectedDay(getDayAbbrFromDate(realToday));
    }
  };

  const canModify = !isMedFriendMode;

  useEffect(() => {
    Animated.spring(fabScale, { 
      toValue: canModify ? 1 : 0, 
      friction: 5,
      tension: 80,
      useNativeDriver: true 
    }).start();
  }, [canModify]);

  // ─── РЕНДЕР ───────────────────────────────────────────────────────────────

  const renderMedication = ({ item }: { item: Medication }) => {
    const selectedDate = getDateForDay(getDayIndexFromAbbr(selectedDay));
    const intakeStatus = getIntakeStatusWithTime(item.id, selectedDate);
    return (
      <MedicationCard
        item={item}
        intakeStatus={intakeStatus}
        canModify={canModify}
        onPress={() => {
          if (canModify) {
            router.push(
              `/modals/take-medication-modal?medicationId=${item.id}&plannedTime=${encodeURIComponent(
                normalizeTimesList(item.times_list).join(', ')
              )}`
            );
          } else {
            Alert.alert(
              item.name,
              `Форма: ${item.form}\nИнструкция: ${item.instructions || '—'}`
            );
          }
        }}
      />
    );
  };

  return (
    <Screen style={{ flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 16, paddingTop: 12 }}>
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
            backgroundColor: 'rgba(15, 42, 69, 0.6)',
            padding: 16,
            borderRadius: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: 'rgba(79, 195, 247, 0.3)',
          }}>
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(79, 195, 247, 0.15)',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 12,
            }}>
              <Icon source="account-heart" size={22} color="#4FC3F7" />
            </View>
            <View>
              <Text style={{ 
                color: '#E3F2FD', 
                fontSize: 16, 
                fontWeight: '700',
                marginBottom: 2,
              }}>
                👨‍⚕️ Режим мед-друга
              </Text>
              <Text style={{ 
                color: '#90CAF9', 
                fontSize: 13,
                lineHeight: 18,
              }}>
                Только просмотр. Данные пациента — под его контролем.
              </Text>
            </View>
          </View>
        )}
      </Animated.View>

      {/* Календарь */}
      <Animated.View 
        style={{ 
          opacity: headerOpacity,
          transform: [{ translateX: currentWeekAnim }],
        }}
      >
        <Surface
          elevation={3}
          style={{
            borderRadius: 24,
            overflow: 'hidden',
            marginBottom: 24,
          }}
        >
          <LinearGradient
            colors={['#1E1E1E', '#121212']}
            style={{
              padding: 16,
            }}
          >
            {/* Заголовок недели */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 20,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity 
                  onPress={goToPreviousWeek} 
                  disabled={!canGoBack}
                  activeOpacity={0.7}
                  style={{ marginRight: 8 }}
                >
                  <Animated.View style={{ 
                    opacity: canGoBack ? 1 : 0.3,
                    transform: [{ scale: canGoBack ? 1 : 0.8 }],
                  }}>
                    <Icon source="chevron-left" size={26} color="#4A3AFF" />
                  </Animated.View>
                </TouchableOpacity>

                <Text style={{ 
                  color: 'white', 
                  fontSize: 17, 
                  fontWeight: '700',
                  paddingHorizontal: 6,
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
                    opacity: canGoForward ? 1 : 0.3,
                    transform: [{ scale: canGoForward ? 1 : 0.8 }],
                  }}>
                    <Icon source="chevron-right" size={26} color="#4A3AFF" />
                  </Animated.View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={goToToday}
                disabled={isMedFriendMode}
                activeOpacity={isMedFriendMode ? 1 : 0.8}
                style={{
                  backgroundColor: isMedFriendMode ? 'rgba(255,255,255,0.1)' : '#4A3AFF',
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  opacity: isMedFriendMode ? 0.7 : 1,
                }}
              >
                <Icon source="home" size={18} color="white" />
                <Text style={{ 
                  color: 'white', 
                  fontWeight: '600', 
                  fontSize: 15, 
                  marginLeft: 6,
                }}>
                  Сегодня
                </Text>
              </TouchableOpacity>
            </View>

            {/* Сетка дней */}
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between',
              marginBottom: 16,
            }}>
              {DAY_ABBRS.slice(1).concat(DAY_ABBRS[0]).map((day) => {
                const index = getDayIndexFromAbbr(day);
                const date = getDateForDay(index);
                const isToday = toLocalDateStr(date) === toLocalDateStr(todayDate);
                const isSelected = selectedDay === day;
                const dayStatus = getDayStatus(index);

                return (
                  <DayCell
                    key={day}
                    day={day}
                    index={index}
                    isSelected={isSelected}
                    isToday={isToday}
                    dayStatus={dayStatus}
                    onPress={() => !isMedFriendMode && setSelectedDay(day)}
                    disabled={isMedFriendMode}
                  />
                );
              })}
            </View>

            {/* Легенда */}
            {!isMedFriendMode && (
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'center',
                paddingVertical: 8,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255,255,255,0.05)',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
                  <View style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: 4, 
                    backgroundColor: theme.colors.success, 
                    marginRight: 6 
                  }} />
                  <Text style={{ fontSize: 12, color: '#A0AEC0' }}>принято</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
                  <View style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: 4, 
                    backgroundColor: theme.colors.warning, 
                    marginRight: 6 
                  }} />
                  <Text style={{ fontSize: 12, color: '#A0AEC0' }}>пропущено</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: 4, 
                    backgroundColor: theme.colors.error, 
                    marginRight: 6 
                  }} />
                  <Text style={{ fontSize: 12, color: '#A0AEC0' }}>не отмечено</Text>
                </View>
              </View>
            )}
          </LinearGradient>
        </Surface>
      </Animated.View>

      {/* Список лекарств */}
      <Animated.View style={{ opacity: itemsOpacity, flex: 1 }}>
        <FlatList
          data={filteredMeds}
          renderItem={renderMedication}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 }}>
              {loading ? (
                <View style={{ alignItems: 'center' }}>
                  {[...Array(3)].map((_, i) => (
                    <View 
                      key={i}
                      style={{
                        height: 92,
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderRadius: 20,
                        marginBottom: 20,
                        width: '100%',
                      }}
                    />
                  ))}
                </View>
              ) : (
                <View style={{ alignItems: 'center', paddingHorizontal: 40 }}>
                  <View style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: 'rgba(74, 58, 255, 0.1)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: 20,
                  }}>
                    <Icon source="pill" size={32} color="#4A3AFF" />
                  </View>
                  <Text style={{ 
                    color: theme.colors.outline, 
                    fontSize: 16,
                    fontWeight: '500',
                    textAlign: 'center',
                    lineHeight: 24,
                    marginBottom: 8,
                  }}>
                    {isMedFriendMode 
                      ? `У пациента нет препаратов на ${selectedDay}` 
                      : `Нет препаратов на ${selectedDay}`}
                  </Text>
                  {!isMedFriendMode && (
                    <Text style={{ 
                      color: theme.colors.outlineVariant, 
                      fontSize: 14,
                      textAlign: 'center',
                      lineHeight: 20,
                    }}>
                      Добавьте лекарство — и MAI Tablets будет напоминать точно в срок. 💊
                    </Text>
                  )}
                </View>
              )}
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      </Animated.View>

      {/* FAB */}
      <Animated.View
        style={{
          position: 'absolute',
          right: 20,
          bottom: 24,
          transform: [{ scale: fabScale }],
          opacity: fabScale.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
        }}
      >
        {canModify && (
          <TouchableOpacity
            onPress={() => {
              router.push('/modals/add');
            }}
            activeOpacity={0.8}
          >
            <FAB
              icon="plus"
              style={{ 
                backgroundColor: '#4A3AFF',
                width: 64,
                height: 64,
                borderRadius: 32,
              }}
              size={32}
            />
          </TouchableOpacity>
        )}
      </Animated.View>
    </Screen>
  );
}

// ─── ВСПОМОГАТЕЛЬНЫЙ КОМПОНЕНТ ГРАДИЕНТА ───────────────────────────────────

const LinearGradient = ({ colors, style, children }: { 
  colors: string[]; 
  style?: any; 
  children: React.ReactNode;
}) => {
  // Простая замена для react-native-linear-gradient (если не установлен)
  return (
    <View style={[style, { backgroundColor: colors[0] }]}>
      {children}
    </View>
  );
};