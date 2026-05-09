import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, Dimensions, TextInput } from 'react-native';
import { OrbitalValueBadge } from '../components/OrbitalValueBadge';
import { GlassCard } from '../components/GlassCard';
import { useAppStore } from '../stores/useAppStore';
import { THEME } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { Node } from '../types';
import { fetchNodeIntent } from '../services/aiService';

const { width } = Dimensions.get('window');

/** Interpolate between two hex colors by t (0→1) */
function lerpColor(a: string, b: string, t: number): string {
  const h = (s: string) => parseInt(s.slice(1), 16);
  const ar = (h(a) >> 16) & 0xff, ag = (h(a) >> 8) & 0xff, ab = h(a) & 0xff;
  const br = (h(b) >> 16) & 0xff, bg = (h(b) >> 8) & 0xff, bb = h(b) & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bv = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${bv.toString(16).padStart(2,'0')}`;
}


interface NodesScreenProps {
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  onOpenCoordEdit: (nodeId: string, goalId: string) => void;
  onOpenAddNode: () => void;
  onOpenEditNode: (nodeId: string) => void;
  onOpenSystemGate: () => void;
}

export const NodesScreen: React.FC<NodesScreenProps> = ({
  selectedNodeId,
  setSelectedNodeId,
  onOpenCoordEdit,
  onOpenAddNode,
  onOpenEditNode,
  onOpenSystemGate,
}) => {
  const { nodes, updateValue, addCoordinate, hasAccess, getNodeAvg, session, persona } = useAppStore();
  const theme = useTheme();
  const trackWidths = useRef<Record<string, number>>({});

  // ── AI node intent — cached per node id, fetched on expand ─────────────────
  const [nodeIntents, setNodeIntents] = useState<Record<string, string | 'loading'>>({});

  useEffect(() => {
    if (!selectedNodeId || !session) return;
    // Already fetched or in flight
    if (nodeIntents[selectedNodeId]) return;
    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) return;

    setNodeIntents(prev => ({ ...prev, [selectedNodeId]: 'loading' }));
    fetchNodeIntent(node, persona).then(guidance => {
      setNodeIntents(prev => ({
        ...prev,
        [selectedNodeId]: guidance ?? '',
      }));
    });
  }, [selectedNodeId, session]);

  const activeNodes = nodes.filter(n => !n.archived);

  return (
    <View>
      {activeNodes.map((node: Node) => (
        <GlassCard
          key={node.id}
          style={[styles.nodeBlock, { shadowColor: node.color }]}
        >
          <TouchableOpacity onPress={() => setSelectedNodeId(selectedNodeId === node.id ? null : node.id)} activeOpacity={0.9}>
            <View style={styles.nodeHeader}>
              <View style={styles.nodeHeaderLeft}>
                <View style={styles.nodeTitleRow}>
                  {selectedNodeId === node.id ? (
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); onOpenEditNode(node.id); }} activeOpacity={0.8} style={{ flex: 1 }}>
                      <Text
                        style={[styles.nodeTitle, { color: node.color, letterSpacing: node.name.length > 8 ? 3 : 8 }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {node.name.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text
                      style={[styles.nodeTitle, { color: node.color, letterSpacing: node.name.length > 8 ? 3 : 8 }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {node.name.toUpperCase()}
                    </Text>
                  )}
                </View>
              </View>
              <OrbitalValueBadge value={parseFloat(getNodeAvg(node))} color={node.color} size={52} />
            </View>
          </TouchableOpacity>

          {selectedNodeId === node.id && (
            <View style={styles.nodeExpanded}>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />


              <Text style={[styles.coordinatesLabel, { color: theme.textMuted }]}>EVALUATE</Text>
              {node.goals.filter(g => !g.archived).map(goal => {
                const key = `${node.id}-${goal.id}`;
                const applySlider = (evt: { nativeEvent: { locationX: number } }) => {
                  const w = trackWidths.current[key] || width - 40;
                  if (w <= 0) return;
                  const x = Math.max(0, Math.min(evt.nativeEvent.locationX, w));
                  const val = Math.round((x / w) * 9) + 1;
                  updateValue(node.id, goal.id, Math.max(1, Math.min(10, val)));
                };
                const pan = PanResponder.create({
                  onStartShouldSetPanResponder: () => true,
                  onPanResponderGrant: applySlider,
                  onPanResponderMove: applySlider,
                });
                const hasCalibrations = goal.actions.length > 0;
                // Intensity: white at low values → node color at high values
                const intensity = goal.value / 10;
                const valueColor = lerpColor('#ffffff', node.color, intensity);
                return (
                  <View
                    key={goal.id}
                    style={[styles.nodeOverlayCoord, { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }]}
                  >
                    {/* Label row: small muted name + edit chevron */}
                    <View style={styles.nodeOverlayCoordTitleRow}>
                      <View style={styles.goalNameRow}>
                        <View style={[styles.evidenceDot, { backgroundColor: hasCalibrations ? node.color : '#f59e0b' }]} />
                        <Text style={styles.goalLabel}>{goal.name.toUpperCase()}</Text>
                      </View>
                      <TouchableOpacity onPress={() => onOpenCoordEdit(node.id, goal.id)} hitSlop={{ top: 12, bottom: 12, left: 16, right: 4 }} activeOpacity={0.5}>
                        <Text style={styles.coordEditChevron}>›</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Slider + score */}
                    <View style={styles.sliderRow}>
                      <View
                        style={styles.sliderTrack}
                        onLayout={(e) => { trackWidths.current[key] = e.nativeEvent.layout.width; }}
                        {...pan.panHandlers}
                      >
                        <View style={[styles.sliderLine, { backgroundColor: node.color, opacity: 0.15 }]} />
                        <View pointerEvents="none" style={[styles.sliderFill, { width: `${goal.value * 10}%`, backgroundColor: valueColor }]} />
                        <View pointerEvents="none" style={[styles.sliderHandle, { left: `${goal.value * 10}%`, marginLeft: -9, borderColor: valueColor, shadowColor: valueColor }]}>
                          <View style={[styles.sliderHandleInner, { backgroundColor: valueColor }]} />
                        </View>
                      </View>
                      <Text style={[styles.coordScore, { color: valueColor }]}>{goal.value}</Text>
                    </View>
                  </View>
                );
              })}
              <TouchableOpacity
                style={styles.addCoordinateBtn}
                onPress={() => {
                  if (!hasAccess && node.goals.length >= 2) { onOpenSystemGate(); return; }
                  addCoordinate(node.id);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.addCoordinateText, { color: theme.textMuted }]}>+ ADD COORDINATE</Text>
              </TouchableOpacity>
            </View>
          )}
        </GlassCard>
      ))}

      <TouchableOpacity
        style={[styles.addCoordinateBtn, { marginTop: 16 }]}
        onPress={() => {
          if (!hasAccess) { onOpenSystemGate(); return; }
          onOpenAddNode();
        }}
        activeOpacity={0.7}
      >
        <Text style={[styles.addCoordinateText, { color: theme.textMuted }]}>+ ADD NODE</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  nodeBlock: { marginBottom: 12, borderRadius: 16, overflow: 'hidden', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 16 },
  nodeHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 30, alignItems: 'center', paddingHorizontal: 20 },
  nodeHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, marginRight: 8 },
  nodeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  nodeTitle: { fontSize: 22, fontWeight: '600', letterSpacing: 8 },
  nodeScore: { color: 'white', fontSize: 20, fontWeight: '600' },
  goalNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nodeExpanded: { paddingBottom: 30, paddingHorizontal: 20 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 25 },
  coordinatesLabel: { fontSize: 14, fontWeight: '800', letterSpacing: 3, marginBottom: 16, textTransform: 'uppercase' },
  nodeDescriptionText: { fontSize: 14, fontWeight: '600', marginBottom: 16, lineHeight: 20 },
  evaluateLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginTop: 8, marginBottom: 4 },
  nodeOverlayCoord: { marginBottom: 20, borderRadius: 12, padding: 16 },
  nodeOverlayCoordTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  editCoordBtn: { fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  goalLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)' },
  coordEditChevron: { fontSize: 20, fontWeight: '300', color: 'rgba(255,255,255,0.25)', lineHeight: 22 },
  coordScore: { fontSize: 26, fontWeight: '200', letterSpacing: -0.5, minWidth: 34, textAlign: 'right' },
  evidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  evidenceDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  evidenceText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, flex: 1 },
  evidenceMissing: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: '#f59e0b' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  sliderTrack: { flex: 1, height: 24, justifyContent: 'center' },
  sliderLine: { height: 3, width: '100%', backgroundColor: 'rgba(255,255,255,0.1)' },
  sliderFill: { position: 'absolute', left: 0, top: 10, height: 3, opacity: 0.6 },
  sliderHandle: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: 'transparent', borderWidth: 2, top: 3, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 12 },
  sliderHandleInner: { width: 8, height: 8, borderRadius: 4 },
  valueCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  valueCircleText: { fontSize: 22, fontWeight: '600' },
  coordValue: { fontSize: 20, fontWeight: '600', opacity: 0.9 },
  addCoordinateBtn: { marginTop: 8, paddingVertical: 12, alignItems: 'center', borderRadius: 4 },
  addCoordinateText: { fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  intentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 20 },
  intentLoading: { flex: 1, fontSize: 12, fontWeight: '600', letterSpacing: 2, fontStyle: 'italic' },
});
