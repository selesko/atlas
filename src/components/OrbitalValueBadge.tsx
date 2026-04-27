import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

// Arc starts at 12 o'clock (SVG -90°) and sweeps clockwise.
// value/10 fraction of 360° — fully closed at 10.

interface OrbitalValueBadgeProps {
  value: number;   // 1–10
  color: string;
  size?: number;   // outer diameter in px (default 44)
}

export function OrbitalValueBadge({ value, color, size = 44 }: OrbitalValueBadgeProps) {
  const cx = size / 2;
  const cy = size / 2;
  const R  = size * 0.41;

  const fraction = Math.max(0, Math.min(10, value)) / 10;
  const sweep    = fraction * 360;
  const complete = sweep >= 359.9;

  // Full orbit = node color; anything less = white
  const activeColor = complete ? color : 'rgba(255,255,255,0.85)';

  // Arc end point (start is always top = (cx, cy - R))
  const endRad = ((-90 + sweep) * Math.PI) / 180;
  const endX   = cx + R * Math.cos(endRad);
  const endY   = cy + R * Math.sin(endRad);
  const largeArc = sweep > 180 ? 1 : 0;

  const planetR = size * 0.065;

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

        {/* Filled arc — or full circle at 10 */}
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

        {/* Planet dot at arc tip (not shown when complete — orbit ring covers it) */}
        {!complete && value > 0 && (
          <Circle cx={endX} cy={endY} r={planetR} fill={activeColor} />
        )}

      </Svg>

      {/* Value number centered */}
      <Text
        style={{
          color: activeColor,
          fontSize: size * 0.34,
          fontWeight: '200',
          includeFontPadding: false,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
