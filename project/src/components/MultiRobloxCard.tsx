import React, { useState, useEffect } from 'react';
import { Play, Power, Zap, Users, Trash2, Plus, Sliders, ShieldCheck, RefreshCw, Check, X } from 'lucide-react';

interface MultiRobloxCardProps {
  language: 'ro' | 'en';
}

interface RobloxAccount {
  id: string;
  name: string;
  placeId?: string;
  code?: string;
}

export function MultiRobloxCard({ language }: MultiRobloxCardProps) {
  const [multiActive, setMultiActive] = useState(false);
  const [runningCount, setRunningCount] = useState(0);
  const [selectedFps, setSelectedFps] = useState(240);
  const [placeId, setPlaceId] = useState('');
  const [privateCode, setPrivateCode] = useState('');

  // Accounts state stored locally
  const [accounts, setAccounts] = useState<RobloxAccount[]>(() => {
    try {
      const saved = localStorage.getItem('tfy_roblox_accounts');
      if (!saved || saved === 'undefined' || saved === 'null') return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [newAccName, setNewAccName] = useState('');
  const [showAddAcc, setShowAddAcc] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('tfy_roblox_accounts', JSON.stringify(accounts));
    } catch {}
  }, [accounts]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'roblox-status') {
          setMultiActive(!!data.data?.active);
          setRunningCount(data.data?.count || 0);
        }
      } catch {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleToggleMulti = () => {
    window.chrome?.webview?.postMessage('roblox-multi-toggle');
    setMultiActive(!multiActive);
  };

  const handleKillAll = () => {
    window.chrome?.webview?.postMessage('roblox-kill-all');
  };

  const handleSetFps = (fps: number) => {
    setSelectedFps(fps);
    window.chrome?.webview?.postMessage(`roblox-set-fps|${fps}`);
  };

  const handleLaunchGame = (targetPlaceId?: string, targetCode?: string) => {
    const pId = targetPlaceId || placeId;
    const pCode = targetCode || privateCode;
    window.chrome?.webview?.postMessage(`roblox-launch-game|${pId}|${pCode}`);
  };

  const handleAddAccount = () => {
    if (!newAccName.trim()) return;
    const acc: RobloxAccount = {
      id: Date.now().toString(),
      name: newAccName.trim(),
      placeId: placeId.trim(),
      code: privateCode.trim()
    };
    setAccounts([...accounts, acc]);
    setNewAccName('');
    setShowAddAcc(false);
  };

  const handleDeleteAccount = (id: string) => {
    setAccounts(accounts.filter(a => a.id !== id));
  };

  return (
    <div className="p-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 gaming-card-icon"
            style={{ background: 'color-mix(in srgb, var(--accent) 16%, rgba(255,255,255,0.04))' }}
          >
            <Users size={24} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-lg">MultiRoblox (Account & Multi-Instance Manager)</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                  multiActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/20'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${multiActive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'}`} />
                {multiActive ? (language === 'ro' ? 'Multi-Instance Activ' : 'Multi-Instance Active') : (language === 'ro' ? 'Inactiv' : 'Inactive')}
              </span>
            </div>
            <div className="text-sm text-gray-400 mt-0.5">
              {language === 'ro'
                ? 'Rulează mai multe conturi de Roblox simultan pe același PC. Gestionează altele, deschide mai multe instanțe și deblochează FPS-ul.'
                : 'Run as many Roblox accounts as you want simultaneously on Windows. Manage alts, multi-instance bypass, and FPS target.'}
            </div>
          </div>
        </div>

        {/* Multi-Instance Toggle & Kill All */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleToggleMulti}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-200 border ${
              multiActive
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
            }`}
          >
            <ShieldCheck size={14} className={multiActive ? 'text-emerald-400' : 'text-gray-400'} />
            {multiActive
              ? (language === 'ro' ? 'Bypass Mutex Activ' : 'Mutex Bypass Active')
              : (language === 'ro' ? 'Activează Multi-Instance' : 'Enable Multi-Instance')}
          </button>

          <button
            type="button"
            onClick={handleKillAll}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all flex items-center gap-1.5"
            title={language === 'ro' ? 'Închide toate instanțele Roblox' : 'Kill all Roblox processes'}
          >
            <Power size={14} />
            {language === 'ro' ? 'Închide Tot' : 'Kill All'}
          </button>
        </div>
      </div>

      {/* Grid Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column: Direct Launcher & FPS Unlocker */}
        <div className="space-y-4">
          {/* Game Target Launcher */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between text-xs font-medium text-gray-300">
              <span className="flex items-center gap-1.5">
                <Play size={13} className="text-accent" />
                {language === 'ro' ? 'Lansare Rapidă Joc (Place ID)' : 'Quick Game Launch (Place ID)'}
              </span>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={placeId}
                onChange={e => setPlaceId(e.target.value)}
                placeholder="Game / Place ID (ex: 920587237)"
                className="w-full px-3 py-2 text-xs rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-accent"
              />
              <input
                type="text"
                value={privateCode}
                onChange={e => setPrivateCode(e.target.value)}
                placeholder={language === 'ro' ? 'VIP Server Code / Private Server Link (Opțional)' : 'VIP Server Code / Private Server Link (Optional)'}
                className="w-full px-3 py-2 text-xs rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-accent"
              />
            </div>

            <button
              type="button"
              onClick={() => handleLaunchGame()}
              className="w-full py-2 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              <Play size={14} fill="#000" />
              {language === 'ro' ? 'Deschide Instanță Roblox' : 'Launch Roblox Instance'}
            </button>
          </div>

          {/* FPS Target Control */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between text-xs font-medium text-gray-300">
              <span className="flex items-center gap-1.5">
                <Zap size={13} className="text-amber-400" />
                {language === 'ro' ? 'FPS Target (Roblox Unlocker)' : 'FPS Target (Roblox Unlocker)'}
              </span>
              <span className="text-amber-400 font-mono text-xs">{selectedFps === 9999 ? 'Unlimited' : `${selectedFps} FPS`}</span>
            </div>

            <div className="grid grid-cols-6 gap-1.5">
              {[60, 120, 144, 240, 360, 9999].map(fps => (
                <button
                  key={fps}
                  type="button"
                  onClick={() => handleSetFps(fps)}
                  className={`py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                    selectedFps === fps
                      ? 'bg-amber-400/20 border-amber-400/50 text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.2)]'
                      : 'bg-black/30 border-white/5 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  {fps === 9999 ? 'Max' : fps}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Roblox Accounts Manager */}
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <Users size={14} className="text-accent" />
                {language === 'ro' ? 'Conturi Salvate (Multi-Accounts)' : 'Saved Accounts (Multi-Accounts)'}
                <span className="px-1.5 py-0.2 text-[10px] rounded-md bg-white/10 text-white">{accounts.length}</span>
              </span>

              <button
                type="button"
                onClick={() => setShowAddAcc(!showAddAcc)}
                className="text-xs text-accent hover:underline flex items-center gap-1 font-medium"
              >
                {showAddAcc ? <X size={13} /> : <Plus size={13} />}
                {showAddAcc ? (language === 'ro' ? 'Anulează' : 'Cancel') : (language === 'ro' ? 'Adaugă Cont' : 'Add Alt')}
              </button>
            </div>

            {/* Add Account form */}
            {showAddAcc && (
              <div className="mb-3 p-3 rounded-lg bg-black/50 border border-white/10 space-y-2">
                <input
                  type="text"
                  value={newAccName}
                  onChange={e => setNewAccName(e.target.value)}
                  placeholder={language === 'ro' ? 'Nume Cont / Nickname Alt' : 'Account Name / Alt Nickname'}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-black/60 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={handleAddAccount}
                  className="w-full py-1.5 rounded-lg text-xs font-semibold bg-accent text-black flex items-center justify-center gap-1"
                >
                  <Check size={13} />
                  {language === 'ro' ? 'Salvează Cont' : 'Save Account'}
                </button>
              </div>
            )}

            {/* Account List */}
            {accounts.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-500">
                {language === 'ro'
                  ? 'Nu ai adăugat niciun cont salvat încă. Apasă pe „Adaugă Cont” mai sus.'
                  : 'No saved accounts yet. Click "Add Alt" to store your accounts for 1-click launch.'}
              </div>
            ) : (
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {accounts.map(acc => (
                  <div
                    key={acc.id}
                    className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between gap-2 hover:border-white/10 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white truncate">{acc.name}</div>
                      {acc.placeId && (
                        <div className="text-[10px] text-gray-400 truncate">Place: {acc.placeId}</div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleLaunchGame(acc.placeId, acc.code)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-accent/20 border border-accent/40 text-accent hover:bg-accent/30 transition-all flex items-center gap-1"
                      >
                        <Play size={11} fill="currentColor" />
                        Launch
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAccount(acc.id)}
                        className="p-1 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
