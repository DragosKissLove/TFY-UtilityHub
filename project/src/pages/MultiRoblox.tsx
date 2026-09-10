import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Play, 
  Power, 
  Zap, 
  Settings, 
  Layers, 
  BarChart2, 
  Sliders, 
  Shuffle, 
  Terminal, 
  Plus, 
  Trash2, 
  Search, 
  RefreshCw, 
  MoreVertical, 
  Check, 
  ExternalLink, 
  Copy, 
  Eye, 
  EyeOff, 
  Grid, 
  List, 
  Volume2, 
  Cpu, 
  Radio, 
  Send, 
  AlertCircle, 
  UserCheck, 
  Globe, 
  KeyRound, 
  Gamepad2, 
  Clock,
  Sparkles,
  Users,
  ThumbsUp
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { getLanguage, type TfyLanguage } from '../lib/i18n';
import { notify } from '../lib/notify';

// ── Official Roblox SVG Vector Logo ──────────────────────────────────────────

export function RobloxIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18.926 23.998L0 18.892 5.074.002 24 5.108l-5.074 18.89zM15.348 10.09l-5.282-1.416-1.414 5.28 5.281 1.415 1.415-5.279z" />
    </svg>
  );
}

// ── Official Discord SVG Logo ────────────────────────────────────────────────

export function DiscordIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface RobloxAccount {
  id: string;
  username: string;
  displayName?: string;
  userId?: string;
  avatarUrl?: string;
  cookie: string;
  target?: string;
  nickname?: string;
  createdAt: string;
  lastUsed?: string;
}

export interface RobloxGroup {
  id: string;
  name: string;
  accountIds: string[];
  target?: string;
  color?: string;
}

export interface ChartGame {
  placeId: string;
  name: string;
  playerCount: number;
  rating: number;
  thumbnail: string;
  creator: string;
}

export interface LogItem {
  id: string;
  time: string;
  category: 'launch' | 'kill' | 'cookie' | 'afk' | 'system' | 'mixer' | 'webhook';
  level: 'info' | 'ok' | 'warn' | 'err';
  message: string;
}

export const DEFAULT_ROBLOX_EXPERIENCES: ChartGame[] = [
  { placeId: "107778070777162", name: "Steal An Egg", playerCount: 1187000, rating: 93, creator: "Crazy Studios", thumbnail: "https://tr.rbxcdn.com/180DAY-875b2a6dc156ce6dd64eb637e73238ce/768/432/Image/Png/noFilter" },
  { placeId: "4924922222", name: "Brookhaven 🏡RP", playerCount: 385000, rating: 86, creator: "Wolfpaq", thumbnail: "https://tr.rbxcdn.com/180DAY-2f146143dc81d9fee97a4a83e0696090/768/432/Image/Png/noFilter" },
  { placeId: "2753915549", name: "Blox Fruits", playerCount: 295000, rating: 92, creator: "Gamer Robot Inc", thumbnail: "https://tr.rbxcdn.com/180DAY-09e621f1df2e404a391adf389d2bea47/768/432/Image/Png/noFilter" },
  { placeId: "142823291", name: "Murder Mystery 2", playerCount: 233000, rating: 91, creator: "Nikilis", thumbnail: "https://tr.rbxcdn.com/180DAY-fe7335c3ad752e84323cd81ae38de69a/768/432/Image/Png/noFilter" },
  { placeId: "17625359962", name: "RIVALS 🔫", playerCount: 160000, rating: 94, creator: "Nosniy Games", thumbnail: "https://tr.rbxcdn.com/180DAY-fb02f48458ff689309df8d52bf516d04/768/432/Image/Png/noFilter" },
  { placeId: "9391468976", name: "Jujutsu Shenanigans", playerCount: 150000, rating: 86, creator: "The Strongest", thumbnail: "https://tr.rbxcdn.com/180DAY-decec85a41b80e4ac0beca8bc2952a7f/768/432/Image/Png/noFilter" },
  { placeId: "920587237", name: "Adopt Me!", playerCount: 125000, rating: 86, creator: "DreamCraft", thumbnail: "https://tr.rbxcdn.com/180DAY-a3a8f2a3869c4ab2702c11c45af08c49/768/432/Image/Png/noFilter" },
  { placeId: "79546208627805", name: "99 Nights in the Forest 🔦", playerCount: 118000, rating: 90, creator: "DarkForest Studios", thumbnail: "https://tr.rbxcdn.com/180DAY-c5215eabc21f46723f0084f99bb7622c/768/432/Image/Png/noFilter" },
  { placeId: "109983668079237", name: "Steal a Brainrot", playerCount: 84000, rating: 85, creator: "Brainrot Team", thumbnail: "https://tr.rbxcdn.com/180DAY-052ec1882b4ef3f0d72785be062b836a/768/432/Image/Png/noFilter" },
  { placeId: "16732694052", name: "Fisch 🎣", playerCount: 75000, rating: 91, creator: "WoozyNate", thumbnail: "https://tr.rbxcdn.com/180DAY-17ce753c4b1f087c5eda362c24457e25/768/432/Image/Png/noFilter" },
  { placeId: "15101393044", name: "Dress To Impress [DTI]", playerCount: 68000, rating: 91, creator: "Dress To Impress Group", thumbnail: "https://tr.rbxcdn.com/180DAY-93dd2075c61008cf59af69d997d0292a/768/432/Image/Png/noFilter" },
  { placeId: "8737899170", name: "Pet Simulator 99! 💰", playerCount: 62000, rating: 95, creator: "BIG Games Pets", thumbnail: "https://tr.rbxcdn.com/180DAY-30489fe9f38246b85ae26a70609457f1/768/432/Image/Png/noFilter" },
  { placeId: "7041939546", name: "Catalog Avatar Creator", playerCount: 65000, rating: 94, creator: "ItsMuneeeb", thumbnail: "https://tr.rbxcdn.com/180DAY-22c1dc925ae96a79a1b1e242c6b0d0fe/768/432/Image/Png/noFilter" },
  { placeId: "18687417158", name: "Forsaken", playerCount: 61000, rating: 85, creator: "Forsaken Group", thumbnail: "https://tr.rbxcdn.com/180DAY-ade3a7a657babdc426cad38911362395/768/432/Image/Png/noFilter" },
  { placeId: "13772394625", name: "Blade Ball", playerCount: 55000, rating: 89, creator: "Wyncore Studios", thumbnail: "https://tr.rbxcdn.com/180DAY-2fc4a4f895ceb701cbf30dfba711124d/768/432/Image/Png/noFilter" },
  { placeId: "10449761463", name: "The Strongest Battlegrounds", playerCount: 52000, rating: 92, creator: "Yielding Arts", thumbnail: "https://tr.rbxcdn.com/180DAY-fe7335c3ad752e84323cd81ae38de69a/768/432/Image/Png/noFilter" },
  { placeId: "6516141723", name: "DOORS 👁️", playerCount: 38000, rating: 94, creator: "LSPLASH", thumbnail: "https://tr.rbxcdn.com/180DAY-d3369a4e9dae4a5bf46f7c9e0d15e9a4/768/432/Image/Png/noFilter" },
  { placeId: "189707", name: "Natural Disaster Survival", playerCount: 25000, rating: 93, creator: "Stickmasterluke", thumbnail: "https://tr.rbxcdn.com/180DAY-56f8f830ca0481cf13d52c1ef5a4e320/768/432/Image/Png/noFilter" },
  { placeId: "6872265039", name: "BedWars", playerCount: 42000, rating: 87, creator: "Easy.gg", thumbnail: "https://tr.rbxcdn.com/180DAY-548c772cba27caab9d40b490f23023e3/768/432/Image/Png/noFilter" },
  { placeId: "606849622", name: "Jailbreak", playerCount: 22000, rating: 91, creator: "Badimo", thumbnail: "https://tr.rbxcdn.com/180DAY-996ff6d21f8a846c4fa191b72e0085a3/768/432/Image/Png/noFilter" }
];

export function MultiRoblox() {
  const [language] = useState<TfyLanguage>(() => getLanguage());
  const [activeTab, setActiveTab] = useState<'accounts' | 'packages' | 'charts' | 'mixer' | 'tracking' | 'rejoin' | 'settings' | 'logs'>('accounts');

  // MultiRoblox System Status
  const [multiActive, setMultiActive] = useState(true);
  const [runningCount, setRunningCount] = useState(0);
  const [runningPids, setRunningPids] = useState<number[]>([]);
  const [antiAfkActive, setAntiAfkActive] = useState(false);
  const [antiAfkInterval, setAntiAfkInterval] = useState(1080); // 18 mins

  // ── Passive Rejoin (Citrus-Style Interval-Based Mass Reconnection) ──────────
  const [passiveRejoinEnabled, setPassiveRejoinEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem('tfy_roblox_rejoin_enabled') === 'true'; } catch { return false; }
  });
  const [rejoinIntervalMinutes, setRejoinIntervalMinutes] = useState<number>(() => {
    try {
      const v = localStorage.getItem('tfy_roblox_rejoin_interval');
      return v ? parseInt(v, 10) : 60; // default 60 minutes
    } catch { return 60; }
  });
  const [rejoinStaggerSeconds, setRejoinStaggerSeconds] = useState<number>(() => {
    try {
      const v = localStorage.getItem('tfy_roblox_rejoin_stagger');
      return v ? parseInt(v, 10) : 5; // default 5 seconds
    } catch { return 5; }
  });
  const [farmStartTime, setFarmStartTime] = useState<number>(() => {
    try {
      const v = localStorage.getItem('tfy_roblox_farm_start');
      return v ? parseInt(v, 10) : Date.now();
    } catch { return Date.now(); }
  });
  const [lastRejoinTime, setLastRejoinTime] = useState<number | null>(() => {
    try {
      const v = localStorage.getItem('tfy_roblox_last_rejoin');
      return v ? parseInt(v, 10) : null;
    } catch { return null; }
  });
  const [rejoinCountdown, setRejoinCountdown] = useState<number>(() => {
    try {
      const v = localStorage.getItem('tfy_roblox_rejoin_interval');
      const mins = v ? parseInt(v, 10) : 60;
      return mins * 60;
    } catch { return 3600; }
  });
  const [farmUptimeSeconds, setFarmUptimeSeconds] = useState<number>(0);
  const [isCyclingRejoin, setIsCyclingRejoin] = useState<boolean>(false);
  const [rejoinCycleCount, setRejoinCycleCount] = useState<number>(() => {
    try {
      const v = localStorage.getItem('tfy_roblox_rejoin_cycles');
      return v ? parseInt(v, 10) : 0;
    } catch { return 0; }
  });

  // Accounts State
  const [accounts, setAccounts] = useState<RobloxAccount[]>(() => {
    try {
      const saved = localStorage.getItem('tfy_roblox_ram_accounts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [accountView, setAccountView] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Account Modal (3 Easy Methods)
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addMethod, setAddMethod] = useState<'browser' | 'creds' | 'cookie'>('browser');
  const [addCookie, setAddCookie] = useState('');
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addNickname, setAddNickname] = useState('');
  const [isValidatingCookie, setIsValidatingCookie] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Priority Dropdown Context
  const [activePriorityMenu, setActivePriorityMenu] = useState<string | null>(null);

  // Groups State
  const [groups, setGroups] = useState<RobloxGroup[]>(() => {
    try {
      const saved = localStorage.getItem('tfy_roblox_ram_groups');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupTarget, setGroupTarget] = useState('');
  const [groupSelectedAccounts, setGroupSelectedAccounts] = useState<string[]>([]);

  // Charts State (Multiple Categories + Auto Update)
  const [chartCategory, setChartCategory] = useState<'popular' | 'topRated' | 'topEarning' | 'trending'>('popular');
  const [chartSearch, setChartSearch] = useState('');
  const [chartGames, setChartGames] = useState<ChartGame[]>(DEFAULT_ROBLOX_EXPERIENCES);
  const [chartsLoading, setChartsLoading] = useState(false);

  // Selected Game Launch Modal
  const [selectedGame, setSelectedGame] = useState<ChartGame | null>(null);
  const [selectedLaunchAccountId, setSelectedLaunchAccountId] = useState<string>('');

  // Mixer State (Persisted in localStorage)
  const [gfxLevel, setGfxLevel] = useState<number>(() => {
    const val = localStorage.getItem('tfy_roblox_gfxLevel');
    return val ? parseInt(val) : 10;
  });
  const [gfxAuto, setGfxAuto] = useState<boolean>(() => localStorage.getItem('tfy_roblox_gfxAuto') === 'true');
  const [fpsCap, setFpsCap] = useState<number>(() => {
    const val = localStorage.getItem('tfy_roblox_fpsCap');
    return val ? parseInt(val) : 240;
  });
  const [fpsUnlimited, setFpsUnlimited] = useState<boolean>(() => localStorage.getItem('tfy_roblox_fpsUnlimited') === 'true');
  const [masterVolume, setMasterVolume] = useState<number>(() => {
    const val = localStorage.getItem('tfy_roblox_volume');
    return val ? parseInt(val) : 100;
  });

  // Kill Roblox Selector Modal State
  const [killModalOpen, setKillModalOpen] = useState(false);



  // Tracking (Discord Webhook with 15-min auto broadcast)
  const [webhookUrl, setWebhookUrl] = useState(() => localStorage.getItem('tfy_roblox_webhook') || '');
  const [autoBroadcast, setAutoBroadcast] = useState(() => localStorage.getItem('tfy_roblox_autowebhook') === 'true');
  const [isSendingWebhook, setIsSendingWebhook] = useState(false);
  const [lastWebhookTime, setLastWebhookTime] = useState<string | null>(null);

  // Resolved Game Names Cache (Place ID -> Name)
  const [resolvedGameNames, setResolvedGameNames] = useState<Record<string, string>>({});

  // Auto RAM Working Set Optimization (Strong / Normal / Soft)
  const [autoTrimEnabled, setAutoTrimEnabled] = useState<boolean>(() => localStorage.getItem('tfy_roblox_autotrim_enabled') === 'true');
  const [autoTrimMode, setAutoTrimMode] = useState<'strong' | 'normal' | 'soft'>(() => {
    const saved = localStorage.getItem('tfy_roblox_autotrim_mode');
    return (saved === 'strong' || saved === 'soft' || saved === 'normal') ? saved : 'normal';
  });

  // Launcher Selector State
  const [selectedLauncher, setSelectedLauncher] = useState<string>(() => localStorage.getItem('tfy_roblox_launcher') || 'fishstrap');
  const [availableLaunchers, setAvailableLaunchers] = useState<{ id: string; name: string; installed: boolean; path: string }[]>([
    { id: 'auto', name: 'Auto Detect (Recommended)', installed: true, path: 'Auto' }
  ]);

  // Logs
  const [logs, setLogs] = useState<LogItem[]>([]);

  const addLog = (category: LogItem['category'], level: LogItem['level'], message: string) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    const item: LogItem = {
      id: Math.random().toString(36).substring(7),
      time,
      category,
      level,
      message
    };
    setLogs(prev => [item, ...prev].slice(0, 500));
  };

  // Sync state to local storage
  useEffect(() => {
    try {
      localStorage.setItem('tfy_roblox_gfxLevel', gfxLevel.toString());
      localStorage.setItem('tfy_roblox_gfxAuto', gfxAuto ? 'true' : 'false');
      localStorage.setItem('tfy_roblox_fpsCap', fpsCap.toString());
      localStorage.setItem('tfy_roblox_fpsUnlimited', fpsUnlimited ? 'true' : 'false');
      localStorage.setItem('tfy_roblox_volume', masterVolume.toString());
    } catch {}
  }, [gfxLevel, gfxAuto, fpsCap, fpsUnlimited, masterVolume]);

  useEffect(() => {
    try {
      localStorage.setItem('tfy_roblox_autotrim_enabled', autoTrimEnabled ? 'true' : 'false');
      localStorage.setItem('tfy_roblox_autotrim_mode', autoTrimMode);
    } catch {}
  }, [autoTrimEnabled, autoTrimMode]);

  // Auto RAM Trim active interval timer
  useEffect(() => {
    if (!autoTrimEnabled) return;
    const intervalMs = autoTrimMode === 'strong' ? 5 * 60 * 1000 : autoTrimMode === 'soft' ? 30 * 60 * 1000 : 15 * 60 * 1000;
    const intervalMins = autoTrimMode === 'strong' ? 5 : autoTrimMode === 'soft' ? 30 : 15;
    
    const timer = setInterval(() => {
      if (runningCount > 0 && window.chrome?.webview) {
        window.chrome.webview.postMessage('roblox-trim-memory|');
        addLog('system', 'ok', `[Auto RAM Trim] Optimized memory working set (${autoTrimMode.toUpperCase()} - ${intervalMins}m cycle).`);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [autoTrimEnabled, autoTrimMode, runningCount]);

  // ── Passive Rejoin Persistence & Live 1-Second Farm Ticker ─────────────────
  useEffect(() => {
    try {
      localStorage.setItem('tfy_roblox_rejoin_enabled', passiveRejoinEnabled ? 'true' : 'false');
      localStorage.setItem('tfy_roblox_rejoin_interval', rejoinIntervalMinutes.toString());
      localStorage.setItem('tfy_roblox_rejoin_stagger', rejoinStaggerSeconds.toString());
      localStorage.setItem('tfy_roblox_rejoin_cycles', rejoinCycleCount.toString());
      if (lastRejoinTime) localStorage.setItem('tfy_roblox_last_rejoin', lastRejoinTime.toString());
      localStorage.setItem('tfy_roblox_farm_start', farmStartTime.toString());
    } catch {}
  }, [passiveRejoinEnabled, rejoinIntervalMinutes, rejoinStaggerSeconds, rejoinCycleCount, lastRejoinTime, farmStartTime]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setFarmUptimeSeconds(Math.max(0, Math.floor((now - farmStartTime) / 1000)));

      if (!passiveRejoinEnabled || isCyclingRejoin) return;

      setRejoinCountdown(prev => {
        if (prev <= 1) {
          triggerPassiveRejoin();
          return rejoinIntervalMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [passiveRejoinEnabled, isCyclingRejoin, farmStartTime, rejoinIntervalMinutes, accounts, selectedLauncher, rejoinStaggerSeconds]);

  // Sync state to local storage
  useEffect(() => {
    try { localStorage.setItem('tfy_roblox_ram_accounts', JSON.stringify(accounts)); } catch {}
  }, [accounts]);

  useEffect(() => {
    try { localStorage.setItem('tfy_roblox_ram_groups', JSON.stringify(groups)); } catch {}
  }, [groups]);

  useEffect(() => {
    try { localStorage.setItem('tfy_roblox_gen_history', JSON.stringify(genHistory)); } catch {}
  }, [genHistory]);

  useEffect(() => {
    try { localStorage.setItem('tfy_roblox_autowebhook', autoBroadcast ? 'true' : 'false'); } catch {}
  }, [autoBroadcast]);

  // Click outside to close priority menu
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.account-menu-container')) {
        setActivePriorityMenu(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Format connected accounts string for Discord Webhook
  const connectedAccountsString = useMemo(() => {
    if (accounts.length === 0) return 'No accounts added';
    return accounts.map(a => `• **@${a.username}** ${a.nickname ? `(*${a.nickname}*)` : ''}`).join('\n');
  }, [accounts]);

  // Auto-resolve Place ID game names
  useEffect(() => {
    accounts.forEach(acc => {
      const raw = acc.target?.trim();
      if (raw) {
        const match = raw.match(/\d{5,}/)?.[0] || (/^\d+$/.test(raw) ? raw : '');
        if (match && !resolvedGameNames[match] && window.chrome?.webview) {
          window.chrome.webview.postMessage(`roblox-resolve-place|${match}`);
        }
      }
    });
  }, [accounts, resolvedGameNames]);

  // IPC Listener
  useEffect(() => {
    const handleMessage = (event: any) => {
      let message = event.data;
      if (typeof message === 'string') {
        try { message = JSON.parse(message); } catch { return; }
      }

      if (message?.type === 'roblox-status') {
        setMultiActive(!!message.data?.active);
        setRunningCount(message.data?.count || 0);
        setRunningPids(message.data?.pids || []);
        if (message.data?.antiAfk !== undefined) {
          setAntiAfkActive(!!message.data.antiAfk);
        }
        if (message.data?.message) {
          addLog('system', 'ok', message.data.message);
        }
      }

      if (message?.type === 'roblox-launched') {
        if (message.data?.success) {
          addLog('launch', 'ok', `Roblox instance launched successfully (PID: ${message.data.pid})`);
          notify({ title: 'Roblox Launched', message: `Process ID: ${message.data.pid}`, kind: 'success', duration: 2500 });
        } else {
          addLog('launch', 'err', `Failed to launch: ${message.data?.error || 'Unknown error'}`);
          notify({ title: 'Launch Failed', message: message.data?.error || 'Unknown error', kind: 'error', duration: 3500 });
        }
      }

      if (message?.type === 'roblox-cookie-validated') {
        setIsValidatingCookie(false);
        if (message.data?.ok) {
          const cookieToSave = message.cookie || addCookie.trim();
          const newAcc: RobloxAccount = {
            id: message.data.userId || Date.now().toString(),
            username: message.data.username || 'RobloxUser',
            displayName: message.data.displayName,
            userId: message.data.userId,
            avatarUrl: message.data.avatarUrl,
            cookie: cookieToSave,
            nickname: addNickname.trim() || undefined,
            createdAt: new Date().toISOString()
          };
          setAccounts(prev => {
            const filtered = prev.filter(a => a.userId !== newAcc.userId);
            return [newAcc, ...filtered];
          });
          setAddModalOpen(false);
          setAddCookie('');
          setAddNickname('');
          setAddUsername('');
          setAddPassword('');
          addLog('cookie', 'ok', `Account added & verified: @${newAcc.username}`);
          notify({ title: 'Account Verified', message: `Welcome @${newAcc.username}!`, kind: 'success', duration: 2500 });
        } else {
          setAddError(message.data?.error || 'Invalid or expired .ROBLOSECURITY cookie.');
          addLog('cookie', 'err', `Cookie verification failed: ${message.data?.error || 'Invalid'}`);
        }
      }

      if (message?.type === 'roblox-charts-data') {
        setChartsLoading(false);
        if (message.data?.games && Array.isArray(message.data.games) && message.data.games.length > 0) {
          setChartGames(message.data.games);
        }
      }

      if (message?.type === 'roblox-webhook-result') {
        setIsSendingWebhook(false);
        if (message.data?.ok) {
          setLastWebhookTime(new Date().toLocaleTimeString());
          addLog('webhook', 'ok', 'Discord Webhook message delivered successfully!');
          notify({ title: 'Discord Webhook', message: 'Status message delivered!', kind: 'success', duration: 2500 });
        } else {
          addLog('webhook', 'err', `Discord Webhook failed: ${message.data?.message || 'Error'}`);
          notify({ title: 'Webhook Failed', message: message.data?.message || 'Error sending webhook', kind: 'error', duration: 3500 });
        }
      }

      if (message?.type === 'roblox-game-resolved') {
        if (message.data?.ok) {
          setResolvedGameNames(prev => ({
            ...prev,
            [message.data.placeId]: message.data.name
          }));
        }
      }

      if (message?.type === 'roblox-launchers-list') {
        if (Array.isArray(message.data) && message.data.length > 0) {
          setAvailableLaunchers(message.data);
        }
      }
    };

    if (window.chrome?.webview) {
      window.chrome.webview.addEventListener('message', handleMessage);
      window.chrome.webview.postMessage('roblox-status');
      window.chrome.webview.postMessage('roblox-get-launchers');
    }
    return () => {
      if (window.chrome?.webview) {
        window.chrome.webview.removeEventListener('message', handleMessage);
      }
    };
  }, [addCookie, addNickname]);

  // Load Charts when tab active & Auto-refresh every 60 seconds
  useEffect(() => {
    if (activeTab === 'charts') {
      fetchCharts(chartCategory);
      const interval = setInterval(() => {
        fetchCharts(chartCategory);
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [activeTab, chartCategory]);

  // 15-Minute Automated Discord Webhook Loop
  useEffect(() => {
    if (!autoBroadcast || !webhookUrl.trim()) return;

    const timer = setInterval(() => {
      if (webhookUrl.trim() && window.chrome?.webview) {
        window.chrome.webview.postMessage(`roblox-send-webhook|${webhookUrl.trim()}|15-Minute Periodic Health Status|${connectedAccountsString}`);
        addLog('webhook', 'info', 'Sent automated 15-minute Discord status report.');
      }
    }, 15 * 60 * 1000); // 15 mins

    return () => clearInterval(timer);
  }, [autoBroadcast, webhookUrl, connectedAccountsString]);

  const fetchCharts = (cat: string) => {
    setChartsLoading(true);
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(`roblox-get-charts|${cat}`);
    } else {
      setTimeout(() => {
        setChartsLoading(false);
      }, 400);
    }
  };

  // Filtered Accounts list
  const filteredAccounts = useMemo(() => {
    let result = accounts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a => 
        a.username.toLowerCase().includes(q) ||
        (a.displayName && a.displayName.toLowerCase().includes(q)) ||
        (a.nickname && a.nickname.toLowerCase().includes(q)) ||
        (a.userId && a.userId.includes(q))
      );
    }
    return result;
  }, [accounts, searchQuery]);

  // Filtered Games in Charts
  const filteredChartGames = useMemo(() => {
    if (!chartSearch.trim()) return chartGames;
    const q = chartSearch.toLowerCase();
    return chartGames.filter(g => g.name.toLowerCase().includes(q) || g.creator?.toLowerCase().includes(q));
  }, [chartGames, chartSearch]);

  // Actions
  const handleLaunchAccount = (account: RobloxAccount, customTarget?: string) => {
    const target = customTarget !== undefined ? customTarget : (account.target || '');
    addLog('launch', 'info', `Launching account @${account.username} (Target: '${target || 'Standard'}', Launcher: '${selectedLauncher}')`);
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(`roblox-launch|${target}<<COOKIE>>${account.cookie}<<LAUNCHER>>${selectedLauncher}`);
    } else {
      notify({ title: 'Simulated Launch', message: `Account @${account.username} launched!`, kind: 'info', duration: 2000 });
    }
  };

  const handleToggleMulti = () => {
    window.chrome?.webview?.postMessage('roblox-multi-toggle');
  };

  // ── Passive Rejoin Helpers & Engine ─────────────────────────────────────────
  const REJOIN_INTERVAL_PRESETS = [
    { label: '5m', mins: 5, desc: 'Quick Test' },
    { label: '15m', mins: 15, desc: 'High Frequency' },
    { label: '30m', mins: 30, desc: 'Fast Cycle' },
    { label: '1h', mins: 60, desc: 'Standard (Rec.)' },
    { label: '2h', mins: 120, desc: 'Extended Farm' },
    { label: '6h', mins: 360, desc: 'Long Session' },
    { label: '12h', mins: 720, desc: 'Half-Day' },
    { label: '24h', mins: 1440, desc: 'Daily Refresh' },
  ];

  const formatCountdown = (secs: number) => {
    if (secs < 0) secs = 0;
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  };

  const formatUptime = (secs: number) => {
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const formatIntervalLabel = (mins: number) => {
    if (mins >= 1440) return `${Math.round(mins / 1440)}d`;
    if (mins >= 60) return `${Math.round(mins / 60)}h`;
    return `${mins}m`;
  };

  const triggerPassiveRejoin = async () => {
    if (isCyclingRejoin) return;
    setIsCyclingRejoin(true);

    const targetAccounts = accounts.filter(a => a.cookie && a.cookie.trim().length > 0);
    if (targetAccounts.length === 0) {
      addLog('rejoin' as any, 'warn', '[Passive Rejoin] No valid accounts found to cycle.');
      setIsCyclingRejoin(false);
      setRejoinCountdown(rejoinIntervalMinutes * 60);
      return;
    }

    const intervalLabel = formatIntervalLabel(rejoinIntervalMinutes);
    addLog('rejoin' as any, 'warn', `[Passive Rejoin] Interval reached (${intervalLabel}). Cycling ${targetAccounts.length} account(s)...`);
    notify({
      title: 'Passive Rejoin Active',
      message: `Safely cycling ${targetAccounts.length} active account(s)...`,
      kind: 'info',
      duration: 3500
    });

    // Step 1: Safely terminate existing Roblox instances
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage('roblox-kill-all');
    }
    addLog('rejoin' as any, 'info', '[Passive Rejoin] Terminated previous instances. Waiting 4s for process cleanup & mutex release...');

    // Step 2: Wait 4 seconds for process cleanup & mutex release
    await new Promise(r => setTimeout(r, 4000));

    // Step 3: Sequential Staggered Relaunch
    for (let i = 0; i < targetAccounts.length; i++) {
      const acc = targetAccounts[i];
      const target = acc.target || '';
      addLog('rejoin' as any, 'ok', `[Passive Rejoin] Relaunching @${acc.username} (${i + 1}/${targetAccounts.length}) via ${selectedLauncher}...`);

      if (window.chrome?.webview) {
        window.chrome.webview.postMessage(`roblox-launch|${target}<<COOKIE>>${acc.cookie}<<LAUNCHER>>${selectedLauncher}`);
      }

      if (i < targetAccounts.length - 1 && rejoinStaggerSeconds > 0) {
        await new Promise(r => setTimeout(r, rejoinStaggerSeconds * 1000));
      }
    }

    // Step 4: Finalize cycle
    const now = Date.now();
    setLastRejoinTime(now);
    setRejoinCycleCount(c => c + 1);
    setRejoinCountdown(rejoinIntervalMinutes * 60);
    setIsCyclingRejoin(false);

    addLog('rejoin' as any, 'ok', `[Passive Rejoin] Mass reconnection complete! Cycled ${targetAccounts.length} account(s).`);
    notify({
      title: 'Passive Rejoin Complete',
      message: `Successfully cycled ${targetAccounts.length} account(s). Next cycle in ${intervalLabel}.`,
      kind: 'success',
      duration: 4000
    });
  };

  const handleKillAll = () => {
    window.chrome?.webview?.postMessage('roblox-kill-all');
    addLog('kill', 'warn', 'Killed all running Roblox instances.');
    notify({ title: 'Roblox Killed', message: 'All running instances terminated.', kind: 'info', duration: 2000 });
  };

  const handleToggleAntiAfk = () => {
    window.chrome?.webview?.postMessage(`roblox-antiafk-toggle|${antiAfkInterval}`);
  };

  const handleSetPriority = (account: RobloxAccount, priority: string) => {
    setActivePriorityMenu(null);
    if (runningPids.length > 0 && window.chrome?.webview) {
      runningPids.forEach(pid => {
        window.chrome.webview.postMessage(`roblox-set-priority|${pid}|${priority}`);
      });
      addLog('system', 'ok', `Set CPU priority '${priority}' for active Roblox instances.`);
      notify({ title: 'Priority Applied', message: `CPU priority set to ${priority}.`, kind: 'success', duration: 2000 });
    } else {
      addLog('system', 'info', `Preferred priority '${priority}' configured for @${account.username}.`);
      notify({ title: 'Priority Selected', message: `Priority ${priority} will apply on active instances.`, kind: 'info', duration: 2000 });
    }
  };

  const handleTrimRamAccount = (account: RobloxAccount) => {
    setActivePriorityMenu(null);
    window.chrome?.webview?.postMessage('roblox-trim-memory|');
    if (runningPids.length > 0) {
      window.chrome?.webview?.postMessage(`roblox-trim-memory|${runningPids[0]}`);
    }
    addLog('system', 'ok', `Trimmed RAM working set memory for @${account.username}`);
    notify({ title: 'RAM Trimmed', message: `Working set memory cleared for @${account.username}.`, kind: 'success', duration: 1500 });
  };

  const handleStartBrowserLogin = () => {
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage('roblox-open-login-window');
      notify({ title: 'Sign-In Window Opened', message: 'Log into Roblox in the popup window.', kind: 'info', duration: 3000 });
      setAddModalOpen(false);
    } else {
      notify({ title: 'Browser Sign-In', message: 'Available in desktop host mode.', kind: 'info', duration: 2000 });
    }
  };

  const handleAddCookieSubmit = () => {
    if (!addCookie.trim()) {
      setAddError('Please enter a .ROBLOSECURITY cookie.');
      return;
    }
    setIsValidatingCookie(true);
    setAddError(null);
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(`roblox-validate-cookie|${addCookie.trim()}`);
    } else {
      setTimeout(() => {
        setIsValidatingCookie(false);
        const newAcc: RobloxAccount = {
          id: Date.now().toString(),
          username: 'DemoPlayer',
          displayName: 'Demo Player',
          userId: '12345678',
          avatarUrl: '',
          cookie: addCookie.trim(),
          nickname: addNickname || undefined,
          createdAt: new Date().toISOString()
        };
        setAccounts([newAcc, ...accounts]);
        setAddModalOpen(false);
        setAddCookie('');
        setAddNickname('');
      }, 1000);
    }
  };

  const handleSendWebhookTest = () => {
    if (!webhookUrl.trim()) {
      notify({ title: 'Error', message: 'Enter a valid Discord Webhook URL first.', kind: 'error', duration: 2500 });
      return;
    }
    setIsSendingWebhook(true);
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(`roblox-send-webhook|${webhookUrl.trim()}|Manual Status Ping|${connectedAccountsString}`);
    } else {
      setTimeout(() => {
        setIsSendingWebhook(false);
        setLastWebhookTime(new Date().toLocaleTimeString());
        notify({ title: 'Discord Webhook', message: 'Status message delivered!', kind: 'success', duration: 2000 });
      }, 1000);
    }
  };

  const handleApplyMixer = () => {
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(`roblox-set-fps|${fpsUnlimited ? 9999 : fpsCap}`);
      window.chrome.webview.postMessage(`roblox-set-graphics|${gfxLevel}|${gfxAuto ? 'auto' : 'manual'}`);
      window.chrome.webview.postMessage(`roblox-set-volume|${masterVolume}`);
    }
    addLog('mixer', 'ok', `Mixer applied: FPS ${fpsUnlimited ? 'Unlimited' : fpsCap}, Graphics ${gfxAuto ? 'Auto' : gfxLevel}, Volume ${masterVolume}%`);
    notify({ title: 'Mixer Applied', message: 'Roblox settings successfully saved.', kind: 'success', duration: 2000 });
  };

  const handleTrimRam = () => {
    window.chrome?.webview?.postMessage('roblox-trim-memory|');
    addLog('system', 'ok', 'Trimmed RAM Working Set size for all Roblox processes.');
    notify({ title: 'RAM Trimmed', message: 'Working set memory cleared for all instances.', kind: 'success', duration: 2000 });
  };

  const handleLaunchGroup = async (grp: RobloxGroup) => {
    const groupAccounts = grp.accountIds.map(id => accounts.find(a => a.id === id)).filter(Boolean) as RobloxAccount[];
    if (groupAccounts.length === 0) {
      notify({ title: 'Group Empty', message: 'No accounts assigned to this group.', kind: 'error', duration: 2000 });
      return;
    }

    if (!multiActive && window.chrome?.webview) {
      window.chrome.webview.postMessage('roblox-multi-toggle');
    }

    notify({ title: 'Launching Group', message: `Starting ${groupAccounts.length} accounts sequentially...`, kind: 'info', duration: 2800 });
    addLog('launch', 'info', `Beginning sequential launch for group '${grp.name}' (${groupAccounts.length} accounts)...`);

    for (let i = 0; i < groupAccounts.length; i++) {
      const acc = groupAccounts[i];
      handleLaunchAccount(acc, grp.target);
      if (i < groupAccounts.length - 1) {
        await new Promise(r => setTimeout(r, 2800));
      }
    }
  };

  const handleKillSpecificPid = (pid: number) => {
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(`roblox-kill-pid|${pid}`);
      addLog('kill', 'warn', `Terminated Roblox process (PID: ${pid}).`);
      notify({ title: 'Instance Terminated', message: `PID ${pid} was stopped.`, kind: 'info', duration: 1800 });
    }
  };

  // Auto-apply saved mixer settings on initial mount
  useEffect(() => {
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(`roblox-set-fps|${fpsUnlimited ? 9999 : fpsCap}`);
      window.chrome.webview.postMessage(`roblox-set-graphics|${gfxLevel}|${gfxAuto ? 'auto' : 'manual'}`);
      window.chrome.webview.postMessage(`roblox-set-volume|${masterVolume}`);
    }
  }, []);

  return (
    <div className="tfy-themed-page tfy-page-gaming h-full min-h-0 flex flex-col gap-4 overflow-hidden select-none">
      
      {/* ── Top Header Titlebar (Aligned with Debloater & Backups Theme) ── */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-4 pb-1">
        <div>
          <p className="section-title">GAMING & OPTIMIZATION</p>
          <h1 className="text-2xl md:text-3xl font-display font-semibold text-white mt-1 flex items-center gap-2.5">
            <Users size={24} className="text-accent" />
            MultiRoblox
          </h1>
          <p className="text-gray-400 mt-1 max-w-xl text-xs md:text-sm">
            Run unlimited Roblox accounts simultaneously with live FastFlags mixer and account manager.
          </p>
        </div>

        {/* Global Toolbar: Multi-Instance Switch, Anti-AFK Switch & Kill Button */}
        <div className="flex items-center gap-2.5 shrink-0 ml-auto">
          {/* Multi-Instance Switch (Theme Colored) */}
          <div className="h-8 flex items-center gap-2 px-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-gray-300 shrink-0">
            <Zap size={14} className={multiActive ? 'text-accent' : 'text-gray-500'} />
            <span className="font-medium">Multi-Instance</span>
            <button
              type="button"
              onClick={handleToggleMulti}
              className={`w-9 h-5 rounded-full transition-all relative border p-0.5 cursor-pointer ${
                multiActive ? 'border-transparent' : 'bg-white/10 border-white/15'
              }`}
              style={multiActive ? { background: 'var(--accent)' } : undefined}
              title="Toggle Multi-Instance Mutex Bypass"
            >
              <div className={`w-3.5 h-3.5 rounded-full transition-transform ${multiActive ? 'translate-x-4 bg-black font-bold' : 'translate-x-0 bg-white'}`} />
            </button>
          </div>

          {/* Anti-AFK Switch (Theme Colored) */}
          <div className="h-8 flex items-center gap-2 px-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-gray-300 shrink-0">
            <Radio size={14} className={antiAfkActive ? 'text-accent animate-pulse' : 'text-gray-500'} />
            <span className="font-medium">Anti-AFK</span>
            <button
              type="button"
              onClick={handleToggleAntiAfk}
              className={`w-9 h-5 rounded-full transition-all relative border p-0.5 cursor-pointer ${
                antiAfkActive ? 'border-transparent' : 'bg-white/10 border-white/15'
              }`}
              style={antiAfkActive ? { background: 'var(--accent)' } : undefined}
              title="Toggle 20-Minute Anti-AFK Keypress"
            >
              <div className={`w-3.5 h-3.5 rounded-full transition-transform ${antiAfkActive ? 'translate-x-4 bg-black font-bold' : 'translate-x-0 bg-white'}`} />
            </button>
          </div>

          {/* Passive Rejoin Switch (Citrus Mass Reconnection) */}
          <div className="h-8 flex items-center gap-2 px-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-gray-300 shrink-0">
            <RefreshCw size={14} className={passiveRejoinEnabled ? 'text-accent animate-spin-slow' : 'text-gray-500'} />
            <span className="font-medium">Passive Rejoin</span>
            <button
              type="button"
              onClick={() => {
                const next = !passiveRejoinEnabled;
                setPassiveRejoinEnabled(next);
                if (next) {
                  setFarmStartTime(Date.now());
                  setRejoinCountdown(rejoinIntervalMinutes * 60);
                  notify({
                    title: 'Passive Rejoin Enabled',
                    message: `Passive Rejoin active: cycling every ${formatIntervalLabel(rejoinIntervalMinutes)}.`,
                    kind: 'success',
                    duration: 3000
                  });
                } else {
                  notify({
                    title: 'Passive Rejoin Disabled',
                    message: 'Auto-reconnection paused.',
                    kind: 'info',
                    duration: 2000
                  });
                }
              }}
              className={`w-9 h-5 rounded-full transition-all relative border p-0.5 cursor-pointer ${
                passiveRejoinEnabled ? 'border-transparent' : 'bg-white/10 border-white/15'
              }`}
              style={passiveRejoinEnabled ? { background: 'var(--accent)' } : undefined}
              title="Toggle Passive Rejoin Interval-Based Mass Reconnection"
            >
              <div className={`w-3.5 h-3.5 rounded-full transition-transform ${passiveRejoinEnabled ? 'translate-x-4 bg-black font-bold' : 'translate-x-0 bg-white'}`} />
            </button>
            {passiveRejoinEnabled && (
              <span className="font-mono text-[10px] font-bold text-accent pl-0.5" title="Time until next mass reconnection">
                {isCyclingRejoin ? 'Cycling...' : formatCountdown(rejoinCountdown)}
              </span>
            )}
          </div>

          {/* Kill Roblox Process Selector */}
          <button
            type="button"
            onClick={() => {
              if (runningCount === 0) {
                notify({ title: 'No Instances', message: 'No Roblox processes currently running.', kind: 'info', duration: 1500 });
              } else {
                setKillModalOpen(true);
              }
            }}
            className="h-8 px-3 rounded-xl text-xs font-semibold bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Power size={14} />
            <span>Kill Roblox</span>
            {runningCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-red-500/40 text-white font-mono text-[10px] font-bold">
                {runningCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Main Container: Sidebar Tabs + Page Content (Frosted Glass Surface) ── */}
      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
        
        {/* Left Sub-Navigation Bar (MultiRoblox Tabs) */}
        <div className="w-48 shrink-0 flex flex-col justify-between p-2 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl">
          <div className="flex flex-col gap-1">
            {[
              { id: 'accounts', label: 'Accounts', icon: <Users size={16} /> },
              { id: 'packages', label: 'Groups', icon: <Layers size={16} /> },
              { id: 'charts', label: 'Charts', icon: <BarChart2 size={16} /> },
              { id: 'mixer', label: 'Mixer', icon: <Sliders size={16} /> },
              { id: 'rejoin', label: 'Passive Rejoin', icon: <RefreshCw size={16} /> },
              { id: 'tracking', label: 'Tracking', icon: <DiscordIcon size={16} /> },
              { id: 'settings', label: 'Settings', icon: <Settings size={16} /> },
              { id: 'logs', label: 'Logs', icon: <Terminal size={16} /> },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer border ${
                  activeTab === tab.id
                    ? 'bg-white/10 text-white border-white/20 shadow-sm'
                    : 'text-gray-400 border-transparent hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span className={activeTab === tab.id ? 'text-accent' : 'text-gray-500'}>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.id === 'accounts' && accounts.length > 0 && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.2 rounded-md bg-white/10 text-gray-300 font-mono">
                    {accounts.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Quick Stats at bottom of left sidebar */}
          <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-[11px] space-y-1">
            <div className="flex justify-between text-gray-400">
              <span>Saved Alts:</span>
              <span className="text-white font-semibold">{accounts.length}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Running Instances:</span>
              <span className="text-accent font-semibold">{runningCount}</span>
            </div>
          </div>
        </div>

        {/* Right Main Page Panel */}
        <div className="flex-1 min-h-0 bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl rounded-2xl p-4 flex flex-col overflow-hidden">
          
          {/* ──────────────────────────────────────────────────────────────────
              TAB 1: ACCOUNTS
          ────────────────────────────────────────────────────────────────── */}
          {activeTab === 'accounts' && (
            <div className="h-full flex flex-col min-h-0 gap-3">
              {/* Accounts Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] text-xs text-white flex-1">
                    <Search size={14} className="text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search accounts by username, display name or ID..."
                      className="bg-transparent text-xs outline-none text-white placeholder-gray-500 w-full"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* View Toggles */}
                  <div className="flex items-center bg-white/[0.03] p-0.5 rounded-lg border border-white/10">
                    <button
                      type="button"
                      onClick={() => setAccountView('grid')}
                      className={`p-1.5 rounded-md ${accountView === 'grid' ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'}`}
                      title="Grid View"
                    >
                      <Grid size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountView('list')}
                      className={`p-1.5 rounded-md ${accountView === 'list' ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'}`}
                      title="List View"
                    >
                      <List size={14} />
                    </button>
                  </div>

                  {/* Add Account Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setAddError(null);
                      setAddModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    style={{ background: 'var(--accent)', color: '#000' }}
                  >
                    <Plus size={14} />
                    <span>Add Account</span>
                  </button>
                </div>
              </div>

              {/* Passive Rejoin Active Farm Banner */}
              {passiveRejoinEnabled && (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-white/[0.02] border border-white/[0.08] backdrop-blur-md shrink-0">
                  <div className="flex items-center gap-2.5">
                    <RefreshCw size={14} className={isCyclingRejoin ? 'text-accent animate-spin' : 'text-accent'} />
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-white font-medium">Passive Rejoin:</span>
                      <span className="font-mono font-bold text-accent">
                        {isCyclingRejoin ? 'Cycling accounts now...' : `Next cycle in ${formatCountdown(rejoinCountdown)}`}
                      </span>
                      <span className="text-gray-500 text-[11px]">
                        ({formatIntervalLabel(rejoinIntervalMinutes)} interval • Farm uptime: {formatUptime(farmUptimeSeconds)})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isCyclingRejoin || accounts.length === 0}
                      onClick={() => triggerPassiveRejoin()}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-all cursor-pointer disabled:opacity-50"
                    >
                      Cycle Now
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('rejoin')}
                      className="text-xs text-accent hover:underline cursor-pointer"
                    >
                      Configure
                    </button>
                  </div>
                </div>
              )}

              {/* Accounts Content Grid / List */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                {filteredAccounts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500">
                    <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-3">
                      <RobloxIcon size={32} className="text-gray-600" />
                    </div>
                    <div className="text-sm font-semibold text-white">No accounts added yet</div>
                    <p className="text-xs text-gray-400 max-w-sm mt-1 mb-4">
                      Add your Roblox accounts using 1-Click Browser Sign-In or .ROBLOSECURITY cookie.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setAddError(null);
                        setAddModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 border border-white/20 text-white hover:bg-white/15 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Add First Account</span>
                    </button>
                  </div>
                ) : (
                  <div className={accountView === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" : "flex flex-col gap-2"}>
                    {filteredAccounts.map(account => (
                      <div
                        key={account.id}
                        className={`p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/15 transition-all group flex flex-col justify-between relative ${
                          activePriorityMenu === account.id ? 'z-40 border-white/20' : 'z-10'
                        }`}
                      >
                        <div>
                          {/* Account Card Header */}
                          <div className="flex items-start justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 overflow-hidden shrink-0 relative flex items-center justify-center">
                                {account.avatarUrl ? (
                                  <img 
                                    src={account.avatarUrl} 
                                    referrerPolicy="no-referrer"
                                    alt={account.username} 
                                    className="w-full h-full object-cover" 
                                  />
                                ) : (
                                  <span className="text-sm font-bold text-accent">{account.username[0]?.toUpperCase()}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-white font-semibold text-xs truncate group-hover:text-accent transition-colors flex items-center gap-1.5">
                                  <span>{account.nickname || account.displayName || account.username}</span>
                                </div>
                                <div className="text-[11px] text-gray-500 truncate">@{account.username}</div>
                              </div>
                            </div>

                            {/* Dropdown Menu Toggle */}
                            <div className="relative account-menu-container shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActivePriorityMenu(activePriorityMenu === account.id ? null : account.id);
                                }}
                                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                              >
                                <MoreVertical size={16} />
                              </button>

                              {/* Action Menu Popup (Neutral Dark Frosted Plexiglass Surface) */}
                              {activePriorityMenu === account.id && (
                                <div 
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 top-7 z-50 w-44 rounded-xl bg-[#090c13]/90 border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl p-1.5 space-y-0.5 text-xs text-gray-200"
                                >
                                  <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Memory & CPU</div>
                                  <button
                                    type="button"
                                    onClick={() => handleTrimRamAccount(account)}
                                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-white/10 hover:text-white flex items-center gap-2 cursor-pointer transition-colors text-xs text-gray-200"
                                  >
                                    <Cpu size={13} className="text-accent" />
                                    <span>Trim Memory</span>
                                  </button>
                                  
                                  <div className="px-2 py-0.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1 border-t border-white/10 pt-1">CPU Priority</div>
                                  {['High', 'AboveNormal', 'Normal', 'BelowNormal'].map(prio => (
                                    <button
                                      key={prio}
                                      type="button"
                                      onClick={() => handleSetPriority(account, prio)}
                                      className="w-full text-left px-2 py-1 rounded-lg hover:bg-white/10 hover:text-white flex items-center justify-between text-xs text-gray-300 transition-colors cursor-pointer"
                                    >
                                      <span>{prio}</span>
                                    </button>
                                  ))}

                                  <div className="h-px bg-white/10 my-0.5" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActivePriorityMenu(null);
                                      setAccounts(prev => prev.filter(a => a.id !== account.id));
                                      addLog('cookie', 'info', `Removed account @${account.username}`);
                                    }}
                                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-red-500/20 text-red-400 flex items-center gap-2 cursor-pointer transition-colors"
                                  >
                                    <Trash2 size={13} />
                                    <span>Remove Account</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Place ID & Autodetect Game Name */}
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                              <span className="font-medium">Place ID</span>
                              {account.target && (
                                <span className="text-accent font-medium truncate max-w-[150px]" title={resolvedGameNames[account.target.trim()] || account.target}>
                                  {resolvedGameNames[account.target.trim()] || 'Autodetecting...'}
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={account.target || ''}
                              onChange={e => {
                                const val = e.target.value;
                                setAccounts(prev => prev.map(a => a.id === account.id ? { ...a, target: val } : a));
                                const cleanPid = val.trim().match(/\d{5,}/)?.[0] || (/^\d+$/.test(val.trim()) ? val.trim() : '');
                                if (cleanPid && !resolvedGameNames[cleanPid] && window.chrome?.webview) {
                                  window.chrome.webview.postMessage(`roblox-resolve-place|${cleanPid}`);
                                }
                              }}
                              placeholder="Place ID (e.g. 9285238704)"
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-black/50 border border-white/5 text-white placeholder-gray-600 focus:outline-none focus:border-accent font-mono"
                            />
                          </div>
                        </div>

                        {/* Card Bottom Actions */}
                        <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                          <button
                            type="button"
                            onClick={() => handleLaunchAccount(account)}
                            className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Play size={12} fill="#fff" />
                            <span>Launch</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(account.cookie);
                              notify({ title: 'Copied', message: 'Cookie copied to clipboard.', kind: 'info', duration: 1500 });
                            }}
                            className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-gray-400 hover:text-white border border-white/5"
                            title="Copy .ROBLOSECURITY cookie"
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────────────
              TAB 2: GROUPS / PACKAGES
          ────────────────────────────────────────────────────────────────── */}
          {activeTab === 'packages' && (
            <div className="h-full flex flex-col min-h-0 gap-4">
              <div className="flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-sm font-semibold text-white">Squad & Alt Groups</h2>
                  <p className="text-xs text-gray-400">Launch or kill multiple accounts together with 1 click.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setGroupName('');
                    setGroupTarget('');
                    setGroupSelectedAccounts([]);
                    setGroupModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  style={{ background: 'var(--accent)', color: '#000' }}
                >
                  <Plus size={14} />
                  <span>Create Group</span>
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
                {groups.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500">
                    <Layers size={32} className="text-gray-600 mb-2" />
                    <div className="text-sm font-semibold text-white">No groups created yet</div>
                    <p className="text-xs text-gray-400 max-w-sm mt-1">Group accounts together for farming squads or trading.</p>
                  </div>
                ) : (
                  groups.map(grp => (
                    <div key={grp.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-4">
                      <div>
                        <div className="text-white font-semibold text-sm flex items-center gap-2">
                          <span>{grp.name}</span>
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-white/10 text-gray-300 font-mono">
                            {grp.accountIds.length} accounts
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Target: <span className="text-gray-200">{grp.target || 'Standard Game'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleLaunchGroup(grp)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 text-white flex items-center gap-1.5 border border-white/10 cursor-pointer"
                        >
                          <Play size={13} fill="#fff" />
                          <span>Launch Group</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setGroups(prev => prev.filter(g => g.id !== grp.id))}
                          className="p-1.5 text-gray-500 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────────────
              TAB 3: CHARTS (Redesigned with Full Click-to-Launch & Smooth Scroll)
          ────────────────────────────────────────────────────────────────── */}
          {activeTab === 'charts' && (
            <div className="h-full flex flex-col min-h-0 gap-3">
              {/* Category Pills & Search */}
              <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/10 text-xs overflow-x-auto max-w-2xl">
                  {[
                    { id: 'popular', label: 'Top Playing Now' },
                    { id: 'topRated', label: 'Top Rated' },
                    { id: 'topEarning', label: 'Top Earning' },
                    { id: 'trending', label: 'Trending' },
                  ].map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setChartCategory(cat.id as any)}
                      className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                        chartCategory === cat.id ? 'bg-white/15 text-white font-semibold shadow-sm' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] text-xs text-white">
                    <Search size={13} className="text-gray-400" />
                    <input
                      type="text"
                      value={chartSearch}
                      onChange={e => setChartSearch(e.target.value)}
                      placeholder="Search Roblox experiences..."
                      className="bg-transparent text-xs outline-none text-white placeholder-gray-500 w-44"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchCharts(chartCategory)}
                    className="p-2 rounded-xl bg-white/[0.03] text-gray-400 hover:text-white border border-white/10 cursor-pointer"
                    title="Refresh Charts"
                  >
                    <RefreshCw size={14} className={chartsLoading ? 'animate-spin text-accent' : ''} />
                  </button>
                </div>
              </div>

              {/* Redesigned Games Grid: 16:9 Widescreen Artwork + Direct Launch & Place ID Copy */}
              <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pr-1.5">
                {filteredChartGames.map((game, idx) => (
                  <div 
                    key={game.placeId}
                    className="group rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-white/25 hover:bg-white/[0.04] transition-all overflow-hidden flex flex-col justify-between shadow-md relative"
                  >
                    {/* 16:9 Widescreen Game Artwork Container */}
                    <div 
                      onClick={() => {
                        setSelectedGame(game);
                        setSelectedLaunchAccountId(accounts[0]?.id || '');
                      }}
                      className="relative w-full aspect-video bg-gradient-to-br from-neutral-800 to-neutral-950 overflow-hidden flex items-center justify-center cursor-pointer"
                    >
                      {/* Ambient Backdrop Blur */}
                      <img 
                        src={game.thumbnail} 
                        referrerPolicy="no-referrer"
                        alt="" 
                        className="absolute inset-0 w-full h-full object-cover blur-md opacity-35 scale-110 pointer-events-none"
                      />

                      {/* Sharp 16:9 Foreground Thumbnail */}
                      <img 
                        src={game.thumbnail} 
                        referrerPolicy="no-referrer"
                        alt={game.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 relative z-10"
                      />

                      {/* Dark Vignette Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent z-20 pointer-events-none" />

                      {/* Rank Standing Badge (Solid dark glass high-contrast opacity for all ranks) */}
                      <div className="absolute top-2 left-2 z-30 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold shadow-md border text-white badge-dark-glass">
                        #{idx + 1}
                      </div>

                      {/* Floating Rating Badge with Modern Vector Icon */}
                      <div className="absolute top-2 right-2 z-30 flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold text-accent shadow-sm badge-dark-glass">
                        <ThumbsUp size={11} className="text-accent shrink-0" />
                        <span>{game.rating}%</span>
                      </div>

                      {/* Hover Play Button Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-25 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-accent text-black flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                          <Play size={16} fill="#000" className="ml-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Card Body & Metadata */}
                    <div className="p-3 flex flex-col justify-between flex-1 gap-2">
                      <div>
                        <div 
                          onClick={() => {
                            setSelectedGame(game);
                            setSelectedLaunchAccountId(accounts[0]?.id || '');
                          }}
                          className="text-white font-bold text-sm line-clamp-1 group-hover:text-accent transition-colors drop-shadow-sm cursor-pointer" 
                          title={game.name}
                        >
                          {game.name}
                        </div>
                        <div className="text-[11px] text-gray-400 truncate mt-0.5">
                          {game.creator && game.creator !== 'Developer' ? game.creator : 'Popular Experience'}
                        </div>
                      </div>

                      {/* Bottom Row: Active Players + Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-gray-300 font-medium">
                        <span className="flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
                          <Users size={12} className="text-gray-400 shrink-0" />
                          <span>{game.playerCount ? game.playerCount.toLocaleString() : '10K+'} Playing</span>
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              navigator.clipboard.writeText(game.placeId);
                              notify({ title: 'Place ID Copied', message: `Copied Place ID ${game.placeId} to clipboard.`, kind: 'info', duration: 2000 });
                            }}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 transition-all cursor-pointer"
                            title={`Copy Place ID: ${game.placeId}`}
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedGame(game);
                              setSelectedLaunchAccountId(accounts[0]?.id || '');
                            }}
                            className="px-3 py-1 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 text-white hover:text-accent border border-white/10 transition-all cursor-pointer whitespace-nowrap shrink-0"
                          >
                            Launch
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────────────
              TAB 4: MIXER (Redesigned Studio-Grade Performance Control Center)
          ────────────────────────────────────────────────────────────────── */}
          {activeTab === 'mixer' && (
            <div className="h-full flex flex-col min-h-0 gap-4 overflow-y-auto pr-1">
              <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div>
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Sliders size={16} className="text-accent" />
                    <span>Roblox Instance Performance & Mixer Hub</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Live hardware optimization, custom FastFlags framerate limiter, graphics fidelity and process audio controls.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTrimRam}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Cpu size={13} className="text-accent" />
                  <span>Trim RAM Cache</span>
                </button>
              </div>

              {/* Quick Preset Cards Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {[
                  {
                    title: 'Competitive FPS',
                    desc: '240 FPS • Low Graphics',
                    action: () => {
                      setFpsCap(240);
                      setFpsUnlimited(false);
                      setGfxLevel(1);
                      setGfxAuto(false);
                      notify({ title: 'Preset Applied', message: 'Competitive 240 FPS / Low Graphics loaded.', kind: 'info', duration: 1800 });
                    }
                  },
                  {
                    title: 'Ultra Cinematic',
                    desc: '144 FPS • Level 21 Graphics',
                    action: () => {
                      setFpsCap(144);
                      setFpsUnlimited(false);
                      setGfxLevel(21);
                      setGfxAuto(false);
                      notify({ title: 'Preset Applied', message: 'Ultra Cinematic Max Fidelity loaded.', kind: 'info', duration: 1800 });
                    }
                  },
                  {
                    title: 'AFK Potato Farm',
                    desc: '30 FPS • Min RAM • Muted',
                    action: () => {
                      setFpsCap(30);
                      setFpsUnlimited(false);
                      setGfxLevel(1);
                      setGfxAuto(false);
                      setMasterVolume(0);
                      notify({ title: 'Preset Applied', message: 'AFK Farm Potato Mode loaded.', kind: 'info', duration: 1800 });
                    }
                  },
                  {
                    title: 'Uncapped Max',
                    desc: 'Unlimited FPS • Auto GFX',
                    action: () => {
                      setFpsUnlimited(true);
                      setGfxAuto(true);
                      notify({ title: 'Preset Applied', message: 'Unlimited Framerate & Auto Graphics loaded.', kind: 'info', duration: 1800 });
                    }
                  }
                ].map(preset => (
                  <button
                    key={preset.title}
                    type="button"
                    onClick={preset.action}
                    className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/20 hover:bg-white/[0.05] transition-all text-left group cursor-pointer"
                  >
                    <div className="text-xs font-bold text-white group-hover:text-accent transition-colors flex items-center justify-between">
                      <span>{preset.title}</span>
                      <Zap size={12} className="text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{preset.desc}</div>
                  </button>
                ))}
              </div>

              {/* Main Controls Grid */}
              <div className="space-y-3.5">
                {/* Graphics Quality Control Card */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-white flex items-center gap-2">
                        <Sliders size={14} className="text-accent" />
                        <span>Rendering Graphics Quality</span>
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {gfxAuto ? 'Automatic GPU scaling based on performance' : gfxLevel <= 3 ? 'Low (Max FPS / Farming)' : gfxLevel >= 18 ? 'Ultra (Cinematic Shaders)' : 'Balanced Fidelity'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-accent font-mono font-bold px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                        {gfxAuto ? 'Auto Mode' : `Level ${gfxLevel} / 21`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setGfxAuto(!gfxAuto)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          gfxAuto ? 'bg-accent text-black border-accent' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                        }`}
                      >
                        Auto
                      </button>
                    </div>
                  </div>

                  <input
                    type="range"
                    min="1"
                    max="21"
                    disabled={gfxAuto}
                    value={gfxLevel}
                    onChange={e => setGfxLevel(parseInt(e.target.value))}
                    className="w-full accent-accent h-2 rounded-lg cursor-pointer bg-white/10 disabled:opacity-30"
                  />
                </div>

                {/* Target Framerate (FPS Cap) Control Card */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-white flex items-center gap-2">
                        <Zap size={14} className="text-accent" />
                        <span>Roblox FPS Cap (Target Framerate)</span>
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {fpsUnlimited ? 'Framerate unlocker active (uncapped maximum refresh rate)' : `Custom FastFlag limit at ${fpsCap} FPS`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-accent font-mono font-bold px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                        {fpsUnlimited ? 'Unlimited' : `${fpsCap} FPS`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFpsUnlimited(!fpsUnlimited)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          fpsUnlimited ? 'bg-accent text-black border-accent' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                        }`}
                      >
                        Unlimited
                      </button>
                    </div>
                  </div>

                  <input
                    type="range"
                    min="30"
                    max="360"
                    step="10"
                    disabled={fpsUnlimited}
                    value={fpsCap}
                    onChange={e => setFpsCap(parseInt(e.target.value))}
                    className="w-full accent-accent h-2 rounded-lg cursor-pointer bg-white/10 disabled:opacity-30"
                  />
                </div>

                {/* Master Audio Volume Control Card */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-white flex items-center gap-2">
                        <Volume2 size={14} className="text-accent" />
                        <span>Master Roblox OS Volume (Live Process Audio)</span>
                      </span>
                      <span className="text-[11px] text-gray-400">
                        Direct CoreAudio session control for all running Roblox windows
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-accent font-mono font-bold px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                        {masterVolume}%
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = masterVolume > 0 ? 0 : 100;
                          setMasterVolume(next);
                          if (window.chrome?.webview) window.chrome.webview.postMessage(`roblox-set-volume|${next}`);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white cursor-pointer"
                      >
                        {masterVolume === 0 ? 'Unmute' : 'Mute'}
                      </button>
                    </div>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={masterVolume}
                    onChange={e => {
                      const val = parseInt(e.target.value);
                      setMasterVolume(val);
                      if (window.chrome?.webview) window.chrome.webview.postMessage(`roblox-set-volume|${val}`);
                    }}
                    className="w-full accent-accent h-2 rounded-lg cursor-pointer bg-white/10"
                  />
                </div>

                {/* Apply Settings Action */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleApplyMixer}
                    className="w-full py-3 rounded-2xl text-xs font-bold text-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
                    style={{ background: 'var(--accent)' }}
                  >
                    <Check size={15} />
                    <span>Save & Apply All Mixer Settings</span>
                  </button>
                </div>
              </div>
            </div>
          )}



          {/* ──────────────────────────────────────────────────────────────────
              TAB 6: TRACKING (Discord Webhook with Connected Accounts & Clean UI)
          ────────────────────────────────────────────────────────────────── */}
          {activeTab === 'tracking' && (
            <div className="h-full flex flex-col min-h-0 gap-4 overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Discord Webhook Tracking</h2>
                  <p className="text-xs text-gray-400">Broadcast automated status and active session info directly to your Discord channel.</p>
                </div>
                {lastWebhookTime && (
                  <div className="text-[11px] text-gray-400 font-mono flex items-center gap-1.5">
                    <Clock size={12} className="text-accent" />
                    <span>Last sent: {lastWebhookTime}</span>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300">Discord Webhook URL</label>
                  <input
                    type="text"
                    value={webhookUrl}
                    onChange={e => {
                      setWebhookUrl(e.target.value);
                      localStorage.setItem('tfy_roblox_webhook', e.target.value);
                    }}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full px-3 py-2 text-xs rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-accent font-mono"
                  />
                </div>

                {/* 15-Minute Auto Broadcast Switch (Theme Colored) */}
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">Automated 15-Minute Broadcast</div>
                    <div className="text-[11px] text-gray-400">
                      Posts active instance counts, anti-AFK timers, and connected accounts (@{accounts.map(a => a.username).join(', ') || 'None'}) to Discord.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !autoBroadcast;
                      setAutoBroadcast(next);
                      if (next && webhookUrl.trim()) {
                        handleSendWebhookTest();
                      }
                    }}
                    className={`w-9 h-5 rounded-full transition-all relative border p-0.5 cursor-pointer ${
                      autoBroadcast ? 'border-transparent' : 'bg-white/10 border-white/15'
                    }`}
                    style={autoBroadcast ? { background: 'var(--accent)' } : undefined}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full transition-transform ${autoBroadcast ? 'translate-x-4 bg-black font-bold' : 'translate-x-0 bg-white'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-gray-400">Includes active account usernames in payload</span>
                  <button
                    type="button"
                    disabled={isSendingWebhook || !webhookUrl.trim()}
                    onClick={handleSendWebhookTest}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                    style={{ background: 'var(--accent)' }}
                  >
                    {isSendingWebhook ? <RefreshCw size={13} className="animate-spin text-black" /> : <Send size={13} />}
                    <span>{isSendingWebhook ? 'Sending...' : 'Send Live Test Ping'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────────────
              TAB: PASSIVE REJOIN (Citrus-Style Interval-Based Mass Reconnection)
          ────────────────────────────────────────────────────────────────── */}
          {activeTab === 'rejoin' && (
            <div className="h-full flex flex-col min-h-0 gap-4 overflow-y-auto pr-1">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Passive Rejoin</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Interval-based mass reconnection engine. Safely cycles all active Roblox accounts to bypass disconnects, 20-minute idle kicks, and maintain 100% farm uptime.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isCyclingRejoin || accounts.length === 0}
                    onClick={() => triggerPassiveRejoin()}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm transition-all"
                    style={{ background: 'var(--accent)' }}
                  >
                    <RefreshCw size={13} className={isCyclingRejoin ? 'animate-spin text-black' : ''} />
                    <span>{isCyclingRejoin ? 'Cycling Farm...' : 'Force Cycle Now'}</span>
                  </button>
                </div>
              </div>

              {/* Bento Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* Card 1: Engine Status */}
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Engine Status</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <div className="text-base font-bold text-white">
                        {isCyclingRejoin ? 'Cycling...' : passiveRejoinEnabled ? 'Active' : 'Disabled'}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {passiveRejoinEnabled ? 'Arm & Auto-Rejoin' : 'Standby Mode'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !passiveRejoinEnabled;
                        setPassiveRejoinEnabled(next);
                        if (next) {
                          setFarmStartTime(Date.now());
                          setRejoinCountdown(rejoinIntervalMinutes * 60);
                        }
                      }}
                      className={`w-9 h-5 rounded-full transition-all relative border p-0.5 cursor-pointer ${
                        passiveRejoinEnabled ? 'border-transparent' : 'bg-white/10 border-white/15'
                      }`}
                      style={passiveRejoinEnabled ? { background: 'var(--accent)' } : undefined}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full transition-transform ${passiveRejoinEnabled ? 'translate-x-4 bg-black font-bold' : 'translate-x-0 bg-white'}`} />
                    </button>
                  </div>
                </div>

                {/* Card 2: Next Rejoin In */}
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="text-xs text-gray-400">Next Rejoin In</div>
                  <div className="text-base font-mono font-bold text-accent mt-1">
                    {isCyclingRejoin ? 'Cycling...' : formatCountdown(rejoinCountdown)}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    Interval: {formatIntervalLabel(rejoinIntervalMinutes)} ({rejoinIntervalMinutes}m)
                  </div>
                </div>

                {/* Card 3: Farm Launch Uptime */}
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>Farm Launch Uptime</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFarmStartTime(Date.now());
                          notify({ title: 'Uptime Reset', message: 'Farm timer restarted at 0s.', kind: 'info', duration: 1500 });
                        }}
                        className="text-[10px] text-gray-400 hover:text-white cursor-pointer hover:underline"
                      >
                        Reset
                      </button>
                    </div>
                    <div className="text-base font-mono font-bold text-white mt-1">
                      {formatUptime(farmUptimeSeconds)}
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    Started: {new Date(farmStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {/* Card 4: Cycles & Targets */}
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="text-xs text-gray-400">Cycles & Targets</div>
                  <div className="text-base font-bold text-white mt-1">
                    {rejoinCycleCount} <span className="text-xs font-normal text-gray-400">cycles</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {accounts.length} queued account(s)
                  </div>
                </div>
              </div>

              {/* Interval Selection Card */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">Rejoin Interval Presets</div>
                    <div className="text-[11px] text-gray-400">Choose how often your farm is cycled and reconnected.</div>
                  </div>
                  <span className="text-xs font-mono text-accent font-semibold">
                    Current: {formatIntervalLabel(rejoinIntervalMinutes)}
                  </span>
                </div>

                <div className="grid gap-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(85px, 1fr))' }}>
                  {REJOIN_INTERVAL_PRESETS.map(preset => {
                    const active = rejoinIntervalMinutes === preset.mins;
                    return (
                      <button
                        key={preset.mins}
                        type="button"
                        onClick={() => {
                          setRejoinIntervalMinutes(preset.mins);
                          setRejoinCountdown(preset.mins * 60);
                          notify({
                            title: 'Interval Updated',
                            message: `Passive Rejoin set to cycle every ${preset.label}.`,
                            kind: 'info',
                            duration: 2000
                          });
                        }}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                          active
                            ? 'border-transparent shadow-sm'
                            : 'bg-black/30 border-white/10 text-gray-300 hover:border-white/20 hover:text-white'
                        }`}
                        style={active ? { background: 'var(--accent)', color: '#000' } : undefined}
                      >
                        <span className={`text-xs font-bold ${active ? 'text-black' : 'text-white'}`}>{preset.label}</span>
                        <span className={`text-[9px] truncate max-w-full ${active ? 'text-black/80 font-medium' : 'text-gray-400'}`}>{preset.desc}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Interval Row */}
                <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-gray-300">Custom Duration (Minutes)</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={10080}
                      value={rejoinIntervalMinutes}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val > 0) {
                          setRejoinIntervalMinutes(val);
                          setRejoinCountdown(val * 60);
                        }
                      }}
                      className="w-24 px-3 py-1.5 text-xs rounded-lg bg-black/40 border border-white/10 text-white font-mono focus:outline-none focus:border-accent"
                    />
                    <span className="text-xs text-gray-400">minutes</span>
                  </div>
                </div>
              </div>

              {/* Relaunch Stagger Selector Card */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">Sequential Launch Stagger Delay</div>
                    <div className="text-[11px] text-gray-400">
                      Pauses between each account launch to avoid Roblox client concurrency locks and IP rate limits.
                    </div>
                  </div>
                  <span className="text-xs font-mono text-accent font-semibold">{rejoinStaggerSeconds}s stagger</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[2, 3, 5, 8, 10, 15].map(secs => {
                    const active = rejoinStaggerSeconds === secs;
                    return (
                      <button
                        key={secs}
                        type="button"
                        onClick={() => {
                          setRejoinStaggerSeconds(secs);
                          notify({ title: 'Stagger Set', message: `Launch delay set to ${secs}s per account.`, kind: 'info', duration: 1500 });
                        }}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                          active
                            ? 'border-transparent shadow-sm'
                            : 'bg-black/30 border-white/10 text-gray-300 hover:border-white/20 hover:text-white'
                        }`}
                        style={active ? { background: 'var(--accent)', color: '#000' } : undefined}
                      >
                        {secs}s {secs === 5 ? '(Default)' : ''}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────────────
              TAB 7: SETTINGS (Standardized Theme Accent Toggle Switches)
          ────────────────────────────────────────────────────────────────── */}
          {activeTab === 'settings' && (
            <div className="h-full flex flex-col min-h-0 gap-4 overflow-y-auto">
              <div>
                <h2 className="text-sm font-semibold text-white">MultiRoblox Settings</h2>
                <p className="text-xs text-gray-400">Launchers, performance, mutex bypass, anti-AFK timers, and data protection.</p>
              </div>

              <div className="space-y-3">
                {/* Launcher Autodetect / Selection Card */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-2">
                        <Gamepad2 size={14} className="text-accent" />
                        <span>Roblox Launcher & Bootstrapper</span>
                      </div>
                      <div className="text-[11px] text-gray-400">Select which launcher executable is used when clicking Launch on any account.</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        window.chrome?.webview?.postMessage('roblox-get-launchers');
                        notify({ title: 'Refreshed', message: 'Scanning for installed bootstrappers...', kind: 'info', duration: 1500 });
                      }}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5 cursor-pointer"
                      title="Rescan launchers"
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>

                  {/* Launcher Options Grid (Auto Detect Removed, Installed Badges Theme Colored) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                    {availableLaunchers.filter(l => l.id !== 'auto').map(l => {
                      const isSelected = selectedLauncher === l.id;
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            setSelectedLauncher(l.id);
                            localStorage.setItem('tfy_roblox_launcher', l.id);
                            addLog('system', 'ok', `Preferred launcher set to: ${l.name}`);
                            notify({ title: 'Launcher Selected', message: `Using ${l.name} for launches.`, kind: 'success', duration: 1800 });
                          }}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                            isSelected
                              ? 'bg-white/10 border-white/25 shadow-sm'
                              : 'bg-white/[0.02] border-white/5 hover:border-white/15 hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-semibold ${isSelected ? 'text-accent' : 'text-white'}`}>
                              {l.name}
                            </span>
                            {isSelected && <Check size={14} className="text-accent shrink-0" />}
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className={l.installed ? 'text-accent font-semibold px-2 py-0.5 rounded-md bg-accent/15 border border-accent/30 text-[10px] flex items-center gap-1' : 'text-gray-500'}>
                              {l.installed ? '● Installed' : '○ Not Detected'}
                            </span>
                            {l.path && l.path !== 'Auto' && (
                              <span className="text-gray-500 truncate max-w-[110px] font-mono text-[9px]" title={l.path}>
                                {l.path.split('\\').pop()}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Multi-Instance Row - Uses Theme Accent */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">Multi-Instance Mutex Bypass</div>
                    <div className="text-[11px] text-gray-400">Allows opening multiple Roblox client windows side-by-side.</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleMulti}
                    className={`w-9 h-5 rounded-full transition-all relative border p-0.5 cursor-pointer ${
                      multiActive ? 'border-transparent' : 'bg-white/10 border-white/15'
                    }`}
                    style={multiActive ? { background: 'var(--accent)' } : undefined}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full transition-transform ${multiActive ? 'translate-x-4 bg-black font-bold' : 'translate-x-0 bg-white'}`} />
                  </button>
                </div>

                {/* Anti-AFK Row - Uses Theme Accent */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">Anti-AFK 20-Min Kick Protection</div>
                    <div className="text-[11px] text-gray-400">Taps a virtual input key to prevent Roblox idle disconnect.</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleAntiAfk}
                    className={`w-9 h-5 rounded-full transition-all relative border p-0.5 cursor-pointer ${
                      antiAfkActive ? 'border-transparent' : 'bg-white/10 border-white/15'
                    }`}
                    style={antiAfkActive ? { background: 'var(--accent)' } : undefined}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full transition-transform ${antiAfkActive ? 'translate-x-4 bg-black font-bold' : 'translate-x-0 bg-white'}`} />
                  </button>
                </div>
                {/* Auto RAM Working Set Optimization Section */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-2">
                        <Cpu size={14} className="text-accent" />
                        <span>Auto RAM Working Set Optimization</span>
                      </div>
                      <div className="text-[11px] text-gray-400">Periodically flushes unused RAM working set from running Roblox processes.</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoTrimEnabled(!autoTrimEnabled)}
                      className={`w-9 h-5 rounded-full transition-all relative border p-0.5 cursor-pointer ${
                        autoTrimEnabled ? 'border-transparent' : 'bg-white/10 border-white/15'
                      }`}
                      style={autoTrimEnabled ? { background: 'var(--accent)' } : undefined}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full transition-transform ${autoTrimEnabled ? 'translate-x-4 bg-black font-bold' : 'translate-x-0 bg-white'}`} />
                    </button>
                  </div>

                  {/* Auto RAM Trim Mode Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    {[
                      {
                        id: 'strong',
                        name: 'Strong (5m)',
                        desc: 'Optimizes memory every 5 minutes.'
                      },
                      {
                        id: 'normal',
                        name: 'Normal (15m)',
                        desc: 'Optimizes memory every 15 minutes.'
                      },
                      {
                        id: 'soft',
                        name: 'Soft (30m)',
                        desc: 'Optimizes memory every 30 minutes.'
                      }
                    ].map(mode => {
                      const isSelected = autoTrimMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          disabled={!autoTrimEnabled}
                          onClick={() => {
                            setAutoTrimMode(mode.id as 'strong' | 'normal' | 'soft');
                            addLog('system', 'ok', `Auto RAM Trim profile set to: ${mode.name}`);
                            notify({ title: 'Profile Updated', message: `RAM optimizer will run ${mode.name.toLowerCase()}.`, kind: 'info', duration: 1800 });
                          }}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                            isSelected && autoTrimEnabled
                              ? 'bg-white/10 border-white/25 shadow-sm'
                              : 'bg-white/[0.02] border-white/5 hover:border-white/15 hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-semibold ${isSelected && autoTrimEnabled ? 'text-accent' : 'text-white'}`}>
                              {mode.name}
                            </span>
                            {isSelected && autoTrimEnabled && <Check size={14} className="text-accent shrink-0" />}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {mode.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────────────
              TAB 8: LOGS
          ────────────────────────────────────────────────────────────────── */}
          {activeTab === 'logs' && (
            <div className="h-full flex flex-col min-h-0 gap-3 font-mono">
              <div className="flex items-center justify-between shrink-0">
                <div className="text-xs text-gray-400">Real-Time Event Logs</div>
                <button type="button" onClick={() => setLogs([])} className="text-xs text-gray-500 hover:text-white cursor-pointer">
                  Clear
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-3 rounded-xl bg-black/60 border border-white/10 text-[11px] space-y-1">
                {logs.length === 0 ? (
                  <div className="text-gray-600">No events logged yet.</div>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className="flex items-start gap-2">
                      <span className="text-gray-500">[{log.time}]</span>
                      <span className={`uppercase font-bold ${
                        log.level === 'ok' ? 'text-emerald-400' :
                        log.level === 'warn' ? 'text-amber-400' :
                        log.level === 'err' ? 'text-red-400' : 'text-cyan-400'
                      }`}>
                        [{log.category}]
                      </span>
                      <span className="text-gray-300">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Game Launch & Details Modal (Redesigned & Harmonious Layout) ── */}
      {selectedGame && (
        <Modal
          isOpen={!!selectedGame}
          onClose={() => setSelectedGame(null)}
          title="Experience Launch Hub"
        >
          <div className="space-y-4">
            {/* Game Artwork Banner with Glass Badges */}
            <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-neutral-800 to-neutral-950 flex items-center justify-center shadow-lg">
              <img 
                src={selectedGame.thumbnail} 
                referrerPolicy="no-referrer"
                alt={selectedGame.name} 
                className="w-full h-full object-cover" 
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
              
              {/* Badges on Banner */}
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-white shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{selectedGame.playerCount ? selectedGame.playerCount.toLocaleString() : '10K+'} Playing</span>
              </div>

              <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-bold text-accent shadow-sm">
                {selectedGame.rating}% 👍
              </div>

              <div className="absolute bottom-2.5 left-3 right-3">
                <div className="text-white font-bold text-base drop-shadow-md truncate">{selectedGame.name}</div>
                <div className="text-xs text-gray-300 drop-shadow truncate">{selectedGame.creator ? `by ${selectedGame.creator}` : 'Roblox Universe'}</div>
              </div>
            </div>

            {/* Place Details Cards Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between">
                <span className="text-[11px] text-gray-400 font-medium">Place Identification</span>
                <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/5">
                  <span className="text-xs font-mono font-bold text-white">{selectedGame.placeId}</span>
                  <button 
                    type="button" 
                    onClick={() => {
                      navigator.clipboard.writeText(selectedGame.placeId);
                      notify({ title: 'Copied', message: 'Place ID copied to clipboard', kind: 'info', duration: 1500 });
                    }} 
                    className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Copy Place ID"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between">
                <span className="text-[11px] text-gray-400 font-medium">Target Compatibility</span>
                <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/5 text-xs">
                  <span className="text-accent font-semibold flex items-center gap-1">
                    <Check size={13} /> Mutex Ready
                  </span>
                  <span className="text-gray-500 font-mono text-[10px]">v6.3.2</span>
                </div>
              </div>
            </div>

            {/* Account Selector Section */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
              <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users size={13} className="text-accent" />
                  <span>Launch with Account</span>
                </span>
                <span className="text-[10px] text-gray-500 font-normal">{accounts.length} Available</span>
              </label>

              {accounts.length === 0 ? (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                  No accounts saved. Please add an account in the Accounts tab first.
                </div>
              ) : (
                <select
                  value={selectedLaunchAccountId}
                  onChange={e => setSelectedLaunchAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-black/60 border border-white/10 text-white focus:outline-none focus:border-accent cursor-pointer"
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id} className="bg-neutral-900 text-white">
                      @{a.username} {a.nickname ? `(${a.nickname})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/5">
              <button 
                type="button" 
                onClick={() => setSelectedGame(null)} 
                className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={accounts.length === 0}
                onClick={() => {
                  const acc = accounts.find(a => a.id === selectedLaunchAccountId) || accounts[0];
                  if (acc) {
                    handleLaunchAccount(acc, selectedGame.placeId);
                    setSelectedGame(null);
                  }
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-black flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50 transition-all hover:opacity-90"
                style={{ background: 'var(--accent)' }}
              >
                <Play size={14} fill="#000" />
                <span>Launch Experience</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Add Account Modal (3 Easy Options: Browser, Credentials, Cookie) ── */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Roblox Account"
      >
        <div className="space-y-4">
          {/* Method Picker */}
          <div className="grid grid-cols-3 gap-2 bg-white/[0.03] p-1 rounded-xl border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setAddMethod('browser')}
              className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                addMethod === 'browser' ? 'bg-white/15 text-white font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Globe size={13} />
              <span>Browser Login</span>
            </button>
            <button
              type="button"
              onClick={() => setAddMethod('creds')}
              className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                addMethod === 'creds' ? 'bg-white/15 text-white font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              <UserCheck size={13} />
              <span>Username/Pass</span>
            </button>
            <button
              type="button"
              onClick={() => setAddMethod('cookie')}
              className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                addMethod === 'cookie' ? 'bg-white/15 text-white font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              <KeyRound size={13} />
              <span>Paste Cookie</span>
            </button>
          </div>

          {/* Option 1: Browser 1-Click Sign-In */}
          {addMethod === 'browser' && (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center space-y-3">
              <Globe size={32} className="text-accent mx-auto" />
              <div>
                <div className="text-sm font-semibold text-white">Sign In with Roblox Window</div>
                <p className="text-xs text-gray-400 max-w-xs mx-auto mt-1">
                  Opens a safe login window. Just sign into your account and TFY will securely connect it automatically!
                </p>
              </div>
              <button
                type="button"
                onClick={handleStartBrowserLogin}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                style={{ background: 'var(--accent)' }}
              >
                <ExternalLink size={14} />
                <span>Open Roblox Sign-In Window</span>
              </button>
            </div>
          )}

          {/* Option 2: Username & Password */}
          {addMethod === 'creds' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300">Roblox Username</label>
                <input
                  type="text"
                  value={addUsername}
                  onChange={e => setAddUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-black/60 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-accent"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300">Roblox Password</label>
                <input
                  type="password"
                  value={addPassword}
                  onChange={e => setAddPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-black/60 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-accent"
                />
              </div>
              <p className="text-[11px] text-gray-400">
                Tip: If your account has 2FA or Captcha enabled, please use <strong>Browser Login</strong> above.
              </p>
              <button
                type="button"
                onClick={handleStartBrowserLogin}
                className="w-full py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white flex items-center justify-center gap-2 border border-white/10 cursor-pointer"
              >
                <Globe size={13} />
                <span>Sign in via Browser Window</span>
              </button>
            </div>
          )}

          {/* Option 3: Direct Cookie */}
          {addMethod === 'cookie' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Paste your <code className="text-accent font-mono">.ROBLOSECURITY</code> cookie below.
              </p>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300">.ROBLOSECURITY Cookie</label>
                <textarea
                  value={addCookie}
                  onChange={e => setAddCookie(e.target.value)}
                  placeholder="_|WARNING:-DO-NOT-SHARE-THIS..."
                  rows={3}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-black/60 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-accent font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300">Nickname / Tag (Optional)</label>
                <input
                  type="text"
                  value={addNickname}
                  onChange={e => setAddNickname(e.target.value)}
                  placeholder="e.g. Main Account, Farm 1, Alt"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-black/60 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isValidatingCookie || !addCookie.trim()}
                  onClick={handleAddCookieSubmit}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-accent text-black flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isValidatingCookie ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                  <span>{isValidatingCookie ? 'Verifying...' : 'Add Account'}</span>
                </button>
              </div>
            </div>
          )}

          {addError && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{addError}</span>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Create Group Modal ── */}
      <Modal
        isOpen={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        title="Create Account Group"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300">Group Name</label>
            <input
              type="text"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="e.g. Farm Squad, Trading Alts"
              className="w-full px-3 py-2 text-xs rounded-lg bg-black/60 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300">Shared Game Target (Place ID / VIP Link)</label>
            <input
              type="text"
              value={groupTarget}
              onChange={e => setGroupTarget(e.target.value)}
              placeholder="e.g. 920587237 or Private Server Link"
              className="w-full px-3 py-2 text-xs rounded-lg bg-black/60 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300">Select Accounts</label>
            <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 rounded-lg bg-black/40 border border-white/5">
              {accounts.map(acc => (
                <label key={acc.id} className="flex items-center gap-2 text-xs text-gray-300 hover:text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupSelectedAccounts.includes(acc.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setGroupSelectedAccounts([...groupSelectedAccounts, acc.id]);
                      } else {
                        setGroupSelectedAccounts(groupSelectedAccounts.filter(id => id !== acc.id));
                      }
                    }}
                  />
                  <span>@{acc.username} {acc.nickname ? `(${acc.nickname})` : ''}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setGroupModalOpen(false)} className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              disabled={!groupName.trim() || groupSelectedAccounts.length === 0}
              onClick={() => {
                const grp: RobloxGroup = {
                  id: Date.now().toString(),
                  name: groupName.trim(),
                  target: groupTarget.trim() || undefined,
                  accountIds: groupSelectedAccounts
                };
                setGroups([...groups, grp]);
                setGroupModalOpen(false);
              }}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-accent text-black disabled:opacity-50 cursor-pointer"
            >
              Save Group
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Terminate Roblox Instance Selector Modal ── */}
      <Modal
        isOpen={killModalOpen}
        onClose={() => setKillModalOpen(false)}
        title={`Active Roblox Instances (${runningPids.length || runningCount})`}
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-400">
            Select a specific process to close or terminate all running Roblox instances simultaneously.
          </p>

          {/* Running Instances List */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {runningPids.length === 0 ? (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs text-gray-400">
                No individual process IDs detected.
              </div>
            ) : (
              runningPids.map((pid, idx) => (
                <div
                  key={pid}
                  className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/15 transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-accent shrink-0">
                      <Gamepad2 size={15} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <span>Roblox Instance #{idx + 1}</span>
                        <span className="text-[10px] text-accent font-mono">PID {pid}</span>
                      </div>
                      <div className="text-[10px] text-gray-500">Active Game Process</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      handleKillSpecificPid(pid);
                      if (runningPids.length <= 1) setKillModalOpen(false);
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Trash2 size={12} />
                    <span>Close PID</span>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Modal Bottom Actions: Kill All and Dismiss */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setKillModalOpen(false)}
              className="px-3.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white cursor-pointer"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => {
                handleKillAll();
                setKillModalOpen(false);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-500 text-white hover:bg-red-600 flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-red-500/20"
            >
              <Power size={13} />
              <span>Terminate All Instances</span>
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
