// @/components/app-bar.tsx
import { Appbar, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import React, { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

const AnimatedAppbar = Animated.createAnimatedComponent(Appbar.Header);

export type AppBarProps = {
  title: string;
  back?: boolean;
  menu?: boolean;
  onBack?: () => void;
};

export function AppBar({ title, back, menu, onBack }: AppBarProps) {
  const router = useRouter();
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [title]);

  return (
    <AnimatedAppbar
      mode="center-aligned"
      style={{
        opacity,
        transform: [{ translateY }],
        backgroundColor: '#121212',
        elevation: 0,
        shadowOpacity: 0,
      }}
    >
      {(back || onBack) && (
        <Appbar.BackAction 
          onPress={() => (onBack ? onBack() : router.back())}
          color="#fff"
          rippleColor="rgba(255,255,255,0.3)"
        />
      )}
      <Appbar.Content 
        title={title} 
        titleStyle={{ 
          fontWeight: '700', 
          color: '#fff',
          fontSize: 18,
        }} 
      />
      {menu && (
        <Appbar.Action 
          icon="dots-vertical" 
          color="#fff" 
          rippleColor="rgba(255,255,255,0.3)"
        />
      )}
    </AnimatedAppbar>
  );
}