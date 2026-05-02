import { Persona, MotivatorChoices } from '../types';

export const calculatePersona = (choices: MotivatorChoices): Persona => {
  let engineer = 0;
  let seeker = 0;
  let spiritual = 0;

  // 1. DISCIPLINE (left) vs EXPLORATION (right)
  if (choices['operation'] === 'left') engineer += 1;
  else if (choices['operation'] === 'right') seeker += 1;

  // 2. DEPTH (left) vs BREADTH (right)
  if (choices['energy'] === 'left') {
    spiritual += 1;
    engineer += 1;
  } else if (choices['energy'] === 'right') {
    seeker += 1;
  }

  // 3. CONSISTENCY (left) vs INTENSITY (right)
  if (choices['rhythm'] === 'left') engineer += 1;
  else if (choices['rhythm'] === 'right') {
    seeker += 1;
    spiritual += 1;
  }

  // 4. SOLITUDE (left) vs CONNECTION (right)
  if (choices['recharge'] === 'left') engineer += 1;
  else if (choices['recharge'] === 'right') {
    spiritual += 1;
    seeker += 1;
  }

  // 5. SYSTEM (left) vs INTUITION (right)
  if (choices['approach'] === 'left') engineer += 1;
  else if (choices['approach'] === 'right') {
    spiritual += 1;
    seeker += 1;
  }

  const scores = [
    { persona: 'Engineer' as Persona, score: engineer },
    { persona: 'Spiritual' as Persona, score: spiritual },
    { persona: 'Seeker' as Persona, score: seeker },
  ];

  // Sort by score descending. If tied, it naturally falls back (Seeker/Spiritual/Engineer order depends on sort stability, but we can explicitly break ties if we want, or just rely on the array order. Seeker is a good fallback.)
  scores.sort((a, b) => b.score - a.score);

  return scores[0].persona;
};
