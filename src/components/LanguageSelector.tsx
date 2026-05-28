import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'pt-BR', label: 'PT-BR' },
  { code: 'en-US', label: 'EN' },
  { code: 'es-ES', label: 'ES' },
];

function normalizeLanguage(lang: string) {
  if (lang.startsWith('pt')) return 'pt-BR';
  if (lang.startsWith('es')) return 'es-ES';
  return 'en-US';
}

export function LanguageSelector() {
  const { i18n } = useTranslation();
  const current = normalizeLanguage(i18n.language);

  return (
    <select
      value={current}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      className="px-2 py-1 text-xs border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
    >
      {LANGUAGES.map(lang => (
        <option key={lang.code} value={lang.code}>{lang.label}</option>
      ))}
    </select>
  );
}
