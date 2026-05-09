import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAppStore } from '../stores/useAppStore';
import { ActionEffort } from '../types';
import { THEME } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { GlassCard } from '../components/GlassCard';


const EFFORT_LABELS: Record<ActionEffort, string> = { easy: 'E', medium: 'M', heavy: 'H' };
const EFFORT_COLORS: Record<ActionEffort, string> = { easy: 'rgba(255,255,255,0.25)', medium: 'rgba(255,255,255,0.5)', heavy: 'rgba(255,255,255,0.85)' };


interface ActionsScreenProps {
  addActionOpen: boolean;
  setAddActionOpen: (v: boolean) => void;
  addActionTarget: { nodeId: string; goalId: string } | null;
  setAddActionTarget: (v: { nodeId: string; goalId: string } | null) => void;
  selectedNodeId: string | null;
  onOpenEditAction: (nodeId: string, goalId: string, actionId: string) => void;
  onOpenCoordEdit: (nodeId: string, goalId: string) => void;
}

export const ActionsScreen: React.FC<ActionsScreenProps> = ({
  addActionOpen,
  setAddActionOpen,
  addActionTarget,
  setAddActionTarget,
  selectedNodeId,
  onOpenEditAction,
  onOpenCoordEdit: _onOpenCoordEdit,
}) => {
  const { nodes, toggleAction, togglePriority } = useAppStore();
  const theme = useTheme();
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  const toggleCollapse = (nodeId: string) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
      return next;
    });
  };

  const toggleFilter = (id: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const [addActionTitle, setAddActionTitle] = useState('');
  const [addActionCoordDropdownOpen, setAddActionCoordDropdownOpen] = useState(false);
  const [addActionEffort, setAddActionEffort] = useState<ActionEffort>('easy');
  const { addAction } = useAppStore();

  const isFocusActive = activeFilters.has('FOCUS');
  const activeNodeIds = [...activeFilters].filter(f => f !== 'FOCUS');
  const nodesToConsider = (activeNodeIds.length > 0 ? nodes.filter(n => activeNodeIds.includes(n.id)) : nodes).filter(n => !n.archived);

  const nodeGroups = nodesToConsider.map(n => ({
    node: n,
    coords: n.goals.filter(g => !g.archived).map(g => ({
      goalId: g.id,
      coordinateName: g.name,
      actions: (isFocusActive ? g.actions.filter(a => a.isPriority) : g.actions).filter(a => !a.archived),
    })).filter(c => c.actions.length > 0),
  })).filter(ng => ng.coords.length > 0);

  const sortOrder = (a: { completed: boolean; isPriority: boolean }) =>
    a.completed ? 2 : (a.isPriority ? 0 : 1);

  return (
    <View>
      <View style={styles.filterRow}>
        {nodes.map(n => {
          const active = activeFilters.has(n.id);
          return (
            <TouchableOpacity key={n.id} onPress={() => toggleFilter(n.id)} activeOpacity={0.8}>
              <View style={[styles.pill, active ? { backgroundColor: n.color, borderColor: n.color } : styles.pillInactive]}>
                <Text style={[styles.pillText, { color: active ? 'white' : THEME.textDim }]}>{n.name.toUpperCase()}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity onPress={() => toggleFilter('FOCUS')} activeOpacity={0.8}>
          <View style={[styles.pill, isFocusActive ? { backgroundColor: THEME.accent, borderColor: THEME.accent } : styles.pillInactive]}>
            <Svg width={11} height={11} viewBox="0 0 24 24" style={{ marginRight: 5 }}>
              {isFocusActive ? (
                <Path fill="white" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              ) : (
                <Path fill="none" stroke={THEME.textDim} strokeWidth="1.5" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              )}
            </Svg>
            <Text style={[styles.pillText, { color: isFocusActive ? 'white' : THEME.textDim }]}>FOCUS</Text>
          </View>
        </TouchableOpacity>
      </View>

      {nodeGroups.length === 0 ? (
        <View style={styles.actionEmptyState}>
          <Text style={[styles.actionEmptyStateText, { color: theme.textMuted }]}>
            {isFocusActive
              ? 'NO PRIORITY ACTIONS'
              : activeNodeIds.length > 0
              ? 'NO ACTIONS YET FOR THIS NODE'
              : 'NO ACTIVE ACTIONS'}
          </Text>
          {!isFocusActive && (
            <TouchableOpacity
              style={[styles.addActionBtn, { marginTop: 16, marginBottom: 0, alignSelf: 'center' }]}
              onPress={() => { setAddActionTarget(null); setAddActionTitle(''); setAddActionCoordDropdownOpen(false); setAddActionOpen(true); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.addActionBtnText, { color: theme.accent }]}>+ ADD ACTION</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        nodeGroups.map(({ node, coords }) => {
          const collapsed = collapsedNodes.has(node.id);
          const pendingCount = coords.reduce((acc, c) => acc + c.actions.filter(a => !a.completed).length, 0);
          return (
          <View key={node.id} style={styles.nodeSection}>
            {/* Node header row */}
            <TouchableOpacity onPress={() => toggleCollapse(node.id)} activeOpacity={0.8}>
              <View style={styles.nodeHeader}>
                <Text style={[styles.nodeTitle, { color: node.color }, collapsed && { opacity: 0.5 }]}>{node.name.toUpperCase()}</Text>
                <View style={styles.nodeHeaderRight}>
                  {collapsed && pendingCount > 0 && (
                    <View style={[styles.collapsedBadge, { backgroundColor: node.color + '33', borderColor: node.color + '55' }]}>
                      <Text style={[styles.collapsedBadgeText, { color: node.color }]}>{pendingCount}</Text>
                    </View>
                  )}
                  <Svg width={14} height={14} viewBox="0 0 24 24" style={{ opacity: 0.35, transform: [{ rotate: collapsed ? '0deg' : '180deg' }] }}>
                    <Path fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" d="M6 9l6 6 6-6" />
                  </Svg>
                </View>
              </View>
            </TouchableOpacity>

            {/* Indented content with colored left rail */}
            {!collapsed && (
            <View style={styles.nodeIndentRow}>
              <View style={[styles.nodeRail, { backgroundColor: node.color }]} />
              <View style={styles.nodeIndentContent}>
                {coords.map(coord => (
                  <View key={coord.goalId} style={styles.coordSection}>
                    <Text style={[styles.coordLabel, { color: node.color }]}>{coord.coordinateName.toUpperCase()}</Text>
                    {[...coord.actions].sort((a, b) => sortOrder(a) - sortOrder(b)).map(a => {
                      const pri = !!a.isPriority;
                      const effort = a.effort ?? 'easy';
                      return (
                          <TouchableOpacity
                            key={a.id}
                            style={[styles.actionCardOuter, pri && styles.actionCardPriority]}
                            onPress={() => onOpenEditAction(node.id, coord.goalId, a.id)}
                            activeOpacity={0.85}
                          >
                            <GlassCard style={[styles.actionCard, { borderColor: node.color + '33' }]}>
                              <View style={styles.actionCardBody}>
                                <View style={styles.actionRow}>
                                  <TouchableOpacity
                                    style={styles.actionFocusBtn}
                                    onPress={() => togglePriority(node.id, coord.goalId, a.id)}
                                    activeOpacity={0.8}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  >
                                    <Svg width={18} height={18} viewBox="0 0 24 24">
                                      {pri ? (
                                        <Path fill={theme.accent} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                      ) : (
                                        <Path fill="none" stroke={theme.textMuted} strokeWidth="1.5" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                      )}
                                    </Svg>
                                  </TouchableOpacity>
                                  <View style={styles.actionTitleBlock}>
                                    <Text style={[styles.actionTitle, { color: theme.text }, a.completed && styles.actionTitleStrike, a.completed && { opacity: 0.4 }]}>{a.title}</Text>
                                  </View>
                                  <View style={styles.actionRightBlock}>
                                    <View style={[styles.effortBadge, { borderColor: EFFORT_COLORS[effort] }]}>
                                      <Text style={[styles.effortBadgeText, { color: EFFORT_COLORS[effort] }]}>{EFFORT_LABELS[effort]}</Text>
                                    </View>
                                    <TouchableOpacity
                                      onPress={() => toggleAction(node.id, coord.goalId, a.id)}
                                      activeOpacity={0.8}
                                      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                                    >
                                      <Svg width={28} height={28} viewBox="0 0 24 24">
                                        {a.completed ? (
                                          <>
                                            <Circle cx="12" cy="12" r="10" fill={node.color} />
                                            <Path d="M7 12l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                          </>
                                        ) : (
                                          <Circle cx="12" cy="12" r="10" fill="none" stroke={node.color} strokeWidth="1.5" strokeOpacity={0.4} />
                                        )}
                                      </Svg>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              </View>
                            </GlassCard>
                          </TouchableOpacity>
                      );
                    })}
                    {/* Inline add action */}
                    <TouchableOpacity
                      style={styles.inlineAddBtn}
                      onPress={() => {
                        setAddActionTarget({ nodeId: node.id, goalId: coord.goalId });
                        setAddActionTitle('');
                        setAddActionCoordDropdownOpen(false);
                        setAddActionOpen(true);
                      }}
                      activeOpacity={0.6}
                    >
                      <Text style={[styles.inlineAddText, { color: node.color }]}>+ ADD ACTION</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
            )}
          </View>
        );})
      )}
      {/* ── Add Action overlay ─────────────────────────────────────────────── */}
      <Modal
        visible={addActionOpen}
        transparent
        animationType="slide"
        onRequestClose={() => { setAddActionOpen(false); setAddActionTitle(''); setAddActionTarget(null); setAddActionCoordDropdownOpen(false); setAddActionEffort('easy'); }}
      >
        <KeyboardAvoidingView
          style={styles.addActionOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => { setAddActionOpen(false); setAddActionTitle(''); setAddActionTarget(null); setAddActionCoordDropdownOpen(false); setAddActionEffort('easy'); }}
            activeOpacity={1}
          />
          {(() => {
            const addActionNode = nodes.find(n => n.id === addActionTarget?.nodeId);
            const effortColor = addActionNode?.color || theme.accent;
            const dismiss = () => { setAddActionOpen(false); setAddActionTitle(''); setAddActionTarget(null); setAddActionCoordDropdownOpen(false); setAddActionEffort('easy'); };
            const submit = () => {
              if (addActionTarget && addActionTitle.trim()) {
                addAction(addActionTarget.nodeId, addActionTarget.goalId, addActionTitle.trim(), addActionEffort);
                dismiss();
              }
            };
            return (
              <GlassCard style={styles.addActionSheet}>

                {/* 1. Title — first, autoFocus, fast capture */}
                <Text style={[styles.addActionFormLabel, { color: theme.textMuted }]}>TITLE</Text>
                <TextInput
                  style={[styles.addActionInput, { color: theme.text, borderBottomColor: theme.glassBorder, fontSize: 17, marginBottom: 20 }]}
                  value={addActionTitle}
                  onChangeText={setAddActionTitle}
                  placeholder="What do you need to do?"
                  placeholderTextColor={theme.textMuted}
                  autoFocus
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={submit}
                />

                {/* 2. Effort — adapts to node color once selected */}
                <Text style={[styles.addActionFormLabel, { color: theme.textMuted }]}>EFFORT</Text>
                <View style={[styles.effortRow, { marginBottom: 20 }]}>
                  {(['easy', 'medium', 'heavy'] as ActionEffort[]).map(level => {
                    const sel = addActionEffort === level;
                    const labels: Record<ActionEffort, string> = { easy: 'EASY', medium: 'MEDIUM', heavy: 'HEAVY' };
                    return (
                      <TouchableOpacity
                        key={level}
                        style={[styles.effortBtn, sel && { borderColor: effortColor, backgroundColor: effortColor + '18' }]}
                        onPress={() => setAddActionEffort(level)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.effortBtnText, { color: sel ? effortColor : theme.textMuted }]}>{labels[level]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* 3. Node selector */}
                <Text style={[styles.addActionFormLabel, { color: theme.textMuted }]}>NODE</Text>
                <View style={[styles.addActionNodeRow, { marginBottom: 16 }]}>
                  {nodes.filter(n => !n.archived).map((n, i) => {
                    const sel = addActionTarget?.nodeId === n.id;
                    return (
                      <TouchableOpacity
                        key={n.id}
                        style={[styles.addActionNodeBtn, sel && { borderColor: n.color, backgroundColor: n.color + '18' }, i === nodes.filter(x => !x.archived).length - 1 && { marginRight: 0 }]}
                        onPress={() => { setAddActionTarget({ nodeId: n.id, goalId: n.goals.filter(g => !g.archived)[0]?.id || '' }); setAddActionCoordDropdownOpen(false); }}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.addActionNodeBtnText, { color: sel ? n.color : theme.textMuted }]}>{n.name.toUpperCase()}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* 4. Coordinate selector */}
                <Text style={[styles.addActionFormLabel, { color: theme.textMuted }]}>COORDINATE</Text>
                <View style={styles.addActionDropdownWrap}>
                  <TouchableOpacity
                    style={[styles.addActionDropdownTrigger, { borderColor: addActionNode ? addActionNode.color + '44' : theme.glassBorder, opacity: addActionNode ? 1 : 0.5 }]}
                    onPress={() => addActionTarget?.nodeId && setAddActionCoordDropdownOpen(v => !v)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.addActionDropdownTriggerText, { color: addActionNode ? effortColor : theme.textMuted }]} numberOfLines={1}>
                      {addActionTarget?.nodeId
                        ? (addActionNode?.goals.find(g => g.id === addActionTarget.goalId)?.name || 'Select coordinate')
                        : 'Select a node first'}
                    </Text>
                    <Svg width={14} height={14} viewBox="0 0 24 24" style={styles.addActionDropdownChevron}>
                      <Path fill={THEME.textDim} d="M7 10l5 5 5-5H7z" />
                    </Svg>
                  </TouchableOpacity>
                  {addActionCoordDropdownOpen && addActionTarget?.nodeId && (
                    <View style={styles.addActionDropdownList}>
                      {(addActionNode?.goals.filter(g => !g.archived) || []).map(g => (
                        <TouchableOpacity
                          key={g.id}
                          style={[styles.addActionDropdownItem, addActionTarget?.goalId === g.id && { backgroundColor: effortColor + '14' }]}
                          onPress={() => { setAddActionTarget(addActionTarget ? { ...addActionTarget, goalId: g.id } : null); setAddActionCoordDropdownOpen(false); }}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.addActionCoordChipText, { color: addActionTarget?.goalId === g.id ? effortColor : theme.text }]}>{g.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Bottom actions */}
                <View style={styles.addActionActions}>
                  <TouchableOpacity style={styles.addActionCancel} onPress={dismiss} activeOpacity={0.7}>
                    <Text style={[styles.addActionCancelText, { color: theme.textMuted }]}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addActionSubmit, { borderColor: addActionTarget && addActionTitle.trim() ? effortColor : theme.glassBorder }]}
                    onPress={submit}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.addActionSubmitText, { color: addActionTarget && addActionTitle.trim() ? effortColor : theme.textMuted }]}>ADD ACTION</Text>
                  </TouchableOpacity>
                </View>
              </GlassCard>
            );
          })()}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
  pillInactive: { borderColor: 'rgba(255,255,255,0.15)' },
  pillText: { fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  addActionBtn: { marginBottom: 16, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1 },
  addActionBtnText: { fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  addActionOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  addActionSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 48 },
  addActionFormLabel: { fontSize: 14, fontWeight: '800', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' },
  addActionNodeRow: { flexDirection: 'row', marginBottom: 16 },
  addActionNodeBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, alignItems: 'center' },
  addActionNodeBtnText: { fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  addActionDropdownWrap: { marginBottom: 16 },
  addActionDropdownTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 4 },
  addActionDropdownTriggerText: { fontSize: 14, flex: 1 },
  addActionDropdownChevron: { marginLeft: 8 },
  addActionDropdownList: { marginTop: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, overflow: 'hidden' },
  addActionDropdownItem: { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  addActionDropdownItemActive: { backgroundColor: 'rgba(255,255,255,0.06)' },
  addActionCoordChipText: { fontSize: 14, fontWeight: '600' },
  addActionInput: { fontSize: 14, paddingVertical: 10, paddingHorizontal: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', marginBottom: 16 },
  effortRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  effortBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
  effortBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  addActionActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  addActionCancel: { paddingVertical: 8, paddingHorizontal: 16, marginRight: 12 },
  addActionCancelText: { fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  addActionSubmit: { paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderRadius: 12 },
  addActionSubmitText: { fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  nodeSection: { marginBottom: 24 },
  nodeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  nodeHeaderRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 },
  collapsedBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  collapsedBadgeText: { fontSize: 11, fontWeight: '700' },
  nodeIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  nodeIconLetter: { color: 'white', fontSize: 14, fontWeight: '700' },
  nodeTitle: { fontSize: 20, fontWeight: '600', letterSpacing: 6 },
  nodeIndentRow: { flexDirection: 'row', gap: 14 },
  nodeRail: { width: 2, borderRadius: 1, opacity: 0.35 },
  nodeIndentContent: { flex: 1 },
  coordSection: { marginBottom: 14 },
  coordLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 3, marginBottom: 8, opacity: 0.6 },
  actionCardOuter: { marginBottom: 6, borderRadius: 10, overflow: 'hidden' },
  actionCardPriority: { shadowColor: '#38BDF8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 10 },
  actionCard: { paddingVertical: 14, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  actionCardBody: { flex: 1, flexDirection: 'column' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionFocusBtn: { padding: 4, marginRight: 10 },
  actionTitleBlock: { flex: 1 },
  actionRightBlock: { flexDirection: 'row', alignItems: 'center' },
  actionPriorityLabel: { fontSize: 14, fontWeight: '700', letterSpacing: 1, marginRight: 8 },
  effortBadge: { borderWidth: 1, borderRadius: 4, paddingVertical: 2, paddingHorizontal: 5, marginRight: 8 },
  effortBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  actionTitle: { fontSize: 17, fontWeight: '500' },
  actionTitleStrike: { textDecorationLine: 'line-through' },
  actionEmptyState: { borderWidth: 1, borderColor: 'rgba(226,232,240,0.5)', borderStyle: 'dashed', borderRadius: 12, padding: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  actionEmptyStateText: { fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  inlineAddBtn: { paddingVertical: 8, paddingHorizontal: 4, alignSelf: 'flex-start' },
  inlineAddText: { fontSize: 10, fontWeight: '700', letterSpacing: 2, opacity: 0.45 },
});
