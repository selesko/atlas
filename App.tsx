import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, StatusBar, Dimensions, PanResponder, Modal, Switch, KeyboardAvoidingView, Platform, Pressable, Animated } from 'react-native';
import Svg, { Circle, Polygon, G, Rect, Path, Defs, RadialGradient, LinearGradient, Stop, Line, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { supabase } from './lib/supabase';

const { width, height } = Dimensions.get('window');

const HEADER_CONNECTED = 'SYSTEM ALIGNMENT // V1.0';
const HEADER_FALLBACKS = ['SYSTEMS NOMINAL', 'ALL GREEN', 'STANDING BY', 'LOCAL MODE', 'OFFLINE — SYSTEMS STABLE', 'ALIGNMENT CHECK PENDING', 'SYSTEMS STABLE // LOCAL'];

function pickHeaderFallback() {
  return HEADER_FALLBACKS[Math.floor(Math.random() * HEADER_FALLBACKS.length)];
}

const THEME = {
  bg: '#152238', card: '#07101c', border: '#E2E8F0', accent: '#38BDF8', textDim: '#64748B',
  mind: '#38BDF8', body: '#FB7185', home: '#A78BFA',
  cardBorder: 'rgba(226,232,240,0.5)', glow: 'rgba(56,189,248,0.22)', glowPop: 'rgba(56,189,248,0.3)',
};

const NODE_COLORS = [THEME.mind, THEME.body, THEME.home, '#34D399', '#FBBF24', '#F472B6', '#60A5FA', '#10B981'];
const DEFAULT_NODE_IDS = ['mind', 'body', 'home'];

const INFO_TEXTS: Record<string, string> = {
  Atlas: 'The Atlas is your primary visualization of the balance between Mind, Body, and Home. This radar chart represents the current state of your system based on the coordinates you have manually set. A symmetrical shape indicates balance, while a pull toward one node highlights where your current focus should be concentrated.',
  Nodes: 'Nodes & Coordinates\n\nEvery primary Node is supported by specific Coordinates. These are the individual pillars that define the integrity of the node.\n\nCoordinates allow for granular adjustment (e.g., "Meditation" is a coordinate of "Mind").\n\nMoving these sliders manually updates the Node\'s overall average.\n\nUse this screen to adjust your status based on the Evidence you\'ve gathered in your daily logs.',
  Tasks: 'Tasks (Action Log)\n\nThe Task page is the record of your actions. Tasks are grouped by their parent Coordinate to ensure every move is intentional.\n\nFocus Mode: High-priority items that represent your current path.\n\nEvidence Logging: The core of the system. You aren\'t just finishing tasks; you are documenting evidence to justify how you calibrate your Atlas scores.\n\nSorting: Priority items stay at the top; completed entries move to the bottom for reference.',
  Profile: 'The Profile page defines your current Archetype.\n\nSelecting an Archetype (Architect, Nomad, or Guardian) updates the interface overlay and the specific "Directives" shown throughout the app.\n\nThis allows you to match the system\'s feedback to your current environment or phase of life.'
};

const toCreatedAt = (daysAgo: number) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().slice(0, 10); };
const todayISO = () => new Date().toISOString().slice(0, 10);
const lastNDays = (n: number) => { const out: string[] = []; for (let i = n - 1; i >= 0; i--) out.push(toCreatedAt(i)); return out; };
const MOTIVATOR_OPTIONS = ['DISCIPLINE', 'CREATIVITY', 'CONNECTION', 'AUTONOMY', 'MASTERY', 'VITALITY', 'ORDER', 'GROWTH', 'LEGACY'] as const;

const MODEL_DESCRIPTIONS: Record<'Architect' | 'Strategist' | 'Builder' | 'Analyst', string> = {
  Architect: 'a systems thinker who designs frameworks and structures to bring clarity and order to complex goals.',
  Strategist: 'a forward-looking planner who connects today\'s actions to long-term outcomes and navigates uncertainty with intent.',
  Builder: 'an execution-focused operator who turns ideas into reality through consistent action and incremental progress.',
  Analyst: 'a pattern-seeking evaluator who optimizes decisions through evidence, reflection, and measured calibration.',
};

const FadingBorder: React.FC<{ children: React.ReactNode; style?: any }> = ({ children, style }) => (
  <View style={[{ borderRadius: 12, overflow: 'hidden' }, style]}>
    <ExpoLinearGradient
      colors={['transparent', 'rgba(226, 232, 240, 0.4)', 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1 }}
    />
    <ExpoLinearGradient
      colors={['transparent', 'rgba(226, 232, 240, 0.4)', 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1 }}
    />
    <ExpoLinearGradient
      colors={['transparent', 'rgba(226, 232, 240, 0.4)', 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 1 }}
    />
    <ExpoLinearGradient
      colors={['transparent', 'rgba(226, 232, 240, 0.4)', 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 1 }}
    />
    {children}
  </View>
);

const buildScoreHistory = (value: number, days: number) => lastNDays(days).map((date, i) => ({ date, value: Math.max(1, Math.min(10, value + (i - days / 2) * 0.3)) }));
const INITIAL_DATA = [
  { id: 'mind', name: 'Mind', color: THEME.mind, description: 'CLARITY & FOCUS', goals: [{ id: 'm1', name: 'Meditation', value: 7, evidence: '', scoreHistory: buildScoreHistory(7, 7), tasks: [{ id: 't1', title: '10m Focus Session', completed: true, timestamp: '09:42', isPriority: false, createdAt: toCreatedAt(3), completedAt: toCreatedAt(3) }] }, { id: 'm2', name: 'Deep Work', value: 5, evidence: '', scoreHistory: buildScoreHistory(5, 7), tasks: [] }] },
  { id: 'body', name: 'Body', color: THEME.body, description: 'ENERGY & VITALITY', goals: [{ id: 'b1', name: 'Hydration', value: 9, evidence: '', scoreHistory: buildScoreHistory(9, 7), tasks: [{ id: 't2', title: '3L Water', completed: false, timestamp: '14:15', isPriority: false, createdAt: toCreatedAt(1) }] }, { id: 'b2', name: 'Sleep Quality', value: 6, evidence: '', scoreHistory: buildScoreHistory(6, 7), tasks: [] }] },
  { id: 'home', name: 'Home', color: THEME.home, description: 'ENVIRONMENT', goals: [{ id: 'h1', name: 'Organization', value: 8, evidence: '', scoreHistory: buildScoreHistory(8, 7), tasks: [{ id: 't3', title: 'Clear Desk', completed: true, timestamp: '07:23', isPriority: false, createdAt: toCreatedAt(5), completedAt: toCreatedAt(5) }] }, { id: 'h2', name: 'Order', value: 7, evidence: '', scoreHistory: buildScoreHistory(7, 7), tasks: [] }] }
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
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editNodeForm, setEditNodeForm] = useState({ name: '', description: '', color: NODE_COLORS[0] });
  const [stars, setStars] = useState<Array<{ cx: number; cy: number; r: number; op: number }>>([]);
  const [atlasGraphView, setAtlasGraphView] = useState<'radar' | 'trajectory' | 'constellation'>('radar');
  const [trajectoryDragX, setTrajectoryDragX] = useState<number | null>(null);
  const trajectoryChartWidthRef = useRef(0);
  const trajectoryPulseOffsets = useRef<Animated.Value[]>([]);
  const [trajectoryPulseDash, setTrajectoryPulseDash] = useState<number[]>([]);
  const constellationPulseScale = useRef(new Animated.Value(1)).current;
  const constellationPulseOpacity = useRef(new Animated.Value(0.4)).current;
  const [constellationPulseScaleState, setConstellationPulseScaleState] = useState(1);
  const [constellationPulseOpacityState, setConstellationPulseOpacityState] = useState(0.4);
  const nodeBreathAnim = useRef(new Animated.Value(0)).current;
  const [nodeBreathValue, setNodeBreathValue] = useState(0);
  const [cognitiveModel, setCognitiveModel] = useState<'Architect' | 'Strategist' | 'Builder' | 'Analyst'>('Architect');
  const [peakPeriod, setPeakPeriod] = useState<'MORNING' | 'EVENING'>('MORNING');
  const [motivators, setMotivators] = useState<string[]>([]);
  const [identityNotes, setIdentityNotes] = useState('');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [coordEditAddTitle, setCoordEditAddTitle] = useState('');
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotTransition, setCopilotTransition] = useState(false);
  const copilotOrbitAnim = useRef(new Animated.Value(0)).current;
  const copilotSunburstAnim = useRef(new Animated.Value(0)).current;
  const copilotScaleAnim = useRef(new Animated.Value(1)).current;
  const [copilotOrbitAngle, setCopilotOrbitAngle] = useState(0);
  const [hasAccess, setHasAccess] = useState(false);
  const [systemAccessGateOpen, setSystemAccessGateOpen] = useState(false);
  const [headerSubtitle, setHeaderSubtitle] = useState(pickHeaderFallback);
  const trajectoryPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const w = trajectoryChartWidthRef.current || 320;
      const lx = e.nativeEvent.locationX;
      const vx = Math.max(0, Math.min(320, (lx / w) * 320));
      setTrajectoryDragX(vx);
    },
    onPanResponderMove: (e) => {
      const w = trajectoryChartWidthRef.current || 320;
      const lx = e.nativeEvent.locationX;
      const vx = Math.max(0, Math.min(320, (lx / w) * 320));
      setTrajectoryDragX(vx);
    },
    onPanResponderRelease: () => setTrajectoryDragX(null),
  }), []);

  const TABS = ['Atlas', 'Nodes', 'Tasks', 'Profile'] as const;

  const trackWidths = useRef<Record<string, number>>({});

  const radarRotation = useRef(new Animated.Value(0)).current;
  const radarScale = useRef(new Animated.Value(1)).current;
  const [radarPulseScale, setRadarPulseScale] = useState(1);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(radarRotation, {
          toValue: 360,
          duration: 90000,
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(radarRotation, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    const scaleAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(radarScale, { toValue: 1.02, duration: 3000, useNativeDriver: false, isInteraction: false }),
        Animated.timing(radarScale, { toValue: 0.98, duration: 3000, useNativeDriver: false, isInteraction: false }),
      ])
    );
    scaleAnim.start();
    const scaleSub = radarScale.addListener(({ value }) => setRadarPulseScale(value));
    return () => {
      scaleAnim.stop();
      radarScale.removeListener(scaleSub);
    };
  }, []);

  useEffect(() => {
    const breathAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(nodeBreathAnim, { toValue: 1, duration: 2000, useNativeDriver: false, isInteraction: false }),
        Animated.timing(nodeBreathAnim, { toValue: 0, duration: 2000, useNativeDriver: false, isInteraction: false }),
      ])
    );
    breathAnim.start();
    const breathSub = nodeBreathAnim.addListener(({ value }) => setNodeBreathValue(value));
    return () => {
      breathAnim.stop();
      nodeBreathAnim.removeListener(breathSub);
    };
  }, []);

  useEffect(() => {
    const n = nodes.length;
    if (n === 0 || atlasGraphView !== 'trajectory') return;
    while (trajectoryPulseOffsets.current.length < n) {
      trajectoryPulseOffsets.current.push(new Animated.Value(0));
    }
    const pathLen = 400;
    const offsets = trajectoryPulseOffsets.current.slice(0, n);
    const listeners = offsets.map((offset, ni) => {
      const duration = 1800 + ni * 400;
      const delay = ni * 500;
      Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(offset, { toValue: pathLen, duration, useNativeDriver: false, isInteraction: false }),
            Animated.timing(offset, { toValue: 0, duration: 0, useNativeDriver: false }),
          ])
        ),
      ]).start();
      return offset.addListener(({ value }: { value: number }) => {
        setTrajectoryPulseDash(prev => {
          const next = prev.length === n ? [...prev] : Array(n).fill(0);
          next[ni] = value;
          return next;
        });
      });
    });
    setTrajectoryPulseDash(Array(n).fill(0));
    return () => {
      offsets.forEach((offset, i) => {
        offset.removeListener(listeners[i]);
        offset.stopAnimation();
      });
    };
  }, [nodes.length, atlasGraphView]);

  useEffect(() => {
    if (atlasGraphView !== 'constellation') return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(constellationPulseOpacity, { toValue: 0.7, duration: 1200, useNativeDriver: false, isInteraction: false }),
        Animated.timing(constellationPulseOpacity, { toValue: 0.4, duration: 1200, useNativeDriver: false, isInteraction: false }),
      ])
    ).start();
    const opacitySub = constellationPulseOpacity.addListener(({ value }) => setConstellationPulseOpacityState(value));
    return () => {
      constellationPulseOpacity.stopAnimation();
      constellationPulseOpacity.removeListener(opacitySub);
    };
  }, [atlasGraphView]);

  const radarRotStyle = {
    transform: [{ rotate: radarRotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) }],
  };

  const handleRadarTouch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const triggerCopilotTransition = useCallback(() => {
    if (!hasAccess) {
      setSystemAccessGateOpen(true);
      return;
    }
    // Reset animation values
    copilotOrbitAnim.setValue(0);
    copilotSunburstAnim.setValue(0);
    copilotScaleAnim.setValue(1);
    setCopilotOrbitAngle(0);
    setCopilotTransition(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Listen to orbit angle for rendering
    const orbitListener = copilotOrbitAnim.addListener(({ value }) => {
      setCopilotOrbitAngle(value);
    });

    // Sequence: Single smooth orbit, then sunburst, then crossfade to modal
    Animated.sequence([
      // Planet orbits once smoothly
      Animated.timing(copilotOrbitAnim, {
        toValue: 360,
        duration: 800,
        useNativeDriver: false,
        isInteraction: false,
      }),
      // Scale up sun and sunburst together smoothly
      Animated.parallel([
        Animated.timing(copilotScaleAnim, {
          toValue: 1.3,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(copilotSunburstAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: false,
        }),
      ]),
    ]).start(() => {
      // Open modal as sunburst starts fading - creates crossfade effect
      setCopilotOpen(true);
      // Fade sunburst out while modal fades in
      Animated.timing(copilotSunburstAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: false,
      }).start(() => {
        copilotOrbitAnim.removeListener(orbitListener);
        setCopilotTransition(false);
      });
    });
  }, [hasAccess]);

  const copilotContent = useMemo(() => {
    const getAvg = (node: any) => (node.goals.reduce((acc: number, g: any) => acc + g.value, 0) / (node.goals.length || 1));
    const getAvgStr = (node: any) => getAvg(node).toFixed(1);
    type Action = 'calibrate' | 'logEvidence' | 'prioritize' | 'deployTask';
    type Line = { prefix: string; text: string };
    let briefingLines: Line[] = [];
    let suggest1: { label: string; action: Action; nodeId?: string; goalId?: string } = { label: `Your ${(nodes[0]?.name || 'node').toUpperCase()} node requires review; calibrate its coordinates.`, action: 'calibrate', nodeId: nodes[0]?.id };
    let suggest2: { label: string; action: Action; nodeId?: string; goalId?: string } = { label: `Your ${(nodes[0]?.goals?.[0]?.name || 'coordinate').toUpperCase()} coordinate needs evidence; log it to strengthen alignment.`, action: 'logEvidence', nodeId: nodes[0]?.id, goalId: nodes[0]?.goals[0]?.id };

    if (activeTab === 'Atlas' || activeTab === 'Nodes' || activeTab === 'Profile') {
      const withAvg = nodes.map(n => ({ node: n, avg: getAvg(n) })).sort((a, b) => b.avg - a.avg);
      const highest = withAvg[0];
      const lowest = withAvg[withAvg.length - 1];
      const delta = highest && lowest && highest.node.id !== lowest.node.id
        ? (highest.avg - lowest.avg).toFixed(1)
        : '0';
      if (activeTab === 'Nodes') {
        const needsCal: { n: any; g: any; v: number }[] = [];
        const needEvidence: { n: any; g: any }[] = [];
        nodes.forEach(n => {
          n.goals.forEach((g: any) => {
            if (g.value < 6) needsCal.push({ n, g, v: g.value });
            if (!(g.evidence && String(g.evidence).trim())) needEvidence.push({ n, g });
          });
        });
        if (needsCal.length) briefingLines.push({ prefix: '> STATUS:', text: `${needsCal.length} COORDINATE(S) BELOW 6 — ${needsCal.map(c => `${c.g.name.toUpperCase()} (${c.n.name.toUpperCase()}): ${c.v}`).join('; ')}.` });
        if (needEvidence.length) briefingLines.push({ prefix: '> EVIDENCE REQUIRED:', text: `${needEvidence.length} COORDINATE(S) LACK EVIDENCE — ${needEvidence.slice(0, 3).map(e => `${e.g.name.toUpperCase()} (${e.n.name.toUpperCase()})`).join('; ')}.` });
        if (briefingLines.length === 0) briefingLines = [{ prefix: '> STATUS:', text: 'ALL COORDINATES CALIBRATED. ALL EVIDENCE LOGGED.' }];
      } else if (activeTab === 'Profile') {
        briefingLines = [{ prefix: '> STATUS:', text: `${cognitiveModel.toUpperCase()} ARCHETYPE. PEAK PERIOD ${peakPeriod}. ${motivators.length ? `MOTIVATORS: ${motivators.slice(0, 3).join(', ')}.` : 'SET MOTIVATORS FOR ALIGNMENT.'}` }];
      } else {
        if (highest && lowest && delta !== '0') {
          briefingLines = [
            { prefix: '> STATUS:', text: `THE ATLAS IS WEIGHTED TOWARD ${highest.node.name.toUpperCase()} (${getAvgStr(highest.node)}).` },
            { prefix: '> ALERT:', text: `${lowest.node.name.toUpperCase()} (${getAvgStr(lowest.node)}) TRAILING BY ${delta} POINTS, STRUCTURAL DRIFT.` },
          ];
        } else if (withAvg.length) {
          const n = withAvg[0];
          briefingLines = [{ prefix: '> STATUS:', text: `THE ATLAS SHOWS UNIFORM WEIGHTS. ${n.node.name.toUpperCase()} LEADS AT ${getAvgStr(n.node)}.` }];
        } else {
          briefingLines = [{ prefix: '> STATUS:', text: 'NO NODES DEFINED. ADD NODES TO BUILD THE ATLAS.' }];
        }
      }
      suggest1 = { label: `Your ${(lowest?.node?.name || 'node').toUpperCase()} node requires review; calibrate its coordinates.`, action: 'calibrate', nodeId: lowest?.node.id };
      const goalForEvidence = highest?.node.goals.find((g: any) => !(g.evidence && String(g.evidence).trim())) || highest?.node.goals[0];
      suggest2 = { label: `Your ${(goalForEvidence?.name || 'coordinate').toUpperCase()} coordinate in ${(highest?.node?.name || 'node').toUpperCase()} needs evidence; log it to strengthen alignment.`, action: 'logEvidence', nodeId: highest?.node.id, goalId: goalForEvidence?.id };
    } else if (activeTab === 'Tasks') {
      const allTasks: any[] = [];
      nodes.forEach(n => n.goals.forEach((g: any) => (g.tasks || []).forEach((t: any) => allTasks.push({ ...t, nodeId: n.id, goalId: g.id, goalName: g.name }))));
      const completed = allTasks.filter(t => t.completed).length;
      const pending = allTasks.filter(t => !t.completed).length;
      const byCoord: Record<string, { nodeId: string; goalId: string; goalName: string; pending: number }> = {};
      nodes.forEach(n => n.goals.forEach((g: any) => {
        const p = (g.tasks || []).filter((t: any) => !t.completed).length;
        if (p > 0) { const k = `${n.id}-${g.id}`; if (!byCoord[k] || p > byCoord[k].pending) byCoord[k] = { nodeId: n.id, goalId: g.id, goalName: g.name, pending: p }; }
      }));
      const topCoord = Object.values(byCoord).sort((a, b) => b.pending - a.pending)[0];
      const withAvg = nodes.map(n => ({ node: n, avg: (n.goals.reduce((acc: number, g: any) => acc + g.value, 0) / (n.goals.length || 1)) })).sort((a, b) => a.avg - b.avg);
      const needsNode = withAvg[0]?.node;
      briefingLines = [
        { prefix: '> STATUS:', text: `DAILY VELOCITY — ${completed} COMPLETED, ${pending} PENDING.` },
        { prefix: topCoord ? '> ALERT:' : '> STATUS:', text: topCoord ? `${topCoord.goalName.toUpperCase()} HAS HIGHEST PENDING LOAD (${topCoord.pending} TASK${topCoord.pending !== 1 ? 'S' : ''}).` : 'NO PENDING TASK.' },
      ];
      suggest1 = { label: `Your ${(topCoord?.goalName || 'coordinate').toUpperCase()} coordinate has pending work; prioritize and plan.`, action: 'prioritize', nodeId: topCoord?.nodeId, goalId: topCoord?.goalId };
      suggest2 = { label: `Your ${(needsNode?.name || 'mind').toUpperCase()} node could use a new task; deploy one to build momentum.`, action: 'deployTask', nodeId: needsNode?.id, goalId: needsNode?.goals[0]?.id };
    }

    return { briefingLines, suggest1, suggest2 };
  }, [activeTab, nodes, cognitiveModel, peakPeriod, motivators]);

  const briefingHighlight = useMemo(() => {
    const wordToColor: Record<string, string> = { EVIDENCE: '#22D3EE' };
    const canon = (n: any) => (n.id === 'mind' || (n.name || '').toLowerCase() === 'mind') ? '#22D3EE' : (n.id === 'body' || (n.name || '').toLowerCase() === 'body') ? '#FB7185' : (n.id === 'home' || (n.name || '').toLowerCase() === 'home') ? '#A78BFA' : (n.color || THEME.border);
    nodes.forEach((n: any) => {
      wordToColor[(n.name || '').toUpperCase()] = canon(n);
      (n.goals || []).forEach((g: any) => { wordToColor[(g.name || '').toUpperCase()] = canon(n); });
    });
    const keywords = Object.keys(wordToColor).filter(Boolean).sort((a, b) => b.length - a.length);
    const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`(\\d+\\.?\\d*|${escaped.join('|')})`, 'gi');
    return { wordToColor, re };
  }, [nodes]);

  const handleSuggestion = useCallback((s: { action: string; nodeId?: string; goalId?: string }) => {
    if (s.action === 'calibrate' && s.nodeId) { setActiveTab('Nodes'); setSelectedNodeId(s.nodeId); }
    else if (s.action === 'logEvidence' && s.nodeId && s.goalId) { setEditingCoordinate({ nodeId: s.nodeId, goalId: s.goalId }); }
    else if (s.action === 'prioritize' && s.nodeId && s.goalId) { setEditingCoordinate({ nodeId: s.nodeId, goalId: s.goalId }); }
    else if (s.action === 'deployTask') {
      const { nodeId, goalId } = s.nodeId && s.goalId ? { nodeId: s.nodeId, goalId: s.goalId } : (nodes[0]?.goals[0] ? { nodeId: nodes[0].id, goalId: nodes[0].goals[0].id } : { nodeId: '', goalId: '' });
      if (nodeId && goalId) { setAddTaskTarget({ nodeId, goalId }); setAddTaskTitle(''); setAddTaskCoordDropdownOpen(false); setAddTaskOpen(true); }
    }
  }, [nodes]);

  const suggestionBtnLabel: Record<string, string> = { calibrate: 'CALIBRATE', logEvidence: 'LOG EVIDENCE', prioritize: 'PRIORITIZE', deployTask: 'ADD TASK' };

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
    const today = todayISO();
    setNodes(prev => prev.map(n => {
      if (n.id !== nodeId) return n;
      return {
        ...n,
        goals: n.goals.map(g => {
          if (g.id !== goalId) return g;
          const hist = (g as any).scoreHistory || [];
          const withoutToday = hist.filter((e: { date: string }) => e.date !== today);
          const scoreHistory = [...withoutToday, { date: today, value: val }].sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date)).slice(-14);
          return { ...g, value: val, scoreHistory };
        })
      };
    }));
  };

  const updateGoal = (nodeId: string, goalId: string, patch: { name?: string; evidence?: string }) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, goals: n.goals.map(g => g.id === goalId ? { ...g, ...patch } : g) } : n));
  };

  const toggleTask = (nodeId: string, goalId: string, taskId: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id !== nodeId) return n;
      return {
        ...n,
        goals: n.goals.map(g => {
          if (g.id !== goalId) return g;
          return {
            ...g,
            tasks: g.tasks.map(t => t.id !== taskId ? t : {
              ...t,
              completed: !t.completed,
              ...(t.completed ? {} : { completedAt: todayISO() }),
            } as any)
          };
        })
      };
    }));
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
    setNodes(prev => prev.map(n => n.id !== nodeId ? n : { ...n, goals: n.goals.map(g => g.id !== goalId ? g : { ...g, tasks: [...g.tasks, { id: 't' + Date.now(), title: t, completed: false, isPriority: false, timestamp: '', notes: '', dueDate: '', reminder: '', createdAt: todayISO() }] }) }) );
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

  const updateNode = (nodeId: string, patch: { name?: string; description?: string; color?: string }) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...patch } : n));
  };

  useEffect(() => { if (!editingCoordinate) setCoordEditAddTitle(''); }, [editingCoordinate]);

  useEffect(() => {
    if (editingNodeId) {
      const node = nodes.find(n => n.id === editingNodeId);
      if (node) {
        setEditNodeForm({ name: node.name, description: node.description || '', color: node.color });
      }
    }
  }, [editingNodeId, nodes]);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        await supabase.auth.getSession();
        if (mounted) setHeaderSubtitle(HEADER_CONNECTED);
      } catch {
        if (mounted) setHeaderSubtitle(prev => prev === HEADER_CONNECTED ? pickHeaderFallback() : prev);
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>{activeTab.toUpperCase()}</Text>
            <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
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
          const withAvg = nodes.map(n => ({ node: n, avg: parseFloat(getNodeAvg(n)) })).sort((a, b) => b.avg - a.avg);
          const highest = withAvg[0];
          const lowest = withAvg[withAvg.length - 1];
          const driftDelta = highest && lowest && highest.node.id !== lowest.node.id ? (highest.avg - lowest.avg).toFixed(1) : '0';
          const needsCal = nodes.reduce((a, n) => a + (n.goals || []).filter((g: any) => g.value < 6).length, 0);
          const needEvidence = nodes.reduce((a, n) => a + (n.goals || []).filter((g: any) => !(g.evidence && String(g.evidence).trim())).length, 0);
          const totalCoords = nodes.reduce((a, n) => a + (n.goals || []).length, 0);
          const getTierForNode = (node: any) => {
            if (node.id === 'mind') return 0;
            if (node.id === 'body') return 1;
            if (node.id === 'home') return 2;
            if (node.color === THEME.mind) return 0;
            if (node.color === THEME.body) return 1;
            if (node.color === THEME.home) return 2;
            return 1;
          };
          const trajectoryX = (i: number) => (i / 6) * 320;
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
            if (x <= 0) return averageData[0];
            if (x >= 320) return averageData[6];
            const i = (x / 320) * 6;
            const i0 = Math.floor(i);
            const i1 = Math.min(i0 + 1, 6);
            const f = i - i0;
            return averageData[i0] * (1 - f) + averageData[i1] * f;
          };
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
          <>
          {/* System Status: above graph */}
          <View style={styles.systemManifestCard}>
            <View style={styles.systemManifestPrimaryRow}>
              <View style={styles.systemManifestLeft}>
                <Text style={styles.systemManifestBracketLabel}>SYSTEM STATUS</Text>
              </View>
              <View style={styles.systemManifestVLine} />
              <View style={styles.systemManifestStatusBlock}>
                <Text style={styles.systemManifestBracketValue}>{systemBalance}</Text>
              </View>
            </View>
          </View>
          <View style={styles.atlasCard}>
            <View style={styles.atlasCardContent}>
              <View style={[styles.atlasCardHeader, styles.atlasCardHeaderRow]}>
                <View style={styles.atlasScoreBlock}>
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
                    {/* Ethereal Background Glow */}
                    <Svg style={[StyleSheet.absoluteFill, { zIndex: 0 }]} viewBox={`0 0 ${width} ${STARFIELD_HEIGHT}`} preserveAspectRatio="xMidYMid slice">
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
                    <Pressable style={styles.radarWrapper} onPressIn={handleRadarTouch}>
                      <Animated.View style={[styles.radarRotWrap, radarRotStyle]}>
                        <Svg height={240} width={240} viewBox="0 0 200 200">
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
                            <G opacity={0.06}>
                              {[20, 40, 60, 80].map(r => <Circle key={r} r={r} stroke="#C0C0C0" strokeWidth="0.5" fill="none" />)}
                            </G>
                            {(() => {
                              const pts = nodes.map((n, i) => { const angle = (i * 2 * Math.PI) / (nodes.length || 1) - Math.PI / 2; const r = (parseFloat(getNodeAvg(n)) / 10) * 80; return { x: r * Math.cos(angle), y: r * Math.sin(angle), color: n.color, id: n.id }; });
                              const breathRadius = 9 + nodeBreathValue * 6;
                              return (
                                <>
                                  <G transform={`scale(${radarPulseScale})`}>
                                    <Polygon points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(56, 189, 248, 0.15)" stroke={THEME.accent} strokeWidth="0.9" />
                                  </G>
                                  {pts.map((p, i) => {
                                    const hi = atlasHighlightId === p.id;
                                    const glowR = hi ? breathRadius + 4 : breathRadius;
                                    const glowOpacity = 0.6 + nodeBreathValue * 0.4;
                                    return (
                                      <G key={i} onPress={() => setAtlasHighlightId(prev => prev === p.id ? null : p.id)}>
                                        {/* Outer breathing glow */}
                                        <Circle cx={p.x} cy={p.y} r={glowR} fill={`url(#glow-${p.id})`} opacity={glowOpacity} />
                                        {/* Inner star core */}
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
                            const lineOffset = ni * 22;
                            const pts = arr.map((v, i) => ({ x: trajectoryX(i), y: trajectoryY(v) + lineOffset }));
                            const path = (() => {
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
                            })();
                            const pulseOffset = trajectoryPulseDash[ni] ?? 0;
                            return (
                              <React.Fragment key={nodes[ni].id}>
                                <Path d={path} stroke={nodes[ni].color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
                                <Path d={path} stroke={nodes[ni].color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="28 400" strokeDashoffset={pulseOffset} />
                              </React.Fragment>
                            );
                          })}
                          {(() => {
                            const pts = averageData.map((v, i) => ({ x: trajectoryX(i), y: trajectoryY(v) }));
                            let avgPath = `M ${pts[0].x} ${pts[0].y}`;
                            for (let i = 0; i < pts.length - 1; i++) {
                              const p0 = pts[Math.max(0, i - 1)];
                              const p1 = pts[i];
                              const p2 = pts[i + 1];
                              const p3 = pts[Math.min(pts.length - 1, i + 2)];
                              const c1x = p1.x + (p2.x - p0.x) / 6;
                              const c1y = p1.y + (p2.y - p0.y) / 6;
                              const c2x = p2.x - (p3.x - p1.x) / 6;
                              const c2y = p2.y - (p3.y - p1.y) / 6;
                              avgPath += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
                            }
                            return <Path d={avgPath} stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />;
                          })()}
                          {trajectoryDragX != null && (
                            <>
                              <Line x1={trajectoryDragX} y1={24} x2={trajectoryDragX} y2={24 + TRAJ_CHART_H} stroke="rgba(255,255,255,0.6)" strokeWidth="1" />
                              <Circle cx={trajectoryDragX} cy={trajectoryY(interpolatedAvg(trajectoryDragX))} r={8} fill="#FFFFFF" fillOpacity="0.35" />
                              <Circle cx={trajectoryDragX} cy={trajectoryY(interpolatedAvg(trajectoryDragX))} r={4} fill="#FFFFFF" />
                            </>
                          )}
                          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                            <Line key={i} x1={(i / 6) * 320} y1={182} x2={(i / 6) * 320} y2={196} stroke={THEME.textDim} strokeWidth={0.5} opacity={0.6} />
                          ))}
                        </Svg>
                      </View>
                    </View>
                    <View style={styles.trajectoryPastLogsRow}>
                      <Text style={styles.trajectoryPastLogsLabel}>PAST LOGS</Text>
                    </View>
                  </>
                )}
                {atlasGraphView === 'constellation' && (() => {
                  const ROW_H = 52;
                  const VB_W = 320;
                  const sr = (seed: number) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x); };
                  const completedForNode = (n: any) => (n.goals || []).reduce((acc: number, g: any) => acc + (g.tasks || []).filter((t: any) => t.completed).length, 0);

                  return (
                    <View style={{ width: '100%', marginBottom: 4 }}>
                      {nodes.map((node) => {
                        const seed = (node.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
                        const completed = completedForNode(node);
                        const brightCount = Math.max(2, completed);
                        const dimDots = Array.from({ length: 38 }, (_, i) => ({
                          x: 8 + sr(seed + i * 7.3) * (VB_W - 16),
                          y: 6 + sr(seed + i * 13.7 + 100) * (ROW_H - 14),
                        }));
                        const brightDots = Array.from({ length: brightCount }, (_, i) => ({
                          x: 8 + sr(seed + 2000 + i * 11.1) * (VB_W - 16),
                          y: 6 + sr(seed + 2000 + i * 17.3 + 1) * (ROW_H - 14),
                        }));
                        return (
                          <View key={node.id} style={{ height: ROW_H, width: '100%' }}>
                            <Svg width="100%" height={ROW_H} viewBox={`0 0 ${VB_W} ${ROW_H}`} preserveAspectRatio="xMidYMid meet">
                              {/* Dim star-field dots (node color) */}
                              {dimDots.map((d, i) => (
                                <Circle key={`d-${i}`} cx={d.x} cy={d.y} r={1.2} fill={node.color} fillOpacity={0.32} />
                              ))}
                              {/* Bright dots: glow + core (recently completed tasks) */}
                              {brightDots.map((d, i) => (
                                <React.Fragment key={`b-${i}`}>
                                  <Circle 
                                    cx={d.x} 
                                    cy={d.y} 
                                    r={5} 
                                    fill={node.color} 
                                    fillOpacity={0.4}
                                  />
                                  <Circle 
                                    cx={d.x} 
                                    cy={d.y} 
                                    r={2} 
                                    fill={node.color} 
                                    fillOpacity={constellationPulseOpacityState}
                                  />
                                </React.Fragment>
                              ))}
                              {/* Faint silver separator at bottom of row */}
                              <Line x1={0} y1={ROW_H - 1} x2={VB_W} y2={ROW_H - 1} stroke="#E2E8F0" strokeWidth="0.5" opacity={0.5} />
                            </Svg>
                          </View>
                        );
                      })}
                      <View style={styles.atlasLegend}>
                        {nodes.map((n) => (
                          <View key={n.id} style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: n.color }]} />
                            <Text style={styles.legendLabel}>{n.name.toUpperCase()}</Text>
                            <Text style={styles.legendValue}>{getNodeAvg(n)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
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
          {/* Deflection Monitor: STRUCTURAL DRIFT */}
          {(() => {
            const driftSparkline = [0, 1, 2, 3, 4, 5, 6].map(i => {
              const vals = trajectoryDataPerNode.map(arr => arr[i]);
              return vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
            });
            const stabilizing = driftSparkline[6] < driftSparkline[0];
            const arrowUp = !stabilizing;
            const arrowColor = stabilizing ? '#22D3EE' : '#F59E0B';
            const arrowPath = arrowUp
              ? 'M 12 4 L 4 14 L 10 14 L 10 22 L 14 22 L 14 14 L 20 14 Z'
              : 'M 12 20 L 4 10 L 10 10 L 10 2 L 14 2 L 14 10 L 20 10 Z';
            return (
              <FadingBorder style={{ marginBottom: 12 }}>
              <View style={styles.deflectionCard}>
                <View style={styles.deflectionRow}>
                  <View style={styles.deflectionLeft}>
                    <Text style={styles.deflectionLabel}>STRUCTURAL DRIFT</Text>
                    <Text style={styles.deflectionValue}>{driftDelta === '0' ? '0 PT(S)' : `${driftDelta} PT(S)`}</Text>
                  </View>
                  <View style={styles.deflectionVLine} />
                  <View style={styles.deflectionRight}>
                    <Svg width={32} height={32} viewBox="0 0 24 24">
                      <Path d={arrowPath} fill={arrowColor} />
                    </Svg>
                  </View>
                </View>
              </View>
              </FadingBorder>
            );
          })()}
          {/* Summary card */}
          <FadingBorder style={{ marginBottom: 20 }}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryHeading}>ATLAS GUIDANCE</Text>
            <View style={styles.summarySuggestionSection}>
              <Text style={styles.summarySuggestionLabel}>
                {copilotContent.suggest1.label.split(briefingHighlight.re).filter(Boolean).map((part, i) => {
                  const col = briefingHighlight.wordToColor[part.toUpperCase()];
                  if (col) return <Text key={i} style={{ color: col }}>{part}</Text>;
                  return <Text key={i}>{part}</Text>;
                })}
              </Text>
              <TouchableOpacity style={styles.summarySuggestionBtn} onPress={() => handleSuggestion(copilotContent.suggest1)} activeOpacity={0.8}>
                <Text style={styles.summarySuggestionBtnText}>{suggestionBtnLabel[copilotContent.suggest1.action] || 'GO'}</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.summarySuggestionSection, { marginBottom: 0 }]}>
              <Text style={styles.summarySuggestionLabel}>
                {copilotContent.suggest2.label.split(briefingHighlight.re).filter(Boolean).map((part, i) => {
                  const col = briefingHighlight.wordToColor[part.toUpperCase()];
                  if (col) return <Text key={i} style={{ color: col }}>{part}</Text>;
                  return <Text key={i}>{part}</Text>;
                })}
              </Text>
              <TouchableOpacity style={styles.summarySuggestionBtn} onPress={() => handleSuggestion(copilotContent.suggest2)} activeOpacity={0.8}>
                <Text style={styles.summarySuggestionBtnText}>{suggestionBtnLabel[copilotContent.suggest2.action] || 'GO'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          </FadingBorder>
          </>
          );
        })()}

        {activeTab === 'Nodes' && (
          <View>
            {nodes.map(node => (
              <View key={node.id} style={styles.nodeBlock}>
                <TouchableOpacity onPress={() => setSelectedNodeId(prev => prev === node.id ? null : node.id)} activeOpacity={0.9}>
                  <View style={styles.nodeHeader}>
                    <View style={styles.nodeHeaderLeft}>
                      <View style={[styles.nodeIcon, { backgroundColor: node.color }]}>
                        <Text style={styles.nodeIconLetter}>{node.name[0].toUpperCase()}</Text>
                      </View>
                      <View style={styles.nodeTitleRow}>
                        {selectedNodeId === node.id ? (
                          <TouchableOpacity onPress={(e) => { e.stopPropagation(); setEditingNodeId(node.id); }} activeOpacity={0.8}>
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
                    {node.description && (
                      <>
                        <Text style={styles.coordinatesLabel}>DESIRED INTENT</Text>
                        <Text style={styles.nodeDescriptionText}>{node.description}</Text>
                      </>
                    )}
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
                      const pan = PanResponder.create({ onStartShouldSetPanResponder: () => true, onPanResponderGrant: applySlider, onPanResponderMove: applySlider });
                      return (
                        <View key={goal.id} style={styles.nodeOverlayCoord}>
                          <View style={styles.nodeOverlayCoordTitleRow}>
                            <Text style={styles.goalName}>{goal.name}</Text>
                            <TouchableOpacity onPress={() => setEditingCoordinate({ nodeId: node.id, goalId: goal.id })} activeOpacity={0.8}>
                              <Text style={styles.editCoordBtn}>Edit</Text>
                            </TouchableOpacity>
                          </View>
                          <View style={styles.sliderRow}>
                            <View style={styles.sliderTrack} onLayout={(e) => { trackWidths.current[key] = e.nativeEvent.layout.width; }} {...pan.panHandlers}>
                              <View style={[styles.sliderLine, { backgroundColor: node.color, opacity: 0.3 }]} />
                              <View pointerEvents="none" style={[styles.sliderFill, { width: `${goal.value * 10}%`, backgroundColor: node.color }]} />
                              <View pointerEvents="none" style={[styles.sliderHandle, { left: `${goal.value * 10}%`, marginLeft: -6 }]}><View style={[styles.sliderHandleInner, { backgroundColor: '#38BDF8' }]} /></View>
                            </View>
                            <View style={styles.valueCircle}><Text style={[styles.valueCircleText, { color: node.color }]}>{goal.value}</Text></View>
                          </View>
                        </View>
                      );
                    })}
                    <TouchableOpacity style={styles.addCoordinateBtn} onPress={() => { if (!hasAccess && node.goals.length >= 2) { setSystemAccessGateOpen(true); return; } addCoordinate(node.id); }} activeOpacity={0.7}>
                      <Text style={styles.addCoordinateText}>+ ADD COORDINATE</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
            <TouchableOpacity style={[styles.addCoordinateBtn, { marginTop: 16 }]} onPress={() => { if (!hasAccess) { setSystemAccessGateOpen(true); return; } setAddNodeForm({ name: '', description: '', color: NODE_COLORS[0] }); setAddNodeOpen(true); }} activeOpacity={0.7}>
              <Text style={styles.addCoordinateText}>+ ADD NODE</Text>
            </TouchableOpacity>
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
                    <Text style={styles.taskEmptyStateText}>NO ACTIVE COORDINATE</Text>
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
                          styles.taskCardOuter,
                          pri && styles.taskCardPriority,
                        ]}
                        onPress={() => { setEditForm({ title: task.title, nodeId: task.nodeId, goalId: task.goalId, isPriority: !!(task as any).isPriority, notes: (task as any).notes || '', dueDate: (task as any).dueDate || '', reminder: (task as any).reminder || '' }); setEditingTask({ nodeId: task.nodeId, goalId: task.goalId, taskId: task.id }); }}
                        activeOpacity={0.85}
                      >
                        <BlurView intensity={40} tint="dark" style={styles.taskCard}>
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
                        </BlurView>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ));
            })()}
          </View>
        )}

        {activeTab === 'Profile' && (
          <View>
            <View style={styles.profileCard}>
              <View style={styles.profileSectionHeaderRow}>
                <Svg width={14} height={14} viewBox="0 0 24 24" style={styles.profileSectionIcon}>
                  <Path fill="none" stroke={THEME.textDim} strokeWidth={1.5} strokeLinecap="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <Circle cx="12" cy="7" r="4" fill="none" stroke={THEME.textDim} strokeWidth={1.5} />
                </Svg>
                <Text style={styles.profileSectionLabel}>MODEL SELECTION</Text>
              </View>
              <View style={styles.modelDropdownWrap}>
                <TouchableOpacity style={styles.modelDropdownTrigger} onPress={() => setModelDropdownOpen(v => !v)} activeOpacity={0.8}>
                  <Text style={styles.modelDropdownTriggerText} numberOfLines={1}>{cognitiveModel}</Text>
                  <Svg width={14} height={14} viewBox="0 0 24 24" style={styles.modelDropdownChevron}>
                    <Path fill={THEME.textDim} d="M7 10l5 5 5-5H7z" />
                  </Svg>
                </TouchableOpacity>
                {modelDropdownOpen && (
                  <View style={styles.modelDropdownList}>
                    {(['Architect', 'Strategist', 'Builder', 'Analyst'] as const).map(m => (
                      <TouchableOpacity key={m} style={[styles.modelDropdownItem, cognitiveModel === m && styles.modelDropdownItemActive]} onPress={() => { setCognitiveModel(m); setModelDropdownOpen(false); }} activeOpacity={0.8}>
                        <Text style={[styles.modelDropdownItemText, cognitiveModel === m && styles.modelDropdownItemTextActive]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.modelYouAreBlock}>
                <Text style={styles.modelYouAreLabel}>YOU ARE...</Text>
                <Text style={styles.modelYouAreText}>{MODEL_DESCRIPTIONS[cognitiveModel]}</Text>
              </View>
            </View>
            <View style={styles.profileCard}>
              <View style={styles.profileSectionHeaderRow}>
                <Svg width={14} height={14} viewBox="0 0 24 24" style={styles.profileSectionIcon}>
                  <Circle cx="12" cy="12" r="5" fill="none" stroke={THEME.textDim} strokeWidth={1.5} />
                  <Path fill="none" stroke={THEME.textDim} strokeWidth={1.5} strokeLinecap="round" d="M12 2v2M12 20v2M4 12H2M22 12h-2M6.34 6.34l1.42-1.42M16.24 16.24l1.42-1.42M6.34 17.66l-1.42-1.42M16.24 7.76l-1.42-1.42" />
                </Svg>
                <Text style={styles.profileSectionLabel}>PEAK PERIOD</Text>
              </View>
              <View style={styles.peakPeriodRow}>
                <TouchableOpacity
                  style={[styles.peakBlock, peakPeriod === 'MORNING' && styles.peakBlockActiveMorning]}
                  onPress={() => setPeakPeriod('MORNING')}
                  activeOpacity={0.9}
                >
                  <Svg width={16} height={16} viewBox="0 0 24 24" style={{ marginRight: 8 }}>
                    <Circle cx="12" cy="12" r="5" fill="none" stroke={peakPeriod === 'MORNING' ? '#EAB308' : THEME.textDim} strokeWidth={1.5} />
                    <Path fill="none" stroke={peakPeriod === 'MORNING' ? '#EAB308' : THEME.textDim} strokeWidth={1.5} strokeLinecap="round" d="M12 2v2M12 20v2M4 12H2M22 12h-2M6.34 6.34l1.42-1.42M16.24 16.24l1.42-1.42M6.34 17.66l-1.42-1.42M16.24 7.76l-1.42-1.42" />
                  </Svg>
                  <View>
                    <Text style={[styles.peakBlockTitle, peakPeriod === 'MORNING' && styles.peakBlockTitleActiveMorning]}>MORNING</Text>
                    <Text style={[styles.peakBlockSub, peakPeriod === 'MORNING' && styles.peakBlockSubActiveMorning]}>0600-1200</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.peakBlock, peakPeriod === 'EVENING' && styles.peakBlockActiveEvening]}
                  onPress={() => setPeakPeriod('EVENING')}
                  activeOpacity={0.9}
                >
                  <Svg width={16} height={16} viewBox="0 0 24 24" style={{ marginRight: 8 }}>
                    <Path fill="none" stroke={peakPeriod === 'EVENING' ? '#F97316' : THEME.textDim} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </Svg>
                  <View>
                    <Text style={[styles.peakBlockTitle, peakPeriod === 'EVENING' && styles.peakBlockTitleActiveEvening]}>EVENING</Text>
                    <Text style={[styles.peakBlockSub, peakPeriod === 'EVENING' && styles.peakBlockSubActiveEvening]}>1800-0000</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.profileCard}>
              <View style={[styles.profileSectionHeaderRow, { justifyContent: 'space-between', marginBottom: 12 }]}>
                <View style={styles.profileSectionHeaderRow}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" style={styles.profileSectionIcon}>
                    <Path fill="none" stroke={THEME.textDim} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </Svg>
                  <Text style={styles.profileSectionLabel}>MOTIVATORS</Text>
                </View>
                <Text style={styles.motivatorsCounter}>{motivators.length}/3 SELECTED</Text>
              </View>
              <View style={styles.motivatorsGrid}>
                {MOTIVATOR_OPTIONS.map(m => {
                  const sel = motivators.includes(m);
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[styles.motivatorChip, sel && styles.motivatorChipActive]}
                      onPress={() => {
                        if (sel) setMotivators(prev => prev.filter(x => x !== m));
                        else if (motivators.length < 3) setMotivators(prev => [...prev, m]);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.motivatorChipText, sel && styles.motivatorChipTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <View style={styles.profileCard}>
              <View style={styles.profileSectionHeaderRow}>
                <Svg width={14} height={14} viewBox="0 0 24 24" style={styles.profileSectionIcon}>
                  <Path fill="none" stroke={THEME.textDim} strokeWidth={1.5} strokeLinecap="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                </Svg>
                <Text style={styles.profileSectionLabel}>IDENTITY NOTES</Text>
              </View>
              <TextInput
                style={styles.profileTextArea}
                value={identityNotes}
                onChangeText={setIdentityNotes}
                placeholder="Input analytical context"
                placeholderTextColor={THEME.textDim}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
            <View style={styles.devOverrideSection}>
              <Text style={styles.devOverrideLabel}>DEVELOPER OVERRIDE</Text>
              <View style={styles.devOverrideRow}>
                <Text style={styles.systemAccessTier}>hasAccess</Text>
                <Switch value={hasAccess} onValueChange={(v) => { setHasAccess(v); if (v) setSystemAccessGateOpen(false); }} trackColor={{ false: '#334155', true: THEME.accent }} thumbColor="#E2E8F0" />
              </View>
            </View>
          </View>
        )}
      </ScrollView>
      </View>
      <View style={styles.nav}>
        {['Atlas', 'Nodes', 'Tasks', 'Profile'].map(t => {
          const active = activeTab === t;
          const c = active ? THEME.accent : THEME.textDim;
          return (
            <TouchableOpacity key={t} onPress={() => setActiveTab(t)} style={styles.navBtn}>
              <View style={styles.navIconWrap}>
                {t === 'Atlas' && (
                  <Svg width={28} height={28} viewBox="0 0 1024 1024">
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
                  <Svg width={28} height={28} viewBox="0 0 32 32">
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
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity style={[styles.copilotFab, !hasAccess && styles.copilotFabLocked]} onPress={triggerCopilotTransition} activeOpacity={0.8}>
        <View style={styles.copilotContainer}>
          <Svg width={48} height={48} viewBox="0 0 48 48">
            <Circle cx={24} cy={24} r={10.5} fill={hasAccess ? '#FFFFFF' : '#94A3B8'} />
            <Circle cx={24} cy={24} r={22.5} fill="none" stroke={hasAccess ? '#FFFFFF' : '#94A3B8'} strokeWidth={1} />
            <Circle cx={40} cy={8} r={3.375} fill={hasAccess ? '#FFFFFF' : '#94A3B8'} />
          </Svg>
        </View>
      </TouchableOpacity>
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
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
            <View style={styles.addNodeCard} pointerEvents="auto">
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
      {editingNodeId && (
        <View style={styles.infoOverlay} pointerEvents="box-none">
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => { setEditingNodeId(null); setEditNodeForm({ name: '', description: '', color: NODE_COLORS[0] }); }} activeOpacity={1} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
            <View style={styles.addNodeCard} pointerEvents="auto">
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.editFormLabel}>COLOR</Text>
                <View style={styles.addNodeColorRow}>
                  {NODE_COLORS.map(c => (
                    <TouchableOpacity key={c} onPress={() => setEditNodeForm(f => ({ ...f, color: c }))} activeOpacity={0.8} style={[styles.addNodeSwatch, { backgroundColor: c }, editNodeForm.color === c && styles.addNodeSwatchSelected]} />
                  ))}
                </View>
                <Text style={styles.editFormLabel}>TITLE</Text>
                <TextInput style={styles.editFormInput} value={editNodeForm.name} onChangeText={(t) => setEditNodeForm(f => ({ ...f, name: t }))} placeholder="Node name" placeholderTextColor={THEME.textDim} />
                <Text style={styles.evidenceLabel}>DEFINE THE DESIRED INTENT</Text>
                <TextInput style={[styles.evidenceInput, { marginBottom: 16 }]} value={editNodeForm.description} onChangeText={(t) => setEditNodeForm(f => ({ ...f, description: t }))} placeholder="Intent or purpose…" placeholderTextColor={THEME.textDim} />
                <View style={styles.addTaskActions}>
                  <TouchableOpacity style={styles.addTaskCancel} onPress={() => { setEditingNodeId(null); setEditNodeForm({ name: '', description: '', color: NODE_COLORS[0] }); }} activeOpacity={0.7}>
                    <Text style={styles.addTaskCancelText}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.addTaskSubmit} onPress={() => { if (editNodeForm.name.trim() && editingNodeId) { updateNode(editingNodeId, { name: editNodeForm.name.trim(), description: editNodeForm.description.trim() || '', color: editNodeForm.color }); setEditingNodeId(null); setEditNodeForm({ name: '', description: '', color: NODE_COLORS[0] }); } }} activeOpacity={0.7}>
                    <Text style={styles.addTaskSubmitText}>SAVE</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
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
        const tasks = goal.tasks || [];
        const completedTasks = tasks.filter((t: any) => t.completed);
        return (
          <View style={styles.infoOverlay} pointerEvents="box-none">
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setEditingCoordinate(null)} activeOpacity={1} />
            <View style={[styles.coordinateEditCard, { maxHeight: '85%' }]} pointerEvents="auto">
              <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                <Text style={styles.coordDetailName}>{goal.name}</Text>
                <Text style={styles.coordDetailSubtext}>Reflect on this coordinate and use the slider to evaluate yourself. Add calibrations below to keep you on your path.</Text>
                <Text style={styles.reflectionQuestion}>HOW IS THE INTEGRITY OF THIS COORDINATE?</Text>
                <View style={styles.sliderRow}>
                  <View style={styles.sliderTrack} onLayout={(e) => { trackWidths.current[key] = e.nativeEvent.layout.width; }} {...pan.panHandlers}>
                    <View style={[styles.sliderLine, { backgroundColor: node.color, opacity: 0.3 }]} />
                    <View pointerEvents="none" style={[styles.sliderFill, { width: `${goal.value * 10}%`, backgroundColor: node.color }]} />
                    <View pointerEvents="none" style={[styles.sliderHandle, { left: `${goal.value * 10}%`, marginLeft: -6 }]}><View style={[styles.sliderHandleInner, { backgroundColor: '#38BDF8' }]} /></View>
                  </View>
                  <View style={styles.valueCircle}><Text style={[styles.valueCircleText, { color: node.color }]}>{goal.value}</Text></View>
                </View>
                <Text style={styles.calibrationFeedLabel}>CALIBRATIONS</Text>
                {tasks.length === 0 ? (
                  <Text style={[styles.evidencePreview, { marginBottom: 8 }]}>No calibrations yet</Text>
                ) : (
                  tasks.map((t: any) => (
                    <TouchableOpacity
                      key={t.id}
                      style={styles.coordEditTaskRow}
                      onPress={() => { setEditForm({ title: t.title, nodeId: node.id, goalId: goal.id, isPriority: !!(t.isPriority), notes: t.notes || '', dueDate: t.dueDate || '', reminder: t.reminder || '' }); setEditingTask({ nodeId: node.id, goalId: goal.id, taskId: t.id }); setEditingCoordinate(null); }}
                      activeOpacity={0.8}
                    >
                      <TouchableOpacity onPress={() => toggleTask(node.id, goal.id, t.id)} style={{ padding: 4 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Svg width={20} height={20} viewBox="0 0 24 24">
                          {t.completed ? (
                            <><Circle cx="12" cy="12" r="10" fill={node.color} /><Path d="M7 12l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></>
                          ) : (
                            <Circle cx="12" cy="12" r="10" fill="none" stroke={THEME.textDim} strokeWidth="1.5" />
                          )}
                        </Svg>
                      </TouchableOpacity>
                      <Text style={[styles.coordEditTaskTitle, t.completed && styles.taskTitleStrike, t.completed && { opacity: 0.8 }]} numberOfLines={1}>{t.title}</Text>
                    </TouchableOpacity>
                  ))
                )}
                <TouchableOpacity style={styles.addCoordinateBtn} onPress={() => { addTask(node.id, goal.id, 'New Task'); }} activeOpacity={0.7}>
                  <Text style={styles.addCoordinateText}>+ ADD TASK</Text>
                </TouchableOpacity>
              </ScrollView>
              <TouchableOpacity style={[styles.coordEditDoneBtn, { alignSelf: 'flex-end', marginTop: 8 }]} onPress={() => setEditingCoordinate(null)} activeOpacity={0.7}>
                <Text style={styles.coordEditDoneText}>DONE</Text>
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
      {/* Copilot Transition Animation */}
      {copilotTransition && (() => {
        const orbitRadius = 26;
        const angleRad = (copilotOrbitAngle - 45) * (Math.PI / 180);
        const planetX = 30 + orbitRadius * Math.cos(angleRad);
        const planetY = 30 + orbitRadius * Math.sin(angleRad);
        return (
          <View style={styles.copilotTransitionOverlay}>
            {/* Sunburst flash */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: '#FFFFFF',
                  opacity: copilotSunburstAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.85],
                  }),
                },
              ]}
            />
            {/* Center icon with orbiting planet */}
            <View style={styles.copilotTransitionCenter}>
              <Animated.View style={{ transform: [{ scale: copilotScaleAnim }] }}>
                <Svg width={60} height={60} viewBox="0 0 60 60">
                  {/* Orbit ring */}
                  <Circle cx={30} cy={30} r={orbitRadius} fill="none" stroke="#FFFFFF" strokeWidth={1} opacity={0.5} />
                  {/* Sun glow */}
                  <Circle cx={30} cy={30} r={16} fill="#38BDF8" opacity={0.25} />
                  <Circle cx={30} cy={30} r={13} fill="#38BDF8" opacity={0.4} />
                  {/* Sun core */}
                  <Circle cx={30} cy={30} r={10} fill="#FFFFFF" />
                  {/* Orbiting planet */}
                  <Circle cx={planetX} cy={planetY} r={4} fill="#FFFFFF" />
                </Svg>
              </Animated.View>
            </View>
          </View>
        );
      })()}
      <Modal visible={copilotOpen} animationType="fade" transparent>
        <View style={styles.copilotOverlay} pointerEvents="box-none">
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setCopilotOpen(false)} activeOpacity={1} />
          <FadingBorder style={{ maxWidth: 400, width: '100%' }}>
          <View style={styles.copilotCard} pointerEvents="auto">
            <View style={styles.copilotCardHeader}>
              <Text style={styles.copilotTitle}>CO-PILOT // V1.0</Text>
              <TouchableOpacity onPress={() => setCopilotOpen(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7}>
                <Text style={styles.copilotCloseX}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.copilotHeading, { marginTop: 0 }]}>BRIEFING</Text>
            {copilotContent.briefingLines.map((line, lineIdx) => {
              const parts = line.text.split(briefingHighlight.re).filter(Boolean);
              return (
                <View key={lineIdx} style={styles.copilotBriefingLine}>
                  <Text style={styles.copilotBriefingPrefix}>{line.prefix} </Text>
                  <Text style={styles.copilotBriefingBody}>
                    {parts.map((part, i) => {
                      if (/^\d+\.?\d*$/.test(part)) {
                        return <Text key={i} style={styles.copilotBriefingNum}>{part}</Text>;
                      }
                      const col = briefingHighlight.wordToColor[part.toUpperCase()];
                      if (col) {
                        return <Text key={i} style={{ color: col }}>{part}</Text>;
                      }
                      return <Text key={i}>{part}</Text>;
                    })}
                  </Text>
                </View>
              );
            })}
            <Text style={styles.copilotHeading}>SUGGESTIONS</Text>
            <TouchableOpacity style={styles.copilotSuggestionBtn} onPress={() => { setCopilotOpen(false); handleSuggestion(copilotContent.suggest1); }} activeOpacity={0.8}>
              <Text style={styles.copilotSuggestionBtnText}>
                {copilotContent.suggest1.label.split(briefingHighlight.re).filter(Boolean).map((part, i) => {
                  const col = briefingHighlight.wordToColor[part.toUpperCase()];
                  if (col) return <Text key={i} style={{ color: col }}>{part}</Text>;
                  return <Text key={i}>{part}</Text>;
                })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.copilotSuggestionBtn} onPress={() => { setCopilotOpen(false); handleSuggestion(copilotContent.suggest2); }} activeOpacity={0.8}>
              <Text style={styles.copilotSuggestionBtnText}>
                {copilotContent.suggest2.label.split(briefingHighlight.re).filter(Boolean).map((part, i) => {
                  const col = briefingHighlight.wordToColor[part.toUpperCase()];
                  if (col) return <Text key={i} style={{ color: col }}>{part}</Text>;
                  return <Text key={i}>{part}</Text>;
                })}
              </Text>
            </TouchableOpacity>
          </View>
          </FadingBorder>
        </View>
      </Modal>
      <Modal visible={systemAccessGateOpen} animationType="fade" transparent>
        <View style={styles.systemAccessOverlay} pointerEvents="box-none">
          <View style={styles.systemAccessCard} pointerEvents="auto">
            <Text style={styles.systemAccessTitle}>SYSTEM ACCESS CLEARANCE</Text>
            <Text style={styles.systemAccessFeature}>• AI CO-PILOT SUPPORT</Text>
            <Text style={styles.systemAccessFeature}>• UNLIMITED CUSTOM NODES</Text>
            <Text style={styles.systemAccessFeature}>• UNLIMITED COORDINATES PER NODE</Text>
            <View style={styles.systemAccessTiers}>
              <Text style={styles.systemAccessTier}>BASIC (FREE)</Text>
              <Text style={styles.systemAccessTier}>UNRESTRICTED ($9.99/MO)</Text>
            </View>
            <TouchableOpacity style={styles.systemAccessBtnPrimary} onPress={() => { setHasAccess(true); setSystemAccessGateOpen(false); }} activeOpacity={0.8}>
              <Text style={styles.systemAccessBtnText}>UPGRADE — $9.99/MO</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.systemAccessBtnSecondary} onPress={() => setSystemAccessGateOpen(false)} activeOpacity={0.8}>
              <Text style={styles.systemAccessBtnText}>DISMISS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg }, scrollContent: { padding: 20, paddingBottom: 124 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30 }, headerLeft: { flex: 1 }, headerTitle: { color: 'white', fontSize: 32, fontWeight: '200', letterSpacing: 6 }, headerSubtitle: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 2 }, headerInfoBtn: { padding: 4 },
  infoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(15, 23, 42, 0.85)' }, infoCard: { backgroundColor: THEME.card,  borderRadius: 12, padding: 20, maxWidth: 400, maxHeight: '80%', width: '100%', shadowColor: THEME.glowPop, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 }, infoScroll: { maxHeight: 320 }, infoTitle: { color: THEME.accent, fontSize: 14, fontWeight: '800', letterSpacing: 3, marginBottom: 12 }, infoText: { color: THEME.border, fontSize: 14, lineHeight: 20, fontWeight: '400' }, infoDoneBtn: { marginTop: 16, alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: THEME.accent, borderRadius: 12 }, infoDoneText: { color: THEME.accent, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  center: { alignItems: 'center' },
  atlasCard: { backgroundColor: THEME.card, borderRadius: 12, padding: 20, marginBottom: 20, overflow: 'hidden', position: 'relative', shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 }, atlasCardContent: { alignItems: 'stretch', zIndex: 1 },
  atlasCardHeader: { backgroundColor: 'rgba(0,0,0,0.35)', marginHorizontal: -20, marginTop: -20, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: THEME.cardBorder }, atlasCardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, atlasScoreBlock: { alignSelf: 'flex-start' },
  atlasViewSwitcher: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignSelf: 'flex-end' }, atlasViewTab: { paddingVertical: 4, paddingHorizontal: 6, marginLeft: 4, borderWidth: 1, borderColor: 'transparent' }, atlasViewTabActive: { borderColor: THEME.accent }, atlasViewTabText: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 1 }, atlasViewTabTextActive: { color: THEME.accent }, bigScore: { color: 'white', fontSize: 64, fontWeight: '100' }, statLabel: { color: THEME.accent, fontSize: 14, fontWeight: '900', letterSpacing: 4, marginTop: 4 },
  atlasStarfieldContainer: { position: 'relative', overflow: 'hidden', minHeight: 240 }, starfieldSvg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  radarWrapper: { height: 240, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }, radarRotWrap: { height: 240, width: 240 }, atlasLegend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', width: '100%', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }, legendItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, marginRight: 12, marginBottom: 6, borderRadius: 6 },
  trajectoryPastLogsRow: { paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }, trajectoryPastLogsLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2 }, constellationTrajectoryLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2, marginTop: 10, marginBottom: 4 }, legendItemHighlight: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }, legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 }, legendLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 1, marginRight: 6 }, legendLabelHighlight: { color: THEME.accent }, legendValue: { color: 'white', fontSize: 14, fontWeight: '300' },
  nodeBlock: { backgroundColor: THEME.card, marginBottom: 12, borderRadius: 12, overflow: 'hidden', shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 }, nodeOverlayCoord: { marginBottom: 20, borderRadius: 12, padding: 12, backgroundColor: 'rgba(255,255,255,0.05)' }, nodeOverlayCoordTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, editCoordBtn: { color: THEME.accent, fontSize: 14, fontWeight: '700', letterSpacing: 1 },   nodeHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 30, alignItems: 'center', paddingHorizontal: 20 }, nodeHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  nodeIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' }, nodeIconLetter: { color: 'white', fontSize: 18, fontWeight: '700' }, nodeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nodeTitle: { fontSize: 28, fontWeight: '200', letterSpacing: 8 }, calibrationLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '700', marginTop: 4, letterSpacing: 4 }, nodeDirective: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 5, marginTop: 4, textTransform: 'uppercase' }, nodeDescriptionText: { color: 'white', fontSize: 14, fontWeight: '400', marginBottom: 16, lineHeight: 20 },
  nodeScore: { color: 'white', fontSize: 24, fontWeight: '200' }, nodeExpanded: { paddingBottom: 30, paddingHorizontal: 20 }, divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 25 }, nodeEditButtonRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 16 }, nodeEditButton: { alignSelf: 'flex-end' }, coordinatesLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 3, marginBottom: 16, textTransform: 'uppercase' }, addCoordinateBtn: { marginTop: 8, paddingVertical: 12, alignItems: 'center',  borderRadius: 4 }, addCoordinateText: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingVertical: 8 }, backText: { color: THEME.accent, fontSize: 14, fontWeight: '600', letterSpacing: 2 },
  goalBlock: { backgroundColor: THEME.card, padding: 16, marginBottom: 12, borderRadius: 12 }, goalItem: { marginBottom: 30 }, goalName: { color: 'white', fontSize: 14, fontWeight: '600' }, goalVal: { fontWeight: '900' }, goalValueRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 }, goalValueBadge: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 10 }, goalValueText: { fontSize: 16, fontWeight: '700' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }, sliderTrack: { flex: 1, height: 24, justifyContent: 'center' }, sliderLine: { height: 2, width: '100%', backgroundColor: 'rgba(255,255,255,0.1)' }, sliderFill: { position: 'absolute', left: 0, top: 11, height: 2, opacity: 0.6 }, sliderHandle: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: 'transparent', borderWidth: 2, borderColor: '#38BDF8', top: 6, justifyContent: 'center', alignItems: 'center', shadowColor: '#38BDF8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 }, sliderHandleInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.card },
  valueCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: THEME.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' }, valueCircleText: { fontSize: 22, fontWeight: '200' },
  taskFilterBar: { marginBottom: 16, marginHorizontal: -20 }, taskFilterBarContent: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }, taskFilterOption: { paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: 'transparent', marginRight: 8 }, taskFilterOptionActive: { borderColor: '#E2E8F0' }, taskFilterText: { color: '#64748B', fontSize: 14, fontWeight: '700', letterSpacing: 2 }, taskFilterTextActive: { color: 'white' },
  addTaskBtn: { marginBottom: 16, paddingVertical: 12, alignItems: 'center',  borderRadius: 12 }, addTaskBtnText: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  addTaskForm: { marginBottom: 16, padding: 16, backgroundColor: THEME.card, borderRadius: 12, shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 }, addTaskFormLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }, addTaskNodeRow: { flexDirection: 'row', marginBottom: 16 }, addTaskNodeBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, alignItems: 'center' }, addTaskNodeBtnText: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 1 }, addTaskDropdownWrap: { marginBottom: 16 }, addTaskDropdownTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 4 }, addTaskDropdownTriggerText: { color: THEME.border, fontSize: 14, flex: 1 }, addTaskDropdownChevron: { marginLeft: 8 }, addTaskDropdownList: { marginTop: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, overflow: 'hidden' }, addTaskDropdownItem: { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }, addTaskDropdownItemActive: { backgroundColor: 'rgba(255,255,255,0.06)' }, addTaskCoordRow: { marginBottom: 16 }, addTaskCoordContent: { flexDirection: 'row', paddingRight: 20 }, addTaskCoordChip: { paddingVertical: 8, paddingHorizontal: 12, marginRight: 8, borderWidth: 1, borderRadius: 4 }, addTaskCoordChipActive: {}, addTaskCoordChipText: { color: THEME.textDim, fontSize: 14, fontWeight: '600' }, addTaskInput: { color: 'white', fontSize: 14, paddingVertical: 10, paddingHorizontal: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', marginBottom: 16 }, addTaskActions: { flexDirection: 'row', justifyContent: 'flex-end' }, addTaskCancel: { paddingVertical: 8, paddingHorizontal: 16, marginRight: 12 }, addTaskCancelText: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2 }, addTaskSubmit: { paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: THEME.accent, borderRadius: 12 }, addTaskSubmitText: { color: THEME.accent, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  taskCoordSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 }, taskCoordSeparatorLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' }, taskCoordSeparatorLabel: { fontSize: 14, color: '#E2E8F0', letterSpacing: 3, fontWeight: '600', marginHorizontal: 10 },
  taskCardOuter: { marginBottom: 12, borderRadius: 12, overflow: 'hidden', shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 }, taskCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, backgroundColor: 'rgba(30, 41, 59, 0.7)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(226, 232, 240, 0.15)' }, taskCardPriority: { shadowColor: '#38BDF8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 10 }, taskCardCompleted: { opacity: 0.5 }, taskIndicator: { width: 4, height: 24, marginRight: 20 }, taskCardBody: { flex: 1, flexDirection: 'column' }, taskRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, taskFocusBtn: { padding: 4, marginRight: 10 }, taskTitleBlock: { flex: 1 }, taskRightBlock: { flexDirection: 'row', alignItems: 'center' }, taskCheck: {}, taskPriorityLabel: { fontSize: 14, fontWeight: '700', color: THEME.accent, letterSpacing: 1, marginRight: 8 },
  taskTitle: { color: 'white', fontSize: 14 }, taskTitleStrike: { textDecorationLine: 'line-through' }, taskGoal: { color: THEME.textDim, fontSize: 14, fontWeight: '800', marginTop: 4 },
  taskEmptyState: { borderWidth: 1, borderColor: 'rgba(226,232,240,0.5)', borderStyle: 'dashed', borderRadius: 12, padding: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, taskEmptyStateText: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  taskEditCard: { backgroundColor: THEME.card, borderRadius: 12, padding: 20, maxWidth: 400, maxHeight: '85%', width: '100%', shadowColor: THEME.glowPop, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 }, taskEditScroll: { maxHeight: 380 }, taskEditChipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }, taskEditFocusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingVertical: 8 }, taskEditNotes: { color: THEME.border, fontSize: 14, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, minHeight: 72, textAlignVertical: 'top', marginBottom: 16 },
  addNodeCard: { backgroundColor: THEME.card, borderRadius: 12, padding: 20, maxWidth: 400, width: '100%', shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 }, addNodeColorRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 }, addNodeSwatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent', marginRight: 10, marginBottom: 10 }, addNodeSwatchSelected: { borderColor: '#E2E8F0' },
  profileCard: { backgroundColor: THEME.card, marginBottom: 18, borderRadius: 12, overflow: 'hidden', padding: 24, shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 }, profileSectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 }, profileSectionIcon: { marginRight: 8 }, profileSectionLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 2 }, motivatorsCounter: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 1 }, motivatorsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, motivatorChip: { paddingVertical: 10, paddingHorizontal: 14,  borderRadius: 12, width: '31%' }, motivatorChipActive: { borderColor: '#22C55E', backgroundColor: 'rgba(34, 197, 94, 0.15)' }, motivatorChipText: { color: THEME.textDim, fontSize: 14, fontWeight: '600' }, motivatorChipTextActive: { color: '#22C55E', fontWeight: '700' }, modelDropdownWrap: { marginTop: 4 }, modelDropdownTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: THEME.border, borderRadius: 4 }, modelDropdownTriggerText: { color: THEME.border, fontSize: 14, flex: 1 }, modelDropdownChevron: { marginLeft: 8 }, modelDropdownList: { marginTop: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, overflow: 'hidden' }, modelDropdownItem: { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }, modelDropdownItemActive: { backgroundColor: 'rgba(255,255,255,0.06)' }, modelDropdownItemText: { color: THEME.textDim, fontSize: 14, fontWeight: '600' }, modelDropdownItemTextActive: { color: THEME.accent, fontWeight: '700' }, modelYouAreBlock: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }, modelYouAreLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 2, marginBottom: 6 }, modelYouAreText: { color: THEME.border, fontSize: 14, lineHeight: 20, fontWeight: '400' }, profileChipScroll: {}, profileChipRow: { flexDirection: 'row', gap: 10, paddingRight: 30, marginBottom: 8 }, profileChip: { paddingVertical: 10, paddingHorizontal: 16,  borderRadius: 4 }, profileChipActive: { borderColor: THEME.accent, backgroundColor: 'rgba(56, 189, 248, 0.1)' }, profileChipText: { color: THEME.textDim, fontSize: 14 }, profileChipTextActive: { color: THEME.accent, fontWeight: '700' }, peakPeriodRow: { flexDirection: 'row', gap: 12 }, peakBlock: { flex: 1, flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 12,  borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, peakBlockActive: { borderWidth: 2, borderColor: THEME.accent, shadowColor: THEME.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 10 }, peakBlockActiveMorning: { borderWidth: 2, borderColor: '#EAB308', backgroundColor: 'rgba(234, 179, 8, 0.12)', shadowColor: '#EAB308', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10 }, peakBlockActiveEvening: { borderWidth: 2, borderColor: '#F97316', backgroundColor: 'rgba(249, 115, 22, 0.12)', shadowColor: '#F97316', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10 }, peakBlockTitle: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 2 }, peakBlockTitleActive: { color: THEME.accent }, peakBlockTitleActiveMorning: { color: '#EAB308' }, peakBlockTitleActiveEvening: { color: '#F97316' }, peakBlockSub: { color: THEME.textDim, fontSize: 14, fontWeight: '600', letterSpacing: 1, marginTop: 4 }, peakBlockSubActive: { color: 'rgba(56, 189, 248, 0.9)' }, peakBlockSubActiveMorning: { color: 'rgba(234, 179, 8, 0.95)' }, peakBlockSubActiveEvening: { color: 'rgba(249, 115, 22, 0.95)' }, profileTextArea: { borderWidth: 1, borderColor: THEME.border, borderRadius: 4, color: 'white', fontSize: 14, padding: 12, minHeight: 100, textAlignVertical: 'top' }, sectionLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '800', marginBottom: 20 }, pillContainer: { flexDirection: 'row', gap: 10 }, pill: { paddingVertical: 10, paddingHorizontal: 20,  borderRadius: 12 }, pillActive: { borderColor: THEME.accent, backgroundColor: 'rgba(56, 189, 248, 0.1)' }, pillText: { color: THEME.textDim, fontSize: 14 }, pillTextActive: { color: THEME.accent, fontWeight: '700' },
  coordinateEditForm: { paddingVertical: 8 }, coordinateEditCard: { backgroundColor: THEME.card,  borderRadius: 12, padding: 20, maxWidth: 400, width: '100%', shadowColor: THEME.glowPop, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 }, coordDetailName: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }, coordDetailSubtext: { color: THEME.textDim, fontSize: 13, lineHeight: 18, marginBottom: 20 }, reflectionQuestion: { color: '#E2E8F0', fontSize: 15, fontWeight: '700', letterSpacing: 2, marginBottom: 20, textAlign: 'center', lineHeight: 22 }, reflectionSliderRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 }, reflectionSliderTrack: { flex: 1, height: 32, justifyContent: 'center' }, reflectionSliderLine: { height: Platform.OS === 'ios' ? 0.5 : 1, width: '100%', backgroundColor: '#C0C0C0' }, reflectionSliderFill: { position: 'absolute', left: 0, top: 15.5, height: Platform.OS === 'ios' ? 0.5 : 1, backgroundColor: '#94A3B8' }, reflectionSliderHandle: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: '#E2E8F0', borderWidth: 1, borderColor: '#94A3B8', top: 6, justifyContent: 'center', alignItems: 'center' }, reflectionSliderHandleInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#64748B' }, reflectionValueCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: '#C0C0C0', justifyContent: 'center', alignItems: 'center' }, reflectionValueText: { fontSize: 28, fontWeight: '200', color: '#E2E8F0' }, calibrationFeedLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase' }, coordEditSliderHandle: { borderColor: '#7DD3FC', borderWidth: 2.5, shadowColor: '#7DD3FC' }, coordEditNameInput: { color: '#475569', fontSize: 16, fontWeight: '500', paddingVertical: 12, paddingHorizontal: 0, marginBottom: 20 }, coordEditEvidenceInput: { color: '#475569', fontSize: 14, fontWeight: '700', letterSpacing: 2, paddingVertical: 8, paddingHorizontal: 0, marginBottom: 16 }, coordEditSliderTrack: { flex: 1, height: 16, justifyContent: 'center' }, coordEditSliderLine: { height: 1, width: '100%', backgroundColor: '#475569' }, coordEditSliderFill: { position: 'absolute', left: 0, top: 7.5, height: 1, backgroundColor: '#475569' }, coordEditDoneBtn: { paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: '#475569', borderRadius: 12 }, coordEditDoneText: { color: '#475569', fontSize: 14, fontWeight: '700', letterSpacing: 2 }, coordEditAddTaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 8 }, coordEditAddTaskInput: { flex: 1, color: '#475569', fontSize: 14, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#475569', borderRadius: 12 }, coordEditAddTaskBtn: { paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12 }, coordEditTaskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)' }, coordEditTaskTitle: { color: 'white', fontSize: 14, flex: 1, marginLeft: 10 }, editFormLabel: { color: 'white', fontSize: 14, fontWeight: '800', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }, editFormInput: { color: 'white', fontSize: 16, fontWeight: '500', paddingVertical: 12, paddingHorizontal: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', marginBottom: 20 },
  evidenceLabel: { color: 'white', fontSize: 14, fontWeight: '700', letterSpacing: 2, marginTop: 14, marginBottom: 6 },
  evidenceInput: { color: THEME.border, fontSize: 14, fontWeight: '700', letterSpacing: 2, paddingVertical: 8, paddingHorizontal: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)' }, evidencePreview: { color: THEME.textDim, fontSize: 14, letterSpacing: 1 },
  nav: { flexDirection: 'row', height: 100, borderTopWidth: 1, borderTopColor: THEME.cardBorder, backgroundColor: THEME.card, position: 'absolute', bottom: 0, width: '100%', overflow: 'hidden', paddingHorizontal: 16 }, navBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }, navIconWrap: {},
  copilotFab: { position: 'absolute', bottom: 120, right: 20, width: 48, height: 48, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center', overflow: 'visible' }, copilotFabLocked: { opacity: 0.5 },
  copilotContainer: { width: 48, height: 48, backgroundColor: 'transparent', overflow: 'visible', position: 'relative', justifyContent: 'center', alignItems: 'center' },
  copilotTransitionOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.95)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  copilotTransitionCenter: { justifyContent: 'center', alignItems: 'center' },
  copilotOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(15, 23, 42, 0.85)' }, copilotCard: { backgroundColor: 'rgba(30, 41, 59, 0.9)', borderRadius: 12, padding: 20, shadowColor: '#38BDF8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 25 }, copilotCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, copilotTitle: { color: THEME.accent, fontSize: 14, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' }, copilotCloseX: { color: THEME.border, fontSize: 16, fontWeight: '600' }, copilotHeading: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', marginTop: 12, marginBottom: 8 }, copilotBriefingLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 8 }, copilotBriefingPrefix: { fontWeight: '700', color: '#94A3B8', fontSize: 14, letterSpacing: 2 }, copilotBriefingBody: { flex: 1, color: THEME.border, fontSize: 14, letterSpacing: 2, lineHeight: 18 }, copilotBriefingNum: { fontWeight: '700', color: '#FFFFFF' }, copilotSuggestionBtn: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, alignItems: 'center' }, copilotSuggestionBtnText: { color: THEME.border, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  systemAccessOverlay: { flex: 1, backgroundColor: 'rgba(21,34,56,0.96)', justifyContent: 'center', alignItems: 'center', padding: 24 }, systemAccessCard: { backgroundColor: THEME.card,  borderRadius: 12, padding: 24, maxWidth: 360, width: '100%', shadowColor: THEME.glowPop, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 }, systemAccessTitle: { color: '#E2E8F0', fontSize: 14, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' }, systemAccessFeature: { color: THEME.border, fontSize: 14, fontWeight: '600', letterSpacing: 1, marginTop: 6 }, systemAccessTiers: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(226,232,240,0.3)' }, systemAccessTier: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2 }, systemAccessBtnPrimary: { marginTop: 20, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, alignItems: 'center' }, systemAccessBtnSecondary: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, alignItems: 'center' }, systemAccessBtnText: { color: '#E2E8F0', fontSize: 14, fontWeight: '700', letterSpacing: 2 }, devOverrideSection: { marginTop: 24, padding: 16, borderWidth: 0.5, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 12 }, devOverrideLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 3, marginBottom: 10 }, devOverrideRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  systemBriefingStatusOpt: { color: '#22C55E' }, systemBriefingStatusNom: { color: '#E2E8F0' }, systemBriefingStatusCrit: { color: '#FB7185' },
  systemManifestCard: { backgroundColor: THEME.card, borderRadius: 12, padding: 20, marginBottom: 12, overflow: 'hidden', shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 },
  systemManifestPrimaryRow: { flexDirection: 'row', alignItems: 'stretch' },
  systemManifestLeft: { flex: 1, justifyContent: 'center' },
  systemManifestBracketLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  systemManifestBracketWrap: { flexDirection: 'row', alignItems: 'baseline' },
  systemManifestBracket: { color: 'rgba(226,232,240,0.6)', fontSize: 18, fontWeight: '300' },
  systemManifestBracketValue: { color: 'white', fontSize: 32, fontWeight: '200', letterSpacing: 2 },
  systemManifestVLine: { width: 0.5, backgroundColor: 'rgba(226,232,240,0.5)', marginHorizontal: 16 },
  systemManifestStatusBlock: { alignItems: 'flex-end', justifyContent: 'center', paddingLeft: 8 },
  systemManifestStatusBadge: { fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  deflectionCard: { backgroundColor: THEME.card, borderRadius: 12, padding: 20, overflow: 'hidden', shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 },
  deflectionRow: { flexDirection: 'row', alignItems: 'stretch' },
  deflectionLeft: { flex: 1, justifyContent: 'center' },
  deflectionLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  deflectionValue: { color: 'white', fontSize: 28, fontWeight: '200', letterSpacing: 2 },
  deflectionVLine: { width: 0.5, backgroundColor: 'rgba(226,232,240,0.5)', marginHorizontal: 16 },
  deflectionRight: { alignItems: 'center', justifyContent: 'center', paddingLeft: 8 },
  summaryCard: { backgroundColor: THEME.card, borderRadius: 12, padding: 20, overflow: 'hidden', shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 },
  summaryHeading: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4, marginBottom: 18 },
  summarySuggestionSection: { borderWidth: 1, borderColor: THEME.cardBorder, borderRadius: 10, padding: 14, marginBottom: 12 },
  summarySuggestionLabel: { color: THEME.border, fontSize: 14, fontWeight: '600', letterSpacing: 1, marginBottom: 14 },
  summarySuggestionBtn: { paddingVertical: 10, paddingHorizontal: 16,  borderRadius: 12, alignSelf: 'flex-start' },
  summarySuggestionBtnText: { color: THEME.accent, fontSize: 14, fontWeight: '700', letterSpacing: 2 }
});