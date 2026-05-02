import React from 'react';
import Svg, { Circle, G, Polygon, Circle as SvgCircle } from 'react-native-svg';
import { SnapshotNode } from '../stores/useSnapshotStore';
import { THEME } from '../constants/theme';

interface CoordinatesProps {
  nodes: SnapshotNode[];
  size?: number;
}

export const Coordinates: React.FC<CoordinatesProps> = ({ nodes, size = 80 }) => {
  const center = size / 2;
  const maxR = center * 0.78;

  const pts = nodes.map((n, i) => {
    const angle = (i * 2 * Math.PI) / (nodes.length || 1) - Math.PI / 2;
    const r = (n.avg / 10) * maxR;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
      color: n.color,
    };
  });

  const axisEndPts = nodes.map((_, i) => {
    const angle = (i * 2 * Math.PI) / (nodes.length || 1) - Math.PI / 2;
    return {
      x: center + maxR * Math.cos(angle),
      y: center + maxR * Math.sin(angle),
    };
  });

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background rings */}
      {[0.25, 0.5, 0.75, 1].map(f => (
        <Circle
          key={f}
          cx={center}
          cy={center}
          r={maxR * f}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.5"
          fill="none"
        />
      ))}

      {/* Filled polygon */}
      <Polygon
        points={pts.map(p => `${p.x},${p.y}`).join(' ')}
        fill={`rgba(56,189,248,0.15)`}
        stroke={THEME.accent}
        strokeWidth="1"
      />

      {/* Node dots */}
      {pts.map((p, i) => (
        <SvgCircle key={i} cx={p.x} cy={p.y} r={2.5} fill={p.color} />
      ))}
    </Svg>
  );
};
