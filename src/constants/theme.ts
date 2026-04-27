export const THEME = {
  bg: '#152238',
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

export const NODE_COLORS = [
  THEME.mind, THEME.body, THEME.home,
  '#34D399', '#FBBF24', '#F472B6', '#60A5FA', '#10B981',
];

export const DEFAULT_NODE_IDS = ['mind', 'body', 'home'];

export const PERSONA_SUBTITLES: Record<string, Record<string, string>> = {
  Engineer: {
    Atlas:   'SYSTEM OVERVIEW // BALANCE CHECK',
    Nodes:   'NODE CALIBRATION // ACTIVE',
    Tasks:   'TASK DEPLOYMENT // VELOCITY',
    Profile: 'OPERATOR CONFIG // LOADED',
  },
  Seeker: {
    Atlas:   'YOUR CONSTELLATION AT A GLANCE',
    Nodes:   'THE PILLARS OF YOUR PATH',
    Tasks:   'ACTIONS THAT MOVE YOU FORWARD',
    Profile: 'YOUR ARCHETYPE & DIRECTION',
  },
  Spiritual: {
    Atlas:   'THE SHAPE OF YOUR BECOMING',
    Nodes:   'THE ROOTS BENEATH THE BRANCHES',
    Tasks:   'SEEDS PLANTED IN INTENTION',
    Profile: 'THE FACE YOU OFFER THE WORLD',
  },
};

export const INFO_TEXTS: Record<string, string> = {
  Atlas: 'The Atlas is your primary visualization of the balance between Mind, Body, and Home. This radar chart represents the current state of your system based on the coordinates you have manually set. A symmetrical shape indicates balance, while a pull toward one node highlights where your current focus should be concentrated.',
  Nodes: 'Nodes & Coordinates\n\nEvery primary Node is supported by specific Coordinates. These are the individual pillars that define the integrity of the node.\n\nCoordinates allow for granular adjustment (e.g., "Meditation" is a coordinate of "Mind").\n\nMoving these sliders manually updates the Node\'s overall average.\n\nUse this screen to adjust your status based on the Evidence you\'ve gathered in your daily logs.',
  Tasks: 'Tasks (Action Log)\n\nThe Task page is the record of your actions. Tasks are grouped by their parent Coordinate to ensure every move is intentional.\n\nFocus Mode: High-priority items that represent your current path.\n\nEvidence Logging: The core of the system. You aren\'t just finishing tasks; you are documenting evidence to justify how you calibrate your Atlas scores.\n\nSorting: Priority items stay at the top; completed entries move to the bottom for reference.',
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
