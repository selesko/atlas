import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import Svg, { Circle, G, Polygon, Line, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { SnapshotNode } from '../stores/useSnapshotStore';
import { THEME } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_W = SCREEN_WIDTH - 48;
const CARD_PADDING = 28;
const HEADER_H = 56;
const RADAR_SIZE = Math.min(SCREEN_WIDTH - 80, 280);
const CENTER = RADAR_SIZE / 2;
const MAX_R = CENTER * 0.78;
const EXPAND_DURATION = 700;
const ROTATION_SPEED = 0.035; // rad/sec (~2 deg/sec) — slow continuous orbit
const STAR_COUNT = 160;

// Star origin = center of the radar within the card
const STAR_OX = CARD_W / 2;
const STAR_OY = CARD_PADDING + HEADER_H + CENTER;
// Max distance a star can travel (card diagonal from origin)
const STAR_MAX_DIST = Math.sqrt(Math.pow(CARD_W, 2) + Math.pow(700, 2)) * 0.55;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

// Ease-in for rotation speed: starts at 0, smoothly ramps to 1 over ~2s
function easeInRotation(elapsed: number) {
  const ramp = Math.min(elapsed / 2000, 1);
  return ramp * ramp; // quadratic ease-in
}

// Seeded pseudo-random — deterministic, no re-rolls on re-render
function sr(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

interface Props {
  visible: boolean;
  onClose: () => void;
  nodes: SnapshotNode[];
  label?: string;
  triggerNode?: { name: string; color: string; avg: number } | null;
}

export const SnapshotDetailModal: React.FC<Props> = ({
  visible, onClose, nodes, label, triggerNode,
}) => {
  const [anim, setAnim] = useState({ expand: 0, rotation: 0 });
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const prevTimestampRef = useRef<number | null>(null);
  const rotationAccRef = useRef(0);

  // Stars — generated once, stable across frames, fixed positions
  const stars = useMemo(() => Array.from({ length: STAR_COUNT }, (_, i) => ({
    angle: sr(i * 13.7) * Math.PI * 2,
    dist: (0.12 + sr(i * 7.3 + 1) * 0.88) * STAR_MAX_DIST,
    size: 0.25 + sr(i * 3.1 + 2) * 0.65,
    opacity: 0.2 + sr(i * 5.9 + 3) * 0.6,
  })), []);

  useEffect(() => {
    if (!visible) {
      setAnim({ expand: 0, rotation: 0 });
      startTimeRef.current = null;
      prevTimestampRef.current = null;
      rotationAccRef.current = 0;
      return;
    }

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      if (!prevTimestampRef.current) prevTimestampRef.current = timestamp;

      const elapsed = timestamp - startTimeRef.current;
      const dt = (timestamp - prevTimestampRef.current) / 1000; // seconds
      prevTimestampRef.current = timestamp;

      const expand = Math.min(elapsed / EXPAND_DURATION, 1);

      // Rotation eases in over first 2s, then holds constant speed
      rotationAccRef.current += ROTATION_SPEED * easeInRotation(elapsed) * dt;

      setAnim({ expand, rotation: rotationAccRef.current });
      rafRef.current = requestAnimationFrame(animate); // keep running for rotation
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [visible]);

  // ── Radar points — expand from center + slow continuous rotation ─────────────
  const computedPts = nodes.map((n, i) => {
    const angle = (i * 2 * Math.PI) / (nodes.length || 1) - Math.PI / 2 + anim.rotation;
    const r = (n.avg / 10) * MAX_R * easeOutCubic(anim.expand);
    return {
      x: CENTER + r * Math.cos(angle),
      y: CENTER + r * Math.sin(angle),
      color: n.color,
      name: n.nodeName,
      avg: n.avg,
    };
  });

  const polygonPoints = computedPts.map(p => `${p.x},${p.y}`).join(' ');

  // ── Stars — fixed positions, gently fade in ──────────────────────────────────
  const renderedStars = stars.map((s, i) => {
    const cx = STAR_OX + s.dist * Math.cos(s.angle);
    const cy = STAR_OY + s.dist * Math.sin(s.angle);
    // Fade in smoothly over first 60% of expand animation
    const dotAlpha = Math.min(1, anim.expand * 1.8) * s.opacity;
    return { cx, cy, dotAlpha, size: s.size, key: i };
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={styles.card}>

            {/* ── Star background ───────────────────────────────────────────── */}
            <Svg
              style={StyleSheet.absoluteFill}
              width={CARD_W}
              height={800}
              viewBox={`0 0 ${CARD_W} 800`}
              pointerEvents="none"
            >
              <Defs>
                <RadialGradient id="cardBg" cx="50%" cy="35%" r="65%">
                  <Stop offset="0%" stopColor="#1E293B" stopOpacity="1" />
                  <Stop offset="60%" stopColor="#0F172A" stopOpacity="1" />
                  <Stop offset="100%" stopColor={THEME.card} stopOpacity="1" />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width={CARD_W} height="800" fill="url(#cardBg)" />

              {/* Stars — fade in at fixed positions */}
              {renderedStars.map(s => s.dotAlpha > 0.01 && (
                <Circle
                  key={s.key}
                  cx={s.cx} cy={s.cy}
                  r={s.size}
                  fill="white"
                  opacity={s.dotAlpha}
                />
              ))}
            </Svg>

            {/* ── Header ────────────────────────────────────────────────────── */}
            <View style={styles.header}>
              {triggerNode ? (
                <View style={styles.headerTrigger}>
                  <View style={[styles.triggerDot, { backgroundColor: triggerNode.color }]} />
                  <Text style={[styles.triggerName, { color: triggerNode.color }]}>
                    {triggerNode.name.toUpperCase()}
                  </Text>
                  <Text style={styles.triggerAvg}>{triggerNode.avg.toFixed(1)}</Text>
                </View>
              ) : (
                <View style={styles.headerTrigger} />
              )}
              <Text style={styles.headerLabel}>{label ?? ''}</Text>
            </View>

            {/* ── Radar ─────────────────────────────────────────────────────── */}
            <View style={styles.radarWrap}>
              <Svg width={RADAR_SIZE} height={RADAR_SIZE} viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}>
                {/* Radial bg glow */}
                <Defs>
                  <RadialGradient id="radarBg" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor="#1E293B" stopOpacity="0.9" />
                    <Stop offset="100%" stopColor={THEME.card} stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Circle cx={CENTER} cy={CENTER} r={CENTER} fill="url(#radarBg)" />

                {/* Grid rings */}
                {[0.25, 0.5, 0.75, 1].map(f => (
                  <Circle key={f} cx={CENTER} cy={CENTER} r={MAX_R * f}
                    stroke="rgba(255,255,255,0.07)" strokeWidth="0.75" fill="none" />
                ))}
                {/* Axis spokes */}
                {nodes.map((_, i) => {
                  const angle = (i * 2 * Math.PI) / (nodes.length || 1) - Math.PI / 2;
                  return (
                    <Line key={i} x1={CENTER} y1={CENTER}
                      x2={CENTER + MAX_R * Math.cos(angle)}
                      y2={CENTER + MAX_R * Math.sin(angle)}
                      stroke="rgba(255,255,255,0.06)" strokeWidth="0.75" />
                  );
                })}
                {/* Polygon */}
                {computedPts.length >= 2 && (
                  <Polygon
                    points={polygonPoints}
                    fill="rgba(56,189,248,0.13)"
                    stroke={THEME.accent}
                    strokeWidth="1.2"
                  />
                )}
                {/* Node dots with glow */}
                {computedPts.map((p, i) => (
                  <G key={i}>
                    <Circle cx={p.x} cy={p.y} r={10} fill={p.color} opacity={0.12} />
                    <Circle cx={p.x} cy={p.y} r={5} fill={p.color} opacity={0.4} />
                    <Circle cx={p.x} cy={p.y} r={3} fill={p.color} />
                  </G>
                ))}
              </Svg>
            </View>

            {/* ── Score list ────────────────────────────────────────────────── */}
            <View style={styles.scoreList}>
              {nodes.map(n => (
                <View key={n.nodeId} style={styles.scoreRow}>
                  <View style={[styles.scoreDot, { backgroundColor: n.color }]} />
                  <Text style={styles.scoreName}>{n.nodeName.toUpperCase()}</Text>
                  <Text style={[styles.scoreVal, { color: n.color }]}>{n.avg.toFixed(1)}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.closeHint}>TAP ANYWHERE TO CLOSE</Text>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 24,
    padding: CARD_PADDING,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.15)',
    shadowColor: THEME.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    width: CARD_W,
    overflow: 'hidden',
    backgroundColor: THEME.card,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTrigger: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  triggerDot: { width: 7, height: 7, borderRadius: 4 },
  triggerName: { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  triggerAvg: { color: THEME.textDim, fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  headerLabel: { color: THEME.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  radarWrap: { marginBottom: 24 },
  scoreList: { width: '100%', gap: 10, marginBottom: 20 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreDot: { width: 7, height: 7, borderRadius: 4 },
  scoreName: { flex: 1, color: THEME.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  scoreVal: { fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  closeHint: { color: 'rgba(255,255,255,0.18)', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
});
