// app/tabs/_layout.tsx
import React, { useRef, useEffect } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';

export default function TabsLayout() {
  const theme = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  const renderTab = (name: string, title: string, iconName: string, activeColor: string) => (
    <Tabs.Screen
      name={name}
      options={{
        title,
        tabBarIcon: ({ focused }) => {
          const bounceAnim = useRef(new Animated.Value(0)).current;

          useEffect(() => {
            Animated.spring(bounceAnim, {
              toValue: focused ? -8 : 0,
              friction: 5,
              tension: 150,
              useNativeDriver: true,
            }).start();
          }, [focused]);

          return (
            <Animated.View style={{ alignItems: 'center', transform: [{ translateY: bounceAnim }] }}>
              <MaterialCommunityIcons
                name={iconName}
                size={28}
                color={focused ? activeColor : '#888'}
              />
            </Animated.View>
          );
        },
        tabBarLabel: ({ focused }) => {
          const bounceAnim = useRef(new Animated.Value(0)).current;
          const extraMargin = 2;

          useEffect(() => {
            Animated.spring(bounceAnim, {
              toValue: focused ? -8 : 0,
              friction: 5,
              tension: 150,
              useNativeDriver: true,
            }).start();
          }, [focused]);

          return (
            <Animated.Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                styles.label(focused, activeColor),
                { transform: [{ translateY: bounceAnim }], marginTop: 4 + extraMargin },
              ]}
            >
              {title}
            </Animated.Text>
          );
        },
      }}
    />
  );

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Tabs
        initialRouteName="schedule"
        screenOptions={{
          tabBarStyle: {
            backgroundColor: '#121212',
            borderTopWidth: 0,
            elevation: 0,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            height: 70,
            paddingBottom: 6,
            paddingTop: 6,
          },
          tabBarActiveTintColor: '#fff',
          tabBarInactiveTintColor: '#888',
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600', maxWidth: 60 },
          headerShown: false,
          tabBarShowLabel: true,
          tabBarItemStyle: { paddingHorizontal: 4 },
        }}
      >
        {renderTab('schedule', 'Расписание', 'calendar-clock', '#4A3AFF')}
        {renderTab('notifications', 'Уведомления', 'bell-ring-outline', '#FF4B80')}
        {renderTab('profile', 'Профиль', 'account-outline', '#63B3ED')}
        {renderTab('profile/add', 'МедДруг', 'doctor', '#63B3ED')}
      </Tabs>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  label: (focused: boolean, activeColor: string) => ({
    color: focused ? activeColor : '#888',
    fontSize: 10,
    fontWeight: focused ? '700' : '500',
    textAlign: 'center',
  }),
});
