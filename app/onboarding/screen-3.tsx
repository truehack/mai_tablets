// app/onboarding/screen-3.tsx
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
      marginBottom: 36,
      lineHeight: 24,
      color: theme.colors.onSurfaceVariant,
    },
    icon: {
      marginBottom: 32,
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
  }));

  const handlePass = useCallback(async () => {
    await AsyncStorage.setItem('onboarding_viewed', 'true');
  }, []);

  return (
    <Screen style={styles.wrapper}>
      <View style={styles.container}>
        <Text style={styles.title}>
          ✅ Готово! Ваш помощник — MAI Tablets
        </Text>
        <Text style={styles.subtitle}>
          Теперь вы всегда в курсе приёма лекарств.{'\n'}
          Всё под контролем: данные — только у вас.{'\n'}
          Никакой автоматической синхронизации. Только ваш выбор. 🧠🩺🔐
        </Text>

        <View style={styles.icon}>
          <Text style={{ fontSize: 64, lineHeight: 64 }}>✅</Text>
        </View>

        <View style={styles.pagination}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={[styles.dot, styles.activeDot]} />
        </View>
      </View>

      <View style={styles.buttonRow}>
        <Link href="/" asChild>
          <Button
            mode="contained"
            onPress={handlePass}
            contentStyle={{ paddingVertical: 12 }}
            labelStyle={{ fontWeight: '600' }}
          >
            Начать использовать MAI Tablets
          </Button>
        </Link>

        <Link href="/onboarding/screen-2" asChild>
          <Button
            mode="text"
            labelStyle={{ color: '#888', fontWeight: '500', fontSize: 15 }}
          >
            ← Назад
          </Button>
        </Link>
      </View>
    </Screen>
  );
}