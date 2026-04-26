import { Node } from '../types';
import { THEME } from './theme';

export const toCreatedAt = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

export const lastNDays = (n: number): string[] => {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(toCreatedAt(i));
  return out;
};

export const buildScoreHistory = (value: number, days: number) =>
  lastNDays(days).map((date, i) => ({
    date,
    value: Math.max(1, Math.min(10, value + (i - days / 2) * 0.3)),
  }));

export const INITIAL_DATA: Node[] = [
  {
    id: 'mind',
    name: 'Mind',
    color: THEME.mind,
    description: 'CLARITY & FOCUS',
    goals: [
      {
        id: 'm1',
        name: 'Meditation',
        value: 7,
        evidence: '',
        scoreHistory: buildScoreHistory(7, 7),
        tasks: [
          {
            id: 't1',
            title: '10m Focus Session',
            completed: true,
            isPriority: false,
            timestamp: '09:42',
            createdAt: toCreatedAt(3),
            completedAt: toCreatedAt(3),
          },
        ],
      },
      {
        id: 'm2',
        name: 'Deep Work',
        value: 5,
        evidence: '',
        scoreHistory: buildScoreHistory(5, 7),
        tasks: [],
      },
    ],
  },
  {
    id: 'body',
    name: 'Body',
    color: THEME.body,
    description: 'ENERGY & VITALITY',
    goals: [
      {
        id: 'b1',
        name: 'Hydration',
        value: 9,
        evidence: '',
        scoreHistory: buildScoreHistory(9, 7),
        tasks: [
          {
            id: 't2',
            title: '3L Water',
            completed: false,
            isPriority: false,
            timestamp: '14:15',
            createdAt: toCreatedAt(1),
          },
        ],
      },
      {
        id: 'b2',
        name: 'Sleep Quality',
        value: 6,
        evidence: '',
        scoreHistory: buildScoreHistory(6, 7),
        tasks: [],
      },
    ],
  },
  {
    id: 'home',
    name: 'Home',
    color: THEME.home,
    description: 'ENVIRONMENT',
    goals: [
      {
        id: 'h1',
        name: 'Organization',
        value: 8,
        evidence: '',
        scoreHistory: buildScoreHistory(8, 7),
        tasks: [
          {
            id: 't3',
            title: 'Clear Desk',
            completed: true,
            isPriority: false,
            timestamp: '07:23',
            createdAt: toCreatedAt(5),
            completedAt: toCreatedAt(5),
          },
        ],
      },
      {
        id: 'h2',
        name: 'Order',
        value: 7,
        evidence: '',
        scoreHistory: buildScoreHistory(7, 7),
        tasks: [],
      },
    ],
  },
];
