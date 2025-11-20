// app/onboarding/screen-1.tsx
import { Screen } from '@/components/screen';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link } from 'expo-router';
import { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
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
      fontSize: 28,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: 16,
      color: theme.colors.primary,
      lineHeight: 34,
    },
    subtitle: {
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 40,
      lineHeight: 24,
      color: theme.colors.onSurfaceVariant,
    },
    pagination: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 32,
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
      gap: 10,
    },
    skipButton: {
      // Стиль применится через labelStyle у Button (react-native-paper)
    },
  }));

  const handleSkip = useCallback(async () => {
    await AsyncStorage.setItem('onboarding_viewed', 'true');
  }, []);

  return (
    <Screen style={styles.wrapper}>
      <View style={styles.main_container}>
        <Text style={styles.title}>
          💊 Не забывайте — лекарства работают только при регулярном приёме!
        </Text>
        <Text style={styles.subtitle}>
          MAI Tablets напомнит о каждом приёме ⏰ — даже если вы устали, заняты или в дороге.{'\n'}
          Все данные хранятся локально. Синхронизация — только по вашему выбору. 🧠
        </Text>

        <View style={styles.pagination}>
          <View style={[styles.dot, styles.activeDot]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </View>

      <View style={styles.buttonRow}>
        <Link href="/onboarding/screen-2" asChild>
          <Button
            mode="contained"
            style={styles.nextButton}
            contentStyle={{ paddingVertical: 12 }}
            labelStyle={{ fontWeight: '600' }}
          >
            Далее
          </Button>
        </Link>

        <Link href="/" asChild>
          <Button
            onPress={handleSkip}
            mode="text"
            labelStyle={[
              styles.skipButton,
              { color: '#888', fontWeight: '500', fontSize: 15 },
            ]}
          >
            Пропустить →
          </Button>
        </Link>
      </View>
    </Screen>
  );
}