import { useEffect, useMemo, useState } from 'react';
import { Search, ArrowUpDown, RefreshCw, Trash2, AppWindow, Store, ChevronDown } from 'lucide-react';
import { Modal } from '../components/Modal';
import { getLanguage, onLanguageChange, t, type TfyLanguage } from '../lib/i18n';
import { notify } from '../lib/notify';



interface DebloaterApp {
  id: string;
  name: string;
  version?: string;
  publisher?: string;
  estimatedSizeKb?: number;
  installDate?: string;
  type: 'desktop' | 'store';
  displayIcon?: string;
  uninstallString?: string;
  quietUninstallString?: string;
  installLocation?: string;
  packageFullName?: string;
  packageFamilyName?: string;
}
let cachedDebloaterApps: { desktop: DebloaterApp[]; store: DebloaterApp[] } | null = null;
let cachedDebloaterLoaded = false;

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

export function Debloater() {
  const [debloatTab, setDebloatTab] = useState<'desktop' | 'store'>('desktop');
  const [debloatSearch, setDebloatSearch] = useState('');
  const [debloatSort, setDebloatSort] = useState<'name' | 'size' | 'date'>('name');
  const [debloatAscending, setDebloatAscending] = useState(true);
  const [debloatLoading, setDebloatLoading] = useState(false);
  const [debloatApps, setDebloatApps] = useState<{ desktop: DebloaterApp[]; store: DebloaterApp[] }>({ desktop: [], store: [] });
  const [debloatSelected, setDebloatSelected] = useState<Record<string, boolean>>({});
  const [debloatConfirmOpen, setDebloatConfirmOpen] = useState(false);
  const [debloatDeepClean, setDebloatDeepClean] = useState(true);
  const [debloatLogPath, setDebloatLogPath] = useState<string | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [language, setLanguage] = useState<TfyLanguage>(() => getLanguage());



  
  
  const runDebloat = () => {
    const items = selectedApps
      .filter((app) => debloatSelected[app.id] && !!app.id)
      .map((app) => ({
        id: app.id,
        name: app.name,
        type: app.type,
        uninstallString: app.uninstallString,
        quietUninstallString: app.quietUninstallString,
        installLocation: app.installLocation,
        packageFullName: app.packageFullName,
        packageFamilyName: app.packageFamilyName,
      }));
    if (!items.length) {
      notify({ title: t(language, 'debloat.kicker'), message: t(language, 'debloat.noValidSelection'), kind: 'warning', duration: 2200 });
      return;
    }

    setDebloatConfirmOpen(false);
    setDebloatLoading(true);
    notify({ title: t(language, 'debloat.uninstall'), message: t(language, 'debloat.notifyStarted').replace('{count}', String(items.length)), kind: 'info', duration: 2400 });
    if (!window.chrome?.webview) {
      setDebloatLoading(false);
      notify({ title: t(language, 'debloat.kicker'), message: t(language, 'debloat.hostRequired'), kind: 'error', duration: 3000 });
      return;
    }
    window.chrome.webview.postMessage(`debloater-uninstall|${JSON.stringify({ items, deepClean: debloatDeepClean })}`);
  };

  const requestDebloatList = () => {
    setDebloatLoading(true);
    window.chrome?.webview?.postMessage('debloater-refresh');
  };

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

      if (message?.type === 'debloater' && message?.action === 'list') {
        const normalize = (app: any): DebloaterApp => ({
          id: app?.id ?? app?.Id ?? `${(app?.type ?? app?.Type ?? 'desktop').toLowerCase()}:${app?.name ?? app?.Name ?? 'unknown'}`,
          name: app?.name ?? app?.Name,
          version: app?.version ?? app?.Version,
          publisher: app?.publisher ?? app?.Publisher,
          estimatedSizeKb: app?.estimatedSizeKb ?? app?.EstimatedSizeKb,
          installDate: app?.installDate ?? app?.InstallDate,
          uninstallString: app?.uninstallString ?? app?.UninstallString,
          quietUninstallString: app?.quietUninstallString ?? app?.QuietUninstallString,
          installLocation: app?.installLocation ?? app?.InstallLocation,
          packageFullName: app?.packageFullName ?? app?.PackageFullName,
          packageFamilyName: app?.packageFamilyName ?? app?.PackageFamilyName,
          type: (app?.type ?? app?.Type ?? 'desktop').toLowerCase(),
          displayIcon: app?.displayIcon ?? app?.DisplayIcon,
        });

        const nextApps = {
          desktop: (message?.data?.desktop ?? []).map(normalize),
          store: (message?.data?.store ?? []).map(normalize),
        };
        cachedDebloaterApps = nextApps;
        cachedDebloaterLoaded = true;
        setDebloatApps(nextApps);
        setDebloatLoading(false);
      }

      if (message?.type === 'debloater' && message?.action === 'done') {
        setDebloatLogPath(message?.data?.logPath ?? null);
        setDebloatLoading(false);
        setDebloatSelected({});
        notify({ title: t(language, 'debloat.uninstall'), message: t(language, 'debloat.notifyDone'), kind: 'success', duration: 2600 });
        requestDebloatList();
        setTimeout(() => window.chrome?.webview?.postMessage('debloater-refresh'), 1800);
        setTimeout(() => window.chrome?.webview?.postMessage('debloater-refresh'), 4200);
      }
    };

    if (window.chrome?.webview) {
      window.chrome.webview.addEventListener('message', handleMessage);
      if (cachedDebloaterLoaded && cachedDebloaterApps) {
        setDebloatApps(cachedDebloaterApps);
        setDebloatLoading(false);
      } else {
        setDebloatLoading(true);
        window.chrome.webview.postMessage('debloater-list');
      }
    }

    return () => {
      if (window.chrome?.webview) {
        window.chrome.webview.removeEventListener('message', handleMessage);
      }
    };
  }, []);
  useEffect(() => onLanguageChange(setLanguage), []);

  const debloatList = useMemo(() => {
    const list = debloatTab === 'desktop' ? debloatApps.desktop : debloatApps.store;
    const filtered = list.filter((app) => {
      const term = debloatSearch.trim().toLowerCase();
      if (!term) return true;
      return app.name?.toLowerCase().includes(term) || app.publisher?.toLowerCase().includes(term);
    });

    const sorted = [...filtered].sort((a, b) => {
      if (debloatSort === 'size') {
        const av = a.estimatedSizeKb ?? 0;
        const bv = b.estimatedSizeKb ?? 0;
        return debloatAscending ? av - bv : bv - av;
      }
      if (debloatSort === 'date') {
        const ad = Date.parse(a.installDate ?? '') || 0;
        const bd = Date.parse(b.installDate ?? '') || 0;
        return debloatAscending ? ad - bd : bd - ad;
      }
      const an = a.name ?? '';
      const bn = b.name ?? '';
      return debloatAscending ? an.localeCompare(bn) : bn.localeCompare(an);
    });

    return sorted;
  }, [debloatApps, debloatTab, debloatSearch, debloatSort, debloatAscending]);

  const selectedApps = useMemo(
    () => [...debloatApps.desktop, ...debloatApps.store].filter((app) => debloatSelected[app.id]),
    [debloatApps, debloatSelected]
  );

  const selectedCount = selectedApps.length;

  const toggleSelection = (id: string) => {
    setDebloatSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSelectAll = () => {
    const allSelected = debloatList.every((app) => debloatSelected[app.id]);
    setDebloatSelected((prev) => {
      const next: Record<string, boolean> = { ...prev };
      debloatList.forEach((app) => {
        next[app.id] = !allSelected;
      });
      return next;
    });
  };

  
  

  const formatSize = (kb?: number) => {
    if (!kb || kb <= 0) return t(language, 'common.na');
    const mb = kb / 1024;
    if (mb > 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(0)} MB`;
  };

  return (
    <div className="tfy-themed-page tfy-page-debloater debloat-page h-full min-h-0 overflow-hidden flex flex-col gap-6">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="section-title">{t(language, 'debloat.kicker')}</p>
          <h1 className="text-3xl md:text-4xl font-display font-semibold text-white mt-3 flex items-center gap-3">
            <Trash2 size={26} className="text-accent" />
            {t(language, 'nav.debloating')}
          </h1>
          <p className="text-gray-400 mt-3 max-w-xl">
            {t(language, 'debloat.subtitle')}
          </p>
        </div>
      </div>

      <div className="panel panel-outline p-6 flex flex-col min-h-0 flex-1 overflow-hidden tfy-diagonal-glow">
        <div className="flex flex-wrap items-center gap-3">
          <div className="download-search debloat-search">
            <Search size={16} className="text-gray-400" />
            <input
              value={debloatSearch}
              onChange={(e) => setDebloatSearch(e.target.value)}
              placeholder={t(language, 'downloads.search')}
              className="bg-transparent text-sm outline-none text-white placeholder:text-gray-500 w-56"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <div className="relative">
              <button
                className="btn-ghost flex items-center gap-2"
                onClick={() => setSortOpen((prev) => !prev)}
              >
                <ArrowUpDown size={14} />
                {t(language, 'debloat.sort')}
                <ChevronDown size={14} />
              </button>
              {sortOpen && (
                <div className="absolute z-30 mt-2 w-48 rounded-xl border border-white/10 bg-black/90 backdrop-blur-xl p-2 shadow-lg">
                  {[
                    { key: 'name', label: t(language, 'debloat.sortName') },
                    { key: 'size', label: t(language, 'debloat.sortSize') },
                    { key: 'date', label: t(language, 'debloat.sortInstallDate') },
                  ].map((item) => (
                    <button
                      key={item.key}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm ${debloatSort === item.key ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                      onClick={() => {
                        setDebloatSort(item.key as 'name' | 'size' | 'date');
                        setDebloatAscending(true);
                        setSortOpen(false);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button className="btn-ghost flex items-center gap-2" onClick={requestDebloatList}>
              <RefreshCw size={14} />
              {t(language, 'backups.refresh')}
            </button>

            <button
              className="btn-primary debloat-primary text-black"
              disabled={!selectedCount}
              style={!selectedCount ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              onClick={() => setDebloatConfirmOpen(true)}
            >
              {t(language, 'debloat.uninstall')} ({selectedCount})
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 shrink-0">
          <button
            className={`btn-ghost ${debloatTab === 'desktop' ? 'border border-accent/60 text-white' : ''}`}
            onClick={() => setDebloatTab('desktop')}
          >
            <span className="flex items-center gap-2"><AppWindow size={14} /> {t(language, 'debloat.desktopApps')}</span>
          </button>
          <button
            className={`btn-ghost ${debloatTab === 'store' ? 'border border-accent/60 text-white' : ''}`}
            onClick={() => setDebloatTab('store')}
          >
            <span className="flex items-center gap-2"><Store size={14} /> {t(language, 'debloat.storeApps')}</span>
          </button>
        </div>

        <div className="mt-5 border border-white/10 rounded-2xl overflow-hidden flex flex-col min-h-0 flex-1">
          <div className="shrink-0 flex items-center gap-3 px-4 py-3 text-xs uppercase tracking-[0.28em] text-gray-400 border-b border-white/10">
            <input className="debloat-checkbox" type="checkbox" checked={debloatList.length > 0 && debloatList.every((app) => debloatSelected[app.id])} onChange={toggleSelectAll} />
            <div className="flex-1">{t(language, 'debloat.name')}</div>
            <div className="w-32 text-right">{t(language, 'debloat.size')}</div>
            <div className="w-32 text-right">{t(language, 'debloat.installed')}</div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {debloatList.map((app) => (
              <div key={app.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                <input className="debloat-checkbox" type="checkbox" checked={!!debloatSelected[app.id]} onChange={() => toggleSelection(app.id)} />
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden debloat-app-icon">
                    {app.displayIcon ? (
                      <img src={app.displayIcon} alt={app.name} className="w-8 h-8 object-contain" />
                    ) : (
                      <span className="text-sm text-accent font-semibold">{(app.name || '?')[0]}</span>
                    )}
                  </div>
                  <div>
                    <div className="text-white font-medium">{app.name}</div>
                    <div className="text-xs text-gray-500">
                      {(app.publisher ?? (app.type === 'store' ? 'Microsoft Store' : t(language, 'debloat.publisherUnavailable')))} | {app.version ?? t(language, 'common.na')}
                    </div>
                  </div>
                </div>
                <div className="w-32 text-right text-sm text-gray-300">{formatSize(app.estimatedSizeKb)}</div>
                <div className="w-32 text-right text-sm text-gray-400">{app.installDate ?? t(language, 'common.na')}</div>
              </div>
            ))}

            {!debloatList.length && !debloatLoading && (
              <div className="px-4 py-6 text-center text-gray-500">{t(language, 'debloat.noAppsFound')}</div>
            )}
            {debloatLoading && (
              <div className="px-4 py-6 text-center text-gray-500">{t(language, 'debloat.loadingList')}</div>
            )}
          </div>
        </div>

      </div>

      <Modal
        isOpen={debloatConfirmOpen}
        onClose={() => setDebloatConfirmOpen(false)}
        title={t(language, 'debloat.confirmTitle')}
        className="tfy-modal-deep"
      >
        <div className="text-gray-300 text-sm debloat-confirm-lead">
          {t(language, 'debloat.selectionInfo')}: <span className="text-white font-semibold">{selectedCount}</span>
        </div>
        <div className="panel panel-outline p-4 debloat-confirm-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-semibold">{t(language, 'debloat.deepClean')}</div>
              <div className="text-sm text-gray-500">{t(language, 'debloat.deepCleanDesc')}</div>
            </div>
            <button
              className={`toggle debloat-toggle ${debloatDeepClean ? 'on' : ''}`}
              onClick={() => setDebloatDeepClean((prev) => !prev)}
            >
              <div className="toggle-thumb"></div>
            </button>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {t(language, 'debloat.logInfo')}
        </div>
        <div className="flex items-center justify-end gap-3">
          <button className="btn-ghost" onClick={() => setDebloatConfirmOpen(false)}>{t(language, 'debloat.cancel')}</button>
          <button className="btn-primary debloat-primary text-black" onClick={runDebloat}>{t(language, 'debloat.confirm')}</button>
        </div>
      </Modal>
    </div>
  );
}
























