import { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, Download, HardDrive, Gamepad2, Loader2, AlertTriangle,
  ImageIcon, X, Clock, ExternalLink, Star, Tag, Play, Pause,
} from 'lucide-react';
import { getLanguage, type TfyLanguage } from '../lib/i18n';

interface GameEntry {
  title: string;
  fileSize: string;
  uris: string[];
  uploadDate: string;
  source: string;
}

interface SteamData {
  url: string;           // header image
  appId?: string;
  steamUrl?: string;
  trailerUrl?: string;
  description?: string;
  genres?: string[];
  metacritic?: number;
  releaseDate?: string;
}

// In-memory cache
const imageCache: Record<string, SteamData> = {};

// ── Modal ──────────────────────────────────────────────────────────────────
function GameModal({ game, steamData, language, onClose }: {
  game: GameEntry;
  steamData?: SteamData;
  language: TfyLanguage;
  onClose: () => void;
}) {
  const [showOptions, setShowOptions] = useState(false);
  const [closing, setClosing] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [bannerColor, setBannerColor] = useState({ r: 100, g: 100, b: 100 });

  // Extract dominant color from banner image
  useEffect(() => {
    if (!steamData?.url || steamData.url === 'fallback') return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 36;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, 64, 36);
        const data = ctx.getImageData(0, 0, 64, 36).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 16) {
          const pr = data[i], pg = data[i+1], pb = data[i+2];
          // Skip very dark/very bright pixels for better accent
          if (pr + pg + pb > 60 && pr + pg + pb < 680) {
            r += pr; g += pg; b += pb; count++;
          }
        }
        if (count > 0) {
          r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
          // Boost saturation slightly
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          if (max > 0) {
            const boost = 1.3;
            r = Math.min(255, Math.round(r + (r - (r+g+b)/3) * boost));
            g = Math.min(255, Math.round(g + (g - (r+g+b)/3) * boost));
            b = Math.min(255, Math.round(b + (b - (r+g+b)/3) * boost));
          }
          setBannerColor({ r, g, b });
        }
      } catch { /* CORS or canvas error — keep default */ }
    };
    img.src = steamData.url;
  }, [steamData?.url]);

  const bc = bannerColor;
  const bcStr = `${bc.r},${bc.g},${bc.b}`;

  const handleClose = () => { setClosing(true); setTimeout(onClose, 220); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleVideo = () => {
    if (!videoRef.current) return;
    if (videoPlaying) { videoRef.current.pause(); setVideoPlaying(false); }
    else { videoRef.current.play(); setVideoPlaying(true); }
  };

  const handleDownload = (uri: string) => {
    if ((window as any).chrome?.webview) {
      (window as any).chrome.webview.postMessage(`open-url|${uri}`);
    } else {
      window.location.href = uri;
    }
  };

  const openUrl = (url: string) => {
    if ((window as any).chrome?.webview) {
      (window as any).chrome.webview.postMessage(`open-url|${url}`);
    } else {
      window.open(url, '_blank');
    }
  };

  const hasImage = steamData?.url && steamData.url !== 'fallback';
  const hasTrailer = !!steamData?.trailerUrl;

  const formatDate = (iso?: string) => {
    if (!iso) return 'N/A';
    try {
      return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return iso; }
  };


  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      animation: closing ? 'modalBgOut 0.22s ease-in forwards' : 'modalBgIn 0.2s ease-out forwards',
    }}>
      {/* Backdrop */}
      {/* Removed backdrop img to avoid excessive background glow */}
      <div onClick={handleClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      }} />

      {/* Card */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: '680px',
        maxHeight: '92vh', overflowY: 'auto',
        background: 'linear-gradient(180deg, #0b0d17 0%, #080910 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '22px',
        boxShadow: '0 60px 120px rgba(0,0,0,0.75)',
        animation: closing
          ? 'modalCardOut 0.22s cubic-bezier(0.4,0,1,1) forwards'
          : 'modalCardIn 0.3s cubic-bezier(0.34,1.4,0.64,1) forwards',
      }}>
        {/* Inner Card Tint Image (Brings banner color to the card) */}
        {hasImage && (
          <img
            src={steamData!.url}
            alt=""
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover',
              opacity: 0.1, filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0
            }}
          />
        )}
        <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Close */}
        <button onClick={handleClose} style={{
          position: 'absolute', top: '14px', right: '14px', zIndex: 20,
          width: '34px', height: '34px', borderRadius: '10px',
          background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#9ca3af', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.65)'; e.currentTarget.style.color = '#9ca3af'; }}
        ><X size={15} /></button>

        {/* ── Banner / Video ── */}
        <div style={{ position: 'relative', height: '260px', overflow: 'hidden', borderRadius: '22px 22px 0 0', background: '#040506' }}>
          {/* Video trailer */}
          {hasTrailer && (
            <video
              ref={videoRef}
              src={steamData!.trailerUrl.replace('http://', 'https://')}
              muted
              loop
              playsInline
              onLoadedData={() => setVideoLoaded(true)}
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                opacity: videoPlaying ? 1 : 0,
                transition: 'opacity 0.5s',
                position: 'absolute', inset: 0,
              }}
            />
          )}

          {/* Static header image (shown when video not playing) */}
          {hasImage && (
            <img
              src={steamData!.url}
              alt={game.title}
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                filter: 'brightness(0.5)',
                opacity: videoPlaying && videoLoaded ? 0 : 1,
                transition: 'opacity 0.5s',
                position: 'absolute', inset: 0,
              }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}

          {/* Gradient */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, #080910 0%, rgba(8,9,16,0.3) 55%, transparent 100%)',
            pointerEvents: 'none',
          }} />

          {/* Play/Pause button */}
          {hasTrailer && videoLoaded && (
            <button onClick={toggleVideo} style={{
              position: 'absolute', bottom: '16px', right: '16px',
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.7)'; }}
            >
              {videoPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
            </button>
          )}

          {/* Thumbnail bottom-left */}
          {hasImage && (
            <div style={{ position: 'absolute', bottom: '16px', left: '20px' }}>
              <img src={steamData!.url} alt="" style={{
                width: '130px', borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          )}
        </div>

        {/* ── Content ── */}
        <div style={{ padding: '20px 24px 28px' }}>
          {/* Title + meta row */}
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '10px', lineHeight: 1.3 }}>
              {game.title}
            </h2>

            {/* Tags row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              {/* Source */}
              <span style={{
                padding: '3px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                color: 'var(--accent)',
                background: 'color-mix(in srgb, var(--accent) 12%, rgba(255,255,255,0.03))',
                border: '1px solid color-mix(in srgb, var(--accent) 22%, rgba(255,255,255,0.06))',
              }}>{game.source}</span>

              {/* File size */}
              <span style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <HardDrive size={11} /> {game.fileSize}
              </span>

              {/* Upload date */}
              <span style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Clock size={11} />
                {game.uploadDate ? new Date(game.uploadDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : 'N/A'}
              </span>
            </div>

            {/* Genres */}
            {steamData?.genres && steamData.genres.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                {steamData.genres.map((g, i) => (
                  <span key={i} style={{
                    padding: '2px 8px', borderRadius: '6px', fontSize: '11px',
                    color: '#9ca3af', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    <Tag size={9} />{g}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          {steamData?.description && (
            <p style={{
              fontSize: '13px', color: '#9ca3af', lineHeight: 1.65,
              marginBottom: '20px',
              display: '-webkit-box', WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {steamData.description.replace(/<[^>]*>/g, '')}
            </p>
          )}

          {/* External links row — themed with banner color */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {steamData?.steamUrl && (
              <button
                onClick={() => openUrl(steamData.steamUrl!)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 600,
                  color: `rgb(${bcStr})`, background: `rgba(${bcStr},0.08)`,
                  border: `1px solid rgba(${bcStr},0.25)`, cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `rgba(${bcStr},0.18)`; e.currentTarget.style.borderColor = `rgba(${bcStr},0.45)`; }}
                onMouseLeave={e => { e.currentTarget.style.background = `rgba(${bcStr},0.08)`; e.currentTarget.style.borderColor = `rgba(${bcStr},0.25)`; }}
              >
                <svg width="14" height="14" viewBox="0 0 256 259" fill={`rgb(${bcStr})`}><path d="M127.779 0C57.867 0 .234 55.451.234 124.027L68.59 152.3a36.307 36.307 0 0 1 20.589-6.373l.053-.001 30.809-44.627v-.663c0-26.876 21.887-48.762 48.763-48.762 26.877 0 48.763 21.886 48.763 48.762s-21.886 48.755-48.763 48.755h-1.131l-43.917 31.35.034 1.075c0 20.213-16.382 36.63-36.595 36.63-18.058 0-33.101-13.174-36.085-30.441L.662 165.235C14.146 218.677 63.41 258.456 122.252 258.456c70.668 0 127.974-57.306 127.974-127.974C250.226 57.814 198.447 0 127.779 0zM80.362 196.983l-15.876-6.567c2.821 5.854 7.69 10.763 14.136 13.445 13.968 5.806 30.062-.832 35.868-14.8 2.81-6.764 2.8-14.2.006-20.978-2.793-6.778-8.074-12.069-14.838-14.878-6.715-2.782-13.857-2.594-20.074-.208l16.406 6.79c10.301 4.28 15.18 16.148 10.901 26.449-4.28 10.3-16.149 15.172-26.449 10.9zm108.907-93.076c0-17.9-14.576-32.477-32.483-32.477-17.907 0-32.483 14.576-32.483 32.477 0 17.9 14.576 32.477 32.483 32.477 17.907 0 32.483-14.576 32.483-32.477zm-56.707-.048c0-13.43 10.857-24.337 24.285-24.337 13.428 0 24.336 10.907 24.336 24.337 0 13.429-10.908 24.335-24.336 24.335-13.428 0-24.285-10.906-24.285-24.335z"/></svg>
                View on Steam
                <ExternalLink size={11} />
              </button>
            )}

            {/* Epic Games Search Link */}
            {game.source?.toLowerCase().includes('epic') && (
              <button
                onClick={() => openUrl(`https://store.epicgames.com/en-US/browse?q=${encodeURIComponent(game.title.split(' v')[0])}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 600,
                  color: `rgb(${bcStr})`, background: `rgba(${bcStr},0.08)`,
                  border: `1px solid rgba(${bcStr},0.25)`, cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `rgba(${bcStr},0.18)`; }}
                onMouseLeave={e => { e.currentTarget.style.background = `rgba(${bcStr},0.08)`; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill={`rgb(${bcStr})`}><path d="M3.537 0C2.165 0 1.66.506 1.66 1.879V18.44c0 .144.007.289.02.433.031.3.037.59.316.92.027.033.311.245.311.245.153.075.258.13.43.2l8.335 3.491c.433.199.614.276.928.27h.002c.314.006.495-.071.928-.27l8.335-3.492c.172-.07.277-.124.43-.2 0 0 .284-.211.311-.243.28-.33.285-.621.316-.92.013-.144.02-.289.02-.434V1.879C22.342.506 21.836 0 20.464 0zM16.903 3.11h.68c1.138 0 1.688.553 1.688 1.696v1.88h-1.374v-1.8c0-.369-.17-.54-.523-.54h-.235c-.367 0-.537.17-.537.539v5.81c0 .369.17.54.537.54h.262c.353 0 .523-.171.523-.54V8.619h1.373v2.143c0 1.144-.562 1.71-1.7 1.71h-.694c-1.138 0-1.7-.566-1.7-1.71V4.82c0-1.144.562-1.709 1.7-1.709zm-12.186.08h3.114v1.274H6.117v2.603h1.648v1.275H6.117v2.774h1.74v1.275h-3.14zm3.816 0h2.198c1.138 0 1.7.564 1.7 1.708v2.445c0 1.144-.562 1.71-1.7 1.71h-.799v3.338h-1.4zm4.53 0h1.4v9.201h-1.4zm-3.13 1.235v3.392h.575c.354 0 .523-.171.523-.54V4.965c0-.368-.17-.54-.523-.54z"/></svg>
                View on Epic
                <ExternalLink size={11} />
              </button>
            )}

            {/* YouTube Trailer Fallback Search */}
            {!hasTrailer && (
              <button
                onClick={() => openUrl(`https://www.youtube.com/results?search_query=${encodeURIComponent(game.title.split(' v')[0] + ' gameplay trailer')}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 600,
                  color: `rgb(${bcStr})`, background: `rgba(${bcStr},0.08)`,
                  border: `1px solid rgba(${bcStr},0.25)`, cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `rgba(${bcStr},0.18)`; }}
                onMouseLeave={e => { e.currentTarget.style.background = `rgba(${bcStr},0.08)`; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={`rgb(${bcStr})`}><path d="M21.582,6.186a2.671,2.671,0,0,0-1.884-1.884C17.986,3.8,12,3.8,12,3.8s-5.986,0-7.698.502A2.671,2.671,0,0,0,2.418,6.186C1.916,7.898,1.916,12,1.916,12s0,4.102.502,5.814a2.671,2.671,0,0,0,1.884,1.884C6.014,20.2,12,20.2,12,20.2s5.986,0,7.698-.502a2.671,2.671,0,0,0,1.884-1.884C22.084,16.102,22.084,12,22.084,12S22.084,7.898,21.582,6.186ZM9.963,15.518V8.482L16.239,12Z"/></svg>
                Find Trailer
              </button>
            )}
          </div>

          {/* Download section — themed with banner color */}
          <div style={{
            borderRadius: '14px', padding: '16px',
            background: `rgba(${bcStr},0.04)`,
            border: `1px solid rgba(${bcStr},0.12)`,
          }}>
            {!showOptions ? (
              <button
                onClick={() => setShowOptions(true)}
                style={{
                  width: '100%', padding: '12px', borderRadius: '12px',
                  background: `rgb(${bcStr})`, color: '#fff', fontWeight: 600, fontSize: '14px',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'filter 0.15s',
                  boxShadow: `0 4px 18px rgba(${bcStr},0.35)`,
                }}
                onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)'; }}
              >
                <Download size={16} /> Open download options
              </button>
            ) : (
              <div style={{ animation: 'modalBgIn 0.18s ease-out' }}>
                <p style={{ fontSize: '11px', color: '#4b5563', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Downloader
                </p>
                {game.uris.map((uri, idx) => {
                  const isMagnet = uri.startsWith('magnet:');
                  let label = 'Direct Link';
                  if (isMagnet) label = 'BitTorrent / Magnet';
                  else { try { label = new URL(uri).hostname.replace('www.', ''); } catch {} }
                  return (
                    <div
                      key={idx}
                      onClick={() => handleDownload(uri)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px', borderRadius: '10px', cursor: 'pointer', marginBottom: '6px',
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.06)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '10px', height: '10px', borderRadius: '50%',
                          background: isMagnet ? '#a855f7' : '#22c55e',
                          boxShadow: isMagnet ? '0 0 8px rgba(168,85,247,0.8)' : '0 0 8px rgba(34,197,94,0.8)',
                        }} />
                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#d1d5db' }}>{label}</span>
                      </div>
                      <Download size={14} color="#4b5563" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Trending Games Showcase ────────────────────────────────────────────────
const TRENDING_SETS = [
  [
    { name: 'GTA VI', appId: '2383950', tag: '🔥 Most Anticipated' },
    { name: 'Elden Ring: Nightreign', appId: '2622380', tag: '⚔️ Co-op Souls' },
    { name: 'DOOM: The Dark Ages', appId: '3017860', tag: '🎮 FPS King' },
  ],
  [
    { name: 'Marvel Rivals', appId: '2767030', tag: '🦸 Hero Shooter' },
    { name: 'Black Myth: Wukong', appId: '2358720', tag: '🐉 Action RPG' },
    { name: 'S.T.A.L.K.E.R. 2', appId: '356170', tag: '☢️ Open World' },
  ],
  [
    { name: 'Cyberpunk 2077', appId: '1091500', tag: '🌆 RPG Legend' },
    { name: 'Monster Hunter Wilds', appId: '2246340', tag: '🗡️ Hunt & Slay' },
    { name: 'Path of Exile 2', appId: '2694490', tag: '💀 ARPG' },
  ],
  [
    { name: 'God of War Ragnarök', appId: '2322010', tag: '⚡ Action Epic' },
    { name: 'Red Dead Redemption 2', appId: '1174180', tag: '🤠 Masterpiece' },
    { name: 'The Witcher 3', appId: '292030', tag: '🐺 GOAT RPG' },
  ],
];

function TrendingShowcase({ gamesCount }: { gamesCount: number }) {
  const [setIdx, setSetIdx] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setSetIdx(prev => (prev + 1) % TRENDING_SETS.length);
        setFade(true);
      }, 300);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const current = TRENDING_SETS[setIdx];

  return (
    <div className="flex flex-col items-center text-center py-10 px-6 animate-fadeIn">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">🔥</span>
        <h3 className="text-white font-bold text-base tracking-tight">Trending Right Now</h3>
      </div>
      <p className="text-gray-500 text-xs mb-5">
        Top picks from <span className="text-accent font-medium">{gamesCount.toLocaleString()}</span> games — search to find yours
      </p>

      <div className="flex gap-3 w-full max-w-lg justify-center"
        style={{ opacity: fade ? 1 : 0, transform: fade ? 'translateY(0)' : 'translateY(6px)', transition: 'all 0.3s ease-out' }}>
        {current.map((game, i) => (
          <div key={game.appId} className="relative flex-1 rounded-xl overflow-hidden border border-white/[0.08] group cursor-default"
            style={{ maxWidth: '160px', animation: `cardPop 0.3s ease-out ${i * 80}ms both` }}>
            <div className="relative h-20 overflow-hidden bg-white/[0.02]">
              <img
                src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appId}/header.jpg`}
                alt={game.name}
                className="w-full h-full object-cover opacity-75 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <span className="absolute top-1.5 left-1.5 text-[9px] font-black text-white/90 bg-black/60 rounded-md px-1.5 py-0.5 backdrop-blur-sm border border-white/10">
                #{i + 1}
              </span>
            </div>
            <div className="p-2 bg-white/[0.015]">
              <p className="text-white/90 text-[11px] font-semibold truncate leading-tight">{game.name}</p>
              <p className="text-[9px] text-gray-500 mt-0.5">{game.tag}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 mt-4">
        {TRENDING_SETS.map((_, i) => (
          <div key={i} className="rounded-full transition-all duration-300"
            style={{
              width: i === setIdx ? '16px' : '5px', height: '5px',
              background: i === setIdx ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
            }} />
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export function GamesCatalog() {
  const language = getLanguage() as TfyLanguage;
  const [games, setGames] = useState<GameEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [steamData, setSteamData] = useState<Record<string, SteamData>>({});
  const [selectedGame, setSelectedGame] = useState<GameEntry | null>(null);
  const [loadingImages, setLoadingImages] = useState(false);

  // Load game sources
  useEffect(() => {
    const hasWebview = !!(window as any).chrome?.webview;
    if (hasWebview) {
      setLoading(true);
      const handler = (event: any) => {
        try {
          const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (msg?.type !== 'games-list') return;
          const loadedGames = msg.data?.games ?? [];
          setGames(loadedGames);
          setError(loadedGames.length === 0 ? 'No games could be loaded from sources.' : null);
          setLoading(false);
        } catch { /* ignore */ }
      };
      (window as any).chrome.webview.addEventListener('message', handler);
      (window as any).chrome.webview.postMessage('games-fetch');

      return () => {
        (window as any).chrome.webview.removeEventListener('message', handler);
      };
    } else {
      // Direct fetch fallback
      (async () => {
        try {
          const r = await fetch('/data/games.json');
          if (r.ok) {
            const local = await r.json();
            setGames(local);
          }
        } catch { }
        setLoading(false);
      })();
    }
  }, []);

  const filteredGames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return games.filter(g => g.title?.toLowerCase().includes(q) || g.source?.toLowerCase().includes(q));
  }, [games, searchQuery]);

  // Fetch Steam data via C# proxy
  useEffect(() => {
    if (filteredGames.length === 0) return;
    const slice = filteredGames.slice(0, 16);

    // Apply cached
    const immediate: Record<string, SteamData> = { ...steamData };
    let hasImm = false;
    slice.forEach(g => {
      if (imageCache[g.title] && !immediate[g.title]) { immediate[g.title] = imageCache[g.title]; hasImm = true; }
    });
    if (hasImm) setSteamData({ ...immediate });

    const toFetch = slice.filter(g => !imageCache[g.title]);
    if (toFetch.length === 0) return;

    const hasWebview = !!(window as any).chrome?.webview;
    if (hasWebview) {
      setLoadingImages(true);
      const pending = new Set(toFetch.map(g => g.title));

      const handler = (event: any) => {
        try {
          const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (msg?.type !== 'steam-image') return;
          const d = msg.data ?? {};
          if (!d.title) return;
          const sd: SteamData = {
            url: d.url ?? 'fallback',
            appId: d.appId,
            steamUrl: d.steamUrl,
            trailerUrl: d.trailerUrl,
            description: d.description,
            genres: d.genres,
            metacritic: d.metacritic,
            releaseDate: d.releaseDate,
          };
          imageCache[d.title] = sd;
          setSteamData(prev => ({ ...prev, [d.title]: sd }));
          pending.delete(d.title);
          if (pending.size === 0) setLoadingImages(false);
        } catch { /* ignore */ }
      };

      (window as any).chrome.webview.addEventListener('message', handler);
      toFetch.forEach((game, i) => {
        setTimeout(() => {
          (window as any).chrome.webview.postMessage(`fetch-steam|${game.title}`);
        }, i * 100);
      });

      const cleanup = setTimeout(() => {
        (window as any).chrome.webview.removeEventListener('message', handler);
        setLoadingImages(false);
      }, 45000);

      return () => {
        clearTimeout(cleanup);
        (window as any).chrome.webview.removeEventListener('message', handler);
      };
    }
  }, [filteredGames]);

  return (
    <>
      <style>{`
        @keyframes modalBgIn   { from{opacity:0} to{opacity:1} }
        @keyframes modalBgOut  { from{opacity:1} to{opacity:0} }
        @keyframes modalCardIn { from{opacity:0;transform:translateY(22px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes modalCardOut{ from{opacity:1;transform:translateY(0) scale(1)} to{opacity:0;transform:translateY(16px) scale(0.97)} }
        @keyframes cardPop     { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div className="panel panel-outline rounded-2xl overflow-hidden shrink-0"
        style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Header */}
        <div className="p-5 border-b border-white/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'color-mix(in srgb, var(--accent) 14%, rgba(255,255,255,0.04))' }}>
              <Gamepad2 size={22} className="text-accent" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">Game Library</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {!loading && games.length > 0
                  ? `${games.length.toLocaleString()} games available — search to explore`
                  : 'Search and download repacks from integrated sources.'}
              </p>
            </div>
          </div>
          <div className="relative w-full sm:w-72 group">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-accent transition-colors duration-200" />
            <input
              type="text"
              placeholder="Search games..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 hover:bg-white/[0.05] focus:bg-white/[0.07] focus:border-[var(--accent)]/50 outline-none transition-all"
            />
          </div>
        </div>

        {/* Body */}
        <div className="min-h-[200px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fadeIn">
              <Loader2 size={32} className="animate-spin text-accent" />
              <p className="text-sm text-gray-400">Loading database...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center text-center py-16 px-6 animate-fadeIn">
              <div className="w-16 h-16 rounded-2xl bg-red-500/8 flex items-center justify-center mb-4 border border-red-500/15">
                <AlertTriangle size={28} className="text-red-400" />
              </div>
              <p className="text-sm text-gray-500 max-w-sm">{error}</p>
            </div>
          ) : searchQuery.length < 2 ? (
            <TrendingShowcase gamesCount={games.length} />
          ) : filteredGames.length === 0 ? (
            <div className="flex flex-col items-center text-center py-16 animate-fadeIn">
              <div className="w-14 h-14 rounded-xl bg-white/[0.03] flex items-center justify-center mb-4 border border-white/[0.05]">
                <Search size={22} className="text-gray-600" />
              </div>
              <p className="text-gray-500 text-sm">No results for <span className="text-gray-300">"{searchQuery}"</span></p>
            </div>
          ) : (
            <div className="p-4">
              <p className="text-xs text-gray-500 mb-3">
                <span className="text-gray-300">{Math.min(filteredGames.length, 50)}</span> of{' '}
                <span className="text-gray-300">{filteredGames.length.toLocaleString()}</span> results
                {loadingImages && <span className="ml-2 text-accent/70 animate-pulse">· loading covers</span>}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredGames.slice(0, 50).map((game, i) => {
                  const sd = steamData[game.title];
                  const hasImg = sd?.url && sd.url !== 'fallback';
                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedGame(game)}
                      className="group rounded-xl overflow-hidden flex flex-col cursor-pointer border border-white/[0.05] hover:border-[var(--accent)]/40 transition-all duration-200"
                      style={{
                        background: 'rgba(255,255,255,0.02)', opacity: 0,
                        animation: `cardPop 0.3s ease-out ${i * 25}ms forwards`,
                      }}
                    >
                      <div className="h-24 relative overflow-hidden bg-white/[0.02] flex items-center justify-center">
                        {hasImg ? (
                          <img src={sd!.url} alt={game.title}
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300" />
                        ) : (
                          <ImageIcon size={20} className="text-gray-700" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        {/* Trailer indicator */}
                        {sd?.trailerUrl && (
                          <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center border border-white/10">
                            <Play size={8} fill="white" color="white" />
                          </div>
                        )}
                        <span className="absolute bottom-1.5 right-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-gray-300 border border-white/10 uppercase tracking-wide">
                          {game.source}
                        </span>
                      </div>
                      <div className="p-2.5 flex-1 flex flex-col">
                        <h3 className="text-white/90 font-medium text-[11px] line-clamp-2 leading-snug mb-2 group-hover:text-white transition-colors">
                          {game.title}
                        </h3>
                        <div className="mt-auto flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                            <HardDrive size={9} /> {game.fileSize}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedGame && (
        <GameModal
          game={selectedGame}
          steamData={steamData[selectedGame.title]}
          language={language}
          onClose={() => setSelectedGame(null)}
        />
      )}
    </>
  );
}
