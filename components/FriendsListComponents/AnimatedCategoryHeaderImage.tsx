import React, { useEffect } from 'react';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  cancelAnimation,
  withRepeat, 
  withSequence, 
  withTiming, 
} from 'react-native-reanimated';

export function AnimatedCategoryHeaderImage({
  source,
  style,
  isActive = false,
}: {
  source: any;
  style?: any;
  isActive?: boolean;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(scale);
    if (isActive) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 180 }),
          withTiming(1, { duration: 220 }),
          withTiming(1, { duration: 3000 }),
        ),
        -1,
        false,
      );
    } else {
      scale.value = withTiming(1, { duration: 120 });
    }

    return () => {
      cancelAnimation(scale);
    };
  }, [isActive, scale]);

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
