import { useEffect, useState, useCallback } from 'react';
import { Plug, CheckCircle2, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  isWebMidiSupported,
  listMidiInputs,
  connectMidiInput,
  disconnectMidi,
  onNoteOn,
} from '../utils/webMidi';
import type { MidiDevice } from '../types';

interface Props {
  onConnectionChange: (connected: boolean) => void;
}

export function MidiConnection({ onConnectionChange }: Props) {
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [lastNoteName, setLastNoteName] = useState<string>('');

  const refresh = useCallback(async () => {
    if (!isWebMidiSupported()) {
      setSupportError('Web MIDI API não suportada. Use Chrome ou Edge.');
      return;
    }
    try {
      const list = await listMidiInputs();
      setDevices(list);
      if (list.length > 0 && !selectedId) {
        // Auto selecionar Roland/XPS se encontrar
        const roland = list.find(d => /xps|roland/i.test(d.name));
        setSelectedId(roland?.id || list[0].id);
      }
    } catch (e: any) {
      setSupportError(e?.message || 'Erro ao listar dispositivos');
    }
  }, [selectedId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Indicador visual da última nota recebida
  useEffect(() => {
    if (!isConnected) return;
    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const unsub = onNoteOn((note) => {
      const octave = Math.floor(note / 12) - 1;
      setLastNoteName(`${NOTE_NAMES[note % 12]}${octave}`);
    });
    return () => { unsub(); };
  }, [isConnected]);

  const handleConnect = async () => {
    if (!selectedId) return;
    setIsLoading(true);
    try {
      await connectMidiInput(selectedId);
      setIsConnected(true);
      onConnectionChange(true);
    } catch (e: any) {
      alert(e?.message || 'Erro ao conectar');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    disconnectMidi();
    setIsConnected(false);
    setLastNoteName('');
    onConnectionChange(false);
  };

  if (supportError) {
    return (
      <div className="flex items-center gap-2 text-amber-600 text-sm">
        <AlertTriangle className="w-5 h-5" />
        <span>{supportError}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {isConnected ? (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium">Conectado</span>
          {lastNoteName && <span className="text-xs text-gray-500">{lastNoteName}</span>}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-gray-500">
          <XCircle className="w-5 h-5" />
          <span className="text-sm">Sem MIDI</span>
        </div>
      )}

      {!isConnected ? (
        <div className="flex items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 max-w-[220px]"
          >
            <option value="">Selecione...</option>
            {devices.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <button
            onClick={refresh}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Atualizar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleConnect}
            disabled={!selectedId || isLoading}
            className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <Plug className="w-4 h-4" />
            {isLoading ? '...' : 'Conectar'}
          </button>
        </div>
      ) : (
        <button onClick={handleDisconnect} className="btn-secondary text-sm">
          Desconectar
        </button>
      )}
    </div>
  );
}
