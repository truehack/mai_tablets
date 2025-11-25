import React, { useEffect, useState } from 'react';
import { View, Text, Alert, TouchableOpacity } from 'react-native';
import { Card, Button, Portal, Modal, Provider, Surface, Icon } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDatabase } from '@/hooks/use-database';
import apiClient from '@/services/api';

export default function TakeMedicationModal() {
  const { medicationId, plannedTime } = useLocalSearchParams<{ medicationId: string; plannedTime: string }>();
  const router = useRouter();
  const { getMedications, addIntake, deleteMedication, deleteFutureIntakes } = useDatabase();

  const [medication, setMedication] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionStatus, setActionStatus] = useState<{ type: 'taken' | 'skipped'; time: string } | null>(null);

  // ✅ Очищаем plannedTime: оставляем только "HH:mm"
  const cleanPlannedTime = React.useMemo(() => {
    if (!plannedTime) return '00:00';
    // Если ISO-строка — вытаскиваем время
    if (plannedTime.includes('T')) {
      const timePart = plannedTime.split('T')[1];
      if (timePart.includes(':')) {
        return timePart.substring(0, 5); // "09:00"
      }
    }
    // Если "09:00:00" → "09:00"
    if (plannedTime.includes(':') && plannedTime.length > 5) {
      return plannedTime.substring(0, 5);
    }
    return plannedTime;
  }, [plannedTime]);

  useEffect(() => {
    const loadMed = async () => {
      try {
        if (!medicationId) return;
        
        const meds = await getMedications();
        const found = meds.find(m => m.id === Number(medicationId));
        
        if (!found) {
          console.warn('Лекарство не найдено по id:', medicationId);
          Alert.alert('Ошибка', 'Лекарство не найдено');
          router.back();
          return;
        }
        
        console.log('💊 Загружено лекарство:', {
          id: found.id,
          server_id: found.server_id,
          name: found.name,
          plannedTimeRaw: plannedTime,
          plannedTimeClean: cleanPlannedTime,
        });
        
        setMedication(found);
        
      } catch (error) {
        console.error('Ошибка загрузки лекарства:', error);
        Alert.alert('Ошибка', 'Не удалось загрузить лекарство');
        router.back();
      }
    };

    loadMed();
  }, [medicationId, router, plannedTime, cleanPlannedTime]);

  const handleIntakeAction = async (taken: boolean) => {
    if (!medication) {
      Alert.alert('Ошибка', 'Лекарство не загружено');
      return;
    }

    setIsSyncing(true);

    try {
      const now = new Date();
      const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const intakeDateTime = new Date(now);
      
      console.log('📅 Сохраняем запись с реальным временем:', {
        intakeDateTime: intakeDateTime.toISOString(),
        formattedTime: formattedTime,
        currentTime: now.toISOString(),
        plannedTimeRaw: plannedTime,
        plannedTimeClean: cleanPlannedTime,
      });
      
      // ✅ Используем cleanPlannedTime во всех местах
      const localIntakeData = {
        medication_id: medication.id,
        planned_time: cleanPlannedTime, // ✅ только "HH:mm"
        datetime: intakeDateTime.toISOString(),
        taken,
        skipped: !taken,
      };

      const serverIntakeData = {
        medication_id: medication.server_id ?? medication.id, // ✅ если server_id null — id
        planned_time: cleanPlannedTime, // ✅ только "HH:mm"
        datetime: intakeDateTime.toISOString(),
        taken,
        skipped: !taken,
      };

      // 1️⃣ Сохраняем локально
      const localId = await addIntake(localIntakeData);
      console.log('✅ Запись сохранена локально, id:', localId);

      // 2️⃣ Устанавливаем статус действия
      setActionStatus({ 
        type: taken ? 'taken' : 'skipped', 
        time: formattedTime 
      });

      // 3️⃣ Синхронизируем (теперь работает корректно благодаря исправленному ensureISOZ)
      try {
        console.log('📤 Синхронизация intake:', {
          medication_id: serverIntakeData.medication_id,
          planned_time: serverIntakeData.planned_time,
        });
        await apiClient.intakeSync(serverIntakeData);
        console.log('✅ Синхронизация успешна');
      } catch (syncError: any) {
        console.warn('⚠️ Синхронизация отложена:', syncError.message);
        Alert.alert(
          'Синхронизация отложена',
          'Данные сохранены на устройстве.',
          [{ text: 'OK' }]
        );
      }

      // ✅ Закрываем модалку через 1.2 секунды
      setTimeout(() => {
        router.back();
      }, 1200);

    } catch (error: any) {
      console.error('❌ Ошибка сохранения:', error);
      setActionStatus(null);
      Alert.alert('Ошибка', error.message || 'Не удалось сохранить приём');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleMarkAsTaken = () => handleIntakeAction(true);
  const handleMarkAsSkipped = () => handleIntakeAction(false);
  const handleCancel = () => router.back();

  const handleDelete = async () => {
    if (!medication) {
      Alert.alert('Ошибка', 'Лекарство не загружено');
      return;
    }

    Alert.alert(
      'Удалить лекарство?',
      `Вы уверены, что хотите удалить "${medication.name}"?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFutureIntakes(medication.id);
              await deleteMedication(medication.id);
              router.back();
            } catch (error) {
              console.error('Ошибка удаления:', error);
              Alert.alert('Ошибка', 'Не удалось удалить лекарство');
            }
          },
        },
      ]
    );
  };

  if (!medication) {
    return (
      <Provider>
        <Portal>
          <Modal visible={true} onDismiss={handleCancel}>
            <Card style={{ margin: 20, backgroundColor: '#1E1E1E' }}>
              <Card.Content>
                <Text style={{ color: 'white', textAlign: 'center' }}>
                  {isSyncing ? 'Синхронизация...' : 'Загрузка...'}
                </Text>
              </Card.Content>
            </Card>
          </Modal>
        </Portal>
      </Provider>
    );
  }

  // Отображаемое время (уже очищенное)
  const displayTime = cleanPlannedTime;

  return (
    <Provider>
      <Portal>
        <Modal visible={true} onDismiss={handleCancel}>
          <Surface style={{
            margin: 20,
            backgroundColor: '#1E1E1E',
            borderRadius: 16,
            padding: 16,
            elevation: 4,
          }}>
            {/* Header with pill icon and time */}
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'flex-start',
              marginBottom: 16 
            }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Icon source="pill" size={26} color="#64B5F6" />
                  <Text style={{ 
                    color: 'white', 
                    fontSize: 18, 
                    fontWeight: '600',
                    flex: 1,
                  }}>
                    {medication.name}
                  </Text>
                </View>
                
                {/* Time row: clock icon + scheduled time */}
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  marginTop: 6, 
                  gap: 6 
                }}>
                  <Icon source="clock-outline" size={16} color="#888" />
                  <Text style={{ color: '#aaa', fontSize: 14 }}>
                    Запланировано на {displayTime}, сегодня
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity 
                onPress={handleDelete} 
                activeOpacity={0.6} 
                disabled={isSyncing}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon 
                  source="delete" 
                  size={40} 
                  color={isSyncing ? '#666' : '#ff6b6b'} 
                />
              </TouchableOpacity>
            </View>

            {/* Content */}
            {medication.instructions && (
              <View style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <Icon source="notebook-outline" size={18} color="#aaa" style={{ marginTop: 4 }} />
                  <Text style={{ color: '#ccc', fontSize: 14, flex: 1 }}>
                    {medication.instructions}
                  </Text>
                </View>
              </View>
            )}

            {/* Footer Buttons */}
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-around', 
              paddingTop: 16, 
              borderTopWidth: 1, 
              borderTopColor: '#333' 
            }}>
              <Button
                mode="contained"
                onPress={handleMarkAsSkipped}
                buttonColor="#FF3B30"
                textColor="white"
                style={{ width: 80, height: 50 }}
                contentStyle={{ paddingVertical: 0 }}
                disabled={isSyncing}
                loading={isSyncing}
              >
                <Icon source="close" size={20} color="white" />
              </Button>

              <Button
                mode="contained"
                onPress={handleMarkAsTaken}
                buttonColor="#34C759"
                textColor="white"
                style={{ width: 80, height: 50 }}
                contentStyle={{ paddingVertical: 0 }}
                disabled={isSyncing}
                loading={isSyncing}
              >
                <Icon source="check" size={20} color="white" />
              </Button>

              <Button
                mode="contained"
                onPress={handleCancel}
                buttonColor="#4A3AFF"
                textColor="white"
                style={{ width: 80, height: 50 }}
                contentStyle={{ paddingVertical: 0 }}
                disabled={isSyncing}
              >
                <Icon source="clock" size={20} color="white" />
              </Button>
            </View>

            {/* Labels */}
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-around', 
              marginTop: 6 
            }}>
              <Text style={{ color: isSyncing ? '#666' : '#FF3B30', fontSize: 12 }}>Пропустить</Text>
              <Text style={{ color: isSyncing ? '#666' : '#34C759', fontSize: 12 }}>Принять</Text>
              <Text style={{ color: isSyncing ? '#666' : '#4A3AFF', fontSize: 12 }}>Перенести</Text>
            </View>

            {/* ✅ Action confirmation */}
            {actionStatus && (
              <View style={{ 
                marginTop: 16, 
                padding: 14,
                backgroundColor: actionStatus.type === 'taken' ? '#252D25' : '#2D2525',
                borderRadius: 10,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: actionStatus.type === 'taken' ? '#2E7D32' : '#C62828',
              }}>
                <Icon 
                  source={actionStatus.type === 'taken' ? 'check-circle' : 'close-circle'} 
                  size={32} 
                  color={actionStatus.type === 'taken' ? '#4CAF50' : '#EF5350'} 
                />
                <Text style={{ 
                  color: 'white', 
                  fontSize: 16,
                  marginTop: 8,
                  fontWeight: '600',
                  textAlign: 'center',
                }}>
                  {actionStatus.type === 'taken' 
                    ? `✅ Принято в ${actionStatus.time}` 
                    : `❌ Пропущено в ${actionStatus.time}`}
                </Text>
              </View>
            )}
          </Surface>
        </Modal>
      </Portal>
    </Provider>
  );
}