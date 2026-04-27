import { useEffect, useState } from 'react';
import { Beaker, Bell, Download, Lock } from 'lucide-react';
import { UpdateModal } from '../components/UpdateModal';
import { notify } from '../lib/notify';
import { getLanguage, onLanguageChange, t, type TfyLanguage } from '../lib/i18n';

let cachedTestingEnabled: boolean | null = null;

export function Testing() {
  const [showUpdatePreview, setShowUpdatePreview] = useState(false);
  const initialTesting = window.__tfyAccess?.testing ?? cachedTestingEnabled ?? false;
  const [testingEnabled, setTestingEnabled] = useState(initialTesting);
  const [premiumEnabled, setPremiumEnabled] = useState<boolean>(window.__tfyAccess?.premium ?? false);
  const [language, setLanguage] = useState<TfyLanguage>(() => getLanguage());

  useEffect(() => {
    const handler = (event: any) => {
      let message = event.data;
      if (typeof message === 'string') {
        try {
          message = JSON.parse(message);
        } catch {
          return;
        }
      }
      if (message?.type === 'testing') {
        const enabled = Boolean(message?.data?.enabled);
        cachedTestingEnabled = enabled;
        if (window.__tfyAccess) {
          window.__tfyAccess.testing = enabled;
        }
        setTestingEnabled(enabled);
      }
      if (message?.type === 'premium') {
        const enabled = Boolean(message?.data?.enabled);
        if (window.__tfyAccess) {
          window.__tfyAccess.premium = enabled;
        }
        setPremiumEnabled(enabled);
      }
    };

    if (window.chrome?.webview) {
      window.chrome.webview.addEventListener('message', handler);
      if (cachedTestingEnabled === null && window.__tfyAccess?.testing === null) {
        window.chrome.webview.postMessage('testing-get');
      }
      window.chrome.webview.postMessage('premium-get');
    }

    return () => {
      if (window.chrome?.webview) {
        window.chrome.webview.removeEventListener('message', handler);
      }
    };
  }, []);
  useEffect(() => onLanguageChange(setLanguage), []);

  return (
    <div className="tfy-themed-page tfy-page-testing h-full overflow-y-auto no-scrollbar pr-1 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="section-title">{t(language, 'settings.testing').toUpperCase()}</p>
          <h1 className="text-3xl md:text-4xl font-display font-semibold text-white mt-2 flex items-center gap-3">
            <Beaker size={24} className="text-accent" />
            {t(language, 'settings.testing')}
          </h1>
          <p className="text-gray-400 mt-2 max-w-2xl">
            {t(language, 'testing.subtitle')}
          </p>
        </div>
        <button
          className="btn-ghost"
          onClick={() => window.chrome?.webview?.postMessage('testing-get')}
        >
          {t(language, 'testing.refreshAccess')}
        </button>
      </div>

      {!testingEnabled && (
        <div className="panel panel-outline rounded-2xl p-4 flex items-center gap-3">
          <Lock size={18} className="text-gray-500" />
          <div className="text-gray-400 text-sm">
            {t(language, 'testing.locked')}
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${testingEnabled ? '' : 'opacity-40 pointer-events-none'}`}>
        <div className="panel panel-outline rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl metric-ring text-accent">
              <Bell size={18} />
            </div>
            <div>
              <div className="text-white font-semibold">{t(language, 'testing.updatePreviewTitle')}</div>
              <div className="text-gray-400 text-xs">{t(language, 'testing.updatePreviewSub')}</div>
            </div>
          </div>
          <button className="btn-ghost border-accent/60 text-accent mt-4" onClick={() => setShowUpdatePreview(true)}>
            {t(language, 'testing.showPreview')}
          </button>
        </div>

        <div className="panel panel-outline rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl metric-ring text-accent">
              <Bell size={18} />
            </div>
            <div>
              <div className="text-white font-semibold">{t(language, 'testing.notificationTestTitle')}</div>
              <div className="text-gray-400 text-xs">{t(language, 'testing.notificationTestSub')}</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-ghost text-xs" onClick={() => notify({ title: t(language, 'notify.successTitle'), message: t(language, 'notify.successBody'), kind: 'success', duration: 2600 })}>{t(language, 'notify.success')}</button>
            <button className="btn-ghost text-xs" onClick={() => notify({ title: t(language, 'notify.infoTitle'), message: t(language, 'notify.infoBody'), kind: 'info', duration: 2600 })}>{t(language, 'notify.info')}</button>
            <button className="btn-ghost text-xs" onClick={() => notify({ title: t(language, 'notify.warningTitle'), message: t(language, 'notify.warningBody'), kind: 'warning', duration: 3200 })}>{t(language, 'notify.warning')}</button>
            <button className="btn-ghost text-xs" onClick={() => notify({ title: t(language, 'notify.errorTitle'), message: t(language, 'notify.errorBody'), kind: 'error', duration: 3800 })}>{t(language, 'notify.error')}</button>
          </div>
        </div>

        <div className="panel panel-outline rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl metric-ring text-accent">
              <Download size={18} />
            </div>
            <div>
              <div className="text-white font-semibold">{t(language, 'testing.updaterTitle')}</div>
              <div className="text-gray-400 text-xs">{t(language, 'testing.updaterSub')}</div>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-400">
            {t(language, 'testing.updaterBody')}
          </div>
        </div>

        {/* Welcome Tour Trigger */}
        <div className="panel panel-outline rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl metric-ring text-accent">
              <Beaker size={18} />
            </div>
            <div>
              <div className="text-white font-semibold">Welcome Tour Preview</div>
              <div className="text-gray-400 text-xs">Test the first-time setup sequence</div>
            </div>
          </div>
          <button className="btn-ghost border-accent/60 text-accent mt-4" onClick={() => window.dispatchEvent(new CustomEvent('tfy-tour-replay'))}>
            Start Tour
          </button>
        </div>
      </div>

      <div className={`panel panel-outline p-6 ${testingEnabled ? '' : 'opacity-40 pointer-events-none'}`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="section-title">{t(language, 'testing.premiumModules')}</p>
            <h2 className="text-xl font-semibold text-white mt-2">{t(language, 'testing.eliteSuite')}</h2>
          </div>
          <button className="btn-ghost" onClick={() => window.chrome?.webview?.postMessage('premium-get')}>{t(language, 'testing.refreshAccess')}</button>
        </div>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { title: t(language, 'testing.module1Title'), desc: t(language, 'testing.module1Desc') },
            { title: t(language, 'testing.module2Title'), desc: t(language, 'testing.module2Desc') },
            { title: t(language, 'testing.module3Title'), desc: t(language, 'testing.module3Desc') },
            { title: t(language, 'testing.module4Title'), desc: t(language, 'testing.module4Desc') },
          ].map((item) => (
            <div key={item.title} className={`panel panel-outline p-4 ${premiumEnabled ? '' : 'opacity-50'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-semibold">{item.title}</h3>
                  <p className="text-gray-400 text-sm mt-1">{item.desc}</p>
                </div>
                {!premiumEnabled && <Lock size={16} className="text-gray-500" />}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button className="btn-primary text-black" disabled={!premiumEnabled} style={!premiumEnabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>{t(language, 'testing.apply')}</button>
                <button className="btn-ghost" disabled={!premiumEnabled} style={!premiumEnabled ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}>{t(language, 'testing.details')}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <UpdateModal
        isOpen={showUpdatePreview}
        onClose={() => setShowUpdatePreview(false)}
        updateInfo={{
          latestVersion: 'v5.1.0',
          currentVersion: 'v5.0.0',
          sizeMb: 48.0,
          notes: [
            t(language, 'testing.whatsNew1'),
            t(language, 'testing.whatsNew2'),
            t(language, 'testing.whatsNew3')
          ]
        }}
        language={language}
      />
    </div>
  );
}


