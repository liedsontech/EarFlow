// Tipos compartilhados (web version - sem Tauri)
export interface NoteEvent {
  note: number;
  noteName: string;
  octave: number;
  velocity: number;
  timestamp: number;
}

export type ExerciseType =
  | 'note-identification'
  | 'note-identification-blind'
  | 'interval-asc'
  | 'interval-desc'
  | 'interval-harm'
  | 'chord-id'
  | 'progression-id';

export interface Attempt {
  id?: number;
  sessionId: number;
  exerciseType: ExerciseType;
  expected: string[];
  played: string[];
  isCorrect: boolean;
  reactionTimeMs: number;
  createdAt?: string;
}

export type Instrument = 'piano' | 'bass-electric' | 'guitar-acoustic' | 'guitar-electric';

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
}
