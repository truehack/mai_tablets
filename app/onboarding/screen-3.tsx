import { Screen } from '@/components/screen';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';

export default function Onboarding3() {
    const styles = useThemedStyles((theme) => ({
        wrapper: {
            flex: 1,
            justifyContent: 'space-between',
            padding: 20,
            backgroundColor: theme.colors.background,
        },
        container: {
            alignItems: 'center',
            flex: 1,
            justifyContent: 'center',
        },
        title: {
            fontSize: 26,
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: 20,
            color: theme.colors.onBackground,
        },
        subtitle: {
            fontSize: 16,
            textAlign: 'center',
            marginBottom: 30,
            lineHeight: 22,
            color: theme.colors.onBackground,
        },
        icon: {
            marginBottom: 30,
        },
        pagination: {
            flexDirection: 'row',
            marginBottom: 40,
        },
        dot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.colors.surfaceDisabled,
            marginHorizontal: 4,
        },
        activeDot: {
            backgroundColor: theme.colors.primary,
        },
        buttonRow: {
            gap: 8,
        },
    }));

    const handlePass = useCallback(async () => {
        await AsyncStorage.setItem('onboarding_viewed', 'true');
    }, []);

    return (
        <Screen style={styles.wrapper}>
            <View style={styles.container}>
                <Text style={styles.title}>Всё готово!</Text>
                <Text style={styles.subtitle}>
                    Теперь вы всегда будете в курсе приёма лекарств. Здоровье —
                    в ваших руках!
                </Text>

                <View style={styles.icon}>
                    <Text style={{ fontSize: 60 }}>✅</Text>
                </View>

                <View style={styles.pagination}>
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                    <View style={[styles.dot, styles.activeDot]} />
                </View>
            </View>

            <View style={styles.buttonRow}>
                <Link href="/" asChild>
                    <Button mode="contained" onPress={handlePass}>
                        Начать использовать
                    </Button>
                </Link>
                <Link href="/onboarding/screen-2" asChild>
                    <Button mode="text">Назад</Button>
                </Link>
            </View>
        </Screen>
    );
}
