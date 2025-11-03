import { AppBar } from '@/components/app-bar';
import { Screen } from '@/components/screen';
import { useDatabase } from '@/hooks/use-database';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';

export default function Login() {
    const router = useRouter();
    const db = useDatabase();

    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [visible, setVisible] = useState(false);

    const styles = useThemedStyles((theme) => ({
        wrapper: {
            padding: 20,
            backgroundColor: theme.colors.background,
            justifyContent: 'space-between',
        },
        container: {
            gap: 8,
        },
    }));

    const handleLogin = useCallback(async () => {
        await db.setLocalUser({
            patient_uuid: `UUID-${login}`,
            patient_password_hash: `PASSWORD-HASH-${password}`,
        });
        router.replace('/')
    }, [db, password, login]);

    return (
        <>
            <AppBar title="Войдите в аккаунт" />
            <Screen header style={styles.wrapper}>
                <View style={styles.container}>
                    <TextInput
                        value={login}
                        onChangeText={setLogin}
                        label="Логин"
                        mode="outlined"
                    />
                    <TextInput
                        secureTextEntry={!visible}
                        right={
                            <TextInput.Icon
                                icon={visible ? 'eye-off' : 'eye'}
                                onPress={() => setVisible(!visible)}
                            />
                        }
                        value={password}
                        onChangeText={setPassword}
                        label="Пароль"
                        mode="outlined"
                    />
                </View>
                <Button mode="contained" onPress={handleLogin}>
                    Войти
                </Button>
            </Screen>
        </>
    );
}
