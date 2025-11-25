import { View, Text, StyleSheet, Button, TextInput, Alert, ActivityIndicator } from 'react-native';
import { AppBar } from '@/components/app-bar';
import { Screen } from '@/components/screen';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
// 🔑 Используем useFocusEffect для expo-router
import { useFocusEffect } from '@react-navigation/native';

import apiClient from '@/services/api';

export default function Profile() {
    const router = useRouter();
    const [screen, setScreen] = useState<'main' | 'generate' | 'enter'>('main');
    const [generatedCode, setGeneratedCode] = useState<string>('');
    const [expiresInSeconds, setExpiresInSeconds] = useState<number>(180);
    const [inviteCodeInput, setInviteCodeInput] = useState<string>('');
    const [loading, setLoading] = useState(false);

    // Связи (могут быть обе одновременно)
    const [medFriend, setMedFriend] = useState<{ uuid: string; username: string } | null>(null);
    const [patient, setPatient] = useState<{ uuid: string; username: string } | null>(null);

    // Обновление связей через API
    const refreshRelations = async () => {
        try {
            // Получаем мед-друга (для пациента)
            try {
                const res = await apiClient.getWithAuth('/friends/get-med-friend');
                if (res.uuid && res.uuid !== 'null' && res.uuid !== null) {
                    setMedFriend({ uuid: res.uuid, username: res.username || 'Пользователь' });
                } else {
                    setMedFriend(null);
                }
            } catch {
                setMedFriend(null);
            }

            // Получаем пациента (для мед-друга)
            try {
                const res = await apiClient.getWithAuth('/friends/get-patient');
                if (res.uuid && res.uuid !== 'null' && res.uuid !== null) {
                    setPatient({ uuid: res.uuid, username: res.username || 'Пользователь' });
                } else {
                    setPatient(null);
                }
            } catch {
                setPatient(null);
            }
        } catch (error) {
            console.warn('Ошибка обновления связей:', error);
        }
    };

    // 🔁 АВТООБНОВЛЕНИЕ ПРИ КАЖДОМ ВХОДЕ В ЭКРАН
    useFocusEffect(
        useCallback(() => {
            // Загружаем связи при фокусе
            const load = async () => {
                // Показываем loading только если данные ещё не загружены
                if (!medFriend && !patient) {
                    setLoading(true);
                }
                await refreshRelations();
                setLoading(false);
            };
            load();

            // Cleanup (если нужно)
            return () => {};
        }, [])
    );

    // === Генерация кода (только если нет пациента) ===
    const handleGenerateCode = async () => {
        if (patient) {
            Alert.alert('Недоступно', 'У вас уже есть пациент. Сначала отпишитесь.');
            return;
        }

        setLoading(true);
        try {
            const res = await apiClient.postWithAuth('/friends/invitation', {});
            setGeneratedCode(res.code);
            setExpiresInSeconds(res.expires_in_seconds);
            setScreen('generate');
        } catch (error: any) {
            Alert.alert('Ошибка', error.message || 'Не удалось сгенерировать код');
        } finally {
            setLoading(false);
        }
    };

    // === Ввод кода (только если нет мед-друга) ===
    const handleEnterCode = async () => {
        if (medFriend) {
            Alert.alert('Недоступно', 'У вас уже есть мед-друг. Сначала удалите текущего.');
            return;
        }

        const trimmed = inviteCodeInput.trim();
        if (trimmed.length !== 6 || isNaN(Number(trimmed))) {
            Alert.alert('Неверный формат', 'Код должен состоять из 6 цифр');
            return;
        }

        setLoading(true);
        try {
            await apiClient.postWithAuth('/friends/add', { code: trimmed });
            // Ждём, чтобы БД успела обновиться
            await new Promise(resolve => setTimeout(resolve, 300));
            await refreshRelations(); // Обновляем локально
            Alert.alert('✅ Успех', 'Мед-друг добавлен!');
            setScreen('main');
            setInviteCodeInput('');
        } catch (error: any) {
            Alert.alert('Ошибка', error.message || 'Неверный или просроченный код');
        } finally {
            setLoading(false);
        }
    };

    // === Удалить мед-друга (DELETE) ===
    const handleRemoveMedFriend = async () => {
        if (!medFriend) return;

        Alert.alert(
            'Подтверждение',
            `Вы уверены, что хотите удалить мед-друга "${medFriend.username}"?`,
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            await apiClient.deleteWithAuth('/friends/remove-for-patient');
                            await refreshRelations();
                            Alert.alert('✅', 'Мед-друг удалён.');
                        } catch (error: any) {
                            Alert.alert('Ошибка', error.message);
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    // === Отписаться от пациента (DELETE) ===
    const handleUnsubscribeFromPatient = async () => {
        if (!patient) return;

        Alert.alert(
            'Подтверждение',
            `Вы уверены, что хотите отписаться от пациента "${patient.username}"?`,
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Отписаться',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            await apiClient.deleteWithAuth('/friends/unsubscribe-from-patient');
                            await refreshRelations();
                            Alert.alert('✅', 'Вы отписались от пациента.');
                        } catch (error: any) {
                            Alert.alert('Ошибка', error.message);
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const goBack = () => {
        setScreen('main');
        setGeneratedCode('');
        setInviteCodeInput('');
    };

    return (
        <>
            <AppBar title="Профиль" />
            <View style={styles.container}>
                <Screen style={styles.screen}>
                    {loading && screen === 'main' && (
                        <View style={styles.overlay}>
                            <ActivityIndicator size="large" color="#4DA1FF" />
                            <Text style={styles.loadingText}>Загрузка...</Text>
                        </View>
                    )}

                    {/* === ОСНОВНОЙ ЭКРАН === */}
                    {screen === 'main' && (
                        <>
                            <View style={styles.avatar} />
                            <Text style={styles.welcome}>Добро пожаловать!</Text>
                            <Text style={styles.subtitle}>
                                Medisafe заботится о вашем здоровье — просто и надёжно.
                            </Text>

                            {/* Мед-друг */}
                            {medFriend ? (
                                <View style={styles.statusBox}>
                                    <Text style={styles.statusText}>
                                        👩‍⚕️ Мед-друг: <Text style={styles.name}>{medFriend.username}</Text>
                                    </Text>
                                    <View style={styles.buttonDelete}>
                                        <Button
                                            title="Удалить мед-друга"
                                            onPress={handleRemoveMedFriend}
                                            color="#FF6B6B"
                                        />
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.buttonSpacing}>
                                    <Button
                                        title="Ввести код приглашения"
                                        onPress={() => setScreen('enter')}
                                        disabled={loading}
                                    />
                                </View>
                            )}

                            {/* Пациент */}
                            {patient ? (
                                <View style={[styles.statusBox, { marginTop: 16 }]}>
                                    <Text style={styles.statusText}>
                                        🧑 Пациент: <Text style={styles.name}>{patient.username}</Text>
                                    </Text>
                                    <View style={styles.buttonDelete}>
                                        <Button
                                            title="Отписаться от пациента"
                                            onPress={handleUnsubscribeFromPatient}
                                            color="#FF6B6B"
                                        />
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.buttonSpacing}>
                                    <Button
                                        title="Сгенерировать код"
                                        onPress={handleGenerateCode}
                                        disabled={loading}
                                    />
                                </View>
                            )}
                        </>
                    )}

                    {/* Экран: Сгенерированный код */}
                    {screen === 'generate' && (
                        <>
                            <Text style={styles.sectionTitle}>Ваш код</Text>
                            <View style={styles.codeBox}>
                                <Text style={styles.codeText}>{generatedCode}</Text>
                            </View>
                            <Text style={styles.hint}>
                                Действует {Math.ceil(expiresInSeconds / 60)} мин.
                            </Text>

                            <View style={[styles.buttonSpacing, { marginTop: 24 }]}>
                                <Button
                                    title="Сгенерировать новый"
                                    onPress={handleGenerateCode}
                                    disabled={loading}
                                />
                            </View>
                            <View style={styles.buttonSpacing}>
                                <Button title="Готово" onPress={goBack} />
                            </View>
                        </>
                    )}

                    {/* Экран: Ввод кода */}
                    {screen === 'enter' && (
                        <>
                            <Text style={styles.sectionTitle}>Введите код</Text>
                            <Text style={styles.hint}>6 цифр от вашего друга</Text>

                            <TextInput
                                style={styles.input}
                                value={inviteCodeInput}
                                onChangeText={setInviteCodeInput}
                                placeholder="123456"
                                keyboardType="number-pad"
                                maxLength={6}
                                editable={!loading}
                            />

                            <View style={styles.buttonSpacing}>
                                <Button
                                    title="Подключиться"
                                    onPress={handleEnterCode}
                                    disabled={loading}
                                />
                            </View>
                            <View style={styles.buttonSpacing}>
                                <Button title="Отмена" onPress={goBack} color="#888" />
                            </View>
                        </>
                    )}
                </Screen>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#001F4D' },
    screen: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 31, 77, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    loadingText: {
        color: '#FFFFFF',
        marginTop: 10,
        fontSize: 16,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#555555',
        marginBottom: 24,
    },
    welcome: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 6,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#B0C4DE',
        textAlign: 'center',
        marginBottom: 32,
        paddingHorizontal: 30,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 12,
        textAlign: 'center',
    },
    hint: {
        fontSize: 14,
        color: '#A0B8D8',
        textAlign: 'center',
        marginBottom: 20,
    },
    codeBox: {
        backgroundColor: '#00305A',
        borderRadius: 10,
        paddingVertical: 16,
        paddingHorizontal: 24,
        marginBottom: 20,
        minWidth: 180,
    },
    codeText: {
        fontSize: 30,
        fontWeight: '800',
        color: '#4DA1FF',
        textAlign: 'center',
        letterSpacing: 4,
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
        fontSize: 18,
        width: '100%',
        textAlign: 'center',
        marginBottom: 24,
        fontWeight: '600',
    },
    buttonSpacing: {
        marginTop: 12,
        width: '100%',
    },
    statusBox: {
        backgroundColor: '#2E5A3A',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 10,
        width: '100%',
        alignItems: 'center',
    },
    statusText: {
        color: '#E0F7FA',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    name: {
        color: '#4DA1FF',
        fontWeight: 'bold',
    },
    buttonDelete: {
        marginTop: 8,
        width: '80%',
    },
});