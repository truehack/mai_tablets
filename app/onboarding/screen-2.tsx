// app/onboarding/screen-2.tsx
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

  return (
    <Screen style={styles.wrapper}>
      <View style={styles.container}>
        <Text style={styles.title}>
          ⏰ Напоминания под ваш график — и только под ваш
        </Text>
        <Text style={styles.subtitle}>
          В MAI Tablets вы сами решаете: когда, как часто и какие препараты отслеживать.{'\n'}
          Напоминания — мягкие, но надёжные.{'\n'}
          Данные — только у вас. Синхронизация — только по вашему выбору. 🧠
        </Text>

        <View style={styles.icon}>
          <Text style={{ fontSize: 64, lineHeight: 64 }}>⏰</Text>
        </View>

        <View style={styles.pagination}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.activeDot]} />
          <View style={styles.dot} />
        </View>
      </View>

      <View style={styles.buttonRow}>
        <Link href="/onboarding/screen-3" asChild>
          <Button
            mode="contained"
            contentStyle={{ paddingVertical: 12 }}
            labelStyle={{ fontWeight: '600' }}
          >
            Далее
          </Button>
        </Link>

        <Link href="/onboarding/screen-1" asChild>
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