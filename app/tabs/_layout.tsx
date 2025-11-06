import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';

export const tabs = [
  { name: 'Расписание', path: 'schedule', icon: 'home' },
  { name: 'Уведомления', path: 'notifications', icon: 'account' },
  { name: 'Настройки', path: 'settings', icon: 'cog' },
];

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      initialRouteName="schedule"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#121212', // единый фон
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: '#4A3AFF',
        tabBarInactiveTintColor: '#aaa',
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.path}
          options={{
            title: tab.name,
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons
                name={tab.icon}
                color={color}
                size={size}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
