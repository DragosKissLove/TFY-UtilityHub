import { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, X } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { NotificationCenter, type NotificationItem, type NotificationKind } from './components/NotificationCenter';
import { Home } from './pages/Home';
import { Backups } from './pages/Backups';
import { Fixes } from './pages/Fixes';
import { Gaming } from './pages/Gaming';
import { GamingTweaks } from './pages/GamingTweaks';
import { SystemTweaks } from './pages/SystemTweaks';
import { Downloads } from './pages/Downloads';
import { Debloater } from './pages/Debloater';
import { Testing } from './pages/Testing';
import { Info } from './pages/Info';
import type { Page } from './types';
import splashLogo from './assets/TFY-logo.png';
import { getLanguage, t, onLanguageChange } from './lib/i18n';
import { WelcomeTour } from './components/WelcomeTour';
import { UpdateModal } from './components/UpdateModal';

declare global {
  interface Window {
    __tfyAccess?: {
      premium: boolean | null;
      testing: boolean | null;
    };
  }
}

function App() {
  const bootTheme = (() => {
    try {
      const raw = localStorage.getItem('tfy.setting.theme') || 'jade';
      return ['jade', 'midnight', 'slate', 'sunset', 'red', 'pink'].includes(raw) ? raw : 'jade';
    } catch {
      return 'jade';
    }
  })();
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-tfy-theme', bootTheme);
  }

  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [loading, setLoading] = useState(true);
  const [loadingFade, setLoadingFade] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const isHome = currentPage === 'home';
  const isDebloater = currentPage === 'debloater';
  const hideScroll = ['gaming', 'gaming_tweaks', 'system', 'downloads', 'backups', 'fixes'].includes(currentPage);

  const [bootLanguage, setBootLanguage] = useState(getLanguage());
  useEffect(() => onLanguageChange(setBootLanguage), []);

  const [showTour, setShowTour] = useState(() => {
    try {
      return !localStorage.getItem('tfy-tour-completed');
    } catch { return false; }
  });

  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('tfy.setting.theme') || 'jade';
      const allowed = ['jade', 'midnight', 'slate', 'sunset', 'red', 'pink'];
      const theme = allowed.includes(raw) ? raw : 'jade';
      document.documentElement.setAttribute('data-tfy-theme', theme);
      if (raw !== theme) {
        localStorage.setItem('tfy.setting.theme', theme);
      }
    } catch {
    }

    // Smooth boot: hold a bit longer, then fade out gently before showing the app.
    const fadeTimer = setTimeout(() => setLoadingFade(true), 2400);
    const doneTimer = setTimeout(() => {
      setLoading(false);
      // Auto-check for updates on launch
      if (window.chrome?.webview) {
        window.chrome.webview.postMessage('update-check');
      }
    }, 3400);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  const dismissNotification = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }

    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, closing: true } : item)));

    setTimeout(() => {
      setNotifications((prev) => prev.filter((item) => item.id !== id));
    }, 220);
  }, []);

  const pushNotification = useCallback((input: any) => {
    const raw = typeof input === 'string' ? { message: input } : (input || {});
    const message = String(raw.message || '').trim();
    if (!message) return;

    const kind = (raw.kind || 'info') as NotificationKind;
    const title = String(raw.title || (kind === 'success' ? 'Success' : kind === 'error' ? 'Error' : kind === 'warning' ? 'Warning' : 'Notification'));
    const duration = Math.max(1800, Math.min(12000, Number(raw.duration || 4200)));
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setNotifications((prev) => [...prev, { id, title, message, kind, duration, createdAt: Date.now() }].slice(-6));

    const timer = setTimeout(() => dismissNotification(id), duration);
    timersRef.current.set(id, timer);
  }, [dismissNotification]);

  useEffect(() => {
    window.__tfyNotify = pushNotification;
    return () => {
      delete window.__tfyNotify;
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [pushNotification]);

  useEffect(() => {
    if (!window.__tfyAccess) {
      window.__tfyAccess = { premium: null, testing: null };
    }

    const handler = (event: any) => {
      let message = event.data;
      if (typeof message === 'string') {
        try {
          message = JSON.parse(message);
        } catch {
          return;
        }
      }

      if (message?.type === 'premium') {
        window.__tfyAccess!.premium = Boolean(message?.data?.enabled);
      }
      if (message?.type === 'testing') {
        window.__tfyAccess!.testing = Boolean(message?.data?.enabled);
      }
      if (message?.type === 'notify') {
        pushNotification(message?.data || message);
      }
      if (message?.type === 'dlcunlocker') {
        try {
          window.dispatchEvent(new CustomEvent('tfy-dlcunlocker', { detail: message }));
        } catch (_) { }
      }
      if (message?.type === 'activator') {
        try {
          window.dispatchEvent(new CustomEvent('tfy-activator', { detail: message }));
        } catch (_) { }
      }
      if (message?.type === 'update') {
        if (message.action === 'available') {
          setUpdateInfo(message.data);
          setShowUpdateModal(true);
        }
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
  }, [pushNotification]);

  useEffect(() => {
    const handler = (event: Event) => {
      const page = (event as CustomEvent<Page>).detail;
      if (!page) return;
      setCurrentPage(page);
    };

    const tourHandler = () => {
      setShowTour(true);
    };

    window.addEventListener('tfy-nav', handler as EventListener);
    window.addEventListener('tfy-tour-replay', tourHandler);

    return () => {
      window.removeEventListener('tfy-nav', handler as EventListener);
      window.removeEventListener('tfy-tour-replay', tourHandler);
    }
  }, []);

  const sendHostMessage = (message: string) => {
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(message);
    }
  };

  const renderPage = () => {
    switch (currentPage) {

      case 'backups':
        return <Backups />;
      case 'fixes':
        return <Fixes />;
      case 'gaming':
        return <Gaming />;
      case 'gaming_tweaks':
        return <GamingTweaks />;
      case 'system':
        return <SystemTweaks />;
      case 'debloater':
        return <Debloater />;
      case 'testing':
        return <Testing />;
      case 'downloads':
        return <Downloads />;
      case 'info':
        return <Info />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen overflow-hidden text-white flex app-shell">
      {showTour && !loading && <WelcomeTour onComplete={() => setShowTour(false)} />}
      <UpdateModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        updateInfo={updateInfo}
        language={bootLanguage}
      />
      {loading && (
        <div className={`loading-screen ${loadingFade ? 'loading-fade' : ''}`}>
          <div className="loading-panel">
            <div
              className="loading-logo tfy-logo-mark"
              style={{ WebkitMaskImage: `url(${splashLogo})`, maskImage: `url(${splashLogo})` } as any}
              aria-label="TFY Utility Hub"
            />
            <div className="loading-title">{t(bootLanguage, 'loading.title')}</div>
            <div className="loading-sub">{t(bootLanguage, 'loading.sub')}</div>
            <div className="loading-track">
              <span className="loading-track-fill" />
            </div>
          </div>
        </div>
      )}

      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
      <NotificationCenter items={notifications} onClose={dismissNotification} />
      {/* Main Content - Sidebar is now absolute inside relative shell, or fixed. 
          If fixed, we need to clip it. Best way is to make sidebar absolute and shell has overflow hidden. 
          We need to update Sidebar.tsx to be absolute if we change it here. 
          Or just ensure Sidebar is z-indexed correctly. */ }

      <div className="flex-1 ml-64 h-screen flex flex-col relative overflow-hidden app-main-shell">
        {/* Visible Header Bar (Blur + Dark Tint) */}
        <div
          className="h-10 w-full flex items-center justify-end pr-2 gap-1 z-[9990] titlebar-drag-region shrink-0"
          onMouseDown={(e) => {
            if (e.button === 0) {
              e.preventDefault();
              sendHostMessage("window-drag");
            }
          }}
        >
          <button
            className="titlebar-no-drag flex items-center justify-center rounded-md transition-colors"
            style={{ width: '26px', height: '26px', background: 'transparent', border: 'none', color: '#888' }}
            onClick={() => sendHostMessage("minimize")}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#888';
            }}
          >
            <Minus size={13} />
          </button>
          <button
            className="titlebar-no-drag flex items-center justify-center rounded-md transition-colors"
            style={{ width: '26px', height: '26px', background: 'transparent', border: 'none', color: '#888' }}
            onClick={() => sendHostMessage("close")}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#888';
            }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 relative overflow-hidden app-content-shell">
          {/* Blur background covering content area */}
          <div className="absolute inset-0 bg-[var(--bg-0)]/80 backdrop-blur-2xl -z-10 pointer-events-none" aria-hidden />

          <div className={`h-full ${isHome || isDebloater ? 'overflow-hidden' : 'overflow-y-auto'} overflow-x-hidden ${(hideScroll || isDebloater) ? 'no-scrollbar' : ''} `}>
            <div className="p-6 relative z-10 h-full">
              <div key={currentPage} className="page-switch-enter h-full min-h-0">
                {currentPage === 'home' ? <Home /> : renderPage()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;









