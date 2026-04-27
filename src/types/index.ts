export interface Task {
  id: string;
  title: string;
  completed: boolean;
  isPriority: boolean;
  timestamp: string;
  notes?: string;
  dueDate?: string;
  reminder?: string;
  createdAt: string;
  completedAt?: string;
}

export interface Goal {
  id: string;
  name: string;
  value: number;
  evidence: string;
  tasks: Task[];
  scoreHistory?: Array<{ date: string; value: number }>;
}

export interface Node {
  id: string;
  name: string;
  color: string;
  description: string;
  goals: Goal[];
}

export type CognitiveModel = 'Architect' | 'Strategist' | 'Builder' | 'Analyst';
export type PeakPeriod = 'MORNING' | 'EVENING';
export type Persona = 'Engineer' | 'Seeker' | 'Spiritual';
export type AtlasGraphView = 'radar' | 'trajectory' | 'constellation';
export type TaskFilter = 'ALL' | 'MIND' | 'BODY' | 'HOME' | 'FOCUS';
export type MotivatorChoice = 'left' | 'right';
export type MotivatorChoices = Record<string, MotivatorChoice>;

export interface Profile {
  cognitiveModel: CognitiveModel;
  motivatorChoices: MotivatorChoices;
  identityNotes: string;
}
