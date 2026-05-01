/**
 * BlobBackground — full-screen animated aura layer.
 *
 * Uses React Native's built-in Animated API (not Reanimated) so it works
 * reliably in Expo Go without JSI worklet setup.
 *
 * Dark mode: deep space base + slow-drifting cosmic blobs + star field.
 * Light mode: soft off-white base + drifting pastel aura blobs.
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../hooks/useTheme';

const { width: W, height: H } = Dimensions.get('window');

// ─── Single animated blob ─────────────────────────────────────────────────────

interface BlobProps {
  color: string;
  opacity: number;
  size: number;
  initialX: number;
  initialY: number;
  driftX: number;
  driftY: number;
  duration: number;
  delay: number;
}

function Blob({ color, opacity, size, initialX, initialY, driftX, driftY, duration, delay }: BlobProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, driftX] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, driftY] });
  const scale = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.1, 1] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: initialX - size / 2,
          top: initialY - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          opacity,
        },
        { transform: [{ translateX }, { translateY }, { scale }] },
      ]}
    >
      <LinearGradient
        colors={[color, 'transparent']}
        style={{ flex: 1 }}
        start={{ x: 0.3, y: 0.3 }}
        end={{ x: 1, y: 1 }}
      />
    </Animated.View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BlobBackground() {
  const theme = useTheme();

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }]} pointerEvents="none">
      {/* Blob 1 — top-left */}
      <Blob
        color={theme.blob1}
        opacity={theme.blobOpacity}
        size={W * 0.85}
        initialX={W * 0.05}
        initialY={H * 0.05}
        driftX={W * 0.08}
        driftY={H * 0.06}
        duration={22000}
        delay={0}
      />
      {/* Blob 2 — bottom-right */}
      <Blob
        color={theme.blob2}
        opacity={theme.blobOpacity * 0.9}
        size={W * 1.0}
        initialX={W * 0.9}
        initialY={H * 0.8}
        driftX={-W * 0.07}
        driftY={-H * 0.05}
        duration={26000}
        delay={1000}
      />
      {/* Blob 3 — center */}
      <Blob
        color={theme.blob3}
        opacity={theme.blobOpacity * 0.6}
        size={W * 0.7}
        initialX={W * 0.55}
        initialY={H * 0.45}
        driftX={W * 0.06}
        driftY={H * 0.08}
        duration={19000}
        delay={2000}
      />
    </View>
  );
}
