// app/_layout.tsx
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationLightTheme,
  ThemeProvider,
} from '@react-navigation/native';
import {
  adaptNavigationTheme,
  MD3DarkTheme,
  PaperProvider
} from 'react-native-paper';

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

const { LightTheme: RNLightTheme, DarkTheme: RNDarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationLightTheme,
  reactNavigationDark: NavigationDarkTheme,
});

const AppDarkTheme = {
  paper: DarkTheme,
  router: RNDarkTheme,
};

export default function RootLayout() {
  return (
    <ThemeProvider value={AppDarkTheme.router}>
      <PaperProvider theme={AppDarkTheme.paper}>
        <Stack
          screenOptions={{
            animation: 'fade',
            headerShown: false,
            headerStyle: { backgroundColor: '#121212' },
            headerTitleStyle: { fontWeight: '600' },
            headerTintColor: '#fff',
          }}
        >
          {/* ✅ Исправлено: login/index вместо (auth) */}
          <Stack.Screen 
            name="login/index" 
            options={{ 
              headerShown: false,
              title: 'Регистрация',
            }} 
          />

          <Stack.Screen 
            name="tabs" 
            options={{ 
              headerShown: false,
            }} 
          />

          {/* Модальные экраны */}
          <Stack.Screen
            name="modals/take-medication-modal"
            options={{
              presentation: 'transparentModal',
              animation: 'fade',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="modals/add"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              headerShown: false,
            }}
          />
        </Stack>
      </PaperProvider>
    </ThemeProvider>
  );
}