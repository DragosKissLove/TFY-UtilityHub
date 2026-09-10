import { useEffect, useMemo, useState } from 'react';
import { Search, ArrowUpDown, RefreshCw, Trash2, AppWindow, Store, Power, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';
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
  type: 'desktop' | 'store' | 'startup';
  displayIcon?: string;
  uninstallString?: string;
  quietUninstallString?: string;
  installLocation?: string;
  packageFullName?: string;
  packageFamilyName?: string;
  enabled?: boolean;
}

type SortField = 'name' | 'size' | 'date' | 'publisher' | 'status';

let cachedDebloaterApps: { desktop: DebloaterApp[]; store: DebloaterApp[]; startup: DebloaterApp[] } | null = null;
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
  const [debloatTab, setDebloatTab] = useState<'desktop' | 'store' | 'startup'>('desktop');
  const [debloatSearch, setDebloatSearch] = useState('');
  const [debloatSort, setDebloatSort] = useState<SortField>('name');
  const [debloatAscending, setDebloatAscending] = useState(true);
  const [debloatLoading, setDebloatLoading] = useState(false);
  const [debloatApps, setDebloatApps] = useState<{ desktop: DebloaterApp[]; store: DebloaterApp[]; startup: DebloaterApp[] }>(() => cachedDebloaterApps || { desktop: [], store: [], startup: [] });
  const [debloatSelected, setDebloatSelected] = useState<Record<string, boolean>>({});
  const [debloatConfirmOpen, setDebloatConfirmOpen] = useState(false);
  const [debloatDeepClean, setDebloatDeepClean] = useState(true);
  const [debloatLogPath, setDebloatLogPath] = useState<string | null>(null);
  const [language, setLanguage] = useState<TfyLanguage>(() => getLanguage());

  const selectRecommendedStoreApps = () => {
    const recommendedBloatware = [
      "Microsoft.BingWeather",
      "Microsoft.GetHelp",
      "Microsoft.Getstarted",
      "Microsoft.Messaging",
      "Microsoft.Microsoft3DViewer",
      "Microsoft.MicrosoftOfficeHub",
      "Microsoft.MicrosoftSolitaireCollection",
      "Microsoft.MixedReality.Portal",
      "Microsoft.Office.OneNote",
      "Microsoft.People",
      "Microsoft.Print3D",
      "Microsoft.SkypeApp",
      "Microsoft.WindowsAlarms",
      "Microsoft.WindowsCamera",
      "microsoft.windowscommunicationsapps",
      "Microsoft.WindowsFeedbackHub",
      "Microsoft.WindowsMaps",
      "Microsoft.WindowsSoundRecorder",
      "Microsoft.XboxApp",
      "Microsoft.XboxGamingOverlay",
      "Microsoft.XboxSpeechToTextOverlay",
      "Microsoft.YourPhone",
      "Microsoft.ZuneMusic",
      "Microsoft.ZuneVideo",
      "Microsoft.Todos",
      "Microsoft.Wallet"
    ].map(s => s.toLowerCase());

    setDebloatSelected((prev) => {
      const next: Record<string, boolean> = { ...prev };
      debloatApps.store.forEach((app) => {
        const familyMatch = app.packageFamilyName ? recommendedBloatware.some(b => app.packageFamilyName!.toLowerCase().includes(b)) : false;
        const idMatch = recommendedBloatware.some(b => app.id.toLowerCase().includes(b));
        if (familyMatch || idMatch) {
          next[app.id] = true;
        }
      });
      return next;
    });
    notify({ title: "Selected", message: "Recommended bloatware marked.", kind: 'info', duration: 2000 });
  };

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
    const startupItems = items.filter(i => i.type === 'startup');
    const otherItems = items.filter(i => i.type !== 'startup');
    if (otherItems.length > 0) {
      window.chrome.webview.postMessage(`debloater-uninstall|${JSON.stringify({ items: otherItems, deepClean: debloatDeepClean })}`);
    }
    if (startupItems.length > 0) {
      window.chrome.webview.postMessage(`startup-disable|${JSON.stringify({ items: startupItems })}`);
    }
  };

  const requestDebloatList = () => {
    setDebloatLoading(true);
    notify({ title: t(language, 'backups.refresh'), message: t(language, 'debloat.loadingList'), kind: 'info', duration: 1600 });
    window.chrome?.webview?.postMessage('debloater-refresh');
  };

  const handleHeaderSortClick = (field: SortField) => {
    if (debloatSort === field) {
      setDebloatAscending((prev) => !prev);
    } else {
      setDebloatSort(field);
      setDebloatAscending(field !== 'size' && field !== 'date');
    }
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
          enabled: app?.enabled ?? app?.Enabled ?? true,
          type: (app?.type ?? app?.Type ?? 'desktop').toLowerCase(),
          displayIcon: app?.displayIcon ?? app?.DisplayIcon,
        });

        const nextApps = {
          desktop: (message?.data?.desktop ?? []).map(normalize),
          store: (message?.data?.store ?? []).map(normalize),
          startup: (message?.data?.startup ?? []).map(normalize),
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
    const list = debloatTab === 'desktop' ? debloatApps.desktop : debloatTab === 'store' ? debloatApps.store : debloatApps.startup;
    const term = debloatSearch.trim().toLowerCase();
    const filtered = term
      ? list.filter((app) => (
          app.name?.toLowerCase().includes(term) ||
          app.publisher?.toLowerCase().includes(term) ||
          app.version?.toLowerCase().includes(term)
        ))
      : list;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (debloatSort === 'size') {
        const av = a.estimatedSizeKb ?? 0;
        const bv = b.estimatedSizeKb ?? 0;
        cmp = av - bv;
      } else if (debloatSort === 'date') {
        const ad = Date.parse(a.installDate ?? '') || 0;
        const bd = Date.parse(b.installDate ?? '') || 0;
        cmp = ad - bd;
      } else if (debloatSort === 'publisher') {
        const ap = a.publisher ?? '';
        const bp = b.publisher ?? '';
        cmp = ap.localeCompare(bp);
      } else if (debloatSort === 'status') {
        const as = a.enabled !== false ? 1 : 0;
        const bs = b.enabled !== false ? 1 : 0;
        cmp = as - bs;
      } else {
        const an = a.name ?? '';
        const bn = b.name ?? '';
        cmp = an.localeCompare(bn);
      }

      return debloatAscending ? cmp : -cmp;
    });
  }, [debloatApps, debloatTab, debloatSearch, debloatSort, debloatAscending]);

  const selectedApps = useMemo(
    () => [...debloatApps.desktop, ...debloatApps.store, ...debloatApps.startup].filter((app) => debloatSelected[app.id]),
    [debloatApps, debloatSelected]
  );

  const selectedCount = selectedApps.length;

  const toggleSelection = (id: string) => {
    setDebloatSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSelectAll = () => {
    const allSelected = debloatList.length > 0 && debloatList.every((app) => debloatSelected[app.id]);
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
    <div className="tfy-themed-page tfy-page-debloater debloat-page h-full min-h-0 overflow-hidden flex flex-col gap-5">
      {/* Header */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="section-title">{t(language, 'debloat.kicker')}</p>
          <h1 className="text-2xl md:text-3xl font-display font-semibold text-white mt-2 flex items-center gap-2.5">
            <Trash2 size={24} className="text-accent" />
            {t(language, 'nav.debloating')}
          </h1>
          <p className="text-gray-400 mt-2 max-w-xl text-xs md:text-sm">
            {t(language, 'debloat.subtitle')}
          </p>
        </div>
      </div>

      {/* Main Panel */}
      <div className="panel panel-outline p-5 flex flex-col min-h-0 flex-1 overflow-hidden tfy-diagonal-glow">
        {/* Controls Toolbar (Top Row) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-xs text-white focus-within:border-white/25 focus-within:bg-white/[0.06] transition-all min-w-[180px] flex-1 sm:flex-none">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              value={debloatSearch}
              onChange={(e) => setDebloatSearch(e.target.value)}
              placeholder={t(language, 'downloads.search')}
              className="bg-transparent text-xs outline-none text-white placeholder:text-gray-500 w-full"
            />
          </div>

          {/* Minimalist Segmented Sort Pills */}
          <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-lg border border-white/10 text-xs">
            <span className="text-gray-500 text-[11px] px-1.5 font-medium flex items-center gap-1">
              <ArrowUpDown size={12} className="text-accent" />
              <span>Sort:</span>
            </span>

            <button
              type="button"
              onClick={() => {
                if (debloatSort === 'name') {
                  setDebloatAscending((prev) => !prev);
                } else {
                  setDebloatSort('name');
                  setDebloatAscending(true);
                }
              }}
              className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 cursor-pointer ${
                debloatSort === 'name'
                  ? 'bg-white/15 text-white shadow-sm border border-white/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <span>Nume</span>
              {debloatSort === 'name' && (
                debloatAscending ? <ArrowUp size={12} className="text-accent" /> : <ArrowDown size={12} className="text-accent" />
              )}
            </button>

            {debloatTab !== 'startup' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (debloatSort === 'size') {
                      setDebloatAscending((prev) => !prev);
                    } else {
                      setDebloatSort('size');
                      setDebloatAscending(false);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 cursor-pointer ${
                    debloatSort === 'size'
                      ? 'bg-white/15 text-white shadow-sm border border-white/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <span>Dimensiune</span>
                  {debloatSort === 'size' && (
                    debloatAscending ? <ArrowUp size={12} className="text-accent" /> : <ArrowDown size={12} className="text-accent" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (debloatSort === 'date') {
                      setDebloatAscending((prev) => !prev);
                    } else {
                      setDebloatSort('date');
                      setDebloatAscending(false);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 cursor-pointer ${
                    debloatSort === 'date'
                      ? 'bg-white/15 text-white shadow-sm border border-white/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <span>Dată</span>
                  {debloatSort === 'date' && (
                    debloatAscending ? <ArrowUp size={12} className="text-accent" /> : <ArrowDown size={12} className="text-accent" />
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (debloatSort === 'status') {
                      setDebloatAscending((prev) => !prev);
                    } else {
                      setDebloatSort('status');
                      setDebloatAscending(true);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 cursor-pointer ${
                    debloatSort === 'status'
                      ? 'bg-white/15 text-white shadow-sm border border-white/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <span>Status</span>
                  {debloatSort === 'status' && (
                    debloatAscending ? <ArrowUp size={12} className="text-accent" /> : <ArrowDown size={12} className="text-accent" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (debloatSort === 'publisher') {
                      setDebloatAscending((prev) => !prev);
                    } else {
                      setDebloatSort('publisher');
                      setDebloatAscending(true);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 cursor-pointer ${
                    debloatSort === 'publisher'
                      ? 'bg-white/15 text-white shadow-sm border border-white/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <span>Sursă</span>
                  {debloatSort === 'publisher' && (
                    debloatAscending ? <ArrowUp size={12} className="text-accent" /> : <ArrowDown size={12} className="text-accent" />
                  )}
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Refresh Button */}
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 border bg-white/[0.03] text-gray-300 border-white/10 hover:text-white hover:bg-white/[0.06] hover:border-white/20 shadow-sm cursor-pointer disabled:opacity-50"
              onClick={requestDebloatList}
              disabled={debloatLoading}
              title={t(language, 'backups.refresh')}
            >
              <RefreshCw size={13} className={debloatLoading ? 'animate-spin text-accent' : 'text-accent'} />
              <span>{t(language, 'backups.refresh')}</span>
            </button>

            {/* Uninstall Button */}
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 border shadow-sm ${
                selectedCount > 0
                  ? 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30 hover:border-red-500/60 shadow-[0_0_15px_-3px_rgba(239,68,68,0.3)] cursor-pointer'
                  : 'bg-white/[0.02] text-gray-500 border-white/5 opacity-50 cursor-not-allowed'
              }`}
              disabled={!selectedCount}
              onClick={() => setDebloatConfirmOpen(true)}
            >
              <Trash2 size={13} className={selectedCount > 0 ? 'text-red-400' : 'text-gray-500'} />
              <span>{t(language, 'debloat.uninstall')}</span>
              {selectedCount > 0 && (
                <span className="text-[11px] px-1.5 py-0.2 rounded bg-red-500/30 text-white font-mono font-bold">
                  {selectedCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 border cursor-pointer ${
              debloatTab === 'desktop'
                ? 'bg-white/10 text-white border-white/20 shadow-sm'
                : 'bg-white/[0.03] text-gray-400 border-white/5 hover:text-white hover:bg-white/[0.06]'
            }`}
            onClick={() => setDebloatTab('desktop')}
          >
            <AppWindow size={14} className={debloatTab === 'desktop' ? 'text-accent' : 'text-gray-400'} />
            <span>{t(language, 'debloat.desktopApps')}</span>
            <span className={`text-[11px] px-1.5 py-0.2 rounded font-mono ${
              debloatTab === 'desktop' ? 'bg-white/15 text-white font-semibold' : 'bg-white/5 text-gray-400'
            }`}>
              {debloatApps.desktop.length}
            </span>
          </button>

          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 border cursor-pointer ${
              debloatTab === 'store'
                ? 'bg-white/10 text-white border-white/20 shadow-sm'
                : 'bg-white/[0.03] text-gray-400 border-white/5 hover:text-white hover:bg-white/[0.06]'
            }`}
            onClick={() => setDebloatTab('store')}
          >
            <Store size={14} className={debloatTab === 'store' ? 'text-accent' : 'text-gray-400'} />
            <span>{t(language, 'debloat.storeApps')}</span>
            <span className={`text-[11px] px-1.5 py-0.2 rounded font-mono ${
              debloatTab === 'store' ? 'bg-white/15 text-white font-semibold' : 'bg-white/5 text-gray-400'
            }`}>
              {debloatApps.store.length}
            </span>
          </button>

          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 border cursor-pointer ${
              debloatTab === 'startup'
                ? 'bg-white/10 text-white border-white/20 shadow-sm'
                : 'bg-white/[0.03] text-gray-400 border-white/5 hover:text-white hover:bg-white/[0.06]'
            }`}
            onClick={() => setDebloatTab('startup')}
          >
            <Power size={14} className={debloatTab === 'startup' ? 'text-accent' : 'text-gray-400'} />
            <span>Startup Apps</span>
            <span className={`text-[11px] px-1.5 py-0.2 rounded font-mono ${
              debloatTab === 'startup' ? 'bg-white/15 text-white font-semibold' : 'bg-white/5 text-gray-400'
            }`}>
              {debloatApps.startup.length}
            </span>
          </button>

          {debloatTab === 'store' && (
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border bg-accent/10 text-accent border-accent/30 hover:bg-accent/20 hover:border-accent/50 shadow-sm ml-auto cursor-pointer"
              onClick={selectRecommendedStoreApps}
            >
              <Sparkles size={13} />
              <span>Select Recommended</span>
            </button>
          )}
        </div>

        {/* Table Area */}
        <div className="mt-4 border border-white/10 rounded-2xl overflow-hidden flex flex-col min-h-0 flex-1 bg-black/20">
          {/* Table Column Headers with Interactive Sort */}
          <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 text-[11px] uppercase tracking-[0.18em] text-gray-400 border-b border-white/10 bg-white/[0.03] select-none">
            <input
              className="debloat-checkbox"
              type="checkbox"
              checked={debloatList.length > 0 && debloatList.every((app) => debloatSelected[app.id])}
              onChange={toggleSelectAll}
            />

            {/* Name Column Header (Sortable) */}
            <div className="flex-1">
              <button
                type="button"
                onClick={() => handleHeaderSortClick('name')}
                className="flex items-center gap-1.5 py-1 px-2 -ml-2 rounded-lg hover:bg-white/10 hover:text-white transition-all cursor-pointer text-left uppercase font-semibold text-[11px]"
              >
                <span>{t(language, 'debloat.name')}</span>
                {debloatSort === 'name' ? (
                  debloatAscending ? <ArrowUp size={12} className="text-accent" /> : <ArrowDown size={12} className="text-accent" />
                ) : (
                  <ArrowUpDown size={11} className="text-gray-500 opacity-40 hover:opacity-100" />
                )}
              </button>
            </div>

            {debloatTab === 'startup' ? (
              <>
                {/* Source Column Header (Sortable) */}
                <div className="w-36 text-right">
                  <button
                    type="button"
                    onClick={() => handleHeaderSortClick('publisher')}
                    className="flex items-center justify-end gap-1.5 py-1 px-2 -mr-2 rounded-lg hover:bg-white/10 hover:text-white transition-all cursor-pointer uppercase font-semibold text-[11px] ml-auto"
                  >
                    <span>Source</span>
                    {debloatSort === 'publisher' ? (
                      debloatAscending ? <ArrowUp size={12} className="text-accent" /> : <ArrowDown size={12} className="text-accent" />
                    ) : (
                      <ArrowUpDown size={11} className="text-gray-500 opacity-40 hover:opacity-100" />
                    )}
                  </button>
                </div>

                {/* Status Column Header (Sortable) */}
                <div className="w-48 text-right">
                  <button
                    type="button"
                    onClick={() => handleHeaderSortClick('status')}
                    className="flex items-center justify-end gap-1.5 py-1 px-2 -mr-2 rounded-lg hover:bg-white/10 hover:text-white transition-all cursor-pointer uppercase font-semibold text-[11px] ml-auto"
                  >
                    <span>Status</span>
                    {debloatSort === 'status' ? (
                      debloatAscending ? <ArrowUp size={12} className="text-accent" /> : <ArrowDown size={12} className="text-accent" />
                    ) : (
                      <ArrowUpDown size={11} className="text-gray-500 opacity-40 hover:opacity-100" />
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Size Column Header (Sortable) */}
                <div className="w-32 text-right">
                  <button
                    type="button"
                    onClick={() => handleHeaderSortClick('size')}
                    className="flex items-center justify-end gap-1.5 py-1 px-2 -mr-2 rounded-lg hover:bg-white/10 hover:text-white transition-all cursor-pointer uppercase font-semibold text-[11px] ml-auto"
                  >
                    <span>{t(language, 'debloat.size')}</span>
                    {debloatSort === 'size' ? (
                      debloatAscending ? <ArrowUp size={12} className="text-accent" /> : <ArrowDown size={12} className="text-accent" />
                    ) : (
                      <ArrowUpDown size={11} className="text-gray-500 opacity-40 hover:opacity-100" />
                    )}
                  </button>
                </div>

                {/* Installed Date Column Header (Sortable) */}
                <div className="w-36 text-right">
                  <button
                    type="button"
                    onClick={() => handleHeaderSortClick('date')}
                    className="flex items-center justify-end gap-1.5 py-1 px-2 -mr-2 rounded-lg hover:bg-white/10 hover:text-white transition-all cursor-pointer uppercase font-semibold text-[11px] ml-auto"
                  >
                    <span>{t(language, 'debloat.installed')}</span>
                    {debloatSort === 'date' ? (
                      debloatAscending ? <ArrowUp size={12} className="text-accent" /> : <ArrowDown size={12} className="text-accent" />
                    ) : (
                      <ArrowUpDown size={11} className="text-gray-500 opacity-40 hover:opacity-100" />
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Table List Items */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {debloatList.map((app) => (
              <div
                key={app.id}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 hover:bg-white/[0.04] transition-colors group"
              >
                <input
                  className="debloat-checkbox"
                  type="checkbox"
                  checked={!!debloatSelected[app.id]}
                  onChange={() => toggleSelection(app.id)}
                />
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden debloat-app-icon shrink-0 bg-white/5 border border-white/10 group-hover:border-white/30 transition-colors">
                    {app.displayIcon ? (
                      <img src={app.displayIcon} alt={app.name} className="w-6 h-6 object-contain" />
                    ) : (
                      <span className="text-xs text-accent font-bold">{(app.name || '?')[0]}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-medium text-xs md:text-sm truncate group-hover:text-accent transition-colors">
                      {app.name}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate mt-0.5">
                      {(app.publisher ?? (app.type === 'store' ? 'Microsoft Store' : t(language, 'debloat.publisherUnavailable')))} | {app.version ?? t(language, 'common.na')}
                    </div>
                  </div>
                </div>

                {debloatTab === 'startup' ? (
                  <>
                    <div className="w-36 text-right text-xs text-gray-400 truncate">{app.publisher ?? 'Registry'}</div>
                    <div className="w-48 flex justify-end">
                      <button
                        type="button"
                        className={`startup-toggle ${app.enabled !== false ? 'on' : ''}`}
                        title={app.enabled !== false ? 'Click to disable from startup' : 'Click to enable on startup'}
                        onClick={() => {
                          window.chrome?.webview?.postMessage(`startup-toggle|${JSON.stringify({ id: app.id, name: app.name, installLocation: app.installLocation, enable: app.enabled === false })}`);
                          setDebloatApps(prev => ({
                            ...prev,
                            startup: prev.startup.map(a => a.id === app.id ? { ...a, enabled: app.enabled === false } : a)
                          }));
                        }}
                      >
                        <div className="toggle-thumb" />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-32 text-right text-xs font-mono text-gray-300">{formatSize(app.estimatedSizeKb)}</div>
                    <div className="w-36 text-right text-xs text-gray-400">{app.installDate ?? t(language, 'common.na')}</div>
                  </>
                )}
              </div>
            ))}

            {!debloatList.length && !debloatLoading && (
              <div className="px-4 py-12 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
                <Trash2 size={26} className="text-gray-600 opacity-40" />
                <p className="text-xs">{t(language, 'debloat.noAppsFound')}</p>
              </div>
            )}

            {debloatLoading && !debloatList.length && (
              <div className="px-4 py-12 text-center text-gray-500 flex flex-col items-center justify-center gap-2.5">
                <RefreshCw size={22} className="animate-spin text-accent" />
                <p className="text-xs text-gray-400">{t(language, 'debloat.loadingList')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
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
              type="button"
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
          <button type="button" className="btn-ghost" onClick={() => setDebloatConfirmOpen(false)}>{t(language, 'debloat.cancel')}</button>
          <button type="button" className="btn-primary debloat-primary text-black" onClick={runDebloat}>{t(language, 'debloat.confirm')}</button>
        </div>
      </Modal>

      <style>{`
        .startup-toggle { width: 36px; height: 20px; border-radius: 10px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.1); cursor: pointer; position: relative; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        .startup-toggle:hover { border-color: rgba(255,255,255,0.25); }
        .startup-toggle.on { background: var(--accent); border-color: var(--accent); }
        .startup-toggle .toggle-thumb { width: 14px; height: 14px; border-radius: 50%; background: white; position: absolute; top: 2px; left: 2px; transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        .startup-toggle.on .toggle-thumb { transform: translateX(16px); }
      `}</style>
    </div>
  );
}
