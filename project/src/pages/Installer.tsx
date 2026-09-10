import { useState, useEffect } from 'react';
import { FolderOpen, ArrowRight, ArrowLeft, CheckCircle2, Check, X, Download, Rocket, ShieldCheck } from 'lucide-react';

interface PrereqStatus {
  netInstalled: boolean;
  netVersion: string;
  vcInstalled: boolean;
  oldVersionDetected?: boolean;
  oldVersionPath?: string;
}

export function Installer() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [installPath, setInstallPath] = useState('C:\\Program Files\\TFY');
  const [createShortcut, setCreateShortcut] = useState(true);
  const [cleanOldVersion, setCleanOldVersion] = useState(true);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [prereqs, setPrereqs] = useState<PrereqStatus>({ netInstalled: false, netVersion: '', vcInstalled: false, oldVersionDetected: false });
  const [checkingPrereqs, setCheckingPrereqs] = useState(true);
  const [installNet, setInstallNet] = useState(true);
  const [installVc, setInstallVc] = useState(true);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [launchApp, setLaunchApp] = useState(true);
  const [vis, setVis] = useState(true);
  const [slideDirection, setSlideDirection] = useState<'next' | 'back'>('next');

  // State-based premium hover animations for buttons
  const [hoverContinue, setHoverContinue] = useState(false);
  const [hoverBack, setHoverBack] = useState(false);
  const [hoverInstall, setHoverInstall] = useState(false);
  const [hoverBrowse, setHoverBrowse] = useState(false);
  const [hoverFinish, setHoverFinish] = useState(false);
  const [hoverMin, setHoverMin] = useState(false);
  const [hoverClose, setHoverClose] = useState(false);

  const goTo = (s: 1 | 2 | 3 | 4, dir: 'next' | 'back' = 'next') => {
    setSlideDirection(dir);
    setVis(false);
    setTimeout(() => { setStep(s); setVis(true); }, 220);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest('button, input')) {
      send({ type: 'window-drag' });
    }
  };

  // IPC — listen on BOTH window.message AND chrome.webview.message
  useEffect(() => {
    const handle = (msg: any) => {
      if (typeof msg === 'string') { try { msg = JSON.parse(msg); } catch { return; } }
      if (!msg?.type) return;
      switch (msg.type) {
        case 'prereqs-status':
          setPrereqs(msg.data);
          setInstallNet(!msg.data.netInstalled);
          setInstallVc(!msg.data.vcInstalled);
          setCheckingPrereqs(false);
          break;
        case 'folder-selected':
          if (msg.data?.path) {
            let path = msg.data.path.trim();
            // Automatically append \TFY to selected path if it doesn't already end with it
            if (!path.toUpperCase().endsWith('\\TFY') && !path.toUpperCase().endsWith('/TFY') && !path.toUpperCase().endsWith('\\TFY\\') && !path.toUpperCase().endsWith('/TFY/')) {
              if (path.endsWith('\\') || path.endsWith('/')) {
                path = path + 'TFY';
              } else {
                path = path + '\\TFY';
              }
            }
            setInstallPath(path);
          }
          break;
        case 'install-progress':
          if (msg.data) {
            setProgress(msg.data.percent ?? 0);
            if (msg.data.status) setProgressStatus(msg.data.status);
          }
          break;
        case 'install-complete':
          if (msg.data?.ok) goTo(4, 'next');
          else { setErrorMsg(msg.data?.message || 'Unknown error.'); goTo(2, 'back'); }
          break;
        case 'overwrite-warning':
          setShowOverwriteModal(true);
          break;
      }
    };

    const wvHandler = (e: any) => handle(e.data);
    const winHandler = (e: any) => handle(e.data);

    if (window.chrome?.webview) {
      window.chrome.webview.addEventListener('message', wvHandler);
    }
    window.addEventListener('message', winHandler);

    send({ type: 'check-prereqs' });

    if (!window.chrome?.webview) {
      setTimeout(() => {
        setPrereqs({ netInstalled: true, netVersion: '8.0', vcInstalled: true });
        setCheckingPrereqs(false);
      }, 800);
    }

    return () => {
      if (window.chrome?.webview) window.chrome.webview.removeEventListener('message', wvHandler);
      window.removeEventListener('message', winHandler);
    };
  }, []);

  const send = (obj: any) => {
    if (window.chrome?.webview) window.chrome.webview.postMessage(JSON.stringify(obj));
  };

  const startInstall = () => {
    setErrorMsg(null); setProgress(0); setProgressStatus("Starting installation..."); goTo(3, 'next');
    send({
      type: 'start-install',
      data: {
        path: installPath,
        createShortcut,
        installNet: installNet && !prereqs.netInstalled,
        installVc: installVc && !prereqs.vcInstalled,
        cleanOldVersion: cleanOldVersion && prereqs.oldVersionDetected
      }
    });
    if (!window.chrome?.webview) {
      let p = 0;
      const iv = setInterval(() => {
        p += 5;
        setProgress(p);
        setProgressStatus(p < 30 ? "Downloading components..." : p < 75 ? "Extracting application files..." : "Configuring shortcuts...");
        if (p >= 100) { clearInterval(iv); goTo(4, 'next'); }
      }, 150);
    }
  };

  const finish = () => {
    send({ type: 'launch-app', data: { launch: launchApp } });
    send({ type: 'close-installer' });
  };

  const EULA_TEXT = `TFY — End User License Agreement (EULA)
Last Updated: June 2026

PLEASE READ THIS END USER LICENSE AGREEMENT ("AGREEMENT") CAREFULLY BEFORE PROCEEDING WITH THE INSTALLATION OF TFY. BY INSTALLING AND USING THE SOFTWARE, YOU AGREE TO BE BOUND BY THE TERMS AND CONDITIONS OF THIS AGREEMENT.

1. LICENSE GRANT & SCOPE OF USE
DragosKissLove ("Licensor") grants you a personal, non-exclusive, non-transferable, revocable license to install and use a single copy of TFY ("Software") on your personal computer running compatible versions of Microsoft Windows. You may use this Software solely for personal, non-commercial purposes, including system optimization, performance tweaking, and gaming enhancements.

2. SOFTWARE UPDATES & COMPATIBILITY
To ensure peak efficiency, system safety, and ongoing compatibility with Microsoft Windows security patches and game updates, the Software may periodically check for and download updates automatically. These updates are deployed to improve the security, performance, and functionality of the tool and are mandatory for continued usage of the service.

3. PRIVACY & SECURITY POLICY (ZERO-DATA COLLECTION)
Your privacy is our absolute priority. The Software operates under a strict Zero-Data Collection policy:
- No personal identifiers, internet activity, hardware profiles, or keystrokes are logged, stored, or transmitted to any external servers.
- All system tweaks, settings, and optimization scripts are executed locally on your computer.
- Optional integrations (such as Discord Rich Presence connection) are handled strictly on the client-side to verify game statuses and roles, and no data is shared with third parties.

4. USER RESPONSIBILITIES & SYSTEM MODIFICATIONS
TFY applies system-level tweaks and modifications to optimize Windows performance, reduce latency, and prioritize CPU/GPU resources. Because hardware configurations, driver updates, and operating system states vary significantly between machines:
- You acknowledge that optimizations are applied at your own discretion.
- You agree to maintain backups of critical system files before applying deep tweaks.
- Any manual modification of the Software's components or attempts to reverse engineer the code will result in immediate termination of this license.

5. INTELLECTUAL PROPERTY RIGHTS
All title, ownership rights, and intellectual property rights in and to the Software (including but not limited to any images, animations, layout design, icons, and text incorporated into the Software) are owned by the Licensor. The Software is protected by copyright laws and international treaty provisions.

6. DISCLAIMER OF WARRANTY & LIMITATION OF LIABILITY
THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

7. TERMINATION
This Agreement is effective from the date you install the Software until terminated. You may terminate it at any time by uninstalling the Software and deleting all copies. The Licensor reserves the right to terminate this license immediately if you fail to comply with any term of this Agreement.`;

  const Tick = ({ on, toggle, label }: { on: boolean; toggle: (v: boolean) => void; label: string }) => {
    const [clicked, setClicked] = useState(false);
    
    const handleClick = () => {
      setClicked(true);
      toggle(!on);
      setTimeout(() => setClicked(false), 200);
    };

    return (
      <label 
        style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '5px 0' }}
        onClick={(e) => { e.preventDefault(); handleClick(); }}
      >
        <span style={{
          width: 18, height: 18, borderRadius: 5, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: on ? 'linear-gradient(135deg, #7c5eff, #a78bfa)' : 'rgba(255,255,255,0.05)',
          border: on ? '1px solid rgba(124,94,255,0.5)' : '1px solid rgba(255,255,255,0.12)',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: clicked ? 'scale(0.85)' : 'scale(1)',
          boxShadow: on ? '0 0 10px rgba(124,94,255,0.25)' : 'none',
        }}>
          <Check size={11} strokeWidth={3.5} color="#ffffff" style={{
            transform: on ? 'scale(1) rotate(0deg)' : 'scale(0.2) rotate(-15deg)',
            opacity: on ? 1 : 0,
            transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }} />
        </span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{label}</span>
      </label>
    );
  };

  const slideStyle = (show: boolean): React.CSSProperties => {
    const shift = show ? '0' : (slideDirection === 'next' ? '-35px' : '35px');
    return {
      opacity: show ? 1 : 0,
      transform: `translateX(${shift})`,
      transition: show 
        ? 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
        : 'opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1), transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    };
  };

  const dots = [1, 2, 3, 4];

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      background: '#06070b',
      fontFamily: "'Segoe UI Variable','Segoe UI','Inter',sans-serif", color: '#fff', userSelect: 'none', overflow: 'hidden',
      borderRadius: 16,
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
    }}>
      {/* ═══ AMBIENT BACKGROUND GLOWS ═══ */}
      <div style={{
        position: 'absolute', width: 300, height: 300, borderRadius: '50%',
        background: 'rgba(124, 94, 255, 0.07)', filter: 'blur(75px)',
        top: '-70px', left: '-50px', pointerEvents: 'none', zIndex: 0,
        animation: 'glowMove1 12s infinite alternate ease-in-out'
      }} />
      <div style={{
        position: 'absolute', width: 300, height: 300, borderRadius: '50%',
        background: 'rgba(56, 189, 248, 0.04)', filter: 'blur(80px)',
        bottom: '-70px', right: '-50px', pointerEvents: 'none', zIndex: 0,
        animation: 'glowMove2 15s infinite alternate ease-in-out'
      }} />

      {/* ═══ TITLE BAR ═══ */}
      <div onMouseDown={handleMouseDown} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0, cursor: 'default', zIndex: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: 'rgba(255,255,255,0.4)' }}>TFY Installer</span>
        <div style={{ display: 'flex', gap: 2, marginRight: -8 }}>
          <button 
            onMouseEnter={() => setHoverMin(true)}
            onMouseLeave={() => setHoverMin(false)}
            onClick={() => send({ type: 'minimize' })}
            style={{ 
              width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'transparent', 
              color: hoverMin ? '#c4b5fd' : 'rgba(255,255,255,0.35)', cursor: 'pointer',
              transition: 'color 0.2s ease'
            }}>
            <span style={{ width: 10, height: 1.5, background: 'currentColor', borderRadius: 1 }} />
          </button>
          <button 
            onMouseEnter={() => setHoverClose(true)}
            onMouseLeave={() => setHoverClose(false)}
            onClick={() => send({ type: 'close-installer' })}
            style={{ 
              width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'transparent', 
              color: hoverClose ? '#fda4af' : 'rgba(255,255,255,0.35)', cursor: 'pointer',
              transition: 'color 0.2s ease'
            }}>
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ═══ STEP DOTS ═══ */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 5, padding: '14px 0 0', zIndex: 10 }}>
        {dots.map(s => (
          <div key={s} style={{
            width: step >= s ? 22 : 8, height: 3, borderRadius: 99,
            background: step >= s ? '#7c5eff' : 'rgba(255,255,255,0.06)',
            transition: 'all 0.4s cubic-bezier(0.22,1,0.36,1)',
            opacity: step >= s ? 0.8 : 1,
          }} />
        ))}
      </div>

      {/* ═══ CONTENT ═══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 32px 22px', overflow: 'hidden', zIndex: 10 }}>

        {/* ── STEP 1 (EULA) ── */}
        {step === 1 && (
          <div style={slideStyle(vis)}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c4b5fd', marginBottom: 8 }}>Step 1 / 4</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Usage Agreement</h2>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '6px 0 0', lineHeight: 1.5 }}>Read and accept the license terms before continuing.</p>

            <div className="s" style={{
              flex: 1, marginTop: 16, overflow: 'auto', padding: '16px 20px',
              borderRadius: 12,
              background: 'rgba(0, 0, 0, 0.20)',
              border: '1px solid rgba(255, 255, 255, 0.03)',
              whiteSpace: 'pre-line',
              fontSize: 12,
              color: 'rgba(255, 255, 255, 0.55)',
              lineHeight: 1.7,
              textAlign: 'left'
            }}>
              {EULA_TEXT}
            </div>

            <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <div style={{ marginRight: 'auto' }}>
                <Tick on={acceptedTerms} toggle={setAcceptedTerms} label="I have read and accept the terms of use" />
              </div>
              <button 
                onMouseEnter={() => setHoverContinue(true)}
                onMouseLeave={() => setHoverContinue(false)}
                onClick={() => goTo(2, 'next')}
                style={{
                  padding: '9px 20px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                  background: 'linear-gradient(135deg, #7c5eff, #a78bfa)', border: 'none', color: '#ffffff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                  boxShadow: hoverContinue ? '0 8px 24px rgba(124, 94, 255, 0.45)' : '0 6px 20px rgba(124, 94, 255, 0.3)',
                  opacity: acceptedTerms ? 1 : 0.3, pointerEvents: acceptedTerms ? 'auto' : 'none',
                  transform: hoverContinue && acceptedTerms ? 'translateY(-1px)' : 'none',
                  filter: hoverContinue && acceptedTerms ? 'brightness(1.1)' : 'none',
                  transition: 'all 0.2s ease',
                }}>
                Continue <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2 (SETTINGS & PREREQS) ── */}
        {step === 2 && (
          <div style={slideStyle(vis)}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c4b5fd', marginBottom: 8 }}>Step 2 / 4</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Installation Settings</h2>

            {/* Custom two-column layout for modern space distribution */}
            <div style={{ display: 'flex', gap: 24, marginTop: 16, flex: 1 }}>
              {/* Left Column */}
              <div style={{ flex: 1.1, display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Path Selection */}
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>Installation location</span>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input type="text" value={installPath} onChange={e => setInstallPath(e.target.value)}
                      style={{ flex: 1, padding: '9px 14px', borderRadius: 10, fontSize: 12, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', outline: 'none', fontFamily: 'inherit' }} />
                    <button 
                      onMouseEnter={() => setHoverBrowse(true)}
                      onMouseLeave={() => setHoverBrowse(false)}
                      onClick={() => send({ type: 'browse-folder' })}
                      style={{ 
                        padding: '9px 14px', borderRadius: 10, 
                        background: hoverBrowse ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)', 
                        border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', 
                        cursor: 'pointer', transform: hoverBrowse ? 'scale(1.03)' : 'scale(1)', transition: 'all 0.2s ease' 
                      }}>
                      <FolderOpen size={15} />
                    </button>
                  </div>
                </div>

                {/* Options Box */}
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>Options</span>
                  <div style={{
                    marginTop: 8, padding: '12px 16px', borderRadius: 12,
                    background: 'rgba(0, 0, 0, 0.20)', border: '1px solid rgba(255, 255, 255, 0.03)',
                    display: 'flex', flexDirection: 'column', gap: 6
                  }}>
                    <Tick on={createShortcut} toggle={setCreateShortcut} label="Create Desktop shortcut" />
                    {prereqs.oldVersionDetected && (
                      <Tick on={cleanOldVersion} toggle={setCleanOldVersion} label="Clean up old version in AppData/Local/TFY" />
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div style={{ flex: 0.9, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>Required Components</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {checkingPrereqs ? (
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', padding: '8px 0' }}>Checking system details...</span>
                  ) : (
                    <>
                      {/* .NET Card */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12,
                        background: 'rgba(124, 94, 255, 0.02)',
                        border: '1px solid rgba(124, 94, 255, 0.18)',
                        boxShadow: '0 4px 20px rgba(124, 94, 255, 0.03)'
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(124, 94, 255, 0.08)',
                          color: '#a78bfa',
                        }}>
                          {prereqs.netInstalled ? <ShieldCheck size={16} /> : <Download size={14} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>.NET 8.0 Runtime</div>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>WPF engine framework</div>
                        </div>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '3px 6px', borderRadius: 5,
                          background: 'rgba(124, 94, 255, 0.12)',
                          color: '#c4b5fd',
                        }}>
                          {prereqs.netInstalled ? "Ready" : "Will Install"}
                        </span>
                      </div>

                      {/* VC++ Card */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12,
                        background: 'rgba(124, 94, 255, 0.02)',
                        border: '1px solid rgba(124, 94, 255, 0.18)',
                        boxShadow: '0 4px 20px rgba(124, 94, 255, 0.03)'
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(124, 94, 255, 0.08)',
                          color: '#a78bfa',
                        }}>
                          {prereqs.vcInstalled ? <ShieldCheck size={16} /> : <Download size={14} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Visual C++ Redist</div>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>Native libraries</div>
                        </div>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '3px 6px', borderRadius: 5,
                          background: 'rgba(124, 94, 255, 0.12)',
                          color: '#c4b5fd',
                        }}>
                          {prereqs.vcInstalled ? "Ready" : "Will Install"}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {errorMsg && (
              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', fontSize: 11, color: '#f87171', fontWeight: 600 }}>
                {errorMsg}
              </div>
            )}

            {/* Footer actions */}
            <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between' }}>
              <button 
                onMouseEnter={() => setHoverBack(true)}
                onMouseLeave={() => setHoverBack(false)}
                onClick={() => goTo(1, 'back')}
                style={{ 
                  padding: '9px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, 
                  background: hoverBack ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)', 
                  border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', 
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                  transform: hoverBack ? 'translateX(-1px)' : 'none', transition: 'all 0.2s ease'
                }}>
                <ArrowLeft size={13} /> Back
              </button>
              <button 
                onMouseEnter={() => setHoverInstall(true)}
                onMouseLeave={() => setHoverInstall(false)}
                onClick={startInstall}
                style={{
                  padding: '9px 20px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                  background: 'linear-gradient(135deg, #7c5eff, #a78bfa)', border: 'none', color: '#ffffff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                  boxShadow: hoverInstall ? '0 8px 24px rgba(124, 94, 255, 0.45)' : '0 6px 20px rgba(124, 94, 255, 0.3)',
                  opacity: checkingPrereqs ? 0.3 : 1, pointerEvents: checkingPrereqs ? 'none' : 'auto',
                  transform: hoverInstall && !checkingPrereqs ? 'translateY(-1px) scale(1.02)' : 'none',
                  filter: hoverInstall && !checkingPrereqs ? 'brightness(1.15)' : 'none',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}>
                Install <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 (INSTALLING PROGRESS) ── */}
        {step === 3 && (
          <div style={slideStyle(vis)}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(124, 94, 255, 0.12), rgba(124, 94, 255, 0.04))',
                border: '1px solid rgba(124, 94, 255, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
              }}>
                <Download size={22} style={{ color: '#c4b5fd' }} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Installing TFY</h2>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '6px 0 0', maxWidth: 320 }}>Please wait while the installation completes. Do not close this window.</p>

              <div style={{ width: '100%', maxWidth: 360, marginTop: 32 }}>
                <div style={{ width: '100%', height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #7c5eff, #c4b5fd)', width: `${progress}%`, transition: 'width 0.35s ease-out', boxShadow: '0 0 10px rgba(124, 94, 255, 0.25)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%', textAlign: 'left' }}>{progressStatus}</span>
                  <span style={{ color: '#c4b5fd', fontFamily: 'monospace', fontWeight: 700 }}>{progress}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4 (COMPLETE REMAKE) ── */}
        {step === 4 && (
          <div style={slideStyle(vis)}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
              <div style={{
                width: 60, height: 60, borderRadius: 20,
                background: 'linear-gradient(135deg, rgba(124, 94, 255, 0.16), rgba(124, 94, 255, 0.04))',
                border: '1px solid rgba(124, 94, 255, 0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
                boxShadow: '0 0 35px rgba(124, 94, 255, 0.15)',
              }}>
                <CheckCircle2 size={28} style={{ color: '#c4b5fd' }} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>Successfully Installed!</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '8px 0 0', maxWidth: 300, lineHeight: 1.5 }}>TFY has been set up on your computer and is ready for system optimization.</p>

              <div style={{
                marginTop: 28, padding: '12px 20px', borderRadius: 12,
                background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)',
                display: 'inline-block'
              }}>
                <Tick on={launchApp} toggle={setLaunchApp} label="Launch TFY application immediately" />
              </div>

              <button 
                onMouseEnter={() => setHoverFinish(true)}
                onMouseLeave={() => setHoverFinish(false)}
                onClick={finish}
                style={{
                  marginTop: 24, padding: '11px 28px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                  background: 'linear-gradient(135deg, #7c5eff, #a78bfa)', border: 'none', color: '#ffffff',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  boxShadow: hoverFinish ? '0 8px 24px rgba(124, 94, 255, 0.45)' : '0 6px 22px rgba(124, 94, 255, 0.35)', 
                  transform: hoverFinish ? 'translateY(-1px) scale(1.02)' : 'none',
                  filter: hoverFinish ? 'brightness(1.15)' : 'none',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                <Rocket size={14} /> Finish & Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ CUSTOM OVERWRITE DIALOG ═══ */}
      {showOverwriteModal && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(3, 4, 7, 0.85)',
          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, transition: 'all 0.3s ease'
        }}>
          <div style={{
            width: 400, padding: 24, borderRadius: 16, background: '#0a0c14',
            border: '1px solid rgba(255, 99, 99, 0.15)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', gap: 16,
            transform: 'scale(1)', transition: 'all 0.3s ease'
          }}>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <ShieldCheck size={20} color="#f87171" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f87171', margin: 0 }}>Overwrite Folder?</h3>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                  The target installation folder already exists and is not empty:
                </span>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', wordBreak: 'break-all', marginTop: 4, background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: 6 }}>
                  {installPath}
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginTop: 4 }}>
                  Are you sure you want to overwrite all files inside this folder?
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button
                onClick={() => setShowOverwriteModal(false)}
                style={{
                  padding: '9px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.8)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowOverwriteModal(false);
                  setErrorMsg(null); setProgress(0); setProgressStatus("Starting installation..."); goTo(3, 'next');
                  send({
                    type: 'start-install',
                    data: {
                      path: installPath,
                      createShortcut,
                      installNet: installNet && !prereqs.netInstalled,
                      installVc: installVc && !prereqs.vcInstalled,
                      cleanOldVersion: cleanOldVersion && prereqs.oldVersionDetected,
                      overwriteConfirmed: true
                    }
                  });
                }}
                style={{
                  padding: '9px 18px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, #ef4444, #f87171)', color: '#ffffff',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: '0 4px 15px rgba(239, 68, 68, 0.25)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
                onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
              >
                Overwrite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
