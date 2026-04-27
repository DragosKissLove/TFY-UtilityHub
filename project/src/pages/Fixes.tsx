import { useEffect, useMemo, useState } from 'react';
import { Search, Wrench } from 'lucide-react';
import { notify } from '../lib/notify';
import { getLanguage, onLanguageChange, t, type TfyLanguage } from '../lib/i18n';

const fixes = [
  { id: 'audio_mic', titleKey: 'fixes.audio_mic.title', descKey: 'fixes.audio_mic.desc' },
  { id: 'bluetooth', titleKey: 'fixes.bluetooth.title', descKey: 'fixes.bluetooth.desc' },
  { id: 'clipboard', titleKey: 'fixes.clipboard.title', descKey: 'fixes.clipboard.desc' },
  { id: 'diagnostics', titleKey: 'fixes.diagnostics.title', descKey: 'fixes.diagnostics.desc' },
  { id: 'disk_shrinking', titleKey: 'fixes.disk_shrinking.title', descKey: 'fixes.disk_shrinking.desc' },
  { id: 'fax_printing', titleKey: 'fixes.fax_printing.title', descKey: 'fixes.fax_printing.desc' },
  { id: 'gta', titleKey: 'fixes.gta.title', descKey: 'fixes.gta.desc' },
  { id: 'edge', titleKey: 'fixes.edge.title', descKey: 'fixes.edge.desc' },
  { id: 'store_apps', titleKey: 'fixes.store_apps.title', descKey: 'fixes.store_apps.desc' },
  { id: 'nvidia_highlights', titleKey: 'fixes.nvidia_highlights.title', descKey: 'fixes.nvidia_highlights.desc' },
  { id: 'nvidia_control_panel', titleKey: 'fixes.nvidia_control_panel.title', descKey: 'fixes.nvidia_control_panel.desc' },
  { id: 'restore_points', titleKey: 'fixes.restore_points.title', descKey: 'fixes.restore_points.desc' },
  { id: 'search_indexing', titleKey: 'fixes.search_indexing.title', descKey: 'fixes.search_indexing.desc' },
  { id: 'snipping_tool', titleKey: 'fixes.snipping_tool.title', descKey: 'fixes.snipping_tool.desc' },
  { id: 'valorant', titleKey: 'fixes.valorant.title', descKey: 'fixes.valorant.desc' },
  { id: 'webcam', titleKey: 'fixes.webcam.title', descKey: 'fixes.webcam.desc' },
  { id: 'wifi', titleKey: 'fixes.wifi.title', descKey: 'fixes.wifi.desc' },
  { id: 'windows_security', titleKey: 'fixes.windows_security.title', descKey: 'fixes.windows_security.desc' },
  { id: 'windows_update', titleKey: 'fixes.windows_update.title', descKey: 'fixes.windows_update.desc' },
  { id: 'xbox_gaming', titleKey: 'fixes.xbox_gaming.title', descKey: 'fixes.xbox_gaming.desc' },
];

export function Fixes() {
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [language, setLanguage] = useState<TfyLanguage>(() => getLanguage());

  useEffect(() => onLanguageChange(setLanguage), []);

  useEffect(() => {
    const onMessage = (event: any) => {
      let message = event.data;
      if (typeof message === 'string') {
        try {
          message = JSON.parse(message);
        } catch {
          return;
        }
      }

      if (message?.type === 'fixes' && message?.action === 'result') {
        const id = message?.data?.id as string;
        const ok = Boolean(message?.data?.ok);
        const msg = message?.data?.message || t(language, ok ? 'fixes.notifyApplied' : 'fixes.notifyFailed');
        setBusyId((current) => (current === id ? null : current));
        notify({
          title: t(language, ok ? 'fixes.notifyCompleted' : 'fixes.notifyFailedTitle'),
          message: msg,
          kind: ok ? 'success' : 'error',
          duration: ok ? 3600 : 5200,
        });
      }
    };

    if (window.chrome?.webview) {
      window.chrome.webview.addEventListener('message', onMessage);
    }

    return () => {
      if (window.chrome?.webview) {
        window.chrome.webview.removeEventListener('message', onMessage);
      }
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return fixes.filter((f) => t(language, f.titleKey).toLowerCase().includes(q));
  }, [query, language]);

  const runFix = (id: string) => {
    setBusyId(id);
    notify({ title: t(language, 'fixes.notifyRunning'), message: t(language, 'fixes.notifyRunningDesc'), kind: 'info', duration: 2200 });
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(`fix-run|${id}`);
    }
  };

  return (
    <div className="tfy-themed-page tfy-page-fixes h-full overflow-hidden flex flex-col gap-5">
      <div className="shrink-0 space-y-4">
        <div>
          <p className="section-title">FIXES</p>
          <h1 className="text-3xl md:text-4xl font-display font-semibold text-white mt-3">{t(language, 'nav.fixes')}</h1>
          <p className="text-gray-400 mt-3">{t(language, 'fixes.subtitle')}</p>
        </div>
        <div className="fix-search">
          <Search size={16} className="text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(language, 'downloads.search')}
            className="bg-transparent text-sm text-white outline-none w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto no-scrollbar pr-1">
        {filtered.map((item) => (
          <div key={item.id} className="fix-card tfy-diagonal-glow">
            <div>
              <div className="text-white font-semibold">{t(language, item.titleKey)}</div>
              <div className="text-xs text-gray-500 mt-2">{t(language, item.descKey)}</div>
            </div>
            <button
              className="fix-action view-details-btn"
              onClick={() => runFix(item.id)}
              disabled={busyId === item.id}
            >
              <Wrench size={14} />
              {busyId === item.id ? t(language, 'fixes.running') : t(language, 'fixes.fixNow')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
