import AsyncStorage from '@react-native-async-storage/async-storage';

import { LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { useDatabase } from '@/hooks/use-database';
import { useLoading } from '@/hooks/use-loading';
import { Link, useRouter } from 'expo-router';
import { Button, Text } from 'react-native-paper';

export default function Index() {
    const router = useRouter();
    const db = useDatabase();

    const { loading } = useLoading({
        tasks: [
            async () => {
                if (
                    (await AsyncStorage.getItem('onboarding_viewed')) !== 'true'
                ) {
                    router.navigate('/onboarding/screen-1');
                    return false;
                }
            },
            async () => {
                if (
                    !(await db.getLocalUser())
                ) {
                    router.navigate('/login');
                    return false;
                }
            },
        ],
    });

    if (loading || db.loading) return <LoadingScreen />;

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
