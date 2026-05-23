import { useEffect, useRef } from 'react';

interface Props {
  slot: string;            // ID do slot do AdSense
  format?: 'auto' | 'horizontal' | 'rectangle' | 'vertical';
  responsive?: boolean;
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

// 🔧 Substitua pelo seu Publisher ID do AdSense quando for aprovado
// Enquanto for o valor placeholder ('ca-pub-XXXXXXXXXXXXXXXX'), nenhum espaço
// publicitário será renderizado — a UI fica limpa.
const ADSENSE_CLIENT = 'ca-pub-XXXXXXXXXXXXXXXX';

export const isAdSenseConfigured = () => /^ca-pub-\d{10,}$/.test(ADSENSE_CLIENT);

export function AdBanner({ slot, format = 'auto', responsive = true, className = '' }: Props) {
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!isAdSenseConfigured()) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Em dev/local AdSense pode não carregar — ignorar
    }
  }, []);

  // AdSense não configurado ainda → não renderiza nada (sem placeholders)
  if (!isAdSenseConfigured()) return null;

  return (
    <ins
      ref={insRef}
      className={`adsbygoogle ${className}`}
      style={{ display: 'block' }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive ? 'true' : 'false'}
    />
  );
}
