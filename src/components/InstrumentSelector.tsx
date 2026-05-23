import { Music, Music2, Music3, Music4 } from 'lucide-react';
import type { Instrument } from '../types';

interface Props {
  value: Instrument;
  onChange: (inst: Instrument) => void;
}

const OPTIONS: { value: Instrument; label: string; icon: any; color: string; emoji: string }[] = [
  { value: 'piano', label: 'Piano', icon: Music, color: 'text-blue-600', emoji: '🎹' },
  { value: 'bass-electric', label: 'Baixo', icon: Music2, color: 'text-purple-600', emoji: '🎸' },
  { value: 'guitar-acoustic', label: 'Violão', icon: Music3, color: 'text-amber-700', emoji: '🪕' },
  { value: 'guitar-electric', label: 'Guitarra', icon: Music4, color: 'text-red-600', emoji: '🎸' },
];

export function InstrumentSelector({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500 mr-1">Som:</span>
      <div className="inline-flex bg-gray-100 rounded-lg p-1 gap-1 flex-wrap">
        {OPTIONS.map(opt => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                active
                  ? 'bg-white shadow-sm ' + opt.color
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title={opt.label}
            >
              <span>{opt.emoji}</span>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
