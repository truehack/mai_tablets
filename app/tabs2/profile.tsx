import { View, Text, StyleSheet } from 'react-native';
import { AppBar } from '@/components/app-bar';
import { Screen } from '@/components/screen';
import { useDatabase } from '@/hooks/use-database';
import { useEffect, useState } from 'react';

export default function Profile() {
    const db = useDatabase();
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
                    {/* Серая аватарка */}
                    <View style={styles.avatar} />
                    {/* Приветствие */}
                    <Text style={styles.welcome}>Добро пожаловать!</Text>
                    {/* Логин пользователя */}
                    <Text style={styles.login}>{login ?? 'Загрузка...'}</Text>
                </Screen>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#001F4D', // тёмно-синий фон
    },
    screen: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'transparent',
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#555555', // серая аватарка
        marginBottom: 24,
    },
    welcome: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 8,
        textAlign: 'center',
    },
    login: {
        fontSize: 24,
        color: '#4DA1FF',
        fontWeight: '600',
        textAlign: 'center',
    },
});







