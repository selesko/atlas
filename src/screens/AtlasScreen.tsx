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
import { SnapshotDetailModal } from '../components/SnapshotDetailModal';
import { THEME } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { GlassCard } from '../components/GlassCard';
import { CosmicSystemView } from '../components/CosmicSystemView';
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
}) => {
  const { nodes, getNodeAvg, themeMode, persona } = useAppStore();
  const theme = useTheme();

  const [atlasGraphView, setAtlasGraphView] = useState<AtlasGraphView>('radar');
  const [atlasHighlightId, setAtlasHighlightId] = useState<string | null>(null);
  const [radarModalOpen, setRadarModalOpen] = useState(false);
  const [stars, setStars] = useState<Array<{ cx: number; cy: number; r: number; op: number }>>([]);
  const [radarPulseScale, setRadarPulseScale] = useState(1);
  const [nodeBreathValue, setNodeBreathValue] = useState(0);

  const radarRotation = useRef(new Animated.Value(0)).current;
  const radarScale = useRef(new Animated.Value(1)).current;
  const nodeBreathAnim = useRef(new Animated.Value(0)).current;

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



  const radarRotStyle = {
    transform: [{ rotate: radarRotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) }],
  };

  const handleRadarTouch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRadarModalOpen(true);
  }, []);

  const isDark = themeMode === 'dark';

  const getSystemStatusLabel = () => {
    if (persona === 'Seeker') return 'CURRENT ALIGNMENT';
    if (persona === 'Spiritual') return 'INNER HARMONY';
    return 'SYSTEM STATUS';
  };

  // Derived values
  const systemBalance = (nodes.reduce((acc, n) => acc + parseFloat(getNodeAvg(n)), 0) / (nodes.length || 1)).toFixed(1);


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
                {atlasGraphView === 'radar' ? 'SYSTEM' : atlasGraphView === 'coordinates' ? 'COORDINATES' : 'ACTIONS'}
              </Text>
            </View>
            <View style={styles.atlasViewSwitcher}>
              {(['radar', 'coordinates', 'actions'] as const).map(v => {
                const c = atlasGraphView === v ? theme.accent : theme.textMuted;
                return (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setAtlasGraphView(v)}
                    style={[styles.atlasViewTab, atlasGraphView === v && styles.atlasViewTabActive]}
                    activeOpacity={0.8}
                  >
                    {v === 'radar' && (
                      <Svg width={22} height={22} viewBox="0 0 256 256">
                        <Path fill={c} d="M230.64 49.36a32 32 0 0 0-45.26 0a31.9 31.9 0 0 0-5.16 6.76L152 48.42a32 32 0 0 0-54.63-23.06a32.06 32.06 0 0 0-5.76 37.41L57.67 93.32a32.05 32.05 0 0 0-40.31 4.05a32 32 0 0 0 42.89 47.41l70 51.36a32 32 0 1 0 47.57-14.69l27.39-77.59q1.38.12 2.76.12a32 32 0 0 0 22.63-54.62Zm-67.87 126.79a32 32 0 0 0-23 7.08l-70-51.36a32.17 32.17 0 0 0-1.34-26.65l33.95-30.55a32 32 0 0 0 45.47-10.81l28.15 7.7a32 32 0 0 0 14.12 27Z" />
                      </Svg>
                    )}
                    {v === 'coordinates' && (
                      <Svg width={22} height={22} viewBox="0 0 32 32">
                        {[[16,16],[8,10],[24,10],[8,22],[24,22]].map(([cx, cy], i) => (
                          <Circle key={i} cx={cx} cy={cy} r={3} fill={c} />
                        ))}
                      </Svg>
                    )}
                    {v === 'actions' && (
                      <Svg width={22} height={22} viewBox="0 0 32 32">
                        <Circle cx={16} cy={16} r={10} stroke={c} strokeWidth={2} fill="none" strokeDasharray="4 4" />
                        <Circle cx={16} cy={6} r={3} fill={c} />
                        <Circle cx={26} cy={16} r={3} fill={c} />
                        <Circle cx={16} cy={26} r={3} fill={c} />
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

            {atlasGraphView === 'radar' && (
              <>
                <Pressable style={styles.radarWrapper} onPressIn={handleRadarTouch}>
                  <Animated.View style={[styles.radarRotWrap, radarRotStyle]}>
                    <Svg height={340} width={340} viewBox="0 0 200 200">
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
                        <G opacity={isDark ? 0.06 : 0.2}>
                          {[20, 40, 60, 80].map(r => <Circle key={r} r={r} stroke={isDark ? "#C0C0C0" : "#FEF08A"} strokeWidth="0.5" fill="none" />)}
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

            {atlasGraphView !== 'radar' && (
              <CosmicSystemView nodes={nodes} view={atlasGraphView} theme={theme} />
            )}
          </View>

          <View style={[styles.atlasLegend, { borderTopColor: theme.divider }]}>
            {nodes.map(n => (
              <TouchableOpacity
                key={n.id}
                style={[styles.legendItem, atlasHighlightId === n.id && styles.legendItemHighlight]}
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

      {/* Live radar detail modal */}
      <SnapshotDetailModal
        visible={radarModalOpen}
        onClose={() => setRadarModalOpen(false)}
        nodes={nodes.map(n => ({
          nodeId: n.id,
          nodeName: n.name,
          color: n.color,
          avg: parseFloat(getNodeAvg(n)),
        }))}
        label="LIVE"
        triggerNode={null}
      />
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
