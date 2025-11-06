import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { View, FlatList, TouchableOpacity } from 'react-native';
import { Text, Card, FAB } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/screen';
import { useDatabase, Medication } from '@/hooks/use-database';

export default function Schedule() {
    const router = useRouter();
    const { getMedications } = useDatabase();
    const [medications, setMedications] = useState<Medication[]>([]);
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
    }, [getMedications, selectedDay]);


    useFocusEffect(
        useCallback(() => {
            loadMeds();
        }, [loadMeds])
    );

    // helper: weekday string from date (ПН..ВС)
    const weekdayFromDate = (dateStr?: string): string | null => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        const idx = (d.getDay() + 6) % 7; // shift so Monday=0
        return days[idx];
    };

    // main predicate: попадет ли med на selectedDay
    const isMedForDay = (m: Medication, day: string) => {
        if (!day) return true;
        if (m.schedule_type === 'daily') return true;

        if (m.schedule_type === 'weekly_days') {
            // если есть weekly_days как массив — используем его
            if (Array.isArray(m.weekly_days) && m.weekly_days.length) {
                return m.weekly_days.includes(day);
            }
            // если weekly_days отсутствует или пустой — fallback на start_date weekday
            const w = weekdayFromDate(m.start_date);
            return w === day;
        }

        if (m.schedule_type === 'every_x_days') {
            // если есть interval_days и start_date — вычисляем по разнице дней
            if (!m.start_date || !m.interval_days) return false;
            const start = new Date(m.start_date);
            if (isNaN(start.getTime())) return false;
            // считаем, попадает ли выбранный день в последовательность
            // Найдём ближайшую дату для выбранного weekday на текущей неделе,
            // затем считаем diff в днях от start до этой даты и проверяем делимость.
            // Для простоты возьмём текущую дату, найдем её индекс недели и сравним.
            const today = new Date();
            // Найдём любую дату, соответствующую selectedDay — возьмём ближайшую в пределах +/-7 дней от today
            let target: Date | null = null;
            for (let delta = -7; delta <= 7; delta++) {
                const cand = new Date();
                cand.setDate(today.getDate() + delta);
                const candWeekday = days[(cand.getDay() + 6) % 7];
                if (candWeekday === day) {
                    target = cand;
                    break;
                }
            }
            if (!target) return false;
            const diffDays = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) return false;
            return diffDays % Number(m.interval_days) === 0;
        }

        return false;
    };

    const filteredMeds = useMemo(() => {
        const dayIndex = days.indexOf(selectedDay); // 0–6
        return medications.filter((m) => {
            // Преобразуем дату начала в день недели
            const start = new Date(m.start_date);
            if (isNaN(start.getTime())) return false;

            const medDay = (start.getDay() + 6) % 7; // чтобы ПН был первым
            const isSameDay = medDay === dayIndex;

            if (m.schedule_type === 'daily') {
                // daily → показываем только если совпадает день старта
                return isSameDay;
            }

            if (m.schedule_type === 'weekly_days' && m.weekly_days) {
                try {
                    const daysList =
                        typeof m.weekly_days === 'string'
                            ? JSON.parse(m.weekly_days)
                            : m.weekly_days;
                    return daysList.includes(selectedDay);
                } catch {
                    return false;
                }
            }

            if (m.schedule_type === 'every_x_days' && m.start_date) {
                const diff =
                    (new Date().getTime() - start.getTime()) / (1000 * 3600 * 24);
                return diff % (m.interval_days ?? 1) === 0;
            }

            return false;
        });
    }, [medications, selectedDay]);


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

                    // вычисляем дату для этого дня относительно текущей недели
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
                    const status = 'Не принято';
                    const statusColor = '#FF3B30';
                    const times =
                        typeof item.times_list === 'string'
                            ? item.times_list
                            : Array.isArray(item.times_list)
                                ? item.times_list.join(', ')
                                : '—';
                    const icon =
                        item.form === 'tablet' ? '💊' : item.form === 'drop' ? '💧' : item.form === 'spray' ? '🧴' : '❓';

                    return (
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
                    );
                }}
                ListEmptyComponent={<Text style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>Нет медикаментов на {selectedDay}.</Text>}
            />

            <FAB icon="plus" onPress={() => router.push('/modals/add')} style={{ position: 'absolute', right: 16, bottom: 16, backgroundColor: '#4A3AFF' }} />
        </Screen>
    );
}



