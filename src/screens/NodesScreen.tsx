import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, Dimensions } from 'react-native';
import { OrbitalValueBadge } from '../components/OrbitalValueBadge';
import { useAppStore } from '../stores/useAppStore';
import { THEME } from '../constants/theme';
import { Node, Goal } from '../types';

const { width } = Dimensions.get('window');

// ─── Momentum helpers ──────────────────────────────────────────────────────────

/** -1 to +1 momentum score based on 7-day history */
function getMomentum(goal: Goal): number {
  const hist = goal.scoreHistory;
  if (!hist || hist.length < 2) return 0;
  const sorted = [...hist].sort((a, b) => a.date.localeCompare(b.date));
  const delta = sorted[sorted.length - 1].value - sorted[0].value;
  return Math.max(-1, Math.min(1, delta / 4)); // normalise: ±4 pts = full signal
}

/** Average momentum across all coordinates in a node */
function getNodeMomentum(node: Node): number {
  if (node.goals.length === 0) return 0;
  return node.goals.reduce((acc, g) => acc + getMomentum(g), 0) / node.goals.length;
}

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

/** Slider fill color: node color → warm green (up) or cool rose (down) */
function getMomentumSliderColor(nodeColor: string, momentum: number): string {
  if (momentum > 0.15) return lerpColor(nodeColor, '#4ade80', Math.min(1, momentum * 1.2));
  if (momentum < -0.15) return lerpColor(nodeColor, '#fb7185', Math.min(1, Math.abs(momentum) * 1.2));
  return nodeColor;
}

/** Card glow shadow color and opacity based on momentum */
function getMomentumGlow(momentum: number): { color: string; opacity: number } {
  if (momentum > 0.15) return { color: '#4ade80', opacity: Math.min(0.45, momentum * 0.6) };
  if (momentum < -0.15) return { color: '#fb7185', opacity: Math.min(0.3, Math.abs(momentum) * 0.4) };
  return { color: '#000', opacity: 0 };
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
  const { nodes, updateValue, addCoordinate, hasAccess, getNodeAvg } = useAppStore();
  const trackWidths = useRef<Record<string, number>>({});

  return (
    <View>
      {nodes.map((node: Node) => (
        <View key={node.id} style={styles.nodeBlock}>
          <TouchableOpacity onPress={() => setSelectedNodeId(selectedNodeId === node.id ? null : node.id)} activeOpacity={0.9}>
            <View style={styles.nodeHeader}>
              <View style={styles.nodeHeaderLeft}>
                <View style={[styles.nodeIcon, { backgroundColor: node.color }]}>
                  <Text style={styles.nodeIconLetter}>{node.name[0].toUpperCase()}</Text>
                </View>
                <View style={styles.nodeTitleRow}>
                  {selectedNodeId === node.id ? (
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); onOpenEditNode(node.id); }} activeOpacity={0.8}>
                      <Text style={[styles.nodeTitle, { color: node.color }]}>{node.name.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.nodeTitle, { color: node.color }]}>{node.name.toUpperCase()}</Text>
                  )}
                </View>
              </View>
              <Text style={styles.nodeScore}>{getNodeAvg(node)}</Text>
            </View>
          </TouchableOpacity>

          {selectedNodeId === node.id && (
            <View style={styles.nodeExpanded}>
              <View style={styles.divider} />
              {node.description ? (
                <>
                  <Text style={styles.coordinatesLabel}>DESIRED INTENT</Text>
                  <Text style={styles.nodeDescriptionText}>{node.description}</Text>
                </>
              ) : null}
              <Text style={styles.coordinatesLabel}>ACTIVE COORDINATE</Text>
              {node.goals.map(goal => {
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
                const hasEvidence = !!goal.evidence?.trim();
                const momentum = getMomentum(goal);
                const glow = getMomentumGlow(momentum);
                const sliderColor = getMomentumSliderColor(node.color, momentum);
                return (
                  <TouchableOpacity
                    key={goal.id}
                    activeOpacity={0.75}
                    onPress={() => onOpenCoordEdit(node.id, goal.id)}
                    style={[
                      styles.nodeOverlayCoord,
                      glow.opacity > 0 && {
                        shadowColor: glow.color,
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: glow.opacity,
                        shadowRadius: 10,
                        borderWidth: 1,
                        borderColor: glow.color + '28',
                      },
                    ]}
                  >
                    {/* Title row: name + evidence dot + value */}
                    <View style={styles.nodeOverlayCoordTitleRow}>
                      <View style={styles.goalNameRow}>
                        <View style={[styles.evidenceDot, { backgroundColor: hasEvidence ? node.color : '#f59e0b' }]} />
                        <Text style={styles.goalName}>{goal.name}</Text>
                      </View>
                      <OrbitalValueBadge value={goal.value} color={sliderColor} size={40} />
                    </View>

                    {/* Slider */}
                    <View style={styles.sliderRow}>
                      <View
                        style={styles.sliderTrack}
                        onLayout={(e) => { trackWidths.current[key] = e.nativeEvent.layout.width; }}
                        {...pan.panHandlers}
                      >
                        <View style={[styles.sliderLine, { backgroundColor: sliderColor, opacity: 0.3 }]} />
                        <View pointerEvents="none" style={[styles.sliderFill, { width: `${goal.value * 10}%`, backgroundColor: sliderColor }]} />
                        <View pointerEvents="none" style={[styles.sliderHandle, { left: `${goal.value * 10}%`, marginLeft: -6 }]}>
                          <View style={[styles.sliderHandleInner, { backgroundColor: sliderColor }]} />
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
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
                <Text style={styles.addCoordinateText}>+ ADD COORDINATE</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}

      <TouchableOpacity
        style={[styles.addCoordinateBtn, { marginTop: 16 }]}
        onPress={() => {
          if (!hasAccess) { onOpenSystemGate(); return; }
          onOpenAddNode();
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.addCoordinateText}>+ ADD NODE</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  nodeBlock: { backgroundColor: THEME.card, marginBottom: 12, borderRadius: 12, overflow: 'hidden', shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 },
  nodeHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 30, alignItems: 'center', paddingHorizontal: 20 },
  nodeHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  nodeIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  nodeIconLetter: { color: 'white', fontSize: 18, fontWeight: '700' },
  nodeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nodeTitle: { fontSize: 28, fontWeight: '200', letterSpacing: 8 },
  nodeScore: { color: 'white', fontSize: 24, fontWeight: '200' },
  goalNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nodeExpanded: { paddingBottom: 30, paddingHorizontal: 20 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 25 },
  coordinatesLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 3, marginBottom: 16, textTransform: 'uppercase' },
  nodeDescriptionText: { color: 'white', fontSize: 14, fontWeight: '400', marginBottom: 16, lineHeight: 20 },
  nodeOverlayCoord: { marginBottom: 20, borderRadius: 12, padding: 12, backgroundColor: 'rgba(255,255,255,0.05)' },
  nodeOverlayCoordTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  editCoordBtn: { color: THEME.accent, fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  goalName: { color: 'white', fontSize: 14, fontWeight: '600' },
  evidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  evidenceDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  evidenceText: { fontSize: 11, fontWeight: '500', letterSpacing: 0.3, flex: 1 },
  evidenceMissing: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: '#f59e0b' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  sliderTrack: { flex: 1, height: 24, justifyContent: 'center' },
  sliderLine: { height: 2, width: '100%', backgroundColor: 'rgba(255,255,255,0.1)' },
  sliderFill: { position: 'absolute', left: 0, top: 11, height: 2, opacity: 0.6 },
  sliderHandle: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: 'transparent', borderWidth: 2, borderColor: '#38BDF8', top: 6, justifyContent: 'center', alignItems: 'center', shadowColor: '#38BDF8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },
  sliderHandleInner: { width: 6, height: 6, borderRadius: 3 },
  valueCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: THEME.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  valueCircleText: { fontSize: 22, fontWeight: '200' },
  coordValue: { fontSize: 20, fontWeight: '200', opacity: 0.9 },
  addCoordinateBtn: { marginTop: 8, paddingVertical: 12, alignItems: 'center', borderRadius: 4 },
  addCoordinateText: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
});
