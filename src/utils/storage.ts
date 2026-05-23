// Storage local (substitui SQLite/Tauri)
import type { Attempt } from '../types';

const KEYS = {
  attempts: 'earflow:attempts',
  stats: 'earflow:stats',
  preferences: 'earflow:preferences',
};

export interface Preferences {
  instrument: string;
  playStyle: 'block' | 'arpeggio';
  difficulty: 'easy' | 'medium' | 'hard';
  showChordInOptions: boolean;
  lastMidiDeviceId?: string;
}

const defaultPreferences: Preferences = {
  instrument: 'piano',
  playStyle: 'block',
  difficulty: 'easy',
  showChordInOptions: true,
};

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(KEYS.preferences);
    if (!raw) return defaultPreferences;
    return { ...defaultPreferences, ...JSON.parse(raw) };
  } catch {
    return defaultPreferences;
  }
}

export function savePreferences(prefs: Partial<Preferences>): void {
  try {
    const current = loadPreferences();
    localStorage.setItem(KEYS.preferences, JSON.stringify({ ...current, ...prefs }));
  } catch (e) {
    console.warn('Erro ao salvar preferências:', e);
  }
}

export function saveAttempt(attempt: Omit<Attempt, 'id' | 'createdAt'>): void {
  try {
    const raw = localStorage.getItem(KEYS.attempts);
    const arr: Attempt[] = raw ? JSON.parse(raw) : [];
    arr.push({
      ...attempt,
      id: Date.now(),
      createdAt: new Date().toISOString(),
    });
    // Manter só últimas 500 tentativas
    const trimmed = arr.slice(-500);
    localStorage.setItem(KEYS.attempts, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('Erro ao salvar tentativa:', e);
  }
}

export function loadAttempts(): Attempt[] {
  try {
    const raw = localStorage.getItem(KEYS.attempts);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export interface BasicStats {
  total: number;
  correct: number;
  accuracy: number;
  byType: Record<string, { total: number; correct: number; accuracy: number }>;
}

export function computeStats(): BasicStats {
  const attempts = loadAttempts();
  const total = attempts.length;
  const correct = attempts.filter(a => a.isCorrect).length;
  const byType: BasicStats['byType'] = {};

  for (const a of attempts) {
    const key = a.exerciseType;
    if (!byType[key]) byType[key] = { total: 0, correct: 0, accuracy: 0 };
    byType[key].total++;
    if (a.isCorrect) byType[key].correct++;
  }
  Object.values(byType).forEach(s => {
    s.accuracy = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
  });

  return {
    total,
    correct,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    byType,
  };
}

export function clearAllData(): void {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}
