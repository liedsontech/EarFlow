import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Piano, MidiNumbers } from 'react-piano';
import 'react-piano/dist/styles.css';

interface PianoKeyboardProps {
  activeNotes: number[];
  targetNote?: number | null;
  showTarget?: boolean;
  onNotePlay?: (midiNumber: number) => void;
  onNoteStop?: (midiNumber: number) => void;
  chordName?: string | null;
}

// Ranges por breakpoint (serão ajustados dinamicamente)
const RANGES = {
  mobile: { first: MidiNumbers.fromNote('C3'), last: MidiNumbers.fromNote('B5') },     // 3 oitavas
  tablet: { first: MidiNumbers.fromNote('C2'), last: MidiNumbers.fromNote('B4') },     // 3 oitavas
  desktop: { first: MidiNumbers.fromNote('C1'), last: MidiNumbers.fromNote('C6') },      // 5 oitavas
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function getNoteInOctave(midi: number): string {
  return NOTE_NAMES[midi % 12];
}

function getOctave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

export function PianoKeyboard({ 
  activeNotes, 
  targetNote, 
  showTarget = true, 
  onNotePlay, 
  onNoteStop, 
  chordName 
}: PianoKeyboardProps) {
  const [playedNotes, setPlayedNotes] = useState<Set<number>>(new Set());
  const [containerWidth, setContainerWidth] = useState(1000);
  const [range, setRange] = useState(RANGES.desktop);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPlayedNotes(new Set(activeNotes));
  }, [activeNotes]);

  // Detectar largura do container pai e ajustar
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateWidth = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        setContainerWidth(w);
        // Ajustar range dinamicamente baseado na largura
        if (w < 640) {
          setRange(RANGES.mobile);
        } else if (w < 1024) {
          setRange(RANGES.tablet);
        } else {
          setRange(RANGES.desktop);
        }
      }
    };
    
    updateWidth();
    
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(containerRef.current);
    
    return () => resizeObserver.disconnect();
  }, []);

  // Agrupar notas por oitava
  const notesByOctave: { [octave: number]: number[] } = {};
  activeNotes.forEach(note => {
    const oct = getOctave(note);
    if (!notesByOctave[oct]) notesByOctave[oct] = [];
    notesByOctave[oct].push(note);
  });

  const { t } = useTranslation();
  return (
    <div className="piano-component w-full" ref={containerRef}>
      {/* Painel de Cifras - ALTURA FIXA */}
      <div 
        className="chord-display bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-t-xl px-4 shadow-lg flex items-center"
        style={{ height: '90px', minHeight: '90px' }}
      >
        <div className="flex items-center justify-between w-full">
          {/* Notas sendo tocadas — oculto em mobile (ilegível em telas pequenas) */}
          <div className="hidden md:block flex-1 min-w-0">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">
              {t('ui.notesPressed')} ({activeNotes.length})
            </div>
            <div className="flex flex-wrap gap-1 overflow-hidden" style={{ maxHeight: '40px' }}>
              {activeNotes.length === 0 ? (
                <span className="text-gray-500 italic text-sm">{t('ui.touchKeyboard')}</span>
              ) : (
                Object.entries(notesByOctave).map(([oct, notes]) => (
                  <span key={oct} className="bg-gray-700 px-2 py-1 rounded text-xs whitespace-nowrap">
                    {notes.map(n => getNoteInOctave(n)).join(',')}
                    <sub className="text-xs text-gray-400 ml-1">{oct}</sub>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Desktop: Acorde Detectado */}
          <div className="hidden md:block text-right" style={{ minWidth: '180px' }}>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">
              {t('ui.chordDetected')}
            </div>
            <div style={{ height: '40px' }} className="flex items-center justify-end">
              {chordName ? (
                <span className="text-3xl font-bold text-yellow-400 font-mono">
                  {chordName}
                </span>
              ) : activeNotes.length >= 2 ? (
                <span className="text-lg text-gray-500">{t('ui.analyzing')}</span>
              ) : (
                <span className="text-gray-500 italic text-sm">{t('ui.threeOrMore')}</span>
              )}
            </div>
          </div>

          {/* Mobile: Nota tocada (mais útil com poucas teclas visíveis) */}
          <div className="md:hidden text-right flex-1">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">
              {t('ui.noteTouched')}
            </div>
            <div style={{ height: '40px' }} className="flex items-center justify-end">
              {activeNotes.length > 0 ? (
                <span className="text-2xl font-bold text-yellow-400 font-mono">
                  {NOTE_NAMES[activeNotes[activeNotes.length - 1] % 12]}{getOctave(activeNotes[activeNotes.length - 1])}
                </span>
              ) : (
                <span className="text-gray-500 italic text-sm">{t('ui.touchNote')}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Teclado - Ocupa 100% da largura disponível */}
      <div className="bg-gray-100 rounded-b-xl shadow-inner w-full" style={{ padding: '8px 0' }}>
        <div className="w-full flex justify-center">
          <Piano
            noteRange={{ first: range.first, last: range.last }}
            activeNotes={activeNotes}
            playNote={(midiNumber: number) => {
              onNotePlay?.(midiNumber);
            }}
            stopNote={(midiNumber: number) => {
              onNoteStop?.(midiNumber);
            }}
            width={containerWidth}
            keyWidthToHeight={containerWidth < 640 ? 0.22 : 0.15}
            renderNoteLabel={({ midiNumber, isAccidental }: any) => {
              const isPressed = playedNotes.has(midiNumber);
              const isTarget = showTarget && targetNote === midiNumber;
              const noteName = NOTE_NAMES[midiNumber % 12];
              const octave = getOctave(midiNumber);
              const isC = midiNumber % 12 === 0; // Marcar Cs

              return (
                <div
                  className={`text-[8px] font-medium ${
                    isAccidental ? 'text-gray-400' : 'text-gray-600'
                  } ${isPressed ? 'text-white font-bold' : ''} ${isTarget ? 'text-green-300 font-bold' : ''}`}
                >
                  {isTarget && <div className="text-green-500 text-xs">🎯</div>}
                  {isPressed && <div className="animate-pulse text-xs">●</div>}
                  {isC && !isPressed && !isTarget && (
                    <div className="font-bold text-blue-600">
                      {noteName}{octave}
                    </div>
                  )}
                </div>
              );
            }}
          />
        </div>

        {/* Info de oitavas */}
        <div className="flex justify-center gap-4 mt-2 text-xs text-gray-500 px-4">
          <span>
            📍 {range === RANGES.mobile && t('piano.range_mobile')}
            {range === RANGES.tablet && t('piano.range_tablet')}
            {range === RANGES.desktop && t('piano.range_desktop')}
          </span>
          <span className="text-blue-600">● {t('piano.notePlayed')}</span>
          {showTarget && <span className="text-green-600">🎯 {t('piano.targetNote')}</span>}
        </div>
      </div>
    </div>
  );
}
