import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Path, G } from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);

interface OrbitalValueBadgeProps {
  value: number;   // 1–10
  color: string;
  size?: number;   // outer diameter in px (default 44)
}

export function OrbitalValueBadge({ value, color, size = 44 }: OrbitalValueBadgeProps) {
  const cx = size / 2;
  const cy = size / 2;
  const R  = size * 0.41;

  // Animation values
  const animatedValue = useRef(new Animated.Value(value)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: value,
      duration: 300,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: false,
    }).start();
  }, [value]);

  const fraction = Math.max(0, Math.min(10, value)) / 10;
  const sweep    = fraction * 360;
  const complete = sweep >= 359.9;

  const activeColor = color;
  const planetR = size * 0.065;

  // For the arc path, we still use the static value for the path itself to avoid complex path animation,
  // but the moon will rotate smoothly.
  const endRad = ((-90 + sweep) * Math.PI) / 180;
  const endX   = cx + R * Math.cos(endRad);
  const endY   = cy + R * Math.sin(endRad);
  const largeArc = sweep > 180 ? 1 : 0;

  const spin = animatedValue.interpolate({
    inputRange: [0, 10],
    outputRange: ['0deg', '360deg']
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>

        {/* Background track */}
        <Circle
          cx={cx} cy={cy} r={R}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          opacity={0.15}
        />

        {/* Filled arc */}
        {complete ? (
          <Circle
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke={activeColor}
            strokeWidth={2}
            opacity={0.85}
          />
        ) : value > 0 ? (
          <Path
            d={`M ${cx} ${(cy - R).toFixed(2)} A ${R} ${R} 0 ${largeArc} 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`}
            fill="none"
            stroke={activeColor}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.85}
          />
        ) : null}

        {/* Animated Moon rotation */}
        {!complete && value > 0 && (
          <AnimatedG 
            style={{ transform: [{ rotate: spin }] }}
            // @ts-ignore
            origin={`${cx}, ${cy}`}
          >
            <Circle cx={cx} cy={cy - R} r={planetR} fill={activeColor} />
          </AnimatedG>
        )}

      </Svg>

      {/* Value number centered */}
      <Text
        style={{
          color: activeColor,
          fontSize: size * 0.34,
          fontWeight: '600',
          includeFontPadding: false,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
