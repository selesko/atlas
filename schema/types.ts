/**
 * Atlas — Database types for profiles and evidence_logs.
 * Use these when wiring Supabase client, DTOs, or API responses.
 */

export type CognitiveModel = 'Architect' | 'Strategist' | 'Builder' | 'Analyst';
export type PeakPeriod = 'MORNING' | 'EVENING';

export interface ProfileRow {
  id: string;
  user_id: string;
  cognitive_model: CognitiveModel;
  peak_period: PeakPeriod;
  motivators: string[];
  identity_notes: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileInsert {
  user_id: string;
  cognitive_model?: CognitiveModel;
  peak_period?: PeakPeriod;
  motivators?: string[];
  identity_notes?: string;
}

export interface ProfileUpdate {
  cognitive_model?: CognitiveModel;
  peak_period?: PeakPeriod;
  motivators?: string[];
  identity_notes?: string;
}

// ---

export interface EvidenceLogRow {
  id: string;
  user_id: string;
  node_id: string;
  coordinate_id: string;
  coordinate_name: string;
  score: number;
  why_statement: string;
  created_at: string;
}

export interface EvidenceLogInsert {
  user_id: string;
  node_id: string;
  coordinate_id: string;
  coordinate_name: string;
  score: number;
  why_statement?: string;
}

/** Filters for queries. Every read must be scoped by user_id. */
export interface EvidenceLogFilters {
  user_id: string;
  node_id?: string;
  coordinate_id?: string;
  since?: string; // ISO date
  limit?: number;
}
