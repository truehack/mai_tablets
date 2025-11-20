// app/(auth)/register.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { View, Alert, Platform } from 'react-native';
import { AppBar } from '@/components/app-bar';
import { Screen } from '@/components/screen';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useRouter } from 'expo-router';
import { Button, TextInput, Text, HelperText } from 'react-native-paper';
import apiClient from '@/services/api';
import { saveLocalUser } from '@/services/localUser.service';
import { getLocalUser } from '@/services/localUser.service';

export default function RegisterScreen() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Автозаполнение для dev (не в prod)
  useEffect(() => {
    if (__DEV__ && Platform.OS === 'web') {
      setLogin('testuser123');
    }
  }, []);

  const styles = useThemedStyles((theme) => ({
    wrapper: {
      flex: 1,
      padding: 20,
      backgroundColor: theme.colors.background,
      justifyContent: 'space-between',
    },
    container: {
      gap: 16,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.colors.primary,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 15,
      color: theme.colors.onSurfaceVariant,
      lineHeight: 22,
    },
    inputContainer: {
      marginTop: 8,
    },
  }));

  const validateUsername = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return 'Обязательное поле';
    if (trimmed.length < 3) return 'Не короче 3 символов';
    if (trimmed.length > 32) return 'Не длиннее 32 символов';
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      return 'Только буквы, цифры, _ и -';
    }
    return null;
  };

  const handleRegister = useCallback(async () => {
    const validationError = validateUsername(login);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);

    try {
      setLoading(true);

      // 📡 Запрос к FastAPI (http://192.168.31.174:8000/auth/register)
      const response = await apiClient.post('/auth/register', {
        username: login.trim(),
      });

      const { uuid, password, username } = response;

      if (!uuid || !password) {
        throw new Error('Сервер не вернул UUID или пароль');
      }

      // 💾 Явное сохранение в SQLite (smartdoctor.db)
      await saveLocalUser({
        uuid,
        password,
        username,
      });

      // ✅ Успешно — показываем данные
      Alert.alert(
        '✅ Регистрация успешна',
        `Твой идентификатор:\n${uuid}\n\nПароль:\n${password}\n\n🔒 Сохранён в защищённой локальной базе.`,
        [
          {
            text: 'Перейти в приложение',
            onPress: () => {
              router.replace('/tabs/schedule');
            },
          },
        ],
      );
    } catch (e: any) {
      console.error('🚨 Ошибка регистрации:', {
        message: e.message,
        stack: e.stack,
        cause: e.cause,
      });

      let message = e.message || 'Не удалось зарегистрироваться';
      if (message.includes('Network request failed')) {
        message = 'Нет связи с сервером. Проверь Wi-Fi и что сервер запущен.';
      }

      Alert.alert('❌ Ошибка', message);
    } finally {
      setLoading(false);
    }
  }, [login, router]);

  return (
    <>
      <AppBar title="Регистрация" />
      <Screen header style={styles.wrapper}>
        <View style={styles.container}>
          <View>
            <Text style={styles.title}>Создай профиль</Text>
            <Text style={styles.subtitle}>
              Введи имя пользователя — мы создадим для тебя уникальный UUID и пароль.
              Данные хранятся локально и синхронизируются только при твоём согласии.
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              value={login}
              onChangeText={(text) => {
                setLogin(text);
                setError(null);
              }}
              label="Имя пользователя"
              mode="outlined"
              autoCapitalize="none"
              autoComplete="username"
              returnKeyType="done"
              error={!!error}
              onSubmitEditing={handleRegister}
            />
            {error ? (
              <HelperText type="error" visible>
                {error}
              </HelperText>
            ) : null}
          </View>
        </View>

        <Button
          mode="contained"
          onPress={handleRegister}
          loading={loading}
          disabled={loading || !login.trim()}
          style={{ marginTop: 16 }}
        >
          {loading ? 'Создаём...' : 'Зарегистрироваться'}
        </Button>
      </Screen>
    </>
  );
}