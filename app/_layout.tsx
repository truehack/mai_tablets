import { Stack } from 'expo-router';
import { useColorScheme, View } from 'react-native';
import {
    DarkTheme as NavigationDarkTheme,
    DefaultTheme as NavigationLightTheme,
    ThemeProvider,
} from '@react-navigation/native';
import {
    adaptNavigationTheme,
    MD3DarkTheme,
    MD3LightTheme,
    PaperProvider
} from 'react-native-paper';

const LightTheme = {
    ...MD3LightTheme
}

const DarkTheme = {
    ...MD3DarkTheme,
    colors: {
        ...MD3DarkTheme.colors,
        background: '#121212',
        surface: '#121212',
        onSurface: 'white',
        primary: '#4A3AFF',
        onPrimary: 'white',
        outline: '#323232',
    },
};

export default function RootLayout() {
    const { LightTheme: RNLightTheme, DarkTheme: RNDarkTheme } =
        adaptNavigationTheme({
            reactNavigationLight: NavigationLightTheme,
            reactNavigationDark: NavigationDarkTheme,
        });

    const AppDarkTheme = {
        paper: {
            ...MD3DarkTheme,
            colors: {
                ...MD3DarkTheme.colors,
                background: '#121212',
                surface: '#121212',
                onSurface: 'white',
                primary: '#4A3AFF',
                onPrimary: 'white',
                outline: '#323232',
            },
        },
        router: RNDarkTheme,
    };

    const theme = AppDarkTheme; // 👈 теперь всегда тёмная тема

    return (
        <ThemeProvider value={theme.router}>
            <PaperProvider theme={theme.paper}>
                <View
                    style={{
                        flex: 1,
                        backgroundColor: theme.paper.colors.background,
                    }}
                >
                    <Stack screenOptions={{ headerShown: false }} />
                </View>
            </PaperProvider>
        </ThemeProvider>
    );
}
