import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  SafeAreaView, StatusBar, Dimensions, PanResponder, Modal,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import Svg, { Circle, Path, G, Line } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './lib/supabase';
import { useAppStore } from './src/stores/useAppStore';
import { FadingBorder } from './src/components/FadingBorder';
import { CopilotCard, LastCycleData, NodeBubble, CoordinateDot } from './src/components/CopilotCard';
import { fetchCopilot, CopilotPayload, CopilotAction, TAB_CONFIG } from './src/services/aiService';
import { THEME, NODE_COLORS, INFO_TEXTS } from './src/constants/theme';
import { AtlasScreen } from './src/screens/AtlasScreen';
import { NodesScreen } from './src/screens/NodesScreen';
import { ActionsScreen } from './src/screens/ActionsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { OrbitalValueBadge } from './src/components/OrbitalValueBadge';
import { BlobBackground } from './src/components/BlobBackground';
import { useTheme } from './src/hooks/useTheme';

const ONBOARDING_KEY = 'calibra_onboarding_complete';
const { width } = Dimensions.get('window');


export default function App() {
  // — navigation & selection state —
  const [activeTab, setActiveTab] = useState('Atlas');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // — modal / overlay state —
  const [editingCoordinate, setEditingCoordinate] = useState<{ nodeId: string; goalId: string } | null>(null);
  const [addActionOpen, setAddActionOpen] = useState(false);
  const [addActionTarget, setAddActionTarget] = useState<{ nodeId: string; goalId: string } | null>(null);
  const [editingAction, setEditingAction] = useState<{ nodeId: string; goalId: string; actionId: string } | null>(null);
  const [editForm, setEditForm] = useState({ title: '', nodeId: '', goalId: '', isPriority: false, notes: '', dueDate: '', reminder: '' });
  const [editFormEffort, setEditFormEffort] = useState<'easy' | 'medium' | 'heavy'>('easy');
  const [nodeDropdownOpen, setNodeDropdownOpen] = useState(false);
  const [coordDropdownOpen, setCoordDropdownOpen] = useState(false);
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [addNodeForm, setAddNodeForm] = useState({ name: '', description: '', color: NODE_COLORS[0] });
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editNodeForm, setEditNodeForm] = useState({ name: '', description: '', color: NODE_COLORS[0] });
  const [infoOpen, setInfoOpen] = useState(false);
  const [systemAccessGateOpen, setSystemAccessGateOpen] = useState(false);

  // — copilot animation state —
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotTransition, setCopilotTransition] = useState(false);

  // — AI copilot state (null = not fetched, 'loading' = in-flight, object = ready) —
  const [aiCopilot, setAiCopilot] = useState<null | 'loading' | CopilotPayload>(null);

  // — last cycle tracking — snapshot taken when user acts on a copilot action —
  const [lastCycleAction, setLastCycleAction] = useState<LastCycleData | null>(null);
  const [copilotOrbitAngle, setCopilotOrbitAngle] = useState(0);
  const copilotOrbitAnim = useRef(new Animated.Value(0)).current;
  const copilotSunburstAnim = useRef(new Animated.Value(0)).current;
  const copilotScaleAnim = useRef(new Animated.Value(1)).current;

  // — auth modal state —
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp'>('signIn');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // — slider track widths for coordinate edit modal —
  const trackWidths = useRef<Record<string, number>>({});

  // — onboarding state —
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // — store —
  const {
    nodes, hasAccess, session,
    cognitiveModel, persona,
    updateValue, updateNode, updateGoal, addNode: storeAddNode, saveActionEdit,
    toggleAction, getNodeAvg, deleteAction, archiveAction,
    archiveNode, deleteNode, archiveGoal, deleteGoal,
    setSession, loadUserData,
    setCognitiveModel,
  } = useAppStore();

  // — active theme tokens —
  const theme = useTheme();
  const isDark = theme.glassBlurTint === 'dark';

  // — sync edit node form when editingNodeId changes —
  useEffect(() => {
    if (editingNodeId) {
      const node = nodes.find(n => n.id === editingNodeId);
      if (node) setEditNodeForm({ name: node.name, description: node.description || '', color: node.color });
    }
  }, [editingNodeId, nodes]);

  // — onboarding bootstrap — check AsyncStorage on mount —
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      setShowOnboarding(val !== 'true');
      setOnboardingReady(true);
    }).catch(() => {
      setShowOnboarding(false);
      setOnboardingReady(true);
    });
  }, []);

  const handleOnboardingComplete = useCallback(async (data: {
    nodeUpdates: { id: string; name: string; description: string }[];
    scores: { nodeId: string; goalId: string; value: number }[];
    cognitiveModel: import('./src/types').CognitiveModel;
  }) => {
    // Apply node renames
    data.nodeUpdates.forEach(u => updateNode(u.id, { name: u.name, description: u.description }));
    // Apply calibration scores
    data.scores.forEach(s => updateValue(s.nodeId, s.goalId, s.value));
    // Apply profile
    setCognitiveModel(data.cognitiveModel);
    // Mark onboarding done
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
  }, [updateNode, updateValue, setCognitiveModel]);

  // — supabase auth listener + header subtitle —
  useEffect(() => {
    let mounted = true;

    // Bootstrap: hydrate session from storage
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) loadUserData();
    }).catch(() => {});

    // Live auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession) loadUserData();
      if (!newSession) setAuthOpen(false);
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  // — copilot transition —
  const triggerCopilotTransition = useCallback(() => {
    if (!hasAccess) { setSystemAccessGateOpen(true); return; }
    copilotOrbitAnim.setValue(0);
    copilotSunburstAnim.setValue(0);
    copilotScaleAnim.setValue(1);
    setCopilotOrbitAngle(0);
    setCopilotTransition(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const orbitListener = copilotOrbitAnim.addListener(({ value }) => setCopilotOrbitAngle(value));
    Animated.sequence([
      Animated.timing(copilotOrbitAnim, { toValue: 360, duration: 800, useNativeDriver: false, isInteraction: false }),
      Animated.parallel([
        Animated.timing(copilotScaleAnim, { toValue: 1.3, duration: 250, useNativeDriver: false }),
        Animated.timing(copilotSunburstAnim, { toValue: 1, duration: 250, useNativeDriver: false }),
      ]),
    ]).start(() => {
      setCopilotOpen(true);
      Animated.timing(copilotSunburstAnim, { toValue: 0, duration: 400, useNativeDriver: false }).start(() => {
        copilotOrbitAnim.removeListener(orbitListener);
        setCopilotTransition(false);
      });
    });
  }, [hasAccess]);

  // — AI copilot fetch — fires when copilot opens or tab changes while open —
  useEffect(() => {
    if (!copilotOpen || !session) { setAiCopilot(null); return; }
    setAiCopilot('loading');
    fetchCopilot(activeTab, nodes, persona, cognitiveModel)
      .then(payload => setAiCopilot(payload))
      .catch(() => setAiCopilot(null));
  }, [copilotOpen, session, activeTab]);

  // — copilot fallback — rule-based payload when AI is unavailable —
  const copilotFallback = useMemo((): CopilotPayload => {
    const getAvg = (n: typeof nodes[0]) => n.goals.reduce((acc, g) => acc + g.value, 0) / (n.goals.length || 1);
    const withAvg = nodes.map(n => ({ node: n, avg: getAvg(n) })).sort((a, b) => b.avg - a.avg);
    const highest = withAvg[0];
    const lowest = withAvg[withAvg.length - 1];

    if (activeTab === 'Actions') {
      const allActions = nodes.flatMap(n => n.goals.flatMap(g => g.actions.map(a => ({ ...a, nodeId: n.id, goalId: g.id, goalName: g.name }))));
      const completed = allActions.filter(a => a.completed).length;
      const pending = allActions.filter(a => !a.completed).length;
      const topCoord = nodes
        .flatMap(n => n.goals.map(g => ({ nodeId: n.id, goalId: g.id, goalName: g.name, pending: g.actions.filter(a => !a.completed).length })))
        .sort((a, b) => b.pending - a.pending)[0];
      const lowestNode = lowest?.node;
      const nothingInPlace = nodes.find(n => n.goals.every(g => g.actions.length === 0));
      const allClear = pending === 0 && completed > 0;
      return {
        header: 'REFLECTION',
        stats: [{ label: 'DONE', value: String(completed) }, { label: 'OPEN', value: String(pending) }],
        lines: allClear ? [
          { prefix: 'SIGNAL', text: `Everything is done. ${highest?.node?.name ? `${highest.node.name} is where you have the most momentum — keep it going.` : 'Keep the momentum going.'}` },
          { prefix: 'MORE', text: 'A clear list is a good time to decide what to add next, not just what to finish.' },
        ] : pending > 0 ? [
          { prefix: 'TENSION', text: topCoord?.pending ? `${topCoord.goalName} has ${topCoord.pending} open action${topCoord.pending !== 1 ? 's' : ''} with nothing done yet. That's the one to move on.` : `You have ${pending} open action${pending !== 1 ? 's' : ''}. Pick one and do it.` },
          { prefix: 'MORE', text: 'Progress on one thing is better than holding space for ten.' },
        ] : [
          { prefix: 'TENSION', text: nothingInPlace ? `${nothingInPlace.name} has no actions behind it yet. That's where to start.` : `${lowestNode?.name ?? 'Your lowest area'} could use something concrete behind it.` },
          { prefix: 'MORE', text: 'Intentions without actions stay intentions.' },
        ],
        actions: allClear ? [
          { label: `Add something new to ${highest?.node?.name ?? 'your strongest area'}.`, action: 'deployTask', nodeId: highest?.node?.id, goalId: highest?.node?.goals[0]?.id },
          { label: `Give ${lowestNode?.name ?? 'your lowest area'} some attention.`, action: 'deployTask', nodeId: lowestNode?.id, goalId: lowestNode?.goals[0]?.id },
        ] : [
          { label: topCoord ? `Work on ${topCoord.goalName}.` : 'Move on your top open action.', action: 'prioritize', nodeId: topCoord?.nodeId, goalId: topCoord?.goalId },
          { label: `Add an action to ${lowestNode?.name ?? 'your lowest area'}.`, action: 'deployTask', nodeId: lowestNode?.id, goalId: lowestNode?.goals[0]?.id },
        ],
      };
    }

    if (activeTab === 'Evaluate') {
      const lowAreas = nodes.filter(n => getAvg(n) < 6);
      const noActions = nodes.flatMap(n => n.goals.filter(g => g.actions.length === 0));
      const allGood = lowAreas.length === 0 && noActions.length === 0;
      return {
        header: 'REFLECTION',
        stats: [{ label: 'BELOW 6', value: String(lowAreas.length) }, { label: 'NO ACTIONS', value: String(noActions.length) }],
        lines: allGood ? [
          { prefix: 'SIGNAL', text: `Everything is above a 6 and has actions behind it. ${highest?.node?.name ? `${highest.node.name} is your strongest area right now.` : 'Things are holding well.'}` },
          { prefix: 'MORE', text: 'Stability is worth recognising — this is a good moment to go deeper, not just maintain.' },
        ] : lowAreas.length > 0 ? [
          { prefix: 'TENSION', text: `${lowAreas[0].name} is the lowest${lowAreas.length > 1 ? ` and it's not alone — ${lowAreas.slice(1).map(n => n.name).join(', ')} are also below a 6` : ''}. That's where to put your energy.` },
          { prefix: 'MORE', text: noActions.length > 0 ? `There are also ${noActions.length} tracked item${noActions.length !== 1 ? 's' : ''} with nothing in place to move them.` : 'A low score with no actions is the clearest signal in the whole app.' },
        ] : [
          { prefix: 'TENSION', text: `${noActions.length} thing${noActions.length !== 1 ? 's' : ''} you track ${noActions.length !== 1 ? 'have' : 'has'} no actions behind ${noActions.length !== 1 ? 'them' : 'it'}. Intentions need something concrete.` },
          { prefix: 'MORE', text: `Start with ${noActions[0]?.name ?? 'the one that matters most'}.` },
        ],
        actions: allGood ? [
          { label: `Add an action to keep ${highest?.node?.name ?? 'your strongest area'} moving.`, action: 'deployTask', nodeId: highest?.node?.id, goalId: highest?.node?.goals[0]?.id },
          { label: `Add something to ${lowest?.node?.name ?? 'your lowest area'}.`, action: 'deployTask', nodeId: lowest?.node?.id, goalId: lowest?.node?.goals[0]?.id },
        ] : [
          { label: `Add an action to move ${lowest?.node?.name ?? 'your lowest area'}.`, action: 'deployTask', nodeId: lowest?.node?.id, goalId: lowest?.node?.goals[0]?.id },
          { label: `Add an action to ${noActions[0]?.name ?? 'something without one'}.`, action: 'deployTask', nodeId: nodes.find(n => n.goals.some(g => g.actions.length === 0))?.id, goalId: noActions[0]?.id },
        ],
      };
    }

    // Atlas + Profile
    const totalAvg = withAvg.length ? (withAvg.reduce((acc, w) => acc + w.avg, 0) / withAvg.length).toFixed(1) : '0.0';
    const allSolid = withAvg.every(w => w.avg >= 6);
    const isHealthy = parseFloat(totalAvg) >= 7.5 && allSolid;
    return {
      header: 'REFLECTION',
      stats: [{ label: 'OVERALL', value: totalAvg }, { label: 'AREAS', value: String(nodes.length) }],
      lines: !nodes.length ? [
        { prefix: 'SIGNAL', text: 'No areas added yet. Start by adding one thing that matters to you.' },
        { prefix: 'MORE', text: 'Work, Health, Relationships — pick whatever feels most alive right now.' },
      ] : isHealthy ? [
        { prefix: 'SIGNAL', text: `Everything is holding at ${totalAvg}. ${highest?.node?.name ? `${highest.node.name} is your strongest area.` : 'Things are in good shape.'}` },
        { prefix: 'MORE', text: 'Good shape is a moment to go deeper on what matters, not just maintain what exists.' },
      ] : lowest && lowest.node.id !== highest?.node?.id ? [
        { prefix: 'TENSION', text: `${lowest.node.name} is pulling below everything else at ${lowest.avg.toFixed(1)}. That's where to look.` },
        { prefix: 'MORE', text: `${highest?.node?.name ? `${highest.node.name} is your strongest at ${highest.avg.toFixed(1)} — ` : ''}one area lagging changes how the whole thing feels.` },
      ] : [
        { prefix: 'SIGNAL', text: `Things are fairly balanced at ${totalAvg} overall. No single area is obviously off.` },
        { prefix: 'MORE', text: 'Balanced but low still means something needs attention — look at which area feels most neglected.' },
      ],
      actions: isHealthy ? [
        { label: `Add an action to keep ${highest?.node?.name ?? 'your strongest area'} moving.`, action: 'deployTask', nodeId: highest?.node?.id, goalId: highest?.node?.goals[0]?.id },
        { label: `Add something to ${lowest?.node?.name ?? 'your lowest area'}.`, action: 'deployTask', nodeId: lowest?.node?.id, goalId: lowest?.node?.goals[0]?.id },
      ] : [
        { label: `Add an action to move ${lowest?.node?.name ?? 'your lowest area'}.`, action: 'deployTask', nodeId: lowest?.node?.id, goalId: lowest?.node?.goals[0]?.id },
        { label: `Add an action to ${highest?.node?.name ?? 'your strongest area'}.`, action: 'deployTask', nodeId: highest?.node?.id, goalId: highest?.node?.goals.find(g => g.actions.length === 0)?.id ?? highest?.node?.goals[0]?.id },
      ],
    };
  }, [activeTab, nodes, cognitiveModel]);

  // briefingHighlight removed — handled inside CopilotCard

  // ─── CopilotCard visual data ──────────────────────────────────────────────

  /** Bubble data for the Nodes tab visual — all nodes with their avg score */
  const nodeBubbles = useMemo((): NodeBubble[] =>
    nodes.map(n => ({
      name: n.name,
      score: parseFloat(getNodeAvg(n)),
      color: n.color,
    })),
  [nodes, getNodeAvg]);

  /** The lowest-scoring coordinate across all nodes — shown in the Actions focus circle */
  const focusCoordinate = useMemo(() => {
    let lowest: { name: string; score: number; color: string } | null = null;
    for (const node of nodes) {
      for (const goal of node.goals) {
        if (!lowest || goal.value < lowest.score) {
          lowest = { name: goal.name, score: goal.value, color: node.color };
        }
      }
    }
    return lowest;
  }, [nodes]);

  /** 7-day system trajectory for the Atlas dive-deeper sparkline */
  const systemTrajectory = useMemo((): number[] => {
    if (nodes.length === 0) return [];
    const getPastDays = (n: number) =>
      Array.from({ length: n }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (n - 1 - i));
        return d.toISOString().split('T')[0];
      });
    const days = getPastDays(7);
    // For each day, compute system avg (avg of node avgs)
    return days.map(day => {
      const nodeAvgs = nodes.map(node => {
        if (node.goals.length === 0) return 0;
        const dayScores = node.goals.map(g => {
          const hist = g.scoreHistory;
          if (!hist || hist.length === 0) return g.value;
          const candidates = hist
            .filter(h => h.date.split('T')[0] <= day)
            .sort((a, b) => b.date.localeCompare(a.date));
          return candidates.length > 0 ? candidates[0].value : g.value;
        });
        return dayScores.reduce((a, b) => a + b, 0) / dayScores.length;
      });
      return Math.min(10, Math.max(0,
        nodeAvgs.reduce((a, b) => a + b, 0) / nodeAvgs.length
      ));
    });
  }, [nodes]);

  /** All coordinates flattened for the Actions dive-deeper scatter */
  const allCoordinates = useMemo((): CoordinateDot[] =>
    nodes.flatMap(node =>
      node.goals.map(g => ({
        name: g.name,
        score: g.value,
        color: node.color,
        calibrationCount: g.actions.length,
      }))
    ),
  [nodes]);

  // — copilot action handler —
  const handleCopilotAction = useCallback((act: CopilotAction) => {
    // Snapshot before-state for Last Cycle recap
    const node = nodes.find(n => n.id === act.nodeId);
    const goal = node?.goals.find(g => g.id === act.goalId);
    if (node) {
      setLastCycleAction({
        action: act.action,
        goalName: goal?.name || node.goals[0]?.name || '',
        nodeName: node.name,
        valueBefore: goal?.value ?? node.goals[0]?.value ?? 0,
        nodeAvgBefore: parseFloat(getNodeAvg(node)),
        nodeAvgNow: parseFloat(getNodeAvg(node)), // will read live on next open
      });
    }
    setCopilotOpen(false);
    if (act.action === 'calibrate' && act.nodeId) { setActiveTab('Evaluate'); setSelectedNodeId(act.nodeId); }
    else if (act.action === 'addCalibration' && act.nodeId && act.goalId) { setAddActionTarget({ nodeId: act.nodeId, goalId: act.goalId }); setAddActionOpen(true); }
    else if (act.action === 'prioritize' && act.nodeId && act.goalId) { setEditingCoordinate({ nodeId: act.nodeId, goalId: act.goalId }); }
    else if (act.action === 'deployTask') {
      const { nodeId, goalId } = act.nodeId && act.goalId ? { nodeId: act.nodeId, goalId: act.goalId }
        : nodes[0]?.goals[0] ? { nodeId: nodes[0].id, goalId: nodes[0].goals[0].id }
        : { nodeId: '', goalId: '' };
      if (nodeId && goalId) { setAddActionTarget({ nodeId, goalId }); setAddActionOpen(true); }
    }
  }, [nodes, getNodeAvg]);

  // — auth handlers —
  const handleAuthSubmit = useCallback(async () => {
    const email = authEmail.trim();
    const password = authPassword.trim();
    if (!email || !password) { setAuthError('Email and password are required.'); return; }
    setAuthLoading(true);
    setAuthError('');
    try {
      if (authMode === 'signIn') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setAuthError(error.message);
        else { setAuthOpen(false); setAuthEmail(''); setAuthPassword(''); }
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) setAuthError(error.message);
        else { setAuthError(''); setAuthMode('signIn'); setAuthError('Account created — check your email to confirm, then sign in.'); }
      }
    } catch (e: any) {
      setAuthError(e?.message || 'Something went wrong.');
    } finally {
      setAuthLoading(false);
    }
  }, [authEmail, authPassword, authMode]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    // onAuthStateChange will call setSession(null) automatically
  }, []);

  const openAuth = useCallback((mode: 'signIn' | 'signUp') => {
    setAuthMode(mode);
    setAuthEmail('');
    setAuthPassword('');
    setAuthError('');
    setAuthOpen(true);
  }, []);

  // — add node handler —
  const handleAddNode = useCallback(() => {
    const name = addNodeForm.name.trim();
    if (!name) return;
    storeAddNode(name, addNodeForm.description.trim(), addNodeForm.color);
    setAddNodeOpen(false);
    setAddNodeForm({ name: '', description: '', color: NODE_COLORS[0] });
  }, [addNodeForm, storeAddNode]);

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  // Show nothing until we've checked AsyncStorage (avoids flash)
  if (!onboardingReady) return null;

  // Show onboarding for first-time users
  if (showOnboarding) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <OnboardingScreen
          initialNodes={nodes.map(n => ({
            id: n.id,
            name: n.name,
            description: n.description || '',
            color: n.color,
            goals: n.goals.map(g => ({ id: g.id, name: g.name, value: g.value })),
          }))}
          onComplete={handleOnboardingComplete}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bgDeep }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <BlobBackground />
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>{activeTab.toUpperCase()}</Text>
            </View>
            <TouchableOpacity style={styles.headerInfoBtn} onPress={() => setInfoOpen(true)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Svg width={20} height={20} viewBox="0 0 24 24">
                <Circle cx="12" cy="12" r="10" fill="none" stroke={theme.textMuted} strokeWidth="1.5" />
                <Circle cx="12" cy="8" r="1.5" fill={theme.textMuted} />
                <Path d="M12 11v5" stroke={theme.textMuted} strokeWidth="1.5" strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Screens */}
          {activeTab === 'Atlas' && (
            <AtlasScreen
              guidanceActions={(aiCopilot && aiCopilot !== 'loading' ? aiCopilot : copilotFallback).actions}
              onAction={handleCopilotAction}
              onGoToNode={(nodeId) => { setSelectedNodeId(nodeId); setActiveTab('Evaluate'); }}
              onGoToActions={(nodeId) => { setSelectedNodeId(nodeId); setActiveTab('Actions'); }}
              onOpenCoordinate={(nodeId, goalId) => setEditingCoordinate({ nodeId, goalId })}
              onOpenAction={(nodeId, goalId, actionId) => {
                const node = nodes.find(n => n.id === nodeId);
                const goal = node?.goals.find(g => g.id === goalId);
                const action = goal?.actions.find(a => a.id === actionId);
                if (action) {
                  setEditForm({ title: action.title, nodeId, goalId, isPriority: !!action.isPriority, notes: action.notes || '', dueDate: action.dueDate || '', reminder: action.reminder || '' });
                  setEditFormEffort(action.effort ?? 'easy');
                  setEditingAction({ nodeId, goalId, actionId });
                }
              }}
            />
          )}
          {activeTab === 'Evaluate' && (
            <NodesScreen
              selectedNodeId={selectedNodeId}
              setSelectedNodeId={setSelectedNodeId}
              onOpenCoordEdit={(nodeId, goalId) => setEditingCoordinate({ nodeId, goalId })}
              onOpenAddNode={() => { setAddNodeForm({ name: '', description: '', color: NODE_COLORS[0] }); setAddNodeOpen(true); }}
              onOpenEditNode={(nodeId) => setEditingNodeId(nodeId)}
              onOpenSystemGate={() => setSystemAccessGateOpen(true)}
            />
          )}
          {activeTab === 'Actions' && (
            <ActionsScreen
              addActionOpen={addActionOpen}
              setAddActionOpen={setAddActionOpen}
              addActionTarget={addActionTarget}
              setAddActionTarget={setAddActionTarget}
              selectedNodeId={selectedNodeId}
              onOpenEditAction={(nodeId, goalId, actionId) => {
                const node = nodes.find(n => n.id === nodeId);
                const goal = node?.goals.find(g => g.id === goalId);
                const action = goal?.actions.find(a => a.id === actionId);
                if (action) {
                  setEditForm({ title: action.title, nodeId, goalId, isPriority: !!action.isPriority, notes: action.notes || '', dueDate: action.dueDate || '', reminder: action.reminder || '' });
                  setEditFormEffort(action.effort ?? 'easy');
                  setEditingAction({ nodeId, goalId, actionId });
                }
              }}
              onOpenCoordEdit={(nodeId, goalId) => setEditingCoordinate({ nodeId, goalId })}
            />
          )}
          {activeTab === 'Profile' && (
            <ProfileScreen
              session={session}
              onSignIn={() => openAuth('signIn')}
              onSignUp={() => openAuth('signUp')}
              onSignOut={handleSignOut}
            />
          )}
        </ScrollView>
      </View>

      {/* Tab bar */}
      <View style={[styles.nav, { backgroundColor: theme.navGlass, borderTopColor: theme.navBorder }]}>
        {(['Atlas', 'Evaluate', 'Actions', 'Profile'] as const).map(t => {
          const active = activeTab === t;
          const c = active ? theme.accent : theme.textMuted;
          return (
            <TouchableOpacity key={t} onPress={() => setActiveTab(t)} style={styles.navBtn}>
              <View style={styles.navIconWrap}>
                {t === 'Atlas' && (
                  <Svg width={44} height={44} viewBox="0 0 120 120">
                    <Circle cx="60" cy="60" r="44" stroke={c} strokeWidth="5" fill="none" />
                    <Circle cx="60" cy="60" r="10" fill={c} />
                  </Svg>
                )}
                {t === 'Evaluate' && (
                  <Svg width={44} height={44} viewBox="0 0 120 120">
                    <Circle cx="60" cy="60" r="40" stroke={c} strokeWidth="2" fill="none" opacity={0.25} />
                    <Circle cx="60" cy="60" r="16" fill={c} />
                    <Circle cx="20" cy="60" r="8" fill={active ? "#A78BFA" : c} />
                    <Circle cx="80" cy="25" r="10" fill={active ? "#34D399" : c} />
                    <Circle cx="88" cy="88" r="7" fill={active ? "#F472B6" : c} />
                  </Svg>
                )}
                {t === 'Actions' && (
                  <Svg width={44} height={44} viewBox="0 0 120 120">
                    <Circle cx="60" cy="60" r="30" stroke={c} strokeWidth="4" fill="none" opacity={0.5} />
                    <Circle cx="60" cy="30" r="6" fill={c} />
                    <Circle cx="81" cy="81" r="6" fill={c} />
                    <Circle cx="39" cy="81" r="6" fill={c} />
                    <Path d="M57 30 L60 33 L64 27" stroke={active ? "#10B981" : c} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <Path d="M78 81 L81 84 L85 78" stroke={active ? "#10B981" : c} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </Svg>
                )}
                {t === 'Profile' && (
                  <Svg width={35} height={35} viewBox="0 0 120 120">
                    <Circle cx="60" cy="38" r="18" stroke={c} strokeWidth="8" fill="none" />
                    <Path d="M14 102 C14 74 34 58 60 58 C86 58 106 74 106 102" stroke={c} strokeWidth="8" fill="none" strokeLinecap="round" />
                  </Svg>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Copilot FAB */}
      <TouchableOpacity style={[styles.copilotFab, !hasAccess && styles.copilotFabLocked]} onPress={triggerCopilotTransition} activeOpacity={0.8}>
        <View style={styles.copilotContainer}>
          <Svg width={48} height={48} viewBox="0 0 48 48">
            <Circle cx={24} cy={24} r={10.5} fill={hasAccess ? '#FFFFFF' : '#94A3B8'} />
            <Circle cx={24} cy={24} r={22.5} fill="none" stroke={hasAccess ? '#FFFFFF' : '#94A3B8'} strokeWidth={1} />
            <Circle cx={40} cy={8} r={3.375} fill={hasAccess ? '#FFFFFF' : '#94A3B8'} />
          </Svg>
        </View>
      </TouchableOpacity>

      {/* ─── OVERLAYS / MODALS ─────────────────────────────────────────────────── */}

      {/* Info overlay */}
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

      {/* Add node overlay */}
      {addNodeOpen && (
        <View style={styles.infoOverlay} pointerEvents="box-none">
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => { setAddNodeOpen(false); setAddNodeForm({ name: '', description: '', color: NODE_COLORS[0] }); }} activeOpacity={1} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
            <View style={styles.addNodeCard} pointerEvents="auto">
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.addNodeHeader}>
                  <Text style={styles.addNodeHeaderLabel}>NEW NODE</Text>
                  <View style={[styles.addNodeHeaderDot, { backgroundColor: addNodeForm.color }]} />
                </View>
                <Text style={styles.editFormLabel}>NAME</Text>
                <TextInput style={styles.editFormInput} value={addNodeForm.name} onChangeText={t => setAddNodeForm(f => ({ ...f, name: t }))} placeholder="Work, Health, Relationships…" placeholderTextColor={THEME.textDim} autoFocus autoCorrect={false} autoCapitalize="none" />
                <Text style={styles.editFormLabel}>INTENT</Text>
                <TextInput style={[styles.editFormInput, { minHeight: 52 }]} value={addNodeForm.description} onChangeText={t => setAddNodeForm(f => ({ ...f, description: t }))} placeholder="What does this node represent?" placeholderTextColor={THEME.textDim} multiline />
                <View style={styles.addNodeDivider} />
                <Text style={styles.editFormLabel}>COLOR</Text>
                <View style={styles.addNodeColorRow}>
                  {NODE_COLORS.map(c => (
                    <TouchableOpacity key={c} onPress={() => setAddNodeForm(f => ({ ...f, color: c }))} activeOpacity={0.8} style={[styles.addNodeSwatch, { backgroundColor: c }, addNodeForm.color === c && styles.addNodeSwatchSelected]} />
                  ))}
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => { setAddNodeOpen(false); setAddNodeForm({ name: '', description: '', color: NODE_COLORS[0] }); }} activeOpacity={0.7}>
                    <Text style={styles.cancelBtnText}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.submitBtn, { backgroundColor: addNodeForm.color, borderColor: addNodeForm.color }]} onPress={handleAddNode} activeOpacity={0.7}>
                    <Text style={[styles.submitBtnText, { color: '#fff' }]}>ADD NODE</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* Edit node overlay */}
      {!!editingNodeId && (
        <View style={styles.infoOverlay} pointerEvents="box-none">
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => { setEditingNodeId(null); setEditNodeForm({ name: '', description: '', color: NODE_COLORS[0] }); }} activeOpacity={1} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
            <View style={styles.addNodeCard} pointerEvents="auto">
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.addNodeHeader}>
                  <Text style={styles.addNodeHeaderLabel}>EDIT NODE</Text>
                  <View style={[styles.addNodeHeaderDot, { backgroundColor: editNodeForm.color }]} />
                </View>
                <Text style={styles.editFormLabel}>NAME</Text>
                <TextInput style={styles.editFormInput} value={editNodeForm.name} onChangeText={t => setEditNodeForm(f => ({ ...f, name: t }))} placeholder="Node name" placeholderTextColor={THEME.textDim} autoFocus autoCorrect={false} autoCapitalize="none" />
                <Text style={styles.editFormLabel}>INTENT</Text>
                <TextInput style={[styles.editFormInput, { minHeight: 52 }]} value={editNodeForm.description} onChangeText={t => setEditNodeForm(f => ({ ...f, description: t }))} placeholder="What does this node represent?" placeholderTextColor={THEME.textDim} multiline />
                <View style={styles.addNodeDivider} />
                <Text style={styles.editFormLabel}>COLOR</Text>
                <View style={styles.addNodeColorRow}>
                  {NODE_COLORS.map(c => (
                    <TouchableOpacity key={c} onPress={() => setEditNodeForm(f => ({ ...f, color: c }))} activeOpacity={0.8} style={[styles.addNodeSwatch, { backgroundColor: c }, editNodeForm.color === c && styles.addNodeSwatchSelected]} />
                  ))}
                </View>
                {/* Archive / Delete */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)', alignItems: 'center' }}
                    onPress={() => { if (editingNodeId) { archiveNode(editingNodeId); setEditingNodeId(null); } }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }}>ARCHIVE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(251,113,133,0.4)', alignItems: 'center' }}
                    onPress={() => { if (editingNodeId) { deleteNode(editingNodeId); setEditingNodeId(null); } }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: '#fb7185', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }}>DELETE</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditingNodeId(null); setEditNodeForm({ name: '', description: '', color: NODE_COLORS[0] }); }} activeOpacity={0.7}>
                    <Text style={styles.cancelBtnText}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.submitBtn, { backgroundColor: editNodeForm.color, borderColor: editNodeForm.color }]} onPress={() => { if (editNodeForm.name.trim() && editingNodeId) { updateNode(editingNodeId, { name: editNodeForm.name.trim(), description: editNodeForm.description.trim(), color: editNodeForm.color }); setEditingNodeId(null); setEditNodeForm({ name: '', description: '', color: NODE_COLORS[0] }); } }} activeOpacity={0.7}>
                    <Text style={[styles.submitBtnText, { color: '#fff' }]}>SAVE</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* Coordinate edit overlay */}
      {editingCoordinate && (() => {
        const node = nodes.find(n => n.id === editingCoordinate.nodeId);
        const goal = node?.goals.find(g => g.id === editingCoordinate.goalId);
        if (!node || !goal) return null;
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
          <View style={styles.infoOverlay} pointerEvents="box-none">
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setEditingCoordinate(null)} activeOpacity={1} />
            <View style={[styles.coordinateEditCard, { maxHeight: '85%' }]} pointerEvents="auto">
              <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                <TextInput
                  style={[styles.coordDetailName, styles.coordDetailNameInput]}
                  value={goal.name}
                  onChangeText={(text) => updateGoal(node.id, goal.id, { name: text })}
                  placeholder="Coordinate name"
                  placeholderTextColor={THEME.textDim}
                  returnKeyType="done"
                  autoCorrect={false}
                  autoCapitalize="none"
                  selectTextOnFocus
                />
                <View style={styles.sliderRow}>
                  <View style={styles.sliderTrack} onLayout={e => { trackWidths.current[key] = e.nativeEvent.layout.width; }} {...pan.panHandlers}>
                    <View style={[styles.sliderLine, { backgroundColor: node.color, opacity: 0.3 }]} />
                    <View pointerEvents="none" style={[styles.sliderFill, { width: `${goal.value * 10}%`, backgroundColor: node.color }]} />
                    <View pointerEvents="none" style={[styles.sliderHandle, { left: `${goal.value * 10}%`, marginLeft: -6 }]}>
                      <View style={[styles.sliderHandleInner, { backgroundColor: '#38BDF8' }]} />
                    </View>
                  </View>
                  <OrbitalValueBadge value={goal.value} color={node.color} size={48} />
                </View>
                <Text style={styles.calibrationFeedLabel}>CALIBRATIONS</Text>
                {goal.actions.length === 0 ? (
                  <Text style={[styles.evidencePreview, { marginBottom: 8 }]}>No actions yet</Text>
                ) : (
                  goal.actions.map(a => (
                    <TouchableOpacity
                      key={a.id}
                      style={styles.coordEditTaskRow}
                      onPress={() => {
                        setEditForm({ title: a.title, nodeId: node.id, goalId: goal.id, isPriority: !!a.isPriority, notes: a.notes || '', dueDate: a.dueDate || '', reminder: a.reminder || '' });
                        setEditFormEffort(a.effort ?? 'easy');
                        setEditingAction({ nodeId: node.id, goalId: goal.id, actionId: a.id });
                        setEditingCoordinate(null);
                      }}
                      activeOpacity={0.8}
                    >
                      <TouchableOpacity onPress={() => toggleAction(node.id, goal.id, a.id)} style={{ padding: 4 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Svg width={20} height={20} viewBox="0 0 24 24">
                          {a.completed ? (
                            <><Circle cx="12" cy="12" r="10" fill={node.color} /><Path d="M7 12l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></>
                          ) : (
                            <Circle cx="12" cy="12" r="10" fill="none" stroke={THEME.textDim} strokeWidth="1.5" />
                          )}
                        </Svg>
                      </TouchableOpacity>
                      <Text style={[styles.coordEditTaskTitle, a.completed && styles.taskTitleStrike, a.completed && { opacity: 0.8 }]} numberOfLines={1}>{a.title}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
              {/* Bottom action row */}
              <View style={{ marginTop: 12 }}>
                {/* + ADD ACTION — prominent */}
                <TouchableOpacity
                  style={{ paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: node.color + '66', backgroundColor: node.color + '18', alignItems: 'center', marginBottom: 10 }}
                  onPress={() => useAppStore.getState().addAction(node.id, goal.id, 'New Action')}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: node.color, fontSize: 12, fontWeight: '800', letterSpacing: 2 }}>+ ADD ACTION</Text>
                </TouchableOpacity>
                {/* Archive / Delete / Done — small and muted */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', gap: 16 }}>
                    <TouchableOpacity onPress={() => { if (editingCoordinate) { archiveGoal(editingCoordinate.nodeId, editingCoordinate.goalId); setEditingCoordinate(null); } }} activeOpacity={0.6}>
                      <Text style={{ color: THEME.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }}>ARCHIVE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { if (editingCoordinate) { deleteGoal(editingCoordinate.nodeId, editingCoordinate.goalId); setEditingCoordinate(null); } }} activeOpacity={0.6}>
                      <Text style={{ color: '#fb7185', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, opacity: 0.6 }}>DELETE</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={[styles.coordEditDoneBtn, { marginTop: 0 }]} onPress={() => setEditingCoordinate(null)} activeOpacity={0.7}>
                    <Text style={styles.coordEditDoneText}>DONE</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        );
      })()}

      {/* Edit action overlay */}
      {!!editingAction && (
        <View style={styles.infoOverlay} pointerEvents="box-none">
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => { setEditingAction(null); setNodeDropdownOpen(false); setCoordDropdownOpen(false); }} activeOpacity={1} />
          <View style={styles.taskEditCard} pointerEvents="auto">
            <ScrollView style={styles.taskEditScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Title */}
              <Text style={styles.editFormLabel}>TITLE</Text>
              <TextInput
                style={[styles.editFormInput, { color: '#94a3b8' }]}
                value={editForm.title}
                onChangeText={t => setEditForm(f => ({ ...f, title: t }))}
                placeholderTextColor={THEME.textDim}
                autoCorrect={false}
                autoCapitalize="none"
              />

              {/* Effort */}
              <Text style={styles.editFormLabel}>EFFORT</Text>
              <View style={[styles.effortPickerRow, { marginBottom: 20 }]}>
                {(['easy', 'medium', 'heavy'] as const).map(level => {
                  const sel = editFormEffort === level;
                  return (
                    <TouchableOpacity
                      key={level}
                      style={[styles.effortPickerBtn, sel && { borderColor: THEME.accent, backgroundColor: 'rgba(56,189,248,0.1)' }]}
                      onPress={() => setEditFormEffort(level)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.effortPickerBtnText, { color: sel ? THEME.accent : THEME.textDim }]}>{level.toUpperCase()}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Node dropdown */}
              <Text style={styles.editFormLabel}>NODE</Text>
              {(() => {
                const selNode = nodes.find(n => n.id === editForm.nodeId);
                return (
                  <View style={{ marginBottom: 20 }}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: selNode ? selNode.color + '55' : 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)' }}
                      onPress={() => { setNodeDropdownOpen(v => !v); setCoordDropdownOpen(false); }}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        {selNode && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: selNode.color }} />}
                        <Text style={{ color: selNode ? selNode.color : THEME.textDim, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }}>
                          {selNode ? selNode.name : 'Select node…'}
                        </Text>
                      </View>
                      <Text style={{ color: THEME.textDim, fontSize: 10 }}>{nodeDropdownOpen ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {nodeDropdownOpen && (
                      <View style={{ marginTop: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', backgroundColor: 'rgba(10,18,36,0.98)' }}>
                        {nodes.map((n, i) => (
                          <TouchableOpacity
                            key={n.id}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: i < nodes.length - 1 ? 0.5 : 0, borderBottomColor: 'rgba(255,255,255,0.06)', backgroundColor: editForm.nodeId === n.id ? n.color + '14' : 'transparent' }}
                            onPress={() => { setEditForm(f => ({ ...f, nodeId: n.id, goalId: n.goals[0]?.id || '' })); setNodeDropdownOpen(false); }}
                            activeOpacity={0.7}
                          >
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: n.color }} />
                            <Text style={{ color: editForm.nodeId === n.id ? n.color : '#f0f4ff', fontSize: 13, fontWeight: '600' }}>{n.name}</Text>
                            {editForm.nodeId === n.id && <Text style={{ marginLeft: 'auto', color: n.color, fontSize: 11 }}>✓</Text>}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* Coordinate dropdown */}
              <Text style={styles.editFormLabel}>COORDINATE</Text>
              {(() => {
                const selNode = nodes.find(n => n.id === editForm.nodeId);
                const coords = selNode?.goals.filter(g => !g.archived) || [];
                const selCoord = coords.find(g => g.id === editForm.goalId);
                return (
                  <View style={{ marginBottom: 20 }}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: selNode ? selNode.color + '44' : 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)', opacity: selNode ? 1 : 0.5 }}
                      onPress={() => { if (selNode) { setCoordDropdownOpen(v => !v); setNodeDropdownOpen(false); } }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: selCoord ? (selNode?.color || '#f0f4ff') : THEME.textDim, fontSize: 13, fontWeight: '600' }}>
                        {selCoord ? selCoord.name : 'Select coordinate…'}
                      </Text>
                      <Text style={{ color: THEME.textDim, fontSize: 10 }}>{coordDropdownOpen ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {coordDropdownOpen && selNode && (
                      <View style={{ marginTop: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', backgroundColor: 'rgba(10,18,36,0.98)' }}>
                        {coords.map((g, i) => (
                          <TouchableOpacity
                            key={g.id}
                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: i < coords.length - 1 ? 0.5 : 0, borderBottomColor: 'rgba(255,255,255,0.06)', backgroundColor: editForm.goalId === g.id ? selNode.color + '14' : 'transparent' }}
                            onPress={() => { setEditForm(f => ({ ...f, goalId: g.id })); setCoordDropdownOpen(false); }}
                            activeOpacity={0.7}
                          >
                            <Text style={{ flex: 1, color: editForm.goalId === g.id ? selNode.color : '#f0f4ff', fontSize: 13, fontWeight: '600' }}>{g.name}</Text>
                            {editForm.goalId === g.id && <Text style={{ color: selNode.color, fontSize: 11 }}>✓</Text>}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* Priority */}
              <TouchableOpacity style={[styles.taskEditFocusRow, { marginBottom: 20 }]} onPress={() => setEditForm(f => ({ ...f, isPriority: !f.isPriority }))} activeOpacity={0.8}>
                <Svg width={18} height={18} viewBox="0 0 24 24">
                  {editForm.isPriority ? (
                    <Path fill={THEME.accent} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  ) : (
                    <Path fill="none" stroke={THEME.textDim} strokeWidth="1.5" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  )}
                </Svg>
                <Text style={{ marginLeft: 8, color: editForm.isPriority ? THEME.accent : THEME.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 1.5 }}>
                  {editForm.isPriority ? 'PRIORITY' : 'SET AS PRIORITY'}
                </Text>
              </TouchableOpacity>

              {/* Notes */}
              <Text style={styles.editFormLabel}>NOTES</Text>
              <TextInput style={[styles.taskEditNotes, { marginBottom: 20 }]} value={editForm.notes} onChangeText={t => setEditForm(f => ({ ...f, notes: t }))} placeholder="Add notes…" placeholderTextColor={THEME.textDim} multiline numberOfLines={3} />

            </ScrollView>

            {/* Bottom row: archive/delete muted + DONE */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.07)' }}>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <TouchableOpacity onPress={() => { archiveAction(editingAction.nodeId, editingAction.goalId, editingAction.actionId); setEditingAction(null); }} activeOpacity={0.6}>
                  <Text style={{ color: THEME.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }}>ARCHIVE</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { deleteAction(editingAction.nodeId, editingAction.goalId, editingAction.actionId); setEditingAction(null); }} activeOpacity={0.6}>
                  <Text style={{ color: '#fb7185', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, opacity: 0.6 }}>DELETE</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={{ paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, backgroundColor: 'rgba(56,189,248,0.12)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.35)' }}
                onPress={() => { saveActionEdit(editingAction, { ...editForm, effort: editFormEffort }); setEditingAction(null); setNodeDropdownOpen(false); setCoordDropdownOpen(false); }}
                activeOpacity={0.7}
              >
                <Text style={{ color: THEME.accent, fontSize: 12, fontWeight: '800', letterSpacing: 2 }}>DONE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Auth modal */}
      <Modal visible={authOpen} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.authOverlay} pointerEvents="box-none">
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setAuthOpen(false)} activeOpacity={1} />
            <View style={styles.authCard} pointerEvents="auto">
              <View style={styles.authHeader}>
                <Text style={styles.authTitle}>{authMode === 'signIn' ? 'SIGN IN' : 'CREATE ACCOUNT'}</Text>
                <TouchableOpacity onPress={() => setAuthOpen(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7}>
                  <Text style={styles.authCloseX}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.authLabel}>EMAIL</Text>
              <TextInput
                style={styles.authInput}
                value={authEmail}
                onChangeText={setAuthEmail}
                placeholder="you@example.com"
                placeholderTextColor={THEME.textDim}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.authLabel}>PASSWORD</Text>
              <TextInput
                style={styles.authInput}
                value={authPassword}
                onChangeText={setAuthPassword}
                placeholder="••••••••"
                placeholderTextColor={THEME.textDim}
                secureTextEntry
                autoCapitalize="none"
              />

              {!!authError && <Text style={styles.authError}>{authError}</Text>}

              <TouchableOpacity
                style={[styles.authSubmitBtn, authLoading && { opacity: 0.5 }]}
                onPress={handleAuthSubmit}
                disabled={authLoading}
                activeOpacity={0.8}
              >
                <Text style={styles.authSubmitText}>
                  {authLoading ? 'PLEASE WAIT…' : authMode === 'signIn' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.authToggleBtn}
                onPress={() => { setAuthMode(m => m === 'signIn' ? 'signUp' : 'signIn'); setAuthError(''); }}
                activeOpacity={0.7}
              >
                <Text style={styles.authToggleText}>
                  {authMode === 'signIn' ? "Don't have an account? SIGN UP" : 'Already have an account? SIGN IN'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Copilot transition animation */}
      {copilotTransition && (() => {
        const orbitRadius = 26;
        const angleRad = (copilotOrbitAngle - 45) * (Math.PI / 180);
        const planetX = 30 + orbitRadius * Math.cos(angleRad);
        const planetY = 30 + orbitRadius * Math.sin(angleRad);
        return (
          <View style={styles.copilotTransitionOverlay}>
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF', opacity: copilotSunburstAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.85] }) }]} />
            <View style={styles.copilotTransitionCenter}>
              <Animated.View style={{ transform: [{ scale: copilotScaleAnim }] }}>
                <Svg width={60} height={60} viewBox="0 0 60 60">
                  <Circle cx={30} cy={30} r={orbitRadius} fill="none" stroke="#FFFFFF" strokeWidth={1} opacity={0.5} />
                  <Circle cx={30} cy={30} r={16} fill="#38BDF8" opacity={0.25} />
                  <Circle cx={30} cy={30} r={13} fill="#38BDF8" opacity={0.4} />
                  <Circle cx={30} cy={30} r={10} fill="#FFFFFF" />
                  <Circle cx={planetX} cy={planetY} r={4} fill="#FFFFFF" />
                </Svg>
              </Animated.View>
            </View>
          </View>
        );
      })()}

      {/* Copilot modal */}
      <Modal visible={copilotOpen} animationType="fade" transparent>
        <View style={styles.copilotOverlay} pointerEvents="box-none">
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setCopilotOpen(false)} activeOpacity={1} />
          <FadingBorder style={{ maxWidth: 400, width: '100%' }}>
            <View pointerEvents="auto">
            <CopilotCard
              tab={activeTab}
              tabConfig={TAB_CONFIG[activeTab] ?? TAB_CONFIG['Atlas']}
              payload={aiCopilot === 'loading' ? null : (aiCopilot ?? copilotFallback)}
              isLoading={aiCopilot === 'loading'}
              onClose={() => setCopilotOpen(false)}
              onAction={handleCopilotAction}
              persona={persona}
              lastCycle={lastCycleAction ? {
                ...lastCycleAction,
                nodeAvgNow: (() => {
                  const lcNode = nodes.find(n => n.name === lastCycleAction.nodeName);
                  return lcNode ? parseFloat(getNodeAvg(lcNode)) : lastCycleAction.nodeAvgBefore;
                })(),
              } : null}
              nodeBubbles={nodeBubbles}
              focusCoordinate={focusCoordinate}
              systemTrajectory={systemTrajectory}
              allCoordinates={allCoordinates}
            />
            </View>
          </FadingBorder>
        </View>
      </Modal>

      {/* System access gate modal */}
      <Modal visible={systemAccessGateOpen} animationType="fade" transparent>
        <View style={styles.systemAccessOverlay} pointerEvents="box-none">
          <View style={styles.systemAccessCard} pointerEvents="auto">
            <Text style={styles.systemAccessTitle}>SYSTEM ACCESS CLEARANCE</Text>
            <Text style={styles.systemAccessFeature}>• AI CO-PILOT SUPPORT</Text>
            <Text style={styles.systemAccessFeature}>• UNLIMITED CUSTOM NODES</Text>
            <Text style={styles.systemAccessFeature}>• UNLIMITED COORDINATES PER NODE</Text>
            <View style={styles.systemAccessTiers}>
              <Text style={styles.systemAccessTierLabel}>BASIC (FREE)</Text>
              <Text style={styles.systemAccessTierLabel}>UNRESTRICTED ($9.99/MO)</Text>
            </View>
            <TouchableOpacity style={styles.systemAccessBtnPrimary} onPress={() => { openAuth('signUp'); setSystemAccessGateOpen(false); }} activeOpacity={0.8}>
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
  container: { flex: 1, backgroundColor: THEME.bg },
  scrollContent: { padding: 20, paddingBottom: 124 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30 },
  headerLeft: { flex: 1 },
  headerTitle: { color: 'white', fontSize: 32, fontWeight: '200', letterSpacing: 6 },
  headerInfoBtn: { padding: 4 },

  // Nav
  nav: { flexDirection: 'row', height: 100, borderTopWidth: 1, position: 'absolute', bottom: 0, width: '100%', overflow: 'hidden', paddingHorizontal: 16 },
  navBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIconWrap: {},

  // Copilot FAB
  copilotFab: { position: 'absolute', bottom: 120, right: 20, width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  copilotFabLocked: { opacity: 0.5 },
  copilotContainer: { width: 48, height: 48, overflow: 'visible', position: 'relative', justifyContent: 'center', alignItems: 'center' },

  // Copilot transition
  copilotTransitionOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.95)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  copilotTransitionCenter: { justifyContent: 'center', alignItems: 'center' },

  // Copilot modal
  copilotOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(15, 23, 42, 0.85)' },
  copilotCard: { backgroundColor: 'rgba(30, 41, 59, 0.9)', borderRadius: 12, padding: 20, shadowColor: '#38BDF8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 25 },
  copilotCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  copilotTitle: { color: THEME.accent, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  copilotCloseX: { color: THEME.border, fontSize: 16, fontWeight: '600' },
  copilotHeading: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', marginTop: 12, marginBottom: 8 },
  copilotBriefingLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 8 },
  copilotBriefingPrefix: { fontWeight: '700', color: '#94A3B8', fontSize: 14, letterSpacing: 2 },
  copilotBriefingBody: { flex: 1, color: THEME.border, fontSize: 14, letterSpacing: 2, lineHeight: 18 },
  copilotBriefingNum: { fontWeight: '700', color: '#FFFFFF' },
  copilotSuggestionBtn: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, alignItems: 'center' },
  copilotSuggestionBtnText: { color: THEME.border, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  copilotLastCycleCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12, borderLeftWidth: 2, borderLeftColor: THEME.accent, marginBottom: 4 },
  copilotLastCycleAction: { color: THEME.border, fontSize: 13, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  copilotLastCycleDetail: { color: 'white', fontSize: 18, fontWeight: '200', letterSpacing: 3, marginBottom: 4 },
  copilotLastCycleDelta: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },

  // System access gate
  systemAccessOverlay: { flex: 1, backgroundColor: 'rgba(21,34,56,0.96)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  systemAccessCard: { backgroundColor: THEME.card, borderRadius: 12, padding: 24, maxWidth: 360, width: '100%', shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 },
  systemAccessTitle: { color: '#E2E8F0', fontSize: 14, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' },
  systemAccessFeature: { color: THEME.border, fontSize: 14, fontWeight: '600', letterSpacing: 1, marginTop: 6 },
  systemAccessTiers: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(226,232,240,0.3)' },
  systemAccessTierLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  systemAccessBtnPrimary: { marginTop: 20, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, alignItems: 'center' },
  systemAccessBtnSecondary: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, alignItems: 'center' },
  systemAccessBtnText: { color: '#E2E8F0', fontSize: 14, fontWeight: '700', letterSpacing: 2 },

  // Info overlay
  infoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(15, 23, 42, 0.85)' },
  infoCard: { backgroundColor: THEME.card, borderRadius: 12, padding: 20, maxWidth: 400, maxHeight: '80%', width: '100%', shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 },
  infoScroll: { maxHeight: 320 },
  infoTitle: { color: THEME.accent, fontSize: 14, fontWeight: '800', letterSpacing: 3, marginBottom: 12 },
  infoText: { color: THEME.border, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  infoDoneBtn: { marginTop: 16, alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: THEME.accent, borderRadius: 12 },
  infoDoneText: { color: THEME.accent, fontSize: 14, fontWeight: '700', letterSpacing: 2 },

  // Add / edit node card
  addNodeCard: { backgroundColor: THEME.card, borderRadius: 14, padding: 20, maxWidth: 400, width: '100%', shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 },
  addNodeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  addNodeHeaderLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase' },
  addNodeHeaderDot: { width: 10, height: 10, borderRadius: 5 },
  addNodeDivider: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', marginVertical: 16 },
  addNodeColorRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, gap: 10 },
  addNodeSwatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent', marginRight: 10, marginBottom: 10 },
  addNodeSwatchSelected: { borderColor: '#E2E8F0' },

  // Form shared
  editFormLabel: { color: 'white', fontSize: 14, fontWeight: '800', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' },
  editFormInput: { color: 'white', fontSize: 16, fontWeight: '500', paddingVertical: 12, paddingHorizontal: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', marginBottom: 20 },
  effortPickerRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  effortPickerBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
  effortPickerBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  editDestructiveRow: { flexDirection: 'row', gap: 8, marginBottom: 12, marginTop: 4 },
  editArchiveBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(100,116,139,0.5)', borderRadius: 10 },
  editArchiveBtnText: { color: 'rgba(148,163,184,0.9)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  editDeleteBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.5)', borderRadius: 10 },
  editDeleteBtnText: { color: 'rgba(239,68,68,0.9)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  evidenceLabel: { color: 'white', fontSize: 14, fontWeight: '700', letterSpacing: 2, marginTop: 14, marginBottom: 6 },
  evidenceInput: { color: THEME.border, fontSize: 14, fontWeight: '700', letterSpacing: 2, paddingVertical: 8, paddingHorizontal: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)' },
  evidencePreview: { color: THEME.textDim, fontSize: 14, letterSpacing: 1 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 16, marginRight: 12 },
  cancelBtnText: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  submitBtn: { paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: THEME.accent, borderRadius: 12 },
  submitBtnText: { color: THEME.accent, fontSize: 14, fontWeight: '700', letterSpacing: 2 },

  // Coordinate edit
  coordinateEditCard: { backgroundColor: THEME.card, borderRadius: 12, padding: 20, maxWidth: 400, width: '100%', shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 },
  coordDetailName: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' },
  coordDetailNameInput: { color: '#f0f4ff', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', paddingVertical: 4, paddingHorizontal: 0 },
  coordDetailSubtext: { color: THEME.textDim, fontSize: 13, lineHeight: 18, marginBottom: 20 },
  reflectionQuestion: { color: '#E2E8F0', fontSize: 15, fontWeight: '700', letterSpacing: 2, marginBottom: 20, textAlign: 'center', lineHeight: 22 },
  calibrationFeedLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase' },
  coordEditTaskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)' },
  coordEditTaskTitle: { color: 'white', fontSize: 14, flex: 1, marginLeft: 10 },
  coordEditDoneBtn: { paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: '#475569', borderRadius: 12 },
  coordEditDoneText: { color: '#475569', fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  addCoordinateBtn: { marginTop: 8, paddingVertical: 12, alignItems: 'center', borderRadius: 4 },
  addCoordinateText: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2 },

  // Slider (shared by coord edit)
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  sliderTrack: { flex: 1, height: 24, justifyContent: 'center' },
  sliderLine: { height: 2, width: '100%', backgroundColor: 'rgba(255,255,255,0.1)' },
  sliderFill: { position: 'absolute', left: 0, top: 11, height: 2, opacity: 0.6 },
  sliderHandle: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: 'transparent', borderWidth: 2, borderColor: '#38BDF8', top: 6, justifyContent: 'center', alignItems: 'center', shadowColor: '#38BDF8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },
  sliderHandleInner: { width: 6, height: 6, borderRadius: 3 },
  valueCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: THEME.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  valueCircleText: { fontSize: 22, fontWeight: '200' },

  // Task edit
  taskEditCard: { backgroundColor: THEME.card, borderRadius: 12, padding: 20, maxWidth: 400, maxHeight: '85%', width: '100%', shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 },
  taskEditScroll: { maxHeight: 380 },
  taskEditChipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  taskEditFocusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingVertical: 8 },
  taskEditNotes: { color: '#94a3b8', fontSize: 14, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, minHeight: 72, textAlignVertical: 'top', marginBottom: 16 },
  addTaskCoordChip: { paddingVertical: 6, paddingHorizontal: 14, marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
  addTaskCoordChipText: { color: THEME.textDim, fontSize: 14, fontWeight: '600' },
  taskTitleStrike: { textDecorationLine: 'line-through' },

  // Auth modal
  authOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.85)' },
  authCard: { backgroundColor: THEME.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 28, paddingBottom: 40, shadowColor: THEME.glow, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 12 },
  authHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  authTitle: { color: THEME.accent, fontSize: 14, fontWeight: '800', letterSpacing: 3 },
  authCloseX: { color: THEME.textDim, fontSize: 18, fontWeight: '400' },
  authLabel: { color: THEME.textDim, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase' },
  authInput: { color: 'white', fontSize: 16, paddingVertical: 12, paddingHorizontal: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', marginBottom: 20 },
  authError: { color: '#FB7185', fontSize: 13, fontWeight: '600', letterSpacing: 0.5, marginBottom: 12, lineHeight: 18 },
  authSubmitBtn: { marginTop: 8, paddingVertical: 14, borderWidth: 1, borderColor: THEME.accent, borderRadius: 12, alignItems: 'center' },
  authSubmitText: { color: THEME.accent, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  authToggleBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
  authToggleText: { color: THEME.textDim, fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
});
