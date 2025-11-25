import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { View, FlatList, TouchableOpacity } from 'react-native';
import { Text, Card, FAB, Icon } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/screen';
import { useDatabase, Medication, IntakeHistory } from '@/hooks/use-database';

export default function Schedule() {
  const router = useRouter();
  const { getMedications, getIntakeHistory } = useDatabase();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [intakeHistory, setIntakeHistory] = useState<IntakeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - (day === 0 ? -6 : day - 1); // ← ИСПРАВЛЕНО: -6 вместо 6
    const monday = new Date(today);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });
  const [selectedDay, setSelectedDay] = useState<string>('');

  const days = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

  useEffect(() => {
    const today = new Date().getDay();
    // ✅ Пн=0, Вт=1, ..., Вс=0 → индекс: Пн=0, Вт=1, ..., Вс=6
    const index = today === 0 ? 6 : today - 1;
    setSelectedDay(days[index]);
  }, []);

  const loadMeds = useCallback(async () => {
    setLoading(true);
    try {
      const meds = await getMedications();
      setMedications(meds);
    } catch (e) {
      console.error('Ошибка загрузки медикаментов:', e);
    } finally {
      setLoading(false);
    }
  }, [getMedications]);

  const loadHistory = useCallback(async () => {
    try {
      const history = await getIntakeHistory();
      setIntakeHistory(history);
    } catch (e) {
      console.error('Ошибка загрузки истории приёма:', e);
    }
  }, [getIntakeHistory]);

  useFocusEffect(
    useCallback(() => {
      loadMeds();
      loadHistory();
    }, [loadMeds, loadHistory])
  );

  // ✅ ИСПРАВЛЕНО: безопасная нормализация даты (локальная полночь)
  const normalizeLocalDate = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // ✅ ИСПРАВЛЕНО: сравнение по локальной дате
  const getIntakeStatusWithTime = (medicationId: number, date: Date) => {
    const targetDate = normalizeLocalDate(date);

    const dayIntakes = intakeHistory.filter(intake => {
      if (intake.medication_id !== medicationId) return false;

      const intakeDate = new Date(intake.datetime);
      const normalizedIntakeDate = normalizeLocalDate(intakeDate);

      return (
        normalizedIntakeDate.getFullYear() === targetDate.getFullYear() &&
        normalizedIntakeDate.getMonth() === targetDate.getMonth() &&
        normalizedIntakeDate.getDate() === targetDate.getDate()
      );
    });

    if (dayIntakes.length === 0) {
      return { status: 'Не принято', time: null, color: '#FF3B30' };
    }

    const latestIntake = dayIntakes.reduce((a, b) =>
      new Date(a.datetime) > new Date(b.datetime) ? a : b
    );

    const time = new Date(latestIntake.datetime).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (latestIntake.taken) {
      return { status: 'Принято', time, color: '#34C759' };
    } else if (latestIntake.skipped) {
      return { status: 'Пропущено', time, color: '#FF9500' };
    } else {
      return { status: 'Неизвестно', time, color: '#999' };
    }
  };

  const getDateForDay = (dayIndex: number): Date => {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + dayIndex);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  // ✅ ИСПРАВЛЕНО: надёжная проверка дат
  const isMedForSelectedDay = (med: Medication, day: string) => {
    const targetDate = getDateForDay(days.indexOf(day));
    
    // Парсим start_date
    let startDate: Date | null = null;
    if (med.start_date) {
      startDate = new Date(med.start_date);
      if (isNaN(startDate.getTime())) startDate = null;
    }
    if (!startDate) return false;

    const normalizedStartDate = normalizeLocalDate(startDate);
    const normalizedTargetDate = normalizeLocalDate(targetDate);

    if (normalizedTargetDate < normalizedStartDate) return false;

    // Проверка end_date
    if (med.end_date) {
      const endDate = new Date(med.end_date);
      if (!isNaN(endDate.getTime())) {
        const normalizedEndDate = normalizeLocalDate(endDate);
        if (normalizedTargetDate > normalizedEndDate) return false;
      }
    }

    // Расписание
    if (med.schedule_type === 'daily') return true;

    if (med.schedule_type === 'weekly_days' && med.weekly_days) {
      try {
        const daysList = typeof med.weekly_days === 'string'
          ? JSON.parse(med.weekly_days)
          : med.weekly_days;
        if (Array.isArray(daysList)) {
          return daysList.includes(day);
        }
      } catch {
        return false;
      }
    }

    if (med.schedule_type === 'every_x_days' && typeof med.interval_days === 'number') {
      const diffMs = normalizedTargetDate.getTime() - normalizedStartDate.getTime();
      const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      return diffDays >= 0 && diffDays % med.interval_days === 0;
    }

    return false;
  };

  const filteredMeds = useMemo(() => {
    return medications.filter(m => isMedForSelectedDay(m, selectedDay));
  }, [medications, selectedDay]);

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
      // ❌ Не меняем selectedDay при навигации
    }
  };

  const goToNextWeek = () => {
    if (canGoForward) {
      const newDate = new Date(currentWeekStart);
      newDate.setDate(currentWeekStart.getDate() + 7);
      setCurrentWeekStart(newDate);
      // ❌ Не меняем selectedDay при навигации
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

  return (
    <Screen style={{ flex: 1, backgroundColor: '#121212', paddingHorizontal: 16, paddingTop: 20 }}>
      {/* Панель с днями недели */}
      <View style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <TouchableOpacity onPress={goToPreviousWeek} disabled={!canGoBack}>
            <Text style={{ color: canGoBack ? '#4A3AFF' : '#444', fontSize: 24 }}>
              {'\u25C0'}
            </Text>
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
            <Text style={{ color: canGoForward ? '#4A3AFF' : '#444', fontSize: 24 }}>
              {'\u25B6'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: '#aaa', fontSize: 14, textAlign: 'center', flex: 1 }}>
            {selectedDay &&
              getDateForDay(days.indexOf(selectedDay)).toLocaleDateString('ru-RU', {
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
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => {
          const selectedDate = getDateForDay(days.indexOf(selectedDay));
          const { status, time, color } = getIntakeStatusWithTime(item.id, selectedDate);
          
          const times =
            typeof item.times_list === 'string'
              ? item.times_list
              : Array.isArray(item.times_list)
              ? item.times_list.join(', ')
              : '—';
          
          const icon =
            item.form === 'tablet'
              ? '💊'
              : item.form === 'drop'
              ? '💧'
              : item.form === 'spray'
              ? '🧴'
              : '❓';

          return (
            <TouchableOpacity
              onPress={() =>
                router.push(
                  `/modals/take-medication-modal?medicationId=${item.id}&plannedTime=${encodeURIComponent(times)}`
                )
              }
            >
              <View style={{ marginBottom: 16 }}>
                {/* Строка времени + статуса */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ color: '#aaa', fontSize: 14, fontWeight: '600', marginRight: 6 }}>
                    {times}
                  </Text>
                  
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
                      <Text style={{ color: '#ccc', fontSize: 13 }}>{item.form || '—'}</Text>
                    </View>
                  </View>
                </Card>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>
            Нет медикаментов на {selectedDay}.
          </Text>
        }
      />

      <FAB
        icon="plus"
        onPress={() => router.push('/modals/add')}
        style={{ position: 'absolute', right: 16, bottom: 16, backgroundColor: '#4A3AFF' }}
      />
    </Screen>
  );
}