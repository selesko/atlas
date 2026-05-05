import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, Modal, Dimensions } from 'react-native';
import Svg, { Circle, Path, Line, Polyline, Ellipse } from 'react-native-svg';
import { Session } from '@supabase/supabase-js';
import { useAppStore } from '../stores/useAppStore';
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
    nodes,
    restoreNode, restoreGoal, restoreAction,
  } = useAppStore();

  const archivedNodes = nodes.filter(n => n.archived);
  const archivedGoals = nodes.flatMap(n => n.goals.filter(g => g.archived).map(g => ({ ...g, nodeId: n.id, nodeName: n.name, nodeColor: n.color })));
  const archivedActions = nodes.flatMap(n => n.goals.flatMap(g => g.actions.filter(a => a.archived).map(a => ({ ...a, nodeId: n.id, goalId: g.id, nodeName: n.name, nodeColor: n.color, goalName: g.name }))));
  const hasArchived = archivedNodes.length > 0 || archivedGoals.length > 0 || archivedActions.length > 0;
  const theme = useTheme();

  const handleTensionSelect = (id: string, side: 'left' | 'right') => {
    setMotivatorChoices({ ...motivatorChoices, [id]: side });
  };

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

      {/* Archive */}
      {hasArchived && (
        <GlassCard style={[styles.profileCard, { marginTop: 8 }]}>
          <View style={styles.profileSectionHeaderRow}>
            <Text style={[styles.profileSectionLabel, { color: theme.textMuted }]}>ARCHIVE</Text>
          </View>

          {archivedNodes.length > 0 && (
            <View style={styles.archiveGroup}>
              <Text style={[styles.archiveGroupLabel, { color: theme.textMuted }]}>NODES</Text>
              {archivedNodes.map(n => (
                <View key={n.id} style={styles.archiveRow}>
                  <View style={[styles.archiveDot, { backgroundColor: n.color }]} />
                  <Text style={[styles.archiveName, { color: theme.text }]}>{n.name}</Text>
                  <TouchableOpacity onPress={() => restoreNode(n.id)} style={styles.restoreBtn} activeOpacity={0.7}>
                    <Text style={[styles.restoreBtnText, { color: theme.accent }]}>RESTORE</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {archivedGoals.length > 0 && (
            <View style={styles.archiveGroup}>
              <Text style={[styles.archiveGroupLabel, { color: theme.textMuted }]}>COORDINATES</Text>
              {archivedGoals.map(g => (
                <View key={g.id} style={styles.archiveRow}>
                  <View style={[styles.archiveDot, { backgroundColor: g.nodeColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.archiveName, { color: theme.text }]}>{g.name}</Text>
                    <Text style={[styles.archiveMeta, { color: theme.textMuted }]}>{g.nodeName}</Text>
                  </View>
                  <TouchableOpacity onPress={() => restoreGoal(g.nodeId, g.id)} style={styles.restoreBtn} activeOpacity={0.7}>
                    <Text style={[styles.restoreBtnText, { color: theme.accent }]}>RESTORE</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {archivedActions.length > 0 && (
            <View style={styles.archiveGroup}>
              <Text style={[styles.archiveGroupLabel, { color: theme.textMuted }]}>ACTIONS</Text>
              {archivedActions.map(a => (
                <View key={a.id} style={styles.archiveRow}>
                  <View style={[styles.archiveDot, { backgroundColor: a.nodeColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.archiveName, { color: theme.text }]}>{a.title}</Text>
                    <Text style={[styles.archiveMeta, { color: theme.textMuted }]}>{a.nodeName} · {a.goalName}</Text>
                  </View>
                  <TouchableOpacity onPress={() => restoreAction(a.nodeId, a.goalId, a.id)} style={styles.restoreBtn} activeOpacity={0.7}>
                    <Text style={[styles.restoreBtnText, { color: theme.accent }]}>RESTORE</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </GlassCard>
      )}

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
  themeToggleBtn: { paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
  themeToggleBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  devOverrideSection: { marginTop: 24, padding: 16, borderWidth: 0.5, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 12 },
  devOverrideLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 3, marginBottom: 10 },
  archiveGroup: { marginBottom: 16 },
  archiveGroupLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 2.5, marginBottom: 8, opacity: 0.6 },
  archiveRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)' },
  archiveDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  archiveName: { fontSize: 13, fontWeight: '600', flex: 1 },
  archiveMeta: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginTop: 1, opacity: 0.6 },
  restoreBtn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)' },
  restoreBtnText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
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
