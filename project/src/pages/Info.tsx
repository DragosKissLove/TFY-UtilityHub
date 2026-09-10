import { useEffect, useMemo, useState } from 'react';
import { Info as InfoIcon, ExternalLink, Shield, Cpu, Headphones, Layers, Sparkles } from 'lucide-react';
import { UpdateModal } from '../components/UpdateModal';
import { getLanguage, onLanguageChange, t, type TfyLanguage } from '../lib/i18n';

interface UpdateData {
  currentVersion?: string;
  latestVersion?: string;
  sizeMb?: number | null;
  notes?: string[] | null;
  mandatory?: boolean;
}

export function Info() {
  const [appVersion, setAppVersion] = useState('v6.3.2');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'none' | 'error'>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateData | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [language, setLanguage] = useState<TfyLanguage>(() => getLanguage());

  const sendHostMessage = (message: string) => {
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(message);
    }
  };

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = (event as MessageEvent).data as any;
      if (!data || data.type !== 'update') return;

      switch (data.action) {
        case 'version':
          if (data.currentVersion) setAppVersion(data.currentVersion);
          break;
        case 'checking':
          setUpdateStatus('checking');
          break;
        case 'none':
          setUpdateStatus('none');
          setUpdateInfo(null);
          break;
        case 'error':
          setUpdateStatus('error');
          break;
        case 'available':
          setUpdateStatus('available');
          setUpdateInfo(data.data || null);
          setUpdateOpen(true);
          break;
        default:
          break;
      }
    };

    if (window.chrome?.webview) {
      window.chrome.webview.addEventListener('message', handler as any);
      return () => window.chrome?.webview?.removeEventListener('message', handler as any);
    }

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => onLanguageChange(setLanguage), []);

  const versionLabel = useMemo(() => {
    if (!appVersion) return 'v6.3.2';
    return appVersion.startsWith('v') ? appVersion : `v${appVersion}`;
  }, [appVersion]);


  return (
    <div className="tfy-themed-page tfy-page-info space-y-4 max-h-[calc(100vh-64px)] overflow-hidden about-page">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="section-title">{t(language, 'nav.about').toUpperCase()}</p>
          <h1 className="text-3xl md:text-4xl font-display font-semibold text-white mt-2 flex items-center gap-3">
            <InfoIcon size={24} className="text-accent" />
            {t(language, 'about.title')}
          </h1>
          <p className="text-gray-400 mt-2 max-w-2xl">{t(language, 'about.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="btn-ghost border-accent/60 text-accent"
            onClick={() => sendHostMessage('update-check')}
            disabled={updateStatus === 'checking'}
          >
            {updateStatus === 'checking' ? t(language, 'about.checking') : t(language, 'about.checkUpdates')}
          </button>
        </div>
      </div>

      <div className="panel panel-outline rounded-2xl p-4 tfy-diagonal-glow about-wow-shell">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">{t(language, 'about.title')}</h2>
            <p className="text-gray-400 mt-2 text-sm">{t(language, 'about.subtitleShort')}</p>
          </div>
          <span className="chip">{t(language, 'about.version')} {versionLabel}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <div className="panel panel-outline rounded-2xl p-4 tfy-diagonal-glow">
            <h3 className="text-white font-semibold mb-3">{t(language, 'about.whatTitle')}</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>- {t(language, 'about.what1')}</li>
              <li>- {t(language, 'about.what2')}</li>
              <li>- {t(language, 'about.what3')}</li>
              <li>- {t(language, 'about.what4')}</li>
            </ul>
          </div>
          <div className="panel panel-outline rounded-2xl p-4 tfy-diagonal-glow">
            <h3 className="text-white font-semibold mb-3">{t(language, 'about.whyTitle')}</h3>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-center gap-2"><Sparkles size={14} className="text-accent" /> {t(language, 'about.why1')}</div>
              <div className="flex items-center gap-2"><Layers size={14} className="text-accent" /> {t(language, 'about.why2')}</div>
              <div className="flex items-center gap-2"><Shield size={14} className="text-accent" /> {t(language, 'about.why3')}</div>
              <div className="flex items-center gap-2"><Headphones size={14} className="text-accent" /> {t(language, 'about.why4')}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
          <div className="panel panel-outline rounded-2xl p-4 tfy-diagonal-glow">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl metric-ring text-accent">
                <Cpu size={18} />
              </div>
              <div>
                <div className="text-accent font-semibold">{t(language, 'about.performance')}</div>
                <div className="text-gray-400 text-xs">{t(language, 'about.performanceSub')}</div>
              </div>
            </div>
          </div>
          <div className="panel panel-outline rounded-2xl p-4 tfy-diagonal-glow">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl metric-ring text-accent">
                <Shield size={18} />
              </div>
              <div>
                <div className="text-accent font-semibold">{t(language, 'about.security')}</div>
                <div className="text-gray-400 text-xs">{t(language, 'about.securitySub')}</div>
              </div>
            </div>
          </div>
          <div className="panel panel-outline rounded-2xl p-4 tfy-diagonal-glow">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl metric-ring text-accent">
                <Headphones size={18} />
              </div>
              <div>
                <div className="text-accent font-semibold">{t(language, 'about.support')}</div>
                <div className="text-gray-400 text-xs">{t(language, 'about.supportSub')}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 panel panel-outline rounded-2xl p-4 tfy-diagonal-glow">
          <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
            <Sparkles size={16} className="text-accent" /> Special Thanks & Shoutout
          </h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            Huge shoutout to <a href="https://graphicx.store/" target="_blank" rel="noreferrer" className="text-accent hover:underline font-medium">GraphicX.store</a> and its creator for the inspiration behind our upcoming Plugin system! GraphicX is an incredible hub for plugins, VFX packs, and digital creation resources for Windows and MacOS. Check them out!
          </p>
        </div>

        <div className="pt-4 mt-4 border-t border-white/5">
          <div className="text-gray-400 text-sm">{t(language, 'about.needHelp')}</div>
          <a
            href="https://discord.gg/PHsCwnaFYg"
            className="text-accent hover:text-accent transition-colors flex items-center gap-2 font-semibold mt-2"
            target="_blank"
            rel="noreferrer"
          >
            {t(language, 'about.joinDiscord')}
            <ExternalLink size={16} />
          </a>
          <div className="text-xs text-gray-500 mt-2">{t(language, 'about.copyright')}</div>
        </div>
      </div>

      <UpdateModal
        isOpen={updateOpen}
        onClose={() => setUpdateOpen(false)}
        updateInfo={updateInfo}
        language={language}
      />
    </div>
  );
}
