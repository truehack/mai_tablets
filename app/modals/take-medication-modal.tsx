import React, { useEffect, useState } from 'react';
import { View, Text, Alert, TouchableOpacity } from 'react-native';
import { Card, Button, Portal, Modal, Provider, Surface, Icon } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDatabase } from '@/hooks/use-database';
import * as Notifications from 'expo-notifications';

export default function TakeMedicationModal() {
  const { medicationId, plannedTime } = useLocalSearchParams();
  const router = useRouter();
  const { getMedications, addIntake, deleteMedication, deleteFutureIntakes } = useDatabase();
  const [medication, setMedication] = useState<any>(null);
  useEffect(() => {
    const loadMed = async () => {
      try {
        console.log('Загрузка лекарства...');
        console.log('medicationId из параметров:', medicationId);
        const meds = await getMedications();
        console.log('Все лекарства из БД:', meds);
        const found = meds.find(m => m.id === Number(medicationId));
        console.log('Найденное лекарство:', found);
        if (found) {
          setMedication(found);
        } else {
          console.log('Лекарство не найдено по id:', Number(medicationId));
        }
      } catch (error) {
        console.error('Ошибка загрузки лекарства:', error);
      }
    };
    loadMed();
  }, [medicationId, getMedications]);
  const handleMarkAsTaken = async () => {
    try {
      await addIntake({
        medication_id: Number(medicationId),
        planned_time: plannedTime as string,
        datetime: new Date().toISOString(),
        taken: true,
        skipped: false,
      });
      router.back();
    } catch (error) {
      console.error('Ошибка при отметке приёма:', error);
    }
  };
  const handleMarkAsSkipped = async () => {
    try {
      await addIntake({
        medication_id: Number(medicationId),
        planned_time: plannedTime as string,
        datetime: new Date().toISOString(),
        taken: false,
        skipped: true,
      });
      router.back();
    } catch (error) {
      console.error('Ошибка при отметке пропуска:', error);
    }
  };
  const handleCancel = () => {
    router.back();
  };
  const handleReschedule = () => {
    router.push(`/modals/reschedule-modal?medicationId=${medicationId}&plannedTime=${encodeURIComponent(plannedTime as string)}`);
  };
  const handleDelete = async () => {
    console.log('handleDelete вызван!');
    console.log('medicationId:', medicationId);
    console.log('typeof medicationId:', typeof medicationId);
    console.log('Number(medicationId):', Number(medicationId));
    console.log('medication:', medication);
    if (!medication) {
      console.log('medication не загружен — невозможно удалить');
      Alert.alert('Ошибка', 'Не удалось загрузить информацию о лекарстве');
      return;
    }
    const medicationName = medication?.name || 'лекарство';
    console.log('Открываем Alert для удаления:', medicationName);
    Alert.alert(
      'Удалить лекарство?',
      `Вы уверены, что хотите удалить "${medicationName}"?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            console.log('Подтверждение удаления получено');
            try {
              console.log('Удаляем будущие приёмы...');
              await deleteFutureIntakes(Number(medicationId));
              console.log('Удаляем лекарство...');
              await deleteMedication(Number(medicationId));
              console.log('Лекарство и будущие приёмы удалены, закрываем модальное окно');
              router.back();
            } catch (error) {
              console.error('Ошибка при удалении лекарства:', error);
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
        <Modal visible={true} onDismiss={handleCancel}>
          <Surface style={{
            margin: 20,
            backgroundColor: '#1E1E1E',
            borderRadius: 16,
            padding: 16,
            elevation: 4,
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>{medication.name}</Text>
              <TouchableOpacity onPress={handleDelete} activeOpacity={0.6}>
                <Icon source="delete" size={40} color="#ff6b6b" />
              </TouchableOpacity>
            </View>
            {/* Content */}
            <View style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Icon source="calendar-clock" size={16} color="#aaa" style={{ marginRight: 8 }} />
                <Text style={{ color: '#ccc', fontSize: 14 }}>
                  Запланировано на {plannedTime}, сегодня
                </Text>
              </View>
              {medication.instructions && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                  <Icon source="notebook" size={16} color="#aaa" style={{ marginRight: 8, marginTop: 4 }} />
                  <Text style={{ color: '#ccc', fontSize: 14, flex: 1 }}>
                    {medication.instructions}
                  </Text>
                </View>
              )}
            </View>
            {/* Footer Buttons */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#333' }}>
              <Button
                mode="contained"
                onPress={handleMarkAsSkipped}
                buttonColor="#FF3B30"
                textColor="white"
                style={{ width: 80, height: 50, justifyContent: 'center' }}
                contentStyle={{ paddingVertical: 0 }}
              >
                <Icon source="close" size={20} color="white" />
              </Button>
              <Button
                mode="contained"
                onPress={handleMarkAsTaken}
                buttonColor="#34C759"
                textColor="white"
                style={{ width: 80, height: 50, justifyContent: 'center' }}
                contentStyle={{ paddingVertical: 0 }}
              >
                <Icon source="check" size={20} color="white" />
              </Button>
              <Button
                mode="contained"
                onPress={handleReschedule}
                buttonColor="#4A3AFF"
                textColor="white"
                style={{ width: 80, height: 50, justifyContent: 'center' }}
                contentStyle={{ paddingVertical: 0 }}
              >
                <Icon source="clock" size={20} color="white" />
              </Button>
            </View>
            {/* Labels under buttons */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 4 }}>
              <Text style={{ color: '#4A3AFF', fontSize: 12 }}>Пропустить</Text>
              <Text style={{ color: '#34C759', fontSize: 12 }}>Принять</Text>
              <Text style={{ color: '#4A3AFF', fontSize: 12 }}>Перенести</Text>
            </View>
          </Surface>
        </Modal>
      </Portal>
    </Provider>
  );
}