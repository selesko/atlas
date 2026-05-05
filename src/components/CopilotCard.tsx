import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Defs, RadialGradient, Stop, LinearGradient } from 'react-native-svg';
import { CopilotPayload, CopilotAction, TabConfig } from '../services/aiService';

// ─── Data shapes ──────────────────────────────────────────────────────────────

export interface LastCycleData {
  action: string;
  goalName: string;
  nodeName: string;
  valueBefore: number;
  nodeAvgBefore: number;
  nodeAvgNow: number;
}

export interface NodeBubble {
  name: string;
  score: number;
  color: string;
}

// ─── Coordinate data for Actions dive-deeper scatter ─────────────────────────

export interface CoordinateDot {
  name: string;
  score: number;
  color: string;
  calibrationCount: number;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CopilotCardProps {
  tab: string;
  tabConfig: TabConfig;
  payload: CopilotPayload | null;
  isLoading: boolean;
  onClose: () => void;
  onAction: (action: CopilotAction) => void;
  persona: string;
  lastCycle?: LastCycleData | null;
  nodeBubbles?: NodeBubble[];
  focusCoordinate?: { name: string; score: number; color: string } | null;
  systemTrajectory?: number[];
  allCoordinates?: CoordinateDot[];
}

// ─── Reflection graphic — 20 layout variants × 3 persona palettes ────────────

/** Each circle layout: cx/cy/r in a 280×140 canvas, ci = palette color index */
interface LayoutCircle { cx: number; cy: number; r: number; ci: number; }

const VARIANTS: LayoutCircle[][] = [
  // 1 — two circles, centre overlap
  [{ cx: 110, cy: 75, r: 58, ci: 0 }, { cx: 168, cy: 80, r: 50, ci: 1 }],
  // 2 — two circles, wide spread
  [{ cx: 72,  cy: 80, r: 52, ci: 0 }, { cx: 204, cy: 72, r: 48, ci: 1 }],
  // 3 — three circles, triangle
  [{ cx: 100, cy: 60, r: 50, ci: 0 }, { cx: 180, cy: 60, r: 46, ci: 1 }, { cx: 140, cy: 110, r: 38, ci: 2 }],
  // 4 — three circles, horizontal row
  [{ cx: 65,  cy: 80, r: 44, ci: 0 }, { cx: 140, cy: 72, r: 40, ci: 1 }, { cx: 215, cy: 80, r: 42, ci: 2 }],
  // 5 — three: one large dominant, two accent
  [{ cx: 130, cy: 80, r: 62, ci: 0 }, { cx: 55,  cy: 55, r: 30, ci: 1 }, { cx: 210, cy: 100, r: 28, ci: 2 }],
  // 6 — single large centred
  [{ cx: 140, cy: 78, r: 68, ci: 0 }],
  // 7 — four quad
  [{ cx: 80,  cy: 58, r: 46, ci: 0 }, { cx: 200, cy: 58, r: 42, ci: 1 }, { cx: 80,  cy: 112, r: 38, ci: 2 }, { cx: 200, cy: 112, r: 36, ci: 3 }],
  // 8 — three tight cluster
  [{ cx: 120, cy: 75, r: 52, ci: 0 }, { cx: 162, cy: 70, r: 46, ci: 1 }, { cx: 138, cy: 105, r: 40, ci: 2 }],
  // 9 — two: big + small
  [{ cx: 105, cy: 80, r: 65, ci: 0 }, { cx: 200, cy: 68, r: 38, ci: 1 }],
  // 10 — four diagonal cascade
  [{ cx: 58,  cy: 48, r: 40, ci: 0 }, { cx: 118, cy: 74, r: 48, ci: 1 }, { cx: 178, cy: 86, r: 42, ci: 2 }, { cx: 234, cy: 102, r: 34, ci: 3 }],
  // 11 — three asymmetric
  [{ cx: 88,  cy: 85, r: 55, ci: 0 }, { cx: 170, cy: 65, r: 44, ci: 1 }, { cx: 220, cy: 106, r: 32, ci: 2 }],
  // 12 — two: one very large
  [{ cx: 118, cy: 85, r: 70, ci: 0 }, { cx: 212, cy: 74, r: 42, ci: 1 }],
  // 13 — three: big centre + two flanking small
  [{ cx: 130, cy: 82, r: 60, ci: 0 }, { cx: 48,  cy: 60, r: 34, ci: 1 }, { cx: 218, cy: 60, r: 30, ci: 2 }],
  // 14 — four scattered smalls
  [{ cx: 65,  cy: 55, r: 36, ci: 0 }, { cx: 148, cy: 44, r: 32, ci: 1 }, { cx: 212, cy: 76, r: 38, ci: 2 }, { cx: 118, cy: 107, r: 34, ci: 3 }],
  // 15 — two same-size kissing
  [{ cx: 100, cy: 78, r: 54, ci: 0 }, { cx: 180, cy: 78, r: 54, ci: 1 }],
  // 16 — three stepped ascending
  [{ cx: 72,  cy: 96, r: 48, ci: 0 }, { cx: 140, cy: 72, r: 46, ci: 1 }, { cx: 208, cy: 52, r: 40, ci: 2 }],
  // 17 — one huge + two tiny satellites
  [{ cx: 140, cy: 82, r: 66, ci: 0 }, { cx: 42,  cy: 46, r: 24, ci: 1 }, { cx: 238, cy: 112, r: 22, ci: 2 }],
  // 18 — four cross / plus
  [{ cx: 140, cy: 78, r: 52, ci: 0 }, { cx: 64,  cy: 78, r: 36, ci: 1 }, { cx: 216, cy: 78, r: 36, ci: 2 }, { cx: 140, cy: 118, r: 32, ci: 3 }],
  // 19 — three offset vertical drift
  [{ cx: 92,  cy: 66, r: 50, ci: 0 }, { cx: 150, cy: 90, r: 48, ci: 1 }, { cx: 98,  cy: 118, r: 36, ci: 2 }],
  // 20 — two deeply overlapping
  [{ cx: 122, cy: 78, r: 58, ci: 0 }, { cx: 158, cy: 82, r: 56, ci: 1 }],
];

/** Per-persona colour palettes (index matches LayoutCircle.ci) */
const PERSONA_PALETTES: Record<string, string[]> = {
  Engineer:  ['#F59E0B', '#FBBF24', '#D97706', '#92400E'],
  Seeker:    ['#60A5FA', '#F59E0B', '#34D399', '#818CF8'],
  Spiritual: ['#A78BFA', '#818CF8', '#C084FC', '#7C3AED'],
};

// Fixed star positions for Spiritual persona
const STARS: Array<{ x: number; y: number; r: number; op: number }> = [
  { x: 22,  y: 18,  r: 1.2, op: 0.6  },
  { x: 48,  y: 8,   r: 0.9, op: 0.4  },
  { x: 73,  y: 28,  r: 1.5, op: 0.5  },
  { x: 198, y: 12,  r: 1.1, op: 0.55 },
  { x: 228, y: 36,  r: 0.8, op: 0.35 },
  { x: 248, y: 18,  r: 1.3, op: 0.5  },
  { x: 14,  y: 110, r: 1.0, op: 0.4  },
  { x: 240, y: 105, r: 1.2, op: 0.45 },
  { x: 35,  y: 58,  r: 0.7, op: 0.3  },
  { x: 260, y: 65,  r: 0.9, op: 0.35 },
];

const ReflectionGraphic: React.FC<{ persona: string }> = ({ persona }) => {
  // Pick a random variant on mount; stays stable while card is open
  const [variantIdx] = useState(() => Math.floor(Math.random() * VARIANTS.length));
  const layout  = VARIANTS[variantIdx];
  const palette = PERSONA_PALETTES[persona] ?? PERSONA_PALETTES.Seeker;
  const isSpiritual = persona === 'Spiritual';
  const W = 280;
  const H = 140;

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        {layout.map((c, i) => {
          const color = palette[c.ci % palette.length];
          return (
            <RadialGradient key={`rg${variantIdx}-${i}`} id={`rg${i}`} cx="40%" cy="35%" r="65%">
              <Stop offset="0%"   stopColor={color} stopOpacity={0.58} />
              <Stop offset="100%" stopColor={color} stopOpacity={0.0}  />
            </RadialGradient>
          );
        })}
      </Defs>

      {/* Star dots for Spiritual */}
      {isSpiritual && STARS.map((s, i) => (
        <Circle key={`star-${i}`} cx={s.x} cy={s.y} r={s.r} fill="#E0D7FF" fillOpacity={s.op} />
      ))}

      {/* Overlapping gradient circles */}
      {layout.map((c, i) => (
        <Circle key={`circle-${i}`} cx={c.cx} cy={c.cy} r={c.r} fill={`url(#rg${i})`} />
      ))}

      {/* Subtle rim stroke on primary circle */}
      <Circle
        cx={layout[0].cx} cy={layout[0].cy} r={layout[0].r}
        fill="none"
        stroke={palette[layout[0].ci % palette.length]}
        strokeWidth={0.75}
        strokeOpacity={0.22}
      />
    </Svg>
  );
};

// ─── Dive-deeper: Atlas sparkline ────────────────────────────────────────────

const DeepAtlasChart: React.FC<{ trajectory: number[]; accentColor: string }> = ({
  trajectory,
  accentColor,
}) => {
  const W = 280;
  const H = 68;
  const PAD_X = 8;
  const PAD_Y = 10;
  const points = trajectory.slice(0, 7);
  if (points.length < 2) return null;

  const xs = points.map((_, i) =>
    PAD_X + (i / (points.length - 1)) * (W - PAD_X * 2)
  );
  const ys = points.map(v =>
    H - PAD_Y - ((Math.max(0, Math.min(10, v)) / 10) * (H - PAD_Y * 2))
  );

  // Smooth bezier through points
  let d = `M ${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
  for (let i = 0; i < xs.length - 1; i++) {
    const mx = ((xs[i] + xs[i + 1]) / 2).toFixed(1);
    d += ` C ${mx} ${ys[i].toFixed(1)}, ${mx} ${ys[i + 1].toFixed(1)}, ${xs[i + 1].toFixed(1)} ${ys[i + 1].toFixed(1)}`;
  }
  const fillD = `${d} L ${xs[xs.length - 1].toFixed(1)} ${H} L ${xs[0].toFixed(1)} ${H} Z`;

  return (
    <View style={styles.deepChartWrap}>
      <Text style={[styles.deepChartLabel, { color: accentColor }]}>7-DAY TRAJECTORY</Text>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={accentColor} stopOpacity={0.22} />
            <Stop offset="100%" stopColor={accentColor} stopOpacity={0.0} />
          </LinearGradient>
        </Defs>
        <Path d={fillD} fill="url(#sparkFill)" />
        <Path d={d} stroke={accentColor} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
        <Circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={3} fill={accentColor} />
      </Svg>
    </View>
  );
};

// ─── Dive-deeper: Nodes sliders ───────────────────────────────────────────────

const DeepNodesChart: React.FC<{ bubbles: NodeBubble[]; accentColor: string }> = ({
  bubbles,
  accentColor,
}) => {
  if (bubbles.length === 0) return null;
  return (
    <View style={styles.deepChartWrap}>
      <Text style={[styles.deepChartLabel, { color: accentColor }]}>NODE SCORES</Text>
      {bubbles.map((b, i) => (
        <View key={`slider-${i}`} style={styles.deepNodeRow}>
          <View style={[styles.deepNodeDot, { backgroundColor: b.color }]} />
          <Text style={styles.deepNodeName} numberOfLines={1}>
            {b.name.length > 10 ? b.name.slice(0, 10) : b.name}
          </Text>
          <View style={styles.deepNodeTrack}>
            <View
              style={[
                styles.deepNodeFill,
                { width: `${(b.score / 10) * 100}%` as any, backgroundColor: b.color },
              ]}
            />
          </View>
          <Text style={[styles.deepNodeScore, { color: b.color }]}>
            {b.score.toFixed(1)}
          </Text>
        </View>
      ))}
    </View>
  );
};

// ─── Dive-deeper: Actions XY scatter ─────────────────────────────────────────

const DeepActionsChart: React.FC<{ coordinates: CoordinateDot[]; accentColor: string }> = ({
  coordinates,
  accentColor,
}) => {
  if (coordinates.length === 0) return null;

  const W = 280;
  const H = 110;
  const PAD = 14;
  const maxCal = Math.max(1, ...coordinates.map(c => c.calibrationCount));

  const dots = coordinates.map(c => ({
    cx: PAD + (c.calibrationCount / maxCal) * (W - PAD * 2),
    cy: PAD + ((1 - c.score / 10)) * (H - PAD * 2),
    color: c.color,
    name: c.name,
  }));

  return (
    <View style={styles.deepChartWrap}>
      <Text style={[styles.deepChartLabel, { color: accentColor }]}>EFFORT · SCORE</Text>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {dots.map((d, i) => (
          <Circle
            key={`dot-${i}`}
            cx={d.cx}
            cy={d.cy}
            r={5}
            fill={d.color}
            fillOpacity={0.85}
          />
        ))}
      </Svg>
    </View>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

export const CopilotCard: React.FC<CopilotCardProps> = ({
  tab,
  tabConfig,
  payload,
  isLoading,
  onClose,
  onAction,
  persona,
  lastCycle,
  nodeBubbles,
  focusCoordinate,
  systemTrajectory,
  allCoordinates,
}) => {
  const [expanded, setExpanded] = useState(false);
  const { accentColor } = tabConfig;

  const primaryLine = payload?.lines?.[0];
  const secondaryLine = payload?.lines?.[1];
  const actions = (payload?.actions ?? []).slice(0, 2);

  const showDeepAtlas = tab === 'Atlas' && !!systemTrajectory && systemTrajectory.length >= 2;
  const showDeepNodes = tab === 'Nodes' && !!nodeBubbles && nodeBubbles.length > 0;
  const showDeepActions = tab === 'Actions' && !!allCoordinates && allCoordinates.length > 0;

  return (
    <View style={styles.card}>

      {/* ── Persona pill + close ── */}
      <View style={styles.topRow}>
        <View style={[styles.personaPill, { borderColor: accentColor + '40' }]}>
          <View style={[styles.personaDot, { backgroundColor: accentColor }]} />
          <Text style={[styles.personaText, { color: accentColor }]}>{persona.toUpperCase()}</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* ── Abstract reflection graphic ── */}
      <View style={styles.graphicWrap}>
        <ReflectionGraphic persona={persona} />
      </View>

      {/* ── Primary insight (hero) ── */}
      <View style={[styles.insightBlock, isLoading && { opacity: 0.35 }]}>
        {primaryLine?.prefix ? (
          <Text style={[styles.insightLabel, { color: accentColor }]}>
            {primaryLine.prefix.toUpperCase()}
          </Text>
        ) : null}
        <Text style={styles.insightHero}>
          {isLoading
            ? persona === 'Engineer'
              ? 'Analyzing your data···'
              : persona === 'Seeker'
              ? 'Mapping your path···'
              : 'Reading your energy···'
            : (primaryLine?.text ?? '')}
        </Text>
      </View>

      {/* ── Actions (max 2) ── */}
      {actions.length > 0 && (
        <View style={[styles.actionsBlock, isLoading && { opacity: 0.4 }]}>
          {actions.map((act, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.actionBtn, { borderColor: accentColor + '45' }]}
              onPress={() => { if (!isLoading) onAction(act); }}
              activeOpacity={0.75}
            >
              <Text style={[styles.actionArrow, { color: accentColor }]}>→</Text>
              <Text style={styles.actionLabel}>{act.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Dive deeper toggle ── */}
      <TouchableOpacity
        style={[styles.deeperBtn, { borderTopColor: 'rgba(255,255,255,0.06)' }]}
        onPress={() => setExpanded(v => !v)}
        activeOpacity={0.7}
      >
        <Text style={[styles.deeperText, { color: accentColor }]}>
          {expanded ? 'COLLAPSE ↑' : 'DIVE DEEPER ↓'}
        </Text>
      </TouchableOpacity>

      {/* ── Expanded detail ── */}
      {expanded && (
        <View style={styles.expandedSection}>

          {/* Tab-specific data chart */}
          {showDeepAtlas && (
            <DeepAtlasChart trajectory={systemTrajectory!} accentColor={accentColor} />
          )}
          {showDeepNodes && (
            <DeepNodesChart bubbles={nodeBubbles!} accentColor={accentColor} />
          )}
          {showDeepActions && (
            <DeepActionsChart coordinates={allCoordinates!} accentColor={accentColor} />
          )}

          {secondaryLine && (
            <View style={styles.detailLineItem}>
              <Text style={[styles.detailPrefix, { color: accentColor }]}>{secondaryLine.prefix}</Text>
              <Text style={styles.detailBody}>{secondaryLine.text}</Text>
            </View>
          )}
          {(payload?.lines ?? []).slice(2).map((line, i) => (
            <View key={i} style={styles.detailLineItem}>
              <Text style={[styles.detailPrefix, { color: accentColor }]}>{line.prefix}</Text>
              <Text style={styles.detailBody}>{line.text}</Text>
            </View>
          ))}

          {lastCycle && (() => {
            const delta = lastCycle.nodeAvgNow - lastCycle.nodeAvgBefore;
            const improving = delta > 0.05;
            const declining = delta < -0.05;
            const deltaColor = improving ? '#4ade80' : declining ? '#fb7185' : '#64748B';
            const trendIcon = improving ? '↑' : declining ? '↓' : '─';
            return (
              <View style={styles.lastCycleCard}>
                <View style={styles.lastCycleTopRow}>
                  <Text style={styles.lastCycleLabel}>LAST CYCLE</Text>
                  <Text style={[styles.lastCycleDelta, { color: deltaColor }]}>
                    {delta >= 0 ? '+' : ''}{delta.toFixed(1)} {trendIcon}
                  </Text>
                </View>
                <Text style={styles.lastCycleCoord}>
                  {lastCycle.goalName}
                  <Text style={styles.lastCycleNode}> · {lastCycle.nodeName}</Text>
                </Text>
                <View style={styles.lastCycleScoreRow}>
                  <Text style={styles.lastCycleScoreBefore}>{lastCycle.nodeAvgBefore.toFixed(1)}</Text>
                  <View style={styles.lastCycleTrack}>
                    <View
                      style={[
                        styles.lastCycleFill,
                        { width: `${(lastCycle.nodeAvgNow / 10) * 100}%` as any, backgroundColor: deltaColor },
                      ]}
                    />
                  </View>
                  <Text style={[styles.lastCycleScoreNow, { color: deltaColor }]}>
                    {lastCycle.nodeAvgNow.toFixed(1)}
                  </Text>
                </View>
              </View>
            );
          })()}
        </View>
      )}

    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  personaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  personaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  personaText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  closeBtn: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '600',
  },

  // Reflection graphic
  graphicWrap: {
    marginBottom: 18,
    marginHorizontal: -6,
  },

  // Insight hero
  insightBlock: {
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  insightLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.5,
    marginBottom: 6,
    opacity: 0.7,
  },
  insightHero: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.15,
    lineHeight: 24,
  },

  // Actions
  actionsBlock: {
    gap: 8,
    marginBottom: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  actionArrow: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 0,
  },
  actionLabel: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  // Dive deeper
  deeperBtn: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  deeperText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },

  // Expanded section
  expandedSection: {
    marginTop: 14,
    gap: 12,
  },

  // Dive-deeper charts shared
  deepChartWrap: {
    marginBottom: 4,
  },
  deepChartLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.5,
    marginBottom: 8,
    opacity: 0.65,
  },

  // Nodes slider rows
  deepNodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  deepNodeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    flexShrink: 0,
  },
  deepNodeName: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    width: 72,
    flexShrink: 0,
  },
  deepNodeTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  deepNodeFill: {
    height: 3,
    borderRadius: 2,
    opacity: 0.75,
  },
  deepNodeScore: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    minWidth: 28,
    textAlign: 'right',
    flexShrink: 0,
  },
  detailLineItem: {
    gap: 3,
  },
  detailPrefix: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
  },
  detailBody: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
    lineHeight: 18,
  },

  // Last Cycle
  lastCycleCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  lastCycleTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  lastCycleLabel: {
    color: '#475569',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
  },
  lastCycleDelta: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  lastCycleCoord: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  lastCycleNode: {
    color: '#64748B',
  },
  lastCycleScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lastCycleScoreBefore: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
    minWidth: 28,
  },
  lastCycleTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  lastCycleFill: {
    height: 4,
    borderRadius: 2,
    opacity: 0.7,
  },
  lastCycleScoreNow: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'right',
  },
});
