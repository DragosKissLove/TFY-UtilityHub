import { useEffect, useRef, useState } from 'react';
import { Zap, Star, Bot, PackageCheck, Loader2, X, Check, Lock, Crown, ShieldCheck, ChevronDown } from 'lucide-react';
import { getLanguage, onLanguageChange, t, type TfyLanguage } from '../lib/i18n';
import { Modal } from '../components/Modal';
import { GamesCatalog } from '../components/GamesCatalog';

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

// Module-level cache: survives page navigate/remount
let _cachedWinLic: any = null;
let _cachedOffLic: any = null;

const lockStyles = `
@keyframes tfy-lock-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.09); }
}
@keyframes tfy-lock-glow {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
.tfy-lock-box { 
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 30%, transparent), 0 4px 12px rgba(0, 0, 0, 0.7);
  animation: tfy-lock-glow 2.6s ease-in-out infinite; 
  will-change: opacity;
}
.tfy-lock-icon { animation: tfy-lock-pulse 2.6s ease-in-out infinite; will-change: transform; }

/* Smooth scroll game list */
.tfy-game-scroll {
  -webkit-overflow-scrolling: touch;
}
.tfy-game-scroll::-webkit-scrollbar {
  width: 3px;
}
.tfy-game-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.tfy-game-scroll::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--accent) 45%, transparent);
  border-radius: 99px;
}
.tfy-game-scroll::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--accent) 70%, transparent);
}
`;

function PremiumLockOverlay({ language }: { language: TfyLanguage }) {
  return (
    <div
      className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center z-20"
      style={{
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div
        className="tfy-lock-box w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: 'color-mix(in srgb, var(--accent) 14%, rgba(0,0,0,0.6))',
          border: '1.5px solid color-mix(in srgb, var(--accent) 44%, transparent)',
        }}
      >
        <Lock size={26} className="tfy-lock-icon" style={{ color: 'var(--accent)' }} />
      </div>

      <div className="font-semibold text-white text-lg tracking-wide mb-1">
        {t(language, 'gaming.premiumOnly')}
      </div>
      <div className="text-xs text-center px-10" style={{ color: 'rgba(255,255,255,0.38)' }}>
        {t(language, 'gaming.premiumLockDesc')}
      </div>
    </div>
  );
}

export function GamingTweaks() {
  const [language, setLanguage] = useState<TfyLanguage>(() => getLanguage());
  const [isPremium, setIsPremium] = useState<boolean | null>(() => {
    return (window as any).__tfyAccess?.premium ?? null;
  });
  const [dlcGames, setDlcGames] = useState<DlcUnlockerGame[]>([]);
  const [dlcLoading, setDlcLoading] = useState(false);

  // ── System Activator state ──────────────────────────────────────────────────
  type LicInfo = { name: string; isActivated: boolean; isInstalled?: boolean; label: string; status: number };
  // Initialise from cache if available
  const [winLic, setWinLic] = useState<LicInfo | null>(_cachedWinLic);
  const [offLic, setOffLic] = useState<LicInfo | null>(_cachedOffLic);
  const [activatorLoading, setActivatorLoading] = useState(false);
  const [activatorMethod, setActivatorMethod] = useState<string | null>(null);
  const [dlcExpanded, setDlcExpanded] = useState(false);
  const [installModal, setInstallModal] = useState<{
    game: DlcUnlockerGame;
    dlcs: DlcItem[];
    loading: boolean;
    selected: Set<string>;
    proxy: boolean;
  } | null>(null);
  const installModalRef = useRef(installModal);
  installModalRef.current = installModal;

  useEffect(() => onLanguageChange(setLanguage), []);

  useEffect(() => {
    const handler = (event: any) => {
      let message = event.data;
      if (typeof message === 'string') {
        try { message = JSON.parse(message); } catch { return; }
      }
      if (message?.type === 'premium') setIsPremium(Boolean(message?.data?.enabled));
    };
    if (window.chrome?.webview) window.chrome.webview.addEventListener('message', handler);
    return () => { if (window.chrome?.webview) window.chrome.webview.removeEventListener('message', handler); };
  }, []);

  useEffect(() => {
    if (window.chrome?.webview) { setDlcLoading(true); window.chrome.webview.postMessage('dlcunlocker-scan'); }
  }, []);

  // Fetch activator status on mount
  useEffect(() => {
    if (window.chrome?.webview) window.chrome.webview.postMessage('windows-activator-status');
  }, []);

  // Listen for activator messages from backend
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent<{ type: string; action?: string; data?: any }>).detail;
      if (msg?.type !== 'activator') return;
      if (msg.action === 'status') {
        const w = msg.data?.windows ?? null;
        const o = msg.data?.office ?? null;
        _cachedWinLic = w; // persist across unmount
        _cachedOffLic = o;
        setWinLic(w);
        setOffLic(o);
        setActivatorLoading(false);
        setActivatorMethod(null);
      }
      if (msg.action === 'running') {
        setActivatorLoading(true);
        setActivatorMethod(msg.data?.method ?? null);
      }
      if (msg.action === 'done') {
        setActivatorLoading(false);
        setActivatorMethod(null);
      }
    };
    window.addEventListener('tfy-activator', handler as EventListener);
    return () => window.removeEventListener('tfy-activator', handler as EventListener);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent<{
        type: string; action?: string;
        data?: { games?: DlcUnlockerGame[]; path?: string; appId?: string; dlcs?: DlcItem[]; error?: string; };
      }>).detail;
      if (msg?.type !== 'dlcunlocker') return;
      setDlcLoading(false);
      if (msg.action === 'scan' && msg.data?.games) setDlcGames(msg.data.games);
      if (msg.action === 'dlclist' && msg.data) {
        const cur = installModalRef.current;
        if (cur && cur.game.Id === msg.data.appId) {
          setInstallModal((prev) => prev && prev.game.Id === msg.data?.appId ? { ...prev, dlcs: msg.data?.dlcs ?? [], loading: false } : prev);
        }
      }
      if (msg.action === 'install' || msg.action === 'uninstall') {
        setInstallModal(null);
        setDlcGames((prev) => prev.map((g) => g.Path === msg.data?.path ? { ...g, HasUnlocker: msg.action === 'install' } : g));
      }
    };
    window.addEventListener('tfy-dlcunlocker', handler);
    return () => window.removeEventListener('tfy-dlcunlocker', handler);
  }, []);

  const handleInjectScript = () => { if (window.chrome?.webview) window.chrome.webview.postMessage('gaming-inject-script'); };
  const handleDlcScan = () => { if (window.chrome?.webview) { setDlcLoading(true); window.chrome.webview.postMessage('dlcunlocker-scan'); } };

  const openInstallModal = (game: DlcUnlockerGame) => {
    if (game.Platform === 'Steam' && game.Id) {
      setInstallModal({ game, dlcs: [], loading: true, selected: new Set(), proxy: false });
      window.chrome?.webview?.postMessage(`dlcunlocker-getdlcs|${game.Id}`);
    } else if (window.chrome?.webview) {
      window.chrome.webview.postMessage(`dlcunlocker-install|${JSON.stringify({ path: game.Path, platform: game.Platform, id: game.Id })}`);
    }
  };

  const closeInstallModal = () => setInstallModal(null);
  const toggleDlc = (id: string) => {
    setInstallModal((prev) => {
      if (!prev) return prev;
      const next = new Set(prev.selected);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, selected: next };
    });
  };
  const selectAllDlcs = () => {
    setInstallModal((prev) => {
      if (!prev || prev.dlcs.length === 0) return prev;
      const allSelected = prev.dlcs.every((d) => prev.selected.has(d.id));
      const next = new Set<string>();
      if (!allSelected) prev.dlcs.forEach((d) => next.add(d.id));
      return { ...prev, selected: next };
    });
  };
  const setProxy = (v: boolean) => setInstallModal((p) => (p ? { ...p, proxy: v } : null));
  const confirmInstall = () => {
    if (!installModal?.game || !window.chrome?.webview) return;
    const { game, selected, proxy } = installModal;
    window.chrome.webview.postMessage(`dlcunlocker-install|${JSON.stringify({ path: game.Path, platform: game.Platform, id: game.Id, selectedDlcIds: Array.from(selected), proxy })}`);
    setInstallModal(null);
  };
  const handleDlcUninstall = (game: DlcUnlockerGame) => {
    if (window.chrome?.webview) window.chrome.webview.postMessage(`dlcunlocker-uninstall|${JSON.stringify({ path: game.Path, platform: game.Platform })}`);
  };

  const locked = isPremium === false;

  return (
    <div className="tfy-themed-page tfy-page-gaming h-full flex flex-col">
      <style>{lockStyles}</style>

      {/* Page header — pinned at top */}
      <div className="flex flex-wrap items-center justify-between gap-6 shrink-0 pb-6">
        <div>
          <p className="section-title">{t(language, 'gaming.kicker')}</p>
          <h1 className="text-3xl md:text-4xl font-display font-semibold text-white mt-3 flex items-center gap-3">
            <Zap size={28} className="text-accent" />
            {t(language, 'gaming.title')}
          </h1>
          <p className="text-sm text-gray-400 mt-2 max-w-lg leading-snug">{t(language, 'gaming.subtitle')}</p>
          <div className="flex flex-wrap gap-3 mt-4">
            <span className="chip flex items-center gap-2">
              <Star size={13} /> {t(language, 'gaming.safe')}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable content — flex-col so we can use CSS order */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-6" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* ── TFY Agent + DLC block ── */}
        {/* NOTE: do NOT use overflow-hidden here — it clips the DLC game list scroll */}
        <div className="relative rounded-2xl shrink-0">
          {/* Unified liquid card */}
          <div
            className="panel panel-outline rounded-2xl liquid-card tfy-diagonal-glow"
            style={{ borderColor: locked ? 'rgba(255,255,255,0.06)' : undefined, overflow: 'hidden', position: 'relative' }}
          >
            {/* Optional premium badge when unlocked */}
            {!locked && isPremium === true && (
              <div className="flex items-center gap-2 px-5 pt-4 pb-0">
                <Crown size={13} style={{ color: 'var(--accent)' }} />
                <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
                  Premium
                </span>
              </div>
            )}

            {/* ── TFY Agent ── */}
            <div className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 gaming-card-icon"
                  style={{ background: 'color-mix(in srgb, var(--accent) 16%, rgba(255,255,255,0.04))' }}>
                  <Bot size={24} className="text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-white font-semibold text-lg">{t(language, 'gaming.tfyAgent.cardTitle')}</div>
                  <div className="text-sm text-gray-400 mt-0.5">{t(language, 'gaming.tfyAgent.cardSub')}</div>
                </div>
                <button type="button" onClick={handleInjectScript} className="btn-ghost flex items-center gap-2 shrink-0" style={{ color: 'var(--accent)' }}>
                  {t(language, 'gaming.tfyAgent.inject')}
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="mx-5 border-t border-white/[0.06]" />

            {/* ── DLC Unlocker ── */}
            <div className="p-5">
              {/* Clickable header row — toggles expand */}
              <button
                type="button"
                className="flex items-center gap-4 w-full text-left"
                onClick={() => setDlcExpanded(v => !v)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 gaming-card-icon"
                  style={{ background: 'color-mix(in srgb, var(--accent) 16%, rgba(255,255,255,0.04))' }}>
                  <PackageCheck size={24} className="text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-white font-semibold text-lg">{t(language, 'gaming.dlcUnlocker.cardTitle')}</div>
                  <div className="text-sm text-gray-400 mt-0.5">{t(language, 'gaming.dlcUnlocker.cardSub')}</div>
                </div>
                {/* Right side: scan + chevron */}
                <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                  <button type="button" onClick={handleDlcScan} disabled={dlcLoading}
                    className="btn-ghost flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                    {dlcLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {dlcLoading ? t(language, 'gaming.dlcUnlocker.loading') : t(language, 'gaming.dlcUnlocker.scan')}
                  </button>
                </div>
                <div className="shrink-0 ml-1 transition-transform duration-300"
                  style={{ transform: dlcExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', color: 'rgba(255,255,255,0.35)' }}>
                  <ChevronDown size={18} />
                </div>
              </button>

              {/* Collapsible game list */}
              {dlcExpanded && (
                <div className="mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'color-mix(in srgb, var(--accent) 4%, rgba(0,0,0,0.2))' }}>
                  {dlcGames.length === 0 ? (
                    <div className="p-6 text-center text-gray-400 text-sm">{t(language, 'gaming.dlcUnlocker.noGames')}</div>
                  ) : (
                    <ul className="divide-y divide-white/5">
                      {dlcGames.map((game) => (
                        <li key={`${game.Platform}-${game.Id}-${game.Path}`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors">
                          <span className="flex-1 min-w-0 truncate text-white font-medium">{game.Name}</span>
                          <span className="shrink-0 text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--accent)' }}>
                            {game.Platform}
                          </span>
                          {game.HasUnlocker && <span className="text-xs text-emerald-400/90 shrink-0">{t(language, 'gaming.dlcUnlocker.hasUnlocker')}</span>}
                          <div className="flex items-center gap-2 shrink-0">
                            {game.HasUnlocker ? (
                              <button type="button" onClick={() => handleDlcUninstall(game)} className="btn-ghost text-xs text-red-400/90 hover:text-red-300">
                                {t(language, 'gaming.dlcUnlocker.uninstall')}
                              </button>
                            ) : (
                              <button type="button" onClick={() => openInstallModal(game)} className="btn-ghost text-xs" style={{ color: 'var(--accent)' }}>
                                {t(language, 'gaming.dlcUnlocker.install')}
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Single overlay for the entire premium block */}
          {locked && <PremiumLockOverlay language={language} />}
        </div>

        {/* ── System Activator card — rendered above premium block via order ── */}
        <div className="panel panel-outline rounded-2xl liquid-card tfy-diagonal-glow shrink-0" style={{ order: -1, overflow: 'hidden', position: 'relative' }}>
          <div className="p-5">
            {/* Header */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 gaming-card-icon"
                style={{ background: 'color-mix(in srgb, var(--accent) 16%, rgba(255,255,255,0.04))' }}>
                <ShieldCheck size={24} className="text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-white font-semibold text-lg">{t(language, 'gaming.activator.title')}</div>
                <div className="text-sm text-gray-400 mt-0.5">{t(language, 'gaming.activator.sub')}</div>
              </div>
              <button type="button"
                onClick={() => window.chrome?.webview?.postMessage('windows-activator-status')}
                className="btn-ghost text-xs shrink-0 flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                {activatorLoading ? <Loader2 size={13} className="animate-spin" /> : null}
                {t(language, 'gaming.activator.verifyStatus')}
              </button>
            </div>

            {/* Windows section */}
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{t(language, 'gaming.activator.winSection')}</span>
                {winLic && (
                  <span className="text-xs px-3 py-1 rounded-full font-medium"
                    style={{ background: winLic.isActivated ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'rgba(248,113,113,0.13)', color: winLic.isActivated ? 'var(--accent)' : '#f87171' }}>
                    {winLic.isActivated ? t(language, 'gaming.activator.status.activated') : t(language, 'gaming.activator.status.notActivated')}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { method: 'HWID', title: t(language, 'gaming.activator.permanent'), sub: t(language, 'gaming.activator.permanentSub'), badge: t(language, 'gaming.activator.recommended') },
                  { method: 'KMS38', title: t(language, 'gaming.activator.longTerm'), sub: t(language, 'gaming.activator.longTermSub'), badge: null },
                ] as const).map(({ method, title, sub, badge }) => (
                  <button key={method} type="button"
                    disabled={activatorLoading}
                    onClick={() => { window.chrome?.webview?.postMessage(`windows-activator-run|${method}`); }}
                    className="flex flex-col items-start p-4 rounded-xl text-left transition-all cursor-pointer"
                    style={{
                      background: activatorMethod === method
                        ? 'color-mix(in srgb, var(--accent) 22%, rgba(255,255,255,0.04))'
                        : 'color-mix(in srgb, var(--accent) 7%, rgba(255,255,255,0.03))',
                      border: `1.5px solid ${activatorMethod === method ? 'color-mix(in srgb, var(--accent) 55%, transparent)' : 'color-mix(in srgb, var(--accent) 18%, rgba(255,255,255,0.08))'}`,
                      opacity: activatorLoading && activatorMethod !== method ? 0.45 : 1,
                    }}>
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-sm font-semibold text-white flex items-center gap-2">
                        {activatorLoading && activatorMethod === method
                          ? <Loader2 size={14} className="animate-spin text-accent" />
                          : null}
                        {title}
                      </span>
                      {badge && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)' }}>{badge}</span>}
                    </div>
                    <span className="text-[12px] text-gray-500 leading-snug">{sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Office section */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{t(language, 'gaming.activator.officeSection')}</span>
                {offLic && (
                  offLic.isInstalled ? (
                    <span className="text-xs px-3 py-1 rounded-full font-medium"
                      style={{
                        background: offLic.isActivated ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : offLic.status === 2 ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.13)',
                        color: offLic.isActivated ? 'var(--accent)' : offLic.status === 2 ? '#fbbf24' : '#f87171'
                      }}>
                      {offLic.isActivated ? t(language, 'gaming.activator.status.activated') : offLic.status === 2 ? '⚠ Perioadă grație' : t(language, 'gaming.activator.status.notActivated')}
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
                      {t(language, 'gaming.activator.notInstalled')}
                    </span>
                  )
                )}
                {/* Get Office button when not installed */}
                {offLic && !offLic.isInstalled && (
                  <button type="button"
                    onClick={() => window.chrome?.webview?.postMessage('open-url|https://c2rsetup.officeapps.live.com/c2r/download.aspx?ProductreleaseID=O365ProPlusRetail&platform=x64&language=en-us&version=O16GA')}
                    className="text-xs px-2 py-0.5 rounded-lg flex items-center gap-1 ml-auto"
                    style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}>
                    {t(language, 'gaming.activator.installOffice')}
                  </button>
                )}
              </div>
              {/* Single KMS button — full width */}
              <button type="button"
                disabled={activatorLoading || offLic?.isInstalled === false}
                onClick={() => { if (offLic?.isInstalled !== false) window.chrome?.webview?.postMessage('windows-activator-run|KMS'); }}
                className="flex flex-col items-start p-4 rounded-xl text-left transition-all cursor-pointer w-full"
                style={{
                  background: activatorMethod === 'KMS'
                    ? 'color-mix(in srgb, var(--accent) 22%, rgba(255,255,255,0.04))'
                    : 'color-mix(in srgb, var(--accent) 7%, rgba(255,255,255,0.03))',
                  border: `1.5px solid ${activatorMethod === 'KMS' ? 'color-mix(in srgb, var(--accent) 55%, transparent)' : 'color-mix(in srgb, var(--accent) 18%, rgba(255,255,255,0.08))'}`,
                  opacity: (activatorLoading && activatorMethod !== 'KMS') || offLic?.isInstalled === false ? 0.45 : 1,
                }}>
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-sm font-semibold text-white flex items-center gap-2">
                    {activatorLoading && activatorMethod === 'KMS'
                      ? <Loader2 size={14} className="animate-spin text-accent" />
                      : null}
                    {t(language, 'gaming.activator.standard')}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)' }}>
                    {t(language, 'gaming.activator.recommended')}
                  </span>
                </div>
                <span className="text-[12px] text-gray-500 leading-snug">{t(language, 'gaming.activator.standardSub')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Games Catalog (Hydra DB) ── */}
        <GamesCatalog />

        {/* DLC selection modal */}
        {installModal && (
          <Modal isOpen={true} onClose={closeInstallModal}
            title={`${installModal.game.Name}`}
            className="tfy-modal-deep">
            <div className="dlc-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Proxy toggle */}
              <button type="button" role="checkbox" aria-checked={installModal.proxy}
                onClick={() => setProxy(!installModal.proxy)}
                className="flex items-center gap-3 w-full text-left rounded-xl px-4 py-3 transition-all"
                style={{
                  background: installModal.proxy
                    ? 'color-mix(in srgb, var(--accent) 12%, rgba(255,255,255,0.04))'
                    : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${installModal.proxy ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'rgba(255,255,255,0.08)'}`,
                }}>
                <span className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all"
                  style={{ borderColor: installModal.proxy ? 'var(--accent)' : 'rgba(255,255,255,0.25)', background: installModal.proxy ? 'var(--accent)' : 'transparent' }}>
                  {installModal.proxy && <Check size={12} className="text-white" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{t(language, 'gaming.dlcUnlocker.proxy')}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Înlocuiește fișierele jocului direct, fără un loader suplimentar</div>
                </div>
              </button>

              {/* DLC list */}
              {installModal.loading ? (
                <div className="flex flex-col items-center gap-3 py-10 text-gray-400">
                  <Loader2 size={26} className="animate-spin" style={{ color: 'var(--accent)' }} />
                  <span className="text-sm">{t(language, 'gaming.dlcUnlocker.fetchingDlcs')}</span>
                </div>
              ) : installModal.dlcs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10">
                  <div className="text-white/30 text-sm">{t(language, 'gaming.dlcUnlocker.noDlcs')}</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>DLC-uri</span>
                      <span className="text-xs rounded-full px-2 py-0.5"
                        style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
                        {installModal.selected.size} / {installModal.dlcs.length}
                      </span>
                    </div>
                    <button type="button" onClick={selectAllDlcs}
                      className="text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
                      style={{ color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}>
                      {installModal.dlcs.every((d) => installModal.selected.has(d.id))
                        ? t(language, 'gaming.dlcUnlocker.deselectAll')
                        : t(language, 'gaming.dlcUnlocker.selectAll')}
                    </button>
                  </div>
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                    <ul className="max-h-[300px] overflow-y-auto divide-y divide-white/[0.05]">
                      {installModal.dlcs.map((d, idx) => {
                        const sel = installModal.selected.has(d.id);
                        return (
                          <li key={d.id}
                            onClick={() => toggleDlc(d.id)}
                            className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors select-none"
                            style={{ background: sel ? 'color-mix(in srgb, var(--accent) 9%, transparent)' : 'transparent' }}
                            onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = sel ? 'color-mix(in srgb, var(--accent) 9%, transparent)' : 'transparent'; }}>
                            <span className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
                              style={{ border: `1.5px solid ${sel ? 'var(--accent)' : 'rgba(255,255,255,0.2)'}`, background: sel ? 'var(--accent)' : 'transparent' }}>
                              {sel && <Check size={10} className="text-white" strokeWidth={3} />}
                            </span>
                            <span className="text-xs w-6 shrink-0 text-right tabular-nums" style={{ color: 'rgba(255,255,255,0.2)' }}>{idx + 1}</span>
                            <span className="text-sm flex-1 min-w-0 truncate" style={{ color: sel ? 'white' : 'rgba(255,255,255,0.65)' }}>{d.name}</span>
                            <span className="text-xs shrink-0 px-1.5 py-0.5 rounded" style={{ color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.04)' }}>{d.id}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <button type="button" onClick={closeInstallModal} className="btn-ghost flex items-center gap-2">
                  <X size={15} className="shrink-0" /> {t(language, 'gaming.dlcUnlocker.close')}
                </button>
                <button type="button" onClick={confirmInstall}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                  style={{ background: 'color-mix(in srgb, var(--accent) 20%, rgba(255,255,255,0.06))', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)' }}>
                  <Check size={14} />
                  {installModal.selected.size > 0
                    ? `${t(language, 'gaming.dlcUnlocker.confirmInstall')} (${installModal.selected.size})`
                    : t(language, 'gaming.dlcUnlocker.confirmInstall')}
                </button>
              </div>

            </div>
          </Modal>
        )
        }
      </div > {/* end scrollable */}
    </div >
  );
}

