import * as Tone from 'tone';
import type { Instrument } from '../types';

// ============================================================================
// Multi-instrument sampler: Piano, Bass, Guitar
// Samples livres (CC) hospedados por:
//   Piano   -> tonejs.github.io (Salamander Grand)
//   Bass    -> nbrosowsky.github.io/tonejs-instruments (Electric Bass)
//   Guitars -> nbrosowsky.github.io/tonejs-instruments (Acoustic/Electric)
// ============================================================================

interface SamplerConfig {
  urls: Record<string, string>;
  baseUrl: string;
  release: number;
}

const PIANO_SAMPLES: Record<string, string> = {
  'A0': 'A0.mp3', 'C1': 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
  'A1': 'A1.mp3', 'C2': 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
  'A2': 'A2.mp3', 'C3': 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
  'A3': 'A3.mp3', 'C4': 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
  'A4': 'A4.mp3', 'C5': 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
  'A5': 'A5.mp3', 'C6': 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
  'A6': 'A6.mp3', 'C7': 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
  'A7': 'A7.mp3', 'C8': 'C8.mp3',
};

// Mapeamento OFICIAL do nbrosowsky/tonejs-instruments
// (chave = nota Tone.js, valor = nome do arquivo .mp3)
// Importante: o Sampler aceita # mas o arquivo no servidor usa "s"
const BASS_ELECTRIC_SAMPLES: Record<string, string> = {
  'A#1': 'As1.mp3', 'A#2': 'As2.mp3', 'A#3': 'As3.mp3', 'A#4': 'As4.mp3',
  'C#1': 'Cs1.mp3', 'C#2': 'Cs2.mp3', 'C#3': 'Cs3.mp3', 'C#4': 'Cs4.mp3',
  'E1':  'E1.mp3',  'E2':  'E2.mp3',  'E3':  'E3.mp3',  'E4':  'E4.mp3',
  'G1':  'G1.mp3',  'G2':  'G2.mp3',  'G3':  'G3.mp3',  'G4':  'G4.mp3',
};

const GUITAR_ACOUSTIC_SAMPLES: Record<string, string> = {
  'F4': 'F4.mp3',
  'F#2': 'Fs2.mp3', 'F#3': 'Fs3.mp3', 'F#4': 'Fs4.mp3',
  'G2': 'G2.mp3', 'G3': 'G3.mp3', 'G4': 'G4.mp3',
  'G#2': 'Gs2.mp3', 'G#3': 'Gs3.mp3', 'G#4': 'Gs4.mp3',
  'A2': 'A2.mp3', 'A3': 'A3.mp3', 'A4': 'A4.mp3',
  'A#2': 'As2.mp3', 'A#3': 'As3.mp3', 'A#4': 'As4.mp3',
  'B2': 'B2.mp3', 'B3': 'B3.mp3', 'B4': 'B4.mp3',
  'C3': 'C3.mp3', 'C4': 'C4.mp3', 'C5': 'C5.mp3',
  'C#3': 'Cs3.mp3', 'C#4': 'Cs4.mp3', 'C#5': 'Cs5.mp3',
  'D2': 'D2.mp3', 'D3': 'D3.mp3', 'D4': 'D4.mp3', 'D5': 'D5.mp3',
  'D#2': 'Ds2.mp3', 'D#3': 'Ds3.mp3',
  'E2': 'E2.mp3', 'E3': 'E3.mp3', 'E4': 'E4.mp3',
  'F2': 'F2.mp3', 'F3': 'F3.mp3',
};

const GUITAR_ELECTRIC_SAMPLES: Record<string, string> = {
  'D#3': 'Ds3.mp3', 'D#4': 'Ds4.mp3', 'D#5': 'Ds5.mp3',
  'E2':  'E2.mp3',
  'F#2': 'Fs2.mp3', 'F#3': 'Fs3.mp3', 'F#4': 'Fs4.mp3', 'F#5': 'Fs5.mp3',
  'A2':  'A2.mp3',  'A3':  'A3.mp3',  'A4':  'A4.mp3',  'A5':  'A5.mp3',
  'C3':  'C3.mp3',  'C4':  'C4.mp3',  'C5':  'C5.mp3',  'C6':  'C6.mp3',
  'C#2': 'Cs2.mp3',
};

const INSTRUMENTS: Record<Instrument, SamplerConfig> = {
  'piano': {
    urls: PIANO_SAMPLES,
    baseUrl: 'https://tonejs.github.io/audio/salamander/',
    release: 1,
  },
  'bass-electric': {
    urls: BASS_ELECTRIC_SAMPLES,
    baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/bass-electric/',
    release: 0.6,
  },
  'guitar-acoustic': {
    urls: GUITAR_ACOUSTIC_SAMPLES,
    baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-acoustic/',
    release: 1.2,
  },
  'guitar-electric': {
    urls: GUITAR_ELECTRIC_SAMPLES,
    baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-electric/',
    release: 0.8,
  },
};

// Cache de samplers por instrumento
const samplers = new Map<Instrument, Tone.Sampler>();
const loadPromises = new Map<Instrument, Promise<Tone.Sampler>>();

// Instrumento atualmente selecionado
let currentInstrument: Instrument = 'piano';

export function getCurrentInstrument(): Instrument {
  return currentInstrument;
}

export function setCurrentInstrument(inst: Instrument): void {
  currentInstrument = inst;
  // Pré-carrega ao trocar
  getSampler(inst).catch(err => console.warn('Falha ao pré-carregar', inst, err));
}

export async function getSampler(inst: Instrument = currentInstrument): Promise<Tone.Sampler> {
  const cached = samplers.get(inst);
  if (cached && cached.loaded) return cached;

  const pending = loadPromises.get(inst);
  if (pending) return pending;

  const config = INSTRUMENTS[inst];
  const promise = new Promise<Tone.Sampler>((resolve, reject) => {
    const sampler = new Tone.Sampler({
      urls: config.urls,
      baseUrl: config.baseUrl,
      release: config.release,
      onload: () => {
        samplers.set(inst, sampler);
        loadPromises.delete(inst);
        resolve(sampler);
      },
      onerror: (err) => {
        loadPromises.delete(inst);
        reject(err);
      },
    }).toDestination();
  });

  loadPromises.set(inst, promise);
  return promise;
}

// Para contrabaixo: forçar nota em 2 oitavas graves (C1 = 24 até B2 = 47)
// e sempre tocar apenas UMA nota (a mais grave / fundamental)
const BASS_LOW = 24;  // C1
const BASS_HIGH = 47; // B2

function adjustForBass(midi: number): number {
  let n = midi;
  while (n > BASS_HIGH) n -= 12;
  while (n < BASS_LOW) n += 12;
  return n;
}

function isBass(): boolean {
  return currentInstrument === 'bass-electric';
}

export async function playNote(midi: number, duration: string | number = '0.5'): Promise<void> {
  const s = await getSampler();
  const final = isBass() ? adjustForBass(midi) : midi;
  s.triggerAttackRelease(Tone.Frequency(final, 'midi').toNote(), duration);
}

export async function playChord(midiNotes: number[], duration: string | number = '1'): Promise<void> {
  const s = await getSampler();
  // Contrabaixo: só toca a fundamental (nota mais grave) em região grave
  if (isBass()) {
    const root = Math.min(...midiNotes);
    s.triggerAttackRelease(Tone.Frequency(adjustForBass(root), 'midi').toNote(), duration);
    return;
  }
  // Violão/Guitarra: palhetada (arpejo bem rápido, ~25ms entre cordas)
  if (currentInstrument === 'guitar-acoustic' || currentInstrument === 'guitar-electric') {
    const sorted = [...midiNotes].sort((a, b) => a - b);
    sorted.forEach((m, i) => {
      setTimeout(() => {
        s.triggerAttackRelease(Tone.Frequency(m, 'midi').toNote(), duration);
      }, i * 25);
    });
    return;
  }
  // Piano (e fallback): bloco simultâneo
  const notes = midiNotes.map(m => Tone.Frequency(m, 'midi').toNote());
  s.triggerAttackRelease(notes, duration);
}

export async function playSequence(midiNotes: number[], gap = 0.6, duration: string | number = '0.5'): Promise<void> {
  const s = await getSampler();
  // Contrabaixo: só toca a fundamental, sem arpejo
  if (isBass()) {
    const root = Math.min(...midiNotes);
    s.triggerAttackRelease(Tone.Frequency(adjustForBass(root), 'midi').toNote(), duration);
    return;
  }
  midiNotes.forEach((midi, i) => {
    setTimeout(() => {
      s.triggerAttackRelease(Tone.Frequency(midi, 'midi').toNote(), duration);
    }, i * gap * 1000);
  });
}

export function isInstrumentLoaded(inst: Instrument = currentInstrument): boolean {
  const s = samplers.get(inst);
  return !!s && s.loaded;
}
