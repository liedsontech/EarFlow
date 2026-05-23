// ============================================================================
// Web MIDI API wrapper - substitui o backend Tauri/Rust
// ============================================================================
import type { MidiDevice } from '../types';

type NoteCallback = (note: number, velocity: number) => void;
type CcCallback = (controller: number, value: number) => void;

type Subscribers = {
  onNoteOn: Set<NoteCallback>;
  onNoteOff: Set<NoteCallback>;
  onCc: Set<CcCallback>;
};

const subs: Subscribers = {
  onNoteOn: new Set(),
  onNoteOff: new Set(),
  onCc: new Set(),
};

let midiAccess: MIDIAccess | null = null;
let activeInput: MIDIInput | null = null;

export function isWebMidiSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.requestMIDIAccess;
}

export async function requestMidiAccess(): Promise<MIDIAccess> {
  if (!isWebMidiSupported()) {
    throw new Error('Web MIDI API não é suportada neste navegador. Use Chrome ou Edge.');
  }
  if (midiAccess) return midiAccess;
  midiAccess = await navigator.requestMIDIAccess({ sysex: false });
  return midiAccess;
}

export async function listMidiInputs(): Promise<MidiDevice[]> {
  const access = await requestMidiAccess();
  const inputs: MidiDevice[] = [];
  access.inputs.forEach((input) => {
    inputs.push({
      id: input.id,
      name: input.name || 'Dispositivo MIDI',
      manufacturer: input.manufacturer || '',
    });
  });
  return inputs;
}

export async function connectMidiInput(deviceId: string): Promise<void> {
  const access = await requestMidiAccess();
  // Desconectar entrada anterior
  if (activeInput) {
    activeInput.onmidimessage = null;
    activeInput = null;
  }
  const input = access.inputs.get(deviceId);
  if (!input) throw new Error('Dispositivo MIDI não encontrado');

  input.onmidimessage = handleMidiMessage;
  activeInput = input;
}

export function disconnectMidi(): void {
  if (activeInput) {
    activeInput.onmidimessage = null;
    activeInput = null;
  }
}

export function getActiveInputName(): string | null {
  return activeInput?.name || null;
}

function handleMidiMessage(event: MIDIMessageEvent) {
  const data = event.data;
  if (!data || data.length < 2) return;
  const status = data[0] & 0xf0;
  const note = data[1];
  const velocity = data[2] || 0;

  if (status === 0x90 && velocity > 0) {
    subs.onNoteOn.forEach((cb) => cb(note, velocity));
  } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
    subs.onNoteOff.forEach((cb) => cb(note, velocity));
  } else if (status === 0xb0) {
    const controller = note;
    const value = velocity;
    subs.onCc.forEach((cb) => cb(controller, value));
  }
}

// Subscriptions retornam função de unsubscribe
export function onNoteOn(cb: NoteCallback): () => void {
  subs.onNoteOn.add(cb);
  return () => subs.onNoteOn.delete(cb);
}

export function onNoteOff(cb: NoteCallback): () => void {
  subs.onNoteOff.add(cb);
  return () => subs.onNoteOff.delete(cb);
}

export function onCc(cb: CcCallback): () => void {
  subs.onCc.add(cb);
  return () => subs.onCc.delete(cb);
}
