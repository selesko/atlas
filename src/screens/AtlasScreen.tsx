import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  PanResponder, Animated, Pressable, StyleSheet as RNStyleSheet, Easing, Modal,
  TextInput, ScrollView,
} from 'react-native';
import Svg, {
  Circle, Polygon, G, Rect, Path, Defs,
  RadialGradient, Stop, Line, LinearGradient,
  Text as SvgText,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../stores/useAppStore';
import { FadingBorder } from '../components/FadingBorder';
import { THEME } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { GlassCard } from '../components/GlassCard';
import { Radar } from '../components/Radar';
import { AtlasGraphView, Node, Goal, Action, ActionEffort } from '../types';

const { width } = Dimensions.get('window');
const STARFIELD_HEIGHT = 360;

// ─── Real trajectory helpers ──────────────────────────────────────────────────

/** Returns the past N days as YYYY-MM-DD strings, oldest first. */
function getPastDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().split('T')[0];
  });
}

/**
 * For a single coordinate, return the best known score for a given day.
 * Walks scoreHistory for the most recent entry on or before that day.
 * Falls back to the current value if no history exists yet.
 */
function scoreForDay(goal: Goal, day: string): number {
  const hist = goal.scoreHistory;
  if (!hist || hist.length === 0) return goal.value;
  const candidates = hist
    .filter(h => h.date.split('T')[0] <= day)
    .sort((a, b) => b.date.localeCompare(a.date));
  return candidates.length > 0 ? candidates[0].value : goal.value;
}

/**
 * Compute a 7-point trajectory for a single node.
 * Each point is the average coordinate score for that day.
 */
function getNodeTrajectory(node: Node): number[] {
  const days = getPastDays(7);
  if (node.goals.length === 0) return Array(7).fill(0);
  return days.map(day => {
    const scores = node.goals.map(g => scoreForDay(g, day));
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  });
}

/**
 * System-wide 7-day trajectory: average node trajectory across all nodes.
 * Returns 7 values (oldest → today), each clamped 0–10.
 */
function getSystemTrajectory(nodes: Node[]): number[] {
  if (nodes.length === 0) return Array(7).fill(0);
  const nodeTrajs = nodes.map(getNodeTrajectory);
  return Array.from({ length: 7 }, (_, i) =>
    Math.min(10, Math.max(0,
      nodeTrajs.reduce((s, t) => s + t[i], 0) / nodes.length
    ))
  );
}

/** Build a smooth cubic bezier SVG path through an array of {x,y} points. */
function buildCurvePath(pts: Array<{ x: number; y: number }>): string {
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
}

// ─── Trajectory range helpers ─────────────────────────────────────────────────

export type TrajectoryRange = '1W' | '1M' | '1Y' | 'ALL';

/** Returns data points {date, value} for the selected range.
 *  1W/1M → daily. 1Y → weekly. ALL → weekly from earliest scoreHistory. */
function getTrajectoryPoints(nodes: Node[], range: TrajectoryRange): Array<{ date: string; value: number }> {
  if (nodes.length === 0) return [];

  let days: string[];

  if (range === '1W') {
    days = getPastDays(7);
  } else if (range === '1M') {
    days = getPastDays(30);
  } else if (range === '1Y') {
    // 52 weekly anchor points
    days = Array.from({ length: 52 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (51 - i) * 7);
      return d.toISOString().split('T')[0];
    });
  } else {
    // ALL: weekly from the earliest recorded scoreHistory date
    let earliest = new Date();
    for (const node of nodes) {
      for (const goal of node.goals) {
        for (const h of goal.scoreHistory || []) {
          const d = new Date(h.date);
          if (d < earliest) earliest = d;
        }
      }
    }
    const now = new Date();
    const weeks: string[] = [];
    const cursor = new Date(earliest);
    while (cursor <= now) {
      weeks.push(cursor.toISOString().split('T')[0]);
      cursor.setDate(cursor.getDate() + 7);
    }
    if (weeks.length === 0) weeks.push(now.toISOString().split('T')[0]);
    days = weeks;
  }

  return days.map(day => {
    const nodeScores = nodes.map(node => {
      if (node.goals.length === 0) return 0;
      const gs = node.goals.map(g => scoreForDay(g, day));
      return gs.reduce((a, b) => a + b, 0) / gs.length;
    });
    const value = Math.min(10, Math.max(0,
      nodeScores.reduce((a, b) => a + b, 0) / nodes.length
    ));
    return { date: day, value };
  });
}

/** Short label for a date given the active range. */
function formatTrajDate(dateStr: string, range: TrajectoryRange): string {
  const d = new Date(dateStr + 'T00:00:00');
  const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  if (range === '1W') return DAYS[d.getDay()];
  if (range === '1M') return `${d.getDate()}/${d.getMonth() + 1}`;
  return `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}


interface CopilotAction {
  label: string;
  action: string;
  nodeId?: string;
  goalId?: string;
}

// ─── Effort constants (used in popup orbital graphic) ────────────────────────

const EFFORT_WEIGHT: Record<ActionEffort, number> = { easy: 1, medium: 2, heavy: 3 };
const EFFORT_ANGLE_OFFSET: Record<ActionEffort, number> = {
  easy:   0,
  medium: Math.PI / 3,
  heavy:  (2 * Math.PI) / 3,
};
// Fixed radii for single-node popup (no spacing constraint)
const POPUP_EFFORT_ORBIT: Record<ActionEffort, number> = { easy: 24, medium: 38, heavy: 52 };
const POPUP_EFFORT_DOT_R: Record<ActionEffort, number> = { easy: 2.5, medium: 4, heavy: 6 };
const POPUP_EFFORT_DOT_OP: Record<ActionEffort, number> = { easy: 0.32, medium: 0.65, heavy: 1.0 };

interface AtlasScreenProps {
  guidanceActions: CopilotAction[];
  onAction: (a: CopilotAction) => void;
  onOpenCoordinate?: (nodeId: string, goalId: string) => void;
  onOpenAction?: (nodeId: string, goalId: string, actionId: string) => void;
  onGoToNode?: (nodeId: string) => void;
  onGoToActions?: (nodeId: string) => void;
}

const ACTION_BTN_LABELS: Record<string, string> = {
  calibrate: 'CALIBRATE',
  addCalibration: 'ADD CALIBRATION',
  prioritize: 'PRIORITIZE',
  deployTask: 'ADD ACTION',
};

export const AtlasScreen: React.FC<AtlasScreenProps> = ({
  guidanceActions,
  onAction,
  onOpenCoordinate,
  onOpenAction,
  onGoToNode,
  onGoToActions,
}) => {
  const { nodes: allNodes, getNodeAvg, themeMode, persona, updateGoal, updateValue, toggleAction, addAction, updateActionEffort, saveActionEdit } = useAppStore();
  const nodes = allNodes.filter(n => !n.archived);
  const theme = useTheme();

  const [atlasGraphView, setAtlasGraphView] = useState<AtlasGraphView>('nodes');
  const [atlasHighlightId, setAtlasHighlightId] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<{type: 'node'|'coordinate'|'action', data: any} | null>(null);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [stars, setStars] = useState<Array<{ cx: number; cy: number; r: number; op: number }>>([]);
  const [radarPulseScale, setRadarPulseScale] = useState(1);
  const [nodeBreathValue, setNodeBreathValue] = useState(0);

  const [newActionTitle, setNewActionTitle] = useState('');
  const [cardTab, setCardTab] = useState<'coordinates' | 'actions' | 'details'>('coordinates');
  const [actionNodeDropdownOpen, setActionNodeDropdownOpen] = useState(false);
  const [actionCoordDropdownOpen, setActionCoordDropdownOpen] = useState(false);

  // Trajectory modal
  const [trajectoryOpen, setTrajectoryOpen] = useState(false);
  const [trajectoryRange, setTrajectoryRange] = useState<TrajectoryRange>('1W');
  const trajectoryScrollRef = useRef<ScrollView>(null);

  // Reset tab and input when entity changes
  useEffect(() => {
    setNewActionTitle('');
    setActionNodeDropdownOpen(false);
    setActionCoordDropdownOpen(false);
    if (selectedEntity?.type === 'coordinate') setCardTab('details');
    else setCardTab('coordinates');
  }, [selectedEntity?.type, selectedEntity?.data?.id]);

  const coordSliderTrackWidth = useRef<number>(0);
  const nodeCardTrackWidths = useRef<Record<string, number>>({});
  const radarRotation = useRef(new Animated.Value(0)).current;
  const radarScale = useRef(new Animated.Value(1)).current;
  const nodeBreathAnim = useRef(new Animated.Value(0)).current;
  const zoomAnim = useRef(new Animated.Value(1)).current;

  // Jump Drive Zoom Effect
  useEffect(() => {
    setSelectedEntity(null);
    zoomAnim.setValue(0.7);
    Animated.timing(zoomAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [atlasGraphView]);

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
    radarRotation.setValue(0);
    Animated.loop(
      Animated.timing(radarRotation, {
        toValue: 1,
        duration: 90000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();
  }, [atlasGraphView]);

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



  const radarRotStyle = {
    transform: [{ rotate: radarRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
  };



  const isDark = themeMode === 'dark';

  const getSystemStatusLabel = () => {
    if (persona === 'Seeker') return 'CURRENT ALIGNMENT';
    if (persona === 'Spiritual') return 'INNER HARMONY';
    return 'SYSTEM STATUS';
  };

  // Derived values
  const systemBalance = (nodes.reduce((acc, n) => acc + parseFloat(getNodeAvg(n)), 0) / (nodes.length || 1)).toFixed(1);

  const radarPts = useMemo(() => nodes.map((n, i) => {
    const angle = (i * 2 * Math.PI) / (nodes.length || 1) - Math.PI / 2;
    const r = (parseFloat(getNodeAvg(n)) / 10) * 120;
    return { x: r * Math.cos(angle), y: r * Math.sin(angle), color: n.color, id: n.id, r };
  }), [nodes]);


  // ── Real 7-day system trajectory ─────────────────────────────────────────────
  const SPARKLINE_W = 80;
  const SPARKLINE_H = 28;

  const systemTrajectory = useMemo(() => getSystemTrajectory(nodes), [nodes]);

  const sparkPts = systemTrajectory.map((v, i) => ({
    x: (i / 6) * SPARKLINE_W,
    y: SPARKLINE_H - (v / 10) * SPARKLINE_H,
  }));
  const sparkPath = buildCurvePath(sparkPts);

  // Trend: positive if today > 3-day-ago average
  const trendUp = systemTrajectory[6] >= systemTrajectory[3];
  const trendDelta = +(systemTrajectory[6] - systemTrajectory[0]).toFixed(1);
  const trendDeltaStr = trendDelta > 0 ? `+${trendDelta}` : `${trendDelta}`;

  // Trajectory modal data
  const trajectoryPoints = useMemo(
    () => getTrajectoryPoints(nodes, trajectoryRange),
    [nodes, trajectoryRange]
  );
  const TRAJ_CHART_H = 140;
  const TRAJ_LABEL_H = 28;
  const TRAJ_PT_W: Record<TrajectoryRange, number> = { '1W': 46, '1M': 22, '1Y': 18, 'ALL': 18 };
  const ptW = TRAJ_PT_W[trajectoryRange];
  const trajChartW = Math.max(trajectoryPoints.length * ptW, width - 48);
  const trajMin = trajectoryPoints.length ? Math.min(...trajectoryPoints.map(p => p.value)) : 0;
  const trajMax = trajectoryPoints.length ? Math.max(...trajectoryPoints.map(p => p.value)) : 10;
  const trajRange = Math.max(trajMax - trajMin, 1);
  const toY = (v: number) => TRAJ_CHART_H - 16 - ((v - trajMin) / trajRange) * (TRAJ_CHART_H - 28);
  const trajPts = trajectoryPoints.map((p, i) => ({ x: i * ptW + ptW / 2, y: toY(p.value) }));
  const trajPath = buildCurvePath(trajPts);
  const trajDelta = trajectoryPoints.length >= 2
    ? +(trajectoryPoints[trajectoryPoints.length - 1].value - trajectoryPoints[0].value).toFixed(1)
    : 0;
  const trajUp = trajDelta >= 0;
  const trajColor = trajUp ? '#4ade80' : '#fb7185';

  // Which labels to show (thin out for readability)
  const labelStride = trajectoryRange === '1W' ? 1 : trajectoryRange === '1M' ? 5 : trajectoryRange === '1Y' ? 4 : 6;

  return (
    <>
      {/* System Status — borderless, floating */}
      {(() => {
        const score = parseFloat(systemBalance);
        const fullDashes = Math.floor(score);
        const fraction = score - fullDashes; // 0.0–0.99, for the partial dash
        const glowColor = theme.accent;
        return (
          <View style={{ paddingHorizontal: 4, paddingTop: 8, paddingBottom: 20, marginBottom: 4 }}>
            <Text style={{ color: theme.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 3, marginBottom: 14 }}>
              {getSystemStatusLabel()}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              {/* Glowing score circle */}
              <View style={{
                width: 68, height: 68, borderRadius: 34,
                borderWidth: 1.5, borderColor: glowColor + '60',
                alignItems: 'center', justifyContent: 'center',
                shadowColor: glowColor, shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
                backgroundColor: glowColor + '08',
              }}>
                <Text style={{ color: theme.text, fontSize: 24, fontWeight: '600', letterSpacing: 0.5 }}>{systemBalance}</Text>
              </View>
              {/* 10 glowing dashes — full, partial, and empty */}
              <View style={{ flex: 1, flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                {Array.from({ length: 10 }, (_, i) => {
                  const isFull = i < fullDashes;
                  const isPartial = i === fullDashes && fraction > 0.05;
                  // Partial dash: render an empty track with a lit fill overlay
                  if (isPartial) {
                    return (
                      <View
                        key={i}
                        style={{
                          flex: 1, height: 7, borderRadius: 4,
                          backgroundColor: 'rgba(255,255,255,0.07)',
                          overflow: 'hidden',
                        }}
                      >
                        <View style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0,
                          width: `${Math.round(fraction * 100)}%`,
                          borderRadius: 4,
                          backgroundColor: glowColor,
                          shadowColor: glowColor,
                          shadowOpacity: 0.8,
                          shadowRadius: 6,
                          shadowOffset: { width: 0, height: 0 },
                          opacity: 0.75,
                        }} />
                      </View>
                    );
                  }
                  return (
                    <View
                      key={i}
                      style={{
                        flex: 1, height: 7, borderRadius: 4,
                        backgroundColor: isFull ? glowColor : 'rgba(255,255,255,0.07)',
                        shadowColor: isFull ? glowColor : 'transparent',
                        shadowOpacity: isFull ? 0.9 : 0,
                        shadowRadius: isFull ? 8 : 0,
                        shadowOffset: { width: 0, height: 0 },
                      }}
                    />
                  );
                })}
              </View>
            </View>
          </View>
        );
      })()}

      {/* Atlas Card */}
      <GlassCard style={styles.atlasCard}>
        <View style={styles.atlasCardContent}>
          {/* Header row with view switcher */}
          <View style={[styles.atlasCardHeader, styles.atlasCardHeaderRow, { backgroundColor: 'transparent', borderBottomColor: theme.divider }]}>
            <View style={styles.atlasScoreBlock}>
              <Text style={[styles.statLabel, { color: theme.textMuted, fontWeight: '800', letterSpacing: 2 }]}>
                {atlasGraphView === 'nodes' ? 'NODES' : atlasGraphView === 'coordinates' ? 'COORDINATES' : 'ACTIONS'}
              </Text>
            </View>
            <View style={styles.atlasViewSwitcher}>
              {(['nodes', 'coordinates', 'actions'] as const).map(v => {
                const c = atlasGraphView === v ? theme.accent : theme.textMuted;
                return (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setAtlasGraphView(v)}
                    style={[styles.atlasViewTab, atlasGraphView === v && styles.atlasViewTabActive]}
                    activeOpacity={0.8}
                  >
                    {v === 'nodes' && (
                      <Svg width={22} height={22} viewBox="0 0 120 120">
                        <Circle cx="60" cy="60" r="40" stroke={c} strokeWidth="2" fill="none" opacity={0.25} />
                        <Circle cx="60" cy="60" r="16" fill={c} />
                        <Circle cx="20" cy="60" r="8" fill={atlasGraphView === 'nodes' ? "#A78BFA" : c} />
                        <Circle cx="80" cy="25" r="10" fill={atlasGraphView === 'nodes' ? "#34D399" : c} />
                        <Circle cx="88" cy="88" r="7" fill={atlasGraphView === 'nodes' ? "#F472B6" : c} />
                      </Svg>
                    )}
                    {v === 'coordinates' && (
                      <Svg width={22} height={22} viewBox="0 0 120 120">
                        <Circle cx="60" cy="60" r="12" fill={c} />
                        <Line x1="60" y1="60" x2="25" y2="35" stroke={c} strokeWidth="3" opacity={0.5} />
                        <Circle cx="25" cy="35" r="8" fill={c} opacity={0.8} />
                        <Line x1="60" y1="60" x2="100" y2="50" stroke={c} strokeWidth="3" opacity={0.5} />
                        <Circle cx="100" cy="50" r="10" fill={c} opacity={0.8} />
                        <Line x1="60" y1="60" x2="50" y2="100" stroke={c} strokeWidth="3" opacity={0.5} />
                        <Circle cx="50" cy="100" r="7" fill={c} opacity={0.8} />
                      </Svg>
                    )}
                    {v === 'actions' && (
                      <Svg width={22} height={22} viewBox="0 0 120 120">
                        <Circle cx="60" cy="60" r="30" stroke={c} strokeWidth="4" fill="none" opacity={0.5} />
                        <Circle cx="60" cy="30" r="6" fill={c} />
                        <Circle cx="81" cy="81" r="6" fill={c} />
                        <Circle cx="39" cy="81" r="6" fill={c} />
                        <Path d="M57 30 L60 33 L64 27" stroke={atlasGraphView === 'actions' ? "#10B981" : c} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        <Path d="M78 81 L81 84 L85 78" stroke={atlasGraphView === 'actions' ? "#10B981" : c} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </Svg>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Visualization */}
          <View style={styles.atlasStarfieldContainer}>
            {/* Unified Ethereal Background & Stars for all views */}
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

            {/* Render Graphic with Jump Drive Zoom Effect */}
            <Animated.View style={[{ flex: 1 }, { opacity: zoomAnim, transform: [{ scale: zoomAnim }] }]}>
              {atlasGraphView === 'nodes' && (
                <View style={styles.radarWrapper}>
                  <Animated.View style={[styles.radarRotWrap, radarRotStyle]}>
                    <Svg width={340} height={340} viewBox="0 0 340 340" onPress={(e: any) => {
                      const locX = e.nativeEvent.locationX;
                      const locY = e.nativeEvent.locationY;
                      let clickedNode = null;
                      const pts = radarPts.map(p => ({ ...p, x: p.x + 170, y: p.y + 170 }));
                      for (const p of pts) {
                        if (Math.sqrt(Math.pow(p.x - locX, 2) + Math.pow(p.y - locY, 2)) < 40) {
                          clickedNode = p;
                          break;
                        }
                      }
                      if (clickedNode) {
                        const fullNode = nodes.find(n => n.id === clickedNode.id);
                        if (fullNode) setSelectedEntity({ type: 'node', data: fullNode });
                      } else {
                        setExplainerOpen(true);
                      }
                    }}>
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
                      <G transform="translate(170, 170)">
                        <G opacity={isDark ? 0.06 : 0.2}>
                          {[30, 60, 90, 120].map(r => <Circle key={r} r={r} stroke={isDark ? "#C0C0C0" : "#FEF08A"} strokeWidth="0.5" fill="none" />)}
                        </G>
                        {(() => {
                          const breathRadius = 9;
                          return (
                            <>
                              {/* Central Sun */}
                              <Circle cx={0} cy={0} r={14} fill="#FFFFFF" />
                              <Circle cx={0} cy={0} r={28} fill="#FFFFFF" opacity={0.15} />
                              <Circle cx={0} cy={0} r={46} fill="#FFFFFF" opacity={0.05} />
                              
                              {/* Orbits, Radials, and Nodes */}
                              {radarPts.map((p, i) => {
                                const hi = atlasHighlightId === p.id;
                                const isActive = !atlasHighlightId || hi;
                                const nodeColor = isActive ? p.color : theme.divider;
                                return (
                                  <G key={i} pointerEvents="none">
                                    {isActive && (
                                      <Circle cx={p.x} cy={p.y} r={hi ? breathRadius + 32 : breathRadius + 22} fill={`url(#glow-${p.id})`} opacity={0.75} />
                                    )}
                                    <Circle cx={p.x} cy={p.y} r={hi ? 12 : 9} fill={nodeColor} opacity={isActive ? 1 : 0.25} />
                                  </G>
                                );
                              })}
                            </>
                          );
                        })()}
                      </G>
                    </Svg>
                  </Animated.View>
                </View>
              )}

              {atlasGraphView !== 'nodes' && (
                <Radar 
                  nodes={nodes} 
                  view={atlasGraphView} 
                  theme={theme} 
                  activeNodeId={atlasHighlightId} 
                  onEntityPress={(type, data) => setSelectedEntity({ type, data })}
                  onEmptyPress={() => setExplainerOpen(true)}
                />
              )}
            </Animated.View>

          </View>

          <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
            <Text style={{ color: THEME.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 12, textTransform: 'uppercase' }}>
              SELECT NODE TO FOCUS:
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', width: '100%' }}>
              {nodes.map(n => (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.legendItem, { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' }, atlasHighlightId === n.id && styles.legendItemHighlight]}
                  onPress={() => setAtlasHighlightId(prev => prev === n.id ? null : n.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.legendDot, { backgroundColor: n.color }]} />
                  <Text style={[styles.legendLabel, { color: theme.textMuted }, atlasHighlightId === n.id && { color: theme.accent }]}>{n.name.toUpperCase()}</Text>
                  <Text style={[styles.legendValue, { color: theme.text }]}>{getNodeAvg(n)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </GlassCard>


      {/* 7-day trend line — tap to expand */}
      <TouchableOpacity onPress={() => setTrajectoryOpen(true)} activeOpacity={0.85}>
        <GlassCard style={styles.trendCard}>
          {/* Trend header: label + delta + tag */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ color: theme.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 2.5 }}>7-DAY TRAJECTORY</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {trendDelta !== 0 && (
                <Text style={{ color: trendUp ? '#4ade80' : '#fb7185', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
                  {trendDeltaStr}
                </Text>
              )}
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: trendUp ? 'rgba(74,222,128,0.1)' : 'rgba(251,113,133,0.1)' }}>
                <Text style={{ color: trendUp ? '#4ade80' : '#fb7185', fontSize: 9, fontWeight: '700', letterSpacing: 1.5 }}>
                  {trendUp ? '↑ UP' : '↓ DOWN'}
                </Text>
              </View>
              <Text style={{ color: theme.textMuted, fontSize: 9, opacity: 0.5 }}>›</Text>
            </View>
          </View>
          <Svg width="100%" height={44} viewBox={`0 0 ${SPARKLINE_W * 3} 44`} preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={trendUp ? '#4ade80' : '#fb7185'} stopOpacity="0.2" />
                <Stop offset="100%" stopColor={trendUp ? '#4ade80' : '#fb7185'} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            {sparkPath ? (() => {
              const scaledPts = systemTrajectory.map((v, i) => ({
                x: (i / 6) * (SPARKLINE_W * 3),
                y: 38 - (v / 10) * 32,
              }));
              const scaledPath = buildCurvePath(scaledPts);
              const fillPath = scaledPath + ` L${SPARKLINE_W * 3} 44 L0 44 Z`;
              return (
                <>
                  <Path d={fillPath} fill="url(#sparkFill)" />
                  <Path d={scaledPath} stroke={trendUp ? '#4ade80' : '#fb7185'} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx={scaledPts[6].x} cy={scaledPts[6].y} r={3.5} fill={trendUp ? '#4ade80' : '#fb7185'} />
                </>
              );
            })() : null}
          </Svg>
        </GlassCard>
      </TouchableOpacity>


      {/* Interactive Detail Modal — rendered outside chart container so it's never clipped */}
      <Modal visible={!!selectedEntity} transparent animationType="fade" onRequestClose={() => { setSelectedEntity(null); setNewActionTitle(''); }}>
        {selectedEntity && (() => {
          const activeNodeForColor = nodes.find(n => n.id === (atlasHighlightId || nodes[0]?.id));
          const entityColor = selectedEntity.type === 'node' ? selectedEntity.data.color : activeNodeForColor?.color || THEME.accent;

          if (selectedEntity.type === 'node') {
            const node = selectedEntity.data;
            const allNodeActions = node.goals.flatMap((g: any) => g.actions.filter((a: any) => !a.archived));
            const easyActs   = allNodeActions.filter((a: any) => (a.effort ?? 'easy') === 'easy');
            const mediumActs = allNodeActions.filter((a: any) => (a.effort ?? 'easy') === 'medium');
            const heavyActs  = allNodeActions.filter((a: any) => (a.effort ?? 'easy') === 'heavy');
            const PW = 280; const PH = 150;
            const PCX = PW / 2; const PCY = PH / 2;
            const renderOrbitalSats = (acts: any[], effort: ActionEffort) =>
              acts.map((action: any, ai: number) => {
                const angle = (ai / Math.max(acts.length, 1)) * Math.PI * 2 + EFFORT_ANGLE_OFFSET[effort] + 0.3;
                const r = POPUP_EFFORT_ORBIT[effort];
                const ax = PCX + r * Math.cos(angle);
                const ay = PCY + r * Math.sin(angle);
                const dotR = POPUP_EFFORT_DOT_R[effort];
                return (
                  <G key={action.id}>
                    {effort === 'heavy' && <Circle cx={ax} cy={ay} r={dotR * 2.4} fill="url(#ph)" />}
                    <Circle cx={ax} cy={ay} r={dotR} fill={node.color} opacity={POPUP_EFFORT_DOT_OP[effort]} />
                  </G>
                );
              });
            return (
              <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 16 }} onPress={() => setSelectedEntity(null)}>
                <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420 }}>
                  <View style={{ backgroundColor: 'rgba(10,18,36,0.97)', borderRadius: 24, borderWidth: 1, borderColor: node.color + '55', overflow: 'hidden' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: node.color }} />
                        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800', letterSpacing: 1.5 }}>{node.name.toUpperCase()}</Text>
                      </View>
                      <TouchableOpacity onPress={() => setSelectedEntity(null)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                        <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: node.color + '25' }}>
                      <Svg width="100%" height={PH} viewBox={`0 0 ${PW} ${PH}`} preserveAspectRatio="xMidYMid meet">
                        <Defs>
                          <RadialGradient id="ph" cx="50%" cy="50%" r="50%">
                            <Stop offset="0%" stopColor={node.color} stopOpacity="0.28" />
                            <Stop offset="100%" stopColor={node.color} stopOpacity="0" />
                          </RadialGradient>
                        </Defs>
                        {easyActs.length > 0 && <Circle cx={PCX} cy={PCY} r={POPUP_EFFORT_ORBIT.easy}   stroke={node.color} strokeWidth={0.5} fill="none" opacity={0.14} />}
                        {mediumActs.length > 0 && <Circle cx={PCX} cy={PCY} r={POPUP_EFFORT_ORBIT.medium} stroke={node.color} strokeWidth={0.5} fill="none" opacity={0.10} />}
                        {heavyActs.length > 0 && <Circle cx={PCX} cy={PCY} r={POPUP_EFFORT_ORBIT.heavy}  stroke={node.color} strokeWidth={0.5} fill="none" opacity={0.07} />}
                        <Circle cx={PCX} cy={PCY} r={16} fill={node.color} opacity={0.10} />
                        <Circle cx={PCX} cy={PCY} r={5.5} fill={node.color} opacity={0.95} />
                        {renderOrbitalSats(easyActs, 'easy')}
                        {renderOrbitalSats(mediumActs, 'medium')}
                        {renderOrbitalSats(heavyActs, 'heavy')}
                        {allNodeActions.length === 0 && (
                          <SvgText x={PCX} y={PCY + 4} fontSize={10} fill="rgba(255,255,255,0.18)" textAnchor="middle">NO ACTIONS YET</SvgText>
                        )}
                      </Svg>
                    </View>
                    {/* Tab bar */}
                    <View style={{ flexDirection: 'row', marginHorizontal: 20, marginTop: 14, marginBottom: 2, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                      {(['coordinates', 'actions'] as const).map(tab => {
                        const active = cardTab === tab;
                        const openCount = allNodeActions.filter((a: any) => !a.completed).length;
                        const label = tab === 'coordinates' ? 'COORDINATES' : `ACTIONS${openCount > 0 ? ` · ${openCount}` : ''}`;
                        return (
                          <TouchableOpacity
                            key={tab}
                            style={{ flex: 1, paddingVertical: 9, alignItems: 'center', backgroundColor: active ? node.color + '22' : 'transparent', borderBottomWidth: 2, borderBottomColor: active ? node.color : 'transparent' }}
                            onPress={() => setCardTab(tab)}
                            activeOpacity={0.7}
                          >
                            <Text style={{ color: active ? node.color : theme.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }}>{label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Tab content — capped height so card stays compact */}
                    <ScrollView style={{ maxHeight: 210 }} showsVerticalScrollIndicator={false}>
                      {cardTab === 'coordinates' && (
                        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}>
                          {node.goals.filter((g: any) => !g.archived).map((g: any) => {
                            const trackKey = `${node.id}-${g.id}`;
                            const applySlide = (evt: { nativeEvent: { locationX: number } }) => {
                              const w = nodeCardTrackWidths.current[trackKey];
                              if (!w || w <= 0) return;
                              const x = Math.max(0, Math.min(evt.nativeEvent.locationX, w));
                              const val = Math.max(1, Math.min(10, Math.round((x / w) * 9) + 1));
                              updateValue(node.id, g.id, val);
                              Haptics.selectionAsync();
                            };
                            const pan = PanResponder.create({
                              onStartShouldSetPanResponder: () => true,
                              onPanResponderGrant: applySlide,
                              onPanResponderMove: applySlide,
                            });
                            const liveGoal = nodes.find(n => n.id === node.id)?.goals.find((lg: any) => lg.id === g.id);
                            const val = liveGoal?.value ?? g.value;
                            return (
                              <View key={g.id} style={{ marginBottom: 18 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                  <Text style={{ color: theme.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 }}>{g.name.toUpperCase()}</Text>
                                  <Text style={{ color: node.color, fontSize: 10, fontWeight: '700' }}>{val.toFixed(1)}</Text>
                                </View>
                                <View
                                  style={{ height: 28, justifyContent: 'center' }}
                                  onLayout={e => { nodeCardTrackWidths.current[trackKey] = e.nativeEvent.layout.width; }}
                                  {...pan.panHandlers}
                                >
                                  <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 2 }} />
                                  <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 12, height: 3, width: `${(val / 10) * 100}%`, backgroundColor: node.color, borderRadius: 2, opacity: 0.8 }} />
                                  <View pointerEvents="none" style={{ position: 'absolute', left: `${(val / 10) * 100}%`, top: 7, marginLeft: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: node.color, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', shadowColor: node.color, shadowOpacity: 0.8, shadowRadius: 6 }} />
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {cardTab === 'actions' && (
                        <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>
                          {allNodeActions.length === 0 ? (
                            <Text style={{ color: theme.textMuted, fontSize: 12, fontStyle: 'italic', opacity: 0.6, marginBottom: 12 }}>No actions yet — add one below</Text>
                          ) : allNodeActions.map((a: any) => {
                            const parentGoal = node.goals.find((g: any) => g.actions.some((x: any) => x.id === a.id));
                            const efforts: ActionEffort[] = ['easy', 'medium', 'heavy'];
                            return (
                              <View key={a.id} style={{ paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                                <TouchableOpacity
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                                  onPress={() => {
                                    if (!parentGoal) return;
                                    toggleAction(node.id, parentGoal.id, a.id);
                                    const freshNode = useAppStore.getState().nodes.find(n => n.id === node.id);
                                    if (freshNode) setSelectedEntity(prev => prev ? { ...prev, data: freshNode } : null);
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <Svg width={18} height={18} viewBox="0 0 24 24">
                                    {a.completed ? (
                                      <><Circle cx="12" cy="12" r="10" fill={node.color} /><Path d="M7 12l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></>
                                    ) : (
                                      <Circle cx="12" cy="12" r="10" fill="none" stroke={theme.textMuted} strokeWidth="1.5" />
                                    )}
                                  </Svg>
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ color: a.completed ? theme.textMuted : theme.text, fontSize: 13, fontWeight: '500', textDecorationLine: a.completed ? 'line-through' : 'none', opacity: a.completed ? 0.5 : 1 }}>
                                      {a.title}
                                    </Text>
                                    {parentGoal && (
                                      <Text style={{ color: node.color, fontSize: 10, fontWeight: '600', opacity: 0.6, marginTop: 2 }}>{parentGoal.name}</Text>
                                    )}
                                  </View>
                                  {a.isPriority && <Text style={{ color: node.color, fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>★</Text>}
                                </TouchableOpacity>
                                {/* Effort toggle */}
                                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, marginLeft: 28 }}>
                                  {efforts.map(e => {
                                    const sel = (a.effort ?? 'easy') === e;
                                    return (
                                      <TouchableOpacity
                                        key={e}
                                        onPress={() => {
                                          if (!parentGoal) return;
                                          updateActionEffort(node.id, parentGoal.id, a.id, e);
                                          const freshNode = useAppStore.getState().nodes.find(n => n.id === node.id);
                                          if (freshNode) setSelectedEntity(prev => prev ? { ...prev, data: freshNode } : null);
                                        }}
                                        style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: sel ? node.color + '28' : 'transparent', borderWidth: 1, borderColor: sel ? node.color + '66' : 'rgba(255,255,255,0.1)' }}
                                        activeOpacity={0.7}
                                      >
                                        <Text style={{ color: sel ? node.color : theme.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 1 }}>{e.toUpperCase()}</Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              </View>
                            );
                          })}
                          {/* Inline add action */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, marginBottom: 8 }}>
                            <TextInput
                              style={{ flex: 1, color: theme.text, fontSize: 13, fontWeight: '500', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, borderWidth: 1, borderColor: node.color + '33' }}
                              placeholder="New action…"
                              placeholderTextColor={theme.textMuted}
                              value={newActionTitle}
                              onChangeText={setNewActionTitle}
                              returnKeyType="done"
                              autoCorrect={false}
                              autoCapitalize="none"
                              onSubmitEditing={() => {
                                if (!newActionTitle.trim() || node.goals.filter((g: any) => !g.archived).length === 0) return;
                                const firstGoal = node.goals.filter((g: any) => !g.archived)[0];
                                addAction(node.id, firstGoal.id, newActionTitle.trim(), 'easy');
                                const freshNode = useAppStore.getState().nodes.find(n => n.id === node.id);
                                if (freshNode) setSelectedEntity(prev => prev ? { ...prev, data: freshNode } : null);
                                setNewActionTitle('');
                              }}
                            />
                            <TouchableOpacity
                              style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: node.color + '22', borderWidth: 1, borderColor: node.color + '55' }}
                              onPress={() => {
                                if (!newActionTitle.trim() || node.goals.filter((g: any) => !g.archived).length === 0) return;
                                const firstGoal = node.goals.filter((g: any) => !g.archived)[0];
                                addAction(node.id, firstGoal.id, newActionTitle.trim(), 'easy');
                                const freshNode = useAppStore.getState().nodes.find(n => n.id === node.id);
                                if (freshNode) setSelectedEntity(prev => prev ? { ...prev, data: freshNode } : null);
                                setNewActionTitle('');
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={{ color: node.color, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>ADD</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </ScrollView>
                  </View>
                </Pressable>
              </Pressable>
            );
          }

          // ── Coordinate card ──────────────────────────────────────────────────
          if (selectedEntity.type === 'coordinate') {
            const coord = selectedEntity.data;
            const activeActions = (coord.actions as any[]).filter((a: any) => !a.archived);
            const pendingActions = activeActions.filter((a: any) => !a.completed);
            const completedActions = activeActions.filter((a: any) => a.completed);
            const sortedActions = [...pendingActions, ...completedActions];

            return (
              <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 }} onPress={() => { setSelectedEntity(null); setNewActionTitle(''); }}>
                <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420 }}>
                  <View style={{ backgroundColor: 'rgba(10,18,36,0.97)', borderRadius: 24, borderWidth: 1, borderColor: entityColor + '55', overflow: 'hidden' }}>

                    {/* Header: editable name + close */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, gap: 10 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: entityColor, flexShrink: 0 }} />
                      <TextInput
                        style={{ flex: 1, color: theme.text, fontSize: 15, fontWeight: '800', letterSpacing: 1.2 }}
                        value={coord.name}
                        onChangeText={(text) => {
                          updateGoal(coord.nodeId, coord.id, { name: text });
                          setSelectedEntity(prev => prev ? { ...prev, data: { ...prev.data, name: text } } : null);
                        }}
                        placeholderTextColor={theme.textMuted}
                        returnKeyType="done"
                        autoCorrect={false}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity onPress={() => setSelectedEntity(null)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                        <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>✕</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Tab bar */}
                    <View style={{ flexDirection: 'row', marginHorizontal: 20, marginTop: 14, marginBottom: 2, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                      {(['details', 'actions'] as const).map(tab => {
                        const active = cardTab === tab;
                        const openCount = pendingActions.length;
                        const label = tab === 'details' ? 'EVALUATE' : `ACTIONS${openCount > 0 ? ` · ${openCount}` : ''}`;
                        return (
                          <TouchableOpacity
                            key={tab}
                            style={{ flex: 1, paddingVertical: 9, alignItems: 'center', backgroundColor: active ? entityColor + '22' : 'transparent', borderBottomWidth: 2, borderBottomColor: active ? entityColor : 'transparent' }}
                            onPress={() => setCardTab(tab)}
                            activeOpacity={0.7}
                          >
                            <Text style={{ color: active ? entityColor : theme.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }}>{label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Tab content — capped height so card stays compact */}
                    <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                      {cardTab === 'details' && (() => {
                        const applySlide = (evt: { nativeEvent: { locationX: number } }) => {
                          const w = coordSliderTrackWidth.current;
                          if (w <= 0) return;
                          const x = Math.max(0, Math.min(evt.nativeEvent.locationX, w));
                          const val = Math.max(1, Math.min(10, Math.round((x / w) * 9) + 1));
                          updateValue(coord.nodeId, coord.id, val);
                          setSelectedEntity(prev => prev ? { ...prev, data: { ...prev.data, value: val } } : null);
                          Haptics.selectionAsync();
                        };
                        const pan = PanResponder.create({
                          onStartShouldSetPanResponder: () => true,
                          onPanResponderGrant: applySlide,
                          onPanResponderMove: applySlide,
                        });
                        return (
                          <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                              <Text style={{ color: theme.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 2.5 }}>INTEGRITY SCORE</Text>
                              <Text style={{ color: entityColor, fontSize: 22, fontWeight: '700' }}>{coord.value.toFixed(1)}</Text>
                            </View>
                            <View
                              style={{ height: 28, justifyContent: 'center' }}
                              onLayout={e => { coordSliderTrackWidth.current = e.nativeEvent.layout.width; }}
                              {...pan.panHandlers}
                            >
                              <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 2 }} />
                              <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 12, height: 3, width: `${(coord.value / 10) * 100}%`, backgroundColor: entityColor, borderRadius: 2, opacity: 0.85 }} />
                              <View pointerEvents="none" style={{ position: 'absolute', left: `${(coord.value / 10) * 100}%`, top: 7, marginLeft: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: entityColor, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', shadowColor: entityColor, shadowOpacity: 0.8, shadowRadius: 6 }} />
                            </View>
                            {coord.description ? (
                              <Text style={{ color: theme.textMuted, fontSize: 13, fontWeight: '500', lineHeight: 19, marginTop: 20, fontStyle: 'italic' }}>{coord.description}</Text>
                            ) : null}
                          </View>
                        );
                      })()}

                      {cardTab === 'actions' && (
                        <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>
                          {sortedActions.length === 0 ? (
                            <Text style={{ color: theme.textMuted, fontSize: 12, fontStyle: 'italic', marginBottom: 12, opacity: 0.6 }}>No actions yet — add one below</Text>
                          ) : sortedActions.map((a: any) => {
                            const efforts: ActionEffort[] = ['easy', 'medium', 'heavy'];
                            return (
                              <View key={a.id} style={{ paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                                <TouchableOpacity
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                                  onPress={() => {
                                    toggleAction(coord.nodeId, coord.id, a.id);
                                    const freshGoal = useAppStore.getState().nodes.find(n => n.id === coord.nodeId)?.goals.find((g: any) => g.id === coord.id);
                                    if (freshGoal) setSelectedEntity(prev => prev ? { ...prev, data: { ...prev.data, actions: freshGoal.actions } } : null);
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <Svg width={18} height={18} viewBox="0 0 24 24">
                                    {a.completed ? (
                                      <><Circle cx="12" cy="12" r="10" fill={entityColor} /><Path d="M7 12l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></>
                                    ) : (
                                      <Circle cx="12" cy="12" r="10" fill="none" stroke={theme.textMuted} strokeWidth="1.5" />
                                    )}
                                  </Svg>
                                  <Text style={{ flex: 1, color: a.completed ? theme.textMuted : theme.text, fontSize: 13, fontWeight: '500', textDecorationLine: a.completed ? 'line-through' : 'none', opacity: a.completed ? 0.5 : 1 }}>
                                    {a.title}
                                  </Text>
                                  {a.isPriority && <Text style={{ color: entityColor, fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>★</Text>}
                                </TouchableOpacity>
                                {/* Effort toggle */}
                                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, marginLeft: 28 }}>
                                  {efforts.map(e => {
                                    const sel = (a.effort ?? 'easy') === e;
                                    return (
                                      <TouchableOpacity
                                        key={e}
                                        onPress={() => {
                                          updateActionEffort(coord.nodeId, coord.id, a.id, e);
                                          const freshGoal = useAppStore.getState().nodes.find(n => n.id === coord.nodeId)?.goals.find((g: any) => g.id === coord.id);
                                          if (freshGoal) setSelectedEntity(prev => prev ? { ...prev, data: { ...prev.data, actions: freshGoal.actions } } : null);
                                        }}
                                        style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: sel ? entityColor + '28' : 'transparent', borderWidth: 1, borderColor: sel ? entityColor + '66' : 'rgba(255,255,255,0.1)' }}
                                        activeOpacity={0.7}
                                      >
                                        <Text style={{ color: sel ? entityColor : theme.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 1 }}>{e.toUpperCase()}</Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              </View>
                            );
                          })}
                          {/* Inline add */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, marginBottom: 8 }}>
                            <TextInput
                              style={{ flex: 1, color: theme.text, fontSize: 13, fontWeight: '500', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, borderWidth: 1, borderColor: entityColor + '33' }}
                              placeholder="New action…"
                              placeholderTextColor={theme.textMuted}
                              value={newActionTitle}
                              onChangeText={setNewActionTitle}
                              returnKeyType="done"
                              autoCorrect={false}
                              autoCapitalize="none"
                              onSubmitEditing={() => {
                                if (!newActionTitle.trim()) return;
                                addAction(coord.nodeId, coord.id, newActionTitle.trim(), 'easy');
                                const freshGoal = useAppStore.getState().nodes.find(n => n.id === coord.nodeId)?.goals.find((g: any) => g.id === coord.id);
                                if (freshGoal) setSelectedEntity(prev => prev ? { ...prev, data: { ...prev.data, actions: freshGoal.actions } } : null);
                                setNewActionTitle('');
                              }}
                            />
                            <TouchableOpacity
                              style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: entityColor + '22', borderWidth: 1, borderColor: entityColor + '55' }}
                              onPress={() => {
                                if (!newActionTitle.trim()) return;
                                addAction(coord.nodeId, coord.id, newActionTitle.trim(), 'easy');
                                const freshGoal = useAppStore.getState().nodes.find(n => n.id === coord.nodeId)?.goals.find((g: any) => g.id === coord.id);
                                if (freshGoal) setSelectedEntity(prev => prev ? { ...prev, data: { ...prev.data, actions: freshGoal.actions } } : null);
                                setNewActionTitle('');
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={{ color: entityColor, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>ADD</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </ScrollView>

                  </View>
                </Pressable>
              </Pressable>
            );
          }

          // ── Action card ───────────────────────────────────────────────────────
          const action = selectedEntity.data;
          const isCompleted = action.completed;
          // Local node/coord for the action card dropdowns — derive from action.nodeId / __goalId
          const actionSelNode = nodes.find(n => n.id === action.nodeId);
          const actionSelCoord = actionSelNode?.goals.find((g: any) => g.id === action.__goalId);
          const actionCoords = actionSelNode?.goals.filter((g: any) => !g.archived) || [];
          const efforts: ActionEffort[] = ['easy', 'medium', 'heavy'];
          const currentEffort: ActionEffort = action.effort ?? 'easy';
          return (
            <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => { setSelectedEntity(null); }}>
              <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420 }}>
                <View style={{ backgroundColor: 'rgba(10,18,36,0.97)', borderRadius: 24, borderWidth: 1, borderColor: entityColor + '55', overflow: 'hidden' }}>

                  {/* Header */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800', letterSpacing: 0.5, lineHeight: 22 }}>{action.title}</Text>
                      {action.isPriority && (
                        <Text style={{ color: entityColor, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginTop: 4, opacity: 0.8 }}>★ PRIORITY</Text>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => setSelectedEntity(null)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                      <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>

                      {/* Effort toggle */}
                      <Text style={{ color: theme.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 2.5, marginBottom: 10 }}>EFFORT</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                        {efforts.map(e => {
                          const sel = currentEffort === e;
                          return (
                            <TouchableOpacity
                              key={e}
                              style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: sel ? entityColor + '22' : 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: sel ? entityColor + '66' : 'rgba(255,255,255,0.1)' }}
                              onPress={() => {
                                if (!action.nodeId || !action.__goalId) return;
                                updateActionEffort(action.nodeId, action.__goalId, action.id, e);
                                setSelectedEntity(prev => prev ? { ...prev, data: { ...prev.data, effort: e } } : null);
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={{ color: sel ? entityColor : theme.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>{e.toUpperCase()}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Node dropdown */}
                      <Text style={{ color: theme.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 2.5, marginBottom: 10 }}>NODE</Text>
                      <View style={{ marginBottom: 16 }}>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: actionSelNode ? actionSelNode.color + '55' : 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)' }}
                          onPress={() => { setActionNodeDropdownOpen(v => !v); setActionCoordDropdownOpen(false); }}
                          activeOpacity={0.8}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            {actionSelNode && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: actionSelNode.color }} />}
                            <Text style={{ color: actionSelNode ? actionSelNode.color : theme.textMuted, fontSize: 13, fontWeight: '700' }}>
                              {actionSelNode ? actionSelNode.name : 'Select node…'}
                            </Text>
                          </View>
                          <Text style={{ color: theme.textMuted, fontSize: 10 }}>{actionNodeDropdownOpen ? '▲' : '▼'}</Text>
                        </TouchableOpacity>
                        {actionNodeDropdownOpen && (
                          <View style={{ marginTop: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', backgroundColor: 'rgba(6,12,28,0.99)' }}>
                            {nodes.map((n, i) => (
                              <TouchableOpacity
                                key={n.id}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: i < nodes.length - 1 ? 0.5 : 0, borderBottomColor: 'rgba(255,255,255,0.06)', backgroundColor: action.nodeId === n.id ? n.color + '14' : 'transparent' }}
                                onPress={() => {
                                  const newGoalId = n.goals.filter((g: any) => !g.archived)[0]?.id || '';
                                  saveActionEdit(
                                    { nodeId: action.nodeId, goalId: action.__goalId, actionId: action.id },
                                    { title: action.title, nodeId: n.id, goalId: newGoalId, isPriority: !!action.isPriority, notes: action.notes || '', dueDate: action.dueDate || '', reminder: action.reminder || '', effort: currentEffort }
                                  );
                                  setSelectedEntity(prev => prev ? { ...prev, data: { ...prev.data, nodeId: n.id, __goalId: newGoalId } } : null);
                                  setActionNodeDropdownOpen(false);
                                }}
                                activeOpacity={0.7}
                              >
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: n.color }} />
                                <Text style={{ flex: 1, color: action.nodeId === n.id ? n.color : '#f0f4ff', fontSize: 13, fontWeight: '600' }}>{n.name}</Text>
                                {action.nodeId === n.id && <Text style={{ color: n.color, fontSize: 11 }}>✓</Text>}
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Coordinate dropdown */}
                      <Text style={{ color: theme.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 2.5, marginBottom: 10 }}>COORDINATE</Text>
                      <View style={{ marginBottom: 20 }}>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: actionSelNode ? actionSelNode.color + '44' : 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)', opacity: actionSelNode ? 1 : 0.5 }}
                          onPress={() => { if (actionSelNode) { setActionCoordDropdownOpen(v => !v); setActionNodeDropdownOpen(false); } }}
                          activeOpacity={0.8}
                        >
                          <Text style={{ color: actionSelCoord ? (actionSelNode?.color || '#f0f4ff') : theme.textMuted, fontSize: 13, fontWeight: '600' }}>
                            {actionSelCoord ? actionSelCoord.name : 'Select coordinate…'}
                          </Text>
                          <Text style={{ color: theme.textMuted, fontSize: 10 }}>{actionCoordDropdownOpen ? '▲' : '▼'}</Text>
                        </TouchableOpacity>
                        {actionCoordDropdownOpen && actionSelNode && (
                          <View style={{ marginTop: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', backgroundColor: 'rgba(6,12,28,0.99)' }}>
                            {actionCoords.map((g: any, i: number) => (
                              <TouchableOpacity
                                key={g.id}
                                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: i < actionCoords.length - 1 ? 0.5 : 0, borderBottomColor: 'rgba(255,255,255,0.06)', backgroundColor: action.__goalId === g.id ? actionSelNode.color + '14' : 'transparent' }}
                                onPress={() => {
                                  saveActionEdit(
                                    { nodeId: action.nodeId, goalId: action.__goalId, actionId: action.id },
                                    { title: action.title, nodeId: action.nodeId, goalId: g.id, isPriority: !!action.isPriority, notes: action.notes || '', dueDate: action.dueDate || '', reminder: action.reminder || '', effort: currentEffort }
                                  );
                                  setSelectedEntity(prev => prev ? { ...prev, data: { ...prev.data, __goalId: g.id, __goalName: g.name } } : null);
                                  setActionCoordDropdownOpen(false);
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={{ flex: 1, color: action.__goalId === g.id ? actionSelNode.color : '#f0f4ff', fontSize: 13, fontWeight: '600' }}>{g.name}</Text>
                                {action.__goalId === g.id && <Text style={{ color: actionSelNode.color, fontSize: 11 }}>✓</Text>}
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>

                    </View>
                  </ScrollView>

                  {/* Mark as Done button */}
                  <TouchableOpacity
                    style={{ marginHorizontal: 20, marginBottom: 20, paddingVertical: 14, borderRadius: 14, backgroundColor: isCompleted ? 'rgba(255,255,255,0.05)' : entityColor + '22', borderWidth: 1, borderColor: isCompleted ? 'rgba(255,255,255,0.12)' : entityColor + '66', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                    onPress={() => {
                      if (!action.nodeId || !action.__goalId) return;
                      toggleAction(action.nodeId, action.__goalId, action.id);
                      setSelectedEntity(prev => prev ? { ...prev, data: { ...prev.data, completed: !isCompleted } } : null);
                      Haptics.selectionAsync();
                    }}
                    activeOpacity={0.8}
                  >
                    <Svg width={16} height={16} viewBox="0 0 24 24">
                      {isCompleted ? (
                        <><Circle cx="12" cy="12" r="10" fill={entityColor} /><Path d="M7 12l3 3 7-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></>
                      ) : (
                        <Circle cx="12" cy="12" r="10" fill="none" stroke={entityColor} strokeWidth="1.5" />
                      )}
                    </Svg>
                    <Text style={{ color: isCompleted ? entityColor : entityColor, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }}>
                      {isCompleted ? '✓ DONE' : 'MARK AS DONE'}
                    </Text>
                  </TouchableOpacity>

                </View>
              </Pressable>
            </Pressable>
          );
        })()}
      </Modal>

      {/* Trajectory Stock Chart Modal */}
      <Modal
        visible={trajectoryOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setTrajectoryOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}
          onPress={() => setTrajectoryOpen(false)}
        >
          <Pressable onPress={e => e.stopPropagation()}>
            <View style={{ backgroundColor: 'rgba(8,14,30,0.99)', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingBottom: 32 }}>

              {/* Handle + header */}
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 14, paddingBottom: 6 }}>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '800', letterSpacing: 2.5, marginBottom: 4 }}>SYSTEM TRAJECTORY</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                    <Text style={{ color: 'white', fontSize: 28, fontWeight: '600', letterSpacing: 0.5 }}>
                      {trajectoryPoints.length ? trajectoryPoints[trajectoryPoints.length - 1].value.toFixed(1) : '—'}
                    </Text>
                    {trajDelta !== 0 && (
                      <Text style={{ color: trajColor, fontSize: 14, fontWeight: '700' }}>
                        {trajDelta > 0 ? `+${trajDelta}` : `${trajDelta}`}
                      </Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity onPress={() => setTrajectoryOpen(false)} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Range pills */}
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginBottom: 16 }}>
                {(['1W', '1M', '1Y', 'ALL'] as TrajectoryRange[]).map(r => {
                  const active = trajectoryRange === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      onPress={() => {
                        setTrajectoryRange(r);
                        // Scroll to end after range changes (slight delay for layout)
                        setTimeout(() => trajectoryScrollRef.current?.scrollToEnd({ animated: false }), 50);
                      }}
                      style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: active ? trajColor + '22' : 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: active ? trajColor + '66' : 'rgba(255,255,255,0.08)' }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: active ? trajColor : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{r}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Scrollable chart */}
              <ScrollView
                ref={trajectoryScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 24 }}
                onLayout={() => trajectoryScrollRef.current?.scrollToEnd({ animated: false })}
              >
                <Svg width={trajChartW} height={TRAJ_CHART_H + TRAJ_LABEL_H} viewBox={`0 0 ${trajChartW} ${TRAJ_CHART_H + TRAJ_LABEL_H}`}>
                  <Defs>
                    <LinearGradient id="trajFill" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0%" stopColor={trajColor} stopOpacity="0.22" />
                      <Stop offset="100%" stopColor={trajColor} stopOpacity="0" />
                    </LinearGradient>
                  </Defs>

                  {/* Subtle horizontal grid lines at 0, 5, 10 */}
                  {[0, 5, 10].map(v => {
                    const gy = toY(v);
                    if (gy < 0 || gy > TRAJ_CHART_H) return null;
                    return (
                      <G key={v}>
                        <Line x1={0} y1={gy} x2={trajChartW} y2={gy} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
                        <SvgText x={4} y={gy - 4} fontSize={8} fill="rgba(255,255,255,0.2)" fontWeight="600">{v}</SvgText>
                      </G>
                    );
                  })}

                  {/* Filled area + line */}
                  {trajPath ? (
                    <>
                      <Path d={trajPath + ` L${trajPts[trajPts.length - 1].x} ${TRAJ_CHART_H} L${trajPts[0].x} ${TRAJ_CHART_H} Z`} fill="url(#trajFill)" />
                      <Path d={trajPath} stroke={trajColor} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      {/* Endpoint glow dot */}
                      {trajPts.length > 0 && (
                        <>
                          <Circle cx={trajPts[trajPts.length - 1].x} cy={trajPts[trajPts.length - 1].y} r={7} fill={trajColor} opacity={0.18} />
                          <Circle cx={trajPts[trajPts.length - 1].x} cy={trajPts[trajPts.length - 1].y} r={3.5} fill={trajColor} />
                        </>
                      )}
                    </>
                  ) : null}

                  {/* X-axis date labels */}
                  {trajectoryPoints.map((p, i) => {
                    if (i % labelStride !== 0 && i !== trajectoryPoints.length - 1) return null;
                    const lx = trajPts[i]?.x ?? i * ptW + ptW / 2;
                    return (
                      <SvgText
                        key={p.date}
                        x={lx}
                        y={TRAJ_CHART_H + 18}
                        fontSize={8}
                        fill="rgba(255,255,255,0.28)"
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        {formatTrajDate(p.date, trajectoryRange)}
                      </SvgText>
                    );
                  })}
                </Svg>
              </ScrollView>

            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Chart Explainer Modal */}
      <Modal visible={explainerOpen} transparent animationType="fade" onRequestClose={() => setExplainerOpen(false)}>
        <Pressable
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.85)', padding: 24 }}
          onPress={() => setExplainerOpen(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <GlassCard style={{ padding: 24, backgroundColor: THEME.card, borderColor: theme.glassBorder, borderWidth: 1, borderRadius: 24, width: '100%', maxWidth: 400, alignItems: 'center' }}>
              
              {/* Fun Graphic */}
              <View style={{ marginBottom: 24 }}>
                {atlasGraphView === 'nodes' && (
                  <Svg width={120} height={120} viewBox="0 0 120 120">
                    <Circle cx="60" cy="60" r="40" stroke={THEME.accent} strokeWidth="1" fill="none" opacity={0.3} />
                    <Circle cx="60" cy="60" r="16" fill={THEME.accent} />
                    <Circle cx="20" cy="60" r="6" fill="#A78BFA" />
                    <Circle cx="80" cy="25" r="8" fill="#34D399" />
                    <Circle cx="88" cy="88" r="5" fill="#F472B6" />
                  </Svg>
                )}
                {atlasGraphView === 'coordinates' && (
                  <Svg width={120} height={120} viewBox="0 0 120 120">
                    <Circle cx="60" cy="60" r="14" fill={THEME.accent} />
                    <Line x1="60" y1="60" x2="25" y2="35" stroke={THEME.accent} strokeWidth="2" opacity={0.5} />
                    <Circle cx="25" cy="35" r="10" fill={THEME.accent} opacity={0.8} />
                    <Line x1="60" y1="60" x2="100" y2="50" stroke={THEME.accent} strokeWidth="2" opacity={0.5} />
                    <Circle cx="100" cy="50" r="12" fill={THEME.accent} opacity={0.8} />
                    <Line x1="60" y1="60" x2="50" y2="100" stroke={THEME.accent} strokeWidth="2" opacity={0.5} />
                    <Circle cx="50" cy="100" r="9" fill={THEME.accent} opacity={0.8} />
                  </Svg>
                )}
                {atlasGraphView === 'actions' && (
                  <Svg width={120} height={120} viewBox="0 0 120 120">
                    <Circle cx="60" cy="60" r="30" stroke={THEME.textDim} strokeWidth="1" fill="none" opacity={0.5} />
                    <Circle cx="60" cy="30" r="4" fill={THEME.accent} />
                    <Circle cx="81" cy="81" r="4" fill={THEME.accent} />
                    <Circle cx="39" cy="81" r="4" fill={THEME.accent} />
                    <Path d="M57 30 L60 33 L64 27" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <Path d="M78 81 L81 84 L85 78" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </Svg>
                )}
              </View>

              <Text style={{ color: 'white', fontSize: 20, fontWeight: '800', letterSpacing: 2, marginBottom: 12, textTransform: 'uppercase', textAlign: 'center' }}>
                {atlasGraphView === 'nodes' ? 'NODES' : atlasGraphView === 'coordinates' ? 'COORDINATES' : 'ACTIONS'}
              </Text>

              <Text style={{ color: THEME.textDim, fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 24 }}>
                {atlasGraphView === 'nodes' && 'Nodes are the foundational pillars of your life. They represent the high-level areas you are focused on optimizing, tracking, and bringing into balance.'}
                {atlasGraphView === 'coordinates' && 'Coordinates are the specific, measurable goals orbiting a Node. They define the intended outcome and structural integrity of each pillar.'}
                {atlasGraphView === 'actions' && 'Actions are the concrete habits, tasks, and routines you deploy. By completing actions, you maintain or improve the alignment of your Coordinates.'}
              </Text>

              <TouchableOpacity 
                style={{ paddingVertical: 12, paddingHorizontal: 32, backgroundColor: 'rgba(56, 189, 248, 0.1)', borderWidth: 1, borderColor: THEME.accent, borderRadius: 12 }}
                onPress={() => setExplainerOpen(false)}
              >
                <Text style={{ color: THEME.accent, fontSize: 13, fontWeight: '800', letterSpacing: 2 }}>UNDERSTOOD</Text>
              </TouchableOpacity>
            </GlassCard>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};


const styles = StyleSheet.create({
  systemManifestCard: { borderRadius: 16, padding: 20, marginBottom: 12, overflow: 'hidden', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 16 },
  trendCard: { borderRadius: 16, paddingVertical: 14, paddingHorizontal: 20, marginBottom: 12, overflow: 'hidden' },
  systemManifestPrimaryRow: { flexDirection: 'row', alignItems: 'stretch' },
  systemManifestLeft: { flex: 1, justifyContent: 'center' },
  systemManifestBracketLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  systemManifestBracketValue: { color: 'white', fontSize: 32, fontWeight: '600', letterSpacing: 2 },
  systemManifestVLine: { width: 0.5, backgroundColor: 'rgba(226,232,240,0.5)', marginHorizontal: 16 },
  systemManifestStatusBlock: { alignItems: 'flex-end', justifyContent: 'center', paddingLeft: 8 },
  atlasCard: { borderRadius: 16, padding: 20, marginBottom: 20, overflow: 'hidden', position: 'relative', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 16 },
  atlasCardContent: { alignItems: 'stretch', zIndex: 1 },
  atlasCardHeader: { backgroundColor: 'rgba(0,0,0,0.35)', marginHorizontal: -20, marginTop: -20, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: THEME.cardBorder },
  atlasCardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  atlasScoreBlock: { alignSelf: 'flex-start' },
  statLabel: { color: THEME.accent, fontSize: 14, fontWeight: '900', letterSpacing: 4, marginTop: 4 },
  atlasViewSwitcher: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignSelf: 'flex-end' },
  atlasViewTab: { paddingVertical: 4, paddingHorizontal: 6, marginLeft: 4, borderWidth: 1, borderColor: 'transparent' },
  atlasViewTabActive: { borderColor: THEME.accent },
  atlasStarfieldContainer: { position: 'relative', overflow: 'hidden', height: 360 },
  starfieldSvg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  radarWrapper: { height: 360, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  radarRotWrap: { height: 340, width: 340 },
  atlasLegend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', width: '100%', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  legendItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, marginRight: 12, marginBottom: 6, borderRadius: 6 },
  legendItemHighlight: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 1, marginRight: 6 },
  legendLabelHighlight: { color: THEME.accent },
  legendValue: { color: 'white', fontSize: 14, fontWeight: '600' },
  trajectoryPastLogsRow: { paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  trajectoryPastLogsLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  deflectionCard: { borderRadius: 16, padding: 20, overflow: 'hidden', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 16 },
  deflectionRow: { flexDirection: 'row', alignItems: 'stretch' },
  deflectionLeft: { flex: 1, justifyContent: 'center' },
  deflectionLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  deflectionValue: { color: 'white', fontSize: 28, fontWeight: '600', letterSpacing: 2 },
  deflectionVLine: { width: 0.5, backgroundColor: 'rgba(226,232,240,0.5)', marginHorizontal: 16 },
  deflectionRight: { alignItems: 'center', justifyContent: 'center', paddingLeft: 8 },
  summaryCard: { borderRadius: 16, padding: 20, overflow: 'hidden', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 16 },
  summaryHeading: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4, marginBottom: 18 },
  summarySuggestionSection: { borderWidth: 1, borderColor: THEME.cardBorder, borderRadius: 10, padding: 14, marginBottom: 12 },
  summarySuggestionLabel: { color: THEME.border, fontSize: 14, fontWeight: '600', letterSpacing: 1, marginBottom: 14 },
  summarySuggestionBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, alignSelf: 'flex-start' },
  summarySuggestionBtnText: { color: THEME.accent, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
});
