// app/(tabs)/schedule.tsx

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { View, FlatList, TouchableOpacity } from 'react-native';
import { Text, Card, FAB } from 'react-native-paper';
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
    const day = today.getDay(); // 0 = воскресенье
    const diff = today.getDate() - (day === 0 ? 6 : day - 1); // Понедельник
    return new Date(today.setDate(diff));
  });
  const [selectedDay, setSelectedDay] = useState<string>('');

  const days = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

  useEffect(() => {
    const todayIndex = new Date().getDay(); // 0 = Sunday
    const today = days[(todayIndex + 6) % 7]; // ПН первый
    setSelectedDay(today);
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

  const getIntakeStatusForDate = (medicationId: number, date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayIntakes = intakeHistory.filter(
      intake =>
        intake.medication_id === medicationId &&
        intake.datetime.startsWith(dateStr)
    );
    const lastIntake = dayIntakes[0];
    return lastIntake ? (lastIntake.taken ? 'Принято' : 'Пропущено') : 'Не принято';
  };

  const getDateForDay = (dayIndex: number) => {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + dayIndex);
    return date;
  };

  const isMedForSelectedDay = (med: Medication, day: string) => {
    if (!med.start_date) return false;
    const start = new Date(med.start_date);
    if (isNaN(start.getTime())) return false;

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

  // ✅ Изменено: теперь ±8 недель (56 дней)
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - 56); // 8 недель назад
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 56); // 8 недель вперед

  const canGoBack = currentWeekStart > minDate;
  const canGoForward = currentWeekStart < maxDate;

  const goToPreviousWeek = () => {
    if (canGoBack) {
      const newDate = new Date(currentWeekStart);
      newDate.setDate(currentWeekStart.getDate() - 7);
      setCurrentWeekStart(newDate);
      const todayIndex = new Date().getDay();
      const today = days[(todayIndex + 6) % 7];
      setSelectedDay(today);
    }
  };

  const goToNextWeek = () => {
    if (canGoForward) {
      const newDate = new Date(currentWeekStart);
      newDate.setDate(currentWeekStart.getDate() + 7);
      setCurrentWeekStart(newDate);
      const todayIndex = new Date().getDay();
      const today = days[(todayIndex + 6) % 7];
      setSelectedDay(today);
    }
  };

  return (
    <Screen style={{ flex: 1, backgroundColor: '#121212', paddingHorizontal: 16, paddingTop: 20 }}>
      {/* Панель с днями недели, датой и кнопкой "Сегодня" */}
      <View style={{ marginBottom: 20 }}>
        {/* Строка с днями недели и стрелками */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          {/* Стрелка влево */}
          <TouchableOpacity onPress={goToPreviousWeek} disabled={!canGoBack}>
            <Text style={{ color: canGoBack ? '#4A3AFF' : '#444', fontSize: 24 }}>
              {'\u25C0'}
            </Text>
          </TouchableOpacity>

          {/* Центральная часть: дни недели */}
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

          {/* Стрелка вправо */}
          <TouchableOpacity onPress={goToNextWeek} disabled={!canGoForward}>
            <Text style={{ color: canGoForward ? '#4A3AFF' : '#444', fontSize: 24 }}>
              {'\u25B6'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Строка с датой и кнопкой "Сегодня" — дата чуть правее */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          {/* Дата выбранного дня — по центру, чуть правее */}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#ccc', fontSize: 14, textAlign: 'center', marginLeft: 10 }}> {/* ✅ Сдвиг вправо */}
              {selectedDay && getDateForDay(days.indexOf(selectedDay)).toLocaleDateString('ru-RU')}
            </Text>
          </View>

          {/* Кнопка "Сегодня" — справа */}
          <TouchableOpacity
            onPress={() => {
              const realToday = new Date();
              const day = realToday.getDay();
              const diff = realToday.getDate() - (day === 0 ? 6 : day - 1);
              const currentMonday = new Date(realToday);
              currentMonday.setDate(diff);
              setCurrentWeekStart(currentMonday);
              const todayIndex = realToday.getDay();
              const todayDay = days[(todayIndex + 6) % 7];
              setSelectedDay(todayDay);
            }}
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
          const status = getIntakeStatusForDate(item.id, selectedDate);
          const statusColor = status === 'Принято' ? '#34C759' : status === 'Пропущено' ? '#FF9500' : '#FF3B30';
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
                <Text style={{ color: '#aaa', marginBottom: 4, fontSize: 14, fontWeight: '600' }}>
                  {times}{' '}
                  <Text style={{ color: statusColor, fontWeight: '500' }}>{status}</Text>
                </Text>

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