import { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle, Cpu, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import { Modal } from './Modal';

interface GpuOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ScreenState = 'backup' | 'backup_creating' | 'steps' | 'success';
type StepState = 'checking' | 'ddu_required' | 'ddu_running' | 'nvclean_required' | 'nvclean_running' | 'profiles_ready' | 'profiles_applying';

export function GpuOptimizerModal({ isOpen, onClose }: GpuOptimizerModalProps) {
  const [screen, setScreen] = useState<ScreenState>('backup');
  const [step, setStep] = useState<StepState>('checking');
  const [hasNvidiaDriver, setHasNvidiaDriver] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setScreen('backup');
      setStep('checking');
      setBackupMessage('');
      
      // Query C# backend to check if NVIDIA driver is installed
      if (window.chrome?.webview) {
        window.chrome.webview.postMessage('gpu-check-driver');
      } else {
        // Fallback for browser testing
        setTimeout(() => {
          setHasNvidiaDriver(true);
          setStep('ddu_required');
        }, 1000);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const handleMessage = (event: any) => {
      let message = event.data;
      if (typeof message === 'string') {
        try { message = JSON.parse(message); } catch { return; }
      }

      if (message?.type === 'gpu_optimizer') {
        const action = message.action;
        
        if (action === 'driver_status') {
          const hasDriver = Boolean(message.hasNvidiaDriver);
          setHasNvidiaDriver(hasDriver);
          setStep(hasDriver ? 'ddu_required' : 'nvclean_required');
        }
        
        else if (action === 'backup_status') {
          if (message.ok) {
            window.__tfyNotify?.({
              kind: 'success',
              title: 'Backup Complete',
              message: 'System restore point created successfully.'
            });
            setScreen('steps');
          } else {
            window.__tfyNotify?.({
              kind: 'error',
              title: 'Backup Failed',
              message: message.message || 'Failed to create restore point.'
            });
            // Proceed anyway if it fails
            setScreen('steps');
          }
        }
        
        else if (action === 'launch_status') {
          if (!message.ok) {
            window.__tfyNotify?.({
              kind: 'error',
              title: 'Launch Failed',
              message: message.message || 'Failed to launch optimization tool.'
            });
          }
        }
        
        else if (action === 'profiles_status') {
          if (message.ok) {
            window.__tfyNotify?.({
              kind: 'success',
              title: 'GPU Optimized',
              message: 'Custom NVIDIA Profile Inspector profiles imported successfully!'
            });
            setScreen('success');
          } else {
            window.__tfyNotify?.({
              kind: 'error',
              title: 'Profiles Failed',
              message: message.message || 'Failed to apply profiles.'
            });
            setStep('profiles_ready');
          }
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

  const handleCreateBackup = () => {
    setScreen('backup_creating');
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage('gpu-create-backup');
    } else {
      setTimeout(() => {
        setScreen('steps');
      }, 1500);
    }
  };

  const handleSkipBackup = () => {
    setScreen('steps');
  };

  const handleLaunchDDU = () => {
    setStep('ddu_running');
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage('gpu-launch-ddu');
    }
  };

  const handleLaunchNVClean = () => {
    setStep('nvclean_running');
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage('gpu-launch-nvclean');
    }
  };

  const handleApplyProfiles = () => {
    setStep('profiles_applying');
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage('gpu-apply-profiles');
    } else {
      setTimeout(() => {
        setScreen('success');
      }, 2000);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="GPU High Performance"
      hideClose={screen === 'backup_creating' || step === 'profiles_applying'}
      className="tfy-modal-deep max-w-lg"
    >
      {screen === 'backup' && (
        <div className="flex flex-col gap-5 py-2 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-4 bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl relative overflow-hidden">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.3)'
              }}
            >
              <ShieldAlert size={20} className="text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-white">System Backup Recommended</h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Performing display driver cleanups can occasionally cause registry mismatches. We highly recommend creating a System Restore Point before proceeding.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-2">
            <button
              onClick={handleCreateBackup}
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:-translate-y-0.5 active:scale-95"
              style={{
                background: 'var(--accent)',
                color: '#000',
                boxShadow: '0 4px 18px -3px color-mix(in srgb, var(--accent) 55%, transparent)',
                transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'
              }}
            >
              Create System Backup & Proceed
            </button>
            
            <button
              onClick={handleSkipBackup}
              className="w-full py-2.5 rounded-xl font-semibold text-xs transition-all hover:bg-white/5 border border-white/5 text-gray-400 hover:text-white cursor-pointer"
            >
              I already made one
            </button>
          </div>
        </div>
      )}

      {screen === 'backup_creating' && (
        <div className="py-12 flex flex-col items-center justify-center gap-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="relative w-16 h-16">
            <div
              className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin"
              style={{
                borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
                borderTopColor: 'var(--accent)'
              }}
            />
            <ShieldAlert
              className="absolute inset-0 m-auto animate-pulse text-accent"
              size={24}
            />
          </div>
          <p className="text-lg font-bold text-white mt-2">Creating Restore Point...</p>
          <p className="text-xs text-gray-400 text-center max-w-xs leading-relaxed">
            Please wait while Windows creates a safe rollback state. This may take up to a minute.
          </p>
        </div>
      )}

      {screen === 'steps' && (
        <div className="flex flex-col gap-6 py-2 animate-in fade-in duration-200">
          <p className="text-xs text-gray-400 -mt-3">
            Follow the steps below to optimize your GPU driver performance.
          </p>

          <div className="space-y-4">
            {/* STEP 1: DRIVER INSTALLATION */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-4 relative overflow-hidden flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-accent bg-accent/10 border border-accent/25 px-2.5 py-0.5 rounded-full">
                  STEP 1
                </span>
                <span className="text-xs font-semibold text-gray-400">
                  NVIDIA Clean Reinstall
                </span>
              </div>

              {step === 'checking' && (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                  <Loader2 size={14} className="animate-spin" />
                  Checking system driver status...
                </div>
              )}

              {(step === 'ddu_required' || step === 'ddu_running') && (
                <div className="space-y-3 animate-in fade-in duration-200">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    <strong className="text-white">NVIDIA Driver Detected:</strong> DDU (Display Driver Uninstaller) will completely purge existing driver artifacts, telemetry, and conflict caches.
                  </p>
                  <button
                    onClick={handleLaunchDDU}
                    disabled={step === 'ddu_running'}
                    className="w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer hover:bg-white/[0.04] border border-white/10 text-white"
                  >
                    {step === 'ddu_running' ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        DDU Running (Complete & Restart if prompted)...
                      </>
                    ) : (
                      'Launch DDU (Recommended)'
                    )}
                  </button>
                  {step === 'ddu_running' && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => setStep('nvclean_required')}
                        className="text-[10px] text-accent font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        Skip to Driver Installation <ArrowRight size={10} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {(step === 'nvclean_required' || step === 'nvclean_running') && (
                <div className="space-y-3 animate-in fade-in duration-200">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Install a highly debloated NVIDIA driver completely free of telemetry, background container services, and bloatware using NVCleanstall. <strong className="text-accent">Please manually select and search for driver version 560.94 under "Manually select a driver version" inside the tool.</strong>
                  </p>
                  <button
                    onClick={handleLaunchNVClean}
                    disabled={step === 'nvclean_running'}
                    className="w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer hover:bg-white/[0.04] border border-white/10 text-white"
                  >
                    {step === 'nvclean_running' ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-accent" />
                        NVCleanstall Running...
                      </>
                    ) : (
                      'Launch NVCleanstall'
                    )}
                  </button>
                  {step === 'nvclean_running' && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => setStep('profiles_ready')}
                        className="text-[10px] text-accent font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        Proceed to Profile Optimization <ArrowRight size={10} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {step === 'profiles_ready' && (
                <div 
                  className="flex items-center gap-2 text-xs p-3 rounded-xl animate-in zoom-in-95 duration-200"
                  style={{
                    color: 'var(--accent)',
                    background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
                    boxShadow: '0 4px 12px color-mix(in srgb, var(--accent) 6%, transparent)'
                  }}
                >
                  <CheckCircle size={14} className="shrink-0" style={{ color: 'var(--accent)' }} />
                  Clean display driver installation step finished!
                </div>
              )}
            </div>

            {/* STEP 2: PROFILE OPTIMIZATION */}
            <div
              className={`rounded-2xl border p-4 relative overflow-hidden flex flex-col gap-3 transition-opacity duration-300 ${
                step === 'profiles_ready' || step === 'profiles_applying'
                  ? 'opacity-100'
                  : 'opacity-50 border-white/5 bg-white/[0.01] pointer-events-none'
              }`}
              style={
                step === 'profiles_ready' || step === 'profiles_applying'
                  ? {
                      borderColor: 'color-mix(in srgb, var(--accent) 35%, transparent)',
                      background: 'color-mix(in srgb, var(--accent) 2%, rgba(255, 255, 255, 0.01))'
                    }
                  : undefined
              }
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-accent bg-accent/10 border border-accent/25 px-2.5 py-0.5 rounded-full">
                  STEP 2
                </span>
                <span className="text-xs font-semibold text-gray-400">
                  Ultra Performance Profiles
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Applies the customized ultra-performance database settings (<span className="text-white font-mono bg-white/10 px-1 py-0.5 rounded text-[10px]">all_profiles.nip</span>) via Nvidia Profile Inspector to completely disable latency buffers and force high hardware states.
              </p>
              <button
                onClick={handleApplyProfiles}
                disabled={step !== 'profiles_ready' || step === 'profiles_applying'}
                className="w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer hover:bg-white/[0.04] border border-white/10 text-white"
              >
                {step === 'profiles_applying' ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-accent" />
                    Silently Importing Profiles...
                  </>
                ) : (
                  'Apply Optimized Profiles'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'success' && (
        <div className="py-10 flex flex-col items-center justify-center gap-4 animate-in zoom-in-95 duration-300">
          <div className="relative animate-in spin-in-12 duration-500">
            <Sparkles
              size={64}
              style={{ color: 'var(--accent)', filter: 'drop-shadow(0 0 18px var(--accent))' }}
            />
          </div>
          <p className="text-xl font-bold text-white mt-2">GPU Optimization Applied!</p>
          <p className="text-xs text-gray-400 text-center max-w-xs leading-relaxed">
            Clean driver installation completed and optimized NVIDIA profile inspects successfully applied. Enjoy maximum frame rates and minimal input latency!
          </p>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2 rounded-xl font-bold text-xs transition-all hover:bg-white/5 border border-white/5 text-gray-300 hover:text-white cursor-pointer"
          >
            Close
          </button>
        </div>
      )}
    </Modal>
  );
}
