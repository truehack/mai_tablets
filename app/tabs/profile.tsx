import { View, Text, StyleSheet, Button } from 'react-native';
import { AppBar } from '@/components/app-bar';
import { Screen } from '@/components/screen';
import { useDatabase } from '@/hooks/use-database';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

export default function Profile() {
    const db = useDatabase();
    const router = useRouter();
    const [login, setLogin] = useState<string | null>(null);

    useEffect(() => {
        async function fetchUser() {
            const localUser = await db.getLocalUser();
            if (localUser) {
                const cleanLogin = localUser.patient_uuid.replace(/^UUID-/, '');
                setLogin(cleanLogin);
            }
        }
        fetchUser();
    }, [db]);

    return (
        <>
            <AppBar title="Профиль" />
            <View style={styles.container}>
                <Screen style={styles.screen}>
                    <View style={styles.avatar} />
                    <Text style={styles.welcome}>Добро пожаловать!</Text>
                    <Text style={styles.login}>{login ?? 'Загрузка...'}</Text>

                    {/* Кнопка переключения на мед. друга */}
                    <Button
                        title="Переключить на мед. друга"
                        onPress={() => router.push('/medfriend')}
                    />

                    {/* Кнопка показать код приглашения */}
                    <View style={{ marginTop: 16 }}>
                        <Button
                            title="Показать код приглашения"
                            onPress={() => router.push('/invite-code')}
                        />
                    </View>
                </Screen>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#001F4D' },
    screen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'transparent' },
    avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#555555', marginBottom: 24 },
    welcome: { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8, textAlign: 'center' },
    login: { fontSize: 24, color: '#4DA1FF', fontWeight: '600', marginBottom: 24, textAlign: 'center' },
});








