import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  PanResponder, Animated, Pressable, StyleSheet as RNStyleSheet, Easing
} from 'react-native';
import Svg, {
  Circle, Polygon, G, Rect, Path, Defs,
  RadialGradient, Stop, Line, LinearGradient,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../stores/useAppStore';
import { FadingBorder } from '../components/FadingBorder';
import { THEME } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { GlassCard } from '../components/GlassCard';
import { Radar } from '../components/Radar';
import { AtlasGraphView, Node } from '../types';

const { width } = Dimensions.get('window');
const STARFIELD_HEIGHT = 360;


interface CopilotAction {
  label: string;
  action: string;
  nodeId?: string;
  goalId?: string;
}

interface AtlasScreenProps {
  guidanceActions: CopilotAction[];
  onAction: (a: CopilotAction) => void;
  onOpenCoordinate?: (nodeId: string, goalId: string) => void;
  onOpenAction?: (nodeId: string, goalId: string, actionId: string) => void;
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
}) => {
  const { nodes, getNodeAvg, themeMode, persona } = useAppStore();
  const theme = useTheme();

  const [atlasGraphView, setAtlasGraphView] = useState<AtlasGraphView>('nodes');
  const [atlasHighlightId, setAtlasHighlightId] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<{type: 'node'|'coordinate'|'action', data: any} | null>(null);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [stars, setStars] = useState<Array<{ cx: number; cy: number; r: number; op: number }>>([]);
  const [radarPulseScale, setRadarPulseScale] = useState(1);
  const [nodeBreathValue, setNodeBreathValue] = useState(0);

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
      <GlassCard style={styles.systemManifestCard}>
        <View style={styles.systemManifestPrimaryRow}>
          <View style={styles.systemManifestLeft}>
            <Text style={[styles.systemManifestBracketLabel, { color: theme.textMuted }]}>{getSystemStatusLabel()}</Text>
          </View>
          <View style={[styles.systemManifestVLine, { backgroundColor: theme.divider }]} />
          <View style={styles.systemManifestStatusBlock}>
            <Text style={[styles.systemManifestBracketValue, { color: theme.text }]}>{systemBalance}</Text>
          </View>
        </View>
      </GlassCard>

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
                        setAtlasHighlightId(clickedNode.id);
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

            {/* Interactive Detail Modal for Cosmic View */}
            {selectedEntity && (() => {
              const activeNodeForColor = nodes.find(n => n.id === (atlasHighlightId || nodes[0]?.id));
              const entityColor = selectedEntity.type === 'node' ? selectedEntity.data.color : activeNodeForColor?.color || THEME.accent;
              return (
              <Pressable 
                style={[RNStyleSheet.absoluteFill, { zIndex: 10, justifyContent: 'flex-end', padding: 16 }]} 
                onPress={() => setSelectedEntity(null)}
              >
                <Pressable onPress={(e) => e.stopPropagation()}>
                  <GlassCard style={{ padding: 20, backgroundColor: 'rgba(15, 23, 42, 0.65)', borderColor: entityColor, borderWidth: 1, borderRadius: 24, shadowColor: entityColor, shadowOpacity: 0.25, shadowRadius: 15 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', letterSpacing: 1.5 }}>
                        {selectedEntity.type === 'node' ? selectedEntity.data.name.toUpperCase() : selectedEntity.type === 'coordinate' ? selectedEntity.data.name.toUpperCase() : selectedEntity.data.title?.toUpperCase() || selectedEntity.data.label?.toUpperCase()}
                      </Text>
                      <TouchableOpacity onPress={() => setSelectedEntity(null)} hitSlop={{top:15,bottom:15,left:15,right:15}}>
                        <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>CLOSE</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={{ color: theme.textMuted, fontSize: 13, letterSpacing: 1, fontWeight: '600' }}>
                      {selectedEntity.type === 'node' 
                        ? `SCORE: ${getNodeAvg(selectedEntity.data)}   •   COORDINATES: ${selectedEntity.data.goals.length}` 
                        : selectedEntity.type === 'coordinate' 
                        ? `SCORE: ${selectedEntity.data.value.toFixed(1)}   •   ACTIONS: ${selectedEntity.data.actions.length}` 
                        : `STATUS: ${selectedEntity.data.completed ? 'COMPLETED' : 'PENDING'}`}
                    </Text>
                      <TouchableOpacity 
                        style={{ marginTop: 12, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: `${entityColor}1A`, borderWidth: 1, borderColor: `${entityColor}66`, borderRadius: 12, alignSelf: 'flex-start' }}
                        onPress={() => {
                          const activeNodeId = atlasHighlightId || nodes[0]?.id;
                          if (!activeNodeId) return;
                          
                          if (selectedEntity.type === 'node') {
                            // Already focused on the node via setAtlasHighlightId, maybe just close modal or navigate
                            setSelectedEntity(null);
                          } else if (selectedEntity.type === 'coordinate') {
                            onOpenCoordinate?.(activeNodeId, selectedEntity.data.id);
                          } else {
                            onOpenAction?.(activeNodeId, selectedEntity.data.__goalId, selectedEntity.data.id);
                          }
                          setSelectedEntity(null);
                        }}
                      >
                        <Text style={{ color: entityColor, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }}>
                          {selectedEntity.type === 'node' ? 'CLOSE FOCUS' : `VIEW ${selectedEntity.type === 'coordinate' ? 'COORDINATE' : 'ACTION'} →`}
                        </Text>
                      </TouchableOpacity>
                  </GlassCard>
                </Pressable>
              </Pressable>
            );})()}
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


      {/* Atlas Guidance */}
      {guidanceActions.length > 0 && (
        <GlassCard style={[styles.summaryCard, { marginBottom: 20 }]}>
          <Text style={[styles.summaryHeading, { color: theme.textMuted }]}>ATLAS GUIDANCE</Text>
          {guidanceActions.slice(0, 2).map((act, idx) => (
            <View key={idx} style={[styles.summarySuggestionSection, { borderColor: theme.glassBorder }, idx === guidanceActions.length - 1 && { marginBottom: 0 }]}>
              <Text style={[styles.summarySuggestionLabel, { color: theme.text }]}>{act.label}</Text>
              <TouchableOpacity style={styles.summarySuggestionBtn} onPress={() => onAction(act)} activeOpacity={0.8}>
                <Text style={[styles.summarySuggestionBtnText, { color: theme.accent }]}>{ACTION_BTN_LABELS[act.action] || 'GO'}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </GlassCard>
      )}

      {/* Chart Explainer Modal */}
      {explainerOpen && (
        <Pressable 
          style={[RNStyleSheet.absoluteFill, { zIndex: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.85)', padding: 24 }]} 
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
      )}
    </>
  );
};

const styles = StyleSheet.create({
  systemManifestCard: { borderRadius: 16, padding: 20, marginBottom: 12, overflow: 'hidden', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 16 },
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
