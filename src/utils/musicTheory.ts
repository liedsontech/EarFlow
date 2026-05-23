// Teoria Musical - Utilitários
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Nomes em português
export const NOTE_NAMES_PT: { [key: string]: string } = {
  'C': 'Dó', 'C#': 'Dó#', 'D': 'Ré', 'D#': 'Ré#', 'E': 'Mi',
  'F': 'Fá', 'F#': 'Fá#', 'G': 'Sol', 'G#': 'Sol#', 'A': 'Lá',
  'A#': 'Lá#', 'B': 'Si'
};

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export function noteNameToMidi(name: string, octave: number): number {
  const idx = NOTE_NAMES.indexOf(name);
  return (octave + 1) * 12 + idx;
}

// Intervalos musicais
export interface Interval {
  semitones: number;
  name: string;
  shortName: string;
  quality: 'P' | 'M' | 'm' | 'A' | 'd'; // Perfect, Major, minor, Augmented, diminished
}

// Notação brasileira: grau primeiro, qualidade depois (ex: 2M, 3m, 4J, 5J, 6M)
export const INTERVALS: Interval[] = [
  { semitones: 0,  name: 'Uníssono',      shortName: '1J',  quality: 'P' },
  { semitones: 1,  name: '2ª menor',      shortName: '2m',  quality: 'm' },
  { semitones: 2,  name: '2ª Maior',      shortName: '2M',  quality: 'M' },
  { semitones: 3,  name: '3ª menor',      shortName: '3m',  quality: 'm' },
  { semitones: 4,  name: '3ª Maior',      shortName: '3M',  quality: 'M' },
  { semitones: 5,  name: '4ª Justa',      shortName: '4J',  quality: 'P' },
  { semitones: 6,  name: 'Trítono',       shortName: 'TT',  quality: 'A' },
  { semitones: 7,  name: '5ª Justa',      shortName: '5J',  quality: 'P' },
  { semitones: 8,  name: '6ª menor',      shortName: '6m',  quality: 'm' },
  { semitones: 9,  name: '6ª Maior',      shortName: '6M',  quality: 'M' },
  { semitones: 10, name: '7ª menor',      shortName: '7m',  quality: 'm' },
  { semitones: 11, name: '7ª Maior',      shortName: '7M',  quality: 'M' },
  { semitones: 12, name: 'Oitava',        shortName: '8J',  quality: 'P' },
];

// Tipos de acordes
export interface ChordType {
  name: string;        // Nome em português
  symbol: string;      // Cifra (ex: "", "m", "7", "maj7")
  intervals: number[]; // Semitons a partir da fundamental
}

export const CHORD_TYPES: ChordType[] = [
  { name: 'Maior',           symbol: '',     intervals: [0, 4, 7] },
  { name: 'menor',           symbol: 'm',    intervals: [0, 3, 7] },
  { name: 'Aumentado',       symbol: '+',    intervals: [0, 4, 8] },
  { name: 'diminuto',        symbol: 'dim',  intervals: [0, 3, 6] },
  { name: 'Suspenso 4',      symbol: 'sus4', intervals: [0, 5, 7] },
  { name: 'Suspenso 2',      symbol: 'sus2', intervals: [0, 2, 7] },
  { name: 'Dominante 7',     symbol: '7',    intervals: [0, 4, 7, 10] },
  { name: 'Maior 7',         symbol: 'maj7', intervals: [0, 4, 7, 11] },
  { name: 'menor 7',         symbol: 'm7',   intervals: [0, 3, 7, 10] },
  { name: 'meio-diminuto',   symbol: 'm7b5', intervals: [0, 3, 6, 10] },
  { name: 'diminuto 7',      symbol: 'dim7', intervals: [0, 3, 6, 9] },
];

// Campos harmônicos (Maior e menor)
export interface HarmonicField {
  key: string;
  type: 'major' | 'minor';
  chords: { degree: string; symbol: string; root: number; type: ChordType }[];
}

const MAJOR_FIELD_DEGREES = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const MAJOR_FIELD_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MAJOR_FIELD_TYPES = [0, 1, 1, 0, 0, 1, 3]; // índices em CHORD_TYPES (Maior, menor, dim)

const MINOR_FIELD_DEGREES = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
const MINOR_FIELD_INTERVALS = [0, 2, 3, 5, 7, 8, 10];
const MINOR_FIELD_TYPES = [1, 3, 0, 1, 1, 0, 0];

export function buildHarmonicField(rootNote: string, type: 'major' | 'minor' = 'major'): HarmonicField {
  const rootIdx = NOTE_NAMES.indexOf(rootNote);
  const degrees = type === 'major' ? MAJOR_FIELD_DEGREES : MINOR_FIELD_DEGREES;
  const intervals = type === 'major' ? MAJOR_FIELD_INTERVALS : MINOR_FIELD_INTERVALS;
  const types = type === 'major' ? MAJOR_FIELD_TYPES : MINOR_FIELD_TYPES;

  const chords = degrees.map((degree, i) => {
    const root = (rootIdx + intervals[i]) % 12;
    const chordType = CHORD_TYPES[types[i]];
    return {
      degree,
      symbol: `${NOTE_NAMES[root]}${chordType.symbol}`,
      root,
      type: chordType,
    };
  });

  return { key: rootNote, type, chords };
}

// Detectar nome de acorde a partir de notas MIDI
// Suporta inversões e slash chords (C/E, G/B, etc.)
export function detectChord(midiNotes: number[]): string | null {
  if (midiNotes.length < 2) return null;

  const sorted = [...new Set(midiNotes)].sort((a, b) => a - b);
  const bassMidi = sorted[0];
  const bassName = NOTE_NAMES[bassMidi % 12];

  // 2 notas - intervalo
  if (sorted.length === 2) {
    const semitones = (sorted[1] - sorted[0]) % 12;
    const interval = INTERVALS.find(i => i.semitones === semitones);
    return interval ? `${bassName} + ${interval.shortName}` : `${bassName}?`;
  }

  // Pitch classes únicos (sem ordem definida)
  const uniquePcs = [...new Set(sorted.map(n => n % 12))];

  // Tentar cada pitch class como possível fundamental
  let bestMatch: { rootName: string; symbol: string; exact: boolean; complexity: number } | null = null;

  for (const candidateRoot of uniquePcs) {
    const intervals = uniquePcs.map(pc => (pc - candidateRoot + 12) % 12).sort((a, b) => a - b);
    
    for (const chordType of CHORD_TYPES) {
      const expected = [...new Set(chordType.intervals.map(i => i % 12))].sort((a, b) => a - b);
      const exact = arraysEqual(intervals, expected);
      const partial = !exact && expected.every(e => intervals.includes(e));
      
      if (exact || partial) {
        const rootName = NOTE_NAMES[candidateRoot];
        const complexity = chordType.intervals.length;
        const isBetter = !bestMatch
          || (exact && !bestMatch.exact)
          || (exact === bestMatch.exact && complexity > bestMatch.complexity);
        
        if (isBetter) {
          bestMatch = {
            rootName,
            symbol: chordType.symbol + (exact ? '' : '*'),
            exact,
            complexity,
          };
        }
      }
    }
  }

  if (bestMatch) {
    const chordName = `${bestMatch.rootName}${bestMatch.symbol}`;
    // Inversão: baixo diferente da fundamental → notação slash (G/B)
    if (bestMatch.rootName !== bassName) {
      return `${chordName}/${bassName}`;
    }
    return chordName;
  }

  return `${bassName} (${uniquePcs.length} notas)`;
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

// Gerar acorde MIDI a partir de fundamental e tipo
export function generateChordMidi(rootMidi: number, chordType: ChordType): number[] {
  return chordType.intervals.map(i => rootMidi + i);
}
