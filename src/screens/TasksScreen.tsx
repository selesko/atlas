import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Animated, Modal, PanResponder, Dimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { useAppStore } from '../stores/useAppStore';
import { THEME } from '../constants/theme';
import { TaskFilter } from '../types';
import { OrbitalValueBadge } from '../components/OrbitalValueBadge';

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
  onOpenCoordEdit,
}) => {
  const { nodes, toggleTask, togglePriority, updateValue } = useAppStore();
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('ALL');
  const [addTaskTitle, setAddTaskTitle] = useState('');
  const [addTaskCoordDropdownOpen, setAddTaskCoordDropdownOpen] = useState(false);
  const { addTask } = useAppStore();

  // — evidence nudge state —
  const [nudge, setNudge] = useState<{ nodeId: string; goalId: string; goalName: string; color: string } | null>(null);
  const nudgeAnim = useRef(new Animated.Value(0)).current;
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // — score reflection modal state —
  type ScoreReflection = {
    nodeId: string; goalId: string; goalName: string;
    taskTitle: string; nodeColor: string; currentValue: number;
  };
  const [scoreReflection, setScoreReflection] = useState<ScoreReflection | null>(null);
  const [reflectionValue, setReflectionValue] = useState(5);
  const reflectionTrackWidth = useRef(0);
  const reflectionPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (evt) => {
        const w = reflectionTrackWidth.current || Dimensions.get('window').width - 80;
        setReflectionValue(Math.max(1, Math.min(10, Math.round((Math.max(0, Math.min(evt.nativeEvent.locationX, w)) / w) * 9) + 1)));
      },
      onPanResponderMove: (evt) => {
        const w = reflectionTrackWidth.current || Dimensions.get('window').width - 80;
        setReflectionValue(Math.max(1, Math.min(10, Math.round((Math.max(0, Math.min(evt.nativeEvent.locationX, w)) / w) * 9) + 1)));
      },
    })
  ).current;

  const showNudge = (nodeId: string, goalId: string, goalName: string, color: string) => {
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    setNudge({ nodeId, goalId, goalName, color });
    nudgeAnim.setValue(0);
    Animated.spring(nudgeAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    nudgeTimer.current = setTimeout(() => dismissNudge(), 4000);
  };

  const dismissNudge = () => {
    Animated.timing(nudgeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setNudge(null));
  };

  useEffect(() => () => { if (nudgeTimer.current) clearTimeout(nudgeTimer.current); }, []);

  const handleToggleTask = (nodeId: string, goalId: string, taskId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    const goal = node?.goals.find(g => g.id === goalId);
    const task = goal?.tasks.find(t => t.id === taskId);
    const wasIncomplete = task && !task.completed;
    toggleTask(nodeId, goalId, taskId);
    if (wasIncomplete && node && goal && task) {
      // Open score reflection modal
      setReflectionValue(goal.value);
      setScoreReflection({
        nodeId, goalId,
        goalName: goal.name,
        taskTitle: task.title,
        nodeColor: node.color,
        currentValue: goal.value,
      });
    }
  };

  const isFocusFilter = taskFilter === 'FOCUS';
  const isAllFilter = taskFilter === 'ALL';
  const nodeIdFilter = isFocusFilter || isAllFilter ? null : taskFilter.toLowerCase();
  const nodesToConsider = nodeIdFilter ? nodes.filter(n => n.id === nodeIdFilter) : nodes;

  const groups: { coordinateName: string; tasks: typeof nodes[0]['goals'][0]['tasks']; nodeId: string; goalId: string; color: string }[] = [];
  nodesToConsider.forEach(n => {
    n.goals.forEach(g => {
      const taskList = isFocusFilter ? g.tasks.filter(t => t.isPriority) : g.tasks;
      if (taskList.length > 0) groups.push({ coordinateName: g.name, tasks: taskList, nodeId: n.id, goalId: g.id, color: n.color });
    });
  });

  const sortOrder = (t: { completed: boolean; isPriority: boolean }) =>
    t.completed ? 2 : (t.isPriority ? 0 : 1);

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.taskFilterBar} contentContainerStyle={styles.taskFilterBarContent}>
        {(['ALL', 'MIND', 'BODY', 'HOME', 'FOCUS'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.taskFilterOption, taskFilter === f && styles.taskFilterOptionActive]}
            onPress={() => setTaskFilter(f)}
            activeOpacity={0.8}
          >
            <Text style={[styles.taskFilterText, taskFilter === f && styles.taskFilterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {!addTaskOpen ? (
        <TouchableOpacity
          style={styles.addTaskBtn}
          onPress={() => {
            const selNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;
            const useSelected = selNode?.goals?.[0];
            const first = nodes[0]?.goals[0] ? { nodeId: nodes[0].id, goalId: nodes[0].goals[0].id } : null;
            const initial = useSelected ? { nodeId: selNode!.id, goalId: selNode!.goals[0].id } : first;
            setAddTaskTarget(initial);
            setAddTaskTitle('');
            setAddTaskCoordDropdownOpen(false);
            setAddTaskOpen(true);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.addTaskBtnText}>+ ADD TASK</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.addTaskForm}>
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
          <Text style={styles.addTaskFormLabel}>TITLE</Text>
          <TextInput
            style={styles.addTaskInput}
            value={addTaskTitle}
            onChangeText={setAddTaskTitle}
            placeholder="Task title…"
            placeholderTextColor={THEME.textDim}
          />
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
      )}

      {groups.length === 0 ? (
        <View style={styles.taskEmptyState}>
          <Text style={styles.taskEmptyStateText}>NO ACTIVE COORDINATE</Text>
        </View>
      ) : (
        groups.map((grp, i) => (
          <View key={`${grp.nodeId}-${grp.goalId}`}>
            {i > 0 && !isAllFilter && (
              <View style={styles.taskCoordSeparator}>
                <View style={[styles.taskCoordSeparatorLine, { backgroundColor: grp.color, height: 0.5 }]} />
                <Text style={[styles.taskCoordSeparatorLabel, { color: grp.color }]}>--- COORDINATE: {grp.coordinateName.toUpperCase()} ---</Text>
                <View style={[styles.taskCoordSeparatorLine, { backgroundColor: grp.color, height: 0.5 }]} />
              </View>
            )}
            {[...grp.tasks].sort((a, b) => sortOrder(a) - sortOrder(b)).map(t => {
              const pri = !!t.isPriority;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.taskCardOuter, pri && styles.taskCardPriority]}
                  onPress={() => onOpenEditTask(grp.nodeId, grp.goalId, t.id)}
                  activeOpacity={0.85}
                >
                  <BlurView intensity={40} tint="dark" style={styles.taskCard}>
                    <View style={[styles.taskIndicator, { backgroundColor: grp.color }, t.completed && { shadowColor: grp.color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8 }]} />
                    <View style={styles.taskCardBody}>
                      <View style={styles.taskRow}>
                        <TouchableOpacity
                          style={styles.taskFocusBtn}
                          onPress={() => togglePriority(grp.nodeId, grp.goalId, t.id)}
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
                          <Text style={[styles.taskTitle, t.completed && styles.taskTitleStrike, t.completed && { opacity: 0.5 }]}>{t.title}</Text>
                          <Text style={styles.taskGoal}>{grp.coordinateName.toUpperCase()} EVIDENCE</Text>
                        </View>
                        <View style={styles.taskRightBlock}>
                          {pri && <Text style={styles.taskPriorityLabel}>PRIORITY</Text>}
                          <TouchableOpacity
                            onPress={() => handleToggleTask(grp.nodeId, grp.goalId, t.id)}
                            activeOpacity={0.8}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Svg width={22} height={22} viewBox="0 0 24 24">
                              {t.completed ? (
                                <>
                                  <Circle cx="12" cy="12" r="10" fill={grp.color} />
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
                  </BlurView>
                </TouchableOpacity>
              );
            })}
          </View>
        ))
      )}
      {/* Score reflection modal */}
      <Modal visible={!!scoreReflection} animationType="slide" transparent>
        {scoreReflection && (
          <View style={styles.reflectionOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setScoreReflection(null)} activeOpacity={1} />
            <View style={styles.reflectionCard}>
              <Text style={styles.reflectionTaskLabel} numberOfLines={2}>{scoreReflection.taskTitle}</Text>
              <Text style={styles.reflectionQuestion}>
                Did completing this move{'\n'}
                <Text style={[styles.reflectionCoordName, { color: scoreReflection.nodeColor }]}>
                  {scoreReflection.goalName.toUpperCase()}
                </Text>
                {'\n'}forward?
              </Text>

              {/* Slider + orbital badge */}
              <View style={styles.reflectionSliderRow}>
                <View
                  style={styles.reflectionSliderTrack}
                  onLayout={e => { reflectionTrackWidth.current = e.nativeEvent.layout.width; }}
                  {...reflectionPan.panHandlers}
                >
                  <View style={[styles.reflectionSliderLine, { backgroundColor: scoreReflection.nodeColor, opacity: 0.25 }]} />
                  <View style={[styles.reflectionSliderFill, { width: `${reflectionValue * 10}%`, backgroundColor: scoreReflection.nodeColor }]} />
                  <View style={[styles.reflectionSliderHandle, { left: `${reflectionValue * 10}%`, borderColor: scoreReflection.nodeColor }]}>
                    <View style={[styles.reflectionSliderHandleInner, { backgroundColor: scoreReflection.nodeColor }]} />
                  </View>
                </View>
                <OrbitalValueBadge value={reflectionValue} color={scoreReflection.nodeColor} size={52} />
              </View>

              {/* Actions */}
              <TouchableOpacity
                style={[styles.reflectionUpdateBtn, { borderColor: scoreReflection.nodeColor }]}
                onPress={() => {
                  updateValue(scoreReflection.nodeId, scoreReflection.goalId, reflectionValue);
                  setScoreReflection(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.reflectionUpdateText, { color: scoreReflection.nodeColor }]}>UPDATE SCORE</Text>
              </TouchableOpacity>

              <View style={styles.reflectionSecondaryRow}>
                <TouchableOpacity
                  onPress={() => { setScoreReflection(null); onOpenCoordEdit(scoreReflection.nodeId, scoreReflection.goalId); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.reflectionEvidenceLink}>LOG EVIDENCE →</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setScoreReflection(null)} activeOpacity={0.7}>
                  <Text style={styles.reflectionSkipText}>NOT THIS TIME</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </Modal>

      {/* Evidence nudge bar */}
      {nudge && (
        <Animated.View style={[
          styles.nudgeBar,
          { borderLeftColor: nudge.color },
          {
            opacity: nudgeAnim,
            transform: [{ translateY: nudgeAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          },
        ]}>
          <View style={styles.nudgeContent}>
            <View style={[styles.nudgeDot, { backgroundColor: nudge.color }]} />
            <Text style={styles.nudgeText} numberOfLines={1}>
              Log evidence for <Text style={[styles.nudgeGoal, { color: nudge.color }]}>{nudge.goalName}</Text>?
            </Text>
          </View>
          <View style={styles.nudgeActions}>
            <TouchableOpacity
              onPress={() => { dismissNudge(); onOpenCoordEdit(nudge.nodeId, nudge.goalId); }}
              style={styles.nudgeActionBtn}
              activeOpacity={0.7}
            >
              <Text style={[styles.nudgeActionText, { color: nudge.color }]}>LOG  →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={dismissNudge} style={styles.nudgeDismiss} activeOpacity={0.6}>
              <Text style={styles.nudgeDismissText}>✕</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  taskFilterBar: { marginBottom: 16, marginHorizontal: -20 },
  taskFilterBarContent: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  taskFilterOption: { paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: 'transparent', marginRight: 8 },
  taskFilterOptionActive: { borderColor: '#E2E8F0' },
  taskFilterText: { color: '#64748B', fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  taskFilterTextActive: { color: 'white' },
  addTaskBtn: { marginBottom: 16, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  addTaskBtnText: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  addTaskForm: { marginBottom: 16, padding: 16, backgroundColor: THEME.card, borderRadius: 12, shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 },
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
  taskCoordSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
  taskCoordSeparatorLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  taskCoordSeparatorLabel: { fontSize: 14, color: '#E2E8F0', letterSpacing: 3, fontWeight: '600', marginHorizontal: 10 },
  taskCardOuter: { marginBottom: 12, borderRadius: 12, overflow: 'hidden', shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 },
  taskCardPriority: { shadowColor: '#38BDF8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 10 },
  taskCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, backgroundColor: 'rgba(30, 41, 59, 0.7)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(226, 232, 240, 0.15)' },
  taskIndicator: { width: 4, height: 24, marginRight: 20 },
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
  // Score reflection modal
  reflectionOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8, 8, 15, 0.85)' },
  reflectionCard: { backgroundColor: THEME.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 44 },
  reflectionTaskLabel: { color: THEME.textDim, fontSize: 13, fontWeight: '700', letterSpacing: 1.5, marginBottom: 16, textTransform: 'uppercase' },
  reflectionQuestion: { color: 'white', fontSize: 22, fontWeight: '200', letterSpacing: 2, lineHeight: 32, marginBottom: 24, textAlign: 'center' },
  reflectionCoordName: { fontSize: 22, fontWeight: '600', letterSpacing: 3 },
  reflectionSliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  reflectionSliderTrack: { flex: 1, height: 32, justifyContent: 'center' },
  reflectionSliderLine: { height: 2, width: '100%' },
  reflectionSliderFill: { position: 'absolute', left: 0, top: 15, height: 2, opacity: 0.7 },
  reflectionSliderHandle: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: 'transparent', borderWidth: 2, top: 8, marginLeft: -8, justifyContent: 'center', alignItems: 'center' },
  reflectionSliderHandleInner: { width: 8, height: 8, borderRadius: 4 },
  reflectionUpdateBtn: { paddingVertical: 14, borderWidth: 1, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  reflectionUpdateText: { fontSize: 14, fontWeight: '800', letterSpacing: 3 },
  reflectionSecondaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reflectionEvidenceLink: { color: THEME.accent, fontSize: 13, fontWeight: '700', letterSpacing: 1.5 },
  reflectionSkipText: { color: THEME.textDim, fontSize: 13, fontWeight: '700', letterSpacing: 1.5 },
  nudgeBar: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0c1420', borderRadius: 10, borderLeftWidth: 3, paddingVertical: 12, paddingHorizontal: 14 },
  nudgeContent: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  nudgeDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  nudgeText: { fontSize: 13, color: '#8888aa', flex: 1 },
  nudgeGoal: { fontWeight: '700' },
  nudgeActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nudgeActionBtn: { paddingVertical: 4, paddingHorizontal: 10 },
  nudgeActionText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  nudgeDismiss: { paddingVertical: 4, paddingHorizontal: 8 },
  nudgeDismissText: { fontSize: 12, color: '#444466' },
});
