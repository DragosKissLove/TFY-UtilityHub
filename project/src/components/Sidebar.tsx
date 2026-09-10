import { useEffect, useRef, useState } from 'react';
import { Home, Zap, Settings, Download, Trash2, Archive, Wrench, ChevronUp, ChevronDown, Beaker, Rocket, Users } from 'lucide-react';
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

export function RobloxIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M18.926 23.998L0 18.892 5.074.002 24 5.108l-5.074 18.89zM15.348 10.09l-5.282-1.416-1.414 5.28 5.281 1.415 1.415-5.279z" />
    </svg>
  );
}

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const [discord, setDiscord] = useState<DiscordState>(() => {
    try {
      const saved = localStorage.getItem('tfy.discord.state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.connected && (parsed.username || parsed.Username || parsed.avatarUrl || parsed.AvatarUrl)) {
          parsed.connected = true;
        }
        return parsed;
      }
      // Fallback to separate localStorage values
      const cachedName = localStorage.getItem('tfy.discord.name');
      const cachedId = localStorage.getItem('tfy.discord.id');
      const cachedAvatar = localStorage.getItem('tfy.discord.avatar');
      if (cachedName) {
        return {
          connected: true,
          username: cachedName,
          Username: cachedName,
          userId: cachedId || '',
          UserId: cachedId || '',
          avatarUrl: cachedAvatar || '',
          AvatarUrl: cachedAvatar || '',
          roles: [],
          roleNames: [],
          tier: 'Developer',
          Tier: 'Developer'
        };
      }
    } catch {}
    return { connected: false };
  });
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
            localStorage.setItem('tfy.discord.state', JSON.stringify(data));
          } catch {
          }
          setDiscord(data);
        } else if (!data.connected && data.isLogout === true) {
          window.__tfyDiscordName = '';
          try {
            localStorage.removeItem('tfy.discord.id');
            localStorage.removeItem('tfy.discord.name');
            localStorage.removeItem('tfy.discord.avatar');
            localStorage.removeItem('tfy.discord.state');
          } catch {
          }
          setDiscord({ connected: false });
        }
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

  const roles = Array.isArray(discord.roles) ? discord.roles : (Array.isArray(discord.Roles) ? discord.Roles : []);
  const tierRaw = (discord.tier || discord.Tier || '').toLowerCase();
  const userId = discord.userId || discord.UserId || '';
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
        { page: 'roblox', label: 'MultiRoblox', icon: <RobloxIcon size={18} /> },
        { page: 'backups', label: t(language, 'nav.backups'), icon: <Archive size={18} /> },
        { page: 'fixes', label: t(language, 'nav.optimizers') ?? 'Optimizers', icon: <Rocket size={18} /> },
        { page: 'downloads', label: t(language, 'nav.resources'), icon: <Download size={18} /> },
      ],
    },
    {
      title: t(language, 'sidebar.tweaks'),
      items: [
        { page: 'gaming', label: t(language, 'nav.gaming'), icon: <Zap size={18} /> },
        { page: 'gaming_tweaks', label: t(language, 'nav.toolsBypass') ?? 'Tools & Bypass', icon: <Settings size={18} /> },
        { page: 'debloater', label: t(language, 'nav.debloating'), icon: <Trash2 size={18} /> },
        ...(canAccessTesting ? [{ page: 'testing' as Page, label: t(language, 'settings.testing'), icon: <Beaker size={18} /> }] : []),
      ],
    },
  ];

  const displayName = (discord.username || discord.Username || '').trim();
  const avatarUrl = discord.avatarUrl || discord.AvatarUrl || '';
  const roleLabel = (() => {
    if (userId === '328152058869972994' || tierRaw === 'owner') return 'Owner';
    if (roles.includes('1324496746574905347') || tierRaw === 'developer' || tierRaw === 'Developer') return 'Developer';
    if (roles.includes('1469669066024157234') || tierRaw.includes('tester') || tierRaw.includes('Tester')) return 'Tester TFY';
    if (roles.includes('1465913284644311161') || tierRaw.includes('premium') || tierRaw === 'tfy enjoyer' || tierRaw === 'tfy enjoyer') return 'TFY Enjoyer';
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

      <div className="p-4 mt-auto border-t border-white/[0.04] bg-black/10 relative" ref={discordBoxRef}>
        <div className="px-2 text-[10px] uppercase tracking-[0.25em] text-gray-500/80 mb-2.5 flex items-center justify-between">
          <span>{t(language, 'discord.title')}</span>
        </div>
        {discord.connected ? (
          <div className="flex items-center gap-3 p-3 rounded-2xl sidebar-profile-card relative group">
            {/* Ambient inner glow */}
            <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_bottom_left,var(--accent),transparent_65%)] opacity-[0.03] pointer-events-none group-hover:opacity-[0.06] transition-opacity duration-500" />
            
            {/* Avatar with status indicator ring */}
            <div className="relative shrink-0 flex">
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt="Discord" 
                  className="w-10 h-10 rounded-full border border-white/10 shadow-md object-cover" 
                  onError={(e) => {
                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'TFY')}&background=5865F2&color=fff&size=80`;
                  }}
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/50 text-xs font-semibold">
                  {displayName ? displayName.slice(0, 2).toUpperCase() : '??'}
                </div>
              )}
              {/* Glowing active online dot */}
              <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border border-[#090a0d] shadow-sm animate-pulse"
                   style={{
                     backgroundColor: 'var(--accent)',
                     boxShadow: '0 0 6px var(--accent)'
                   }} />
            </div>

            {/* User details */}
            <div className="min-w-0 flex-1 flex flex-col justify-center">
              <div className="text-[13px] font-medium text-white truncate leading-snug">{displayName || t(language, 'discord.connected')}</div>
              <div className="mt-1 flex">
                <span className="text-[9px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-white/[0.04] text-accent border border-white/[0.04] shadow-sm leading-none">
                  {roleLabel}
                </span>
              </div>
            </div>

            {/* Quick settings gear action on the right */}
            <button
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.03] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-accent/20 hover:border-accent/30 hover:shadow-[0_0_12px_rgba(var(--accent-rgb),0.15)] transition-all duration-300 shadow-sm shrink-0 group/btn sidebar-settings-gear-btn"
              onClick={openSettings}
              title={t(language, 'discord.settings')}
            >
              <Settings size={15} className="transition-transform duration-500 group-hover/btn:rotate-90" />
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-2xl text-xs text-gray-400 flex flex-col gap-3 sidebar-profile-card unconnected relative">
            <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_65%)] opacity-[0.02] pointer-events-none" />
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center text-gray-500 hover:text-white hover:bg-accent/20 hover:border-accent/30 hover:shadow-[0_0_12px_rgba(var(--accent-rgb),0.15)] transition-all duration-300 cursor-pointer group/btn"
                onClick={openSettings}
                title={t(language, 'discord.settings') || 'Settings'}
              >
                <Settings size={14} className="transition-transform duration-500 group-hover/btn:rotate-90" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-white font-medium truncate mt-0.5">{t(language, 'discord.notConnected')}</div>
              </div>
            </div>
            <button 
              className="w-full py-2 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-center gap-2 text-xs text-gray-300 hover:text-white hover:bg-accent hover:text-black hover:border-accent hover:shadow-[0_4px_12px_rgba(var(--accent-rgb),0.15)] transition-all duration-300" 
              onClick={handleDiscordConnect}
            >
              {t(language, 'discord.connect')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
