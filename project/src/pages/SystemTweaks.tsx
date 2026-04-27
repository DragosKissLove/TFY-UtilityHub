import { useEffect, useRef, useState } from 'react';
import { Languages, Gauge, Palette, ExternalLink, Beaker, ChevronDown, Download } from 'lucide-react';
import { notify } from '../lib/notify';
import { getLanguage, isLanguagePackInstalled, markLanguagePackInstalled, onLanguageChange, setLanguage as setGlobalLanguage, t, type TfyLanguage } from '../lib/i18n';

declare global {
  interface Window {
    chrome?: {
      webview?: {
        addEventListener: (type: string, listener: (event: any) => void) => void;
        removeEventListener: (type: string, listener: (event: any) => void) => void;
        postMessage: (message: any) => void;
      };
    };
  }
}

let cachedPremiumEnabled: boolean | null = null;
type DiscordState = { roles?: string[]; tier?: string; Tier?: string };

const languageKeyMap: Record<TfyLanguage, 'english' | 'romanian' | 'german' | 'spanish' | 'french'> = {
  en: 'english',
  ro: 'romanian',
  de: 'german',
  es: 'spanish',
  fr: 'french',
};

export function SystemTweaks() {
  const initialPremium = window.__tfyAccess?.premium ?? cachedPremiumEnabled ?? false;
  const [premiumEnabled, setPremiumEnabled] = useState(initialPremium);
  const [discordState, setDiscordState] = useState<DiscordState>({});
  const [language, setLanguage] = useState<TfyLanguage>(() => getLanguage());
  const [languageInstalling, setLanguageInstalling] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const [lowEndMode, setLowEndMode] = useState(() => {
    try {
      return localStorage.getItem('tfy.setting.lowEndMode') === '1';
    } catch {
      return false;
    }
  });
  const [themeMode, setThemeMode] = useState(() => {
    try {
      const raw = localStorage.getItem('tfy.setting.theme') || 'jade';
      return ['jade', 'midnight', 'slate', 'sunset', 'red', 'pink'].includes(raw) ? raw : 'jade';
    } catch {
      return 'jade';
    }
  });

  const downloadLanguagePack = async (value: TfyLanguage) => {
    if (isLanguagePackInstalled(value)) return;
    setLanguageInstalling(true);
    for (const step of [10, 25, 45, 65, 82, 100]) {
      notify({
        title: `Language Pack ${step}%`,
        message: `${t(value, `lang.${languageKeyMap[value]}`)} ${t(value, step < 100 ? 'settings.languageDownloading' : 'settings.languageReady')}`,
        kind: step < 100 ? 'info' : 'success',
        duration: 900,
      });
      await new Promise((resolve) => setTimeout(resolve, 280));
    }
    markLanguagePackInstalled(value);
    setLanguageInstalling(false);
  };

  const handleLanguageChange = async (value: TfyLanguage) => {
    setLanguage(value);
    await downloadLanguagePack(value);
    setGlobalLanguage(value);
    notify({ title: t(value, 'settings.languageApplied'), message: `${t(value, `lang.${languageKeyMap[value]}`)} ${t(value, 'settings.languageActive')}`, kind: 'success', duration: 1800 });
  };

  const handleLowEndMode = () => {
    setLowEndMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('tfy.setting.lowEndMode', next ? '1' : '0');
      } catch {
      }
      notify({
        title: next ? t(language, 'settings.lowEndOn') : t(language, 'settings.lowEndOff'),
        message: next ? t(language, 'settings.lowEndOnDesc') : t(language, 'settings.lowEndOffDesc'),
        kind: 'info',
        duration: 2800,
      });
      return next;
    });
  };

  const handleThemeChange = (nextTheme: string) => {
    setThemeMode(nextTheme);
    try {
      localStorage.setItem('tfy.setting.theme', nextTheme);
    } catch {
    }
    notify({ title: t(language, 'settings.themeUpdated'), message: `${t(language, `settings.theme.${nextTheme}`)} ${t(language, 'settings.themeApplied')}`, kind: 'success', duration: 2200 });
  };

  const openTestingLab = () => {
    window.dispatchEvent(new CustomEvent('tfy-nav', { detail: 'testing' }));
  };

  const checkForUpdates = () => {
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage('update-check');
      notify({ title: t(language, 'settings.checkUpdates'), message: t(language, 'settings.checkUpdatesReady'), kind: 'info', duration: 2200 });
    }
  };

  const roles = Array.isArray(discordState.roles) ? discordState.roles : [];
  const tierRaw = (discordState.tier || discordState.Tier || '').toLowerCase();
  const canAccessTesting =
    roles.includes('1324496746574905347') ||
    roles.includes('1469669066024157234') ||
    tierRaw === 'developer' ||
    tierRaw.includes('tester') ||
    Boolean(window.__tfyAccess?.testing);

  useEffect(() => {
    document.documentElement.classList.toggle('tfy-low-end', lowEndMode);
  }, [lowEndMode]);

  useEffect(() => onLanguageChange(setLanguage), []);

  useEffect(() => {
    document.documentElement.setAttribute('data-tfy-theme', themeMode);
  }, [themeMode]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!languageMenuOpen) return;
      const root = languageMenuRef.current;
      if (!root) return;
      if (!root.contains(event.target as Node)) {
        setLanguageMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [languageMenuOpen]);

  useEffect(() => {
    const handleMessage = (event: any) => {
      let message = event.data;
      if (typeof message === 'string') {
        try { message = JSON.parse(message); } catch { return; }
      }
      if (message?.type === 'premium') {
        const enabled = Boolean(message?.data?.enabled);
        cachedPremiumEnabled = enabled;
        if (window.__tfyAccess) window.__tfyAccess.premium = enabled;
        setPremiumEnabled(enabled);
      }
      if (message?.type === 'discord') {
        setDiscordState(message?.data || {});
      }
    };
    if (window.chrome?.webview) {
      window.chrome.webview.addEventListener('message', handleMessage);
      window.chrome.webview.postMessage('premium-get');
      window.chrome.webview.postMessage('discord-get');
    }
    return () => {
      if (window.chrome?.webview) window.chrome.webview.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div className="tfy-themed-page tfy-page-system space-y-6">
      <div className="shrink-0">
        <p className="section-title">SETTINGS</p>
        <h1 className="text-3xl md:text-4xl font-display font-semibold text-white mt-3">{t(language, 'settings.header')}</h1>
        <p className="text-gray-400 mt-3">{t(language, 'settings.subtitle')}</p>
      </div>

      <div className="panel panel-outline p-0 overflow-hidden liquid-card tfy-diagonal-glow">
        <div className={`settings-row ${languageMenuOpen ? 'lang-open' : ''}`}>
          <div className="settings-row-left">
            <div className="settings-icon-wrap"><Languages size={18} /></div>
            <div>
              <h3 className="text-white font-semibold">{t(language, 'settings.lang')}</h3>
              <p className="text-sm text-gray-400">{t(language, 'settings.langDesc')}</p>
            </div>
          </div>
          <div className="settings-lang-menu" ref={languageMenuRef}>
            <button
              type="button"
              className="settings-select settings-select-custom"
              onClick={() => !languageInstalling && setLanguageMenuOpen((v) => !v)}
              disabled={languageInstalling}
            >
              <span>{t(language, `lang.${languageKeyMap[language]}`)}</span>
              <ChevronDown size={14} className={`settings-select-chevron ${languageMenuOpen ? 'open' : ''}`} />
            </button>
            <div className={`settings-lang-dropdown ${languageMenuOpen ? 'open' : ''}`}>
              {(['en', 'ro', 'de', 'es', 'fr'] as TfyLanguage[]).map((lng) => (
                <button
                  key={lng}
                  type="button"
                  className={`settings-lang-option ${language === lng ? 'active' : ''}`}
                  onClick={async () => {
                    setLanguageMenuOpen(false);
                    await handleLanguageChange(lng);
                  }}
                >
                  {t(language, `lang.${languageKeyMap[lng]}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-icon-wrap"><Gauge size={18} /></div>
            <div>
              <h3 className="text-white font-semibold">{t(language, 'settings.lowEnd')}</h3>
              <p className="text-sm text-gray-400">{t(language, 'settings.lowEndDesc')}</p>
            </div>
          </div>
          <button onClick={handleLowEndMode} className={`toggle flex-shrink-0 ${lowEndMode ? 'on' : ''}`}>
            <div className="toggle-thumb"></div>
          </button>
        </div>

        <div className="settings-row border-b-0">
          <div className="settings-row-left">
            <div className="settings-icon-wrap"><Palette size={18} /></div>
            <div>
              <h3 className="text-white font-semibold">{t(language, 'settings.themes')}</h3>
              <p className="text-sm text-gray-400">{t(language, 'settings.themesDesc')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {['jade', 'midnight', 'slate', 'sunset', 'red', 'pink'].map((theme) => (
              <button
                key={theme}
                className={`btn-ghost text-xs ${themeMode === theme ? 'border-accent/60 text-white' : ''}`}
                onClick={() => handleThemeChange(theme)}
              >
                {t(language, `settings.theme.${theme}`)}
              </button>
            ))}
          </div>
        </div>

        {canAccessTesting && (
          <div className="settings-row border-b-0">
            <div className="settings-row-left">
              <div className="settings-icon-wrap"><Beaker size={18} /></div>
              <div>
                <h3 className="text-white font-semibold">{t(language, 'settings.testing')}</h3>
                <p className="text-sm text-gray-400">{t(language, 'settings.testingDesc')}</p>
              </div>
            </div>
            <button className="btn-ghost" onClick={openTestingLab}>{t(language, 'settings.openLab')}</button>
          </div>
        )}

        <div className="settings-row settings-row-discord border-b-0">
          <div className="settings-row-left">
            <div className="settings-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 127.14 96.36" fill="currentColor">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.36-24.44-5.42-48.18-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-semibold">Discord</h3>
              <p className="text-sm text-gray-400">{t(language, 'discord.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-ghost inline-flex items-center gap-2"
              onClick={() => window.open('https://discord.gg/PHsCwnaFYg', '_blank')}
            >
              <ExternalLink size={14} />
              {t(language, 'discord.join')}
            </button>
            <button
              className="btn-ghost settings-logout-btn"
              onClick={() => {
                if (window.chrome?.webview) {
                  window.chrome.webview.postMessage('discord-logout');
                  notify({ title: t(language, 'discord.title'), message: t(language, 'discord.loggedOut'), kind: 'info', duration: 2000 });
                }
              }}
            >
              {t(language, 'discord.logout')}
            </button>
          </div>
        </div>

        <div className="settings-row border-b-0">
          <div className="settings-row-left">
            <div className="settings-icon-wrap"><Download size={18} /></div>
            <div>
              <h3 className="text-white font-semibold">{t(language, 'settings.checkUpdates')}</h3>
              <p className="text-sm text-gray-400">{t(language, 'settings.checkUpdatesDesc')}</p>
            </div>
          </div>
          <button className="btn-ghost" onClick={checkForUpdates}>{t(language, 'settings.checkUpdatesAction')}</button>
        </div>
      </div>

      <div className="hidden">{String(premiumEnabled)}</div>
    </div >
  );
}
