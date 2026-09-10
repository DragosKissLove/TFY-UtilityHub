import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Twitch, 
  Download, 
  Loader2, 
  X, 
  Check, 
  AlertCircle, 
  FolderArchive,
  ArrowUpRight,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

interface TwitchDropsMinerModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: string;
}

const tdmModalStyles = `
@keyframes tdmFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes tdmFadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}
@keyframes tdmSlideIn {
  from { opacity: 0; transform: scale(0.94) translateY(24px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes tdmSlideOut {
  from { opacity: 1; transform: scale(1) translateY(0); }
  to { opacity: 0; transform: scale(0.94) translateY(16px); }
}
@keyframes tdmStepTransition {
  from { opacity: 0; transform: translateX(15px); }
  to { opacity: 1; transform: translateX(0); }
}

.tdm-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.78); /* Dark semi-transparent overlay, NO blur */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: tdmFadeIn 0.25s ease-out forwards;
}
.tdm-overlay.closing {
  animation: tdmFadeOut 0.24s ease-in forwards;
}
.tdm-card {
  position: relative;
  width: 100%;
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.015) 100%) !important;
  backdrop-filter: blur(48px) saturate(160%);
  -webkit-backdrop-filter: blur(48px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 32px 80px rgba(0, 0, 0, 0.65),
    0 0 0 1px rgba(255, 255, 255, 0.04) inset,
    0 0 45px -8px color-mix(in srgb, var(--accent) 18%, transparent);
  animation: tdmSlideIn 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: max-width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.tdm-card.closing {
  animation: tdmSlideOut 0.24s cubic-bezier(0.75, 0, 0.85, 0.1) forwards;
}
.tdm-glow-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  opacity: 0.8;
}
.tdm-step-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  transition: all 0.3s ease;
  cursor: pointer;
}
.tdm-step-dot.active {
  background: var(--accent);
  transform: scale(1.3);
  box-shadow: 0 0 10px var(--accent);
}
.tdm-step-body {
  animation: tdmStepTransition 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
`;

export function TwitchDropsMinerModal({ isOpen, onClose, language }: TwitchDropsMinerModalProps) {
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'extracting' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  
  const [viewMode, setViewMode] = useState<'downloader' | 'guide'>('downloader');
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setClosing(false);
      setError('');
      setDownloadStatus('idle');
      setProgress(0);
      setViewMode('downloader');
      setActiveStep(0);
      if (window.chrome?.webview) {
        window.chrome.webview.postMessage('twitch-miner-launch');
      }
    }
  }, [isOpen]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      setVisible(false);
      onClose();
    }, 220);
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
      if (message?.type === 'twitch-miner-status') {
        const { status, percent, message: errMsg } = message.data || {};
        if (status) setDownloadStatus(status);
        if (percent !== undefined) setProgress(percent);
        if (errMsg) setError(errMsg);

        // Auto transition to the Usage Guide after extraction is successfully completed
        if (status === 'done') {
          setTimeout(() => {
            setViewMode('guide');
          }, 1500);
        }
      }
    };

    if (window.chrome?.webview) {
      window.chrome.webview.addEventListener('message', handleMessage);
    }
    return () => {
      if (window.chrome?.webview) {
        window.chrome.webview.removeEventListener('message', handleMessage);
      }
    };
  }, []);

  if (!visible && !isOpen) return null;

  const usageSteps = [
    {
      title: language === 'ro' ? '1. Conectare și Autentificare' : '1. Link & Authenticate',
      desc: language === 'ro' 
        ? 'Apasă pe butonul de Login din aplicația deschisă și așteaptă 3 secunde pentru a fi redirecționat în browser. În pagina deschisă, apasă pe Activate, apoi pe Authorize pentru a-ți asocia contul oficial de Twitch.'
        : 'Click the Login button in the miner app and wait 3 seconds to be redirected. In the browser page, click Activate and then Authorize to securely connect your official Twitch account.',
      tips: language === 'ro'
        ? 'Asigură-te că ești deja conectat pe contul tău Twitch în browserul implicit.'
        : 'Make sure you are already logged into your Twitch account in your default browser.'
    },
    {
      title: language === 'ro' ? '2. Prioritizare Jocuri' : '2. Game Prioritization',
      desc: language === 'ro' 
        ? 'Navighează la secțiunea Settings din partea dreaptă a aplicației Twitch Drops Miner. Mergi la categoria Priority, iar în caseta Game Name caută și selectează jocurile din care dorești să colectezi drop-urile.'
        : 'Navigate to the Settings tab on the right side of the Twitch Drops Miner interface. Scroll to the Priority section, and in the Game Name box search and select the games you want to farm.',
      tips: language === 'ro'
        ? 'După selectarea fiecărui joc, nu uita să apeși pe butonul rotund de Reload din dreptul acestuia!'
        : 'After selecting your games, always click the circular Reload button next to the game box!'
    },
    {
      title: language === 'ro' ? '3. Asociere Conturi de Joc' : '3. Link Game Accounts',
      desc: language === 'ro' 
        ? 'Accesează tab-ul Inventory din aplicație pentru a verifica asocierea conturilor. Dacă jocul tău preferat (ex. Rust, Sea of Thieves) apare ca fiind "Not Linked", dă click pe text și vei fi redirecționat pe pagina oficială pentru a face conectarea.'
        : 'Go to the Inventory tab in the miner app to check account links. If your chosen game (e.g. Rust, Sea of Thieves) shows up as "Not Linked", click it to open the link page and link your game accounts.',
      tips: language === 'ro'
        ? 'Fără link între contul de joc și Twitch, drop-urile minate nu vor ajunge în inventarul tău din joc!'
        : 'Without linking your game accounts to Twitch, mined drops will not appear in your actual in-game inventory!'
    },
    {
      title: language === 'ro' ? '4. Actualizare Setări' : '4. Update & Sync Settings',
      desc: language === 'ro' 
        ? 'După ce ai finalizat asocierea conturilor în browserul extern, întoarce-te înapoi în aplicație. Mergi la tab-ul Settings și dă click pe butonul de Reload din partea de jos pentru ca toate modificările să fie sincronizate.'
        : 'Once you link all accounts in your browser, head back to the miner application. Navigate to the Settings page and click the main Reload button at the bottom to sync your updated connections.',
      tips: language === 'ro'
        ? 'Sincronizarea este instantanee și va asigura funcționarea eforturilor de minare.'
        : 'Syncing is immediate and guarantees that all background mining actions will succeed.'
    },
    {
      title: language === 'ro' ? '5. Monitorizare Progres în Timp Real' : '5. Monitor Real-Time Progress',
      desc: language === 'ro' 
        ? 'Apasă pe butonul Main din bara laterală stângă a minerului. Aici vei putea vizualiza procesul automat de minare, canalul activ pe care se rulează procesul și numărul total de ore estimate până la obținerea tuturor drop-urilor active!'
        : 'Click on the Main tab in the left sidebar of the miner UI. Here you can watch the automation at work: see current active channels, active campaigns, and the estimated total hours remaining!',
      tips: language === 'ro'
        ? 'Aplicația poate funcționa complet minimizată în sistem, ocupând zero resurse fizice!'
        : 'The application runs perfectly in the tray background, consuming near-zero physical resources!'
    }
  ];

  return createPortal(
    <>
      <style>{tdmModalStyles}</style>
      <div 
        className={`tdm-overlay ${closing ? 'closing' : ''}`}
        /* Closed ONLY via X button, so NO overlay onMouseDown close */
      >
        <div 
          className={`tdm-card ${closing ? 'closing' : ''}`}
          style={{
            maxWidth: viewMode === 'downloader' ? '440px' : '680px'
          }}
        >
          <div className="tdm-glow-line" />

          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/[0.04]">
            <div className="flex items-center gap-2.5">
              <div>
                <h2 className="text-white font-bold text-sm tracking-wide flex items-center gap-2">
                  Twitch Drops Miner
                  {viewMode === 'guide' && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-accent/20 text-accent font-semibold border border-accent/25 uppercase tracking-wider">
                      {language === 'ro' ? 'Ghid de Utilizare' : 'Usage Guide'}
                    </span>
                  )}
                </h2>
                <p className="text-[10px] text-gray-500">Official 1/1 Desktop Client Downloader</p>
              </div>
            </div>

            <button 
              type="button" 
              onClick={handleClose}
              className="w-6 h-6 rounded-lg flex items-center justify-center bg-white/[0.02] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>

          {/* Body Switcher */}
          {viewMode === 'downloader' ? (
            /* ========================================================
               DOWNLOADER VIEW MODE
               ======================================================== */
            <div className="p-6 flex flex-col items-center text-center">
              
              {/* Status-dependent visual indicators */}
              {downloadStatus === 'idle' && (
                <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center text-gray-400 mb-4 animate-pulse">
                  <Loader2 size={24} className="animate-spin text-accent" />
                </div>
              )}

              {downloadStatus === 'downloading' && (
                <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-4 relative">
                  <Download size={24} className="animate-bounce" />
                  <div className="absolute inset-0 rounded-2xl border border-accent/30 animate-ping opacity-45 pointer-events-none" />
                </div>
              )}

              {downloadStatus === 'extracting' && (
                <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400 mb-4 animate-pulse">
                  <FolderArchive size={24} />
                </div>
              )}

              {downloadStatus === 'done' && (
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 relative shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  <Check size={26} strokeWidth={3} />
                </div>
              )}

              {downloadStatus === 'error' && (
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
                  <AlertCircle size={26} />
                </div>
              )}

              {/* Status title and details */}
              <div className="space-y-1 mt-1 mb-5">
                <h3 className="text-sm font-semibold text-white">
                  {downloadStatus === 'idle' && (language === 'ro' ? 'Se verifică fișierele locale...' : 'Checking local files...')}
                  {downloadStatus === 'downloading' && (language === 'ro' ? 'Se descarcă aplicația oficială...' : 'Downloading Official App...')}
                  {downloadStatus === 'extracting' && (language === 'ro' ? 'Se dezarhivează resursele...' : 'Extracting Client Resources...')}
                  {downloadStatus === 'done' && (language === 'ro' ? 'Descărcare finalizată cu succes!' : 'Download Completed Successfully!')}
                  {downloadStatus === 'error' && (language === 'ro' ? 'Eroare la descărcare' : 'Download Failed')}
                </h3>
                <p className="text-[11px] text-gray-400 leading-normal max-w-xs">
                  {downloadStatus === 'idle' && (language === 'ro' ? 'Minerul Twitch se va deschide automat sau va fi descărcat de pe GitHub.' : 'The Twitch Miner will launch automatically or download from GitHub.')}
                  {downloadStatus === 'downloading' && (language === 'ro' ? 'Se descarcă pachetul original dev-build TwitchDropsMiner.' : 'Downloading official dev-build TwitchDropsMiner zip package.')}
                  {downloadStatus === 'extracting' && (language === 'ro' ? 'Se extrag fișierele executabile în directorul TFY AppData.' : 'Extracting executable files into TFY AppData directory.')}
                  {downloadStatus === 'done' && (language === 'ro' ? 'Aplicația originală va fi lansată pe ecran într-o secundă.' : 'Launching the original desktop application in a second.')}
                  {downloadStatus === 'error' && (error || (language === 'ro' ? 'Verifică conexiunea la internet și reîncearcă.' : 'Please check your internet connection and try again.'))}
                </p>
              </div>

              {/* Horizontal Progress Bar */}
              {(downloadStatus === 'downloading' || downloadStatus === 'extracting' || downloadStatus === 'done') && (
                <div className="w-full space-y-2">
                  <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-300"
                      style={{ 
                        width: `${progress}%`,
                        background: downloadStatus === 'done' 
                          ? '#10b981' 
                          : 'linear-gradient(90deg, transparent, var(--accent))'
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-gray-500 font-mono">
                    <span>{downloadStatus === 'extracting' ? 'UNZIPPING' : 'DOWNLOADING'}</span>
                    <span className="font-bold text-white">{progress}%</span>
                  </div>
                </div>
              )}

              {/* Action Footer */}
              {downloadStatus === 'error' && (
                <div className="flex gap-2.5 w-full mt-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setError('');
                      setDownloadStatus('idle');
                      setProgress(0);
                      if (window.chrome?.webview) {
                        window.chrome.webview.postMessage('twitch-miner-launch');
                      }
                    }}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-accent/15 border border-accent/25 text-accent hover:bg-accent/25 transition-all cursor-pointer"
                  >
                    Retry Download
                  </button>
                  <button 
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.02] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              )}

              {downloadStatus === 'done' && (
                <div className="text-[10px] text-emerald-400/80 font-semibold flex items-center gap-1.5 mt-2 animate-pulse">
                  <ArrowUpRight size={12} />
                  {language === 'ro' ? 'Se deschide Twitch Drops Miner...' : 'Opening Twitch Drops Miner...'}
                </div>
              )}

            </div>
          ) : (
            /* ========================================================
               TUTORIAL / GUIDE VIEW MODE
               ======================================================== */
            <div className="flex flex-col flex-1 min-h-[300px] p-6 justify-between animate-fade-in">
              
              {/* Step Visual Body - Animated when activeStep changes */}
              <div 
                key={activeStep} 
                className="tdm-step-body flex flex-col gap-3.5 p-5 rounded-2xl bg-white/[0.015] border border-white/[0.03] shadow-inner"
              >
                <div className="space-y-2">
                  <h4 className="text-white font-bold text-sm tracking-wide">
                    {usageSteps[activeStep].title}
                  </h4>
                  <p className="text-[12px] text-gray-400 leading-relaxed font-medium">
                    {usageSteps[activeStep].desc}
                  </p>
                  
                  {/* Sub-Tip Box */}
                  <div className="p-2.5 rounded-lg bg-accent/5 border border-accent/15 flex gap-2 items-start mt-2">
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-accent/10 border border-accent/15 text-accent shrink-0">
                      {language === 'ro' ? 'SFAT' : 'TIP'}
                    </span>
                    <p className="text-[10px] text-gray-400 font-semibold italic">
                      {usageSteps[activeStep].tips}
                    </p>
                  </div>
                </div>
              </div>

              {/* Navigation dots and buttons */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/[0.04]">
                {/* Progress indicator */}
                <div className="flex items-center gap-1.5">
                  {usageSteps.map((_, i) => (
                    <div 
                      key={i} 
                      className={`tdm-step-dot ${activeStep === i ? 'active' : ''}`}
                      onClick={() => setActiveStep(i)}
                    />
                  ))}
                </div>

                {/* Left/Right buttons */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={activeStep === 0}
                    onClick={() => setActiveStep(prev => prev - 1)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center bg-white/[0.02] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer ${activeStep === 0 ? 'opacity-30 pointer-events-none' : ''}`}
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {activeStep < usageSteps.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setActiveStep(prev => prev + 1)}
                      className="px-4 h-9 rounded-xl flex items-center gap-1 bg-accent/15 border border-accent/25 text-accent hover:bg-accent/25 transition-all cursor-pointer font-bold text-xs"
                    >
                      {language === 'ro' ? 'Pasul Următor' : 'Next Step'}
                      <ChevronRight size={14} />
                    </button>
                  ) : (
                    /* The "I Understand" button is styled perfectly with the project's accent color */
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-4 h-9 rounded-xl flex items-center gap-1 bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 transition-all cursor-pointer font-bold text-xs shadow-[0_0_15px_-3px_color-mix(in srgb,var(--accent)_45%,transparent)]"
                    >
                      {language === 'ro' ? 'Am Înțeles!' : 'I Understand!'}
                      <Check size={14} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </>,
    document.body
  );
}
