// app/(tabs)/schedule.tsx
import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { View, FlatList, TouchableOpacity } from 'react-native';
import { Text, Card, FAB, Icon } from 'react-native-paper'; // ✅ добавлен Icon
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
    const diff = today.getDate() - (day === 0 ? 6 : day - 1);
    return new Date(today.setDate(diff));
  });
  const [selectedDay, setSelectedDay] = useState<string>('');

  const days = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

  useEffect(() => {
    const todayIndex = new Date().getDay();
    const today = days[(todayIndex + 6) % 7];
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

  // ✅ Новая функция: получает статус + время последнего приёма за день
  const getIntakeStatusWithTime = (medicationId: number, date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayIntakes = intakeHistory.filter(
      intake =>
        intake.medication_id === medicationId &&
        intake.datetime.startsWith(dateStr)
    );

    if (dayIntakes.length === 0) {
      return { status: 'Не принято', time: null, color: '#FF3B30' };
    }

    // Берём самый свежий приём за день
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

  const minDate = new Date();
  minDate.setDate(minDate.getDate() - 56);
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 56);

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
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#ccc', fontSize: 14, textAlign: 'center', marginLeft: 10 }}>
              {selectedDay && getDateForDay(days.indexOf(selectedDay)).toLocaleDateString('ru-RU')}
            </Text>
          </View>

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
                {/* ✅ Строка времени + статуса с иконкой */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ color: '#aaa', fontSize: 14, fontWeight: '600', marginRight: 6 }}>
                    {times}
                  </Text>
                  
                  {/* Иконка статуса */}
                  {status === 'Принято' && <Icon source="check-circle" size={16} color={color} />}
                  {status === 'Пропущено' && <Icon source="close-circle" size={16} color={color} />}
                  {status === 'Не принято' && <Icon source="clock-outline" size={16} color={color} />}
                  
                  {/* Текст статуса + время */}
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