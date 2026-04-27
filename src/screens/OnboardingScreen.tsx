import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Animated, Dimensions, KeyboardAvoidingView, Platform,
} from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { THEME, MODEL_DESCRIPTIONS, MOTIVATOR_OPTIONS } from '../constants/theme';
import { CognitiveModel, PeakPeriod } from '../types';

const { width, height } = Dimensions.get('window');

const TOTAL_STEPS = 6;

// ─── Solar Mark (consistent with icon) ────────────────────────────────────────
function SolarMark({ size = 64, animated = false }: { size?: number; animated?: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!animated) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, [animated]);

  const r = size / 2;
  const orbitR = r * 0.76;
  const planetAngle = -42 * (Math.PI / 180);
  const px = r + orbitR * Math.cos(planetAngle);
  const py = r + orbitR * Math.sin(planetAngle);

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={r} cy={r} r={orbitR} stroke="#7C6AF7" strokeWidth={size * 0.036} opacity={0.9} fill="none" />
        <Circle cx={r} cy={r} r={orbitR * 0.66} fill="#7C6AF7" opacity={0.18} />
        <Circle cx={r} cy={r} r={orbitR * 0.44} fill="#7C6AF7" opacity={0.25} />
        <Circle cx={r} cy={r} r={orbitR * 0.31} fill="white" />
        <Circle cx={px} cy={py} r={size * 0.072} fill="white" />
      </Svg>
    </Animated.View>
  );
}

// ─── Progress Dots ─────────────────────────────────────────────────────────────
function ProgressDots({ step }: { step: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]}
        />
      ))}
    </View>
  );
}

// ─── Slider ────────────────────────────────────────────────────────────────────
function MiniSlider({
  value, color, onChange,
}: { value: number; color: string; onChange: (v: number) => void }) {
  const trackRef = useRef<View>(null);
  const trackWidth = useRef(0);

  const handlePress = (e: any) => {
    const x = e.nativeEvent.locationX;
    const pct = Math.max(0, Math.min(1, x / (trackWidth.current || 260)));
    const v = Math.round(pct * 9) + 1;
    onChange(v);
    Haptics.selectionAsync();
  };

  const pct = ((value - 1) / 9) * 100;

  return (
    <View style={styles.sliderWrap}>
      <View
        ref={trackRef}
        style={styles.sliderTrack}
        onLayout={e => { trackWidth.current = e.nativeEvent.layout.width; }}
        onStartShouldSetResponder={() => true}
        onResponderGrant={handlePress}
        onResponderMove={handlePress}
      >
        <View style={[styles.sliderFill, { width: `${pct}%`, backgroundColor: color }]} />
        <View style={[styles.sliderThumb, { left: `${pct}%`, borderColor: color }]} />
      </View>
      <Text style={[styles.sliderValue, { color }]}>{value}</Text>
    </View>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (data: {
    nodeUpdates: { id: string; name: string; description: string }[];
    scores: { nodeId: string; goalId: string; value: number }[];
    cognitiveModel: CognitiveModel;
    peakPeriod: PeakPeriod;
    motivators: string[];
  }) => void;
  initialNodes: { id: string; name: string; description: string; color: string; goals: { id: string; name: string; value: number }[] }[];
}

export function OnboardingScreen({ onComplete, initialNodes }: Props) {
  const [step, setStep] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Step 2 — node names
  const [nodeNames, setNodeNames] = useState<Record<string, string>>(
    Object.fromEntries(initialNodes.map(n => [n.id, n.name]))
  );
  const [nodeDescs, setNodeDescs] = useState<Record<string, string>>(
    Object.fromEntries(initialNodes.map(n => [n.id, n.description]))
  );

  // Step 3 — profile
  const [cogModel, setCogModel] = useState<CognitiveModel>('Architect');
  const [peakPeriod, setPeakPeriod] = useState<PeakPeriod>('MORNING');
  const [motivators, setMotivators] = useState<string[]>([]);

  // Step 4 — calibration
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(
      initialNodes.flatMap(n => n.goals.map(g => [g.id, g.value]))
    )
  );

  // Step 5 — auth
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -20, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    setStep(s => s + 1);
  };

  const finish = (skipAuth = false) => {
    onComplete({
      nodeUpdates: initialNodes.map(n => ({
        id: n.id,
        name: nodeNames[n.id] ?? n.name,
        description: nodeDescs[n.id] ?? n.description,
      })),
      scores: initialNodes.flatMap(n =>
        n.goals.map(g => ({ nodeId: n.id, goalId: g.id, value: scores[g.id] ?? g.value }))
      ),
      cognitiveModel: cogModel,
      peakPeriod,
      motivators,
    });
  };

  const handleSignUp = async () => {
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError('Enter your email and a password.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signUp({
      email: authEmail.trim(),
      password: authPassword,
    });
    setAuthLoading(false);
    if (error) { setAuthError(error.message); return; }
    finish();
  };

  const toggleMotivator = (m: string) => {
    setMotivators(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : prev.length < 3 ? [...prev, m] : prev
    );
    Haptics.selectionAsync();
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View style={[styles.content, { transform: [{ translateX: slideAnim }] }]}>
        {/* ── Step 0: Welcome ───────────────────────────────────────────────── */}
        {step === 0 && (
          <View style={styles.centerContent}>
            <SolarMark size={96} animated />
            <Text style={styles.welcomeTitle}>CALIBRA</Text>
            <Text style={styles.welcomeSubtitle}>Your personal performance system</Text>
            <Text style={styles.welcomeBody}>
              Track the areas of your life that matter most. Calibrate your baseline. Let the system show you where to focus.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={goNext}>
              <Text style={styles.primaryBtnText}>BEGIN CALIBRATION</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 1: The System ────────────────────────────────────────────── */}
        {step === 1 && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepLabel}>HOW IT WORKS</Text>
            <Text style={styles.stepTitle}>Three layers. One system.</Text>
            <Text style={styles.stepBody}>
              Everything in Calibra is organized into three layers. Understanding this is all you need to get started.
            </Text>

            {[
              {
                label: 'NODE',
                example: 'Mind',
                desc: 'A top-level area of your life — the big categories you want to keep in balance.',
                color: THEME.mind,
              },
              {
                label: 'COORDINATE',
                example: 'Meditation',
                desc: 'The specific pillars that make up each node. These are what you actually score.',
                color: THEME.body,
              },
              {
                label: 'TASK',
                example: '10m focus session',
                desc: 'The daily actions that move your coordinates. Evidence that justifies your score.',
                color: THEME.home,
              },
            ].map((item, i) => (
              <View key={i} style={[styles.systemRow, { borderLeftColor: item.color }]}>
                <View style={styles.systemRowHeader}>
                  <Text style={[styles.systemLabel, { color: item.color }]}>{item.label}</Text>
                  <Text style={styles.systemExample}>"{item.example}"</Text>
                </View>
                <Text style={styles.systemDesc}>{item.desc}</Text>
              </View>
            ))}

            <View style={styles.bottomBar}>
              <ProgressDots step={step} />
              <TouchableOpacity style={styles.primaryBtn} onPress={goNext}>
                <Text style={styles.primaryBtnText}>NEXT</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* ── Step 2: Name Your Nodes ───────────────────────────────────────── */}
        {step === 2 && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepLabel}>STEP 1 OF 4</Text>
            <Text style={styles.stepTitle}>Name your life areas</Text>
            <Text style={styles.stepBody}>
              These are your three core nodes. The defaults work great — or make them yours.
            </Text>

            {initialNodes.map(node => (
              <View key={node.id} style={[styles.nodeCard, { borderLeftColor: node.color }]}>
                <View style={[styles.nodeColorDot, { backgroundColor: node.color }]} />
                <View style={styles.nodeInputs}>
                  <TextInput
                    style={[styles.nodeNameInput, { borderBottomColor: node.color + '55' }]}
                    value={nodeNames[node.id]}
                    onChangeText={v => setNodeNames(p => ({ ...p, [node.id]: v }))}
                    placeholder="Node name"
                    placeholderTextColor="#444"
                    maxLength={24}
                    autoCapitalize="words"
                  />
                  <TextInput
                    style={styles.nodeDescInput}
                    value={nodeDescs[node.id]}
                    onChangeText={v => setNodeDescs(p => ({ ...p, [node.id]: v }))}
                    placeholder="Short descriptor (e.g. CLARITY & FOCUS)"
                    placeholderTextColor="#333"
                    maxLength={32}
                    autoCapitalize="characters"
                  />
                </View>
              </View>
            ))}

            <View style={styles.bottomBar}>
              <ProgressDots step={step} />
              <TouchableOpacity style={styles.primaryBtn} onPress={goNext}>
                <Text style={styles.primaryBtnText}>NEXT</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* ── Step 3: Profile ───────────────────────────────────────────────── */}
        {step === 3 && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepLabel}>STEP 2 OF 4</Text>
            <Text style={styles.stepTitle}>Your operating profile</Text>
            <Text style={styles.stepBody}>
              This shapes how the AI co-pilot talks to you and what it prioritizes.
            </Text>

            {/* Cognitive Model */}
            <Text style={styles.sectionLabel}>ARCHETYPE</Text>
            <View style={styles.modelGrid}>
              {(['Architect', 'Strategist', 'Builder', 'Analyst'] as CognitiveModel[]).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modelCard, cogModel === m && styles.modelCardActive]}
                  onPress={() => { setCogModel(m); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.modelName, cogModel === m && styles.modelNameActive]}>{m.toUpperCase()}</Text>
                  <Text style={styles.modelDesc} numberOfLines={2}>{MODEL_DESCRIPTIONS[m]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Peak Period */}
            <Text style={styles.sectionLabel}>PEAK PERIOD</Text>
            <View style={styles.peakRow}>
              {(['MORNING', 'EVENING'] as PeakPeriod[]).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.peakBtn, peakPeriod === p && styles.peakBtnActive]}
                  onPress={() => { setPeakPeriod(p); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.peakText, peakPeriod === p && styles.peakTextActive]}>
                    {p === 'MORNING' ? '☀️  MORNING' : '🌙  EVENING'}
                  </Text>
                  <Text style={styles.peakSub}>{p === 'MORNING' ? '06:00 – 12:00' : '18:00 – 00:00'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Motivators */}
            <Text style={styles.sectionLabel}>MOTIVATORS <Text style={styles.sectionSub}>(pick up to 3)</Text></Text>
            <View style={styles.motivatorGrid}>
              {MOTIVATOR_OPTIONS.map(m => {
                const selected = motivators.includes(m);
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.motivatorChip, selected && styles.motivatorChipActive]}
                    onPress={() => toggleMotivator(m)}
                  >
                    <Text style={[styles.motivatorText, selected && styles.motivatorTextActive]}>{m}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.bottomBar}>
              <ProgressDots step={step} />
              <TouchableOpacity style={styles.primaryBtn} onPress={goNext}>
                <Text style={styles.primaryBtnText}>NEXT</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* ── Step 4: Calibration ───────────────────────────────────────────── */}
        {step === 4 && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepLabel}>STEP 3 OF 4</Text>
            <Text style={styles.stepTitle}>Baseline calibration</Text>
            <Text style={styles.stepBody}>
              Where are you right now? Be honest — this is your starting point, not a report card.
            </Text>

            {initialNodes.map(node => (
              <View key={node.id} style={styles.calibrateNode}>
                <View style={styles.calibrateNodeHeader}>
                  <View style={[styles.nodeColorDot, { backgroundColor: node.color }]} />
                  <Text style={[styles.calibrateNodeName, { color: node.color }]}>
                    {nodeNames[node.id] ?? node.name}
                  </Text>
                </View>
                {node.goals.map(goal => (
                  <View key={goal.id} style={styles.calibrateRow}>
                    <Text style={styles.calibrateGoalName}>{goal.name}</Text>
                    <MiniSlider
                      value={scores[goal.id] ?? goal.value}
                      color={node.color}
                      onChange={v => setScores(p => ({ ...p, [goal.id]: v }))}
                    />
                  </View>
                ))}
              </View>
            ))}

            <View style={styles.bottomBar}>
              <ProgressDots step={step} />
              <TouchableOpacity style={styles.primaryBtn} onPress={goNext}>
                <Text style={styles.primaryBtnText}>NEXT</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* ── Step 5: Sign Up ───────────────────────────────────────────────── */}
        {step === 5 && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.authTop}>
              <SolarMark size={56} />
            </View>
            <Text style={styles.stepLabel}>STEP 4 OF 4</Text>
            <Text style={styles.stepTitle}>Lock in your data</Text>
            <Text style={styles.stepBody}>
              Create an account to sync across devices and unlock the AI co-pilot. Your data stays yours.
            </Text>

            <View style={styles.benefitsRow}>
              {['Sync across devices', 'AI co-pilot briefings', 'Automatic backup'].map(b => (
                <View key={b} style={styles.benefit}>
                  <Text style={styles.benefitDot}>◆</Text>
                  <Text style={styles.benefitText}>{b}</Text>
                </View>
              ))}
            </View>

            <TextInput
              style={styles.authInput}
              placeholder="Email"
              placeholderTextColor="#444"
              value={authEmail}
              onChangeText={setAuthEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.authInput}
              placeholder="Password"
              placeholderTextColor="#444"
              value={authPassword}
              onChangeText={setAuthPassword}
              secureTextEntry
            />
            {!!authError && <Text style={styles.authError}>{authError}</Text>}

            <TouchableOpacity
              style={[styles.primaryBtn, authLoading && { opacity: 0.6 }]}
              onPress={handleSignUp}
              disabled={authLoading}
            >
              <Text style={styles.primaryBtnText}>{authLoading ? 'CREATING ACCOUNT…' : 'CREATE ACCOUNT'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipBtn} onPress={() => finish(true)}>
              <Text style={styles.skipText}>SKIP FOR NOW  →</Text>
            </TouchableOpacity>

            <View style={styles.bottomBarSlim}>
              <ProgressDots step={step} />
            </View>
          </ScrollView>
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#08080F',
  },
  content: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 48,
  },

  // ── Welcome ──
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 8,
    marginTop: 28,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#7C6AF7',
    letterSpacing: 2,
    marginBottom: 24,
    textTransform: 'uppercase',
  },
  welcomeBody: {
    fontSize: 15,
    color: '#6060a0',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 48,
  },

  // ── Step headers ──
  stepLabel: {
    fontSize: 11,
    color: '#7C6AF7',
    letterSpacing: 3,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  stepBody: {
    fontSize: 14,
    color: '#6060a0',
    lineHeight: 22,
    marginBottom: 28,
  },

  // ── System rows ──
  systemRow: {
    borderLeftWidth: 3,
    paddingLeft: 16,
    paddingVertical: 12,
    marginBottom: 16,
    backgroundColor: '#0c0c18',
    borderRadius: 8,
  },
  systemRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  systemLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  systemExample: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  systemDesc: {
    fontSize: 13,
    color: '#505080',
    lineHeight: 20,
  },

  // ── Node naming ──
  nodeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 3,
    backgroundColor: '#0c0c18',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  nodeColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  nodeInputs: {
    flex: 1,
  },
  nodeNameInput: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    borderBottomWidth: 1,
    paddingBottom: 4,
    marginBottom: 8,
  },
  nodeDescInput: {
    fontSize: 11,
    color: '#505080',
    letterSpacing: 1.5,
  },

  // ── Profile ──
  sectionLabel: {
    fontSize: 11,
    color: '#404068',
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionSub: {
    fontWeight: '400',
    color: '#303050',
  },
  modelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  modelCard: {
    width: (width - 64) / 2,
    backgroundColor: '#0c0c18',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1a1a2e',
    padding: 12,
  },
  modelCardActive: {
    borderColor: '#7C6AF7',
    backgroundColor: '#14122e',
  },
  modelName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#404068',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  modelNameActive: {
    color: '#7C6AF7',
  },
  modelDesc: {
    fontSize: 11,
    color: '#303050',
    lineHeight: 16,
  },
  peakRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  peakBtn: {
    flex: 1,
    backgroundColor: '#0c0c18',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1a1a2e',
    padding: 14,
    alignItems: 'center',
  },
  peakBtnActive: {
    borderColor: '#7C6AF7',
    backgroundColor: '#14122e',
  },
  peakText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#404068',
    letterSpacing: 1,
  },
  peakTextActive: {
    color: '#fff',
  },
  peakSub: {
    fontSize: 10,
    color: '#303050',
    marginTop: 4,
    letterSpacing: 1,
  },
  motivatorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 28,
  },
  motivatorChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1a1a2e',
    backgroundColor: '#0c0c18',
  },
  motivatorChipActive: {
    borderColor: '#7C6AF7',
    backgroundColor: '#14122e',
  },
  motivatorText: {
    fontSize: 11,
    color: '#404068',
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  motivatorTextActive: {
    color: '#7C6AF7',
  },

  // ── Calibration ──
  calibrateNode: {
    marginBottom: 24,
  },
  calibrateNodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  calibrateNodeName: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
  calibrateRow: {
    marginBottom: 14,
  },
  calibrateGoalName: {
    fontSize: 12,
    color: '#6060a0',
    letterSpacing: 1,
    marginBottom: 8,
  },
  sliderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sliderTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#1a1a2e',
    borderRadius: 2,
    position: 'relative',
    justifyContent: 'center',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#08080F',
    borderWidth: 2,
    marginLeft: -8,
    top: -6,
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: '700',
    width: 20,
    textAlign: 'right',
  },

  // ── Auth ──
  authTop: {
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitsRow: {
    marginBottom: 28,
    gap: 8,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitDot: {
    fontSize: 8,
    color: '#7C6AF7',
  },
  benefitText: {
    fontSize: 14,
    color: '#6060a0',
  },
  authInput: {
    backgroundColor: '#0c0c18',
    borderWidth: 1,
    borderColor: '#1a1a2e',
    borderRadius: 8,
    color: '#fff',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  authError: {
    fontSize: 12,
    color: '#FF6B8A',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  skipText: {
    fontSize: 12,
    color: '#303050',
    letterSpacing: 2,
  },
  bottomBarSlim: {
    alignItems: 'center',
    paddingTop: 8,
  },

  // ── Shared ──
  primaryBtn: {
    backgroundColor: '#7C6AF7',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 2,
  },
  bottomBar: {
    gap: 16,
    marginTop: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1a1a2e',
  },
  dotActive: {
    backgroundColor: '#7C6AF7',
    width: 18,
  },
  dotDone: {
    backgroundColor: '#3a2e6e',
  },
});
