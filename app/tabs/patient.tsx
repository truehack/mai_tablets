import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { View, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Text, Card, FAB, Icon } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/screen';
import apiClient from '@/services/api';
import { logDebug, logWarning, logError } from '@/utils/debug-log';

// 🔑 Типы
interface Medication {
  id: number;
  server_id: number | null;
  name: string;
  form: string;
  instructions?: string;
  start_date: string; // "YYYY-MM-DD"
  end_date?: string;
  schedule_type: 'daily' | 'weekly_days' | 'every_x_days';
  week_days?: number[];
  interval_days?: number;
  times_per_day: string[]; // например: ["08:00", "20:00"] или ["08:00:15"]
}

interface Intake {
  id: number;
  medication_id: number;
  scheduled_time: string; // ISO, e.g. "2025-11-25T08:00:00+00:00"
  taken_time: string;
  status: 'taken' | 'skipped';
  notes?: string;
}

// ✅ Вспомогательная функция: форматирует Date → "HH:MM"
const formatTimeHHMM = (date: Date): string => {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
};

// ✅ Вспомогательная функция: парсит "HH:MM" или "HH:MM:SS" → секунды с полуночи (для сортировки)
const timeToSeconds = (timeStr: string): number => {
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!match) return 0;

  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);

  if (h === 24 && m === 0) return 24 * 3600; // 24:00 → конец суток
  if (h > 23) h = 23;
  return h * 3600 + m * 60;
};

export default function PatientSchedule() {
  const router = useRouter();
  const [patient, setPatient] = useState<{ uuid: string; username: string } | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [intakes, setIntakes] = useState<Intake[]>([]);
  const [loading, setLoading] = useState(true);

  // === Календарь (локальное время, ПН = начало недели) ===
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - (day === 0 ? -6 : day - 1);
    const monday = new Date(today);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const days = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
  const [selectedDay, setSelectedDay] = useState<string>('');

  useEffect(() => {
    const today = new Date().getDay();
    const index = today === 0 ? 6 : today - 1;
    setSelectedDay(days[index]);
  }, []);

  // === Вспомогательные функции ===
  const getDateForDay = useCallback((dayIndex: number): Date => {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + dayIndex);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [currentWeekStart]);

  // ✅ ГАРАНТИРОВАННО БЕЗ СЕКУНД: ручной формат HH:MM
  const getIntakeStatusWithTime = useCallback(
    (medication: Medication, date: Date) => {
      const medicationIdToMatch = medication.server_id ?? medication.id;

      const targetUTCDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);

      const dayIntakes = intakes.filter((intake) => {
        if (intake.medication_id !== medicationIdToMatch) return false;
        const intakeUTCDate = intake.scheduled_time.slice(0, 10);
        return intakeUTCDate === targetUTCDate;
      });

      if (dayIntakes.length === 0) {
        logDebug('❌ No intakes for medication on UTC date', {
          medication: { id: medication.id, name: medication.name, server_id: medication.server_id },
          targetUTCDate,
          medicationIdToMatch,
        });
        return { status: 'Не принято', time: null, color: '#FF3B30' };
      }

      const latestIntake = dayIntakes.reduce((a, b) =>
        a.scheduled_time > b.scheduled_time ? a : b
      );

      // ✅ ТОЛЬКО ЧЧ:ММ — никаких секунд!
      let time: string | null = null;
      if (latestIntake.taken_time) {
        try {
          const takenDate = new Date(latestIntake.taken_time);
          if (!isNaN(takenDate.getTime())) {
            time = formatTimeHHMM(takenDate);
          }
        } catch (e) {
          logWarning('Не удалось распарсить taken_time', latestIntake.taken_time);
        }
      }

      switch (latestIntake.status) {
        case 'taken':
          return { status: 'Принято', time, color: '#34C759' };
        case 'skipped':
          return { status: 'Пропущено', time, color: '#FF9500' };
        default:
          return { status: 'Неизвестно', time, color: '#999' };
      }
    },
    [intakes]
  );

  const isMedForSelectedDay = useCallback(
    (med: Medication, day: string): boolean => {
      const targetDate = getDateForDay(days.indexOf(day));
      const targetUTCDate = new Date(targetDate.getTime() - targetDate.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);

      if (targetUTCDate < med.start_date) return false;
      if (med.end_date && targetUTCDate > med.end_date) return false;

      if (med.schedule_type === 'daily') return true;

      if (med.schedule_type === 'weekly_days' && Array.isArray(med.week_days)) {
        const dayIndex = days.indexOf(day) + 1;
        return med.week_days.includes(dayIndex);
      }

      if (med.schedule_type === 'every_x_days' && typeof med.interval_days === 'number') {
        const startDate = new Date(med.start_date);
        const target = new Date(targetUTCDate);
        const diffMs = target.getTime() - startDate.getTime();
        const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
        return diffDays >= 0 && diffDays % med.interval_days === 0;
      }

      return false;
    },
    [getDateForDay]
  );

  // ✅ Сортировка по времени (00:00 → 24:00), игнорируя секунды
  const filteredMeds = useMemo(() => {
    const getEarliestTimeSeconds = (med: Medication): number => {
      if (!Array.isArray(med.times_per_day) || med.times_per_day.length === 0) return 0;
      try {
        return Math.min(...med.times_per_day.map(timeToSeconds));
      } catch (e) {
        logWarning('Не удалось распарсить times_per_day', { medId: med.id, times: med.times_per_day });
        return 0;
      }
    };

    return medications
      .filter((m) => isMedForSelectedDay(m, selectedDay))
      .sort((a, b) => getEarliestTimeSeconds(a) - getEarliestTimeSeconds(b));
  }, [medications, selectedDay, isMedForSelectedDay]);

  // === Загрузка данных ===
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const patientRes = await apiClient.getWithAuth('/friends/get-patient');
      if (!patientRes.uuid || patientRes.uuid === 'null') {
        setPatient(null);
        setMedications([]);
        setIntakes([]);
        setLoading(false);
        return;
      }

      setPatient({
        uuid: patientRes.uuid,
        username: patientRes.username || 'Пациент',
      });

      const medsRes = await apiClient.getWithAuth('/medicines/get_medications_for_current_friend');
      const meds = Array.isArray(medsRes)
        ? medsRes.map((med) => ({
            ...med,
            id: med.id != null ? Number(med.id) : 0,
            server_id: med.server_id != null ? Number(med.server_id) : null,
          }))
        : [];
      setMedications(meds);

      const intakesRes = await apiClient.getWithAuth('/intake/get_intakes_for_current_friend');
      setIntakes(Array.isArray(intakesRes) ? intakesRes : []);
    } catch (error: any) {
      logError('❌ Ошибка загрузки данных', error);
      Alert.alert('Ошибка', error.message || 'Не удалось загрузить данные');
      setPatient(null);
      setMedications([]);
      setIntakes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // === Навигация по неделям ===
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - 56);
  minDate.setHours(0, 0, 0, 0);

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 56);
  maxDate.setHours(0, 0, 0, 0);

  const canGoBack = currentWeekStart > minDate;
  const canGoForward = currentWeekStart < maxDate;

  const goToPreviousWeek = () => {
    if (canGoBack) {
      const newDate = new Date(currentWeekStart);
      newDate.setDate(currentWeekStart.getDate() - 7);
      setCurrentWeekStart(newDate);
    }
  };

  const goToNextWeek = () => {
    if (canGoForward) {
      const newDate = new Date(currentWeekStart);
      newDate.setDate(currentWeekStart.getDate() + 7);
      setCurrentWeekStart(newDate);
    }
  };

  const goToToday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - (day === 0 ? -6 : day - 1);
    const monday = new Date(today);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);

    const index = day === 0 ? 6 : day - 1;
    setSelectedDay(days[index]);
  };

  // === Отписка ===
  const handleUnsubscribe = async () => {
    if (!patient) return;
    Alert.alert(
      'Подтверждение',
      `Отписаться от пациента "${patient.username}"?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Отписаться',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteWithAuth('/friends/unsubscribe-from-patient');
              router.replace('/');
            } catch (error: any) {
              logError('❌ Ошибка отписки', error);
              Alert.alert('Ошибка', error.message);
            }
          },
        },
      ]
    );
  };

  // === Рендер ===
  if (loading) {
    return (
      <Screen style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4A3AFF" />
        <Text style={{ color: '#fff', marginTop: 10 }}>Загрузка...</Text>
      </Screen>
    );
  }

  if (!patient) {
    return (
      <Screen
        style={{
          flex: 1,
          backgroundColor: '#121212',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 20, textAlign: 'center', marginBottom: 20 }}>
          Нет подключённого пациента
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/profile')}
          style={{ backgroundColor: '#4A3AFF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Перейти в профиль</Text>
        </TouchableOpacity>
      </Screen>
    );
  }

  const selectedDate = getDateForDay(days.indexOf(selectedDay));

  return (
    <Screen style={{ flex: 1, backgroundColor: '#121212', paddingHorizontal: 16, paddingTop: 20 }}>
      {/* Заголовок */}
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}>{patient.username}</Text>
        <Text style={{ color: '#666', fontSize: 14 }}>Пациент</Text>
      </View>

      {/* Календарь */}
      <View style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <TouchableOpacity onPress={goToPreviousWeek} disabled={!canGoBack}>
            <Text style={{ color: canGoBack ? '#4A3AFF' : '#444', fontSize: 24 }}>&#8249;</Text>
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%' }}>
              {days.map((day, idx) => {
                const date = getDateForDay(idx);
                const dayNum = date.getDate();
                const isSelected = selectedDay === day;

                return (
                  <TouchableOpacity key={day} onPress={() => setSelectedDay(day)}>
                    <View style={{ alignItems: 'center' }}>
                      <View
                        style={{
                          backgroundColor: isSelected ? '#4A3AFF' : '#1E1E1E',
                          borderRadius: 25,
                          width: 36,
                          height: 36,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: isSelected ? 'white' : '#aaa', fontWeight: '600' }}>{day}</Text>
                      </View>
                      <Text style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>{dayNum}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity onPress={goToNextWeek} disabled={!canGoForward}>
            <Text style={{ color: canGoForward ? '#4A3AFF' : '#444', fontSize: 24 }}>&#8250;</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#aaa', fontSize: 14, textAlign: 'center', flex: 1 }}>
            {selectedDay &&
              selectedDate.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
              })}
          </Text>

          <TouchableOpacity
            onPress={goToToday}
            style={{
              backgroundColor: '#4A3AFF',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 12,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>Сегодня</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Список лекарств */}
      <FlatList<Medication>
        data={filteredMeds}
        extraData={selectedDay}
        keyExtractor={(item) => `med-${item.server_id ?? item.id}`}
        renderItem={({ item }) => {
          const { status, time, color } = getIntakeStatusWithTime(item, selectedDate);

          // ✅ Гарантированно HH:MM — даже если в times_per_day есть секунды
          const times = item.times_per_day
            .map(t => {
              const match = t.match(/^(\d{1,2}):(\d{2})/);
              return match ? `${match[1].padStart(2, '0')}:${match[2]}` : t;
            })
            .join(', ');

          const icon =
            item.form === 'tablet'
              ? '💊'
              : item.form === 'drop'
              ? '💧'
              : item.form === 'spray'
              ? '🧴'
              : '❓';

          return (
            <View style={{ marginBottom: 16 }}>
              {/* Строка времени + статуса */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ color: '#aaa', fontSize: 14, fontWeight: '600', marginRight: 6 }}>{times}</Text>

                {status === 'Принято' && <Icon source="check-circle" size={16} color={color} />}
                {status === 'Пропущено' && <Icon source="close-circle" size={16} color={color} />}
                {status === 'Не принято' && <Icon source="clock-outline" size={16} color={color} />}

                <Text style={{ color: color, fontSize: 14, fontWeight: '500', marginLeft: 4 }}>
                  {status}
                  {time && ` в ${time}`}
                </Text>
              </View>

              <Card
                mode="contained"
                style={{ backgroundColor: '#1E1E1E', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: '#2C2C2C',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 2 }}>
                      {item.name}
                    </Text>
                    <Text style={{ color: '#ccc', fontSize: 13 }}>{item.form}</Text>
                  </View>
                </View>
              </Card>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>
            Нет медикаментов на {selectedDay}.
          </Text>
        }
      />

      {/* Кнопка отписки */}
      <FAB
        icon="account-remove"
        onPress={handleUnsubscribe}
        style={{ position: 'absolute', left: 16, bottom: 16, backgroundColor: '#FF3B30' }}
        small
      />
    </Screen>
  );
}