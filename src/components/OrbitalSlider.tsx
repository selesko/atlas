import React from 'react';
import { View, Text, PanResponder, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

// ─── Geometry constants ────────────────────────────────────────────────────────
// Value 1  → 7 o'clock  (SVG angle 120°, lower-left)
// Value 10 → 5 o'clock  (SVG angle  60°, lower-right)
// Clockwise sweep: 120° → 180° → 270° → 0° → 60°  =  300°

const START_DEG = 120;
const SWEEP_DEG = 300;

const toRad = (d: number) => (d * Math.PI) / 180;

function angleForValue(v: number): number {
  return START_DEG + ((v - 1) / 9) * SWEEP_DEG;
}

function ptOnCircle(cx: number, cy: number, r: number, deg: number) {
  return {
    x: cx + r * Math.cos(toRad(deg)),
    y: cy + r * Math.sin(toRad(deg)),
  };
}

function touchToValue(cx: number, cy: number, tx: number, ty: number): number {
  let deg = (Math.atan2(ty - cy, tx - cx) * 180) / Math.PI;
  if (deg < 0) deg += 360;

  // How far clockwise from the start?
  let rel = (deg - START_DEG + 360) % 360;

  // Dead zone is the 60° gap at the bottom — snap to nearest endpoint
  if (rel > SWEEP_DEG) {
    rel = (rel - SWEEP_DEG) < (360 - SWEEP_DEG) / 2 ? SWEEP_DEG : 0;
  }

  return Math.max(1, Math.min(10, Math.round(1 + (rel / SWEEP_DEG) * 9)));
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface OrbitalSliderProps {
  value: number;        // 1–10
  color: string;        // node color
  size?: number;        // diameter in px (default 200)
  onValueChange: (v: number) => void;
}

export function OrbitalSlider({
  value,
  color,
  size = 200,
  onValueChange,
}: OrbitalSliderProps) {
  const cx = size / 2;
  const cy = size / 2;
  const R        = size * 0.38;   // orbit radius
  const sunR     = size * 0.10;   // sun radius
  const planetR  = size * 0.055;  // planet radius

  // Keep onValueChange fresh inside the stable PanResponder
  const onChangeRef = React.useRef(onValueChange);
  React.useEffect(() => { onChangeRef.current = onValueChange; }, [onValueChange]);

  const pan = React.useRef(
    PanResponder.create({
      // Capture phase — intercept before ScrollView can claim the gesture
      onStartShouldSetPanResponder:         () => true,
      onStartShouldSetPanResponderCapture:  () => true,
      onMoveShouldSetPanResponder:          () => true,
      onMoveShouldSetPanResponderCapture:   () => true,
      onPanResponderTerminationRequest:     () => false, // don't yield once we have it
      onPanResponderGrant: (evt) =>
        onChangeRef.current(touchToValue(cx, cy, evt.nativeEvent.locationX, evt.nativeEvent.locationY)),
      onPanResponderMove: (evt) =>
        onChangeRef.current(touchToValue(cx, cy, evt.nativeEvent.locationX, evt.nativeEvent.locationY)),
    })
  ).current;

  // Geometry
  const startPt = ptOnCircle(cx, cy, R, START_DEG);
  const endPt   = ptOnCircle(cx, cy, R, START_DEG + SWEEP_DEG); // 420° = 60°

  // Full track (300° arc, large-arc=1, clockwise)
  const trackPath = [
    `M ${f(startPt.x)} ${f(startPt.y)}`,
    `A ${f(R)} ${f(R)} 0 1 1 ${f(endPt.x)} ${f(endPt.y)}`,
  ].join(' ');

  // Filled arc up to current value
  const currentAngle = angleForValue(value);
  const planet  = ptOnCircle(cx, cy, R, currentAngle);
  const swept   = ((currentAngle - START_DEG) % 360 + 360) % 360;
  const lg      = swept > 180 ? 1 : 0;
  const fillPath = [
    `M ${f(startPt.x)} ${f(startPt.y)}`,
    `A ${f(R)} ${f(R)} 0 ${lg} 1 ${f(planet.x)} ${f(planet.y)}`,
  ].join(' ');

  return (
    <View style={{ width: size, height: size }} {...pan.panHandlers}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>

        {/* Track arc */}
        <Path
          d={trackPath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.18}
        />

        {/* Filled arc */}
        {value > 1 && (
          <Path
            d={fillPath}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.85}
          />
        )}

        {/* Sun glow rings */}
        <Circle cx={cx} cy={cy} r={sunR * 2.4} fill={color} opacity={0.05} />
        <Circle cx={cx} cy={cy} r={sunR * 1.6} fill={color} opacity={0.10} />

        {/* Sun core */}
        <Circle cx={cx} cy={cy} r={sunR} fill="white" opacity={0.95} />

        {/* Planet orbit ring */}
        <Circle
          cx={planet.x} cy={planet.y}
          r={planetR * 1.9}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          opacity={0.55}
        />

        {/* Planet core */}
        <Circle cx={planet.x} cy={planet.y} r={planetR} fill={color} />

      </Svg>

      {/* Value label centered on sun */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: cx - sunR,
          top:  cy - sunR,
          width:  sunR * 2,
          height: sunR * 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color, fontSize: sunR * 1.2, fontWeight: '200' }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// tiny helper — keeps SVG paths readable
function f(n: number) { return n.toFixed(2); }
