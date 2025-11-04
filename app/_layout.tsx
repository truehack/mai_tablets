import { Stack } from 'expo-router';
import {
    adaptNavigationTheme,
    MD3DarkTheme,
    MD3LightTheme,
    PaperProvider,
} from 'react-native-paper';
import {
    DarkTheme as NavigationDarkTheme,
    DefaultTheme as NavigationLightTheme,
    ThemeProvider,
} from '@react-navigation/native';
import { useColorScheme, View } from 'react-native';

export default function RootLayout() {
    const { LightTheme: RNLightTheme, DarkTheme: RNDarkTheme } =
        adaptNavigationTheme({
            reactNavigationLight: NavigationLightTheme,
            reactNavigationDark: NavigationDarkTheme,
        });

    const LightTheme = {
        paper: MD3LightTheme,
        router: RNLightTheme,
    };

    const DarkTheme = {
        paper: MD3DarkTheme,
        router: RNDarkTheme,
    };

    const theme = useColorScheme() === 'dark' ? DarkTheme : LightTheme;

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
