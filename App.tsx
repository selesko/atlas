import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, StatusBar, Dimensions, PanResponder } from 'react-native';
import Svg, { Circle, Polygon, G, Rect, Path, Defs, RadialGradient, Stop, Line, Text as SvgText } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

const THEME = {
  bg: '#020617', card: '#0F172A', border: '#E2E8F0', accent: '#38BDF8', textDim: '#64748B',
  mind: '#38BDF8', body: '#FB7185', home: '#A78BFA'
};

const NODE_COLORS = [THEME.mind, THEME.body, THEME.home, '#34D399', '#FBBF24', '#F472B6', '#60A5FA', '#10B981'];

const INFO_TEXTS: Record<string, string> = {
  Atlas: 'The Atlas is your primary visualization of the balance between Mind, Body, and Home. This radar chart represents the current state of your system based on the coordinates you have manually set. A symmetrical shape indicates balance, while a pull toward one node highlights where your current focus should be concentrated.',
  Nodes: 'Nodes & Coordinates\n\nEvery primary Node is supported by specific Coordinates. These are the individual pillars that define the integrity of the node.\n\nCoordinates allow for granular adjustment (e.g., "Meditation" is a coordinate of "Mind").\n\nMoving these sliders manually updates the Node\'s overall average.\n\nUse this screen to adjust your status based on the Evidence you\'ve gathered in your daily logs.',
  Tasks: 'Tasks (Action Log)\n\nThe Task page is the record of your actions. Tasks are grouped by their parent Coordinate to ensure every move is intentional.\n\nFocus Mode: High-priority items that represent your current path.\n\nEvidence Logging: The core of the system. You aren\'t just finishing tasks; you are documenting evidence to justify how you calibrate your Atlas scores.\n\nSorting: Priority items stay at the top; completed entries move to the bottom for reference.',
  Profile: 'The Profile page defines your current Archetype.\n\nSelecting an Archetype (Architect, Nomad, or Guardian) updates the interface overlay and the specific "Directives" shown throughout the app.\n\nThis allows you to match the system\'s feedback to your current environment or phase of life.'
};

const toCreatedAt = (daysAgo: number) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().slice(0, 10); };

const INITIAL_DATA = [
  { id: 'mind', name: 'Mind', color: THEME.mind, description: 'CLARITY & FOCUS', goals: [{ id: 'm1', name: 'Meditation', value: 7, evidence: '', tasks: [{ id: 't1', title: '10m Focus Session', completed: true, timestamp: '09:42', isPriority: false, createdAt: toCreatedAt(3) }] }, { id: 'm2', name: 'Deep Work', value: 5, evidence: '', tasks: [] }] },
  { id: 'body', name: 'Body', color: THEME.body, description: 'ENERGY & VITALITY', goals: [{ id: 'b1', name: 'Hydration', value: 9, evidence: '', tasks: [{ id: 't2', title: '3L Water', completed: false, timestamp: '14:15', isPriority: false, createdAt: toCreatedAt(1) }] }, { id: 'b2', name: 'Sleep Quality', value: 6, evidence: '', tasks: [] }] },
  { id: 'home', name: 'Home', color: THEME.home, description: 'ENVIRONMENT', goals: [{ id: 'h1', name: 'Organization', value: 8, evidence: '', tasks: [{ id: 't3', title: 'Clear Desk', completed: true, timestamp: '07:23', isPriority: false, createdAt: toCreatedAt(5) }] }, { id: 'h2', name: 'Order', value: 7, evidence: '', tasks: [] }] }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('Atlas');
  const [nodes, setNodes] = useState(INITIAL_DATA);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingCoordinate, setEditingCoordinate] = useState<{ nodeId: string; goalId: string } | null>(null);
  const [atlasHighlightId, setAtlasHighlightId] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<'ALL' | 'MIND' | 'BODY' | 'HOME' | 'FOCUS'>('ALL');
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addTaskTarget, setAddTaskTarget] = useState<{ nodeId: string; goalId: string } | null>(null);
  const [addTaskTitle, setAddTaskTitle] = useState('');
  const [addTaskCoordDropdownOpen, setAddTaskCoordDropdownOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<{ nodeId: string; goalId: string; taskId: string } | null>(null);
  const [editForm, setEditForm] = useState({ title: '', nodeId: '', goalId: '', isPriority: false, notes: '', dueDate: '', reminder: '' });
  const [infoOpen, setInfoOpen] = useState(false);
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [addNodeForm, setAddNodeForm] = useState({ name: '', description: '', color: NODE_COLORS[0] });
  const [stars, setStars] = useState<Array<{ cx: number; cy: number; r: number; op: number }>>([]);
  const [atlasGraphView, setAtlasGraphView] = useState<'radar' | 'trajectory' | 'constellation'>('radar');
  const [trajectoryDragX, setTrajectoryDragX] = useState<number | null>(null);
  const trajectoryChartWidthRef = useRef(0);
  const [constellationW, setConstellationW] = useState(width);
  const trajectoryPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const w = trajectoryChartWidthRef.current || 320;
      const lx = e.nativeEvent.locationX;
      const vx = Math.max(40, Math.min(280, (lx / w) * 320));
      setTrajectoryDragX(vx);
    },
    onPanResponderMove: (e) => {
      const w = trajectoryChartWidthRef.current || 320;
      const lx = e.nativeEvent.locationX;
      const vx = Math.max(40, Math.min(280, (lx / w) * 320));
      setTrajectoryDragX(vx);
    },
    onPanResponderRelease: () => setTrajectoryDragX(null),
  }), []);
  const trackWidths = useRef<Record<string, number>>({});

  const STARFIELD_HEIGHT = 240;
  useEffect(() => {
    setStars(Array.from({ length: 220 }, () => ({
      cx: Math.random() * width,
      cy: Math.random() * STARFIELD_HEIGHT,
      r: 0.25 + Math.random() * 0.65,
      op: 0.2 + Math.random() * 0.6
    })));
  }, [width]);

  const updateValue = (nodeId: string, goalId: string, val: number) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, goals: n.goals.map(g => g.id === goalId ? { ...g, value: val } : g) } : n));
  };

  const updateGoal = (nodeId: string, goalId: string, patch: { name?: string; evidence?: string }) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, goals: n.goals.map(g => g.id === goalId ? { ...g, ...patch } : g) } : n));
  };

  const toggleTask = (nodeId: string, goalId: string, taskId: string) => {
    setNodes(prev => prev.map(n => n.id !== nodeId ? n : { ...n, goals: n.goals.map(g => g.id !== goalId ? g : { ...g, tasks: g.tasks.map(t => t.id !== taskId ? t : { ...t, completed: !t.completed }) }) }));
  };

  const togglePriority = (nodeId: string, goalId: string, taskId: string) => {
    setNodes(prev => prev.map(n => n.id !== nodeId ? n : {
      ...n,
      goals: n.goals.map(g => g.id !== goalId ? g : {
        ...g,
        tasks: g.tasks.map(t => t.id !== taskId ? t : { ...t, isPriority: !(t as { isPriority?: boolean }).isPriority }),
      }),
    }));
  };

  const addTask = (nodeId: string, goalId: string, title: string) => {
    const t = title.trim();
    if (!t) return;
    setNodes(prev => prev.map(n => n.id !== nodeId ? n : { ...n, goals: n.goals.map(g => g.id !== goalId ? g : { ...g, tasks: [...g.tasks, { id: 't' + Date.now(), title: t, completed: false, isPriority: false, timestamp: '', notes: '', dueDate: '', reminder: '', createdAt: new Date().toISOString().slice(0, 10) }] }) }) );
  };

  const saveTaskEdit = (from: { nodeId: string; goalId: string; taskId: string }, form: { title: string; nodeId: string; goalId: string; isPriority: boolean; notes: string; dueDate: string; reminder: string }) => {
    const node = nodes.find(n => n.id === from.nodeId);
    const goal = node?.goals.find(g => g.id === from.goalId);
    const task = goal?.tasks.find((t: any) => t.id === from.taskId);
    if (!task) return;
    const updated = { ...task, title: form.title, isPriority: form.isPriority, notes: form.notes || '', dueDate: form.dueDate || '', reminder: form.reminder || '' } as any;
    if (from.nodeId === form.nodeId && from.goalId === form.goalId) {
      setNodes(prev => prev.map(n => n.id !== from.nodeId ? n : {
        ...n, goals: n.goals.map(g => g.id !== from.goalId ? g : { ...g, tasks: g.tasks.map((t: any) => t.id !== from.taskId ? t : updated) })
      }));
    } else {
      setNodes(prev => {
        const removed = prev.map(n => n.id !== from.nodeId ? n : { ...n, goals: n.goals.map(g => g.id !== from.goalId ? g : { ...g, tasks: g.tasks.filter((t: any) => t.id !== from.taskId) }) });
        return removed.map(n => n.id !== form.nodeId ? n : { ...n, goals: n.goals.map(g => g.id !== form.goalId ? g : { ...g, tasks: [...g.tasks, updated] }) });
      });
    }
  };

  const addCoordinate = (nodeId: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id !== nodeId) return n;
      const prefix = n.id[0];
      const maxNum = n.goals.reduce((acc, g) => {
        const m = g.id.match(/\d+$/);
        return m ? Math.max(acc, parseInt(m[0], 10)) : acc;
      }, 0);
      const newId = `${prefix}${maxNum + 1}`;
      return { ...n, goals: [...n.goals, { id: newId, name: 'New Coordinate', value: 5, evidence: '', tasks: [] }] };
    }));
  };

  const addNode = () => {
    const name = addNodeForm.name.trim();
    if (!name) return;
    const nodeId = 'n' + Date.now();
    setNodes(prev => [...prev, {
      id: nodeId,
      name,
      color: addNodeForm.color,
      description: addNodeForm.description.trim() || '',
      goals: [
        { id: nodeId + '-1', name: 'Coordinate 1', value: 5, evidence: '', tasks: [] },
        { id: nodeId + '-2', name: 'Coordinate 2', value: 5, evidence: '', tasks: [] },
      ],
    }]);
    setAddNodeOpen(false);
    setAddNodeForm({ name: '', description: '', color: NODE_COLORS[0] });
  };

  const getNodeAvg = (node: any) => (node.goals.reduce((acc: number, g: any) => acc + g.value, 0) / node.goals.length).toFixed(1);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>{activeTab.toUpperCase()}</Text>
            <Text style={styles.headerSubtitle}>SYSTEM ALIGNMENT // V1.0</Text>
          </View>
          <TouchableOpacity style={styles.headerInfoBtn} onPress={() => setInfoOpen(true)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Circle cx="12" cy="12" r="10" fill="none" stroke={THEME.textDim} strokeWidth="1.5" />
              <Circle cx="12" cy="8" r="1.5" fill={THEME.textDim} />
              <Path d="M12 11v5" stroke={THEME.textDim} strokeWidth="1.5" strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {activeTab === 'Atlas' && (() => {
          const systemBalance = (nodes.reduce((acc, n) => acc + parseFloat(getNodeAvg(n)), 0) / (nodes.length || 1)).toFixed(1);
          const getTierForNode = (node: any) => {
            if (node.id === 'mind') return 0;
            if (node.id === 'body') return 1;
            if (node.id === 'home') return 2;
            if (node.color === THEME.mind) return 0;
            if (node.color === THEME.body) return 1;
            if (node.color === THEME.home) return 2;
            return 1;
          };
          const trajectoryX = (i: number) => 40 + (i / 6) * 240;
          const TRAJ_CHART_H = 156;
          const TRAJ_PLOT_H = 196;
          const trajectoryY = (v: number) => 24 + (1 - v / 10) * TRAJ_CHART_H;
          const trajectoryDataPerNode = nodes.map(n => {
            const cur = parseFloat(getNodeAvg(n));
            const base = cur - 0.5;
            return [base, base + 0.2, base + 0.1, base + 0.3, base + 0.2, base + 0.3, cur];
          });
          const averageData = [0, 1, 2, 3, 4, 5, 6].map(i => trajectoryDataPerNode.reduce((s, arr) => s + arr[i], 0) / (nodes.length || 1));
          const interpolatedAvg = (x: number) => {
            if (x <= 40) return averageData[0];
            if (x >= 280) return averageData[6];
            const i = (x - 40) / 40;
            const i0 = Math.floor(i);
            const i1 = Math.min(i0 + 1, 6);
            const f = i - i0;
            return averageData[i0] * (1 - f) + averageData[i1] * f;
          };
          const now = new Date();
          const dayLabels = [...Array(7)].map((_, i) => {
            const d = new Date(now);
            d.setDate(d.getDate() - (6 - i));
            return i === 6 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' }).replace('Thu', 'Thur');
          });
          const displayValue = (atlasGraphView === 'trajectory' && trajectoryDragX != null) ? interpolatedAvg(trajectoryDragX).toFixed(1) : systemBalance;
          const zoneYMin = [24, 96, 168] as const;   // MIND 10–30%, BODY 40–60%, HOME 70–90%
          const zoneH = 48;
          const tierColors = [THEME.mind, THEME.body, THEME.home] as const;
          const tierNames = ['MIND', 'BODY', 'HOME'] as const;
          const BODY_BASELINE_Y = zoneYMin[1] + zoneH;
          const scoreToY = (score: number, yMin: number) => yMin + 4 + ((10 - score) / 9) * (zoneH - 8);
          const getLast7SequenceNodes = (): Array<{ empty: true } | { empty: false; tier: number; score: number }> => {
            const list: Array<{ node: any; goal: any; task: any; createdAt: string }> = [];
            nodes.forEach(n => n.goals.forEach((g: any) =>
              g.tasks.filter((t: any) => t.completed).forEach((t: any) =>
                list.push({ node: n, goal: g, task: t, createdAt: (t as any).createdAt || '1970-01-01' })
              )
            ));
            list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
            const last7 = list.slice(-7);
            const filled: Array<{ empty: true } | { empty: false; tier: number; score: number }> = [];
            for (let i = 0; i < 7; i++) {
              const item = last7[i];
              if (!item) filled.push({ empty: true });
              else filled.push({ empty: false, tier: getTierForNode(item.node), score: Math.max(1, Math.min(10, item.goal.value)) });
            }
            return filled;
          };
          const sequence7 = getLast7SequenceNodes();
          return (
          <View style={styles.atlasCard}>
            <View style={styles.atlasCardContent}>
              <View style={[styles.atlasCardHeader, styles.atlasCardHeaderRow]}>
                <View style={styles.atlasScoreBlock}>
                  <Text style={[styles.bigScore, atlasGraphView === 'constellation' && { fontWeight: '100' }]}>{displayValue}</Text>
                  <Text style={styles.statLabel}>
                    {atlasGraphView === 'radar' ? 'RADAR' : atlasGraphView === 'trajectory' ? 'TRAJECTORY' : 'CONSTELLATION'}
                  </Text>
                </View>
                <View style={styles.atlasViewSwitcher}>
                  {(['radar', 'trajectory', 'constellation'] as const).map(v => {
                    const c = atlasGraphView === v ? THEME.accent : THEME.textDim;
                    return (
                      <TouchableOpacity key={v} onPress={() => { if (v !== 'trajectory') setTrajectoryDragX(null); setAtlasGraphView(v); }} style={[styles.atlasViewTab, atlasGraphView === v && styles.atlasViewTabActive]} activeOpacity={0.8}>
                        {v === 'radar' && (
                          <Svg width={22} height={22} viewBox="0 0 256 256">
                            <Path fill={c} d="M230.64 49.36a32 32 0 0 0-45.26 0a31.9 31.9 0 0 0-5.16 6.76L152 48.42a32 32 0 0 0-54.63-23.06a32.06 32.06 0 0 0-5.76 37.41L57.67 93.32a32.05 32.05 0 0 0-40.31 4.05a32 32 0 0 0 42.89 47.41l70 51.36a32 32 0 1 0 47.57-14.69l27.39-77.59q1.38.12 2.76.12a32 32 0 0 0 22.63-54.62Zm-67.87 126.79a32 32 0 0 0-23 7.08l-70-51.36a32.17 32.17 0 0 0-1.34-26.65l33.95-30.55a32 32 0 0 0 45.47-10.81l28.15 7.7a32 32 0 0 0 14.12 27Z" />
                          </Svg>
                        )}
                        {v === 'trajectory' && (
                          <Svg width={22} height={22} viewBox="0 0 1024 1024">
                            <Path fill={c} d="M944 224c-44.192 0-79.999 35.824-79.999 80c0 9.072 1.84 17.632 4.607 25.76L673.6 497.68C659.92 486.784 642.848 480 624 480c-21.743 0-41.407 8.736-55.808 22.816l-152.752-76.48C412.465 384.848 378.241 352 336 352c-44.175 0-80 35.824-80 80c0 12.096 2.88 23.44 7.68 33.712L107.936 645.296C99.2 642.032 89.872 640 80 640c-44.176 0-80 35.824-80 80s35.824 80 80 80s80-35.824 80-80c0-10.64-2.176-20.767-5.952-30.048l158.272-181.92C319.856 510.368 327.696 512 336 512c23.28 0 44.047-10.112 58.671-26l149.408 74.912C544.608 604.656 580.127 640 624 640c44.193 0 80-35.824 80-80c0-1.424-.336-2.752-.416-4.16L911.68 377.072C921.584 381.456 932.463 384 944 384c44.193 0 80-35.808 80-80c0-44.176-35.807-80-79.999-80z" />
                          </Svg>
                        )}
                        {v === 'constellation' && (
                          <Svg width={22} height={22} viewBox="0 0 32 32">
                            {[[10,20],[10,28],[10,14],[28,4],[22,6],[28,10],[20,12],[28,22],[26,28],[20,26],[22,20],[16,4],[4,24],[4,16]].map(([cx, cy], i) => (
                              <Circle key={i} cx={cx} cy={cy} r={2} fill={c} />
                            ))}
                          </Svg>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={styles.atlasStarfieldContainer}>
                {atlasGraphView === 'radar' && (
                  <>
                    <Svg style={styles.starfieldSvg} viewBox={`0 0 ${width} ${STARFIELD_HEIGHT}`} preserveAspectRatio="xMidYMid slice">
                      {stars.map((s, i) => (
                        <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={`rgba(255,255,255,${s.op})`} />
                      ))}
                    </Svg>
                    <View style={styles.radarWrapper}>
                      <Svg height={240} width={240} viewBox="0 0 200 200">
                        <Defs>
                          {nodes.map(n => (
                            <RadialGradient key={n.id} id={`glow-${n.id}`} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                              <Stop offset="0%" stopColor={n.color} stopOpacity="0.95" />
                              <Stop offset="35%" stopColor={n.color} stopOpacity="0.6" />
                              <Stop offset="65%" stopColor={n.color} stopOpacity="0.25" />
                              <Stop offset="100%" stopColor={n.color} stopOpacity="0" />
                            </RadialGradient>
                          ))}
                        </Defs>
                        <G transform="translate(100, 100)">
                          {[20, 40, 60, 80].map(r => <Circle key={r} r={r} stroke={THEME.border} strokeWidth="0.4" opacity="0.08" fill="none" />)}
                          {(() => {
                            const pts = nodes.map((n, i) => { const angle = (i * 2 * Math.PI) / (nodes.length || 1) - Math.PI / 2; const r = (parseFloat(getNodeAvg(n)) / 10) * 80; return { x: r * Math.cos(angle), y: r * Math.sin(angle), color: n.color, id: n.id }; });
                            return (
                              <>
                                <Polygon points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(56, 189, 248, 0.15)" stroke={THEME.accent} strokeWidth="0.9" />
                                {pts.map((p, i) => {
                                  const hi = atlasHighlightId === p.id;
                                  return (
                                    <G key={i} onPress={() => setAtlasHighlightId(prev => prev === p.id ? null : p.id)}>
                                      <Circle cx={p.x} cy={p.y} r={hi ? 12 : 9} fill={`url(#glow-${p.id})`} />
                                      <Circle cx={p.x} cy={p.y} r={hi ? 4 : 3.5} fill={p.color} />
                                    </G>
                                  );
                                })}
                              </>
                            );
                          })()}
                        </G>
                      </Svg>
                    </View>
                  </>
                )}
                {atlasGraphView === 'trajectory' && (
                  <>
                    <View style={{ height: TRAJ_PLOT_H }}>
                      <Svg style={[styles.starfieldSvg, { height: TRAJ_PLOT_H }]} viewBox={`0 0 ${width} ${STARFIELD_HEIGHT}`} preserveAspectRatio="xMidYMid slice">
                        {stars.map((s, i) => (
                          <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={`rgba(255,255,255,${s.op})`} />
                        ))}
                      </Svg>
                      <View
                        style={[StyleSheet.absoluteFill, { height: TRAJ_PLOT_H }]}
                        onLayout={(e) => { trajectoryChartWidthRef.current = e.nativeEvent.layout.width; }}
                        {...trajectoryPanResponder.panHandlers}
                      >
                        <Svg width="100%" height={TRAJ_PLOT_H} viewBox={`0 0 320 ${TRAJ_PLOT_H}`} preserveAspectRatio="xMidYMid meet" pointerEvents="none">
                          {trajectoryDataPerNode.map((arr, ni) => {
                            const path = arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${trajectoryX(i)} ${trajectoryY(v)}`).join(' ');
                            return <Path key={nodes[ni].id} d={path} stroke={nodes[ni].color} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
                          })}
                          {(() => {
                            const avgPath = averageData.map((v, i) => `${i === 0 ? 'M' : 'L'} ${trajectoryX(i)} ${trajectoryY(v)}`).join(' ');
                            return <Path d={avgPath} stroke="#FFFFFF" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
                          })()}
                          {trajectoryDragX != null && (
                            <>
                              <Line x1={trajectoryDragX} y1={24} x2={trajectoryDragX} y2={24 + TRAJ_CHART_H} stroke="rgba(255,255,255,0.6)" strokeWidth="1" />
                              <Circle cx={trajectoryDragX} cy={trajectoryY(interpolatedAvg(trajectoryDragX))} r={8} fill="#FFFFFF" fillOpacity="0.35" />
                              <Circle cx={trajectoryDragX} cy={trajectoryY(interpolatedAvg(trajectoryDragX))} r={4} fill="#FFFFFF" />
                            </>
                          )}
                        </Svg>
                      </View>
                    </View>
                    <View style={styles.trajectoryDaysLegend}>
                      {dayLabels.map((l, i) => (
                        <View key={i} style={styles.trajectoryDayItem}>
                          <View style={[styles.trajectoryDayDot, { backgroundColor: THEME.textDim }]} />
                          <Text style={styles.trajectoryDayLabel}>{l}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
                {atlasGraphView === 'constellation' && (() => {
                  const totalWidth = constellationW;
                  const xForSlot = (i: number) => (i / 6) * totalWidth;
                  const pts = sequence7.map((s, i) => {
                    const x = xForSlot(i);
                    const y = s.empty ? BODY_BASELINE_Y : scoreToY(s.score, zoneYMin[s.tier]);
                    return { x, y };
                  });
                  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                  return (
                  <>
                    <View style={{ width: '100%' }} onLayout={(e) => setConstellationW(e.nativeEvent.layout.width)}>
                      <Svg viewBox={`0 0 ${totalWidth} 240`} preserveAspectRatio="none" width="100%" height={240}>
                        {[0, 1, 2].map(t => (
                          <Rect key={`zone-${t}`} x={0} y={zoneYMin[t]} width={totalWidth} height={zoneH} fill={tierColors[t]} fillOpacity={0.06} />
                        ))}
                        {[0, 1, 2].map(t => (
                          <G key={`label-${t}`}>
                            <Rect x={6} y={zoneYMin[t] + 4} width={4} height={24} fill={tierColors[t]} />
                            <SvgText x={14} y={zoneYMin[t] + 20} fill={THEME.border} fontSize="10" fontWeight="700" letterSpacing={1}>{tierNames[t]}</SvgText>
                          </G>
                        ))}
                        <Path d={pathD} stroke="#E2E8F0" strokeWidth={0.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </View>
                    <Text style={styles.constellationTrajectoryLabel}>TRAJECTORY // LAST 7 SEQUENCE NODES</Text>
                  </>
                  );
                })()}
              </View>
              {atlasGraphView === 'radar' && (
                <View style={styles.atlasLegend}>
                  {nodes.map(n => (
                    <TouchableOpacity key={n.id} style={[styles.legendItem, atlasHighlightId === n.id && styles.legendItemHighlight]} onPress={() => setAtlasHighlightId(prev => prev === n.id ? null : n.id)} activeOpacity={0.8}>
                      <View style={[styles.legendDot, { backgroundColor: n.color }]} />
                      <Text style={[styles.legendLabel, atlasHighlightId === n.id && styles.legendLabelHighlight]}>{n.name.toUpperCase()}</Text>
                      <Text style={styles.legendValue}>{getNodeAvg(n)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
          );
        })()}

        {activeTab === 'Nodes' && (
          <View>
            {selectedNodeId ? (
              (() => {
                const selectedNode = nodes.find(n => n.id === selectedNodeId);
                if (!selectedNode) return null;
                return (
                  <View>
                    <TouchableOpacity style={styles.backRow} onPress={() => { setEditingCoordinate(null); setSelectedNodeId(null); }} activeOpacity={0.7}>
                      <Text style={styles.backText}>‹ BACK</Text>
                    </TouchableOpacity>
                    <View style={styles.nodeDrillDown}>
                      <View style={styles.nodeHeader}>
                        <View style={styles.nodeHeaderLeft}>
                          <View style={[styles.nodeIcon, { backgroundColor: selectedNode.color }]}>
                            <Text style={styles.nodeIconLetter}>{selectedNode.name[0].toUpperCase()}</Text>
                          </View>
                          <View>
                            <Text style={[styles.nodeTitle, { color: selectedNode.color }]}>{selectedNode.name.toUpperCase()}</Text>
                            <Text style={styles.nodeDirective}>{selectedNode.description}</Text>
                          </View>
                        </View>
                        <Text style={styles.nodeScore}>{getNodeAvg(selectedNode)}</Text>
                      </View>
                      <View style={styles.nodeExpanded}>
                        <View style={styles.divider} />
                        <Text style={styles.coordinatesLabel}>ACTIVE COORDINATES</Text>
                        {selectedNode.goals.map(goal => (
                          <TouchableOpacity key={goal.id} style={styles.goalBlock} onPress={() => setEditingCoordinate({ nodeId: selectedNode.id, goalId: goal.id })} activeOpacity={0.9}>
                            <Text style={styles.goalName}>{goal.name}</Text>
                            <View style={styles.goalValueRow}>
                              <View style={[styles.goalValueBadge, { borderColor: selectedNode.color }]}>
                                <Text style={[styles.goalValueText, { color: selectedNode.color }]}>{goal.value}</Text>
                              </View>
                              <Text style={styles.calibrationLabel}>{goal.value < 6 ? 'CALIBRATION REQUIRED' : 'SYSTEM ALIGNED'}</Text>
                            </View>
                            <Text style={styles.evidenceLabel}>INPUT EVIDENCE...</Text>
                            <Text style={styles.evidencePreview} numberOfLines={1}>{goal.evidence || '—'}</Text>
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.addCoordinateBtn} onPress={() => addCoordinate(selectedNode.id)} activeOpacity={0.7}>
                          <Text style={styles.addCoordinateText}>+ ADD COORDINATE</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })()
            ) : (
              <View>
                {nodes.map(node => (
                  <TouchableOpacity key={node.id} style={styles.nodeBlock} onPress={() => setSelectedNodeId(node.id)} activeOpacity={0.9}>
                    <View style={styles.nodeHeader}>
                      <View style={styles.nodeHeaderLeft}>
                        <View style={[styles.nodeIcon, { backgroundColor: node.color }]}>
                          <Text style={styles.nodeIconLetter}>{node.name[0].toUpperCase()}</Text>
                        </View>
                        <View>
                          <Text style={[styles.nodeTitle, { color: node.color }]}>{node.name.toUpperCase()}</Text>
                          <Text style={styles.nodeDirective}>{node.description}</Text>
                        </View>
                      </View>
                      <Text style={styles.nodeScore}>{getNodeAvg(node)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.addCoordinateBtn} onPress={() => { setAddNodeForm({ name: '', description: '', color: NODE_COLORS[0] }); setAddNodeOpen(true); }} activeOpacity={0.7}>
                  <Text style={styles.addCoordinateText}>+ ADD NODE</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {activeTab === 'Tasks' && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.taskFilterBar} contentContainerStyle={styles.taskFilterBarContent}>
              {(['ALL', 'MIND', 'BODY', 'HOME', 'FOCUS'] as const).map(f => (
                <TouchableOpacity key={f} style={[styles.taskFilterOption, taskFilter === f && styles.taskFilterOptionActive]} onPress={() => setTaskFilter(f)} activeOpacity={0.8}>
                  <Text style={[styles.taskFilterText, taskFilter === f && styles.taskFilterTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {!addTaskOpen ? (
              <TouchableOpacity
                style={styles.addTaskBtn}
                onPress={() => {
                  const first = nodes[0]?.goals[0] ? { nodeId: nodes[0].id, goalId: nodes[0].goals[0].id } : null;
                  setAddTaskTarget(first);
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
                      <TouchableOpacity key={n.id} style={[styles.addTaskNodeBtn, sel && { borderColor: n.color }, i === nodes.length - 1 && { marginRight: 0 }]} onPress={() => { setAddTaskTarget({ nodeId: n.id, goalId: n.goals[0]?.id || '' }); setAddTaskCoordDropdownOpen(false); }} activeOpacity={0.8}>
                        <Text style={[styles.addTaskNodeBtnText, sel && { color: n.color }]}>{n.name.toUpperCase()}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.addTaskFormLabel}>COORDINATE</Text>
                <View style={styles.addTaskDropdownWrap}>
                  <TouchableOpacity style={styles.addTaskDropdownTrigger} onPress={() => addTaskTarget?.nodeId && setAddTaskCoordDropdownOpen(v => !v)} activeOpacity={0.8}>
                    <Text style={styles.addTaskDropdownTriggerText} numberOfLines={1}>
                      {addTaskTarget?.nodeId ? (nodes.find(n => n.id === addTaskTarget.nodeId)?.goals.find(g => g.id === addTaskTarget.goalId)?.name || 'Select coordinate') : 'Select a node first'}
                    </Text>
                    <Svg width={14} height={14} viewBox="0 0 24 24" style={styles.addTaskDropdownChevron}>
                      <Path fill={THEME.textDim} d="M7 10l5 5 5-5H7z" />
                    </Svg>
                  </TouchableOpacity>
                  {addTaskCoordDropdownOpen && addTaskTarget?.nodeId && (
                    <View style={styles.addTaskDropdownList}>
                      {(nodes.find(n => n.id === addTaskTarget.nodeId)?.goals || []).map(g => (
                        <TouchableOpacity key={g.id} style={[styles.addTaskDropdownItem, addTaskTarget?.goalId === g.id && styles.addTaskDropdownItemActive]} onPress={() => { setAddTaskTarget(t => t ? { ...t, goalId: g.id } : null); setAddTaskCoordDropdownOpen(false); }} activeOpacity={0.8}>
                          <Text style={[styles.addTaskCoordChipText, addTaskTarget?.goalId === g.id && { color: nodes.find(n => n.id === addTaskTarget.nodeId)?.color }]}>{g.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                <Text style={styles.addTaskFormLabel}>TITLE</Text>
                <TextInput style={styles.addTaskInput} value={addTaskTitle} onChangeText={setAddTaskTitle} placeholder="Task title…" placeholderTextColor={THEME.textDim} />
                <View style={styles.addTaskActions}>
                  <TouchableOpacity style={styles.addTaskCancel} onPress={() => { setAddTaskOpen(false); setAddTaskTitle(''); setAddTaskTarget(null); setAddTaskCoordDropdownOpen(false); }} activeOpacity={0.7}>
                    <Text style={styles.addTaskCancelText}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.addTaskSubmit} onPress={() => { if (addTaskTarget && addTaskTitle.trim()) { addTask(addTaskTarget.nodeId, addTaskTarget.goalId, addTaskTitle.trim()); setAddTaskOpen(false); setAddTaskTitle(''); setAddTaskTarget(null); } }} activeOpacity={0.7}>
                    <Text style={styles.addTaskSubmitText}>ADD TASK</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {(() => {
              const isFocusFilter = taskFilter === 'FOCUS';
              const isAllFilter = taskFilter === 'ALL';
              const nodeIdFilter = isFocusFilter || isAllFilter ? null : taskFilter.toLowerCase();
              const nodesToConsider = nodeIdFilter ? nodes.filter(n => n.id === nodeIdFilter) : nodes;
              const groups: { coordinateName: string; tasks: typeof nodes[0]['goals'][0]['tasks']; nodeId: string; goalId: string; color: string }[] = [];
              nodesToConsider.forEach(n => {
                n.goals.forEach(g => {
                  const taskList = isFocusFilter ? g.tasks.filter((t: any) => t.isPriority) : g.tasks;
                  if (taskList.length > 0) groups.push({ coordinateName: g.name, tasks: taskList, nodeId: n.id, goalId: g.id, color: n.color });
                });
              });
              const sortOrder = (t: any) => t.completed ? 2 : (t.isPriority ? 0 : 1);
              if (groups.length === 0) {
                return (
                  <View style={styles.taskEmptyState}>
                    <Text style={styles.taskEmptyStateText}>NO ACTIVE COORDINATES</Text>
                  </View>
                );
              }
              return groups.map((grp, i) => (
                <View key={`${grp.nodeId}-${grp.goalId}`}>
                  {i > 0 && !isAllFilter && (
                    <View style={styles.taskCoordSeparator}>
                      <View style={[styles.taskCoordSeparatorLine, { backgroundColor: grp.color, height: 0.5 }]} />
                      <Text style={[styles.taskCoordSeparatorLabel, { color: grp.color }]}>--- COORDINATE: {grp.coordinateName.toUpperCase()} ---</Text>
                      <View style={[styles.taskCoordSeparatorLine, { backgroundColor: grp.color, height: 0.5 }]} />
                    </View>
                  )}
                  {[...grp.tasks].sort((a, b) => sortOrder(a) - sortOrder(b)).map(t => {
                    const task = { ...t, color: grp.color, goal: grp.coordinateName, nodeId: grp.nodeId, goalId: grp.goalId };
                    const pri = !!(task as any).isPriority;
                    return (
                      <TouchableOpacity
                        key={task.id}
                        style={[
                          styles.taskCard,
                          pri && styles.taskCardPriority,
                        ]}
                        onPress={() => { setEditForm({ title: task.title, nodeId: task.nodeId, goalId: task.goalId, isPriority: !!(task as any).isPriority, notes: (task as any).notes || '', dueDate: (task as any).dueDate || '', reminder: (task as any).reminder || '' }); setEditingTask({ nodeId: task.nodeId, goalId: task.goalId, taskId: task.id }); }}
                        activeOpacity={0.85}
                      >
                        <View style={[styles.taskIndicator, { backgroundColor: task.color }, task.completed && { shadowColor: task.color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8 }]} />
                        <View style={styles.taskCardBody}>
                          <View style={styles.taskRow}>
                            <TouchableOpacity style={styles.taskFocusBtn} onPress={() => togglePriority(task.nodeId, task.goalId, task.id)} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Svg width={18} height={18} viewBox="0 0 24 24">
                                {pri ? (
                                  <Path fill={THEME.accent} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                ) : (
                                  <Path fill="none" stroke={THEME.textDim} strokeWidth="1.5" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                )}
                              </Svg>
                            </TouchableOpacity>
                            <View style={styles.taskTitleBlock}>
                              <Text style={[styles.taskTitle, task.completed && styles.taskTitleStrike, task.completed && { opacity: 0.5 }]}>{task.title}</Text>
                              <Text style={styles.taskGoal}>{task.goal.toUpperCase()} EVIDENCE</Text>
                            </View>
                            <View style={styles.taskRightBlock}>
                              {pri && <Text style={styles.taskPriorityLabel}>PRIORITY</Text>}
                              <TouchableOpacity onPress={() => toggleTask(task.nodeId, task.goalId, task.id)} activeOpacity={0.8} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                <Svg width={22} height={22} viewBox="0 0 24 24" style={styles.taskCheck}>
                                  {task.completed ? (
                                    <>
                                      <Circle cx="12" cy="12" r="10" fill={task.color} />
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
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ));
            })()}
          </View>
        )}

        {activeTab === 'Profile' && (
          <View style={styles.profileBox}>
             <Text style={styles.sectionLabel}>ARCHETYPE MODE</Text>
             <View style={styles.pillContainer}>
                {['Architect', 'Nomad', 'Guardian'].map(p => (
                  <View key={p} style={[styles.pill, p === 'Architect' && styles.pillActive]}><Text style={[styles.pillText, p === 'Architect' && styles.pillTextActive]}>{p}</Text></View>
                ))}
             </View>
          </View>
        )}
      </ScrollView>
      <View style={styles.nav}>
        {['Atlas', 'Nodes', 'Tasks', 'Profile'].map(t => {
          const active = activeTab === t;
          const c = active ? THEME.accent : THEME.textDim;
          return (
            <TouchableOpacity key={t} onPress={() => setActiveTab(t)} style={styles.navBtn}>
              <View style={styles.navIconWrap}>
                {t === 'Atlas' && (
                  <Svg width={22} height={22} viewBox="0 0 1024 1024">
                    <Path fill={c} d="M511.8 1023.7C229.6 1023.7 0 794.1 0 511.8S229.6 0 511.8 0s511.8 229.6 511.8 511.8-229.5 511.9-511.8 511.9z m0-938.4c-235.2 0-426.5 191.3-426.5 426.5s191.3 426.5 426.5 426.5S938.3 747 938.3 511.8 747 85.3 511.8 85.3z" />
                    <Path fill={c} d="M292.7 773.7c-11.1 0-22-4.4-30.2-12.5-11.8-11.7-15.6-29.3-9.9-44.9l96.9-263.5c17.9-48.7 54.6-85.4 103.3-103.3l263.5-96.9c15.6-5.7 33.1-1.9 44.9 9.9 11.8 11.7 15.6 29.3 9.9 44.9l-96.9 263.5c-17.9 48.7-54.6 85.4-103.3 103.3l-263.5 96.9c-4.8 1.8-9.8 2.6-14.7 2.6z m366.5-409.2l-176.8 65c-25.6 9.4-43.3 27.2-52.7 52.7L364.6 659l176.8-65c25.6-9.4 43.3-27.2 52.7-52.7l65.1-176.8zM556.1 634.1h0.2-0.2z" />
                  </Svg>
                )}
                {t === 'Nodes' && (
                  <Svg width={22} height={22} viewBox="0 0 24 24">
                    <G fill="none" stroke={c} strokeWidth={1.5}>
                      <Path strokeLinecap="round" stroke={c} d="m13.5 7l3.5 3.5m-10 3l3.5 3.5m0-10L7 10.5m10 3L13.5 17" />
                      <Circle cx="12" cy="5.5" r="2" stroke={c} />
                      <Circle cx="12" cy="18.5" r="2" stroke={c} />
                      <Circle cx="5.5" cy="12" r="2" stroke={c} />
                      <Circle cx="18.5" cy="12" r="2" stroke={c} />
                    </G>
                  </Svg>
                )}
                {t === 'Tasks' && (
                  <Svg width={22} height={22} viewBox="0 0 32 32">
                    <Path fill={c} d="M10.293 5.293L7 8.586L5.707 7.293L4.293 8.707L7 11.414l4.707-4.707zM14 7v2h14V7zm0 8v2h14v-2zm0 8v2h14v-2z" />
                  </Svg>
                )}
                {t === 'Profile' && (
                  <Svg width={22} height={22} viewBox="0 0 24 24">
                    <G fill="none" stroke={c} strokeWidth={2}>
                      <Path strokeLinejoin="round" d="M4 18a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
                      <Circle cx="12" cy="7" r="3" />
                    </G>
                  </Svg>
                )}
              </View>
              <Text style={[styles.navBtnText, active && { color: THEME.accent }]}>{t.toUpperCase()}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {infoOpen && (
        <View style={styles.infoOverlay} pointerEvents="box-none">
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setInfoOpen(false)} activeOpacity={1} />
          <View style={styles.infoCard} pointerEvents="auto">
            <ScrollView style={styles.infoScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.infoTitle}>{activeTab.toUpperCase()}</Text>
              <Text style={styles.infoText}>{INFO_TEXTS[activeTab] || ''}</Text>
            </ScrollView>
            <TouchableOpacity style={styles.infoDoneBtn} onPress={() => setInfoOpen(false)} activeOpacity={0.7}>
              <Text style={styles.infoDoneText}>DONE</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {addNodeOpen && (
        <View style={styles.infoOverlay} pointerEvents="box-none">
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => { setAddNodeOpen(false); setAddNodeForm({ name: '', description: '', color: NODE_COLORS[0] }); }} activeOpacity={1} />
          <View style={styles.addNodeCard} pointerEvents="auto">
            <Text style={styles.editFormLabel}>COLOR</Text>
            <View style={styles.addNodeColorRow}>
              {NODE_COLORS.map(c => (
                <TouchableOpacity key={c} onPress={() => setAddNodeForm(f => ({ ...f, color: c }))} activeOpacity={0.8} style={[styles.addNodeSwatch, { backgroundColor: c }, addNodeForm.color === c && styles.addNodeSwatchSelected]} />
              ))}
            </View>
            <Text style={styles.editFormLabel}>TITLE</Text>
            <TextInput style={styles.editFormInput} value={addNodeForm.name} onChangeText={(t) => setAddNodeForm(f => ({ ...f, name: t }))} placeholder="Node name" placeholderTextColor={THEME.textDim} />
            <Text style={styles.evidenceLabel}>DEFINE THE DESIRED INTENT</Text>
            <TextInput style={[styles.evidenceInput, { marginBottom: 16 }]} value={addNodeForm.description} onChangeText={(t) => setAddNodeForm(f => ({ ...f, description: t }))} placeholder="Intent or purpose…" placeholderTextColor={THEME.textDim} />
            <View style={styles.addTaskActions}>
              <TouchableOpacity style={styles.addTaskCancel} onPress={() => { setAddNodeOpen(false); setAddNodeForm({ name: '', description: '', color: NODE_COLORS[0] }); }} activeOpacity={0.7}>
                <Text style={styles.addTaskCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addTaskSubmit} onPress={addNode} activeOpacity={0.7}>
                <Text style={styles.addTaskSubmitText}>ADD NODE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      {editingCoordinate && (() => {
        const node = nodes.find(n => n.id === editingCoordinate.nodeId);
        const goal = node?.goals.find(g => g.id === editingCoordinate.goalId);
        if (!node || !goal) return null;
        const key = `${node.id}-${goal.id}`;
        const applySliderValue = (evt: { nativeEvent: { locationX: number } }) => {
          const w = trackWidths.current[key] || width - 40;
          if (w <= 0) return;
          const x = Math.max(0, Math.min(evt.nativeEvent.locationX, w));
          const val = Math.round((x / w) * 9) + 1;
          updateValue(node.id, goal.id, Math.max(1, Math.min(10, val)));
        };
        const pan = PanResponder.create({ onStartShouldSetPanResponder: () => true, onPanResponderGrant: applySliderValue, onPanResponderMove: applySliderValue });
        return (
          <View style={styles.infoOverlay} pointerEvents="box-none">
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setEditingCoordinate(null)} activeOpacity={1} />
            <View style={styles.coordinateEditCard} pointerEvents="auto">
              <Text style={styles.editFormLabel}>NAME</Text>
              <TextInput style={styles.editFormInput} value={goal.name} onChangeText={(t) => updateGoal(node.id, goal.id, { name: t })} placeholderTextColor={THEME.textDim} />
              <Text style={styles.calibrationLabel}>{goal.value < 6 ? 'CALIBRATION REQUIRED' : 'SYSTEM ALIGNED'}</Text>
              <View style={styles.sliderRow}>
                <View style={styles.sliderTrack} onLayout={(e) => { trackWidths.current[key] = e.nativeEvent.layout.width; }} {...pan.panHandlers}>
                  <View style={styles.sliderLine} />
                  <View pointerEvents="none" style={[styles.sliderFill, { width: `${goal.value * 10}%`, backgroundColor: node.color }]} />
                  <View pointerEvents="none" style={[styles.sliderHandle, { left: `${goal.value * 10}%`, marginLeft: -6 }]}><View style={styles.sliderHandleInner} /></View>
                </View>
                <View style={styles.valueCircle}><Text style={[styles.valueCircleText, { color: node.color }]}>{goal.value}</Text></View>
              </View>
              <Text style={styles.evidenceLabel}>INPUT EVIDENCE...</Text>
              <TextInput style={[styles.evidenceInput, { marginBottom: 16 }]} value={goal.evidence || ''} onChangeText={(t) => updateGoal(node.id, goal.id, { evidence: t })} placeholder="Log reflection..." placeholderTextColor="#64748B" />
              <TouchableOpacity style={[styles.addTaskSubmit, { alignSelf: 'flex-end' }]} onPress={() => setEditingCoordinate(null)} activeOpacity={0.7}>
                <Text style={styles.addTaskSubmitText}>DONE</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}
      {editingTask && (
        <View style={styles.infoOverlay} pointerEvents="box-none">
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setEditingTask(null)} activeOpacity={1} />
          <View style={styles.taskEditCard} pointerEvents="auto">
            <ScrollView style={styles.taskEditScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.editFormLabel}>TITLE</Text>
              <TextInput style={styles.editFormInput} value={editForm.title} onChangeText={(t) => setEditForm(f => ({ ...f, title: t }))} placeholderTextColor={THEME.textDim} />
              <Text style={styles.editFormLabel}>NODE</Text>
              <View style={styles.taskEditChipRow}>
                {nodes.map(n => {
                  const sel = editForm.nodeId === n.id;
                  return (
                    <TouchableOpacity key={n.id} style={[styles.addTaskCoordChip, sel && { borderColor: n.color }]} onPress={() => setEditForm(f => ({ ...f, nodeId: n.id, goalId: n.goals[0]?.id || '' }))} activeOpacity={0.8}>
                      <Text style={[styles.addTaskCoordChipText, sel && { color: n.color }]}>{n.name.toUpperCase()}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.editFormLabel}>COORDINATE</Text>
              <View style={styles.taskEditChipRow}>
                {(nodes.find(n => n.id === editForm.nodeId)?.goals || []).map(g => {
                  const sel = editForm.goalId === g.id;
                  const node = nodes.find(n => n.id === editForm.nodeId);
                  return (
                    <TouchableOpacity key={g.id} style={[styles.addTaskCoordChip, sel && node && { borderColor: node.color }]} onPress={() => setEditForm(f => ({ ...f, goalId: g.id }))} activeOpacity={0.8}>
                      <Text style={[styles.addTaskCoordChipText, sel && node && { color: node.color }]}>{g.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.editFormLabel}>FOCUS (PRIORITY)</Text>
              <TouchableOpacity style={styles.taskEditFocusRow} onPress={() => setEditForm(f => ({ ...f, isPriority: !f.isPriority }))} activeOpacity={0.8}>
                <Svg width={20} height={20} viewBox="0 0 24 24">
                  {editForm.isPriority ? (
                    <Path fill={THEME.accent} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  ) : (
                    <Path fill="none" stroke={THEME.textDim} strokeWidth="1.5" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  )}
                </Svg>
                <Text style={[styles.addTaskCoordChipText, { marginLeft: 8 }]}>{editForm.isPriority ? 'PRIORITY' : 'NOT PRIORITY'}</Text>
              </TouchableOpacity>
              <Text style={styles.evidenceLabel}>NOTES</Text>
              <TextInput style={styles.taskEditNotes} value={editForm.notes} onChangeText={(t) => setEditForm(f => ({ ...f, notes: t }))} placeholder="Add notes…" placeholderTextColor={THEME.textDim} multiline numberOfLines={3} />
              <Text style={styles.evidenceLabel}>DUE DATE</Text>
              <TextInput style={styles.evidenceInput} value={editForm.dueDate} onChangeText={(t) => setEditForm(f => ({ ...f, dueDate: t }))} placeholder="YYYY-MM-DD" placeholderTextColor={THEME.textDim} />
              <Text style={styles.evidenceLabel}>REMINDER (when to notify)</Text>
              <TextInput style={styles.evidenceInput} value={editForm.reminder} onChangeText={(t) => setEditForm(f => ({ ...f, reminder: t }))} placeholder="e.g. 9:00 AM" placeholderTextColor={THEME.textDim} />
            </ScrollView>
            <View style={styles.addTaskActions}>
              <TouchableOpacity style={styles.addTaskCancel} onPress={() => setEditingTask(null)} activeOpacity={0.7}>
                <Text style={styles.addTaskCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addTaskSubmit} onPress={() => { saveTaskEdit(editingTask, editForm); setEditingTask(null); }} activeOpacity={0.7}>
                <Text style={styles.addTaskSubmitText}>DONE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg }, scrollContent: { padding: 20, paddingBottom: 124 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30 }, headerLeft: { flex: 1 }, headerTitle: { color: 'white', fontSize: 32, fontWeight: '200', letterSpacing: 6 }, headerSubtitle: { color: THEME.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 2 }, headerInfoBtn: { padding: 4 },
  infoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, justifyContent: 'center', alignItems: 'center', padding: 24 }, infoCard: { backgroundColor: '#030712', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, maxWidth: 400, maxHeight: '80%', width: '100%' }, infoScroll: { maxHeight: 320 }, infoTitle: { color: THEME.accent, fontSize: 12, fontWeight: '800', letterSpacing: 3, marginBottom: 12 }, infoText: { color: THEME.border, fontSize: 12, lineHeight: 20, fontWeight: '400' }, infoDoneBtn: { marginTop: 16, alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: THEME.accent }, infoDoneText: { color: THEME.accent, fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  center: { alignItems: 'center' },
  atlasCard: { backgroundColor: '#040b14', borderRadius: 12, padding: 20, marginBottom: 20, overflow: 'hidden', position: 'relative', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }, atlasCardContent: { alignItems: 'stretch', zIndex: 1 },
  atlasCardHeader: { backgroundColor: 'rgba(0,0,0,0.38)', marginHorizontal: -20, marginTop: -20, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }, atlasCardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, atlasScoreBlock: { alignSelf: 'flex-start' },
  atlasViewSwitcher: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 2 }, atlasViewTab: { paddingVertical: 4, paddingHorizontal: 6, marginLeft: 4, borderWidth: 1, borderColor: 'transparent' }, atlasViewTabActive: { borderColor: THEME.accent }, atlasViewTabText: { color: THEME.textDim, fontSize: 8, fontWeight: '700', letterSpacing: 1 }, atlasViewTabTextActive: { color: THEME.accent }, bigScore: { color: 'white', fontSize: 64, fontWeight: '100' }, statLabel: { color: THEME.accent, fontSize: 10, fontWeight: '900', letterSpacing: 4, marginTop: 4 },
  atlasStarfieldContainer: { position: 'relative', overflow: 'hidden', minHeight: 240 }, starfieldSvg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  radarWrapper: { height: 240, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }, atlasLegend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', width: '100%', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }, legendItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, marginRight: 12, marginBottom: 6, borderRadius: 6 },
  trajectoryDaysLegend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingTop: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }, trajectoryDayItem: { flexDirection: 'row', alignItems: 'center', marginRight: 4, marginBottom: 4 }, trajectoryDayDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 }, trajectoryDayLabel: { color: THEME.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 1 }, constellationTrajectoryLabel: { color: THEME.textDim, fontSize: 9, fontWeight: '700', letterSpacing: 2, marginTop: 10, marginBottom: 4 }, legendItemHighlight: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }, legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 }, legendLabel: { color: THEME.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginRight: 6 }, legendLabelHighlight: { color: THEME.accent }, legendValue: { color: 'white', fontSize: 12, fontWeight: '300' },
  nodeBlock: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: '#040b14', marginBottom: 12, borderRadius: 12, overflow: 'hidden' }, nodeDrillDown: {}, nodeHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 30, alignItems: 'center', paddingHorizontal: 20 }, nodeHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  nodeIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' }, nodeIconLetter: { color: 'white', fontSize: 18, fontWeight: '700' },
  nodeTitle: { fontSize: 28, fontWeight: '200', letterSpacing: 8 }, calibrationLabel: { color: THEME.textDim, fontSize: 9, fontWeight: '500', marginTop: 4, letterSpacing: 2 }, nodeDirective: { color: THEME.textDim, fontSize: 8, fontWeight: '800', letterSpacing: 5, marginTop: 4, textTransform: 'uppercase' },
  nodeScore: { color: 'white', fontSize: 24, fontWeight: '200' }, nodeExpanded: { paddingBottom: 30, paddingHorizontal: 20 }, divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 25 }, coordinatesLabel: { color: THEME.textDim, fontSize: 9, fontWeight: '800', letterSpacing: 3, marginBottom: 16, textTransform: 'uppercase' }, addCoordinateBtn: { marginTop: 8, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 4 }, addCoordinateText: { color: THEME.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingVertical: 8 }, backText: { color: THEME.accent, fontSize: 14, fontWeight: '600', letterSpacing: 2 },
  goalBlock: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: '#040b14', padding: 16, marginBottom: 12, borderRadius: 8 }, goalItem: { marginBottom: 30 }, goalName: { color: 'white', fontSize: 14, fontWeight: '600' }, goalVal: { fontWeight: '900' }, goalValueRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 }, goalValueBadge: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 10 }, goalValueText: { fontSize: 16, fontWeight: '700' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }, sliderTrack: { flex: 1, height: 24, justifyContent: 'center' }, sliderLine: { height: 2, width: '100%', backgroundColor: 'rgba(255,255,255,0.1)' }, sliderFill: { position: 'absolute', left: 0, top: 11, height: 2, opacity: 0.6 }, sliderHandle: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: 'transparent', borderWidth: 2, borderColor: '#38BDF8', top: 6, justifyContent: 'center', alignItems: 'center', shadowColor: '#38BDF8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 }, sliderHandleInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#0F172A' },
  valueCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: THEME.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' }, valueCircleText: { fontSize: 22, fontWeight: '200' },
  taskFilterBar: { marginBottom: 16, marginHorizontal: -20 }, taskFilterBarContent: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }, taskFilterOption: { paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: 'transparent', marginRight: 8 }, taskFilterOptionActive: { borderColor: '#E2E8F0' }, taskFilterText: { color: '#64748B', fontSize: 11, fontWeight: '700', letterSpacing: 2 }, taskFilterTextActive: { color: 'white' },
  addTaskBtn: { marginBottom: 16, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 4 }, addTaskBtnText: { color: THEME.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  addTaskForm: { marginBottom: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#040b14', borderRadius: 8 }, addTaskFormLabel: { color: THEME.textDim, fontSize: 9, fontWeight: '800', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }, addTaskNodeRow: { flexDirection: 'row', marginBottom: 16 }, addTaskNodeBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center' }, addTaskNodeBtnText: { color: THEME.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 1 }, addTaskDropdownWrap: { marginBottom: 16 }, addTaskDropdownTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 4 }, addTaskDropdownTriggerText: { color: THEME.border, fontSize: 12, flex: 1 }, addTaskDropdownChevron: { marginLeft: 8 }, addTaskDropdownList: { marginTop: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden' }, addTaskDropdownItem: { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }, addTaskDropdownItemActive: { backgroundColor: 'rgba(255,255,255,0.06)' }, addTaskCoordRow: { marginBottom: 16 }, addTaskCoordContent: { flexDirection: 'row', paddingRight: 20 }, addTaskCoordChip: { paddingVertical: 8, paddingHorizontal: 12, marginRight: 8, borderWidth: 1, borderRadius: 4 }, addTaskCoordChipActive: {}, addTaskCoordChipText: { color: THEME.textDim, fontSize: 10, fontWeight: '600' }, addTaskInput: { color: 'white', fontSize: 14, paddingVertical: 10, paddingHorizontal: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', marginBottom: 16 }, addTaskActions: { flexDirection: 'row', justifyContent: 'flex-end' }, addTaskCancel: { paddingVertical: 8, paddingHorizontal: 16, marginRight: 12 }, addTaskCancelText: { color: THEME.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 2 }, addTaskSubmit: { paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: THEME.accent }, addTaskSubmitText: { color: THEME.accent, fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  taskCoordSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 }, taskCoordSeparatorLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' }, taskCoordSeparatorLabel: { fontSize: 8, color: '#E2E8F0', letterSpacing: 3, fontWeight: '600', marginHorizontal: 10 },
  taskCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, marginBottom: 12, backgroundColor: '#040b14', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, overflow: 'hidden', }, taskCardPriority: { borderWidth: 2, borderColor: '#E2E8F0', shadowColor: '#38BDF8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 10 }, taskCardCompleted: { opacity: 0.5 }, taskIndicator: { width: 4, height: 24, marginRight: 20 }, taskCardBody: { flex: 1, flexDirection: 'column' }, taskRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, taskFocusBtn: { padding: 4, marginRight: 10 }, taskTitleBlock: { flex: 1 }, taskRightBlock: { flexDirection: 'row', alignItems: 'center' }, taskCheck: {}, taskPriorityLabel: { fontSize: 6, fontWeight: '700', color: THEME.accent, letterSpacing: 1, marginRight: 8 },
  taskTitle: { color: 'white', fontSize: 14 }, taskTitleStrike: { textDecorationLine: 'line-through' }, taskGoal: { color: THEME.textDim, fontSize: 8, fontWeight: '800', marginTop: 4 },
  taskEmptyState: { borderWidth: 1, borderColor: 'rgba(226,232,240,0.5)', borderStyle: 'dashed', padding: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, taskEmptyStateText: { color: THEME.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  taskEditCard: { backgroundColor: '#030712', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, maxWidth: 400, maxHeight: '85%', width: '100%' }, taskEditScroll: { maxHeight: 380 }, taskEditChipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }, taskEditFocusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingVertical: 8 }, taskEditNotes: { color: THEME.border, fontSize: 12, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 4, minHeight: 72, textAlignVertical: 'top', marginBottom: 16 },
  addNodeCard: { backgroundColor: '#030712', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, maxWidth: 400, width: '100%' }, addNodeColorRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 }, addNodeSwatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent', marginRight: 10, marginBottom: 10 }, addNodeSwatchSelected: { borderColor: '#E2E8F0' },
  profileBox: { padding: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }, sectionLabel: { color: THEME.textDim, fontSize: 10, fontWeight: '800', marginBottom: 20 },
  pillContainer: { flexDirection: 'row', gap: 10 }, pill: { paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }, pillActive: { borderColor: THEME.accent, backgroundColor: 'rgba(56, 189, 248, 0.1)' }, pillText: { color: THEME.textDim, fontSize: 12 }, pillTextActive: { color: THEME.accent, fontWeight: '700' },
  coordinateEditForm: { paddingVertical: 8 }, coordinateEditCard: { backgroundColor: '#030712', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, maxWidth: 400, width: '100%' }, editFormLabel: { color: THEME.textDim, fontSize: 9, fontWeight: '800', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }, editFormInput: { color: 'white', fontSize: 16, fontWeight: '500', paddingVertical: 12, paddingHorizontal: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', marginBottom: 20 },
  evidenceLabel: { color: THEME.textDim, fontSize: 8, fontWeight: '700', letterSpacing: 2, marginTop: 14, marginBottom: 6 },
  evidenceInput: { color: THEME.border, fontSize: 8, fontWeight: '700', letterSpacing: 2, paddingVertical: 8, paddingHorizontal: 0, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }, evidencePreview: { color: THEME.textDim, fontSize: 10, letterSpacing: 1 },
  nav: { flexDirection: 'row', height: 100, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', backgroundColor: THEME.bg, position: 'absolute', bottom: 0, width: '100%', overflow: 'hidden' }, navBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }, navIconWrap: { marginBottom: 6 }, navBtnText: { color: THEME.textDim, fontSize: 10, fontWeight: '800' }
});