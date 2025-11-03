import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { Link } from 'expo-router';
import { Screen } from '@/components/screen';
import { useThemedStyles } from '@/hooks/use-themed-styles';

export default function Onboarding2() {
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
            marginBottom: 30,
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

    return (
        <Screen style={styles.wrapper}>
            <View style={styles.container}>
                <Text style={styles.title}>Напоминания под ваш график</Text>
                <Text style={styles.subtitle}>
                    Вы сами выбираете время, частоту и название препарата. Мы
                    будем напоминать — мягко, но надёжно.
                </Text>

                <View style={styles.icon}>
                    <Text style={{ fontSize: 60 }}>⏰</Text>
                </View>

                <View style={styles.pagination}>
                    <View style={styles.dot} />
                    <View style={[styles.dot, styles.activeDot]} />
                    <View style={styles.dot} />
                </View>
            </View>

            <View style={styles.buttonRow}>
                <Link href="/onboarding/screen-3" asChild>
                    <Button mode="contained">Далее</Button>
                </Link>
                <Link href="/onboarding/screen-1" asChild>
                    <Button mode="text">Назад</Button>
                </Link>
            </View>
        </Screen>
    );
}
