import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CopilotPayload, CopilotAction, TabConfig } from '../services/aiService';

// ─── Last Cycle data shape ────────────────────────────────────────────────────

export interface LastCycleData {
  action: string;
  goalName: string;
  nodeName: string;
  valueBefore: number;
  nodeAvgBefore: number;
  nodeAvgNow: number;
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
}

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
}) => {
  const { accentColor, icon } = tabConfig;

  // Derive display header — payload header when loaded, persona fallback when loading
  const displayHeader = payload?.header ?? (isLoading ? '···' : 'CO-PILOT');

  // Action label mapping for Last Cycle display
  const ACTION_LABELS: Record<string, string> = {
    calibrate: 'CALIBRATED',
    addCalibration: 'CALIBRATION ADDED',
    prioritize: 'REVIEWED',
    deployTask: 'ACTION DEPLOYED',
  };

  return (
    <View style={[styles.card, { borderTopColor: accentColor }]}>

      {/* ── Header row ── */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={[styles.icon, { color: accentColor }]}>{icon}</Text>
          <View>
            <Text style={[styles.headerText, { color: accentColor }]}>
              {displayHeader}
            </Text>
            <Text style={styles.personaBadge}>{persona.toUpperCase()}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* ── Last Cycle recap ── */}
      {lastCycle && (() => {
        const delta = lastCycle.nodeAvgNow - lastCycle.nodeAvgBefore;
        const improving = delta > 0.05;
        const declining = delta < -0.05;
        const deltaColor = improving ? '#4ade80' : declining ? '#fb7185' : '#64748B';
        const trendIcon = improving ? '↑' : declining ? '↓' : '─';
        const ACTION_ICONS: Record<string, string> = {
          calibrate: '⊙', addCalibration: '✦', prioritize: '◈', deployTask: '◫',
        };
        const actionIcon = ACTION_ICONS[lastCycle.action] ?? '○';
        return (
          <View style={styles.lastCycleCard}>
            {/* Label + action badge */}
            <View style={styles.lastCycleTopRow}>
              <Text style={styles.lastCycleLabel}>LAST CYCLE</Text>
              <View style={styles.lastCycleActionBadge}>
                <Text style={styles.lastCycleActionIcon}>{actionIcon}</Text>
                <Text style={styles.lastCycleActionText}>{ACTION_LABELS[lastCycle.action] ?? 'ACTIONED'}</Text>
              </View>
            </View>

            {/* Coord · Node */}
            <Text style={styles.lastCycleCoordName}>
              {lastCycle.goalName}
              <Text style={styles.lastCycleNodeName}> · {lastCycle.nodeName}</Text>
            </Text>

            {/* Before ──▶ After + delta badge */}
            <View style={styles.lastCycleScoreRow}>
              <View style={styles.lastCycleScoreBubble}>
                <Text style={styles.lastCycleScoreNum}>{lastCycle.nodeAvgBefore.toFixed(1)}</Text>
                <Text style={styles.lastCycleScoreUnit}>BEFORE</Text>
              </View>
              <View style={styles.lastCycleArrowTrack}>
                <View style={[styles.lastCycleArrowLine, { backgroundColor: deltaColor + '50' }]} />
                <Text style={[styles.lastCycleArrowHead, { color: deltaColor }]}>▶</Text>
              </View>
              <View style={[styles.lastCycleScoreBubble, { borderColor: deltaColor + '55' }]}>
                <Text style={[styles.lastCycleScoreNum, { color: deltaColor }]}>{lastCycle.nodeAvgNow.toFixed(1)}</Text>
                <Text style={styles.lastCycleScoreUnit}>NOW</Text>
              </View>
              <View style={[styles.lastCycleDeltaBadge, { backgroundColor: deltaColor + '18', borderColor: deltaColor + '45' }]}>
                <Text style={[styles.lastCycleDeltaNum, { color: deltaColor }]}>
                  {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                </Text>
                <Text style={[styles.lastCycleTrendIcon, { color: deltaColor }]}>{trendIcon}</Text>
              </View>
            </View>
          </View>
        );
      })()}

      {/* ── Stats pills ── */}
      {(payload?.stats?.length || isLoading) ? (
        <View style={[styles.statsRow, isLoading && { opacity: 0.35 }]}>
          {(payload?.stats ?? [{ label: '···', value: '···' }, { label: '···', value: '···' }]).map((s, i) => (
            <View key={i} style={[styles.statPill, { borderColor: accentColor + '40' }]}>
              <Text style={[styles.statValue, { color: accentColor }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* ── Briefing lines ── */}
      <View style={[styles.linesBlock, isLoading && { opacity: 0.35 }]}>
        {(payload?.lines ?? []).map((line, i) => (
          <View key={i} style={styles.lineItem}>
            <Text style={[styles.linePrefix, { color: accentColor }]}>{line.prefix}</Text>
            <Text style={styles.lineBody}>{line.text}</Text>
          </View>
        ))}
        {isLoading && !payload && (
          <>
            <View style={styles.lineItem}>
              <Text style={[styles.linePrefix, { color: accentColor }]}>{'> SCAN:'}</Text>
              <Text style={styles.lineBody}>SCANNING YOUR DATA···</Text>
            </View>
            <View style={styles.lineItem}>
              <Text style={[styles.linePrefix, { color: accentColor }]}>{'> SIGNAL:'}</Text>
              <Text style={styles.lineBody}>CALIBRATING RESPONSE···</Text>
            </View>
          </>
        )}
      </View>

      {/* ── Divider ── */}
      <View style={[styles.divider, { backgroundColor: accentColor + '25' }]} />

      {/* ── Action buttons ── */}
      <View style={[styles.actionsBlock, isLoading && { opacity: 0.4 }]}>
        {(payload?.actions ?? []).map((act, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.actionBtn, { borderColor: accentColor + '55' }]}
            onPress={() => { if (!isLoading) onAction(act); }}
            activeOpacity={0.75}
          >
            <Text style={[styles.actionArrow, { color: accentColor }]}>→</Text>
            <Text style={styles.actionLabel}>{act.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderTopWidth: 2,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 28,
  },
  headerText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  personaBadge: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 2,
  },
  closeBtn: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '400',
  },

  // Last Cycle
  lastCycleCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
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
  lastCycleActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 20,
  },
  lastCycleActionIcon: {
    color: '#94A3B8',
    fontSize: 10,
  },
  lastCycleActionText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  lastCycleCoordName: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  lastCycleNodeName: {
    color: '#64748B',
    fontWeight: '400',
  },
  lastCycleScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lastCycleScoreBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lastCycleScoreNum: {
    color: '#E2E8F0',
    fontSize: 17,
    fontWeight: '200',
    letterSpacing: 0.5,
  },
  lastCycleScoreUnit: {
    color: '#475569',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1,
  },
  lastCycleArrowTrack: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastCycleArrowLine: {
    flex: 1,
    height: 1,
  },
  lastCycleArrowHead: {
    fontSize: 9,
    marginLeft: 2,
  },
  lastCycleDeltaBadge: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 44,
  },
  lastCycleDeltaNum: {
    fontSize: 16,
    fontWeight: '200',
    letterSpacing: 0.5,
  },
  lastCycleTrendIcon: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 1,
  },

  // Stats pills
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '200',
    letterSpacing: 1,
    marginBottom: 2,
  },
  statLabel: {
    color: '#475569',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
  },

  // Lines
  linesBlock: {
    marginBottom: 16,
    gap: 10,
  },
  lineItem: {
    gap: 3,
  },
  linePrefix: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
  },
  lineBody: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.2,
    lineHeight: 19,
  },

  // Divider
  divider: {
    height: 1,
    marginBottom: 14,
  },

  // Actions
  actionsBlock: {
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 10,
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
    letterSpacing: 0.3,
  },
});
