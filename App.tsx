import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  SafeAreaView, StatusBar, Dimensions, PanResponder, Modal,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import Svg, { Circle, Path, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './lib/supabase';
import { useAppStore } from './src/stores/useAppStore';
import { FadingBorder } from './src/components/FadingBorder';
import { THEME, NODE_COLORS, INFO_TEXTS, PERSONA_SUBTITLES } from './src/constants/theme';
import { AtlasScreen } from './src/screens/AtlasScreen';
import { NodesScreen } from './src/screens/NodesScreen';
import { TasksScreen } from './src/screens/TasksScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { OrbitalValueBadge } from './src/components/OrbitalValueBadge';

const ONBOARDING_KEY = 'calibra_onboarding_complete';
const { width } = Dimensions.get('window');

type CopilotSuggestion = { label: string; action: string; nodeId?: string; goalId?: string };

export default function App() {
  // — navigation & selection state —
  const [activeTab, setActiveTab] = useState('Atlas');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // — modal / overlay state —
  const [editingCoordinate, setEditingCoordinate] = useState<{ nodeId: string; goalId: string } | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addTaskTarget, setAddTaskTarget] = useState<{ nodeId: string; goalId: string } | null>(null);
  const [editingTask, setEditingTask] = useState<{ nodeId: string; goalId: string; taskId: string } | null>(null);
  const [editForm, setEditForm] = useState({ title: '', nodeId: '', goalId: '', isPriority: false, notes: '', dueDate: '', reminder: '' });
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [addNodeForm, setAddNodeForm] = useState({ name: '', description: '', color: NODE_COLORS[0] });
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editNodeForm, setEditNodeForm] = useState({ name: '', description: '', color: NODE_COLORS[0] });
  const [infoOpen, setInfoOpen] = useState(false);
  const [systemAccessGateOpen, setSystemAccessGateOpen] = useState(false);

  // — copilot animation state —
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotTransition, setCopilotTransition] = useState(false);

  // — AI briefing state (null = not fetched, 'loading' = in-flight, object = ready) —
  type AiBriefing = { briefingLines: { prefix: string; text: string }[]; suggest1: CopilotSuggestion; suggest2: CopilotSuggestion };
  const [aiBriefing, setAiBriefing] = useState<null | 'loading' | AiBriefing>(null);

  // — last cycle tracking — snapshot taken when user acts on a suggestion —
  type LastCycleAction = {
    action: string;
    nodeId: string;
    goalId?: string;
    goalName: string;
    nodeName: string;
    valueBefore: number;
    nodeAvgBefore: number;
  };
  const [lastCycleAction, setLastCycleAction] = useState<LastCycleAction | null>(null);
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
    updateValue, updateNode, addNode: storeAddNode, saveTaskEdit,
    toggleTask, getNodeAvg,
    setSession, loadUserData,
    setCognitiveModel,
  } = useAppStore();

  // — header — derived from persona + active tab
  const headerSubtitle = PERSONA_SUBTITLES[persona]?.[activeTab] ?? '';

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

  // — AI briefing fetch — fires when copilot opens while signed in —
  useEffect(() => {
    if (!copilotOpen || !session) { setAiBriefing(null); return; }
    setAiBriefing('loading');
    supabase.functions.invoke('calibra-ai', {
      body: { nodes, cognitiveModel },
    }).then(({ data, error }) => {
      if (error || !data?.briefingLines) { setAiBriefing(null); return; }
      setAiBriefing(data as AiBriefing);
    }).catch(() => setAiBriefing(null));
  }, [copilotOpen, session]);

  // — copilot content —
  const copilotContent = useMemo(() => {
    const getAvg = (node: typeof nodes[0]) => node.goals.reduce((acc, g) => acc + g.value, 0) / (node.goals.length || 1);
    const getAvgStr = (node: typeof nodes[0]) => getAvg(node).toFixed(1);
    type Action = 'calibrate' | 'logEvidence' | 'prioritize' | 'deployTask';
    type Line = { prefix: string; text: string };
    let briefingLines: Line[] = [];
    let suggest1: CopilotSuggestion = { label: `Your ${(nodes[0]?.name || 'node').toUpperCase()} node requires review; calibrate its coordinates.`, action: 'calibrate', nodeId: nodes[0]?.id };
    let suggest2: CopilotSuggestion = { label: `Your ${(nodes[0]?.goals?.[0]?.name || 'coordinate').toUpperCase()} coordinate needs evidence; log it to strengthen alignment.`, action: 'logEvidence', nodeId: nodes[0]?.id, goalId: nodes[0]?.goals[0]?.id };

    if (activeTab === 'Atlas' || activeTab === 'Nodes' || activeTab === 'Profile') {
      const withAvg = nodes.map(n => ({ node: n, avg: getAvg(n) })).sort((a, b) => b.avg - a.avg);
      const highest = withAvg[0];
      const lowest = withAvg[withAvg.length - 1];
      const delta = highest && lowest && highest.node.id !== lowest.node.id ? (highest.avg - lowest.avg).toFixed(1) : '0';
      if (activeTab === 'Nodes') {
        const needsCal = nodes.flatMap(n => n.goals.filter(g => g.value < 6).map(g => ({ n, g, v: g.value })));
        const needEvidence = nodes.flatMap(n => n.goals.filter(g => !g.evidence?.trim()).map(g => ({ n, g })));
        if (needsCal.length) briefingLines.push({ prefix: '> STATUS:', text: `${needsCal.length} COORDINATE(S) BELOW 6 — ${needsCal.map(c => `${c.g.name.toUpperCase()} (${c.n.name.toUpperCase()}): ${c.v}`).join('; ')}.` });
        if (needEvidence.length) briefingLines.push({ prefix: '> EVIDENCE REQUIRED:', text: `${needEvidence.length} COORDINATE(S) LACK EVIDENCE — ${needEvidence.slice(0, 3).map(e => `${e.g.name.toUpperCase()} (${e.n.name.toUpperCase()})`).join('; ')}.` });
        if (briefingLines.length === 0) briefingLines = [{ prefix: '> STATUS:', text: 'ALL COORDINATES CALIBRATED. ALL EVIDENCE LOGGED.' }];
      } else if (activeTab === 'Profile') {
        briefingLines = [{ prefix: '> STATUS:', text: `${cognitiveModel.toUpperCase()} ARCHETYPE. PROFILE LOADED.` }];
      } else {
        if (highest && lowest && delta !== '0') {
          briefingLines = [
            { prefix: '> STATUS:', text: `THE ATLAS IS WEIGHTED TOWARD ${highest.node.name.toUpperCase()} (${getAvgStr(highest.node)}).` },
            { prefix: '> ALERT:', text: `${lowest.node.name.toUpperCase()} (${getAvgStr(lowest.node)}) TRAILING BY ${delta} POINTS, STRUCTURAL DRIFT.` },
          ];
        } else if (withAvg.length) {
          briefingLines = [{ prefix: '> STATUS:', text: `THE ATLAS SHOWS UNIFORM WEIGHTS. ${withAvg[0].node.name.toUpperCase()} LEADS AT ${getAvgStr(withAvg[0].node)}.` }];
        } else {
          briefingLines = [{ prefix: '> STATUS:', text: 'NO NODES DEFINED. ADD NODES TO BUILD THE ATLAS.' }];
        }
      }
      suggest1 = { label: `Your ${(lowest?.node?.name || 'node').toUpperCase()} node requires review; calibrate its coordinates.`, action: 'calibrate', nodeId: lowest?.node.id };
      const goalForEvidence = highest?.node.goals.find(g => !g.evidence?.trim()) || highest?.node.goals[0];
      suggest2 = { label: `Your ${(goalForEvidence?.name || 'coordinate').toUpperCase()} coordinate in ${(highest?.node?.name || 'node').toUpperCase()} needs evidence; log it to strengthen alignment.`, action: 'logEvidence', nodeId: highest?.node.id, goalId: goalForEvidence?.id };
    } else if (activeTab === 'Tasks') {
      const allTasks = nodes.flatMap(n => n.goals.flatMap(g => g.tasks.map(t => ({ ...t, nodeId: n.id, goalId: g.id, goalName: g.name }))));
      const completed = allTasks.filter(t => t.completed).length;
      const pending = allTasks.filter(t => !t.completed).length;
      const byCoord: Record<string, { nodeId: string; goalId: string; goalName: string; pending: number }> = {};
      nodes.forEach(n => n.goals.forEach(g => {
        const p = g.tasks.filter(t => !t.completed).length;
        if (p > 0) { const k = `${n.id}-${g.id}`; if (!byCoord[k] || p > byCoord[k].pending) byCoord[k] = { nodeId: n.id, goalId: g.id, goalName: g.name, pending: p }; }
      }));
      const topCoord = Object.values(byCoord).sort((a, b) => b.pending - a.pending)[0];
      const needsNode = nodes.map(n => ({ node: n, avg: n.goals.reduce((acc, g) => acc + g.value, 0) / (n.goals.length || 1) })).sort((a, b) => a.avg - b.avg)[0]?.node;
      briefingLines = [
        { prefix: '> STATUS:', text: `DAILY VELOCITY — ${completed} COMPLETED, ${pending} PENDING.` },
        { prefix: topCoord ? '> ALERT:' : '> STATUS:', text: topCoord ? `${topCoord.goalName.toUpperCase()} HAS HIGHEST PENDING LOAD (${topCoord.pending} TASK${topCoord.pending !== 1 ? 'S' : ''}).` : 'NO PENDING TASK.' },
      ];
      suggest1 = { label: `Your ${(topCoord?.goalName || 'coordinate').toUpperCase()} coordinate has pending work; prioritize and plan.`, action: 'prioritize', nodeId: topCoord?.nodeId, goalId: topCoord?.goalId };
      suggest2 = { label: `Your ${(needsNode?.name || 'mind').toUpperCase()} node could use a new task; deploy one to build momentum.`, action: 'deployTask', nodeId: needsNode?.id, goalId: needsNode?.goals[0]?.id };
    }
    return { briefingLines, suggest1, suggest2 };
  }, [activeTab, nodes, cognitiveModel]);

  // — briefing highlight —
  const briefingHighlight = useMemo(() => {
    const wordToColor: Record<string, string> = { EVIDENCE: '#22D3EE' };
    const canon = (n: typeof nodes[0]) =>
      n.id === 'mind' || n.name.toLowerCase() === 'mind' ? '#22D3EE' :
      n.id === 'body' || n.name.toLowerCase() === 'body' ? '#FB7185' :
      n.id === 'home' || n.name.toLowerCase() === 'home' ? '#A78BFA' : (n.color || THEME.border);
    nodes.forEach(n => {
      wordToColor[n.name.toUpperCase()] = canon(n);
      n.goals.forEach(g => { wordToColor[g.name.toUpperCase()] = canon(n); });
    });
    const keywords = Object.keys(wordToColor).filter(Boolean).sort((a, b) => b.length - a.length);
    const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`(\\d+\\.?\\d*|${escaped.join('|')})`, 'gi');
    return { wordToColor, re };
  }, [nodes]);

  // — suggestion handler —
  const handleSuggestion = useCallback((s: CopilotSuggestion) => {
    // Snapshot before-state for Last Cycle recap
    const node = nodes.find(n => n.id === s.nodeId);
    const goal = node?.goals.find(g => g.id === s.goalId);
    if (node) {
      setLastCycleAction({
        action: s.action,
        nodeId: s.nodeId || '',
        goalId: s.goalId,
        goalName: goal?.name || node.goals[0]?.name || '',
        nodeName: node.name,
        valueBefore: goal?.value ?? node.goals[0]?.value ?? 0,
        nodeAvgBefore: parseFloat(getNodeAvg(node)),
      });
    }
    if (s.action === 'calibrate' && s.nodeId) { setActiveTab('Nodes'); setSelectedNodeId(s.nodeId); }
    else if (s.action === 'logEvidence' && s.nodeId && s.goalId) { setEditingCoordinate({ nodeId: s.nodeId, goalId: s.goalId }); }
    else if (s.action === 'prioritize' && s.nodeId && s.goalId) { setEditingCoordinate({ nodeId: s.nodeId, goalId: s.goalId }); }
    else if (s.action === 'deployTask') {
      const { nodeId, goalId } = s.nodeId && s.goalId ? { nodeId: s.nodeId, goalId: s.goalId }
        : nodes[0]?.goals[0] ? { nodeId: nodes[0].id, goalId: nodes[0].goals[0].id }
        : { nodeId: '', goalId: '' };
      if (nodeId && goalId) { setAddTaskTarget({ nodeId, goalId }); setAddTaskOpen(true); }
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
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

          {/* Screens */}
          {activeTab === 'Atlas' && (
            <AtlasScreen
              copilotContent={copilotContent}
              briefingHighlight={briefingHighlight}
              onHandleSuggestion={handleSuggestion}
            />
          )}
          {activeTab === 'Nodes' && (
            <NodesScreen
              selectedNodeId={selectedNodeId}
              setSelectedNodeId={setSelectedNodeId}
              onOpenCoordEdit={(nodeId, goalId) => setEditingCoordinate({ nodeId, goalId })}
              onOpenAddNode={() => { setAddNodeForm({ name: '', description: '', color: NODE_COLORS[0] }); setAddNodeOpen(true); }}
              onOpenEditNode={(nodeId) => setEditingNodeId(nodeId)}
              onOpenSystemGate={() => setSystemAccessGateOpen(true)}
            />
          )}
          {activeTab === 'Tasks' && (
            <TasksScreen
              addTaskOpen={addTaskOpen}
              setAddTaskOpen={setAddTaskOpen}
              addTaskTarget={addTaskTarget}
              setAddTaskTarget={setAddTaskTarget}
              selectedNodeId={selectedNodeId}
              onOpenEditTask={(nodeId, goalId, taskId) => {
                const node = nodes.find(n => n.id === nodeId);
                const goal = node?.goals.find(g => g.id === goalId);
                const task = goal?.tasks.find(t => t.id === taskId);
                if (task) {
                  setEditForm({ title: task.title, nodeId, goalId, isPriority: !!task.isPriority, notes: task.notes || '', dueDate: task.dueDate || '', reminder: task.reminder || '' });
                  setEditingTask({ nodeId, goalId, taskId });
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
      <View style={styles.nav}>
        {(['Atlas', 'Nodes', 'Tasks', 'Profile'] as const).map(t => {
          const active = activeTab === t;
          const c = active ? THEME.accent : THEME.textDim;
          return (
            <TouchableOpacity key={t} onPress={() => setActiveTab(t)} style={styles.navBtn}>
              <View style={styles.navIconWrap}>
                {t === 'Atlas' && (
                  <Svg width={28} height={28} viewBox="0 0 1024 1024">
                    <Path fill={c} d="M511.8 1023.7C229.6 1023.7 0 794.1 0 511.8S229.6 0 511.8 0s511.8 229.6 511.8 511.8-229.5 511.9-511.8 511.9z m0-938.4c-235.2 0-426.5 191.3-426.5 426.5s191.3 426.5 426.5 426.5S938.3 747 938.3 511.8 747 85.3 511.8 85.3z" />
                    <Path fill={c} d="M292.7 773.7c-11.1 0-22-4.4-30.2-12.5-11.8-11.7-15.6-29.3-9.9-44.9l96.9-263.5c17.9-48.7 54.6-85.4 103.3-103.3l263.5-96.9c15.6-5.7 33.1-1.9 44.9 9.9 11.8 11.7 15.6 29.3 9.9 44.9l-96.9 263.5c-17.9 48.7-54.6 85.4-103.3 103.3l-263.5 96.9c-4.8 1.8-9.8 2.6-14.7 2.6z m366.5-409.2l-176.8 65c-25.6 9.4-43.3 27.2-52.7 52.7L364.6 659l176.8-65c25.6-9.4 43.3-27.2 52.7-52.7l65.1-176.8z" />
                  </Svg>
                )}
                {t === 'Nodes' && (
                  <Svg width={22} height={22} viewBox="0 0 24 24">
                    <G fill="none" stroke={c} strokeWidth={1.5}>
                      <Path strokeLinecap="round" d="m13.5 7l3.5 3.5m-10 3l3.5 3.5m0-10L7 10.5m10 3L13.5 17" />
                      <Circle cx="12" cy="5.5" r="2" /><Circle cx="12" cy="18.5" r="2" />
                      <Circle cx="5.5" cy="12" r="2" /><Circle cx="18.5" cy="12" r="2" />
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
                <Text style={styles.editFormLabel}>COLOR</Text>
                <View style={styles.addNodeColorRow}>
                  {NODE_COLORS.map(c => (
                    <TouchableOpacity key={c} onPress={() => setAddNodeForm(f => ({ ...f, color: c }))} activeOpacity={0.8} style={[styles.addNodeSwatch, { backgroundColor: c }, addNodeForm.color === c && styles.addNodeSwatchSelected]} />
                  ))}
                </View>
                <Text style={styles.editFormLabel}>TITLE</Text>
                <TextInput style={styles.editFormInput} value={addNodeForm.name} onChangeText={t => setAddNodeForm(f => ({ ...f, name: t }))} placeholder="Node name" placeholderTextColor={THEME.textDim} />
                <Text style={styles.evidenceLabel}>DEFINE THE DESIRED INTENT</Text>
                <TextInput style={[styles.evidenceInput, { marginBottom: 16 }]} value={addNodeForm.description} onChangeText={t => setAddNodeForm(f => ({ ...f, description: t }))} placeholder="Intent or purpose…" placeholderTextColor={THEME.textDim} />
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => { setAddNodeOpen(false); setAddNodeForm({ name: '', description: '', color: NODE_COLORS[0] }); }} activeOpacity={0.7}>
                    <Text style={styles.cancelBtnText}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.submitBtn} onPress={handleAddNode} activeOpacity={0.7}>
                    <Text style={styles.submitBtnText}>ADD NODE</Text>
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
                <Text style={styles.editFormLabel}>COLOR</Text>
                <View style={styles.addNodeColorRow}>
                  {NODE_COLORS.map(c => (
                    <TouchableOpacity key={c} onPress={() => setEditNodeForm(f => ({ ...f, color: c }))} activeOpacity={0.8} style={[styles.addNodeSwatch, { backgroundColor: c }, editNodeForm.color === c && styles.addNodeSwatchSelected]} />
                  ))}
                </View>
                <Text style={styles.editFormLabel}>TITLE</Text>
                <TextInput style={styles.editFormInput} value={editNodeForm.name} onChangeText={t => setEditNodeForm(f => ({ ...f, name: t }))} placeholder="Node name" placeholderTextColor={THEME.textDim} />
                <Text style={styles.evidenceLabel}>DEFINE THE DESIRED INTENT</Text>
                <TextInput style={[styles.evidenceInput, { marginBottom: 16 }]} value={editNodeForm.description} onChangeText={t => setEditNodeForm(f => ({ ...f, description: t }))} placeholder="Intent or purpose…" placeholderTextColor={THEME.textDim} />
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditingNodeId(null); setEditNodeForm({ name: '', description: '', color: NODE_COLORS[0] }); }} activeOpacity={0.7}>
                    <Text style={styles.cancelBtnText}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.submitBtn} onPress={() => { if (editNodeForm.name.trim() && editingNodeId) { updateNode(editingNodeId, { name: editNodeForm.name.trim(), description: editNodeForm.description.trim(), color: editNodeForm.color }); setEditingNodeId(null); setEditNodeForm({ name: '', description: '', color: NODE_COLORS[0] }); } }} activeOpacity={0.7}>
                    <Text style={styles.submitBtnText}>SAVE</Text>
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
                <Text style={styles.coordDetailName}>{goal.name}</Text>
                <Text style={styles.coordDetailSubtext}>Reflect on this coordinate and use the slider to evaluate yourself. Add calibrations below to keep you on your path.</Text>
                <Text style={styles.reflectionQuestion}>HOW IS THE INTEGRITY OF THIS COORDINATE?</Text>
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
                {goal.tasks.length === 0 ? (
                  <Text style={[styles.evidencePreview, { marginBottom: 8 }]}>No calibrations yet</Text>
                ) : (
                  goal.tasks.map(t => (
                    <TouchableOpacity
                      key={t.id}
                      style={styles.coordEditTaskRow}
                      onPress={() => {
                        setEditForm({ title: t.title, nodeId: node.id, goalId: goal.id, isPriority: !!t.isPriority, notes: t.notes || '', dueDate: t.dueDate || '', reminder: t.reminder || '' });
                        setEditingTask({ nodeId: node.id, goalId: goal.id, taskId: t.id });
                        setEditingCoordinate(null);
                      }}
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
                <TouchableOpacity style={styles.addCoordinateBtn} onPress={() => useAppStore.getState().addTask(node.id, goal.id, 'New Task')} activeOpacity={0.7}>
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

      {/* Edit task overlay */}
      {!!editingTask && (
        <View style={styles.infoOverlay} pointerEvents="box-none">
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setEditingTask(null)} activeOpacity={1} />
          <View style={styles.taskEditCard} pointerEvents="auto">
            <ScrollView style={styles.taskEditScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.editFormLabel}>TITLE</Text>
              <TextInput style={styles.editFormInput} value={editForm.title} onChangeText={t => setEditForm(f => ({ ...f, title: t }))} placeholderTextColor={THEME.textDim} />
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
              <TextInput style={styles.taskEditNotes} value={editForm.notes} onChangeText={t => setEditForm(f => ({ ...f, notes: t }))} placeholder="Add notes…" placeholderTextColor={THEME.textDim} multiline numberOfLines={3} />
              <Text style={styles.evidenceLabel}>DUE DATE</Text>
              <TextInput style={styles.evidenceInput} value={editForm.dueDate} onChangeText={t => setEditForm(f => ({ ...f, dueDate: t }))} placeholder="YYYY-MM-DD" placeholderTextColor={THEME.textDim} />
              <Text style={styles.evidenceLabel}>REMINDER</Text>
              <TextInput style={styles.evidenceInput} value={editForm.reminder} onChangeText={t => setEditForm(f => ({ ...f, reminder: t }))} placeholder="e.g. 9:00 AM" placeholderTextColor={THEME.textDim} />
            </ScrollView>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingTask(null)} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={() => { saveTaskEdit(editingTask, editForm); setEditingTask(null); }} activeOpacity={0.7}>
                <Text style={styles.submitBtnText}>DONE</Text>
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
            {(() => {
              const displayContent = (aiBriefing && aiBriefing !== 'loading') ? aiBriefing : copilotContent;
              const isLoading = aiBriefing === 'loading';
              return (
                <View style={styles.copilotCard} pointerEvents="auto">
                  <View style={styles.copilotCardHeader}>
                    <Text style={styles.copilotTitle}>CO-PILOT // V1.0</Text>
                    <TouchableOpacity onPress={() => setCopilotOpen(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7}>
                      <Text style={styles.copilotCloseX}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  {/* Last Cycle recap */}
                  {lastCycleAction && (() => {
                    const lcNode = nodes.find(n => n.id === lastCycleAction.nodeId);
                    const lcGoal = lcNode?.goals.find(g => g.id === lastCycleAction.goalId);
                    const nodeAvgNow = lcNode ? parseFloat(getNodeAvg(lcNode)) : lastCycleAction.nodeAvgBefore;
                    const delta = nodeAvgNow - lastCycleAction.nodeAvgBefore;
                    const improving = delta > 0.05;
                    const declining = delta < -0.05;
                    const deltaColor = improving ? '#4ade80' : declining ? '#fb7185' : THEME.textDim;
                    const actionLabel: Record<string, string> = {
                      calibrate: 'CALIBRATED', logEvidence: 'EVIDENCE LOGGED',
                      prioritize: 'REVIEWED', deployTask: 'TASK DEPLOYED',
                    };
                    const valueChanged = lcGoal && lastCycleAction.action === 'calibrate' && lcGoal.value !== lastCycleAction.valueBefore;
                    return (
                      <>
                        <Text style={[styles.copilotHeading, { marginTop: 0 }]}>LAST CYCLE</Text>
                        <View style={styles.copilotLastCycleCard}>
                          <Text style={styles.copilotLastCycleAction}>
                            {actionLabel[lastCycleAction.action] || 'ACTIONED'} · {lastCycleAction.goalName.toUpperCase()} ({lastCycleAction.nodeName.toUpperCase()})
                          </Text>
                          {valueChanged && lcGoal && (
                            <Text style={styles.copilotLastCycleDetail}>
                              {lastCycleAction.valueBefore} → {lcGoal.value}
                            </Text>
                          )}
                          <Text style={[styles.copilotLastCycleDelta, { color: deltaColor }]}>
                            NODE AVG {delta >= 0 ? '+' : ''}{delta.toFixed(1)} · {improving ? 'MOMENTUM IMPROVING' : declining ? 'NEEDS ATTENTION' : 'STABLE'}
                          </Text>
                        </View>
                      </>
                    );
                  })()}
                  <Text style={[styles.copilotHeading, { marginTop: lastCycleAction ? 12 : 0 }]}>
                    {isLoading ? 'BRIEFING  ···' : 'BRIEFING'}
                  </Text>
                  {displayContent.briefingLines.map((line, lineIdx) => {
                    const parts = line.text.split(briefingHighlight.re).filter(Boolean);
                    return (
                      <View key={lineIdx} style={[styles.copilotBriefingLine, isLoading && { opacity: 0.4 }]}>
                        <Text style={styles.copilotBriefingPrefix}>{line.prefix} </Text>
                        <Text style={styles.copilotBriefingBody}>
                          {parts.map((part, i) => {
                            if (/^\d+\.?\d*$/.test(part)) return <Text key={i} style={styles.copilotBriefingNum}>{part}</Text>;
                            const col = briefingHighlight.wordToColor[part.toUpperCase()];
                            return col ? <Text key={i} style={{ color: col }}>{part}</Text> : <Text key={i}>{part}</Text>;
                          })}
                        </Text>
                      </View>
                    );
                  })}
                  <Text style={styles.copilotHeading}>SUGGESTIONS</Text>
                  {[displayContent.suggest1, displayContent.suggest2].map((sug, idx) => (
                    <TouchableOpacity key={idx} style={[styles.copilotSuggestionBtn, isLoading && { opacity: 0.4 }]} onPress={() => { if (!isLoading) { setCopilotOpen(false); handleSuggestion(sug); } }} activeOpacity={0.8}>
                      <Text style={styles.copilotSuggestionBtnText}>
                        {sug.label.split(briefingHighlight.re).filter(Boolean).map((part, i) => {
                          const col = briefingHighlight.wordToColor[part.toUpperCase()];
                          return col ? <Text key={i} style={{ color: col }}>{part}</Text> : <Text key={i}>{part}</Text>;
                        })}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })()}
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
  headerSubtitle: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  headerInfoBtn: { padding: 4 },

  // Nav
  nav: { flexDirection: 'row', height: 100, borderTopWidth: 1, borderTopColor: THEME.cardBorder, backgroundColor: THEME.card, position: 'absolute', bottom: 0, width: '100%', overflow: 'hidden', paddingHorizontal: 16 },
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
  addNodeCard: { backgroundColor: THEME.card, borderRadius: 12, padding: 20, maxWidth: 400, width: '100%', shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 },
  addNodeColorRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
  addNodeSwatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent', marginRight: 10, marginBottom: 10 },
  addNodeSwatchSelected: { borderColor: '#E2E8F0' },

  // Form shared
  editFormLabel: { color: 'white', fontSize: 14, fontWeight: '800', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' },
  editFormInput: { color: 'white', fontSize: 16, fontWeight: '500', paddingVertical: 12, paddingHorizontal: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', marginBottom: 20 },
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
  taskEditNotes: { color: THEME.border, fontSize: 14, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, minHeight: 72, textAlignVertical: 'top', marginBottom: 16 },
  addTaskCoordChip: { paddingVertical: 8, paddingHorizontal: 12, marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 4 },
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
