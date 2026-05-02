import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, Modal, ScrollView, Dimensions } from 'react-native';
import Svg, { Circle, Path, Line, Polyline, Ellipse } from 'react-native-svg';
import { Session } from '@supabase/supabase-js';
import { useAppStore } from '../stores/useAppStore';
import { useSnapshotStore, RadarSnapshot } from '../stores/useSnapshotStore';
import { Coordinates } from '../components/Coordinates';
import { SnapshotDetailModal } from '../components/SnapshotDetailModal';
import { THEME, MOTIVATOR_TENSIONS, PERSONA_DATA } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { GlassCard } from '../components/GlassCard';
import { Persona, MotivatorChoices } from '../types';

const PERSONAS: Persona[] = ['Engineer', 'Seeker', 'Spiritual'];
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 80;

interface ProfileScreenProps {
  session: Session | null;
  onSignIn: () => void;
  onSignUp: () => void;
  onSignOut: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ session, onSignIn, onSignUp, onSignOut }) => {
  const {
    cognitiveModel, setCognitiveModel,
    persona,
    motivatorChoices, setMotivatorChoices,
    identityNotes, setIdentityNotes,
    devOverride, setDevOverride,
    themeMode, setThemeMode,
  } = useAppStore();
  const theme = useTheme();

  const { snapshots, loaded, loadSnapshots } = useSnapshotStore();

  useEffect(() => {
    if (!loaded) loadSnapshots();
  }, []);

  const handleTensionSelect = (id: string, side: 'left' | 'right') => {
    setMotivatorChoices({ ...motivatorChoices, [id]: side });
  };

  // Persona modal state removed, persona is derived from motivators.
  const scrollRef = useRef<ScrollView>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<RadarSnapshot | null>(null);

  return (
    <View>
      {/* Account */}
      <GlassCard style={styles.profileCard}>
        <View style={styles.profileSectionHeaderRow}>
          <Svg width={14} height={14} viewBox="0 0 24 24" style={styles.profileSectionIcon}>
            <Circle cx="12" cy="12" r="10" fill="none" stroke={theme.textMuted} strokeWidth={1.5} />
            <Path fill="none" stroke={theme.textMuted} strokeWidth={1.5} strokeLinecap="round" d="M12 8v4m0 4h.01" />
          </Svg>
          <Text style={[styles.profileSectionLabel, { color: theme.textMuted }]}>ACCOUNT</Text>
        </View>
        {session ? (
          <View>
            <Text style={[styles.accountEmail, { color: theme.text }]}>{session.user.email}</Text>
            <View style={styles.accountStatusRow}>
              <View style={styles.accountStatusDot} />
              <Text style={styles.accountStatusText}>SIGNED IN — UNRESTRICTED ACCESS</Text>
            </View>
            <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut} activeOpacity={0.8}>
              <Text style={[styles.signOutBtnText, { color: theme.textMuted }]}>SIGN OUT</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={[styles.accountGuestNote, { color: theme.textSub }]}>You're in local mode. Sign in to unlock Co-Pilot and sync your data.</Text>
            <View style={styles.authBtnRow}>
              <TouchableOpacity style={[styles.signInBtn, { borderColor: theme.accent }]} onPress={onSignIn} activeOpacity={0.8}>
                <Text style={[styles.signInBtnText, { color: theme.accent }]}>SIGN IN</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.signUpBtn, { borderColor: theme.divider }]} onPress={onSignUp} activeOpacity={0.8}>
                <Text style={[styles.signUpBtnText, { color: theme.textSub }]}>CREATE ACCOUNT</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </GlassCard>

      {/* Persona */}
      <GlassCard style={styles.profileCard}>
      <View style={styles.profileSectionHeaderRow}>
          <Svg width={14} height={14} viewBox="0 0 24 24" style={styles.profileSectionIcon}>
            <Path fill="none" stroke={theme.textMuted} strokeWidth={1.5} strokeLinecap="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <Circle cx="12" cy="7" r="4" fill="none" stroke={theme.textMuted} strokeWidth={1.5} />
          </Svg>
          <Text style={[styles.profileSectionLabel, { color: theme.textMuted }]}>PERSONA</Text>
        </View>

        {/* Inline graphic */}
        <View style={styles.personaCardGraphic}>
          {persona === 'Engineer' && (
            <Svg width="100%" height={60} viewBox="0 0 240 80">
              <Line x1="0" y1="40" x2="240" y2="40" stroke={THEME.accent} strokeWidth="0.5" opacity="0.3" />
              <Line x1="40" y1="0" x2="40" y2="80" stroke={THEME.accent} strokeWidth="0.5" opacity="0.2" />
              <Line x1="80" y1="0" x2="80" y2="80" stroke={THEME.accent} strokeWidth="0.5" opacity="0.2" />
              <Line x1="120" y1="0" x2="120" y2="80" stroke={THEME.accent} strokeWidth="0.5" opacity="0.2" />
              <Line x1="160" y1="0" x2="160" y2="80" stroke={THEME.accent} strokeWidth="0.5" opacity="0.2" />
              <Line x1="200" y1="0" x2="200" y2="80" stroke={THEME.accent} strokeWidth="0.5" opacity="0.2" />
              <Polyline points="0,40 40,40 40,20 80,20 80,55 120,55 120,15 160,15 160,50 200,50 200,30 240,30" fill="none" stroke={THEME.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx="40" cy="20" r="3" fill={THEME.accent} />
              <Circle cx="80" cy="55" r="3" fill={THEME.accent} />
              <Circle cx="120" cy="15" r="3" fill={THEME.accent} />
              <Circle cx="160" cy="50" r="3" fill={THEME.accent} />
              <Circle cx="200" cy="30" r="3" fill={THEME.accent} />
            </Svg>
          )}
          {persona === 'Seeker' && (
            <Svg width="100%" height={60} viewBox="0 0 240 80">
              <Path d="M0,55 C40,55 40,40 80,40 C120,40 120,25 160,20 C200,15 200,30 240,25" fill="none" stroke={THEME.accent} strokeWidth="0.5" opacity="0.3" />
              <Path d="M0,55 C40,55 40,40 80,40 C120,40 120,25 160,20 C200,15 200,30 240,25" fill="none" stroke={THEME.accent} strokeWidth="2" strokeLinecap="round" />
              <Circle cx="0" cy="55" r="4" fill={THEME.accent} opacity="0.5" />
              <Circle cx="80" cy="40" r="4" fill={THEME.accent} opacity="0.7" />
              <Circle cx="160" cy="20" r="5" fill={THEME.accent} />
              <Circle cx="240" cy="25" r="4" fill={THEME.accent} opacity="0.7" />
              <Line x1="80" y1="40" x2="80" y2="65" stroke={THEME.accent} strokeWidth="1" opacity="0.25" strokeDasharray="3,3" />
              <Line x1="160" y1="20" x2="160" y2="65" stroke={THEME.accent} strokeWidth="1" opacity="0.25" strokeDasharray="3,3" />
            </Svg>
          )}
          {persona === 'Spiritual' && (
            <Svg width="100%" height={60} viewBox="0 0 240 80">
              <Path d="M0,40 C30,10 60,70 120,40 C180,10 210,70 240,40" fill="none" stroke={THEME.accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
              <Path d="M0,50 C30,20 60,80 120,50 C180,20 210,80 240,50" fill="none" stroke={THEME.accent} strokeWidth="1" strokeLinecap="round" opacity="0.2" />
              <Circle cx="40" cy="22" r="2.5" fill={THEME.accent} opacity="0.6" />
              <Circle cx="90" cy="58" r="2" fill={THEME.accent} opacity="0.5" />
              <Circle cx="120" cy="40" r="4" fill={THEME.accent} />
              <Circle cx="155" cy="18" r="2.5" fill={THEME.accent} opacity="0.6" />
              <Circle cx="200" cy="62" r="2" fill={THEME.accent} opacity="0.5" />
              <Line x1="40" y1="22" x2="120" y2="40" stroke={THEME.accent} strokeWidth="0.5" opacity="0.3" />
              <Line x1="155" y1="18" x2="120" y2="40" stroke={THEME.accent} strokeWidth="0.5" opacity="0.3" />
              <Line x1="90" y1="58" x2="120" y2="40" stroke={THEME.accent} strokeWidth="0.5" opacity="0.3" />
              <Line x1="200" y1="62" x2="120" y2="40" stroke={THEME.accent} strokeWidth="0.5" opacity="0.3" />
            </Svg>
          )}
        </View>

        <View style={styles.personaPreviewRow}>
          <Text style={[styles.personaPreviewName, { color: theme.text }]}>{persona.toUpperCase()}</Text>
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path fill="none" stroke={theme.textMuted} strokeWidth="2" strokeLinecap="round" d="M9 6l6 6-6 6" />
          </Svg>
        </View>
        <Text style={[styles.personaPreviewLine, { color: theme.textSub }]}>{PERSONA_DATA[persona].lines[0]}</Text>
        <Text style={[styles.personaPreviewLine, { color: theme.textSub, marginTop: 6, fontSize: 11, fontWeight: '700', letterSpacing: 1, opacity: 0.5 }]}>
          DETERMINED BY YOUR MOTIVATOR CALIBRATION
        </Text>
      </GlassCard>

      

      {/* Motivators */}
      <GlassCard style={styles.profileCard}>
        <View style={styles.profileSectionHeaderRow}>
          <Svg width={14} height={14} viewBox="0 0 24 24" style={styles.profileSectionIcon}>
            <Path fill="none" stroke={theme.textMuted} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </Svg>
          <Text style={[styles.profileSectionLabel, { color: theme.textMuted }]}>MOTIVATORS</Text>
        </View>
        {MOTIVATOR_TENSIONS.map(tension => {
          const choice = motivatorChoices[tension.id];
          return (
            <View key={tension.id} style={styles.tensionRow}>
              <View style={styles.tensionPill}>
                <TouchableOpacity
                  style={[styles.tensionSide, choice === 'left' && styles.tensionSideActive]}
                  onPress={() => handleTensionSelect(tension.id, 'left')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tensionSideText, choice === 'left' && styles.tensionSideTextActive]}>
                    {tension.left}
                  </Text>
                </TouchableOpacity>
                <View style={styles.tensionDivider} />
                <TouchableOpacity
                  style={[styles.tensionSide, choice === 'right' && styles.tensionSideActive]}
                  onPress={() => handleTensionSelect(tension.id, 'right')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tensionSideText, choice === 'right' && styles.tensionSideTextActive]}>
                    {tension.right}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </GlassCard>

      {/* Identity Notes */}
      <GlassCard style={styles.profileCard}>
        <View style={styles.profileSectionHeaderRow}>
          <Svg width={14} height={14} viewBox="0 0 24 24" style={styles.profileSectionIcon}>
            <Path fill="none" stroke={theme.textMuted} strokeWidth={1.5} strokeLinecap="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </Svg>
          <Text style={[styles.profileSectionLabel, { color: theme.textMuted }]}>CONTEXT</Text>
        </View>
        <TextInput
          style={[styles.profileTextArea, { color: theme.text, borderColor: theme.glassBorder, backgroundColor: theme.inputBg }]}
          value={identityNotes}
          onChangeText={setIdentityNotes}
          placeholder="Who are you right now? What are you building, fighting, or becoming?"
          placeholderTextColor={theme.textMuted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </GlassCard>

      {/* Logbook */}
      <GlassCard style={styles.profileCard}>
        <View style={styles.profileSectionHeaderRow}>
          <Svg width={14} height={14} viewBox="0 0 24 24" style={styles.profileSectionIcon}>
            <Path fill="none" stroke={theme.textMuted} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <Path fill="none" stroke={theme.textMuted} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </Svg>
          <Text style={[styles.profileSectionLabel, { color: theme.textMuted }]}>LOGBOOK</Text>
        </View>

        {snapshots.length === 0 ? (
          <View style={styles.logbookEmpty}>
            <Text style={[styles.logbookEmptyTitle, { color: theme.textMuted }]}>NO ENTRIES YET</Text>
            <Text style={[styles.logbookEmptyBody, { color: theme.textMuted }]}>
              When a node average crosses 7.0, a snapshot of your Atlas is saved here automatically.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.logbookScroll}
          >
            {snapshots.map(snap => {
              const d = new Date(snap.createdAt);
              const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const yearStr = d.getFullYear().toString();
              const triggerNode = snap.nodeScores.find(n => n.nodeId === snap.triggerNodeId);
              return (
                <TouchableOpacity key={snap.id} style={[styles.logbookCard, { backgroundColor: theme.inputBg, borderColor: theme.divider }]} onPress={() => setSelectedSnapshot(snap)} activeOpacity={0.8}>
                  <Coordinates nodes={snap.nodeScores} size={88} />
                  <View style={styles.logbookCardMeta}>
                    <Text style={[styles.logbookCardDate, { color: theme.text }]}>{dateStr}</Text>
                    <Text style={[styles.logbookCardYear, { color: theme.textMuted }]}>{yearStr}</Text>
                    <View style={[styles.logbookCardDot, { backgroundColor: triggerNode?.color ?? theme.accent }]} />
                    <Text style={[styles.logbookCardNode, { color: triggerNode?.color ?? theme.accent }]}>
                      {snap.triggerNodeName.toUpperCase()}
                    </Text>
                    <Text style={[styles.logbookCardAvg, { color: theme.textMuted }]}>{snap.triggerNodeAvg.toFixed(1)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </GlassCard>

      {/* Snapshot detail modal */}
      {selectedSnapshot && (
        <SnapshotDetailModal
          visible={!!selectedSnapshot}
          onClose={() => setSelectedSnapshot(null)}
          nodes={selectedSnapshot.nodeScores}
          label={new Date(selectedSnapshot.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
          triggerNode={selectedSnapshot.nodeScores.find(n => n.nodeId === selectedSnapshot.triggerNodeId)
            ? { name: selectedSnapshot.triggerNodeName, color: selectedSnapshot.nodeScores.find(n => n.nodeId === selectedSnapshot.triggerNodeId)!.color, avg: selectedSnapshot.triggerNodeAvg }
            : null}
        />
      )}

      {/* Theme Toggle */}
      <View style={[styles.devOverrideSection, { borderColor: theme.divider }]}>
        <Text style={[styles.devOverrideLabel, { color: theme.textMuted }]}>APPEARANCE</Text>
        <View style={styles.devOverrideRow}>
          <Text style={[styles.systemAccessTier, { color: theme.textSub }]}>{themeMode === 'dark' ? '◆ DARK MODE' : '◇ LIGHT MODE'}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setThemeMode('dark')}
              style={[styles.themeToggleBtn, themeMode === 'dark' && { borderColor: theme.accent }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.themeToggleBtnText, { color: themeMode === 'dark' ? theme.accent : theme.textMuted }]}>DARK</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setThemeMode('light')}
              style={[styles.themeToggleBtn, themeMode === 'light' && { borderColor: theme.accent }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.themeToggleBtnText, { color: themeMode === 'light' ? theme.accent : theme.textMuted }]}>LIGHT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Developer Override */}
      <View style={[styles.devOverrideSection, { borderColor: theme.divider }]}>
        <Text style={[styles.devOverrideLabel, { color: theme.textMuted }]}>DEVELOPER OVERRIDE</Text>
        <View style={styles.devOverrideRow}>
          <Text style={[styles.systemAccessTier, { color: theme.textSub }]}>Force hasAccess</Text>
          <Switch
            value={devOverride}
            onValueChange={setDevOverride}
            trackColor={{ false: '#334155', true: THEME.accent }}
            thumbColor="#E2E8F0"
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  profileCard: { marginBottom: 18, borderRadius: 16, overflow: 'hidden', padding: 24, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 16 },
  profileSectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  profileSectionIcon: { marginRight: 8 },
  profileSectionLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  tensionRow: { marginBottom: 10 },
  tensionPill: { flexDirection: 'row', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)' },
  tensionSide: { flex: 1, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  tensionSideActive: { backgroundColor: 'rgba(56,189,248,0.14)' },
  tensionSideText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: THEME.textDim },
  tensionSideTextActive: { color: THEME.accent },
  tensionDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  // Persona card preview
  personaCardGraphic: { width: '100%', height: 60, marginBottom: 16, overflow: 'hidden' },
  personaPreviewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  personaPreviewName: { color: 'white', fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  personaPreviewLine: { color: THEME.textDim, fontSize: 13, lineHeight: 18, fontStyle: 'italic' },

  // Persona modal
  personaOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' },
  personaModal: { backgroundColor: THEME.card, borderRadius: 20, paddingTop: 28, paddingBottom: 24, paddingHorizontal: 0, width: SCREEN_WIDTH - 40, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(56,189,248,0.15)', shadowColor: THEME.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 20 },
  personaModalTitle: { color: THEME.textDim, fontSize: 12, fontWeight: '800', letterSpacing: 3, marginBottom: 20 },
  personaSlide: { paddingHorizontal: 24, alignItems: 'center' },
  personaGraphic: { width: '100%', height: 80, marginBottom: 20, overflow: 'hidden' },
  personaSlideName: { color: 'white', fontSize: 18, fontWeight: '800', letterSpacing: 3, marginBottom: 14, textAlign: 'center' },
  personaSlideLine: { color: 'white', fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 4, opacity: 1, fontStyle: 'italic' },
  personaDots: { flexDirection: 'row', gap: 8, marginTop: 20, marginBottom: 20 },
  personaDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  personaDotActive: { backgroundColor: THEME.accent, width: 20, borderRadius: 3 },
  personaSelectBtn: { paddingVertical: 10, paddingHorizontal: 28, borderRadius: 20, borderWidth: 1 },
  personaSelectBtnText: { fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  profileTextArea: { borderWidth: 1, borderColor: THEME.border, borderRadius: 4, color: 'white', fontSize: 14, padding: 12, minHeight: 100, textAlignVertical: 'top' },
  // Logbook
  logbookEmpty: { paddingVertical: 20, alignItems: 'center' },
  logbookEmptyTitle: { color: THEME.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  logbookEmptyBody: { color: THEME.textDim, fontSize: 12, lineHeight: 18, textAlign: 'center', opacity: 0.7 },
  logbookScroll: { paddingBottom: 4, gap: 12 },
  logbookCard: { width: 100, alignItems: 'center', backgroundColor: THEME.bg, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  logbookCardMeta: { alignItems: 'center', marginTop: 8, gap: 2 },
  logbookCardDate: { color: 'white', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  logbookCardYear: { color: THEME.textDim, fontSize: 10, letterSpacing: 0.5, marginBottom: 4 },
  logbookCardDot: { width: 5, height: 5, borderRadius: 3, marginBottom: 2 },
  logbookCardNode: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  logbookCardAvg: { color: THEME.textDim, fontSize: 11, fontWeight: '600', marginTop: 1 },

  themeToggleBtn: { paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
  themeToggleBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  devOverrideSection: { marginTop: 24, padding: 16, borderWidth: 0.5, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 12 },
  devOverrideLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 3, marginBottom: 10 },
  devOverrideRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  systemAccessTier: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2 },

  // Account section
  accountEmail: { color: 'white', fontSize: 15, fontWeight: '600', marginBottom: 6 },
  accountStatusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  accountStatusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 8 },
  accountStatusText: { color: '#22C55E', fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  signOutBtn: { paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 10, alignSelf: 'flex-start' },
  signOutBtnText: { color: THEME.textDim, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  accountGuestNote: { color: THEME.textDim, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  authBtnRow: { flexDirection: 'row', gap: 10 },
  signInBtn: { flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: THEME.accent, borderRadius: 10, alignItems: 'center' },
  signInBtnText: { color: THEME.accent, fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  signUpBtn: { flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 10, alignItems: 'center' },
  signUpBtnText: { color: THEME.border, fontSize: 13, fontWeight: '700', letterSpacing: 1.5 },
});
