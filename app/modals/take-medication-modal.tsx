// app/modals/take-medication-modal.tsx

import React from 'react';
import { View, Text, Alert } from 'react-native';
import { Card, Button, Portal, Modal, Provider } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDatabase } from '@/hooks/use-database';

export default function TakeMedicationModal() {
    const { medicationId, plannedTime } = useLocalSearchParams();
    const router = useRouter();
    const { addIntake } = useDatabase();

    const handleMarkAsTaken = async () => {
        try {
            await addIntake({
                medication_id: Number(medicationId),
                planned_time: plannedTime as string,
                datetime: new Date().toISOString(),
                taken: true,
                skipped: false,
            });
            Alert.alert('Успех', 'Лекарство отмечено как принятое!');
            router.back();
        } catch (error) {
            console.error('Ошибка при отметке приёма:', error);
            Alert.alert('Ошибка', 'Не удалось отметить лекарство');
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
            Alert.alert('Успех', 'Лекарство отмечено как пропущенное.');
            router.back();
        } catch (error) {
            console.error('Ошибка при отметке пропуска:', error);
            Alert.alert('Ошибка', 'Не удалось отметить лекарство');
        }
    };

    const handleCancel = () => {
        router.back();
    };

    return (
        <Provider>
            <Portal>
                <Modal visible={true} onDismiss={handleCancel}>
                    <Card style={{ margin: 20, backgroundColor: '#1E1E1E' }}>
                        <Card.Content>
                            <Text style={{ color: 'white', fontSize: 18, marginBottom: 16 }}>
                                Отметить статус лекарства:
                            </Text>
                            <Button
                                mode="contained"
                                onPress={handleMarkAsTaken}
                                buttonColor="#34C759"
                                textColor="white"
                                style={{ marginBottom: 10 }}
                            >
                                Принято
                            </Button>
                            <Button
                                mode="contained"
                                onPress={handleMarkAsSkipped}
                                buttonColor="#FF3B30"
                                textColor="white"
                                style={{ marginBottom: 10 }}
                            >
                                Пропущено
                            </Button>
                            <Button
                                mode="contained" // ✅ Заменили outlined на contained
                                onPress={handleCancel}
                                buttonColor="#4A3AFF"
                                textColor="white"
                            >
                                Отмена
                            </Button>
                        </Card.Content>
                    </Card>
                </Modal>
            </Portal>
        </Provider>
    );
}