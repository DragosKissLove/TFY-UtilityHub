import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronLeft, X, Trophy, Sparkles, Check, Loader2, ArrowUpRight, Lock, Unlock } from 'lucide-react';
import { t, type TfyLanguage } from '../lib/i18n';

interface SteamGame {
  appid: string;
  name: string;
  icon: string;
}

interface Achievement {
  id: string;
  name: string;
  desc: string;
  unlocked: boolean;
  unlockTime: number;
  hidden: boolean;
  icon: string | null;
}

interface SteamUnlockerModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: TfyLanguage;
}

const steamUnlockerStyles = `
@keyframes suFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes suFadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}
@keyframes suSlideIn {
  from { opacity: 0; transform: translate3d(0, 15px, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}
@keyframes suSlideOut {
  from { opacity: 1; transform: translate3d(0, 0, 0); }
  to { opacity: 0; transform: translate3d(0, 10px, 0); }
}
@keyframes suPulseRing {
  0% { transform: scale(1); opacity: 0.4; }
  50% { transform: scale(1.15); opacity: 0; }
  100% { transform: scale(1); opacity: 0; }
}
@keyframes suFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
@keyframes suGlowLine {
  0% { opacity: 0.5; }
  50% { opacity: 1; }
  100% { opacity: 0.5; }
}
.su-overlay {
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
  animation: suFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.su-overlay.closing {
  animation: suFadeOut 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.su-card {
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
  animation: suSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  overflow: hidden;
  will-change: transform, opacity;
  transform: translate3d(0, 0, 0);
}
.su-card.closing {
  animation: suSlideOut 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.su-glow-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1.5px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  animation: suGlowLine 3s ease-in-out infinite;
  z-index: 10;
}
.su-header {
  padding: 22px 24px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  shrink-0;
}
.su-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.su-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 19px;
  font-weight: 700;
  color: #fff;
  font-family: var(--font-display, sans-serif);
}
.su-title-badge {
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
  animation: suFloat 3s ease-in-out infinite;
}
.su-title-badge::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 10%, transparent);
  animation: suPulseRing 3s ease-in-out infinite;
}
.su-close {
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
.su-close:hover {
  background: rgba(255, 60, 60, 0.1);
  border-color: rgba(255, 60, 60, 0.2);
  color: #ff6b6b;
  transform: rotate(90deg) scale(1.05);
}
.su-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.su-content,
.su-scrollable {
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--accent) 30%, rgba(255, 255, 255, 0.05)) transparent;
}
.su-content::-webkit-scrollbar,
.su-scrollable::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
.su-content::-webkit-scrollbar-track,
.su-scrollable::-webkit-scrollbar-track {
  background: transparent;
}
.su-content::-webkit-scrollbar-thumb,
.su-scrollable::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--accent) 30%, rgba(255, 255, 255, 0.05));
  border-radius: 99px;
}
.su-content::-webkit-scrollbar-thumb:hover,
.su-scrollable::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--accent) 60%, rgba(255, 255, 255, 0.15));
}
.su-games-grid {
  display: grid;
  grid-template-cols: repeat(2, 1fr);
  gap: 12px;
  padding: 20px 24px;
}
@media (max-width: 580px) {
  .su-games-grid {
    grid-template-cols: 1fr;
  }
}
.su-game-card {
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
  padding: 12px;
  text-left;
}
.su-game-card:hover {
  border-color: var(--accent);
  box-shadow: 0 0 15px -3px color-mix(in srgb, var(--accent) 40%, transparent);
  transform: translateY(-2px);
}
.su-game-card-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  opacity: 0.65;
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s;
}
.su-game-card:hover .su-game-card-bg {
  transform: scale(1.04);
  opacity: 0.85;
}
.su-game-card-grad {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(5,6,10,0.9) 0%, rgba(5,6,10,0.4) 65%, transparent 100%);
  pointer-events: none;
}
.su-game-card-title {
  position: relative;
  z-index: 2;
  font-weight: 700;
  color: #fff;
  font-size: 13px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.su-game-card-appid {
  position: relative;
  z-index: 2;
  font-size: 10px;
  color: color-mix(in srgb, var(--accent) 70%, #a1a1aa);
  margin-top: 2px;
  text-shadow: 0 1px 3px rgba(0,0,0,0.6);
}
.su-ach-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid rgba(255, 255, 255, 0.03);
  transition: all 0.2s;
  cursor: pointer;
  user-select: none;
}
.su-ach-item:hover {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.06);
}
.su-ach-item.checked {
  background: linear-gradient(90deg, rgba(74,222,128,0.03) 0%, rgba(255,255,255,0.01) 100%);
  border-color: rgba(74, 222, 128, 0.15);
}
.su-ach-item.checked:hover {
  border-color: rgba(74, 222, 128, 0.25);
}
.su-ach-icon {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.3);
  object-fit: cover;
  transition: all 0.2s;
}
.su-ach-item:not(.checked) .su-ach-icon {
  filter: grayscale(1) opacity(0.7);
}
.su-checkbox {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: 1.5px solid rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  background: rgba(0,0,0,0.2);
  color: transparent;
  shrink-0;
}
.su-ach-item.checked .su-checkbox {
  background: #22c55e;
  border-color: #22c55e;
  color: #000;
}
.su-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(255,255,255,0.04);
  background: rgba(0,0,0,0.15);
  display: flex;
  align-items: center;
  justify-content: space-between;
  shrink-0;
}
.su-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 38px;
  padding: 0 16px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  border: 1px solid transparent;
}
.su-btn-primary {
  background: var(--accent);
  color: #05060a;
  box-shadow: 0 4px 15px -3px color-mix(in srgb, var(--accent) 30%, transparent);
}
.su-btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.1);
  box-shadow: 0 6px 20px -3px color-mix(in srgb, var(--accent) 45%, transparent);
}
.su-btn-primary:active:not(:disabled) {
  transform: translateY(0);
}
.su-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.su-btn-ghost {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.05);
  color: #d1d5db;
}
.su-btn-ghost:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.1);
}
.su-search-container {
  position: relative;
  display: flex;
  align-items: center;
}
.su-search-input {
  width: 100%;
  height: 36px;
  padding-left: 36px;
  padding-right: 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: #fff;
  outline: none;
  font-size: 13px;
  transition: all 0.2s;
}
.su-search-input:focus {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--accent);
  box-shadow: 0 0 10px -3px color-mix(in srgb, var(--accent) 25%, transparent);
}
.su-search-icon {
  position: absolute;
  left: 12px;
  color: rgba(255, 255, 255, 0.35);
  pointer-events: none;
}
`;

export const SteamUnlockerModal = React.memo(function SteamUnlockerModal({
  isOpen,
  onClose,
  language
}: SteamUnlockerModalProps) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  // States
  const [games, setGames] = useState<SteamGame[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [gamesSearch, setGamesSearch] = useState('');

  const [selectedGame, setSelectedGame] = useState<SteamGame | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loadingAchievements, setLoadingAchievements] = useState(false);
  const [achQueryError, setAchQueryError] = useState<string | null>(null);
  const [achSearch, setAchSearch] = useState('');
  
  const [unlockedSet, setUnlockedSet] = useState<Set<string>>(new Set());
  const [originalUnlockedSet, setOriginalUnlockedSet] = useState<Set<string>>(new Set());
  
  const [committing, setCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const isRo = language === 'ro';
  const listRef = useRef<HTMLDivElement>(null);

  // Handle slide animations
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setClosing(false);
      // Fetch games
      setLoadingGames(true);
      if (window.chrome?.webview) {
        window.chrome.webview.postMessage('steam-get-installed-games');
      } else {
        // Dev Mock
        setTimeout(() => {
          setGames([
            { appid: '730', name: 'Counter-Strike 2', icon: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/730/header.jpg' },
            { appid: '570', name: 'Dota 2', icon: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/570/header.jpg' },
            { appid: '292030', name: 'The Witcher 3: Wild Hunt', icon: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/header.jpg' },
            { appid: '105600', name: 'Terraria', icon: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/105600/header.jpg' },
            { appid: '400', name: 'Portal', icon: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/400/header.jpg' },
            { appid: '620', name: 'Portal 2', icon: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg' },
          ]);
          setLoadingGames(false);
        }, 800);
      }
    } else if (visible) {
      setClosing(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setClosing(false);
        // Reset states
        setSelectedGame(null);
        setAchievements([]);
        setAchQueryError(null);
        setCommitMessage(null);
        setGamesSearch('');
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // IPC Message Listener
  useEffect(() => {
    const handleMessage = (event: any) => {
      try {
        let msg = event.data;
        if (typeof msg === 'string') {
          try { msg = JSON.parse(msg); } catch { return; }
        }

        if (msg?.type === 'steam-installed-games-result') {
          setLoadingGames(false);
          if (msg.error) {
            console.error('[SteamUnlocker] Games fetch error:', msg.error);
          } else if (msg.data) {
            const mapped = msg.data.map((g: any) => ({
              appid: String(g.appid || g.AppId || ''),
              name: String(g.name || g.Name || ''),
              icon: String(g.icon || g.Icon || '')
            }));
            const filtered = mapped.filter((g: any) => g.appid !== '228980');
            setGames(filtered);
          }
        }

        if (msg?.type === 'steam-achievement-query-result') {
          setLoadingAchievements(false);
          if (msg.error) {
            setAchQueryError(msg.error);
          } else if (msg.rawJson) {
            const parsed = JSON.parse(msg.rawJson);
            if (parsed.ok === false) {
              setAchQueryError(parsed.error || 'Unknown error');
            } else if (parsed.achievements) {
              const achs: Achievement[] = parsed.achievements;
              setAchievements(achs);
              
              const unlocked = new Set<string>();
              achs.forEach(a => { if (a.unlocked) unlocked.add(a.id); });
              setUnlockedSet(unlocked);
              setOriginalUnlockedSet(new Set(unlocked));

              if (parsed.gameName) {
                const name = String(parsed.gameName);
                setSelectedGame(prev => prev ? { ...prev, name } : null);
                setGames(prev => prev.map(g => g.appid === msg.appId ? { ...g, name } : g));
              }
            }
          }
        }

        if (msg?.type === 'steam-achievement-commit-result') {
          setCommitting(false);
          if (msg.error) {
            setCommitMessage({ ok: false, text: msg.error });
          } else if (msg.rawJson) {
            const parsed = JSON.parse(msg.rawJson);
            if (parsed.ok === false) {
              setCommitMessage({ ok: false, text: parsed.error || 'Failed to commit stats.' });
            } else {
              setCommitMessage({ ok: true, text: isRo ? 'Realizările au fost salvate cu succes în Steam!' : 'Achievements successfully saved to Steam!' });
              // Refresh original set to match current state
              setOriginalUnlockedSet(new Set(unlockedSet));
            }
          }
        }
      } catch (err) {
        console.error('[SteamUnlocker] Message handling error:', err);
      }
    };

    window.chrome?.webview?.addEventListener('message', handleMessage);
    return () => window.chrome?.webview?.removeEventListener('message', handleMessage);
  }, [isRo, unlockedSet]);

  const handleClose = () => {
    if (committing) return; // Cannot close while writing to Steam
    onClose();
  };

  const selectGame = (game: SteamGame) => {
    setSelectedGame(game);
    setAchievements([]);
    setAchQueryError(null);
    setCommitMessage(null);
    setLoadingAchievements(true);
    setAchSearch('');

    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(`steam-achievement-query|${game.appid}`);
    } else {
      // Dev Mock
      setTimeout(() => {
        setAchievements([
          { id: 'ACH_1', name: 'First Kill', desc: 'Eliminate one enemy in a matchmaking session.', unlocked: true, unlockTime: 0, hidden: false, icon: null },
          { id: 'ACH_2', name: 'Sharpshooter', desc: 'Perform 10 consecutive headshots with a sniper rifle.', unlocked: false, unlockTime: 0, hidden: false, icon: null },
          { id: 'ACH_3', name: 'Mastermind', desc: 'Win 50 games on competitive map pools.', unlocked: false, unlockTime: 0, hidden: false, icon: null },
          { id: 'ACH_4', name: 'Secret Agent', desc: 'Plant the bomb undetected 15 times.', unlocked: true, unlockTime: 0, hidden: true, icon: null },
          { id: 'ACH_5', name: 'Globetrotter', desc: 'Play a match on every official active duty map.', unlocked: false, unlockTime: 0, hidden: false, icon: null },
        ]);
        const unlocked = new Set(['ACH_1', 'ACH_4']);
        setUnlockedSet(unlocked);
        setOriginalUnlockedSet(new Set(unlocked));
        setLoadingAchievements(false);
      }, 1000);
    }
  };

  const handleLoadGamesSearchAppId = () => {
    const trimmed = gamesSearch.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) return;
    const mockGame: SteamGame = {
      appid: trimmed,
      name: `AppID: ${trimmed}`,
      icon: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${trimmed}/header.jpg`
    };
    selectGame(mockGame);
  };

  const toggleAchievement = (id: string) => {
    if (committing) return;
    setUnlockedSet(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleUnlockAll = () => {
    if (committing) return;
    const next = new Set<string>();
    achievements.forEach(a => next.add(a.id));
    setUnlockedSet(next);
  };

  const handleLockAll = () => {
    if (committing) return;
    setUnlockedSet(new Set<string>());
  };

  const handleInvert = () => {
    if (committing) return;
    setUnlockedSet(prev => {
      const next = new Set<string>();
      achievements.forEach(a => {
        if (!prev.has(a.id)) {
          next.add(a.id);
        }
      });
      return next;
    });
  };

  const handleCommit = () => {
    if (!selectedGame || committing) return;
    setCommitting(true);
    setCommitMessage(null);

    // Calculate changes
    const unlockList: string[] = [];
    const lockList: string[] = [];

    unlockedSet.forEach(id => {
      if (!originalUnlockedSet.has(id)) {
        unlockList.push(id);
      }
    });

    originalUnlockedSet.forEach(id => {
      if (!unlockedSet.has(id)) {
        lockList.push(id);
      }
    });

    const payload = {
      unlock: unlockList,
      lock: lockList
    };

    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(`steam-achievement-commit|${selectedGame.appid}:${JSON.stringify(payload)}`);
    } else {
      // Dev Mock
      setTimeout(() => {
        setCommitting(false);
        setCommitMessage({ ok: true, text: 'Achievements saved!' });
        setOriginalUnlockedSet(new Set(unlockedSet));
      }, 1200);
    }
  };

  // Filter games list
  const filteredGames = useMemo(() => {
    const q = gamesSearch.toLowerCase().trim();
    if (!q) return games;
    return games.filter(g => 
      (g.name || '').toLowerCase().includes(q) || 
      String(g.appid || '').includes(q)
    );
  }, [games, gamesSearch]);

  // Filter achievements list
  const filteredAchievements = useMemo(() => {
    const q = achSearch.toLowerCase().trim();
    if (!q) return achievements;
    return achievements.filter(a => a.name.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q) || a.id.toLowerCase().includes(q));
  }, [achievements, achSearch]);

  const statsText = useMemo(() => {
    if (achievements.length === 0) return '';
    const total = achievements.length;
    const current = unlockedSet.size;
    const pct = Math.round((current / total) * 100);
    return isRo
      ? `Deblocat: ${current} / ${total} (${pct}%)`
      : `Unlocked: ${current} / ${total} (${pct}%)`;
  }, [achievements, unlockedSet, isRo]);

  if (!visible && !isOpen) return null;

  return createPortal(
    <>
      <style>{steamUnlockerStyles}</style>
      <div className={`su-overlay ${closing ? 'closing' : ''}`} onClick={handleClose}>
        <div className={`su-card ${closing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
          <div className="su-glow-line" />

          {/* Header */}
          <div className="su-header">
            <div className="su-title-row">
              {selectedGame && (
                <button
                  onClick={() => setSelectedGame(null)}
                  className="mr-2 p-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <div className="su-title">
                <div className="su-title-badge">
                  <Trophy size={18} />
                </div>
                {selectedGame ? selectedGame.name : (isRo ? 'Achievement Unlocker' : 'Achievement Unlocker')}
              </div>
            </div>

            <button className="su-close" onClick={handleClose}>
              <X size={15} />
            </button>
          </div>

          {/* Content */}
          <div className="su-content" ref={listRef}>
            {!selectedGame ? (
              // ── GAME SELECTOR VIEW ──
              <div className="flex-1 flex flex-col min-h-0">
                {/* Search / Manual AppID Header Row */}
                <div className="p-5 pb-2 flex flex-col gap-4 border-b border-white/[0.03] shrink-0">
                  <div className="flex gap-2">
                    <div className="su-search-container flex-1">
                      <Search size={14} className="su-search-icon" />
                      <input
                        value={gamesSearch}
                        onChange={e => setGamesSearch(e.target.value)}
                        placeholder={isRo ? 'Caută în librăria Steam sau introdu un AppID...' : 'Search your Steam library or enter an AppID...'}
                        className="su-search-input"
                        onKeyDown={e => e.key === 'Enter' && handleLoadGamesSearchAppId()}
                      />
                    </div>
                    {/^\d+$/.test(gamesSearch.trim()) && (
                      <button
                        onClick={handleLoadGamesSearchAppId}
                        className="su-btn su-btn-primary shrink-0 flex items-center gap-1.5 animate-fadeIn"
                      >
                        <ArrowUpRight size={14} />
                        {isRo ? 'Încarcă' : 'Load'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Scanned Games Catalog List */}
                <div className="flex-1 overflow-y-auto min-h-0 su-scrollable">
                  {loadingGames ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400">
                      <Loader2 size={24} className="animate-spin text-accent" />
                      <span className="text-xs font-medium">{isRo ? 'Se încarcă librăria Steam...' : 'Loading Steam library...'}</span>
                    </div>
                  ) : filteredGames.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-500">
                      <Trophy size={28} className="opacity-40" />
                      <span className="text-xs font-semibold">{isRo ? 'Nu am găsit niciun joc în librărie.' : 'No games found in your library.'}</span>
                      <span className="text-[11px] text-gray-500 max-w-[280px] text-center mt-1">
                        {isRo ? 'Încearcă să introduci AppID-ul jocului manual în câmpul de căutare din dreapta.' : 'Try entering the game\'s AppID manually in the right text field.'}
                      </span>
                    </div>
                  ) : (
                    <div className="su-games-grid">
                      {filteredGames.map(g => (
                        <div key={g.appid} className="su-game-card" onClick={() => selectGame(g)} title={g.name}>
                          <div className="su-game-card-bg" style={{ backgroundImage: `url(${g.icon})` }} />
                          <div className="su-game-card-grad" />
                          {g.name && (
                            <div className="su-game-card-title">{g.name}</div>
                          )}
                          <div className="su-game-card-appid">AppID: {g.appid}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // ── ACHIEVEMENTS LIST VIEW ──
              <div className="flex-1 flex flex-col min-h-0">
                {/* Game Banner Header */}
                <div className="relative h-28 shrink-0 overflow-hidden border-b border-white/5 flex flex-col justify-end p-4">
                  <div className="absolute inset-0 bg-cover bg-center filter blur-[1px] brightness-[0.4]" style={{ backgroundImage: `url(${selectedGame.icon})` }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d17] via-transparent to-transparent" />
                  <div className="relative z-10 flex items-end justify-between gap-4">
                    <div>
                      <div className="font-bold text-lg text-white leading-tight drop-shadow-md">{selectedGame.name}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5 drop-shadow-md">AppID: {selectedGame.appid}</div>
                    </div>
                    {statsText && (
                      <div className="text-xs font-display font-bold tracking-wide bg-white/5 py-1 px-2.5 rounded-lg border border-white/10 text-accent">
                        {statsText}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bulk controls and Search bar */}
                <div className="p-4 border-b border-white/[0.03] flex flex-col gap-3 shrink-0">
                  <div className="flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex gap-2">
                      <button onClick={handleUnlockAll} disabled={loadingAchievements || achQueryError !== null || committing} className="su-btn su-btn-ghost !h-7 !px-3 !text-[11px]">
                        <Unlock size={11} className="text-emerald-400" />
                        {isRo ? 'Deblochează tot' : 'Unlock All'}
                      </button>
                      <button onClick={handleLockAll} disabled={loadingAchievements || achQueryError !== null || committing} className="su-btn su-btn-ghost !h-7 !px-3 !text-[11px]">
                        <Lock size={11} className="text-red-400" />
                        {isRo ? 'Blochează tot' : 'Lock All'}
                      </button>
                      <button onClick={handleInvert} disabled={loadingAchievements || achQueryError !== null || committing} className="su-btn su-btn-ghost !h-7 !px-3 !text-[11px]">
                        {isRo ? 'Inversează' : 'Invert'}
                      </button>
                    </div>

                    <div className="su-search-container min-w-[200px]">
                      <Search size={12} className="su-search-icon" />
                      <input
                        value={achSearch}
                        onChange={e => setAchSearch(e.target.value)}
                        placeholder={isRo ? 'Caută realizare...' : 'Search achievements...'}
                        className="su-search-input !h-7 !pl-8 !text-xs"
                        disabled={loadingAchievements || achQueryError !== null}
                      />
                    </div>
                  </div>
                </div>

                {/* Scrollable list */}
                <div className="flex-1 overflow-y-auto min-h-0 p-4 su-scrollable">
                  {loadingAchievements ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400">
                      <Loader2 size={24} className="animate-spin text-accent" />
                      <span className="text-xs font-medium">{isRo ? 'Se descarcă realizările de pe Steam...' : 'Loading achievements from Steam...'}</span>
                    </div>
                  ) : achQueryError ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2.5 text-red-400 p-6 text-center">
                      <Lock size={28} className="opacity-70" />
                      <span className="text-sm font-bold">{isRo ? 'Nu am putut citi datele jocului' : 'Failed to query game achievements'}</span>
                      <span className="text-xs text-red-300/70 max-w-[420px] bg-red-950/20 p-3 rounded-lg border border-red-900/20 font-mono leading-relaxed whitespace-pre-wrap select-text">
                        {achQueryError}
                      </span>
                      <button onClick={() => selectGame(selectedGame)} className="su-btn su-btn-ghost mt-2">
                        {isRo ? 'Reîncearcă' : 'Retry'}
                      </button>
                    </div>
                  ) : filteredAchievements.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-500 py-12">
                      <Trophy size={24} className="opacity-35" />
                      <span className="text-xs">{isRo ? 'Nicio realizare găsită.' : 'No achievements found.'}</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredAchievements.map(ach => {
                        const isChecked = unlockedSet.has(ach.id);
                        return (
                          <div
                            key={ach.id}
                            className={`su-ach-item ${isChecked ? 'checked' : ''}`}
                            onClick={() => toggleAchievement(ach.id)}
                          >
                            <div className="su-checkbox">
                              <Check size={11} strokeWidth={3} />
                            </div>

                            {ach.icon ? (
                              <img src={ach.icon} alt="" className="su-ach-icon" />
                            ) : (
                              <div className="su-ach-icon flex items-center justify-center bg-white/5 border border-white/10">
                                <Trophy size={16} className="text-gray-500" />
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white text-sm truncate">{ach.name}</span>
                                {ach.hidden && (
                                  <span className="text-[9px] bg-purple-500/10 border border-purple-500/25 text-purple-400 font-mono px-1.5 py-0.5 rounded">
                                    {isRo ? 'Ascuns' : 'Hidden'}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-400 truncate mt-0.5">{ach.desc || (isRo ? '(Nicio descriere)' : '(No description)')}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="su-footer">
            <div>
              {commitMessage && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold backdrop-blur-md animate-fadeIn"
                     style={{
                       background: commitMessage.ok ? 'color-mix(in srgb, var(--accent) 8%, rgba(255,255,255,0.02))' : 'rgba(239, 68, 68, 0.08)',
                       borderColor: commitMessage.ok ? 'color-mix(in srgb, var(--accent) 30%, rgba(255,255,255,0.06))' : 'rgba(239, 68, 68, 0.25)',
                       color: commitMessage.ok ? 'var(--accent)' : '#f87171',
                       boxShadow: commitMessage.ok ? '0 0 14px -3px color-mix(in srgb, var(--accent) 30%, transparent)' : 'none'
                     }}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0`}
                        style={{ backgroundColor: commitMessage.ok ? 'var(--accent)' : '#ef4444', boxShadow: commitMessage.ok ? '0 0 6px var(--accent)' : 'none' }} />
                  <span className="truncate max-w-[280px]">{commitMessage.text}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                className="su-btn su-btn-ghost"
                onClick={handleClose}
                disabled={committing}
              >
                {isRo ? 'Închide' : 'Close'}
              </button>
              {selectedGame && !achQueryError && achievements.length > 0 && (
                <button
                  className="su-btn su-btn-primary"
                  onClick={handleCommit}
                  disabled={committing || loadingAchievements}
                >
                  {committing ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      {isRo ? 'Se salvează...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} />
                      {isRo ? 'Salvează în Steam' : 'Save to Steam'}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
});
