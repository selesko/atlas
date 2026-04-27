import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAppStore } from '../stores/useAppStore';
import { THEME } from '../constants/theme';

interface TasksScreenProps {
  addTaskOpen: boolean;
  setAddTaskOpen: (v: boolean) => void;
  addTaskTarget: { nodeId: string; goalId: string } | null;
  setAddTaskTarget: (v: { nodeId: string; goalId: string } | null) => void;
  selectedNodeId: string | null;
  onOpenEditTask: (nodeId: string, goalId: string, taskId: string) => void;
  onOpenCoordEdit: (nodeId: string, goalId: string) => void;
}

export const TasksScreen: React.FC<TasksScreenProps> = ({
  addTaskOpen,
  setAddTaskOpen,
  addTaskTarget,
  setAddTaskTarget,
  selectedNodeId,
  onOpenEditTask,
  onOpenCoordEdit: _onOpenCoordEdit,
}) => {
  const { nodes, toggleTask, togglePriority } = useAppStore();
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

  const [addTaskTitle, setAddTaskTitle] = useState('');
  const [addTaskCoordDropdownOpen, setAddTaskCoordDropdownOpen] = useState(false);
  const { addTask } = useAppStore();

  const isFocusActive = activeFilters.has('FOCUS');
  const activeNodeIds = [...activeFilters].filter(f => f !== 'FOCUS');
  const nodesToConsider = activeNodeIds.length > 0 ? nodes.filter(n => activeNodeIds.includes(n.id)) : nodes;

  const nodeGroups = nodesToConsider.map(n => ({
    node: n,
    coords: n.goals.map(g => ({
      goalId: g.id,
      coordinateName: g.name,
      tasks: isFocusActive ? g.tasks.filter(t => t.isPriority) : g.tasks,
    })).filter(c => c.tasks.length > 0),
  })).filter(ng => ng.coords.length > 0);

  const sortOrder = (t: { completed: boolean; isPriority: boolean }) =>
    t.completed ? 2 : (t.isPriority ? 0 : 1);

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

      <TouchableOpacity
        style={styles.addTaskBtn}
        onPress={() => {
          const selNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;
          const first = nodes[0]?.goals[0] ? { nodeId: nodes[0].id, goalId: nodes[0].goals[0].id } : null;
          const initial = selNode?.goals?.[0] ? { nodeId: selNode.id, goalId: selNode.goals[0].id } : first;
          setAddTaskTarget(initial);
          setAddTaskTitle('');
          setAddTaskCoordDropdownOpen(false);
          setAddTaskOpen(true);
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.addTaskBtnText}>+ ADD TASK</Text>
      </TouchableOpacity>

      {nodeGroups.length === 0 ? (
        <View style={styles.taskEmptyState}>
          <Text style={styles.taskEmptyStateText}>NO ACTIVE COORDINATE</Text>
        </View>
      ) : (
        nodeGroups.map(({ node, coords }) => {
          const collapsed = collapsedNodes.has(node.id);
          const pendingCount = coords.reduce((acc, c) => acc + c.tasks.filter(t => !t.completed).length, 0);
          return (
          <View key={node.id} style={styles.nodeSection}>
            {/* Node header row */}
            <TouchableOpacity onPress={() => toggleCollapse(node.id)} activeOpacity={0.8}>
              <View style={styles.nodeHeader}>
                <View style={[styles.nodeIcon, { backgroundColor: node.color }, collapsed && { opacity: 0.5 }]}>
                  <Text style={styles.nodeIconLetter}>{node.name[0].toUpperCase()}</Text>
                </View>
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
                    {[...coord.tasks].sort((a, b) => sortOrder(a) - sortOrder(b)).map(t => {
                      const pri = !!t.isPriority;
                      return (
                        <TouchableOpacity
                          key={t.id}
                          style={[styles.taskCardOuter, pri && styles.taskCardPriority]}
                          onPress={() => onOpenEditTask(node.id, coord.goalId, t.id)}
                          activeOpacity={0.85}
                        >
                          <View style={[styles.taskCard, { borderColor: node.color + '33' }]}>
                            <View style={styles.taskCardBody}>
                              <View style={styles.taskRow}>
                                <TouchableOpacity
                                  style={styles.taskFocusBtn}
                                  onPress={() => togglePriority(node.id, coord.goalId, t.id)}
                                  activeOpacity={0.8}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Svg width={18} height={18} viewBox="0 0 24 24">
                                    {pri ? (
                                      <Path fill={THEME.accent} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                    ) : (
                                      <Path fill="none" stroke={THEME.textDim} strokeWidth="1.5" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                    )}
                                  </Svg>
                                </TouchableOpacity>
                                <View style={styles.taskTitleBlock}>
                                  <Text style={[styles.taskTitle, t.completed && styles.taskTitleStrike, t.completed && { opacity: 0.4 }]}>{t.title}</Text>
                                </View>
                                <View style={styles.taskRightBlock}>
                                  {pri && <Text style={styles.taskPriorityLabel}>PRIORITY</Text>}
                                  <TouchableOpacity
                                    onPress={() => toggleTask(node.id, coord.goalId, t.id)}
                                    activeOpacity={0.8}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  >
                                    <Svg width={22} height={22} viewBox="0 0 24 24">
                                      {t.completed ? (
                                        <>
                                          <Circle cx="12" cy="12" r="10" fill={node.color} />
                                          <Path d="M7 12l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                        </>
                                      ) : (
                                        <Circle cx="12" cy="12" r="10" fill="none" stroke={THEME.textDim} strokeWidth="1.5" />
                                      )}
                                    </Svg>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                    {/* Inline add task */}
                    <TouchableOpacity
                      style={styles.inlineAddBtn}
                      onPress={() => {
                        setAddTaskTarget({ nodeId: node.id, goalId: coord.goalId });
                        setAddTaskTitle('');
                        setAddTaskCoordDropdownOpen(false);
                        setAddTaskOpen(true);
                      }}
                      activeOpacity={0.6}
                    >
                      <Text style={[styles.inlineAddText, { color: node.color }]}>+ ADD TASK</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
            )}
          </View>
        );})
      )}
      {/* ── Add Task overlay ───────────────────────────────────────────────── */}
      <Modal
        visible={addTaskOpen}
        transparent
        animationType="slide"
        onRequestClose={() => { setAddTaskOpen(false); setAddTaskTitle(''); setAddTaskTarget(null); setAddTaskCoordDropdownOpen(false); }}
      >
        <KeyboardAvoidingView
          style={styles.addTaskOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => { setAddTaskOpen(false); setAddTaskTitle(''); setAddTaskTarget(null); setAddTaskCoordDropdownOpen(false); }}
            activeOpacity={1}
          />
          <View style={styles.addTaskSheet}>

            {/* Node selector */}
            <Text style={styles.addTaskFormLabel}>NODE</Text>
            <View style={styles.addTaskNodeRow}>
              {nodes.map((n, i) => {
                const sel = addTaskTarget?.nodeId === n.id;
                return (
                  <TouchableOpacity
                    key={n.id}
                    style={[styles.addTaskNodeBtn, sel && { borderColor: n.color }, i === nodes.length - 1 && { marginRight: 0 }]}
                    onPress={() => { setAddTaskTarget({ nodeId: n.id, goalId: n.goals[0]?.id || '' }); setAddTaskCoordDropdownOpen(false); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.addTaskNodeBtnText, sel && { color: n.color }]}>{n.name.toUpperCase()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Coordinate selector */}
            <Text style={styles.addTaskFormLabel}>COORDINATE</Text>
            <View style={styles.addTaskDropdownWrap}>
              <TouchableOpacity
                style={styles.addTaskDropdownTrigger}
                onPress={() => addTaskTarget?.nodeId && setAddTaskCoordDropdownOpen(v => !v)}
                activeOpacity={0.8}
              >
                <Text style={styles.addTaskDropdownTriggerText} numberOfLines={1}>
                  {addTaskTarget?.nodeId
                    ? (nodes.find(n => n.id === addTaskTarget.nodeId)?.goals.find(g => g.id === addTaskTarget.goalId)?.name || 'Select coordinate')
                    : 'Select a node first'}
                </Text>
                <Svg width={14} height={14} viewBox="0 0 24 24" style={styles.addTaskDropdownChevron}>
                  <Path fill={THEME.textDim} d="M7 10l5 5 5-5H7z" />
                </Svg>
              </TouchableOpacity>
              {addTaskCoordDropdownOpen && addTaskTarget?.nodeId && (
                <View style={styles.addTaskDropdownList}>
                  {(nodes.find(n => n.id === addTaskTarget.nodeId)?.goals || []).map(g => (
                    <TouchableOpacity
                      key={g.id}
                      style={[styles.addTaskDropdownItem, addTaskTarget?.goalId === g.id && styles.addTaskDropdownItemActive]}
                      onPress={() => { setAddTaskTarget(addTaskTarget ? { ...addTaskTarget, goalId: g.id } : null); setAddTaskCoordDropdownOpen(false); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.addTaskCoordChipText, addTaskTarget?.goalId === g.id && { color: nodes.find(n => n.id === addTaskTarget.nodeId)?.color }]}>{g.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Title input */}
            <Text style={styles.addTaskFormLabel}>TITLE</Text>
            <TextInput
              style={styles.addTaskInput}
              value={addTaskTitle}
              onChangeText={setAddTaskTitle}
              placeholder="Task title…"
              placeholderTextColor={THEME.textDim}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                if (addTaskTarget && addTaskTitle.trim()) {
                  addTask(addTaskTarget.nodeId, addTaskTarget.goalId, addTaskTitle.trim());
                  setAddTaskOpen(false);
                  setAddTaskTitle('');
                  setAddTaskTarget(null);
                }
              }}
            />

            {/* Actions */}
            <View style={styles.addTaskActions}>
              <TouchableOpacity
                style={styles.addTaskCancel}
                onPress={() => { setAddTaskOpen(false); setAddTaskTitle(''); setAddTaskTarget(null); setAddTaskCoordDropdownOpen(false); }}
                activeOpacity={0.7}
              >
                <Text style={styles.addTaskCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addTaskSubmit}
                onPress={() => {
                  if (addTaskTarget && addTaskTitle.trim()) {
                    addTask(addTaskTarget.nodeId, addTaskTarget.goalId, addTaskTitle.trim());
                    setAddTaskOpen(false);
                    setAddTaskTitle('');
                    setAddTaskTarget(null);
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.addTaskSubmitText}>ADD TASK</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  addTaskBtn: { marginBottom: 16, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: THEME.accent },
  addTaskBtnText: { color: THEME.accent, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  addTaskOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.75)' },
  addTaskSheet: { backgroundColor: THEME.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 48 },
  addTaskFormLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' },
  addTaskNodeRow: { flexDirection: 'row', marginBottom: 16 },
  addTaskNodeBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, alignItems: 'center' },
  addTaskNodeBtnText: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  addTaskDropdownWrap: { marginBottom: 16 },
  addTaskDropdownTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 4 },
  addTaskDropdownTriggerText: { color: THEME.border, fontSize: 14, flex: 1 },
  addTaskDropdownChevron: { marginLeft: 8 },
  addTaskDropdownList: { marginTop: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, overflow: 'hidden' },
  addTaskDropdownItem: { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  addTaskDropdownItemActive: { backgroundColor: 'rgba(255,255,255,0.06)' },
  addTaskCoordChipText: { color: THEME.textDim, fontSize: 14, fontWeight: '600' },
  addTaskInput: { color: 'white', fontSize: 14, paddingVertical: 10, paddingHorizontal: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', marginBottom: 16 },
  addTaskActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  addTaskCancel: { paddingVertical: 8, paddingHorizontal: 16, marginRight: 12 },
  addTaskCancelText: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  addTaskSubmit: { paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: THEME.accent, borderRadius: 12 },
  addTaskSubmitText: { color: THEME.accent, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  nodeSection: { marginBottom: 24 },
  nodeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  nodeHeaderRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 },
  collapsedBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  collapsedBadgeText: { fontSize: 11, fontWeight: '700' },
  nodeIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  nodeIconLetter: { color: 'white', fontSize: 14, fontWeight: '700' },
  nodeTitle: { fontSize: 20, fontWeight: '200', letterSpacing: 6 },
  nodeIndentRow: { flexDirection: 'row', gap: 14 },
  nodeRail: { width: 2, borderRadius: 1, opacity: 0.35 },
  nodeIndentContent: { flex: 1 },
  coordSection: { marginBottom: 14 },
  coordLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 3, marginBottom: 8, opacity: 0.6 },
  taskCardOuter: { marginBottom: 6, borderRadius: 10, overflow: 'hidden' },
  taskCardPriority: { shadowColor: '#38BDF8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 10 },
  taskCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, backgroundColor: THEME.card, borderRadius: 10, borderWidth: 1 },
  taskCardBody: { flex: 1, flexDirection: 'column' },
  taskRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  taskFocusBtn: { padding: 4, marginRight: 10 },
  taskTitleBlock: { flex: 1 },
  taskRightBlock: { flexDirection: 'row', alignItems: 'center' },
  taskPriorityLabel: { fontSize: 14, fontWeight: '700', color: THEME.accent, letterSpacing: 1, marginRight: 8 },
  taskTitle: { color: 'white', fontSize: 14 },
  taskTitleStrike: { textDecorationLine: 'line-through' },
  taskGoal: { color: THEME.textDim, fontSize: 14, fontWeight: '800', marginTop: 4 },
  taskEmptyState: { borderWidth: 1, borderColor: 'rgba(226,232,240,0.5)', borderStyle: 'dashed', borderRadius: 12, padding: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  taskEmptyStateText: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  inlineAddBtn: { paddingVertical: 8, paddingHorizontal: 4, alignSelf: 'flex-start' },
  inlineAddText: { fontSize: 10, fontWeight: '700', letterSpacing: 2, opacity: 0.45 },
});
