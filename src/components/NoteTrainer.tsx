import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as Tone from 'tone';
import { Play, RotateCcw, Trophy, Eye, EyeOff, Volume2 } from 'lucide-react';
import type { Attempt, Instrument } from '../types';
import { PianoKeyboard } from './PianoKeyboard';
import { InstrumentSelector } from './InstrumentSelector';
import {
  NOTE_NAMES,
  NOTE_NAMES_PT,
  midiToNoteName,
  INTERVALS,
  CHORD_TYPES,
  buildHarmonicField,
  detectChord,
  generateChordMidi,
} from '../utils/musicTheory';
import {
  getSampler as getPiano,
  playNote as playNoteOnPiano,
  playChord as playChordOnPiano,
  playSequence as playSequenceOnPiano,
  setCurrentInstrument,
} from '../utils/instrumentSampler';
import { onNoteOn, onNoteOff, onCc } from '../utils/webMidi';
import { saveAttempt, loadPreferences, savePreferences } from '../utils/storage';

interface NoteTrainerProps {
  isMidiConnected: boolean;
}

type ExerciseMode = 'note' | 'interval' | 'chord' | 'harmonic-field' | 'harmonic-field-minor' | 'chord-replicate' | 'progression';

interface ExerciseConfig {
  mode: ExerciseMode;
  label: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const EXERCISES: ExerciseConfig[] = [
  { mode: 'note', label: '🎵 Notas', description: 'Identifique notas no teclado', difficulty: 'easy' },
  { mode: 'interval', label: '📏 Intervalos', description: 'Ouça dois sons e identifique o intervalo', difficulty: 'medium' },
  { mode: 'chord', label: '🎹 Acordes', description: 'Identifique Maior, menor, Aumentado, diminuto', difficulty: 'medium' },
  { mode: 'harmonic-field', label: '🎼 Campo Maior', description: 'Qual o grau do acorde na tonalidade Maior?', difficulty: 'hard' },
  { mode: 'harmonic-field-minor', label: '🎻 Campo menor', description: 'Qual o grau do acorde na tonalidade menor?', difficulty: 'hard' },
  { mode: 'chord-replicate', label: '🎶 Replicar Acorde', description: 'Ouça o acorde e replique no teclado', difficulty: 'hard' },
  { mode: 'progression', label: '🎵 Progressões', description: 'Ouça 3-5 acordes e identifique a sequência de graus', difficulty: 'hard' },
];

export function NoteTrainer({ isMidiConnected }: NoteTrainerProps) {
  // Estado de exercício atual
  const [mode, setMode] = useState<ExerciseMode>('note');
  const [isBlindMode, setIsBlindMode] = useState(false);
  const [isAudioStarted, setIsAudioStarted] = useState(false);
  const [showChordInOptions, setShowChordInOptions] = useState(true);
  const [playStyle, setPlayStyle] = useState<'block' | 'arpeggio'>('block');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [showAnswer, setShowAnswer] = useState(false);

  // Refs para evitar stale closures - garantem sempre estado fresco
  const targetChordRef = useRef<{ midi: number[]; symbol: string; degree?: string }>({ midi: [60, 64, 67], symbol: 'C' });
  const targetNoteRef = useRef<number>(60);
  const targetIntervalRef = useRef<{ from: number; to: number; name: string }>({ from: 60, to: 64, name: 'M3' });
  const modeRef = useRef<ExerciseMode>('note');
  const exerciseGenIdRef = useRef<number>(0); // ID de geração p/ ignorar callbacks atrasados
  const isTransitioningRef = useRef<boolean>(false);
  const pendingTimeoutsRef = useRef<number[]>([]); // Timeouts de áudio a cancelar

  // Estado do exercício
  const [targetNote, setTargetNote] = useState<number>(60);
  const [targetInterval, setTargetInterval] = useState<{ from: number; to: number; name: string }>({ from: 60, to: 64, name: 'M3' });
  const [targetChord, setTargetChord] = useState<{ midi: number[]; symbol: string; degree?: string }>({ midi: [60, 64, 67], symbol: 'C' });
  const [harmonicKey, setHarmonicKey] = useState<string>('C');

  // Feedback
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');

  // Stats
  const [streak, setStreak] = useState(0);
  const [sessionAttempts, setSessionAttempts] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);

  // Estado do teclado virtual
  const [pressedNotes, setPressedNotes] = useState<Set<number>>(new Set());
  const [activeChord, setActiveChord] = useState<string | null>(null);

  const checkInProgressRef = useRef(false);

  // ========== Áudio ==========
  const [pianoLoaded, setPianoLoaded] = useState(false);

  const startAudio = async () => {
    if (!isAudioStarted) {
      await Tone.start();
      setIsAudioStarted(true);
      // Carregar piano samples
      try {
        await getPiano();
        setPianoLoaded(true);
      } catch (e) {
        console.error('Erro ao carregar piano:', e);
      }
    }
  };

  // Carregar piano em background
  useEffect(() => {
    getPiano()
      .then(() => setPianoLoaded(true))
      .catch(e => console.error('Erro ao carregar piano:', e));
  }, []);

  const playNote = async (midi: number, duration = '0.8') => {
    await startAudio();
    await playNoteOnPiano(midi, duration);
  };

  const playChord = async (midiNotes: number[], duration = '1.5') => {
    await startAudio();
    if (playStyle === 'arpeggio') {
      // Arpejo rápido - nota por nota
      await playSequenceOnPiano(midiNotes, 0.12, '0.8');
    } else {
      await playChordOnPiano(midiNotes, duration);
    }
  };

  const playInterval = async (from: number, to: number) => {
    await startAudio();
    await playNoteOnPiano(from, '0.6');
    setTimeout(() => {
      playNoteOnPiano(to, '0.6');
    }, 700);
  };

  // Helper para agendar timeout cancelável
  const scheduleAudio = (fn: () => void, delay: number) => {
    const id = window.setTimeout(fn, delay);
    pendingTimeoutsRef.current.push(id);
    return id;
  };

  const cancelAllAudio = () => {
    pendingTimeoutsRef.current.forEach(id => clearTimeout(id));
    pendingTimeoutsRef.current = [];
  };

  // ========== Estado da Progressão ==========
  const [progression, setProgression] = useState<{
    key: string;
    chords: { degree: string; symbol: string; midi: number[] }[];
    userAnswer: string[];
  }>({ key: 'C', chords: [], userAnswer: [] });

  // ========== Geração de Exercícios ==========
  const generateNewExercise = useCallback(() => {
    // Cancelar todos os áudios pendentes
    cancelAllAudio();
    
    // Incrementar ID - invalida qualquer setTimeout pendente do exercício anterior
    exerciseGenIdRef.current += 1;
    isTransitioningRef.current = true;
    
    setFeedback('idle');
    setFeedbackMessage('');
    setShowAnswer(false);
    setPressedNotes(new Set());
    setActiveChord(null);
    checkInProgressRef.current = false;

    // Cooldown de 300ms para garantir que notas residuais não disparem validação
    setTimeout(() => {
      isTransitioningRef.current = false;
    }, 300);

    modeRef.current = mode;

    switch (mode) {
      case 'note': {
        const newNote = 60 + Math.floor(Math.random() * 13); // C4 a C5
        setTargetNote(newNote);
        targetNoteRef.current = newNote;
        break;
      }
      case 'interval': {
        const from = 60 + Math.floor(Math.random() * 7);
        const interval = INTERVALS[1 + Math.floor(Math.random() * 11)]; // m2 até M7
        const to = from + interval.semitones;
        const intervalObj = { from, to, name: interval.shortName };
        setTargetInterval(intervalObj);
        targetIntervalRef.current = intervalObj;
        // Tocar automaticamente
        setTimeout(() => playInterval(from, to), 300);
        break;
      }
      case 'chord': {
        const root = 60 + Math.floor(Math.random() * 12);
        const chordType = CHORD_TYPES[Math.floor(Math.random() * 4)]; // Apenas triades primeiro
        const midi = generateChordMidi(root, chordType);
        const chordObj = {
          midi,
          symbol: `${NOTE_NAMES[root % 12]}${chordType.symbol}`,
        };
        setTargetChord(chordObj);
        targetChordRef.current = chordObj;
        setTimeout(() => playChord(midi), 300);
        break;
      }
      case 'harmonic-field':
      case 'harmonic-field-minor': {
        const isMinor = mode === 'harmonic-field-minor';
        // Todas as 12 tonalidades (incluindo sustenidos)
        const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const newKey = keys[Math.floor(Math.random() * keys.length)];
        setHarmonicKey(newKey);
        const field = buildHarmonicField(newKey, isMinor ? 'minor' : 'major');
        
        // Filtrar graus permitidos pela dificuldade
        // Índices: 0=I, 1=ii, 2=iii, 3=IV, 4=V, 5=vi, 6=vii°
        const allowedIdxs = 
          difficulty === 'easy' ? [0, 3, 4]             // I, IV, V
          : difficulty === 'medium' ? [0, 1, 3, 4, 5]   // I, ii, IV, V, vi
          : [0, 1, 2, 3, 4, 5, 6];                      // todos
        
        const chordIdx = allowedIdxs[Math.floor(Math.random() * allowedIdxs.length)];
        const chord = field.chords[chordIdx];
        const rootMidi = 60 + chord.root;
        const midi = generateChordMidi(rootMidi, chord.type);
        const chordObj = {
          midi,
          symbol: chord.symbol,
          degree: chord.degree,
        };
        setTargetChord(chordObj);
        targetChordRef.current = chordObj;
        // Tocar APENAS o acorde alvo (sem tônica - usuário pode pedir tônica via botão)
        scheduleAudio(() => playChord(midi, '1.5'), 300);
        break;
      }
      case 'chord-replicate': {
        const root = 48 + Math.floor(Math.random() * 12); // C3 a B3
        const chordType = CHORD_TYPES[Math.floor(Math.random() * 4)];
        const midi = generateChordMidi(root, chordType);
        const chordObj = {
          midi,
          symbol: `${NOTE_NAMES[root % 12]}${chordType.symbol}`,
        };
        setTargetChord(chordObj);
        targetChordRef.current = chordObj;
        scheduleAudio(() => playChord(midi), 300);
        break;
      }
      case 'progression': {
        // Gerar progressão de 3-5 acordes no campo harmônico maior
        const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const newKey = keys[Math.floor(Math.random() * keys.length)];
        const field = buildHarmonicField(newKey, 'major');
        const numChords = 3 + Math.floor(Math.random() * 3); // 3 a 5
        
        // Progressões por dificuldade (índices: I=0, ii=1, iii=2, IV=3, V=4, vi=5, vii°=6)
        const easyProgressions = [
          [0, 3, 4, 0],       // I-IV-V-I
          [0, 4, 3, 0],       // I-V-IV-I
          [0, 3, 0, 4],       // I-IV-I-V
          [4, 3, 0],          // V-IV-I
          [0, 3, 4],          // I-IV-V
        ];
        const mediumProgressions = [
          ...easyProgressions,
          [0, 5, 3, 4],       // I-vi-IV-V
          [1, 4, 0],          // ii-V-I
          [0, 4, 5, 3],       // I-V-vi-IV (pop)
          [5, 3, 0, 4],       // vi-IV-I-V
          [0, 1, 4, 0],       // I-ii-V-I
          [0, 5, 1, 4],       // I-vi-ii-V (anos 50)
        ];
        const hardProgressions = [
          ...mediumProgressions,
          [0, 2, 3, 4],       // I-iii-IV-V
          [0, 3, 5, 4],       // I-IV-vi-V
          [2, 5, 1, 4],       // iii-vi-ii-V
          [0, 6, 5, 4],       // I-vii°-vi-V
          [5, 1, 4, 0],       // vi-ii-V-I (jazz)
          [0, 2, 5, 3, 4],    // I-iii-vi-IV-V
        ];
        
        const progressions = 
          difficulty === 'easy' ? easyProgressions
          : difficulty === 'medium' ? mediumProgressions
          : hardProgressions;
        
        const baseProgression = progressions[Math.floor(Math.random() * progressions.length)];
        const progressionIdxs = baseProgression.slice(0, numChords);
        
        const progChords = progressionIdxs.map(idx => {
          const chord = field.chords[idx];
          const rootMidi = 60 + chord.root;
          return {
            degree: chord.degree,
            symbol: chord.symbol,
            midi: generateChordMidi(rootMidi, chord.type),
          };
        });
        
        setHarmonicKey(newKey);
        setProgression({ key: newKey, chords: progChords, userAnswer: [] });
        
        // Tocar apenas a sequência (sem tônica - usuário pode pedir tônica via botão)
        scheduleAudio(() => {
          progChords.forEach((c, i) => {
            scheduleAudio(() => playChord(c.midi, '1'), i * 1100);
          });
        }, 300);
        break;
      }
    }
  }, [mode, difficulty]);

  // ========== Verificação de Resposta ==========
  const checkResponse = useCallback((notes: number[]) => {
    if (checkInProgressRef.current || feedback !== 'idle' || isTransitioningRef.current) return;
    // Progression usa apenas botões de múltipla escolha - não validar via teclado
    if (mode === 'progression') return;

    let isCorrect = false;
    let message = '';

    switch (mode) {
      case 'note': {
        const noteOnly = notes[notes.length - 1];
        isCorrect = noteOnly % 12 === targetNote % 12;
        if (isCorrect) {
          message = `✓ ${midiToNoteName(targetNote)} correto!`;
        } else {
          message = `✗ Você tocou ${midiToNoteName(noteOnly)}. Tente novamente!`;
        }
        break;
      }
      case 'chord':
      case 'harmonic-field':
      case 'harmonic-field-minor':
      case 'chord-replicate': {
        const targetPCs = [...new Set(targetChord.midi.map(n => n % 12))].sort((a, b) => a - b);
        const playedPCs = [...new Set(notes.map(n => n % 12))].sort((a, b) => a - b);
        
        // Esperar usuário tocar pelo menos o número correto de notas
        if (playedPCs.length < targetPCs.length) return;
        
        isCorrect = playedPCs.length === targetPCs.length && playedPCs.every((p, i) => p === targetPCs[i]);
        if (isCorrect) {
          message = `✓ ${targetChord.symbol}${targetChord.degree ? ` (${targetChord.degree})` : ''} correto!`;
        } else {
          // Se tem mais notas que o alvo, ainda é errado mas só conta após estabilizar
          if (playedPCs.length > targetPCs.length + 1) return; // Aguardar
          message = `✗ Tente novamente!`;
        }
        break;
      }
      case 'interval': {
        if (notes.length < 2) return;
        const sorted = [...notes].sort((a, b) => a - b);
        const semitones = sorted[sorted.length - 1] - sorted[0];
        const correctSemitones = targetInterval.to - targetInterval.from;
        isCorrect = semitones === correctSemitones;
        if (isCorrect) {
          message = `✓ ${targetInterval.name} correto!`;
        } else {
          message = `✗ Intervalo errado. Tente novamente!`;
        }
        break;
      }
    }

    if (isCorrect) {
      checkInProgressRef.current = true;
      setFeedback('correct');
      setFeedbackMessage(message);
      setSessionAttempts(prev => prev + 1);
      setStreak(prev => prev + 1);
      setSessionCorrect(prev => prev + 1);
      if (isAudioStarted) {
        playChordOnPiano([72, 76, 79], '0.3').catch(() => {});
      }
      try {
        const attempt: Omit<Attempt, 'id' | 'createdAt'> = {
          sessionId: 1,
          exerciseType: 'note-identification',
          expected: [targetChord.symbol || midiToNoteName(targetNote)],
          played: notes.map(midiToNoteName),
          isCorrect: true,
          reactionTimeMs: 1000,
        };
        saveAttempt(attempt);
      } catch {}

      setTimeout(() => generateNewExercise(), 1800);
    } else {
      // RESILIENTE: flash vermelho por 1s mas volta para idle p/ usuário tentar novamente
      setFeedback('wrong');
      setFeedbackMessage(message);
      setStreak(0);
      scheduleAudio(() => {
        setFeedback('idle');
        setFeedbackMessage('');
      }, 1200);
    }
  }, [mode, targetNote, targetChord, targetInterval, feedback, isAudioStarted, generateNewExercise]);

  // Refs para pedal sustain
  const sustainPedalRef = useRef<boolean>(false);
  const sustainedNotesRef = useRef<Set<number>>(new Set());
  const sustainTimeoutsRef = useRef<Map<number, number>>(new Map());
  const detectDebounceRef = useRef<number | null>(null);

  // ========== Handlers MIDI ==========
  useEffect(() => {
    if (!isMidiConnected) return;

    console.log('[MIDI] Listeners registrados, aguardando notas...');

    const unsubOn = onNoteOn((note: number) => {
      console.log('[MIDI] Note ON:', note);
      // Cancelar release pendente se a nota for tocada novamente
      const pendingRelease = sustainTimeoutsRef.current.get(note);
      if (pendingRelease) {
        clearTimeout(pendingRelease);
        sustainTimeoutsRef.current.delete(note);
      }
      const dur = sustainPedalRef.current ? '2.5' : '0.5';
      playNoteOnPiano(note, dur).catch((err: unknown) => console.error('Erro ao tocar:', err));
      setPressedNotes(prev => {
        const newSet = new Set(prev);
        newSet.add(note);
        const arr = Array.from(newSet);
        setActiveChord(detectChord(arr));
        if (detectDebounceRef.current) clearTimeout(detectDebounceRef.current);
        detectDebounceRef.current = window.setTimeout(() => {
          checkResponse(Array.from(newSet));
        }, 120);
        return newSet;
      });
    });

    const unsubOff = onNoteOff((note: number) => {
      console.log('[MIDI] Note OFF:', note);
      if (sustainPedalRef.current) {
        sustainedNotesRef.current.add(note);
        const timeoutId = window.setTimeout(() => {
          setPressedNotes(prev => {
            const newSet = new Set(prev);
            newSet.delete(note);
            setActiveChord(detectChord(Array.from(newSet)));
            return newSet;
          });
          sustainedNotesRef.current.delete(note);
          sustainTimeoutsRef.current.delete(note);
        }, 2600);
        sustainTimeoutsRef.current.set(note, timeoutId);
        return;
      }
      setPressedNotes(prev => {
        const newSet = new Set(prev);
        newSet.delete(note);
        setActiveChord(detectChord(Array.from(newSet)));
        return newSet;
      });
    });

    // Pedal de sustain (CC 64)
    const unsubCc = onCc((controller: number, value: number) => {
      if (controller === 64) {
        const pressed = value >= 64;
        console.log('[MIDI] Sustain pedal:', pressed ? 'ON' : 'OFF');
        sustainPedalRef.current = pressed;
        if (!pressed && sustainedNotesRef.current.size > 0) {
          setPressedNotes(prev => {
            const newSet = new Set(prev);
            sustainedNotesRef.current.forEach(n => newSet.delete(n));
            setActiveChord(detectChord(Array.from(newSet)));
            return newSet;
          });
          sustainedNotesRef.current.clear();
        }
      }
    });

    return () => {
      console.log('[MIDI] Removendo listeners');
      unsubOn();
      unsubOff();
      unsubCc();
    };
  }, [isMidiConnected, checkResponse]);

  // ========== Teclado Virtual ==========
  const handleVirtualNotePlay = (midi: number) => {
    setPressedNotes(prev => {
      const newSet = new Set(prev);
      newSet.add(midi);
      const arr = Array.from(newSet);
      setActiveChord(detectChord(arr));
      setTimeout(() => checkResponse(Array.from(newSet)), 200);
      return newSet;
    });
    playNote(midi, '0.3');
  };

  const handleVirtualNoteStop = (midi: number) => {
    setPressedNotes(prev => {
      const newSet = new Set(prev);
      newSet.delete(midi);
      setActiveChord(detectChord(Array.from(newSet)));
      return newSet;
    });
  };

  // ========== Checar resposta de múltipla escolha ==========
  const checkMultipleChoice = (selectedAnswer: string) => {
    if (feedback !== 'idle') return;

    let correctAnswer = '';
    switch (mode) {
      case 'chord':
        correctAnswer = targetChord.symbol;
        break;
      case 'interval':
        correctAnswer = targetInterval.name;
        break;
      case 'harmonic-field':
      case 'harmonic-field-minor': {
        const isMinor = mode === 'harmonic-field-minor';
        const field = buildHarmonicField(harmonicKey, isMinor ? 'minor' : 'major');
        const degreeToSymbol = new Map<string, string>();
        field.chords.forEach(c => degreeToSymbol.set(c.degree, c.symbol));
        const deg = targetChord.degree || '';
        correctAnswer = showChordInOptions 
          ? `${deg} — ${degreeToSymbol.get(deg) || ''}` 
          : deg;
        break;
      }
    }

    const isCorrect = selectedAnswer === correctAnswer;
    if (isCorrect) {
      setFeedback('correct');
      setFeedbackMessage(`✓ ${correctAnswer} correto!`);
      setSessionAttempts(prev => prev + 1);
    } else {
      // RESILIENTE: flash vermelho mas volta para idle p/ tentar de novo
      setFeedback('wrong');
      setFeedbackMessage(`✗ ${selectedAnswer} - tente novamente!`);
      setStreak(0);
      scheduleAudio(() => {
        setFeedback('idle');
        setFeedbackMessage('');
      }, 1200);
      return;
    }

    if (isCorrect) {
      setStreak(prev => prev + 1);
      setSessionCorrect(prev => prev + 1);
      if (isAudioStarted) {
        playChordOnPiano([72, 76, 79], '0.3').catch(() => {});
      }
      setTimeout(() => generateNewExercise(), 1500);
    } else {
      setStreak(0);
    }
  };

  // Gerar opções de múltipla escolha (MEMOIZADO - só recalcula ao trocar exercício)
  const multipleChoiceOptions = useMemo((): string[] => {
    switch (mode) {
      case 'chord': {
        // 4 opções: a correta + 3 erradas
        const correct = targetChord.symbol;
        const rootName = NOTE_NAMES[targetChord.midi[0] % 12];
        const distractors = CHORD_TYPES
          .filter(c => `${rootName}${c.symbol}` !== correct)
          .slice(0, 5)
          .map(c => `${rootName}${c.symbol}`);
        const options = [correct, ...distractors.slice(0, 3)];
        return shuffleArray(options);
      }
      case 'interval': {
        const correct = targetInterval.name;
        const distractors = INTERVALS
          .filter(i => i.shortName !== correct && i.semitones > 0)
          .slice(0, 5)
          .map(i => i.shortName);
        return shuffleArray([correct, ...distractors.slice(0, 3)]);
      }
      case 'harmonic-field':
      case 'harmonic-field-minor': {
        const isMinor = mode === 'harmonic-field-minor';
        const correctDegree = targetChord.degree || '';
        const field = buildHarmonicField(harmonicKey, isMinor ? 'minor' : 'major');
        
        // Filtrar graus pela dificuldade
        const allowedIdxs = 
          difficulty === 'easy' ? [0, 3, 4]
          : difficulty === 'medium' ? [0, 1, 3, 4, 5]
          : [0, 1, 2, 3, 4, 5, 6];
        const allowedChords = allowedIdxs.map(i => field.chords[i]);
        
        // Mapear grau -> símbolo do acorde
        const degreeToSymbol = new Map<string, string>();
        allowedChords.forEach(c => degreeToSymbol.set(c.degree, c.symbol));
        
        // Selecionar distratores entre graus permitidos
        const otherDegrees = allowedChords
          .map(c => c.degree)
          .filter(d => d !== correctDegree);
        const numDistractors = Math.min(3, otherDegrees.length);
        const distractors = shuffleArray(otherDegrees).slice(0, numDistractors);
        
        const allOptions = shuffleArray([correctDegree, ...distractors]);
        
        return allOptions.map(degree => 
          showChordInOptions ? `${degree} — ${degreeToSymbol.get(degree) || ''}` : degree
        );
      }
      case 'progression': {
        // Filtrar graus pela dificuldade
        const field = buildHarmonicField(progression.key, 'major');
        const allowedIdxs = 
          difficulty === 'easy' ? [0, 3, 4]
          : difficulty === 'medium' ? [0, 1, 3, 4, 5]
          : [0, 1, 2, 3, 4, 5, 6];
        return allowedIdxs.map(i => {
          const c = field.chords[i];
          return showChordInOptions ? `${c.degree} — ${c.symbol}` : c.degree;
        });
      }
      default:
        return [];
    }
  }, [mode, targetChord, targetInterval, harmonicKey, progression.key, difficulty, showChordInOptions]);

  // ========== Reset ao mudar modo ==========
  useEffect(() => {
    // Limpar tudo antes de gerar novo exercício
    setPressedNotes(new Set());
    setActiveChord(null);
    setFeedback('idle');
    setFeedbackMessage('');
    checkInProgressRef.current = false;
    isTransitioningRef.current = true;
    
    generateNewExercise();
    setStreak(0);
    setSessionAttempts(0);
    setSessionCorrect(0);
  }, [mode, generateNewExercise]);

  // ========== Replay áudio ==========
  const replayExercise = () => {
    cancelAllAudio();
    switch (mode) {
      case 'note':
        playNote(targetNote);
        break;
      case 'interval':
        playInterval(targetInterval.from, targetInterval.to);
        break;
      case 'chord':
      case 'chord-replicate':
        playChord(targetChord.midi);
        break;
      case 'harmonic-field':
      case 'harmonic-field-minor':
        playChord(targetChord.midi, '1.5');
        break;
      case 'progression': {
        progression.chords.forEach((c, i) => {
          scheduleAudio(() => playChord(c.midi, '1'), i * 1100);
        });
        break;
      }
    }
  };

  const activeNotesArray = Array.from(pressedNotes);
  const accuracy = sessionAttempts > 0 ? Math.round((sessionCorrect / sessionAttempts) * 100) : 0;

  // ========== Renderização do "Alvo" do exercício ==========
  const renderTargetDisplay = () => {
    switch (mode) {
      case 'note':
        return (
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-2">
              {isBlindMode ? '🎧 Escute e toque!' : 'Toque esta nota:'}
            </div>
            <div className={`text-7xl font-bold transition-colors duration-200 ${
              feedback === 'correct' ? 'text-green-500' :
              feedback === 'wrong' ? 'text-red-500' :
              isBlindMode ? 'text-gray-300 blur-sm select-none' : 'text-primary-600'
            }`}>
              {isBlindMode ? '???' : midiToNoteName(targetNote)}
            </div>
            {!isBlindMode && (
              <div className="text-sm text-gray-400 mt-2">
                ({NOTE_NAMES_PT[NOTE_NAMES[targetNote % 12]]})
              </div>
            )}
          </div>
        );

      case 'interval': {
        const fromName = midiToNoteName(targetInterval.from);
        const toName = midiToNoteName(targetInterval.to);
        const revealed = feedback === 'correct' || showAnswer;
        return (
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-2">🎧 Qual o intervalo a partir desta nota?</div>
            {/* Nota de referência - SEMPRE visível para o usuário achar no instrumento */}
            <div className="flex items-center justify-center gap-3 my-3">
              <div className="flex flex-col items-center">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Partindo de</span>
                <span className="text-4xl font-bold text-blue-600 font-mono">{fromName}</span>
              </div>
              <span className="text-2xl text-gray-400">→</span>
              <div className="flex flex-col items-center">
                <span className="text-xs text-gray-400 uppercase tracking-wider">{revealed ? 'até' : 'até ?'}</span>
                <span className={`text-4xl font-bold font-mono ${
                  revealed ? 'text-green-600' : 'text-gray-300'
                }`}>
                  {revealed ? toName : '???'}
                </span>
              </div>
            </div>
            {/* Nome do intervalo */}
            <div className={`text-3xl font-bold ${
              feedback === 'correct' ? 'text-green-500' : 'text-primary-600'
            }`}>
              {revealed ? targetInterval.name : '?'}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Identifique o intervalo entre as duas notas tocadas
            </div>
          </div>
        );
      }

      case 'chord':
        return (
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-2">🎧 Qual o acorde?</div>
            <div className={`text-6xl font-bold ${
              feedback === 'correct' ? 'text-green-500' : 'text-primary-600'
            }`}>
              {feedback !== 'idle' ? targetChord.symbol : '?'}
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Replique o acorde no teclado
            </div>
          </div>
        );

      case 'harmonic-field':
      case 'harmonic-field-minor': {
        const isMinor = mode === 'harmonic-field-minor';
        const revealed = feedback === 'correct' || showAnswer;
        return (
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-2">
              Tonalidade: <span className="font-bold text-primary-600">{harmonicKey} {isMinor ? 'menor' : 'Maior'}</span>
            </div>
            <div className="text-sm text-gray-500 mb-2">🎧 Qual o grau deste acorde?</div>
            <div className={`text-5xl font-bold ${
              feedback === 'correct' ? 'text-green-500' : isMinor ? 'text-pink-600' : 'text-purple-600'
            }`}>
              {revealed ? `${targetChord.degree} (${targetChord.symbol})` : '???'}
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Replique o acorde no teclado ou escolha o grau
            </div>
          </div>
        );
      }

      case 'chord-replicate':
        return (
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-2">🎧 Replique este acorde:</div>
            <div className={`text-6xl font-bold ${
              feedback === 'correct' ? 'text-green-500' : 'text-primary-600'
            }`}>
              {targetChord.symbol}
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Notas: {targetChord.midi.map(m => NOTE_NAMES[m % 12]).join(' - ')}
            </div>
          </div>
        );

      case 'progression': {
        const slotsCorrect = progression.chords.map((c, i) => {
          const answered = progression.userAnswer[i];
          return answered ? answered === c.degree : null;
        });
        return (
          <div className="text-center w-full">
            <div className="text-sm text-gray-500 mb-1">
              Tonalidade: <span className="font-bold text-primary-600">{progression.key} Maior</span>
            </div>
            <div className="text-sm text-gray-500 mb-3">🎧 Identifique a sequência de {progression.chords.length} acordes:</div>
            <div className="flex justify-center gap-2 flex-wrap">
              {progression.chords.map((c, i) => {
                const answered = progression.userAnswer[i];
                const isCorrect = slotsCorrect[i];
                const canClear = answered !== undefined && feedback !== 'correct';
                return (
                  <div
                    key={i}
                    onClick={() => canClear && clearProgressionSlot(i)}
                    title={canClear ? 'Clique para limpar' : ''}
                    className={`min-w-[80px] px-3 py-3 rounded-lg border-2 font-bold text-lg transition-all ${
                      canClear ? 'cursor-pointer hover:opacity-70' : ''
                    } ${
                      feedback === 'idle' && answered === undefined
                        ? 'border-dashed border-gray-300 text-gray-400 bg-gray-50'
                        : feedback === 'correct'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : feedback === 'wrong' && answered !== undefined
                        ? isCorrect
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-red-500 bg-red-50 text-red-700'
                        : answered !== undefined
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-dashed border-gray-300 text-gray-400 bg-gray-50'
                    }`}
                  >
                    <div className="text-xs text-gray-400">#{i + 1}</div>
                    <div>
                      {/* Revelar acorde correto APENAS quando: acertou OU usuário clicou gabarito */}
                      {feedback === 'correct' || showAnswer
                        ? showChordInOptions
                          ? `${c.degree} — ${c.symbol}`
                          : c.degree
                        : answered
                        ? showChordInOptions
                          ? `${answered} — ${progression.chords.find(ch => ch.degree === answered)?.symbol || ''}`
                          : answered
                        : '?'}
                    </div>
                  </div>
                );
              })}
            </div>
            {feedback === 'idle' && (
              <div className="text-xs text-gray-500 mt-2">
                Acorde {progression.userAnswer.length + 1} de {progression.chords.length}
              </div>
            )}
          </div>
        );
      }
    }
  };

  // Handler de resposta da progressão (clique em botão)
  // Usa functional update para evitar race condition com cliques rápidos
  const handleProgressionAnswer = (degreeAnswer: string) => {
    if (feedback === 'correct') return;
    
    setProgression(prev => {
      // Se já estiver cheio, não adiciona mais
      if (prev.userAnswer.length >= prev.chords.length) return prev;
      
      const newAnswers = [...prev.userAnswer, degreeAnswer];
      const newProgression = { ...prev, userAnswer: newAnswers };
      
      // Se completou todas as escolhas, validar
      if (newAnswers.length === prev.chords.length) {
        const allCorrect = newAnswers.every((ans, i) => ans === prev.chords[i].degree);
        if (allCorrect) {
          setFeedback('correct');
          setFeedbackMessage(`✓ Progressão correta: ${prev.chords.map(c => c.degree).join(' - ')}`);
          setSessionAttempts(s => s + 1);
          setStreak(s => s + 1);
          setSessionCorrect(s => s + 1);
          if (isAudioStarted) {
            playChordOnPiano([72, 76, 79], '0.3').catch(() => {});
          }
          scheduleAudio(() => generateNewExercise(), 2200);
        } else {
          // RESILIENTE: marca erros mas não avança. Usuário pode corrigir.
          setFeedback('wrong');
          setFeedbackMessage('✗ Errou em algumas posições. Clique nos slots vermelhos para corrigir.');
          setStreak(0);
        }
      }
      
      return newProgression;
    });
  };

  // Limpar slot da progressão ao clicar nele (para corrigir)
  const clearProgressionSlot = (slotIdx: number) => {
    setProgression(prev => {
      // Remove o slot e todos depois (usuário refaz a partir dali)
      const newAnswers = prev.userAnswer.slice(0, slotIdx);
      return { ...prev, userAnswer: newAnswers };
    });
    // Reset feedback para idle p/ permitir nova tentativa
    setFeedback('idle');
    setFeedbackMessage('');
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Seletor de Modo */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 justify-center">
          {EXERCISES.map(ex => (
            <button
              key={ex.mode}
              onClick={() => setMode(ex.mode)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                mode === ex.mode
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
              title={ex.description}
            >
              {ex.label}
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-gray-500 mt-2">
          {EXERCISES.find(e => e.mode === mode)?.description}
        </p>
        
        {/* Seletor de Níveis - só para campo harmônico e progressões */}
        {(mode === 'harmonic-field' || mode === 'harmonic-field-minor' || mode === 'progression') && (
          <div className="flex justify-center mt-3 flex-wrap gap-2">
            <span className="text-xs text-gray-500 self-center mr-1">Nível:</span>
            <div className="inline-flex bg-gray-100 rounded-lg p-1 gap-1">
              <button
                onClick={() => { setDifficulty('easy'); generateNewExercise(); }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  difficulty === 'easy'
                    ? 'bg-green-500 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Apenas I, IV, V"
              >
                🟢 Fácil
              </button>
              <button
                onClick={() => { setDifficulty('medium'); generateNewExercise(); }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  difficulty === 'medium'
                    ? 'bg-yellow-500 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="I, ii, IV, V, vi"
              >
                🟡 Médio
              </button>
              <button
                onClick={() => { setDifficulty('hard'); generateNewExercise(); }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  difficulty === 'hard'
                    ? 'bg-red-500 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Todos os 7 graus"
              >
                🔴 Difícil
              </button>
            </div>
          </div>
        )}

        {/* Toggle Cheio/Arpejo - só para modos com acordes */}
        {(mode === 'chord' || mode === 'harmonic-field' || mode === 'harmonic-field-minor' || mode === 'chord-replicate' || mode === 'progression') && (
          <div className="flex justify-center mt-3">
            <div className="inline-flex bg-gray-100 rounded-lg p-1 gap-1">
              <button
                onClick={async () => {
                  setPlayStyle('block');
                  cancelAllAudio();
                  await startAudio();
                  // Preview com estilo block (forçado)
                  if (mode === 'progression' && progression.chords.length > 0) {
                    playChordOnPiano(progression.chords[0].midi, '1.2');
                  } else if (targetChord.midi.length > 0) {
                    playChordOnPiano(targetChord.midi, '1.5');
                  }
                }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  playStyle === 'block'
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                🎹 Cheio
              </button>
              <button
                onClick={async () => {
                  setPlayStyle('arpeggio');
                  cancelAllAudio();
                  await startAudio();
                  // Preview com estilo arpejo (forçado)
                  if (mode === 'progression' && progression.chords.length > 0) {
                    playSequenceOnPiano(progression.chords[0].midi, 0.12, '0.8');
                  } else if (targetChord.midi.length > 0) {
                    playSequenceOnPiano(targetChord.midi, 0.12, '0.8');
                  }
                }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  playStyle === 'arpeggio'
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                🎵 Arpejo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-primary-600">{accuracy}%</div>
          <div className="text-xs text-gray-500">Precisão</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-primary-600">{streak}</div>
          <div className="text-xs text-gray-500">Sequência</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-primary-600">{sessionAttempts}</div>
          <div className="text-xs text-gray-500">Tentativas</div>
        </div>
      </div>

      {/* Área do exercício - ALTURA FIXA para não pular */}
      <div className="card mb-6" style={{ minHeight: '380px' }}>
        {/* Toggle Blind Mode (apenas para 'note') */}
        {mode === 'note' && (
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setIsBlindMode(!isBlindMode)}
              className={`inline-flex items-center gap-2 px-3 py-1 rounded text-xs font-medium ${
                isBlindMode ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {isBlindMode ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {isBlindMode ? 'Modo Blind' : 'Modo Normal'}
            </button>
          </div>
        )}

        {/* Display do alvo - container com altura fixa */}
        <div style={{ minHeight: '140px' }} className="flex items-center justify-center">
          {renderTargetDisplay()}
        </div>

        {/* Botões de Múltipla Escolha - para chord, interval, harmonic-field, harmonic-field-minor, progression */}
        {(mode === 'chord' || mode === 'interval' || mode === 'harmonic-field' || mode === 'harmonic-field-minor' || mode === 'progression') && (
          <div className="mt-4">
            {/* Config: mostrar acorde nas alternativas (só para campo harmônico e progressão) */}
            {(mode === 'harmonic-field' || mode === 'harmonic-field-minor' || mode === 'progression') && (
              <div className="flex justify-center mb-2">
                <label className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showChordInOptions}
                    onChange={(e) => setShowChordInOptions(e.target.checked)}
                    className="rounded"
                  />
                  Mostrar acorde junto ao grau (ex: IV — F)
                </label>
              </div>
            )}
            <div className="text-xs text-gray-500 text-center mb-2">
              {mode === 'progression' 
                ? `Clique nos graus na ordem que ouviu (${progression.userAnswer.length}/${progression.chords.length}):`
                : 'Escolha a resposta:'}
            </div>
            <div className={`flex flex-wrap gap-2 justify-center max-w-3xl mx-auto ${
              mode === 'progression' ? '' : ''
            }`}>
              {multipleChoiceOptions.map((option: string) => {
                // Para progression: extrair só o grau (parte antes do —)
                const degree = mode === 'progression' && option.includes('—') 
                  ? option.split('—')[0].trim() 
                  : option;
                return (
                <button
                  key={option}
                  onClick={() => {
                    if (mode === 'progression') {
                      handleProgressionAnswer(degree);
                    } else {
                      checkMultipleChoice(option);
                    }
                  }}
                  disabled={feedback !== 'idle'}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    mode === 'progression' ? 'min-w-[64px]' : 'min-w-[140px]'
                  } ${
                    feedback !== 'idle'
                      ? 'opacity-60 cursor-not-allowed bg-gray-100 text-gray-500'
                      : 'bg-white border-2 border-primary-200 text-primary-700 hover:bg-primary-50 hover:border-primary-400 active:scale-95'
                  }`}
                >
                  {option}
                </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Feedback - container com altura fixa para não pular */}
        <div style={{ minHeight: '40px' }} className="text-center mt-2">
          {feedback === 'correct' && (
            <div className="text-green-600 font-medium flex items-center justify-center gap-2">
              <Trophy className="w-4 h-4" />
              {feedbackMessage}
            </div>
          )}
          {showAnswer && feedback !== 'correct' && (
            <div className="text-blue-700 font-medium text-sm bg-blue-50 border border-blue-300 rounded-lg px-3 py-1 inline-block">
              📖 Gabarito: {
                mode === 'note' ? midiToNoteName(targetNote)
                : mode === 'interval' ? targetInterval.name
                : mode === 'chord' ? targetChord.symbol
                : mode === 'chord-replicate' ? `${targetChord.symbol} (${targetChord.midi.map(m => NOTE_NAMES[m % 12]).join('-')})`
                : mode === 'harmonic-field' || mode === 'harmonic-field-minor' 
                  ? `${targetChord.degree} — ${targetChord.symbol}`
                : mode === 'progression'
                  ? progression.chords.map(c => showChordInOptions ? `${c.degree} (${c.symbol})` : c.degree).join(' → ')
                : ''
              }
            </div>
          )}
          {feedback === 'wrong' && !showAnswer && (
            <div className="text-red-600 font-medium text-sm">
              {feedbackMessage}
            </div>
          )}
        </div>

        {/* Controles */}
        <div className="flex justify-center gap-3 mt-4 flex-wrap">
          <button onClick={replayExercise} className="btn-secondary flex items-center gap-2 text-sm">
            <Volume2 className="w-4 h-4" /> Ouvir
          </button>
          {(mode === 'harmonic-field' || mode === 'harmonic-field-minor' || mode === 'progression') && (
            <button
              onClick={async () => {
                await startAudio();
                const isMinor = mode === 'harmonic-field-minor';
                const key = mode === 'progression' ? progression.key : harmonicKey;
                const tonicMidi = 60 + NOTE_NAMES.indexOf(key);
                const tonicChord = generateChordMidi(tonicMidi, isMinor ? CHORD_TYPES[1] : CHORD_TYPES[0]);
                if (playStyle === 'arpeggio') {
                  playSequenceOnPiano(tonicChord, 0.12, '0.8');
                } else {
                  playChordOnPiano(tonicChord, '1.2');
                }
              }}
              className="btn-secondary flex items-center gap-2 text-sm bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100"
            >
              🎯 Tônica
            </button>
          )}
          {/* Botão Mostrar Gabarito - revela a resposta correta */}
          {feedback !== 'correct' && (
            <button
              onClick={() => setShowAnswer(true)}
              className="btn-secondary flex items-center gap-2 text-sm bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              👁️ Gabarito
            </button>
          )}
          <button onClick={generateNewExercise} className="btn-secondary flex items-center gap-2 text-sm">
            <Play className="w-4 h-4" /> Próximo
          </button>
          <button
            onClick={() => {
              setStreak(0);
              setSessionAttempts(0);
              setSessionCorrect(0);
              generateNewExercise();
            }}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RotateCcw className="w-4 h-4" /> Reiniciar
          </button>
        </div>
      </div>

      {/* Teclado Virtual - com 100px padding lateral */}
      <div className="mb-6" style={{ paddingLeft: '100px', paddingRight: '100px' }}>
        <PianoKeyboard
          activeNotes={activeNotesArray}
          targetNote={null}
          showTarget={false}
          onNotePlay={handleVirtualNotePlay}
          onNoteStop={handleVirtualNoteStop}
          chordName={activeChord}
        />
      </div>

      {/* Status conexão */}
      {!isMidiConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center text-sm text-yellow-800">
          🔌 Conecte seu teclado MIDI ou use o teclado virtual abaixo
        </div>
      )}
    </div>
  );
}
