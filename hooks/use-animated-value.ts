// @/hooks/use-animated-value.ts
import { useRef, useEffect } from 'react';
import { Animated, Easing} from 'react-native';

export function useAnimatedValue(
  initialValue: number,
  animationConfig: {
    toValue: number;
    duration?: number;
    delay?: number;
    useNativeDriver?: boolean;
  }
) {
  const value = useRef(new Animated.Value(initialValue)).current;

  useEffect(() => {
    Animated.timing(value, {
      toValue: animationConfig.toValue,
      duration: animationConfig.duration ?? 300,
      delay: animationConfig.delay ?? 0,
      useNativeDriver: animationConfig.useNativeDriver ?? true,
      easing: Animated.Easing.out(Animated.Easing.ease),
    }).start();
  }, [animationConfig.toValue]);

  return value;
}