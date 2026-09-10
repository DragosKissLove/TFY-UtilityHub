import React, { useState, useEffect } from 'react';
import { Download, Youtube, Settings, Loader2, PlayCircle, AlertCircle, Music } from 'lucide-react';

type EngineState = 'checking' | 'not-installed' | 'installing' | 'ready';
type DownloadState = 'idle' | 'downloading' | 'error' | 'done';

export const MediaDownloader = React.memo(function MediaDownloader() {
  const [engineState, setEngineState] = useState<EngineState>('checking');
  const [installProgress, setInstallProgress] = useState(0);
  
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<'mp3' | 'mp4'>('mp3');
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Check engine status
    window.chrome?.webview?.postMessage(JSON.stringify({ type: 'media-downloader', action: 'check' }));

    const handleMessage = (event: any) => {
      try {
        let msg = event.data;
        if (typeof msg === 'string') {
          try { msg = JSON.parse(msg); } catch { return; }
        }
        if (msg?.type !== 'media-downloader') return;

        if (msg.action === 'status') {
          setEngineState(msg.installed ? 'ready' : 'not-installed');
        } else if (msg.action === 'install-progress') {
          setInstallProgress(msg.progress);
        } else if (msg.action === 'download-progress') {
          setDownloadProgress(msg.progress);
        } else if (msg.action === 'download-done') {
          setDownloadState(msg.success ? 'done' : 'idle');
          if (msg.success) {
            setTimeout(() => setDownloadState('idle'), 3000);
            setUrl('');
          }
        } else if (msg.action === 'error') {
          setEngineState(prev => prev === 'installing' ? 'not-installed' : prev);
          setDownloadState('error');
          setErrorMsg(msg.message || 'Unknown error occurred.');
          setTimeout(() => setDownloadState('idle'), 5000);
        }
      } catch (err) {}
    };

    window.chrome?.webview?.addEventListener('message', handleMessage);
    return () => window.chrome?.webview?.removeEventListener('message', handleMessage);
  }, []);

  const handleInstall = () => {
    setEngineState('installing');
    setInstallProgress(0);
    window.chrome?.webview?.postMessage(JSON.stringify({ type: 'media-downloader', action: 'install' }));
  };

  const handleDownload = () => {
    if (!url.trim()) return;
    setDownloadState('downloading');
    setDownloadProgress(0);
    window.chrome?.webview?.postMessage(JSON.stringify({ 
      type: 'media-downloader', 
      action: 'download',
      url: url.trim(),
      format: format
    }));
  };

  return (
    <div className="panel panel-outline rounded-2xl liquid-card tfy-diagonal-glow shrink-0" style={{ position: 'relative' }}>
      <div className="flex items-center gap-4 w-full text-left p-5 pb-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 gaming-card-icon"
          style={{ background: 'color-mix(in srgb, var(--accent) 16%, rgba(255,255,255,0.04))' }}>
          <PlayCircle size={24} className="text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-white font-semibold text-lg">Media Downloader</div>
          <div className="text-sm text-gray-400 mt-0.5 flex items-center gap-2">
            <Youtube size={14} /> YouTube & <SpotifyIcon size={14} /> Spotify to MP3/MP4
          </div>
        </div>
      </div>

      <div className="px-5 pb-5 pt-2">
        {engineState === 'checking' && (
          <div className="flex items-center gap-3 text-gray-400 text-sm py-4">
            <Loader2 size={16} className="animate-spin text-accent" />
            Checking engine status...
          </div>
        )}

        {engineState === 'not-installed' && (
          <div className="bg-black/30 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-white text-sm font-semibold">
              <Download size={16} className="text-accent" /> Installation Required
            </div>
            <div className="text-xs text-gray-400 leading-relaxed">
              To download high quality MP3s and MP4s, the app requires <strong>yt-dlp</strong> and <strong>ffmpeg</strong> (approx 85MB). This is a one-time process.
            </div>
            <button 
              onClick={handleInstall}
              className="mt-2 w-full flex items-center justify-center gap-2 bg-accent text-black font-bold py-2.5 rounded-lg transition-all hover:brightness-110 text-sm"
            >
              <Download size={16} /> Install Now
            </button>
          </div>
        )}

        {engineState === 'installing' && (
          <div className="flex flex-col gap-2 py-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Installing Engine (yt-dlp + ffmpeg)...</span>
              <span className="text-accent">{installProgress}%</span>
            </div>
            <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
              <div 
                className="h-full bg-accent transition-all duration-300 ease-out" 
                style={{ width: `${installProgress}%` }}
              />
            </div>
          </div>
        )}

        {engineState === 'ready' && (
          <div className="flex flex-col gap-3 mt-1">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Paste YouTube or Spotify URL here..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={downloadState === 'downloading'}
                className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50 transition-colors"
              />
              <div className="flex bg-black/30 border border-white/10 rounded-lg p-1 text-sm shrink-0">
                <button 
                  type="button"
                  disabled={downloadState === 'downloading'}
                  className={`px-3 py-1.5 rounded-md transition-all ${format === 'mp3' ? 'bg-accent text-black font-semibold shadow-lg' : 'text-gray-400 hover:text-white'}`}
                  onClick={() => setFormat('mp3')}
                >
                  MP3
                </button>
                <button 
                  type="button"
                  disabled={downloadState === 'downloading'}
                  className={`px-3 py-1.5 rounded-md transition-all ${format === 'mp4' ? 'bg-accent text-black font-semibold shadow-lg' : 'text-gray-400 hover:text-white'}`}
                  onClick={() => setFormat('mp4')}
                >
                  MP4
                </button>
              </div>
            </div>

            {url && (url.toLowerCase().includes('playlist') || url.toLowerCase().includes('&list=') || url.toLowerCase().includes('album')) && (
              <div className="flex items-center gap-2 text-xs font-medium text-accent/80 bg-accent/10 px-3 py-2 rounded-lg border border-accent/20">
                <Music size={14} /> Playlist / Album Detected (Folder selection will be prompted)
              </div>
            )}

            {downloadState === 'downloading' && (
              <div className="flex flex-col gap-2 py-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Downloading & Converting...</span>
                  <span className="text-accent">{downloadProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent transition-all duration-300 ease-out" 
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {downloadState === 'error' && (
              <div className="text-xs text-red-400 flex items-start gap-1.5 bg-red-500/10 p-2 rounded">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span className="break-all">{errorMsg}</span>
              </div>
            )}

            {downloadState === 'done' && (
              <div className="text-xs text-accent font-semibold flex items-center gap-1.5 justify-center">
                <Check size={14} /> Download completed successfully!
              </div>
            )}

            <button 
              onClick={handleDownload}
              disabled={!url.trim() || downloadState === 'downloading'}
              className="w-full flex items-center justify-center gap-2 bg-accent text-black font-bold py-2.5 rounded-lg transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {downloadState === 'downloading' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {downloadState === 'downloading' ? 'Processing...' : 'Download'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

// Temporary internal component for checkmark since it's not imported at the top
function Check({ size, className }: { size?: number, className?: string }) {
  return (
    <svg width={size || 24} height={size || 24} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );
}

function SpotifyIcon({ size, className }: { size?: number, className?: string }) {
  return (
    <svg width={size || 24} height={size || 24} className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.84.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.72 1.621.539.3.719 1.02.419 1.56-.299.42-1.02.599-1.559.3z"/>
    </svg>
  );
}
