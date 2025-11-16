import React, { useState, useCallback } from 'react';
import { View, Alert } from 'react-native';
import { AppBar } from '@/components/app-bar';
import { Screen } from '@/components/screen';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useRouter } from 'expo-router';
import { Button, TextInput, Text } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '@/services/api';

export default function Login() {
  const router = useRouter();

  const [login, setLogin] = useState('');
  const [loading, setLoading] = useState(false);

  const styles = useThemedStyles((theme) => ({
    wrapper: {
      flex: 1,
      padding: 20,
      backgroundColor: theme.colors.background,
      justifyContent: 'space-between',
    },
    container: {
      gap: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.onBackground,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant ?? '#aaa',
      marginBottom: 16,
    },
  }));

  const handleRegister = useCallback(async () => {
    if (!login.trim()) {
      Alert.alert('Ошибка', 'Пожалуйста, введите имя пользователя.');
      return;
    }

    try {
      setLoading(true);

      const data = await apiClient.post('/auth/register', {
        username: login.trim(),
      });

      const { uuid, password } = data;

      if (!uuid || !password) {
        throw new Error('Некорректный ответ сервера');
      }

      await AsyncStorage.setItem('userUuid', uuid);
      await AsyncStorage.setItem('userPassword', password);

      Alert.alert(
        'Регистрация успешна',
        `Твой UUID:\n${uuid}\n\nПароль:\n${password}\n\nСохрани их в надёжном месте, это доступ к аккаунту.`,
        [
          {
            text: 'Ок',
            onPress: () => {
              router.replace('/(tabs)/schedule');
            },
          },
        ],
      );
    } catch (e: any) {
      console.error('Ошибка регистрации:', e);
      Alert.alert('Ошибка', e.message || 'Не удалось зарегистрироваться, попробуй позже.');
    } finally {
      setLoading(false);
    }
  }, [login, router]);

  return (
    <>
      <AppBar title="Регистрация" />
      <Screen header style={styles.wrapper}>
        <View style={styles.container}>
          <Text style={styles.title}>Создай профиль</Text>
          <Text style={styles.subtitle}>
            Введи имя пользователя — мы создадим для тебя уникальный UUID и пароль.
          </Text>

          <TextInput
            value={login}
            onChangeText={setLogin}
            label="Имя пользователя"
            mode="outlined"
            autoCapitalize="none"
          />
        </View>

        <Button
          mode="contained"
          onPress={handleRegister}
          loading={loading}
          disabled={loading}
        >
          Зарегистрироваться
        </Button>
      </Screen>
    </>
  );
}



