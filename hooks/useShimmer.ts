import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Colors } from '../constants/colors';

export function useShimmer(): Animated.AnimatedInterpolation<string> {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return anim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.card, Colors.cardHover],
  });
}
