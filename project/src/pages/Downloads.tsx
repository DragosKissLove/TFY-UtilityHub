import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, ShieldCheck, Search } from 'lucide-react';
import rawDownloads from '../data/downloads.json';
import { notify } from '../lib/notify';
import { getLanguage, onLanguageChange, t, type TfyLanguage } from '../lib/i18n';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface RawItem {
  Title: string;
  Link: string;
  Tag?: string;
  version?: string;
  Version?: string;
  type?: string;
  Type?: string;
  size?: string;
  Size?: string;
}

interface AppItem {
  id: string;
  title: string;
  link: string;
  tag: string;
  version: string;
  type: string;
  size: string;
  domain: string;
  logoCandidates: string[];
  category: string;
}

const downloads = rawDownloads as RawItem[];
const GITHUB_LOGO_BASE = 'https://raw.githubusercontent.com/DragosKissLove/ceva-now-tool/main/LOGOS';
const LOGO_CACHE_KEY = 'tfy.downloads.logoCache.v1';

const normalizeForFiles = (input: string) => input
  .trim()
  .replace(/[\\/:*?"<>|]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const loadLogoCache = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(LOGO_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
};

const saveLogoCache = (cache: Record<string, string>) => {
  try {
    localStorage.setItem(LOGO_CACHE_KEY, JSON.stringify(cache));
  } catch {
  }
};

const getCachedLogoUrl = (title: string): string => {
  const key = normalizeForFiles(title).toLowerCase();
  const cache = loadLogoCache();
  return cache[key] || '';
};

const setCachedLogoUrl = (title: string, url: string) => {
  const key = normalizeForFiles(title).toLowerCase();
  const cache = loadLogoCache();
  if (cache[key] === url) return;
  cache[key] = url;
  saveLogoCache(cache);
};

const buildLogoCandidates = (title: string, tag: string) => {
  const t = normalizeForFiles(title);
  const variants = new Set<string>();

  const cached = getCachedLogoUrl(title);
  if (cached) variants.add(cached);

  // Prefer known filenames first to avoid many 404s (which cause the "slow icons" feeling).
  const legacy = getGithubLogo(title);
  if (legacy) {
    variants.add(legacy);
    return Array.from(variants);
  }

  // Minimal guessing: try only a couple of predictable patterns.
  const baseNames = [t, t.replace(/\s+/g, '_'), tag, tag.toLowerCase()];
  const exts = ['png', 'webp'];
  for (const bn of baseNames) {
    for (const ext of exts) {
      variants.add(`${GITHUB_LOGO_BASE}/${encodeURIComponent(`${bn}.${ext}`).replace(/%2F/g, '/')}`);
    }
  }

  return Array.from(variants);
};

const getGithubLogo = (title: string) => {
  const map: Array<{ match: RegExp; file: string }> = [
    { match: /brave/i, file: 'brave-browser-icon.png' },
    { match: /discord/i, file: 'discord-color-icon.png' },
    { match: /chrome/i, file: 'google-chrome-icon.png' },
    { match: /firefox|mozila/i, file: 'Mozilla_Firefox_icon-icons.com_66770.png' },
    { match: /opera/i, file: 'opera_gx_browser_logo_icon_152976.png' },
    { match: /spotify/i, file: 'Spotify_icon-icons.com_66783.png' },
    { match: /steam/i, file: 'steam_icon_135152.png' },
    { match: /notepad/i, file: 'Notepad_plus_plus.png' },
    { match: /vencord/i, file: 'vencord.png' },
    { match: /free download manager/i, file: 'free_download_manager_macos_bigsur_icon_190155.png' },
    { match: /sharex/i, file: 'ShareX_Logo_1024.png' },
    { match: /epic/i, file: 'Epic_Games_logo.png' },
    { match: /visual studio code/i, file: 'visual-studio-code-icon.png' },
    { match: /visual studio 2022/i, file: 'Visual_Studio_Icon_2022.svg.png' },
    { match: /vlc/i, file: 'vlc-media-player-computer-icons-download-others-2e784515f7098b5dd7c1cf9ad95065a8.png' },
    { match: /anydesk/i, file: 'anydesk_icon_146231.png' },
    { match: /msi afterburner/i, file: 'msi afterburner.png' },
    { match: /memreduct/i, file: 'mem-reduct-logo.png' },
    { match: /obs studio|\bobs\b/i, file: 'OBS_Studio_logo.png' },
    { match: /tuxler|vpn tuxler/i, file: 'Tuxler.png' },
    { match: /winrar|\brar\b/i, file: 'pngfind.com-winrar-icon-png-4423707.png' },
    { match: /stremio/i, file: 'stremio.png' },
    { match: /malwarebytes/i, file: 'Malwarebytes_Logo_Symbol.png' },
    { match: /fl studio/i, file: 'flstudio.png' },
    { match: /media encoder/i, file: 'adobe-media-encoder-icon.png' },
    { match: /after effects/i, file: 'adobe-after-effects-icon.png' },
    { match: /photoshop/i, file: 'photoshop.png' },
  ];
  const hit = map.find((x) => x.match.test(title));
  return hit ? `${GITHUB_LOGO_BASE}/${encodeURIComponent(hit.file).replace(/%2F/g, '/')}` : '';
};

const toAppItem = (item: RawItem, index: number): AppItem => {
  const title = (item.Title || '').trim();
  const link = item.Link || '';
  const tag = (item.Tag || title.slice(0, 4) || 'APP').toUpperCase();
  const version = (item.version || item.Version || '').trim();
  const type = (item.type || item.Type || '').trim();
  const size = (item.size || item.Size || '').trim();
  let domain = '';
  try {
    domain = new URL(link).hostname;
  } catch {
    domain = '';
  }

  const category = (item as any).Category || 'Apps';

  const logoCandidates = buildLogoCandidates(title, tag);
  return {
    id: `${tag}-${index}`,
    title,
    link,
    tag,
    version,
    type,
    size,
    domain,
    logoCandidates,
    category,
  };
};

export function Downloads() {
  const [query, setQuery] = useState('');
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<Record<string, { percent: number, mb: number, totalMb: number }>>({});
  const [activeCategory, setActiveCategory] = useState('Apps');
  const [language, setLanguage] = useState<TfyLanguage>(() => getLanguage());

  const [plugins, setPlugins] = useState<AppItem[]>([]);
  const [loadingPlugins, setLoadingPlugins] = useState(true);

  const categories = ['Apps', 'After Effects', 'Premier Pro', 'FL Studio', 'Photoshop'];

  useEffect(() => onLanguageChange(setLanguage), []);

  useEffect(() => {
    const fetchPlugins = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'plugins'));
        const cloudPlugins: AppItem[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          cloudPlugins.push({
            id: doc.id,
            title: data.title || '',
            link: data.scriptUrl || '',
            tag: data.tag || 'PLUG',
            version: data.version || 'v1.0',
            type: data.type || 'Plugin',
            size: data.size || 'Remote',
            domain: 'GraphicX / TFY Cloud',
            logoCandidates: data.logoUrl ? [data.logoUrl] : buildLogoCandidates(data.title || '', data.tag || 'PLUG'),
            category: data.category || 'After Effects'
          });
        });
        setPlugins(cloudPlugins);
      } catch (e) {
        console.error("Firebase fetch error", e);
      } finally {
        setLoadingPlugins(false);
      }
    };
    fetchPlugins();
  }, []);

  useEffect(() => {
    const handler = (event: any) => {
      let message = event.data;
      if (typeof message === 'string') {
        try {
          message = JSON.parse(message);
        } catch {
          return;
        }
      }

      if (message?.type === 'download-progress') {
        const { id, percent, mb, totalMb } = message;
        setDownloadProgress(prev => ({ ...prev, [id]: { percent, mb, totalMb } }));
      }

      if (message?.type === 'downloads' && message?.action === 'result') {
        const id = message?.data?.id as string;
        const ok = Boolean(message?.data?.ok ?? true);
        const text = message?.data?.message || (ok ? t(language, 'downloads.ready') : t(language, 'downloads.failed'));

        setDownloading((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setDownloadProgress((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });

        notify({
          title: ok ? 'Download Ready' : 'Download Failed',
          message: text,
          kind: ok ? 'success' : 'error',
          duration: ok ? 3600 : 5200,
        });
      }
    };

    if (window.chrome?.webview) {
      window.chrome.webview.addEventListener('message', handler);
    }

    return () => {
      if (window.chrome?.webview) {
        window.chrome.webview.removeEventListener('message', handler);
      }
    };
  }, [language]);

  const items = useMemo(() => {
    const allItems = [...downloads.map(toAppItem), ...plugins];
    return allItems
      .filter((item) => item.category === activeCategory)
      .filter((item) => item.title.toLowerCase().includes(query.toLowerCase()));
  }, [query, activeCategory, plugins]);

  const handleDownload = (item: AppItem) => {
    setDownloading((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });

    const payload = JSON.stringify({ id: item.id, title: item.title, link: item.link });
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(`download-install|${payload}`);
    } else {
      window.open(item.link, '_blank');
      setDownloading((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      notify({ title: 'External Download', message: t(language, 'downloads.external'), kind: 'info', duration: 2400 });
    }
  };

  return (
    <div className="tfy-themed-page tfy-page-downloads h-full overflow-hidden flex flex-col gap-5">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="section-title">SOFTWARE & PLUGINS</p>
          <h1 className="text-3xl md:text-4xl font-display font-semibold text-white mt-3">{t(language, 'downloads.title')}</h1>
          <p className="text-gray-400 mt-3 max-w-xl">
            {t(language, 'downloads.sub')}
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <span className="chip flex items-center gap-2"><ShieldCheck size={14} /> {t(language, 'downloads.verified')}</span>
            <span className="chip">{t(language, 'downloads.fastInstall')}</span>
          </div>
        </div>
        <div className="download-search">
          <Search size={16} className="text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(language, 'downloads.search')}
            className="bg-transparent text-sm text-white outline-none w-full"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 shrink-0 border-b border-white/5">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2.5 rounded-t-xl whitespace-nowrap text-sm font-semibold transition-all relative ${activeCategory === cat
              ? 'text-accent'
              : 'text-gray-400 hover:text-white'
              }`}
          >
            {cat}
            {activeCategory === cat && (
              <div className="absolute bottom-0 left-0 w-full h-[2px] bg-accent shadow-[0_-2px_10px_rgba(var(--accent-rgb),0.5)]" />
            )}
          </button>
        ))}
      </div>

      {loadingPlugins && activeCategory !== 'Apps' ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center py-10 opacity-70">
          <div className="mb-4">
            <Loader2 size={32} className="text-accent animate-spin" />
          </div>
          <p className="text-gray-400 font-medium">Se descarcă datele din cloud...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center py-10 opacity-70">
          <div className="mb-4">
            <Loader2 size={32} className="text-accent animate-spin" />
          </div>
          <p className="text-gray-400 font-medium">Nu am găsit rezultate pentru "{activeCategory}"</p>
          <p className="text-sm text-gray-500 mt-1">Întoarce-te mai târziu, adăugăm resurse noi curând!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto no-scrollbar pr-1 pb-16 flex-1 content-start scroll-smooth">
          {items.map((app) => (
            <div key={app.id} className="download-card tfy-diagonal-glow">
              <div className="download-card-head">
                <div className="download-logo" data-loaded="false" style={{ position: 'relative' }}>
                  {app.category !== 'Apps' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/5 rounded-xl pointer-events-none">
                      <span className="font-display font-bold text-gray-500/30 text-xl select-none">{app.title.charAt(0)}</span>
                    </div>
                  )}
                  {app.logoCandidates.length > 0 && (
                    <img
                      src={app.logoCandidates[0]}
                      alt=""
                      className={`relative z-10 transition-opacity duration-300 ${app.category !== 'Apps' ? 'w-full h-full object-cover rounded-xl' : ''}`}
                      style={{ opacity: 0 }}
                      loading="eager"
                      decoding="async"
                      onLoad={(e) => {
                        e.currentTarget.parentElement?.setAttribute('data-loaded', 'true');
                        e.currentTarget.style.opacity = '1';
                        const finalUrl = e.currentTarget.currentSrc || e.currentTarget.src;
                        if (finalUrl) setCachedLogoUrl(app.title, finalUrl);
                      }}
                      onError={(e) => {
                        const img = e.currentTarget;
                        const idxRaw = img.getAttribute('data-fallback');
                        const idx = idxRaw ? Number(idxRaw) : 0;
                        const nextIndex = Number.isFinite(idx) ? idx + 1 : 1;
                        if (nextIndex < app.logoCandidates.length) {
                          img.setAttribute('data-fallback', String(nextIndex));
                          img.src = app.logoCandidates[nextIndex];
                          return;
                        }
                        img.style.display = 'none';
                      }}
                    />
                  )}
                  {app.category === 'Apps' && <span className="download-tag">{app.tag.slice(0, 3)}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-white font-semibold truncate">{app.title}</div>
                  <div className="text-xs text-gray-400 truncate">{app.type || 'Freeware'}{app.version && app.version !== 'LATEST' ? ` • ${app.version}` : ''}</div>
                </div>
              </div>

              <div className="download-meta">
                <span>{app.size || 'Size: N/A'}</span>
                <span className="download-domain">{app.domain || 'Direct link'}</span>
              </div>

              <div className="download-action-row">
                <button
                  onClick={() => handleDownload(app)}
                  disabled={downloading.has(app.id)}
                  className={`fix-action resource-action download-btn view-details-btn ${downloading.has(app.id) ? 'downloaded' : ''}`}
                  style={{ display: 'inline-flex', opacity: 1, visibility: 'visible' }}
                >
                  <Download size={15} />
                  <span>
                    {downloading.has(app.id)
                      ? (downloadProgress[app.id] ? `${downloadProgress[app.id].percent}% (${downloadProgress[app.id].mb} MB)` : t(language, 'downloads.downloading'))
                      : t(language, 'downloads.download')}
                  </span>
                  {downloading.has(app.id) && <Loader2 size={14} className="spin-loader" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
