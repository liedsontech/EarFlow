import { Music, Music2, Music3, Music4 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Instrument } from '../types';

interface Props {
  value: Instrument;
  onChange: (inst: Instrument) => void;
}

const OPTIONS: { value: Instrument; icon: any; color: string; emoji: string; tKey: string }[] = [
  { value: 'piano', icon: Music, color: 'text-blue-600', emoji: '🎹', tKey: 'instrument.piano' },
  { value: 'bass-electric', icon: Music2, color: 'text-purple-600', emoji: '🎸', tKey: 'instrument.bass' },
  { value: 'guitar-acoustic', icon: Music3, color: 'text-amber-700', emoji: '🪕', tKey: 'instrument.guitar_acoustic' },
  { value: 'guitar-electric', icon: Music4, color: 'text-red-600', emoji: '🎸', tKey: 'instrument.guitar_electric' },
];

export function InstrumentSelector({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-xs text-gray-500">{t('instrument.label')}</span>
      <div className="inline-flex bg-gray-100 rounded-lg p-1 gap-1 flex-wrap justify-center">
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
              title={t(opt.tKey)}
            >
              <span>{opt.emoji}</span>
              {t(opt.tKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
