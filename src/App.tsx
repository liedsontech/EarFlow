import { useState, useEffect } from 'react';
import { Music } from 'lucide-react';
import { MidiConnection } from './components/MidiConnection';
import { NoteTrainer } from './components/NoteTrainer';
import { InstrumentSelector } from './components/InstrumentSelector';
import { AdBanner, isAdSenseConfigured } from './components/AdBanner';
import { setCurrentInstrument } from './utils/instrumentSampler';
import { loadPreferences, savePreferences } from './utils/storage';
import type { Instrument } from './types';

function App() {
  const [isMidiConnected, setIsMidiConnected] = useState(false);
  const [instrument, setInstrument] = useState<Instrument>(() => {
    const prefs = loadPreferences();
    return (prefs.instrument as Instrument) || 'piano';
  });

  useEffect(() => {
    setCurrentInstrument(instrument);
    savePreferences({ instrument });
  }, [instrument]);

  const adsEnabled = isAdSenseConfigured();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between max-w-6xl mx-auto gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <Music className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">EarFlow</h1>
              <p className="text-xs text-gray-500">Afine seu ouvido, liberte sua música</p>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <InstrumentSelector value={instrument} onChange={setInstrument} />
            <MidiConnection onConnectionChange={setIsMidiConnected} />
          </div>
        </div>
      </header>

      {/* Banner topo (só renderiza quando AdSense está ativo) */}
      {adsEnabled && (
        <div className="max-w-6xl mx-auto w-full px-4 pt-3">
          <AdBanner slot="1234567890" format="horizontal" className="w-full" />
        </div>
      )}

      {/* Layout central — sem skyscrapers laterais quando AdSense não está configurado */}
      <div className="flex-1 w-full flex justify-center gap-4 px-4 py-4">
        {adsEnabled && (
          <aside className="hidden xl:block flex-shrink-0 w-[160px]">
            <div className="sticky top-20">
              <AdBanner slot="1111111111" format="vertical" className="w-[160px] h-[600px]" />
            </div>
          </aside>
        )}

        <main className="flex-1 max-w-5xl min-w-0">
          <NoteTrainer isMidiConnected={isMidiConnected} />
        </main>

        {adsEnabled && (
          <aside className="hidden xl:block flex-shrink-0 w-[160px]">
            <div className="sticky top-20">
              <AdBanner slot="2222222222" format="vertical" className="w-[160px] h-[600px]" />
            </div>
          </aside>
        )}
      </div>

      {/* Banner rodapé */}
      {adsEnabled && (
        <div className="max-w-6xl mx-auto w-full px-4 pb-3">
          <AdBanner slot="0987654321" format="horizontal" className="w-full" />
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-4 py-3 text-center text-xs text-gray-500">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-3 flex-wrap">
          <span>🎹 EarFlow - Treine seu ouvido musical grátis</span>
          <span className="text-gray-300">|</span>
          <span>Chrome/Edge com teclado MIDI</span>
          <span className="text-gray-300">|</span>
          <span>
            Feito por <strong className="text-gray-700">Liedson Severiano</strong>{' '}
            <a
              href="mailto:liedsonalves067@gmail.com"
              className="text-primary-600 hover:underline"
            >
              liedsonalves067@gmail.com
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
