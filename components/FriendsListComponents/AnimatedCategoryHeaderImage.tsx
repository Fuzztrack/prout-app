import React, { useEffect } from 'react';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withDelay, 
  withRepeat, 
  withSequence, 
  withTiming, 
  cancelAnimation 
} from 'react-native-reanimated';

export function AnimatedCategoryHeaderImage({
  source,
  style,
  delayMs = 0,
}: {
  source: any;
  style?: any;
  delayMs?: number;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1.12, { duration: 180 }),
          withTiming(1, { duration: 220 }),
          withTiming(1, { duration: 3000 }),
        ),
        -1,
        false,
      ),
    );

    return () => {
      cancelAnimation(scale);
    };
  }, [delayMs, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.Image
      source={source}
      style={[style, animatedStyle]}
      resizeMode="contain"
    />
  );
}
