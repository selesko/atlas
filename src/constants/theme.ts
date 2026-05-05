// ─── Legacy flat token (kept for gradual migration) ──────────────────────────
export const THEME = {
  bg: '#0a0f1e',
  card: '#07101c',
  border: '#E2E8F0',
  accent: '#38BDF8',
  textDim: '#64748B',
  mind: '#38BDF8',
  body: '#FB7185',
  home: '#A78BFA',
  cardBorder: 'rgba(226,232,240,0.5)',
  glow: 'rgba(56,189,248,0.22)',
  glowPop: 'rgba(56,189,248,0.3)',
};

// ─── Dual-mode theme system ───────────────────────────────────────────────────

export type ThemeMode = 'dark' | 'light';

export interface ThemeTokens {
  // Backgrounds
  bg: string;
  bgDeep: string;
  // Blob gradient aura colors (3 blobs)
  blob1: string;
  blob2: string;
  blob3: string;
  blobOpacity: number;
  // Glass cards
  glass: string;           // background of card
  glassBorder: string;     // border color
  glassBlurTint: 'dark' | 'light' | 'default'; // for expo-blur
  glassBlurIntensity: number;
  glassShadow: string;
  // Nav bar (needs higher contrast than cards)
  navGlass: string;
  navBorder: string;
  // Text
  text: string;
  textSub: string;
  textMuted: string;
  // Accent / brand
  accent: string;
  accentGlow: string;
  // Node palette
  mind: string;
  body: string;
  home: string;
  // Misc
  divider: string;
  inputBg: string;
}

export const DARK_THEME: ThemeTokens = {
  // Deep space navy base
  bg: '#080d1a',
  bgDeep: '#04070f',
  // Deep cosmic blob auras — purple, blue, rose
  blob1: '#3b1f6e',       // deep violet
  blob2: '#0f2d5e',       // deep navy blue
  blob3: '#4a0a2e',       // deep rose
  blobOpacity: 0.55,
  // Frosted dark glass
  glass: 'rgba(10, 18, 40, 0.55)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  glassBlurTint: 'dark',
  glassBlurIntensity: 28,
  glassShadow: 'rgba(0, 0, 0, 0.45)',
  // Nav — slightly more opaque dark for contrast
  navGlass: 'rgba(6, 10, 24, 0.88)',
  navBorder: 'rgba(255, 255, 255, 0.08)',
  // Text
  text: '#f0f4ff',
  textSub: '#94a3b8',
  textMuted: '#475569',
  // Accent
  accent: '#38BDF8',
  accentGlow: 'rgba(56, 189, 248, 0.22)',
  // Nodes
  mind: '#38BDF8',
  body: '#FB7185',
  home: '#A78BFA',
  // Misc
  divider: 'rgba(255, 255, 255, 0.07)',
  inputBg: 'rgba(255, 255, 255, 0.06)',
};

export const LIGHT_THEME: ThemeTokens = {
  // Soft off-white base
  bg: '#f0f4ff',
  bgDeep: '#e8eef8',
  // Soft aura blobs — lavender, sky blue, soft rose
  blob1: '#c4b5fd',       // soft violet
  blob2: '#93c5fd',       // soft blue
  blob3: '#fbcfe8',       // soft pink
  blobOpacity: 0.65,
  // Frosted light glass — more opaque so cards read clearly
  glass: 'rgba(255, 255, 255, 0.82)',
  glassBorder: 'rgba(255, 255, 255, 0.9)',
  glassBlurTint: 'light',
  glassBlurIntensity: 16,
  glassShadow: 'rgba(100, 116, 139, 0.14)',
  // Nav — solid dark so icons are always legible
  navGlass: 'rgba(20, 24, 48, 0.90)',
  navBorder: 'rgba(255, 255, 255, 0.08)',
  // Text
  text: '#1e293b',
  textSub: '#475569',
  textMuted: '#64748b',
  // Accent
  accent: '#4f46e5',
  accentGlow: 'rgba(79, 70, 229, 0.15)',
  // Nodes — slightly richer for light bg
  mind: '#0ea5e9',
  body: '#f43f5e',
  home: '#8b5cf6',
  // Misc
  divider: 'rgba(15, 23, 42, 0.08)',
  inputBg: 'rgba(15, 23, 42, 0.05)',
};

export const THEMES: Record<ThemeMode, ThemeTokens> = {
  dark: DARK_THEME,
  light: LIGHT_THEME,
};

export const NODE_COLORS = [
  THEME.mind, THEME.body, THEME.home,
  '#34D399', '#FBBF24', '#F472B6', '#60A5FA', '#10B981',
];

export const DEFAULT_NODE_IDS = ['mind', 'body', 'home'];

export const PERSONA_SUBTITLES: Record<string, Record<string, string>> = {
  Engineer: {
    Atlas:    'SYSTEM OVERVIEW // BALANCE CHECK',
    Evaluate: 'NODE CALIBRATION // EVALUATE',
    Actions:  'TASK DEPLOYMENT // VELOCITY',
    Profile:  'OPERATOR CONFIG // LOADED',
  },
  Seeker: {
    Atlas:    'YOUR CONSTELLATION AT A GLANCE',
    Evaluate: 'TAKE STOCK OF WHERE YOU STAND',
    Actions:  'ACTIONS THAT MOVE YOU FORWARD',
    Profile:  'YOUR ARCHETYPE & DIRECTION',
  },
  Spiritual: {
    Atlas:    'THE SHAPE OF YOUR BECOMING',
    Evaluate: 'SEE YOURSELF CLEARLY',
    Actions:  'SEEDS PLANTED IN INTENTION',
    Profile:  'THE FACE YOU OFFER THE WORLD',
  },
};

export const INFO_TEXTS: Record<string, string> = {
  Atlas: 'The Atlas is your primary visualization of the balance between Mind, Body, and Home. This radar chart represents the current state of your system based on the coordinates you have manually set. A symmetrical shape indicates balance, while a pull toward one node highlights where your current focus should be concentrated.',
  Evaluate: 'Evaluate is where you take stock.\n\nEvery Node is supported by Coordinates — specific, measurable pillars that define its integrity.\n\nUse the sliders to score each Coordinate honestly. This is your check-in: where are you actually at, right now?\n\nOnce you\'ve evaluated, move to Actions — that\'s where you decide what to do about it.',
  Actions: 'Actions are the bottom tier of your system — they support Coordinates, which support Nodes.\n\nEvery Action you log is intentional: it is something you did (or plan to do) to move a Coordinate forward.\n\nFocus Mode: High-priority actions that represent your current path.\n\nSorting: Priority items stay at the top; completed entries move to the bottom for reference.',
  Profile: 'The Profile page defines your current Archetype.\n\nSelecting an Archetype (Architect, Nomad, or Guardian) updates the interface overlay and the specific "Directives" shown throughout the app.\n\nThis allows you to match the system\'s feedback to your current environment or phase of life.',
};

export const PERSONA_DATA = {
  Engineer: {
    lines: [
      'Precision over poetry. Your system is a machine.',
      'Every coordinate is a data point. Every action, a variable.',
      'You optimize what others overlook.',
    ],
  },
  Seeker: {
    lines: [
      'Between the map and the meaning.',
      'You move with intention, guided by what matters.',
      'The path is yours to define.',
    ],
  },
  Spiritual: {
    lines: [
      'The stars don\'t explain themselves. Neither do you.',
      'You navigate by feeling, by rhythm, by season.',
      'Your atlas is a living thing.',
    ],
  },
} as const;

export const MOTIVATOR_TENSIONS = [
  { id: 'operation', left: 'DISCIPLINE',   right: 'EXPLORATION' },
  { id: 'energy',    left: 'DEPTH',        right: 'BREADTH'     },
  { id: 'rhythm',    left: 'CONSISTENCY',  right: 'INTENSITY'   },
  { id: 'recharge',  left: 'SOLITUDE',     right: 'CONNECTION'  },
  { id: 'approach',  left: 'SYSTEM',       right: 'INTUITION'   },
] as const;

export const MODEL_DESCRIPTIONS: Record<string, string> = {
  Architect: 'a systems thinker who designs frameworks and structures to bring clarity and order to complex goals.',
  Strategist: 'a forward-looking planner who connects today\'s actions to long-term outcomes and navigates uncertainty with intent.',
  Builder: 'an execution-focused operator who turns ideas into reality through consistent action and incremental progress.',
  Analyst: 'a pattern-seeking evaluator who optimizes decisions through evidence, reflection, and measured calibration.',
};
