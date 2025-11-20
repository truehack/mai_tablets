import React, { useEffect, useState } from 'react';
import { View, Text, Alert, TouchableOpacity } from 'react-native';
import { Card, Button, Portal, Modal, Provider, Surface, Icon } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDatabase, IntakeHistory } from '@/hooks/use-database';

export default function TakeMedicationModal() {
  const { medicationId, plannedTime } = useLocalSearchParams();
  const router = useRouter();
  const { getMedications, getIntakeHistory, addIntake, deleteMedication, deleteFutureIntakes } = useDatabase();
  const [medication, setMedication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [intakeHistory, setIntakeHistory] = useState<IntakeHistory[]>([]);
  
  useEffect(() => {
    const loadMed = async () => {
      try {
        setLoading(true);
        const meds = await getMedications();
        const found = meds.find(m => m.id === Number(medicationId));
        if (found) {
          setMedication(found);
        }
        
        // Load intake history to find the correct record
        const history = await getIntakeHistory();
        setIntakeHistory(history);
      } catch (error) {
        console.error('Ошибка загрузки лекарства:', error);
        Alert.alert('Ошибка', 'Не удалось загрузить информацию о лекарстве');
      } finally {
        setLoading(false);
      }
    };
    loadMed();
  }, [medicationId]);

  // Function to find the correct intake record to update
  // For rescheduled medications, we need to find the record that was created during rescheduling
  const findCurrentIntakeRecord = (): IntakeHistory | undefined => {
    if (!intakeHistory || !medication) return undefined;
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Look for intake records for this medication today with the planned_time that matches the passed parameter
    // This should work for both regular and rescheduled medications
    const todayIntakes = intakeHistory.filter(intake => 
      intake.medication_id === Number(medicationId) &&
      intake.datetime.startsWith(todayStr) &&
      intake.planned_time === (plannedTime as string)
    );
    
    // If there are multiple records, prioritize the one that hasn't been taken or skipped yet
    const pendingIntake = todayIntakes.find(intake => !intake.taken && !intake.skipped);
    if (pendingIntake) return pendingIntake;
    
    // If no pending intake with the specific planned_time, look for any rescheduled intake for this medication today
    const rescheduledIntakes = intakeHistory.filter(intake => 
      intake.medication_id === Number(medicationId) &&
      intake.datetime.startsWith(todayStr) &&
      intake.notes && 
      intake.notes.includes('перенос из')
    );
    
    // If there are rescheduled records, try to find a pending one
    const pendingRescheduled = rescheduledIntakes.find(intake => !intake.taken && !intake.skipped);
    if (pendingRescheduled) return pendingRescheduled;
    
    // If no pending intake, return the most recent one from either list
    if (todayIntakes.length > 0) {
      return todayIntakes[todayIntakes.length - 1];
    }
    
    if (rescheduledIntakes.length > 0) {
      return rescheduledIntakes[rescheduledIntakes.length - 1];
    }
    
    // If no records found for today, return undefined
    return undefined;
  };

  const handleMarkAsTaken = async () => {
    try {
      const existingIntake = findCurrentIntakeRecord();
      
      if (existingIntake) {
        // If we found an existing record, update it
        await addIntake({
          id: existingIntake.id, // This will update the existing record
          medication_id: Number(medicationId),
          planned_time: plannedTime as string,
          datetime: new Date().toISOString(),
          taken: true,
          skipped: false,
        });
      } else {
        // If no existing record, create a new one
        await addIntake({
          medication_id: Number(medicationId),
          planned_time: plannedTime as string,
          datetime: new Date().toISOString(),
          taken: true,
          skipped: false,
        });
      }
      router.back();
    } catch (error) {
      console.error('Ошибка при отметке приёма:', error);
      Alert.alert('Ошибка', 'Не удалось отметить приём');
    }
  };

  const handleMarkAsSkipped = async () => {
    try {
      const existingIntake = findCurrentIntakeRecord();
      
      if (existingIntake) {
        // If we found an existing record, update it
        await addIntake({
          id: existingIntake.id, // This will update the existing record
          medication_id: Number(medicationId),
          planned_time: plannedTime as string,
          datetime: new Date().toISOString(),
          taken: false,
          skipped: true,
        });
      } else {
        // If no existing record, create a new one
        await addIntake({
          medication_id: Number(medicationId),
          planned_time: plannedTime as string,
          datetime: new Date().toISOString(),
          taken: false,
          skipped: true,
        });
      }
      router.back();
    } catch (error) {
      console.error('Ошибка при отметке пропуска:', error);
      Alert.alert('Ошибка', 'Не удалось отметить пропуск');
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const handleReschedule = () => {
    router.push(`/modals/reschedule-modal?medicationId=${medicationId}&plannedTime=${encodeURIComponent(plannedTime as string)}`);
  };

  const handleDelete = async () => {
    if (!medication) {
      Alert.alert('Ошибка', 'Не удалось загрузить информацию о лекарстве');
      return;
    }
    
    const medicationName = medication?.name || 'лекарство';
    Alert.alert(
      'Удалить лекарство?',
      `Вы уверены, что хотите удалить "${medicationName}"?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFutureIntakes(Number(medicationId));
              await deleteMedication(Number(medicationId));
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

  if (loading) {
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

  if (!medication) {
    return (
      <Provider>
        <Portal>
          <Modal visible={true} onDismiss={handleCancel}>
            <Card style={{ margin: 20, backgroundColor: '#1E1E1E' }}>
              <Card.Content>
                <Text style={{ color: 'white', textAlign: 'center' }}>Ошибка загрузки</Text>
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