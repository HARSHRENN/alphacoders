import React, { useEffect } from 'react';
import { AccessibilityInfo, Animated, useAnimatedValue } from 'react-native';

/** A brief entrance; content stays usable when the user prefers reduced motion. */
export function MotionView({ children }: { children: React.ReactNode }) {
  const progress = useAnimatedValue(1);
  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduced) => {
      if (reduced) {
        animation?.stop();
        progress.setValue(1);
      }
    });
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!active || reduced) return;
        progress.setValue(0);
        animation = Animated.timing(progress, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
          isInteraction: false,
        });
        animation.start();
      })
      .catch(() => {});
    return () => {
      active = false;
      animation?.stop();
      subscription.remove();
    };
  }, [progress]);
  return (
    <Animated.View
      style={{
        minWidth: 0,
        opacity: progress,
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
