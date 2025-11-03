import { Screen } from '@/components/screen';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link } from 'expo-router';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';

export default function Onboarding1() {
    const styles = useThemedStyles((theme) => ({
        wrapper: {
            flex: 1,
            justifyContent: 'space-between',
            padding: 20,
            backgroundColor: theme.colors.background,
        },
        main_container: {
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
            marginBottom: 40,
            lineHeight: 22,
            color: theme.colors.onBackground,
        },
        pagination: {
            flexDirection: 'row',
            justifyContent: 'center',
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
        nextButton: {
            marginTop: 20,
        },
        buttonRow: {
            gap: 8,
        },
    }));

    return (
        <Screen style={styles.wrapper}>
            <View style={styles.main_container}>
                <Text style={styles.title}>
                    Не забывайте принимать лекарства вовремя!
                </Text>
                <Text style={styles.subtitle}>
                    Наше приложение напомнит вам о каждом приёме лекарств —
                    даже если вы заняты, устали или в дороге.
                </Text>
                <View style={styles.pagination}>
                    <View style={[styles.dot, styles.activeDot]} />
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                </View>
            </View>

            <View style={styles.buttonRow}>
                <Link href="/onboarding/screen-2" asChild>
                    <Button mode="contained">Далее</Button>
                </Link>
                <Link href="/" asChild>
                    <Button
                        onPress={async () => {
                            await AsyncStorage.setItem(
                                'onboarding_viewed',
                                'true',
                            );
                        }}
                        mode="text"
                    >
                        Пропустить
                    </Button>
                </Link>
            </View>
        </Screen>
    );
}
