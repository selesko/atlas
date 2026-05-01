/**
 * GlassCard — frosted glass card surface.
 *
 * Uses expo-blur BlurView with a semi-transparent color overlay and
 * a subtle border. Adapts tint and intensity from the active theme.
 *
 * Usage:
 *   <GlassCard style={{ borderRadius: 20, padding: 16 }}>
 *     <Text>...</Text>
 *   </GlassCard>
 */

import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Override blur intensity (default: theme.glassBlurIntensity) */
  intensity?: number;
  /** If true, removes border */
  borderless?: boolean;
}

export function GlassCard({ children, style, intensity, borderless }: GlassCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.wrapper,
        {
          borderColor: borderless ? 'transparent' : theme.glassBorder,
          shadowColor: theme.glassShadow,
        },
        style,
      ]}
    >
      <BlurView
        intensity={intensity ?? theme.glassBlurIntensity}
        tint={theme.glassBlurTint}
        style={StyleSheet.absoluteFill}
      />
      {/* Color overlay — tints the blur toward the theme's glass color */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme.glass, borderRadius: (style as any)?.borderRadius ?? 0 },
        ]}
      />
      {/* Content sits above both blur and overlay */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderWidth: 1,
    // Shadow (iOS)
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    // Android elevation
    elevation: 6,
  },
  content: {
    // Ensures content renders above the blur/overlay layers
    zIndex: 1,
  },
});
