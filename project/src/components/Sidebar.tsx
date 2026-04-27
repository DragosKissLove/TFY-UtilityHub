import { useEffect, useRef, useState } from 'react';
import { Home, Zap, Settings, Download, Trash2, Archive, Wrench, ChevronUp, ChevronDown, Beaker } from 'lucide-react';
import type { Page } from '../types';
import logo from '../assets/TFY-Logo.png';
import { getLanguage, onLanguageChange, t, type TfyLanguage } from '../lib/i18n';

type DiscordState = {
  connected: boolean;
  username?: string;
  Username?: string;
  avatarUrl?: string;
  AvatarUrl?: string;
  roles?: string[];
  tier?: string;
  Tier?: string;
};

type TestingState = {
  enabled: boolean;
};

declare global {
  interface Window {
    __tfyDiscordName?: string;
  }
}

interface SidebarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
}

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const [discord, setDiscord] = useState<DiscordState>({ connected: false });
  const [testing, setTesting] = useState<TestingState>({ enabled: window.__tfyAccess?.testing ?? false });
  const [discordMenuOpen, setDiscordMenuOpen] = useState(false);
  const [language, setLanguage] = useState<TfyLanguage>(() => getLanguage());
  const discordBoxRef = useRef<HTMLDivElement | null>(null);
  const navScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleMessage = (event: any) => {
      let message = event.data;
      if (typeof message === 'string') {
        try {
          message = JSON.parse(message);
        } catch {
          return;
        }
      }
      if (message?.type === 'discord') {
        const data = message.data || { connected: false };
        if (!data.connected && (data.username || data.Username || data.avatarUrl || data.AvatarUrl)) {
          data.connected = true;
        }
        if (!data.avatarUrl && data.AvatarUrl) {
          data.avatarUrl = data.AvatarUrl;
        }
        const name = (data.username || data.Username || '').trim();
        const id = data.UserId || data.userId || data.id || data.Id;
        const avatarUrl = data.avatarUrl || data.AvatarUrl;
        if (data.connected && name) {
          window.__tfyDiscordName = name;
          try {
            localStorage.setItem('tfy.discord.name', name);
            if (id) localStorage.setItem('tfy.discord.id', id);
            if (avatarUrl) localStorage.setItem('tfy.discord.avatar', avatarUrl);
          } catch {
          }
        } else if (!data.connected) {
          window.__tfyDiscordName = '';
          try {
            localStorage.removeItem('tfy.discord.id');
            localStorage.removeItem('tfy.discord.name');
            localStorage.removeItem('tfy.discord.avatar');
          } catch {
          }
        }
        setDiscord(data);
      }
      if (message?.type === 'testing') {
        const enabled = Boolean(message?.data?.enabled);
        if (window.__tfyAccess) {
          window.__tfyAccess.testing = enabled;
        }
        setTesting({ enabled });
      }
    };

    if (window.chrome?.webview) {
      window.chrome.webview.addEventListener('message', handleMessage);
      window.chrome.webview.postMessage('discord-get');
      if (window.__tfyAccess?.testing === null || window.__tfyAccess?.testing === undefined) {
        window.chrome.webview.postMessage('testing-get');
      }
    }

    return () => {
      if (window.chrome?.webview) {
        window.chrome.webview.removeEventListener('message', handleMessage);
      }
    };
  }, []);

  const roles = Array.isArray(discord.roles) ? discord.roles : [];
  const tierRaw = (discord.tier || discord.Tier || '').toLowerCase();
  const hasTesterOrDeveloper =
    roles.includes('1324496746574905347') ||
    roles.includes('1469669066024157234') ||
    tierRaw === 'developer' ||
    tierRaw.includes('tester');
  const canAccessTesting = testing.enabled || hasTesterOrDeveloper;

  useEffect(() => {
    if (!canAccessTesting && currentPage === 'testing') {
      onPageChange('home');
    }
  }, [canAccessTesting, currentPage, onPageChange]);

  useEffect(() => onLanguageChange(setLanguage), []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!discordMenuOpen) return;
      const root = discordBoxRef.current;
      if (!root) return;
      const target = event.target as Node;
      if (!root.contains(target)) {
        setDiscordMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [discordMenuOpen]);

  const handleDiscordConnect = () => {
    if (window.chrome?.webview) {
      const theme = localStorage.getItem('tfy.setting.theme') || 'jade';
      window.chrome.webview.postMessage(`discord-login|${theme}`);
      setTimeout(() => window.chrome.webview.postMessage('discord-get'), 1200);
      setTimeout(() => window.chrome.webview.postMessage('discord-get'), 3000);
      setDiscordMenuOpen(false); // Added based on the provided Code Edit snippet
    }
  };
  const openSettings = () => {
    onPageChange('system');
    setDiscordMenuOpen(false);
  };

  const sections: { title: string; items: { page: Page; label: string; icon: React.ReactNode }[] }[] = [
    {
      title: t(language, 'sidebar.general'),
      items: [
        { page: 'home', label: t(language, 'nav.home'), icon: <Home size={18} /> },
        { page: 'backups', label: t(language, 'nav.backups'), icon: <Archive size={18} /> },
        { page: 'fixes', label: t(language, 'nav.fixes'), icon: <Wrench size={18} /> },
        { page: 'downloads', label: t(language, 'nav.resources'), icon: <Download size={18} /> },
      ],
    },
    {
      title: t(language, 'sidebar.tweaks'),
      items: [
        { page: 'gaming', label: t(language, 'nav.gaming'), icon: <Zap size={18} /> },
        { page: 'gaming_tweaks', label: "Tools & Bypass", icon: <Settings size={18} /> },
        { page: 'debloater', label: t(language, 'nav.debloating'), icon: <Trash2 size={18} /> },
        ...(canAccessTesting ? [{ page: 'testing' as Page, label: t(language, 'settings.testing'), icon: <Beaker size={18} /> }] : []),
      ],
    },
  ];

  const displayName = (discord.username || discord.Username || '').trim();
  const avatarUrl = discord.avatarUrl || discord.AvatarUrl || '';
  const roleLabel = (() => {
    if (roles.includes('1324496746574905347') || tierRaw === 'developer') return 'Developer';
    if (roles.includes('1469669066024157234') || tierRaw.includes('tester')) return 'Tester App';
    if (roles.includes('1465913284644311161') || tierRaw.includes('premium')) return 'Premium User';
    return t(language, 'discord.free');
  })();

  return (
    <div className={`w-64 fixed h-screen left-0 top-0 flex flex-col overflow-hidden bg-black/50 backdrop-blur-2xl sidebar-shell ${discordMenuOpen ? 'discord-open' : ''}`}>
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div
            className="tfy-logo-mark"
            style={{ WebkitMaskImage: `url(${logo})`, maskImage: `url(${logo})` } as any}
            aria-label="TFY"
          />
          <div>
            <div className="text-lg font-display font-semibold text-white">TFY</div>
            <div className="text-xs text-gray-500">Utility Hub</div>
          </div>
        </div>
      </div>

      <div ref={navScrollRef} className="mt-2 flex-1 overflow-y-auto no-scrollbar px-4 space-y-6 sidebar-nav-scroll">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="px-2 text-[11px] uppercase tracking-[0.28em] text-gray-500 mb-3">
              {section.title}
            </div>
            <div className="space-y-2">
              {section.items.map((item) => (
                <button
                  key={item.page + item.label}
                  onClick={() => onPageChange(item.page)}
                  className={`sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-300 ${currentPage === item.page
                    ? 'active text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <span className="text-accent">{item.icon}</span>
                  <span className="text-left">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 relative" ref={discordBoxRef}>
        <div className={`liquid-card rounded-2xl p-4 text-xs text-gray-400 sidebar-discord-card ${discordMenuOpen ? 'open' : ''}`}>
          <div className="text-[11px] uppercase tracking-[0.3em] text-gray-500">{t(language, 'discord.title')}</div>
          {discord.connected ? (
            <button
              className="mt-2 w-full flex items-center gap-3 sidebar-discord-trigger"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setDiscordMenuOpen((v) => !v);
              }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Discord" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/10" />
              )}
              <div className="min-w-0 flex-1 text-left">
                <div className="text-sm text-white truncate">{displayName || t(language, 'discord.connected')}</div>
                <div className="text-[11px] text-gray-500 truncate">{roleLabel}</div>
              </div>
              {discordMenuOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronUp size={14} className="text-gray-400" />}
            </button>
          ) : (
            <div className="mt-2">
              <div className="text-sm text-white">{t(language, 'discord.notConnected')}</div>
              <button className="w-full text-xs mt-3 py-2 rounded-lg border border-white/5 bg-transparent flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-colors" onClick={handleDiscordConnect}>
                {t(language, 'discord.connect')}
              </button>
            </div>
          )}
          {discord.connected && (
            <div className={`mt-3 overflow-hidden sidebar-settings-wrap ${discordMenuOpen ? 'open' : ''}`}>
              <button
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm text-gray-300 hover:text-white transition-colors sidebar-settings-btn"
                onClick={openSettings}
              >
                <Settings size={16} />
                <span>{t(language, 'discord.settings')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
