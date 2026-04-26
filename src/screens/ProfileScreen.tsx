import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Session } from '@supabase/supabase-js';
import { useAppStore } from '../stores/useAppStore';
import { THEME, MOTIVATOR_OPTIONS, MODEL_DESCRIPTIONS } from '../constants/theme';

interface ProfileScreenProps {
  session: Session | null;
  onSignIn: () => void;
  onSignUp: () => void;
  onSignOut: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ session, onSignIn, onSignUp, onSignOut }) => {
  const {
    cognitiveModel, setCognitiveModel,
    peakPeriod, setPeakPeriod,
    motivators, setMotivators,
    identityNotes, setIdentityNotes,
    devOverride, setDevOverride,
  } = useAppStore();

  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  return (
    <View>
      {/* Account */}
      <View style={styles.profileCard}>
        <View style={styles.profileSectionHeaderRow}>
          <Svg width={14} height={14} viewBox="0 0 24 24" style={styles.profileSectionIcon}>
            <Circle cx="12" cy="12" r="10" fill="none" stroke={THEME.textDim} strokeWidth={1.5} />
            <Path fill="none" stroke={THEME.textDim} strokeWidth={1.5} strokeLinecap="round" d="M12 8v4m0 4h.01" />
          </Svg>
          <Text style={styles.profileSectionLabel}>ACCOUNT</Text>
        </View>
        {session ? (
          <View>
            <Text style={styles.accountEmail}>{session.user.email}</Text>
            <View style={styles.accountStatusRow}>
              <View style={styles.accountStatusDot} />
              <Text style={styles.accountStatusText}>SIGNED IN — UNRESTRICTED ACCESS</Text>
            </View>
            <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut} activeOpacity={0.8}>
              <Text style={styles.signOutBtnText}>SIGN OUT</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={styles.accountGuestNote}>You're in local mode. Sign in to unlock Co-Pilot and sync your data.</Text>
            <View style={styles.authBtnRow}>
              <TouchableOpacity style={styles.signInBtn} onPress={onSignIn} activeOpacity={0.8}>
                <Text style={styles.signInBtnText}>SIGN IN</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.signUpBtn} onPress={onSignUp} activeOpacity={0.8}>
                <Text style={styles.signUpBtnText}>CREATE ACCOUNT</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Model Selection */}
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
                <TouchableOpacity
                  key={m}
                  style={[styles.modelDropdownItem, cognitiveModel === m && styles.modelDropdownItemActive]}
                  onPress={() => { setCognitiveModel(m); setModelDropdownOpen(false); }}
                  activeOpacity={0.8}
                >
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

      {/* Peak Period */}
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

      {/* Motivators */}
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
                  if (sel) setMotivators(motivators.filter(x => x !== m));
                  else if (motivators.length < 3) setMotivators([...motivators, m]);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.motivatorChipText, sel && styles.motivatorChipTextActive]}>{m}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Identity Notes */}
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

      {/* Developer Override */}
      <View style={styles.devOverrideSection}>
        <Text style={styles.devOverrideLabel}>DEVELOPER OVERRIDE</Text>
        <View style={styles.devOverrideRow}>
          <Text style={styles.systemAccessTier}>Force hasAccess</Text>
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
  profileCard: { backgroundColor: THEME.card, marginBottom: 18, borderRadius: 12, overflow: 'hidden', padding: 24, shadowColor: THEME.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4 },
  profileSectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  profileSectionIcon: { marginRight: 8 },
  profileSectionLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  motivatorsCounter: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  motivatorsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  motivatorChip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, width: '31%' },
  motivatorChipActive: { borderColor: '#22C55E', backgroundColor: 'rgba(34, 197, 94, 0.15)' },
  motivatorChipText: { color: THEME.textDim, fontSize: 14, fontWeight: '600' },
  motivatorChipTextActive: { color: '#22C55E', fontWeight: '700' },
  modelDropdownWrap: { marginTop: 4 },
  modelDropdownTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: THEME.border, borderRadius: 4 },
  modelDropdownTriggerText: { color: THEME.border, fontSize: 14, flex: 1 },
  modelDropdownChevron: { marginLeft: 8 },
  modelDropdownList: { marginTop: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, overflow: 'hidden' },
  modelDropdownItem: { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  modelDropdownItemActive: { backgroundColor: 'rgba(255,255,255,0.06)' },
  modelDropdownItemText: { color: THEME.textDim, fontSize: 14, fontWeight: '600' },
  modelDropdownItemTextActive: { color: THEME.accent, fontWeight: '700' },
  modelYouAreBlock: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  modelYouAreLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 2, marginBottom: 6 },
  modelYouAreText: { color: THEME.border, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  peakPeriodRow: { flexDirection: 'row', gap: 12 },
  peakBlock: { flex: 1, flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  peakBlockActiveMorning: { borderWidth: 2, borderColor: '#EAB308', backgroundColor: 'rgba(234, 179, 8, 0.12)', shadowColor: '#EAB308', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10 },
  peakBlockActiveEvening: { borderWidth: 2, borderColor: '#F97316', backgroundColor: 'rgba(249, 115, 22, 0.12)', shadowColor: '#F97316', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10 },
  peakBlockTitle: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  peakBlockTitleActiveMorning: { color: '#EAB308' },
  peakBlockTitleActiveEvening: { color: '#F97316' },
  peakBlockSub: { color: THEME.textDim, fontSize: 14, fontWeight: '600', letterSpacing: 1, marginTop: 4 },
  peakBlockSubActiveMorning: { color: 'rgba(234, 179, 8, 0.95)' },
  peakBlockSubActiveEvening: { color: 'rgba(249, 115, 22, 0.95)' },
  profileTextArea: { borderWidth: 1, borderColor: THEME.border, borderRadius: 4, color: 'white', fontSize: 14, padding: 12, minHeight: 100, textAlignVertical: 'top' },
  devOverrideSection: { marginTop: 24, padding: 16, borderWidth: 0.5, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 12 },
  devOverrideLabel: { color: THEME.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 3, marginBottom: 10 },
  devOverrideRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  systemAccessTier: { color: THEME.textDim, fontSize: 14, fontWeight: '700', letterSpacing: 2 },

  // Account section
  accountEmail: { color: 'white', fontSize: 15, fontWeight: '500', marginBottom: 6 },
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
