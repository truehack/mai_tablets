import { View, Text, StyleSheet, Button } from 'react-native';
import { AppBar } from '@/components/app-bar';
import { Screen } from '@/components/screen';
import { useRouter } from 'expo-router';

export default function MedFriend() {
    const router = useRouter();

    return (
        <>
            <AppBar title="Профиль мед. друга" />
            <View style={styles.container}>
                <Screen style={styles.screen}>
                    <View style={styles.avatar} />
                    <Text style={styles.welcome}>Добро пожаловать, мед. друг!</Text>
                    <Button title="Вернуться в мой профиль" onPress={() => router.push('/tabs/profile')} />
                </Screen>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#001F4D' },
    screen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#777777', marginBottom: 24 },
    welcome: { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 16, textAlign: 'center' },
});
