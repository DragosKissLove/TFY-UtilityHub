import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Download, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { getLanguage } from '../lib/i18n';

// Themed Visual Studio 2022 Logo SVG
const VsLogo = ({ size = 24 }: { size?: number }) => (
  <svg viewBox="0 0 193 193" width={size} height={size} style={{ display: 'block', color: 'var(--accent)' }} xmlns="http://www.w3.org/2000/svg">
    <path d="M40.6211 157.524L11.2134 135.467C10.2965 134.786 9.55244 133.898 9.04142 132.877C8.5304 131.855 8.26668 130.728 8.27155 129.586V63.4143C8.26668 62.272 8.5304 61.1446 9.04142 60.1231C9.55244 59.1015 10.2965 58.2144 11.2134 57.5333L40.6211 35.4761C39.8311 36.2179 39.2341 37.1413 38.8819 38.1662C38.5297 39.191 38.433 40.2864 38.6001 41.3571V151.643C38.433 152.714 38.5297 153.809 38.8819 154.834C39.2341 155.859 39.8311 156.782 40.6211 157.524Z" fill="currentColor" opacity={0.3} />
    <path d="M181.455 38.8951C180.244 38.0992 178.825 37.6773 177.375 37.682C176.436 37.6744 175.504 37.8522 174.633 38.2052C173.763 38.5581 172.971 39.0793 172.302 39.7388L171.789 40.2544L140.539 70.2163L113.117 96.5001L80.6543 127.637L50.6207 156.421L50.1052 156.937C49.437 157.597 48.6448 158.119 47.7742 158.473C46.9035 158.826 45.9716 159.004 45.032 158.996C43.4414 158.993 41.8943 158.477 40.6206 157.524L11.2129 135.467C12.7069 136.589 14.5726 137.1 16.43 136.895C18.2874 136.69 19.9968 135.785 21.2103 134.364L37.6815 115.249L53.8549 96.4643L80.6543 65.3637L127.6 10.8439C128.282 10.0365 129.132 9.38792 130.091 8.94356C131.049 8.4992 132.094 8.26983 133.15 8.27152C134.6 8.26684 136.019 8.68874 137.231 9.48467L181.455 38.8951Z" fill="currentColor" opacity={0.6} />
    <path d="M181.455 154.105L137.341 183.516C135.841 184.496 134.037 184.901 132.261 184.658C130.485 184.415 128.857 183.54 127.675 182.192L80.6543 127.637L53.8549 96.4644L37.6815 77.7158L21.2103 58.5978C19.986 57.1911 18.2749 56.2997 16.4206 56.1022C14.5663 55.9048 12.7059 56.4162 11.2129 57.5335L40.6206 35.4764C41.8943 34.5236 43.4414 34.0072 45.032 34.0041C45.9716 33.9959 46.9035 34.174 47.7742 34.5275C48.6448 34.8809 49.437 35.403 50.1052 36.0637L50.6207 36.5792L80.6543 65.3638L113.117 96.5002L140.578 122.823L171.789 152.746L172.302 153.262C172.971 153.921 173.763 154.442 174.633 154.795C175.504 155.148 176.436 155.326 177.375 155.318C178.825 155.323 180.244 154.901 181.455 154.105Z" fill="currentColor" opacity={0.8} />
    <path d="M184.729 45.0321V147.967C184.73 149.181 184.432 150.375 183.861 151.446C183.29 152.516 182.464 153.43 181.456 154.105L137.341 183.515C138.35 182.84 139.176 181.926 139.746 180.855C140.317 179.784 140.615 178.589 140.614 177.375V15.6244C140.598 14.4029 140.281 13.2021 139.691 12.1312C139.101 11.0603 138.256 10.1512 137.231 9.48428L181.456 38.8947C182.461 39.5724 183.285 40.4862 183.856 41.5562C184.426 42.6261 184.726 43.8196 184.729 45.0321Z" fill="currentColor" />
  </svg>
);

const modalStyles = `
@keyframes umFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes umFadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}
@keyframes umSlideIn {
  from { opacity: 0; transform: scale(0.92) translateY(30px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes umSlideOut {
  from { opacity: 1; transform: scale(1) translateY(0); }
  to { opacity: 0; transform: scale(0.92) translateY(20px); }
}
.rt-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: umFadeIn 0.25s ease-out forwards;
}
.rt-overlay.closing {
  animation: umFadeOut 0.3s ease-in forwards;
}
.rt-card {
  position: relative;
  width: 520px;
  max-width: calc(100% - 40px);
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.01) 100%) !important;
  backdrop-filter: blur(48px) saturate(150%);
  -webkit-backdrop-filter: blur(48px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 32px 80px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset,
    0 0 40px -8px color-mix(in srgb, var(--accent) 15%, transparent);
  padding: 28px;
  animation: umSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.rt-card.closing {
  animation: umSlideOut 0.3s ease-in forwards;
}
.rt-progress-track {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 99px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.rt-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-strong));
  border-radius: 99px;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 12px rgba(var(--accent-rgb), 0.4);
}
`;

export const RuntimeInstaller = React.memo(function RuntimeInstaller() {
  const [isOpen, setIsOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  const [percent, setPercent] = useState(0);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const language = getLanguage();
  const isRo = language === 'ro';

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setClosing(false);
    } else if (visible) {
      setClosing(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleMessage = (event: any) => {
      try {
        let msg = event.data;
        if (typeof msg === 'string') {
          try { msg = JSON.parse(msg); } catch { return; }
        }

        if (msg?.type === 'runtime-installer-progress') {
          const { percent: p, status: s } = msg.data || {};
          if (p !== undefined && p >= 0) setPercent(p);
          if (s) setStatus(s);
        }

        if (msg?.type === 'runtime-installer-result') {
          const { ok, message } = msg.data || {};
          setResult({ ok, message });
          if (ok) {
            setPercent(100);
            setStatus(isRo ? 'Instalare completă!' : 'Installation complete!');
          }
        }
      } catch (err) {}
    };

    window.chrome?.webview?.addEventListener('message', handleMessage);
    return () => window.chrome?.webview?.removeEventListener('message', handleMessage);
  }, [isRo]);

  const handleInstall = () => {
    if (isOpen) return;
    setPercent(0);
    setStatus(isRo ? 'Se inițializează...' : 'Initializing...');
    setResult(null);
    setIsOpen(true);

    if (window.chrome?.webview) {
      window.chrome.webview.postMessage('runtime-directx-install');
    } else {
      // Dev environment mock
      let p = 0;
      const interval = setInterval(() => {
        p += 5;
        setPercent(p);
        if (p <= 20) setStatus(isRo ? 'Se descarcă DirectX...' : 'Downloading DirectX...');
        else if (p <= 35) setStatus(isRo ? 'Se instalează DirectX...' : 'Installing DirectX...');
        else if (p <= 70) setStatus(isRo ? 'Se descarcă Visual C++...' : 'Downloading Visual C++...');
        else if (p <= 85) setStatus(isRo ? 'Se extrag fișierele...' : 'Extracting files...');
        else setStatus(isRo ? 'Se instalează Visual C++ Runtimes...' : 'Installing Visual C++ Runtimes...');

        if (p >= 100) {
          clearInterval(interval);
          setResult({ ok: true, message: isRo ? 'Instalat cu succes!' : 'Installed successfully!' });
        }
      }, 300);
    }
  };

  const handleClose = () => {
    if (!result) return; // Cannot close while running
    setIsOpen(false);
  };

  return (
    <>
      <div className="panel panel-outline rounded-2xl liquid-card tfy-diagonal-glow shrink-0" style={{ position: 'relative' }}>
        <div className="flex items-center gap-4 w-full p-5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 gaming-card-icon"
            style={{ background: 'color-mix(in srgb, var(--accent) 16%, rgba(255,255,255,0.04))' }}>
            <VsLogo size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-white font-semibold text-lg">
              Runtime & DirectX Installer
            </div>
            <div className="text-sm text-gray-400 mt-0.5 leading-snug">
              {isRo
                ? 'Descarcă și instalează în siguranță toate pachetele Visual C++ Redistributable (2005-2022) și DirectX necesare.'
                : 'Downloads and installs all necessary Visual C++ Redistributable runtimes (2005-2022) and DirectX runtimes safely.'}
            </div>
          </div>
          <button
            type="button"
            onClick={handleInstall}
            className="btn-ghost flex items-center gap-2 shrink-0 font-semibold"
            style={{ color: 'var(--accent)' }}
          >
            <Download size={16} />
            {isRo ? 'Instalează Runtimes' : 'Install Runtimes'}
          </button>
        </div>
      </div>

      {visible && createPortal(
        <>
          <style>{modalStyles}</style>
          <div className={`rt-overlay ${closing ? 'closing' : ''}`}>
            <div className={`rt-card ${closing ? 'closing' : ''} flex flex-col gap-5`}>
              {/* Close Button when done */}
              {result && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              )}

              {/* Header Title */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-accent"
                  style={{ background: 'color-mix(in srgb, var(--accent) 16%, rgba(255,255,255,0.04))' }}>
                  {result ? (
                    result.ok ? <CheckCircle size={20} /> : <AlertCircle size={20} className="text-red-400" />
                  ) : (
                    <Loader2 size={20} className="animate-spin" />
                  )}
                </div>
                <div>
                  <h3 className="text-white font-display font-bold text-lg">
                    {isRo ? 'Runtime & DirectX Installer' : 'Runtime & DirectX Installer'}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {result 
                      ? (result.ok ? (isRo ? 'Instalare reușită' : 'Installation successful') : (isRo ? 'Instalare eșuată' : 'Installation failed'))
                      : (isRo ? 'Instalarea este în desfășurare...' : 'Installation in progress...')}
                  </p>
                </div>
              </div>

              {/* Progress Content */}
              <div className="space-y-2.5 pt-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-gray-300 truncate max-w-[80%]">{status}</span>
                  <span className="text-accent font-mono">{percent}%</span>
                </div>
                <div className="rt-progress-track">
                  <div className="rt-progress-bar" style={{ width: `${percent}%` }} />
                </div>
              </div>

              {/* Notification Message */}
              {result && (
                <div className={`text-xs leading-relaxed p-4 rounded-xl border ${
                  result.ok 
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' 
                    : 'bg-red-500/5 border-red-500/20 text-red-400'
                }`}>
                  <div className="font-semibold mb-1">
                    {result.ok ? (isRo ? 'Succes' : 'Success') : (isRo ? 'Instalare Eșuată' : 'Installation Failed')}
                  </div>
                  {result.ok ? (
                    <div>{result.message}</div>
                  ) : (
                    <div className="space-y-2">
                      <div>{result.message.split('\n')[0]}</div>
                      {result.message.includes('\n') && (
                        <div className="mt-2 pt-2 border-t border-red-500/10">
                          <div className="text-[10px] text-red-300/50 uppercase tracking-wider font-semibold mb-1">
                            {isRo ? 'Detalii eroare:' : 'Error details:'}
                          </div>
                          <pre className="text-[10px] font-mono bg-black/40 p-2.5 rounded-lg border border-red-500/10 overflow-auto max-h-[120px] select-text whitespace-pre-wrap leading-normal text-red-300/80">
                            {result.message.substring(result.message.indexOf('\n') + 1)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Footer text */}
              {!result && (
                <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400/80 bg-white/5 py-2 px-3 rounded-lg border border-white/5 mt-1">
                  <Loader2 size={12} className="animate-spin text-accent shrink-0" />
                  <span className="leading-normal">
                    {isRo 
                      ? 'Această operațiune poate dura 1-2 minute. Vă rugăm să nu închideți aplicația.' 
                      : 'This operation may take 1-2 minutes. Please do not close the application.'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
});
