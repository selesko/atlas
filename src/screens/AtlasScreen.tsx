import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  PanResponder, Animated, Pressable, StyleSheet as RNStyleSheet,
} from 'react-native';
import Svg, {
  Circle, Polygon, G, Rect, Path, Defs,
  RadialGradient, Stop, Line,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../stores/useAppStore';
import { FadingBorder } from '../components/FadingBorder';
import { THEME } from '../constants/theme';
import { AtlasGraphView, Node } from '../types';

const { width } = Dimensions.get('window');
const STARFIELD_HEIGHT = 240;

interface CopilotSuggestion {
  label: string;
  action: string;
  nodeId?: string;
  goalId?: string;
}

interface AtlasScreenProps {
  copilotContent: {
    briefingLines: Array<{ prefix: string; text: string }>;
    suggest1: CopilotSuggestion;
    suggest2: CopilotSuggestion;
  };
  briefingHighlight: {
    wordToColor: Record<string, string>;
    re: RegExp;
  };
  onHandleSuggestion: (s: CopilotSuggestion) => void;
}

const SUGGESTION_BTN_LABELS: Record<string, string> = {
  calibrate: 'CALIBRATE',
  logEvidence: 'LOG EVIDENCE',
  prioritize: 'PRIORITIZE',
  deployTask: 'ADD TASK',
};

export const AtlasScreen: React.FC<AtlasScreenProps> = ({
  copilotContent,
  briefingHighlight,
  onHandleSuggestion,
}) => {
  const { nodes, getNodeAvg } = useAppStore();

  const [atlasGraphView, setAtlasGraphView] = useState<AtlasGraphView>('radar');
  const [atlasHighlightId, setAtlasHighlightId] = useState<string | null>(null);
  const [stars, setStars] = useState<Array<{ cx: number; cy: number; r: number; op: number }>>([]);
  const [trajectoryDragX, setTrajectoryDragX] = useState<number | null>(null);
  const [radarPulseScale, setRadarPulseScale] = useState(1);
  const [nodeBreathValue, setNodeBreathValue] = useState(0);
  const [constellationPulseOpacityState, setConstellationPulseOpacityState] = useState(0.4);
  const [trajectoryPulseDash, setTrajectoryPulseDash] = useState<number[]>([]);

  const trajectoryChartWidthRef = useRef(0);
  const trajectoryPulseOffsets = useRef<Animated.Value[]>([]);
  const radarRotation = useRef(new Animated.Value(0)).current;
  const radarScale = useRef(new Animated.Value(1)).current;
  const nodeBreathAnim = useRef(new Animated.Value(0)).current;
  const constellationPulseOpacity = useRef(new Animated.Value(0.4)).current;

  // Stars
  useEffect(() => {
    setStars(Array.from({ length: 220 }, () => ({
      cx: Math.random() * width,
      cy: Math.random() * STARFIELD_HEIGHT,
      r: 0.25 + Math.random() * 0.65,
      op: 0.2 + Math.random() * 0.6,
    })));
  }, []);

  // Radar rotation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(radarRotation, { toValue: 360, duration: 90000, useNativeDriver: true, isInteraction: false }),
        Animated.timing(radarRotation, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Radar pulse scale
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(radarScale, { toValue: 1.02, duration: 3000, useNativeDriver: false, isInteraction: false }),
        Animated.timing(radarScale, { toValue: 0.98, duration: 3000, useNativeDriver: false, isInteraction: false }),
      ])
    );
    anim.start();
    const sub = radarScale.addListener(({ value }) => setRadarPulseScale(value));
    return () => { anim.stop(); radarScale.removeListener(sub); };
  }, []);

  // Node breath
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(nodeBreathAnim, { toValue: 1, duration: 2000, useNativeDriver: false, isInteraction: false }),
        Animated.timing(nodeBreathAnim, { toValue: 0, duration: 2000, useNativeDriver: false, isInteraction: false }),
      ])
    );
    anim.start();
    const sub = nodeBreathAnim.addListener(({ value }) => setNodeBreathValue(value));
    return () => { anim.stop(); nodeBreathAnim.removeListener(sub); };
  }, []);

  // Trajectory pulse
  useEffect(() => {
    const n = nodes.length;
    if (n === 0 || atlasGraphView !== 'trajectory') return;
    while (trajectoryPulseOffsets.current.length < n) {
      trajectoryPulseOffsets.current.push(new Animated.Value(0));
    }
    const pathLen = 400;
    const offsets = trajectoryPulseOffsets.current.slice(0, n);
    const listeners = offsets.map((offset, ni) => {
      const duration = 1800 + ni * 400;
      const delay = ni * 500;
      Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(offset, { toValue: pathLen, duration, useNativeDriver: false, isInteraction: false }),
            Animated.timing(offset, { toValue: 0, duration: 0, useNativeDriver: false }),
          ])
        ),
      ]).start();
      return offset.addListener(({ value }) => {
        setTrajectoryPulseDash(prev => {
          const next = prev.length === n ? [...prev] : Array(n).fill(0);
          next[ni] = value;
          return next;
        });
      });
    });
    setTrajectoryPulseDash(Array(n).fill(0));
    return () => {
      offsets.forEach((offset, i) => {
        offset.removeListener(listeners[i]);
        offset.stopAnimation();
      });
    };
  }, [nodes.length, atlasGraphView]);

  // Constellation pulse
  useEffect(() => {
    if (atlasGraphView !== 'constellation') return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(constellationPulseOpacity, { toValue: 0.7, duration: 1200, useNativeDriver: false, isInteraction: false }),
        Animated.timing(constellationPulseOpacity, { toValue: 0.4, duration: 1200, useNativeDriver: false, isInteraction: false }),
      ])
    ).start();
    const sub = constellationPulseOpacity.addListener(({ value }) => setConstellationPulseOpacityState(value));
    return () => { constellationPulseOpacity.stopAnimation(); constellationPulseOpacity.removeListener(sub); };
  }, [atlasGraphView]);

  const trajectoryPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const w = trajectoryChartWidthRef.current || 320;
      setTrajectoryDragX(Math.max(0, Math.min(320, (e.nativeEvent.locationX / w) * 320)));
    },
    onPanResponderMove: (e) => {
      const w = trajectoryChartWidthRef.current || 320;
      setTrajectoryDragX(Math.max(0, Math.min(320, (e.nativeEvent.locationX / w) * 320)));
    },
    onPanResponderRelease: () => setTrajectoryDragX(null),
  }), []);

  const radarRotStyle = {
    transform: [{ rotate: radarRotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) }],
  };

  const handleRadarTouch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Derived values
  const systemBalance = (nodes.reduce((acc, n) => acc + parseFloat(getNodeAvg(n)), 0) / (nodes.length || 1)).toFixed(1);
  const withAvg = nodes.map(n => ({ node: n, avg: parseFloat(getNodeAvg(n)) })).sort((a, b) => b.avg - a.avg);
  const highest = withAvg[0];
  const lowest = withAvg[withAvg.length - 1];
  const driftDelta = highest && lowest && highest.node.id !== lowest.node.id
    ? (highest.avg - lowest.avg).toFixed(1) : '0';

  const TRAJ_CHART_H = 156;
  const TRAJ_PLOT_H = 196;
  const trajectoryX = (i: number) => (i / 6) * 320;
  const trajectoryY = (v: number) => 24 + (1 - v / 10) * TRAJ_CHART_H;

  const trajectoryDataPerNode = nodes.map(n => {
    const cur = parseFloat(getNodeAvg(n));
    const base = cur - 0.5;
    return [base, base + 0.2, base + 0.1, base + 0.3, base + 0.2, base + 0.3, cur];
  });

  const averageData = [0, 1, 2, 3, 4, 5, 6].map(i =>
    trajectoryDataPerNode.reduce((s, arr) => s + arr[i], 0) / (nodes.length || 1)
  );

  const interpolatedAvg = (x: number) => {
    if (x <= 0) return averageData[0];
    if (x >= 320) return averageData[6];
    const i = (x / 320) * 6;
    const i0 = Math.floor(i);
    const i1 = Math.min(i0 + 1, 6);
    return averageData[i0] * (1 - (i - i0)) + averageData[i1] * (i - i0);
  };

  const driftSparkline = [0, 1, 2, 3, 4, 5, 6].map(i => {
    const vals = trajectoryDataPerNode.map(arr => arr[i]);
    return vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
  });
  const stabilizing = driftSparkline[6] < driftSparkline[0];
  const arrowColor = stabilizing ? '#22D3EE' : '#F59E0B';
  const arrowPath = !stabilizing
    ? 'M 12 4 L 4 14 L 10 14 L 10 22 L 14 22 L 14 14 L 20 14 Z'
    : 'M 12 20 L 4 10 L 10 10 L 10 2 L 14 2 L 14 10 L 20 10 Z';

  const buildCurvePath = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
    }
    return d;
  };

  const avgPts = averageData.map((v, i) => ({ x: trajectoryX(i), y: trajectoryY(v) }));
  const avgPath = buildCurvePath(avgPts);

  return (
    <>
      {/* System Status */}
      <View style={styles.systemManifestCard}>
        <View style={styles.systemManifestPrimaryRow}>
          <View style={styles.systemManifestLeft}>
            <Text style={styles.systemManifestBracketLabel}>SYSTEM STATUS</Text>
          </View>
          <View style={styles.systemManifestVLine} />
          <View style={styles.systemManifestStatusBlock}>
            <Text style={styles.systemManifestBracketValue}>{systemBalance}</Text>
          </View>
        </View>
      </View>

      {/* Atlas Card */}
      <View style={styles.atlasCard}>
        <View style={styles.atlasCardContent}>
          {/* Header row with view switcher */}
          <View style={[styles.atlasCardHeader, styles.atlasCardHeaderRow]}>
            <View style={styles.atlasScoreBlock}>
              <Text style={styles.statLabel}>
                {atlasGraphView === 'radar' ? 'RADAR' : atlasGraphView === 'trajectory' ? 'TRAJECTORY' : 'CONSTELLATION'}
              </Text>
            </View>
            <View style={styles.atlasViewSwitcher}>
              {(['radar', 'trajectory', 'constellation'] as const).map(v => {
                const c = atlasGraphView === v ? THEME.accent : THEME.textDim;
                return (
                  <TouchableOpacity
                    key={v}
                    onPress={() => { if (v !== 'trajectory') setTrajectoryDragX(null); setAtlasGraphView(v); }}
                    style={[styles.atlasViewTab, atlasGraphView === v && styles.atlasViewTabActive]}
                    activeOpacity={0.8}
                  >
                    {v === 'radar' && (
                      <Svg width={22} height={22} viewBox="0 0 256 256">
                        <Path fill={c} d="M230.64 49.36a32 32 0 0 0-45.26 0a31.9 31.9 0 0 0-5.16 6.76L152 48.42a32 32 0 0 0-54.63-23.06a32.06 32.06 0 0 0-5.76 37.41L57.67 93.32a32.05 32.05 0 0 0-40.31 4.05a32 32 0 0 0 42.89 47.41l70 51.36a32 32 0 1 0 47.57-14.69l27.39-77.59q1.38.12 2.76.12a32 32 0 0 0 22.63-54.62Zm-67.87 126.79a32 32 0 0 0-23 7.08l-70-51.36a32.17 32.17 0 0 0-1.34-26.65l33.95-30.55a32 32 0 0 0 45.47-10.81l28.15 7.7a32 32 0 0 0 14.12 27Z" />
                      </Svg>
                    )}
                    {v === 'trajectory' && (
                      <Svg width={22} height={22} viewBox="0 0 1024 1024">
                        <Path fill={c} d="M944 224c-44.192 0-79.999 35.824-79.999 80c0 9.072 1.84 17.632 4.607 25.76L673.6 497.68C659.92 486.784 642.848 480 624 480c-21.743 0-41.407 8.736-55.808 22.816l-152.752-76.48C412.465 384.848 378.241 352 336 352c-44.175 0-80 35.824-80 80c0 12.096 2.88 23.44 7.68 33.712L107.936 645.296C99.2 642.032 89.872 640 80 640c-44.176 0-80 35.824-80 80s35.824 80 80 80s80-35.824 80-80c0-10.64-2.176-20.767-5.952-30.048l158.272-181.92C319.856 510.368 327.696 512 336 512c23.28 0 44.047-10.112 58.671-26l149.408 74.912C544.608 604.656 580.127 640 624 640c44.193 0 80-35.824 80-80c0-1.424-.336-2.752-.416-4.16L911.68 377.072C921.584 381.456 932.463 384 944 384c44.193 0 80-35.808 80-80c0-44.176-35.807-80-79.999-80z" />
                      </Svg>
                    )}
                    {v === 'constellation' && (
                      <Svg width={22} height={22} viewBox="0 0 32 32">
                        {[[10,20],[10,28],[10,14],[28,4],[22,6],[28,10],[20,12],[28,22],[26,28],[20,26],[22,20],[16,4],[4,24],[4,16]].map(([cx, cy], i) => (
                          <Circle key={i} cx={cx} cy={cy} r={2} fill={c} />
                        ))}
                      </Svg>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Visualization */}
          <View style={styles.atlasStarfieldContainer}>
            {atlasGraphView === 'radar' && (
              <>
                <Svg style={[RNStyleSheet.absoluteFill, { zIndex: 0 }]} viewBox={`0 0 ${width} ${STARFIELD_HEIGHT}`} preserveAspectRatio="xMidYMid slice">
                  <Defs>
                    <RadialGradient id="etherealBg" cx="50%" cy="50%" r="70%" fx="50%" fy="50%">
                      <Stop offset="0%" stopColor="#1E293B" stopOpacity="1" />
                      <Stop offset="60%" stopColor="#0F172A" stopOpacity="1" />
                      <Stop offset="100%" stopColor="#0B1120" stopOpacity="1" />
                    </RadialGradient>
                  </Defs>
                  <Rect x="0" y="0" width={width} height={STARFIELD_HEIGHT} fill="url(#etherealBg)" />
                </Svg>
                <Svg style={styles.starfieldSvg} viewBox={`0 0 ${width} ${STARFIELD_HEIGHT}`} preserveAspectRatio="xMidYMid slice">
                  {stars.map((s, i) => (
                    <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={`rgba(255,255,255,${s.op})`} />
                  ))}
                </Svg>
                <Pressable style={styles.radarWrapper} onPressIn={handleRadarTouch}>
                  <Animated.View style={[styles.radarRotWrap, radarRotStyle]}>
                    <Svg height={240} width={240} viewBox="0 0 200 200">
                      <Defs>
                        {nodes.map(n => (
                          <RadialGradient key={n.id} id={`glow-${n.id}`} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                            <Stop offset="0%" stopColor={n.color} stopOpacity="1" />
                            <Stop offset="20%" stopColor={n.color} stopOpacity="0.8" />
                            <Stop offset="50%" stopColor={n.color} stopOpacity="0.4" />
                            <Stop offset="80%" stopColor={n.color} stopOpacity="0.15" />
                            <Stop offset="100%" stopColor={n.color} stopOpacity="0" />
                          </RadialGradient>
                        ))}
                      </Defs>
                      <G transform="translate(100, 100)">
                        <G opacity={0.06}>
                          {[20, 40, 60, 80].map(r => <Circle key={r} r={r} stroke="#C0C0C0" strokeWidth="0.5" fill="none" />)}
                        </G>
                        {(() => {
                          const pts = nodes.map((n, i) => {
                            const angle = (i * 2 * Math.PI) / (nodes.length || 1) - Math.PI / 2;
                            const r = (parseFloat(getNodeAvg(n)) / 10) * 80;
                            return { x: r * Math.cos(angle), y: r * Math.sin(angle), color: n.color, id: n.id };
                          });
                          const breathRadius = 9 + nodeBreathValue * 6;
                          return (
                            <>
                              <G transform={`scale(${radarPulseScale})`}>
                                <Polygon points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(56, 189, 248, 0.15)" stroke={THEME.accent} strokeWidth="0.9" />
                              </G>
                              {pts.map((p, i) => {
                                const hi = atlasHighlightId === p.id;
                                return (
                                  <G key={i} onPress={() => setAtlasHighlightId(prev => prev === p.id ? null : p.id)}>
                                    <Circle cx={p.x} cy={p.y} r={hi ? breathRadius + 4 : breathRadius} fill={`url(#glow-${p.id})`} opacity={0.6 + nodeBreathValue * 0.4} />
                                    <Circle cx={p.x} cy={p.y} r={hi ? 4 : 3.5} fill={p.color} />
                                    <Circle cx={p.x} cy={p.y} r={hi ? 2 : 1.5} fill="#FFFFFF" opacity={0.9} />
                                  </G>
                                );
                              })}
                            </>
                          );
                        })()}
                      </G>
                    </Svg>
                  </Animated.View>
                </Pressable>
              </>
            )}

            {atlasGraphView === 'trajectory' && (
              <>
                <View style={{ height: TRAJ_PLOT_H }}>
                  <Svg style={[styles.starfieldSvg, { height: TRAJ_PLOT_H }]} viewBox={`0 0 ${width} ${STARFIELD_HEIGHT}`} preserveAspectRatio="xMidYMid slice">
                    {stars.map((s, i) => (
                      <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={`rgba(255,255,255,${s.op})`} />
                    ))}
                  </Svg>
                  <View
                    style={[RNStyleSheet.absoluteFill, { height: TRAJ_PLOT_H }]}
                    onLayout={(e) => { trajectoryChartWidthRef.current = e.nativeEvent.layout.width; }}
                    {...trajectoryPanResponder.panHandlers}
                  >
                    <Svg width="100%" height={TRAJ_PLOT_H} viewBox={`0 0 320 ${TRAJ_PLOT_H}`} preserveAspectRatio="xMidYMid meet" pointerEvents="none">
                      {trajectoryDataPerNode.map((arr, ni) => {
                        const lineOffset = ni * 22;
                        const pts = arr.map((v, i) => ({ x: trajectoryX(i), y: trajectoryY(v) + lineOffset }));
                        const path = buildCurvePath(pts);
                        const pulseOffset = trajectoryPulseDash[ni] ?? 0;
                        return (
                          <React.Fragment key={nodes[ni]?.id || ni}>
                            <Path d={path} stroke={nodes[ni]?.color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
                            <Path d={path} stroke={nodes[ni]?.color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="28 400" strokeDashoffset={pulseOffset} />
                          </React.Fragment>
                        );
                      })}
                      <Path d={avgPath} stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
                      {trajectoryDragX != null && (
                        <>
                          <Line x1={trajectoryDragX} y1={24} x2={trajectoryDragX} y2={24 + TRAJ_CHART_H} stroke="rgba(255,255,255,0.6)" strokeWidth="1" />
                          <Circle cx={trajectoryDragX} cy={trajectoryY(interpolatedAvg(trajectoryDragX))} r={8} fill="#FFFFFF" fillOpacity="0.35" />
                          <Circle cx={trajectoryDragX} cy={trajectoryY(interpolatedAvg(trajectoryDragX))} r={4} fill="#FFFFFF" />
                        </>
                      )}
                      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                        <Line key={i} x1={(i / 6) * 320} y1={182} x2={(i / 6) * 320} y2={196} stroke={THEME.textDim} strokeWidth={0.5} opacity={0.6} />
                      ))}
                    </Svg>
                  </View>
                </View>
                <View style={styles.trajectoryPastLogsRow}>
                  <Text style={styles.trajectoryPastLogsLabel}>PAST LOGS</Text>
                </View>
              </>
            )}

            {atlasGraphView === 'constellation' && (() => {
              const ROW_H = 52;
              const VB_W = 320;
              const sr = (seed: number) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x); };
              const completedForNode = (n: Node) => n.goals.reduce((acc, g) => acc + g.tasks.filter(t => t.completed).length, 0);
              return (
                <View style={{ width: '100%', marginBottom: 4 }}>
                  {nodes.map((node) => {
                    const seed = node.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
                    const completed = completedForNode(node);
                    const brightCount = Math.max(2, completed);
                    const dimDots = Array.from({ length: 38 }, (_, i) => ({
                      x: 8 + sr(seed + i * 7.3) * (VB_W - 16),
                      y: 6 + sr(seed + i * 13.7 + 100) * (ROW_H - 14),
                    }));
                    const brightDots = Array.from({ length: brightCount }, (_, i) => ({
                      x: 8 + sr(seed + 2000 + i * 11.1) * (VB_W - 16),
                      y: 6 + sr(seed + 2000 + i * 17.3 + 1) * (ROW_H - 14),
                    }));
                    return (
                      <View key={node.id} style={{ height: ROW_H, width: '100%' }}>
                        <Svg width="100%" height={ROW_H} viewBox={`0 0 ${VB_W} ${ROW_H}`} preserveAspectRatio="xMidYMid meet">
                          {dimDots.map((d, i) => (
                            <Circle key={`d-${i}`} cx={d.x} cy={d.y} r={1.2} fill={node.color} fillOpacity={0.32} />
                          ))}
                          {brightDots.map((d, i) => (
                            <React.Fragment key={`b-${i}`}>
                              <Circle cx={d.x} cy={d.y} r={5} fill={node.color} fillOpacity={0.4} />
                              <Circle cx={d.x} cy={d.y} r={2} fill={node.color} fillOpacity={constellationPulseOpacityState} />
                            </React.Fragment>
                          ))}
                          <Line x1={0} y1={ROW_H - 1} x2={VB_W} y2={ROW_H - 1} stroke="#E2E8F0" strokeWidth="0.5" opacity={0.5} />
                        </Svg>
                      </View>
                    );
                  })}
                  <View style={styles.atlasLegend}>
                    {nodes.map((n) => (
                      <View key={n.id} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: n.color }]} />
                        <Text style={styles.legendLabel}>{n.name.toUpperCase()}</Text>
                        <Text style={styles.legendValue}>{getNodeAvg(n)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()}
          </View>

          {atlasGraphView === 'radar' && (
            <View style={styles.atlasLegend}>
              {nodes.map(n => (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.legendItem, atlasHighlightId === n.id && styles.legendItemHighlight]}
                  onPress={() => setAtlasHighlightId(prev => prev === n.id ? null : n.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.legendDot, { backgroundColor: n.color }]} />
                  <Text style={[styles.legendLabel, atlasHighlightId === n.id && styles.legendLabelHighlight]}>{n.name.toUpperCase()}</Text>
                  <Text style={styles.legendValue}>{getNodeAvg(n)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Structural Drift */}
      <FadingBorder style={{ marginBottom: 12 }}>
        <View style={styles.deflectionCard}>
          <View style={styles.deflectionRow}>
            <View style={styles.deflectionLeft}>
              <Text style={styles.deflectionLabel}>STRUCTURAL DRIFT</Text>
              <Text style={styles.deflectionValue}>{driftDelta === '0' ? '0 PT(S)' : `${driftDelta} PT(S)`}</Text>
            </View>
            <View style={styles.deflectionVLine} />
            <View style={styles.deflectionRight}>
              <Svg width={32} height={32} viewBox="0 0 24 24">
                <Path d={arrowPath} fill={arrowColor} />
              </Svg>
            </View>
          </View>
        </View>
      </FadingBorder>

      {/* Atlas Guidance */}
      <FadingBorder style={{ marginBottom: 20 }}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryHeading}>ATLAS GUIDANCE</Text>
          {[copilotContent.suggest1, copilotContent.suggest2].map((sug, idx) => (
            <View key={idx} style={[styles.summarySuggestionSection, idx === 1 && { marginBottom: 0 }]}>
              <Text style={styles.summarySuggestionLabel}>
                {sug.label.split(briefingHighlight.re).filter(Boolean).map((part, i) => {
                  const col = briefingHighlight.wordToColor[part.toUpperCase()];
                  return col ? <Text key={i} style={{ color: col }}>{part}</Text> : <Text key={i}>{part}</Text>;
                })}
              </Text>
              <TouchableOpacity style={styles.summarySuggestionBtn} onPress={() => onHandleSuggestion(sug)} activeOpacity={0.8}>
                <Text style={styles.summarySuggestionBtnText}>{SUGGESTION_BTN_LABELS[sug.action] || 'GO'}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </FadingBorder>
    </>
  );
};

const styles = StyleSheet.create({
  systemManifestCard: { backgroundColor: THEME.card, borderRadius: 12, padding: 20, marginBottom: 12, overflow: 'hidden', shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 },
  systemManifestPrimaryRow: { flexDirection: 'row', alignItems: 'stretch' },
  systemManifestLeft: { flex: 1, justifyContent: 'center' },
  systemManifestBracketLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  systemManifestBracketValue: { color: 'white', fontSize: 32, fontWeight: '200', letterSpacing: 2 },
  systemManifestVLine: { width: 0.5, backgroundColor: 'rgba(226,232,240,0.5)', marginHorizontal: 16 },
  systemManifestStatusBlock: { alignItems: 'flex-end', justifyContent: 'center', paddingLeft: 8 },
  atlasCard: { backgroundColor: THEME.card, borderRadius: 12, padding: 20, marginBottom: 20, overflow: 'hidden', position: 'relative', shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 },
  atlasCardContent: { alignItems: 'stretch', zIndex: 1 },
  atlasCardHeader: { backgroundColor: 'rgba(0,0,0,0.35)', marginHorizontal: -20, marginTop: -20, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: THEME.cardBorder },
  atlasCardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  atlasScoreBlock: { alignSelf: 'flex-start' },
  statLabel: { color: THEME.accent, fontSize: 14, fontWeight: '900', letterSpacing: 4, marginTop: 4 },
  atlasViewSwitcher: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignSelf: 'flex-end' },
  atlasViewTab: { paddingVertical: 4, paddingHorizontal: 6, marginLeft: 4, borderWidth: 1, borderColor: 'transparent' },
  atlasViewTabActive: { borderColor: THEME.accent },
  atlasStarfieldContainer: { position: 'relative', overflow: 'hidden', minHeight: 240 },
  starfieldSvg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  radarWrapper: { height: 240, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  radarRotWrap: { height: 240, width: 240 },
  atlasLegend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', width: '100%', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  legendItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, marginRight: 12, marginBottom: 6, borderRadius: 6 },
  legendItemHighlight: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 1, marginRight: 6 },
  legendLabelHighlight: { color: THEME.accent },
  legendValue: { color: 'white', fontSize: 14, fontWeight: '300' },
  trajectoryPastLogsRow: { paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  trajectoryPastLogsLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  deflectionCard: { backgroundColor: THEME.card, borderRadius: 12, padding: 20, overflow: 'hidden', shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 },
  deflectionRow: { flexDirection: 'row', alignItems: 'stretch' },
  deflectionLeft: { flex: 1, justifyContent: 'center' },
  deflectionLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  deflectionValue: { color: 'white', fontSize: 28, fontWeight: '200', letterSpacing: 2 },
  deflectionVLine: { width: 0.5, backgroundColor: 'rgba(226,232,240,0.5)', marginHorizontal: 16 },
  deflectionRight: { alignItems: 'center', justifyContent: 'center', paddingLeft: 8 },
  summaryCard: { backgroundColor: THEME.card, borderRadius: 12, padding: 20, overflow: 'hidden', shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 },
  summaryHeading: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4, marginBottom: 18 },
  summarySuggestionSection: { borderWidth: 1, borderColor: THEME.cardBorder, borderRadius: 10, padding: 14, marginBottom: 12 },
  summarySuggestionLabel: { color: THEME.border, fontSize: 14, fontWeight: '600', letterSpacing: 1, marginBottom: 14 },
  summarySuggestionBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, alignSelf: 'flex-start' },
  summarySuggestionBtnText: { color: THEME.accent, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
});
