import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Alert, TouchableOpacity } from 'react-native';
import { Card, Button, Portal, Modal, Provider, Surface, Icon, Divider } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDatabase } from '@/hooks/use-database';

export default function RescheduleModal() {
  const { medicationId, plannedTime } = useLocalSearchParams();
  const router = useRouter();
  const { getMedications, getIntakeHistory } = useDatabase();
  const [newTime, setNewTime] = useState('');
  const [error, setError] = useState('');
  const [medication, setMedication] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMed = async () => {
      try {
        setLoading(true);
        const meds = await getMedications();
        const found = meds.find(m => m.id === Number(medicationId));
        if (found) {
          setMedication(found);
        }
      } catch (error) {
        console.error('Ошибка загрузки лекарства:', error);
        setError('Не удалось загрузить информацию о лекарстве');
      } finally {
        setLoading(false);
      }
    };
    loadMed();
  }, [medicationId]);

  const validateTime = (time: string): boolean => {
    if (!time) return false;
    const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return regex.test(time.trim());
  };

  const checkForTimeConflict = async (time: string): Promise<boolean> => {
    if (!medication) return false;
    
    const history = await getIntakeHistory();
    const today = new Date().toISOString().split('T')[0];
    
    // Проверяем, нет ли других лекарств, запланированных на это же время сегодня
    const hasConflict = history.some(intake => {
      const intakeDate = intake.datetime.split('T')[0];
      return intakeDate === today && intake.planned_time === time;
    });
    
    return hasConflict;
  };

  const handleConfirm = async () => {
    if (!newTime) {
      setError('Пожалуйста, введите время');
      return;
    }

    if (!validateTime(newTime)) {
      setError('Неверный формат времени. Используйте ЧЧ:ММ (08:00, 21:30)');
      return;
    }

    const hasConflict = await checkForTimeConflict(newTime);
    if (hasConflict) {
      setError('Конфликт: уже есть лекарство, запланированное на это время');
      return;
    }

    try {
      // Здесь мы будем использовать функцию из add.tsx
      // Сначала удаляем старое уведомление (в реальной реализации нужно будет добавить эту логику)
      
      // Затем создаем новое уведомление
      await scheduleMedicationNotification(
        medication.name,
        medication.form,
        newTime,
        medication.schedule_type,
        medication.weekly_days,
        medication.interval_days,
        medication.start_date
      );

      // Закрыть модал
      router.back();
    } catch (error) {
      console.error('Ошибка при планировании уведомления:', error);
      setError('Не удалось запланировать новое уведомление');
    }
  };

  // Копия функции из add.tsx для планирования уведомлений
  const scheduleMedicationNotification = async (
    name: string,
    form: string,
    time: string,
    scheduleType: any,
    weeklyDays?: any,
    intervalDays?: any,
    startDate?: any
  ) => {
    const [hour, minute] = time.split(":").map(Number);
    if (isNaN(hour) || isNaN(minute)) {
      console.log(`⏰ Ошибка: время ${time} некорректно`);
      return;
    }

    // Вычисляем время уведомления: за 10 минут до приёма
    let notificationHour = hour;
    let notificationMinute = minute - 10;
    
    // Если минуты < 0 — переносим на предыдущий час
    if (notificationMinute < 0) {
      notificationMinute += 60;
      notificationHour -= 1;
      // Если час < 0 — переносим на предыдущий день
      if (notificationHour < 0) {
        notificationHour = 23;
      }
    }

    // Если тип — daily
    if (scheduleType === 'daily') {
      const now = new Date();
      const triggerTime = new Date();
      triggerTime.setHours(notificationHour);
      triggerTime.setMinutes(notificationMinute);
      triggerTime.setSeconds(0);
      
      // Если время уже прошло — переносим на завтра
      if (triggerTime <= now) {
        triggerTime.setDate(triggerTime.getDate() + 1);
      }
      
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `💊 Скоро приём: ${name}`,
            body: `Через 10 минут нужно принять ${form || "лекарство"} в ${time}`,
            sound: true,
          },
          trigger: {
            date: triggerTime,
          },
        });
        console.log(`⏰ Уведомление запланировано для ${name} на ${triggerTime}`);
      } catch (e) {
        console.error(`❌ Ошибка при планировании уведомления для ${name}:`, e);
      }
    }
    // Дополнительные типы расписания (weekly_days, every_x_days) 
    // должны быть добавлены аналогично, как в add.tsx
  };

  if (loading) {
    return (
      <Provider>
        <Portal>
          <Modal visible={true} onDismiss={() => router.back()}>
            <Card style={{ margin: 20, backgroundColor: '#1E1E1E' }}>
              <Card.Content>
                <Text style={{ color: 'white', textAlign: 'center' }}>Загрузка...</Text>
              </Card.Content>
            </Card>
          </Modal>
        </Portal>
      </Provider>
    );
  }

  return (
    <Provider>
      <Portal>
        <Modal visible={true} onDismiss={() => router.back()}>
          <Surface style={{
            margin: 20,
            backgroundColor: '#1E1E1E',
            borderRadius: 16,
            padding: 16,
            elevation: 4,
          }}>
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: 'white', fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 16 }}>
                Перенос приема
              </Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Icon source="clock-outline" size={20} color="#aaa" style={{ marginRight: 8 }} />
                <Text style={{ color: '#ccc', fontSize: 14 }}>
                  Текущее время: {plannedTime}
                </Text>
              </View>
              
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#ccc', fontSize: 14, marginBottom: 4 }}>Новое время</Text>
                <TextInput
                  style={{
                    backgroundColor: '#2C2C2C',
                    color: 'white',
                    padding: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: error ? '#FF3B30' : '#333',
                  }}
                  placeholder="08:00"
                  value={newTime}
                  onChangeText={setNewTime}
                  keyboardType="numeric"
                  maxLength={5}
                  placeholderTextColor="#666"
                />
                {error ? <Text style={{ color: '#FF3B30', fontSize: 12, marginTop: 4 }}>{error}</Text> : null}
                <Text style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                  Введите время в формате ЧЧ:ММ (08:00, 21:30)
                </Text>
              </View>
            </View>

            <Divider style={{ backgroundColor: '#333', marginVertical: 12 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Button
                mode="outlined"
                onPress={() => router.back()}
                style={{ flex: 1, marginRight: 8 }}
                textColor="white"
                borderColor="#555"
              >
                Отмена
              </Button>
              <Button
                mode="contained"
                onPress={handleConfirm}
                style={{ flex: 1, marginLeft: 8 }}
                buttonColor="#4A3AFF"
                textColor="white"
              >
                Подтвердить
              </Button>
            </View>
          </Surface>
        </Modal>
      </Portal>
    </Provider>
  );
}