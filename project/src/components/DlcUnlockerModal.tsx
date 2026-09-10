import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronLeft, X, PackageCheck, Check, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { t, type TfyLanguage } from '../lib/i18n';

export interface DlcUnlockerGame {
  Platform: string;
  Id: string;
  Name: string;
  Path: string;
  HasUnlocker: boolean;
}

interface DlcItem {
  id: string;
  name: string;
}

interface DlcUnlockerModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: TfyLanguage;
}

const dlcUnlockerStyles = `
@keyframes dlcFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes dlcFadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}
@keyframes dlcSlideIn {
  from { opacity: 0; transform: translate3d(0, 15px, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}
@keyframes dlcSlideOut {
  from { opacity: 1; transform: translate3d(0, 0, 0); }
  to { opacity: 0; transform: translate3d(0, 10px, 0); }
}
@keyframes dlcFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
@keyframes dlcPulseRing {
  0% { transform: scale(1); opacity: 0.4; }
  50% { transform: scale(1.15); opacity: 0; }
  100% { transform: scale(1); opacity: 0; }
}
@keyframes dlcGlowLine {
  0% { opacity: 0.5; }
  50% { opacity: 1; }
  100% { opacity: 0.5; }
}

.dlc-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: dlcFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.dlc-overlay.closing {
  animation: dlcFadeOut 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.dlc-card {
  position: relative;
  width: 660px;
  max-width: calc(100% - 40px);
  height: 600px;
  max-height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  background: radial-gradient(circle at 10% 10%, color-mix(in srgb, var(--accent) 12%, transparent) 0%, transparent 55%), linear-gradient(135deg, rgba(20, 22, 33, 0.4) 0%, rgba(10, 11, 18, 0.55) 100%) !important;
  backdrop-filter: blur(40px) saturate(160%);
  -webkit-backdrop-filter: blur(40px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 32px 80px rgba(0, 0, 0, 0.6),
    0 0 0 1px rgba(255, 255, 255, 0.03) inset,
    0 0 35px -5px color-mix(in srgb, var(--accent) 25%, transparent),
    0 0 4px 0px color-mix(in srgb, var(--accent) 30%, transparent);
  animation: dlcSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  overflow: hidden;
  will-change: transform, opacity;
  transform: translate3d(0, 0, 0);
}
.dlc-card.closing {
  animation: dlcSlideOut 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.dlc-glow-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1.5px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  animation: dlcGlowLine 3s ease-in-out infinite;
  z-index: 10;
}
.dlc-header {
  padding: 22px 24px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  shrink-0;
}
.dlc-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.dlc-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 19px;
  font-weight: 700;
  color: #fff;
  font-family: var(--font-display, sans-serif);
}
.dlc-title-badge {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 18%, transparent), color-mix(in srgb, var(--accent) 6%, transparent));
  border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
  color: var(--accent);
  animation: dlcFloat 3s ease-in-out infinite;
}
.dlc-title-badge::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 10%, transparent);
  animation: dlcPulseRing 3s ease-in-out infinite;
}
.dlc-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.35);
  cursor: pointer;
  transition: all 0.25s ease-out;
}
.dlc-close:hover {
  background: rgba(255, 60, 60, 0.1);
  border-color: rgba(255, 60, 60, 0.2);
  color: #ff6b6b;
  transform: rotate(90deg) scale(1.05);
}
.dlc-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.dlc-content,
.dlc-scrollable {
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--accent) 30%, rgba(255, 255, 255, 0.05)) transparent;
}
.dlc-content::-webkit-scrollbar,
.dlc-scrollable::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
.dlc-content::-webkit-scrollbar-track,
.dlc-scrollable::-webkit-scrollbar-track {
  background: transparent;
}
.dlc-content::-webkit-scrollbar-thumb,
.dlc-scrollable::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--accent) 30%, rgba(255, 255, 255, 0.05));
  border-radius: 99px;
}
.dlc-content::-webkit-scrollbar-thumb:hover,
.dlc-scrollable::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--accent) 60%, rgba(255, 255, 255, 0.15));
}
.dlc-search-container {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
}
.dlc-search-icon {
  position: absolute;
  left: 14px;
  color: rgba(255, 255, 255, 0.25);
  pointer-events: none;
}
.dlc-search-input {
  width: 100%;
  height: 38px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 0 14px 0 38px;
  color: #fff;
  font-size: 13px;
  transition: all 0.25s ease-out;
}
.dlc-search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 10px -2px color-mix(in srgb, var(--accent) 35%, transparent);
  background: rgba(0, 0, 0, 0.35);
}
.dlc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 38px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s ease-out;
  border: 1px solid transparent;
}
.dlc-btn-primary {
  background: var(--accent);
  color: #fff;
}
.dlc-btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px -4px color-mix(in srgb, var(--accent) 45%, transparent);
}
.dlc-btn-primary:active:not(:disabled) {
  transform: translateY(0);
}
.dlc-btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.dlc-btn-ghost {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.7);
}
.dlc-btn-ghost:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}
.dlc-btn-ghost:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.dlc-games-list-grid {
  display: grid;
  grid-template-cols: repeat(2, 1fr);
  gap: 12px;
  padding: 20px 24px;
}
@media (max-width: 580px) {
  .dlc-games-list-grid {
    grid-template-cols: 1fr;
  }
}
.dlc-game-item-card {
  position: relative;
  height: 96px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.25);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 16px;
}
.dlc-game-item-card:hover {
  border-color: var(--accent);
  box-shadow: 0 10px 24px -10px color-mix(in srgb, var(--accent) 30%, transparent);
  transform: translateY(-2px);
}
.dlc-game-item-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0,0,0,0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  z-index: 2;
}
.dlc-game-item-subtitle {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  margin-top: 2px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 2;
}
.dlc-game-item-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  opacity: 0.18;
  transition: opacity 0.3s ease;
  z-index: 0;
}
.dlc-game-item-card:hover .dlc-game-item-bg {
  opacity: 0.3;
}
.dlc-game-item-grad {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(10,11,18,0.9) 0%, rgba(10,11,18,0.2) 100%);
  z-index: 1;
}
.dlc-status-pill {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  font-size: 9px;
  font-weight: 700;
  padding: 2.5px 7px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: 4px;
}
.dlc-status-pill.installed {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  color: var(--accent);
}
.dlc-status-pill.not-installed {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.4);
}
.dlc-dot {
  width: 5px;
  height: 5px;
  border-radius: 99px;
}
.dlc-dot.active {
  background-color: var(--accent);
  box-shadow: 0 0 6px var(--accent);
}
.dlc-dot.inactive {
  background-color: rgba(255,255,255,0.25);
}
.dlc-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(0, 0, 0, 0.15);
  shrink-0;
}
.dlc-ach-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(255,255,255,0.01);
  border: 1px solid rgba(255,255,255,0.04);
  cursor: pointer;
  transition: all 0.2s ease-out;
}
.dlc-ach-item:hover {
  background: rgba(var(--accent-rgb), 0.04);
  border-color: rgba(var(--accent-rgb), 0.25);
}
.dlc-checkbox {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1.5px solid rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  color: #fff;
}
.dlc-ach-item.checked .dlc-checkbox {
  border-color: var(--accent);
  background: var(--accent);
}
`;

const getGameBannerUrl = (game: DlcUnlockerGame | null) => {
  if (!game) return '';
  if (game.Platform === 'Steam' && /^\d+$/.test(game.Id)) {
    return `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.Id}/header.jpg`;
  }
  const nameLower = game.Name.toLowerCase();
  const steamMapping: Record<string, string> = {
    'counter-strike 2': '730',
    'cs2': '730',
    'grand theft auto v': '271590',
    'gta v': '271590',
    'gta 5': '271590',
    'gtav': '271590',
    'cyberpunk 2077': '1091500',
    'witcher 3': '292030',
    'the witcher 3': '292030',
    'the witcher 3: wild hunt': '292030',
    'dead by daylight': '381210',
    'dbd': '381210',
    'payday 2': '218620',
    'payday 3': '1272080',
    'hogwarts legacy': '990080',
    'elden ring': '1245620',
    'red dead redemption 2': '1174180',
    'rdr2': '1174180',
    'borderlands 3': '397540',
    'civilization vi': '289070',
    'civilization 6': '289070',
    'dying light': '239140',
    'dying light 2': '534380',
    'death stranding': '1190460',
    'control': '870780',
    'metro exodus': '413150',
    'star wars jedi: fallen order': '1172380',
    'star wars jedi fallen order': '1172380',
    'star wars jedi: survivor': '1774580',
    'it takes two': '1426210',
    'alan wake 2': 'custom-aw2',
    'fortnite': 'custom-fortnite',
    'fall guys': '1097150',
    'rocket league': '252950',
    'the sims 4': '1222670',
    'sims 4': '1222670',
    'among us': '945360',
  };
  for (const [key, appId] of Object.entries(steamMapping)) {
    if (nameLower.includes(key)) {
      if (appId === 'custom-aw2') {
        return 'https://cdn2.unrealengine.com/aw2-keyart-clean-3840x2160-3840x2160-c44d18ec06f0.jpg';
      }
      if (appId === 'custom-fortnite') {
        return 'https://cdn2.unrealengine.com/fortnite-battle-royale-v29-00-header-1920x1080-87a32c6686e0.jpg';
      }
      return `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
    }
  }
  return '';
};

export const DlcUnlockerModal = React.memo(function DlcUnlockerModal({
  isOpen,
  onClose,
  language
}: DlcUnlockerModalProps) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  // States
  const [games, setGames] = useState<DlcUnlockerGame[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState<DlcUnlockerGame | null>(null);
  
  const [dlcs, setDlcs] = useState<DlcItem[]>([]);
  const [loadingDlcs, setLoadingDlcs] = useState(false);
  const [dlcSearch, setDlcSearch] = useState('');
  const [selectedDlcs, setSelectedDlcs] = useState<Set<string>>(new Set());
  const [proxy, setProxy] = useState(false);
  const [operationMsg, setOperationMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [installing, setInstalling] = useState(false);

  const isRo = language === 'ro';
  const listRef = useRef<HTMLDivElement>(null);
  const selectedGameRef = useRef(selectedGame);
  selectedGameRef.current = selectedGame;

  // Handle animations and initial scan
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setClosing(false);
      setLoadingGames(true);
      if (window.chrome?.webview) {
        window.chrome.webview.postMessage('dlcunlocker-scan');
      } else {
        // Dev Mock
        setTimeout(() => {
          setGames([
            { Platform: 'Steam', Id: '730', Name: 'Counter-Strike 2', Path: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive', HasUnlocker: false },
            { Platform: 'Steam', Id: '1607680', Name: 'Bread & Fred', Path: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Bread & Fred', HasUnlocker: true },
            { Platform: 'Epic', Id: 'Fortnite', Name: 'Fortnite', Path: 'C:\\Program Files\\Epic Games\\Fortnite', HasUnlocker: false },
            { Platform: 'Epic', Id: 'Sugar', Name: 'Grand Theft Auto V', Path: 'C:\\Program Files\\Epic Games\\GTAV', HasUnlocker: true }
          ]);
          setLoadingGames(false);
        }, 800);
      }
    } else if (visible) {
      setClosing(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setClosing(false);
        setSelectedGame(null);
        setDlcs([]);
        setOperationMsg(null);
        setDlcSearch('');
        setSearchQuery('');
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // IPC Message Listener
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent<{
        type: string; action?: string;
        data?: { games?: DlcUnlockerGame[]; path?: string; appId?: string; dlcs?: DlcItem[]; error?: string; ok?: boolean; message?: string; };
      }>).detail;
      
      if (msg?.type !== 'dlcunlocker') return;

      if (msg.action === 'scan') {
        setLoadingGames(false);
        if (msg.data?.games) {
          setGames(msg.data.games.filter(g => String(g.Id) !== '228980'));
        }
      }

      if (msg.action === 'dlclist') {
        setLoadingDlcs(false);
        const cur = selectedGameRef.current;
        if (cur && cur.Id === msg.data?.appId) {
          if (msg.data.error) {
            setOperationMsg({ ok: false, text: msg.data.error });
          } else if (msg.data.dlcs) {
            setDlcs(msg.data.dlcs);
          }
        }
      }

      if (msg.action === 'install' || msg.action === 'uninstall') {
        setInstalling(false);
        const isInstall = msg.action === 'install';
        const ok = msg.data?.ok ?? false;
        const respText = msg.data?.message || (ok ? (isInstall ? (isRo ? 'Instalat cu succes!' : 'Successfully installed!') : (isRo ? 'Dezinstalat cu succes!' : 'Successfully uninstalled!')) : (isRo ? 'Eroare la operare.' : 'Operation failed.'));
        
        setOperationMsg({ ok, text: respText });

        if (ok && msg.data?.path) {
          setGames(prev => prev.map(g => g.Path === msg.data?.path ? { ...g, HasUnlocker: isInstall } : g));
          setSelectedGame(prev => prev && prev.Path === msg.data?.path ? { ...prev, HasUnlocker: isInstall } : prev);
        }
      }
    };

    window.addEventListener('tfy-dlcunlocker', handler);
    return () => window.removeEventListener('tfy-dlcunlocker', handler);
  }, [isRo]);

  const handleScan = () => {
    if (window.chrome?.webview) {
      setLoadingGames(true);
      window.chrome.webview.postMessage('dlcunlocker-scan');
    }
  };

  const handleClose = () => {
    if (installing) return;
    onClose();
  };

  const selectGame = (game: DlcUnlockerGame) => {
    setSelectedGame(game);
    setOperationMsg(null);
    setDlcSearch('');
    setSelectedDlcs(new Set());
    setProxy(false);

    if (game.Platform === 'Steam') {
      setLoadingDlcs(true);
      if (window.chrome?.webview) {
        window.chrome.webview.postMessage(`dlcunlocker-getdlcs|${game.Id}`);
      } else {
        // Dev Mock
        setTimeout(() => {
          setDlcs([
            { id: '1607681', name: 'Bread & Fred - Original Soundtrack' },
            { id: '1607682', name: 'Bread & Fred - Golden Fred skin' },
            { id: '1607683', name: 'Bread & Fred - Level Editor pack' }
          ]);
          setLoadingDlcs(false);
        }, 800);
      }
    }
  };

  const handleDlcInstall = () => {
    if (!selectedGame) return;
    setInstalling(true);
    setOperationMsg(null);

    const payload = {
      path: selectedGame.Path,
      platform: selectedGame.Platform,
      id: selectedGame.Id,
      selectedDlcIds: selectedGame.Platform === 'Steam' ? Array.from(selectedDlcs) : [],
      proxy: selectedGame.Platform === 'Steam' ? proxy : false
    };

    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(`dlcunlocker-install|${JSON.stringify(payload)}`);
    } else {
      setTimeout(() => {
        setInstalling(false);
        setOperationMsg({ ok: true, text: isRo ? 'DLC Unlocker a fost instalat!' : 'DLC Unlocker installed successfully!' });
        setGames(prev => prev.map(g => g.Path === selectedGame.Path ? { ...g, HasUnlocker: true } : g));
        setSelectedGame(prev => prev ? { ...prev, HasUnlocker: true } : null);
      }, 1000);
    }
  };

  const handleDlcUninstall = () => {
    if (!selectedGame) return;
    setInstalling(true);
    setOperationMsg(null);

    const payload = {
      path: selectedGame.Path,
      platform: selectedGame.Platform
    };

    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(`dlcunlocker-uninstall|${JSON.stringify(payload)}`);
    } else {
      setTimeout(() => {
        setInstalling(false);
        setOperationMsg({ ok: true, text: isRo ? 'DLC Unlocker a fost dezinstalat!' : 'DLC Unlocker uninstalled successfully!' });
        setGames(prev => prev.map(g => g.Path === selectedGame.Path ? { ...g, HasUnlocker: false } : g));
        setSelectedGame(prev => prev ? { ...prev, HasUnlocker: false } : null);
      }, 1000);
    }
  };

  const toggleDlc = (id: string) => {
    setSelectedDlcs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const filtered = dlcs.filter(d =>
      d.name.toLowerCase().includes(dlcSearch.toLowerCase()) ||
      d.id.toLowerCase().includes(dlcSearch.toLowerCase())
    );
    if (filtered.length === 0) return;
    const allSelected = filtered.every(d => selectedDlcs.has(d.id));
    
    setSelectedDlcs(prev => {
      const next = new Set(prev);
      if (allSelected) {
        filtered.forEach(d => next.delete(d.id));
      } else {
        filtered.forEach(d => next.add(d.id));
      }
      return next;
    });
  };

  // Filters
  const filteredGames = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return games;
    return games.filter(g =>
      (g.Name || '').toLowerCase().includes(q) ||
      String(g.Id || '').includes(q) ||
      (g.Platform || '').toLowerCase().includes(q)
    );
  }, [games, searchQuery]);

  const filteredDlcs = useMemo(() => {
    const q = dlcSearch.toLowerCase().trim();
    if (!q) return dlcs;
    return dlcs.filter(d => d.name.toLowerCase().includes(q) || d.id.includes(q));
  }, [dlcs, dlcSearch]);

  if (!visible && !isOpen) return null;

  return createPortal(
    <>
      <style>{dlcUnlockerStyles}</style>
      <div className={`dlc-overlay ${closing ? 'closing' : ''}`} onClick={handleClose}>
        <div className={`dlc-card ${closing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
          <div className="dlc-glow-line" />

          {/* Header */}
          <div className="dlc-header">
            <div className="dlc-title-row">
              {selectedGame && (
                <button
                  onClick={() => setSelectedGame(null)}
                  className="mr-2 p-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <div className="dlc-title">
                <div className="dlc-title-badge">
                  <PackageCheck size={18} />
                </div>
                {selectedGame ? selectedGame.Name : 'DLC Unlocker'}
              </div>
            </div>

            <button className="dlc-close" onClick={handleClose}>
              <X size={15} />
            </button>
          </div>

          {/* Content */}
          <div className="dlc-content" ref={listRef}>
            {!selectedGame ? (
              // ── GAME SELECTOR VIEW ──
              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-5 pb-2 flex items-center gap-3 border-b border-white/[0.03] shrink-0">
                  <div className="dlc-search-container">
                    <Search size={14} className="dlc-search-icon" />
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={isRo ? 'Caută jocuri instalate...' : 'Search installed games...'}
                      className="dlc-search-input"
                    />
                  </div>
                  <button onClick={handleScan} disabled={loadingGames} className="dlc-btn dlc-btn-ghost shrink-0">
                    {loadingGames ? <Loader2 size={14} className="animate-spin text-accent" /> : null}
                    {isRo ? 'Scanează' : 'Scan'}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 dlc-scrollable">
                  {loadingGames ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400">
                      <Loader2 size={24} className="animate-spin text-accent" />
                      <span className="text-xs font-medium">{isRo ? 'Se caută jocurile instalate...' : 'Scanning installed games...'}</span>
                    </div>
                  ) : filteredGames.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-500">
                      <PackageCheck size={28} className="opacity-40" />
                      <span className="text-xs font-semibold">{isRo ? 'Nu am găsit niciun joc suportat.' : 'No supported games found.'}</span>
                    </div>
                  ) : (
                    <div className="dlc-games-list-grid">
                      {filteredGames.map(g => (
                        <div key={`${g.Platform}-${g.Id}-${g.Path}`} className="dlc-game-item-card" onClick={() => selectGame(g)}>
                          <div className="dlc-game-item-bg" style={{ backgroundImage: `url(${getGameBannerUrl(g)})` }} />
                          <div className="dlc-game-item-grad" />
                          <span className={`dlc-status-pill ${g.HasUnlocker ? 'installed' : 'not-installed'}`}>
                            <span className={`dlc-dot ${g.HasUnlocker ? 'active' : 'inactive'}`} />
                            {g.HasUnlocker ? (isRo ? 'Activat' : 'Active') : 'N/A'}
                          </span>
                          <div className="dlc-game-item-title">{g.Name}</div>
                          <div className="dlc-game-item-subtitle">{g.Platform} • ID: {g.Id}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // ── GAME DETAILS / INSTALL VIEW ──
              <div className="flex-1 flex flex-col min-h-0">
                <div className="relative h-28 shrink-0 overflow-hidden border-b border-white/5 flex flex-col justify-end p-4">
                  <div className="absolute inset-0 bg-cover bg-center filter blur-[1px] brightness-[0.4]" style={{ backgroundImage: `url(${getGameBannerUrl(selectedGame)})` }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d17] via-transparent to-transparent" />
                  <div className="relative z-10 flex items-end justify-between gap-4">
                    <div>
                      <div className="font-bold text-lg text-white leading-tight drop-shadow-md">{selectedGame.Name}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5 drop-shadow-md">{selectedGame.Platform} • ID: {selectedGame.Id}</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto dlc-scrollable" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {selectedGame.Platform === 'Steam' && (
                    <>
                      {/* Proxy toggle */}
                      <button type="checkbox" role="checkbox" aria-checked={proxy}
                        onClick={() => setProxy(!proxy)}
                        className="flex items-center gap-4 w-full text-left rounded-2xl px-5 py-4 transition-all duration-300"
                        style={{
                          background: proxy
                            ? 'color-mix(in srgb, var(--accent) 8%, rgba(255,255,255,0.02))'
                            : 'rgba(255,255,255,0.01)',
                          border: `1px solid ${proxy ? 'color-mix(in srgb, var(--accent) 35%, transparent)' : 'rgba(255,255,255,0.06)'}`,
                          boxShadow: proxy ? '0 4px 18px rgba(0, 0, 0, 0.2)' : 'none'
                        }}>
                        <span className="w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all duration-300"
                            style={{ borderColor: proxy ? 'var(--accent)' : 'rgba(255,255,255,0.2)', background: proxy ? 'var(--accent)' : 'transparent' }}>
                            {proxy && <Check size={11} className="text-white" strokeWidth={3} />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white">{isRo ? 'Instalare Proxy' : 'Proxy Mode'}</div>
                          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                            {isRo ? 'Înlocuiește direct fișierele jocului fără a folosi un launcher adițional.' : 'Modifies game files directly without requiring a helper launcher.'}
                          </div>
                        </div>
                      </button>

                      {/* DLC list container */}
                      {loadingDlcs ? (
                        <div className="flex flex-col items-center gap-3 py-10 text-gray-400">
                          <Loader2 size={24} className="animate-spin text-accent" />
                          <span className="text-sm font-medium">{isRo ? 'Se încarcă lista de DLC-uri...' : 'Fetching DLC list...'}</span>
                        </div>
                      ) : dlcs.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-8 text-center text-white/30 text-sm">
                          <AlertCircle size={20} className="opacity-40" />
                          {isRo ? 'Nu am găsit DLC-uri disponibile pentru acest joc.' : 'No DLCs found for this game.'}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase tracking-widest text-accent">DLCs</span>
                              <span className="text-xs rounded-full px-2 py-0.5 font-semibold"
                                    style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
                                {selectedDlcs.size} / {dlcs.length}
                              </span>
                            </div>
                            <button type="button" onClick={toggleSelectAll}
                              className="text-xs px-3 py-1 rounded-xl transition-all duration-300 font-semibold border"
                              style={{ color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--accent) 25%, transparent)' }}>
                              {filteredDlcs.length > 0 && filteredDlcs.every(d => selectedDlcs.has(d.id))
                                ? (isRo ? 'Deselectează tot' : 'Deselect All')
                                : (isRo ? 'Selectează tot' : 'Select All')}
                            </button>
                          </div>

                          {/* Search DLCs */}
                          <div className="relative flex items-center">
                            <Search size={14} className="absolute left-3 text-white/30" />
                            <input
                              type="text"
                              value={dlcSearch}
                              onChange={e => setDlcSearch(e.target.value)}
                              placeholder={isRo ? 'Caută DLC-uri...' : 'Search DLCs...'}
                              className="w-full text-xs bg-black/30 border border-white/[0.06] rounded-xl pl-9 pr-9 py-2 text-white focus:outline-none focus:border-[var(--accent)]"
                            />
                            {dlcSearch && (
                              <button type="button" onClick={() => setDlcSearch('')} className="absolute right-3 text-white/40 hover:text-white">
                                <X size={12} />
                              </button>
                            )}
                          </div>

                          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0, 0, 0, 0.1)' }}>
                            <ul className="max-h-[220px] overflow-y-auto divide-y divide-white/[0.04] dlc-scrollable">
                              {filteredDlcs.map((d, idx) => {
                                const checked = selectedDlcs.has(d.id);
                                return (
                                  <li key={d.id} onClick={() => toggleDlc(d.id)}
                                      className="flex items-center gap-4 px-4 py-3 cursor-pointer transition-all duration-200 select-none"
                                      style={{ background: checked ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent' }}
                                      onMouseEnter={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = checked ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent'; }}>
                                    <span className="w-4 h-4 rounded-md flex items-center justify-center shrink-0 transition-all duration-300"
                                          style={{ border: `1px solid ${checked ? 'var(--accent)' : 'rgba(255,255,255,0.2)'}`, background: checked ? 'var(--accent)' : 'transparent' }}>
                                      {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                                    </span>
                                    <span className="text-xs w-6 shrink-0 text-right font-mono text-white/20">{idx + 1}</span>
                                    <span className="text-sm flex-1 min-w-0 truncate font-medium" style={{ color: checked ? 'white' : 'rgba(255,255,255,0.6)' }}>{d.name}</span>
                                    <span className="text-xs shrink-0 px-2 py-0.5 rounded font-mono text-white/30" style={{ background: 'rgba(255,255,255,0.03)' }}>{d.id}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {selectedGame.Platform !== 'Steam' && (
                    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                      <PackageCheck size={36} className="text-accent/60 mb-3" />
                      <div className="text-sm font-semibold text-white mb-1">
                        {isRo ? 'Instalare automată pentru Epic Games' : 'Automatic Installation for Epic Games'}
                      </div>
                      <div className="text-xs text-gray-400 max-w-sm">
                        {isRo 
                          ? 'Deblocarea DLC-urilor pentru Epic Games se aplică global. Dă click pe Instalează pentru a aplica patch-ul automat în folderul jocului.' 
                          : 'DLC unlocking for Epic Games is handled automatically. Click install to apply the patch files directly to the game directory.'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="dlc-footer">
            <div>
              {operationMsg && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold backdrop-blur-md animate-fadeIn"
                     style={{
                       background: operationMsg.ok ? 'color-mix(in srgb, var(--accent) 8%, rgba(255,255,255,0.02))' : 'rgba(239, 68, 68, 0.08)',
                       borderColor: operationMsg.ok ? 'color-mix(in srgb, var(--accent) 30%, rgba(255,255,255,0.06))' : 'rgba(239, 68, 68, 0.25)',
                       color: operationMsg.ok ? 'var(--accent)' : '#f87171',
                       boxShadow: operationMsg.ok ? '0 0 14px -3px color-mix(in srgb, var(--accent) 30%, transparent)' : 'none'
                     }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: operationMsg.ok ? 'var(--accent)' : '#ef4444', boxShadow: operationMsg.ok ? '0 0 6px var(--accent)' : 'none' }} />
                  <span className="truncate max-w-[280px]">{operationMsg.text}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button className="dlc-btn dlc-btn-ghost" onClick={handleClose} disabled={installing}>
                {isRo ? 'Închide' : 'Close'}
              </button>
              {selectedGame && (
                <>
                  {selectedGame.HasUnlocker ? (
                    <button className="dlc-btn dlc-btn-primary !border-red-500/20 !bg-red-500/10 !text-red-400 hover:!bg-red-500/20"
                            onClick={handleDlcUninstall} disabled={installing}>
                      {installing ? <Loader2 size={13} className="animate-spin" /> : null}
                      {isRo ? 'Dezinstalează Unlocker' : 'Uninstall Unlocker'}
                    </button>
                  ) : (
                    <button className="dlc-btn dlc-btn-primary" onClick={handleDlcInstall} disabled={installing || (selectedGame.Platform === 'Steam' && dlcs.length > 0 && selectedDlcs.size === 0)}>
                      {installing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      {isRo ? 'Instalează Unlocker' : 'Install Unlocker'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
});
