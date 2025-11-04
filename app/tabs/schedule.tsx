import AsyncStorage from '@react-native-async-storage/async-storage';

import { Screen } from '@/components/screen';
import { useDatabase } from '@/hooks/use-database';
import { Link } from 'expo-router';
import { Button, Text } from 'react-native-paper';

export default function Index() {
    const db = useDatabase();

    return (
        <Screen
            style={{
                padding: 20,
                gap: 16,
            }}
        >
            <Text>Главный экран</Text>
            <Button
                onPress={async () => {
                    AsyncStorage.clear();
                }}
            >
                Сбросить AsyncStorage
            </Button>
            <Button
                onPress={async () => {
                    db.resetDatabase();
                }}
            >
                Сбросить Базу данных
            </Button>
            <Link replace href="/" asChild>
                <Button>Перейти на /</Button>
            </Link>
        </Screen>
    );
}
