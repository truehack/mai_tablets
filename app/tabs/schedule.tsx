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
            console.log('--- LOADED MEDS ---');
            meds.forEach(m => {
                console.log({
                    id: m.id,
                    name: m.name,
                    schedule_type: m.schedule_type,
                    weekly_days: m.weekly_days,
                    start_date: m.start_date,
                    times_list: m.times_list,
                });
            });
            console.log('--- SELECTED DAY ---', selectedDay);
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

    const getTodayIntakeStatus = (medicationId: number) => {
        const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
        const todayIntakes = intakeHistory.filter(
            intake =>
                intake.medication_id === medicationId &&
                intake.datetime.startsWith(today)
        );
        const lastIntake = todayIntakes[0]; // последняя запись за сегодня
        return lastIntake ? (lastIntake.taken ? 'Принято' : 'Пропущено') : 'Не принято';
    };

    const filteredMeds = useMemo(() => {
        return medications.filter((m) => {
            if (!m.start_date) return false;
            const start = new Date(m.start_date);
            if (isNaN(start.getTime())) return false;

            // Ежедневные лекарства: показываем каждый день, но только после даты начала
            if (m.schedule_type === 'daily') {
                const today = new Date();
                const todayStr = today.toISOString().split('T')[0];
                const startStr = start.toISOString().split('T')[0];
                return startStr <= todayStr;
            }

            if (m.schedule_type === 'weekly_days' && m.weekly_days) {
                try {
                    const daysList =
                        typeof m.weekly_days === 'string'
                            ? JSON.parse(m.weekly_days)
                            : m.weekly_days;
                    return Array.isArray(daysList) && daysList.includes(selectedDay);
                } catch {
                    return false;
                }
            }

            if (m.schedule_type === 'every_x_days' && m.start_date && m.interval_days) {
                const today = new Date();
                const todayIdx = (today.getDay() + 6) % 7; // ПН = 0
                const monday = new Date(today);
                monday.setDate(today.getDate() - todayIdx);
                const targetDate = new Date(monday);
                const dayIndex = days.indexOf(selectedDay);
                if (dayIndex === -1) return false;
                targetDate.setDate(monday.getDate() + dayIndex);

                const diffMs = targetDate.getTime() - start.getTime();
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                if (diffDays < 0) return false;
                return diffDays % m.interval_days === 0;
            }

            return false;
        });
    }, [medications, selectedDay, days]);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#ccc' }}>Загрузка...</Text>
            </View>
        );
    }

    return (
        <Screen style={{ flex: 1, backgroundColor: '#121212', paddingHorizontal: 16, paddingTop: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                {days.map((day, idx) => {
                    const isSelected = selectedDay === day;

                    const today = new Date();
                    const todayIdx = (today.getDay() + 6) % 7; // ПН = 0
                    const monday = new Date(today);
                    monday.setDate(today.getDate() - todayIdx); // получаем понедельник текущей недели
                    const dateForDay = new Date(monday);
                    dateForDay.setDate(monday.getDate() + idx);
                    const dateNum = dateForDay.getDate();

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
                                <Text style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>{dateNum}</Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <FlatList
                data={filteredMeds}
                extraData={selectedDay}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => {
                    const status = getTodayIntakeStatus(item.id);
                    const statusColor = status === 'Принято' ? '#34C759' : status === 'Пропущено' ? '#FF9500' : '#FF3B30';
                    const times =
                        typeof item.times_list === 'string'
                            ? item.times_list
                            : Array.isArray(item.times_list)
                                ? item.times_list.join(', ')
                                : '—';
                    const icon =
                        item.form === 'tablet' ? '💊' : item.form === 'drop' ? '💧' : item.form === 'spray' ? '🧴' : '❓';

                    return (
                        <TouchableOpacity
                            onPress={() => router.push(`/modals/take-medication-modal?medicationId=${item.id}&plannedTime=${encodeURIComponent(times)}`)}
                        >
                            <View style={{ marginBottom: 16 }}>
                                <Text style={{ color: '#aaa', marginBottom: 4, fontSize: 14, fontWeight: '600' }}>
                                    {times} <Text style={{ color: statusColor, fontWeight: '500' }}>{status}</Text>
                                </Text>

                                <Card mode="contained" style={{ backgroundColor: '#1E1E1E', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#2C2C2C', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                            <Text style={{ fontSize: 20 }}>{icon}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 2 }}>{item.name}</Text>
                                            <Text style={{ color: '#ccc', fontSize: 13 }}>{item.form || '—'}</Text>
                                        </View>
                                    </View>
                                </Card>
                            </View>
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={<Text style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>Нет медикаментов на {selectedDay}.</Text>}
            />

            <FAB icon="plus" onPress={() => router.push('/modals/add')} style={{ position: 'absolute', right: 16, bottom: 16, backgroundColor: '#4A3AFF' }} />
        </Screen>
    );
}