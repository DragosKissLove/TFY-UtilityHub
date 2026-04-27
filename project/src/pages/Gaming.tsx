import { useState, useEffect } from 'react';
import { Zap, Settings as SettingsIcon, Trash2, Database, Wifi, Activity, Star } from 'lucide-react';
import { getLanguage, type TfyLanguage, onLanguageChange } from '../lib/i18n';
import { Cs2ConfigModal } from '../components/Cs2ConfigModal';
import { FortniteConfigModal } from '../components/FortniteConfigModal';
import { PowerPlanModal } from '../components/PowerPlanModal';

const GAMES = [
    { id: 'cs2', name: 'Counter-Strike 2', bg: '/images/banners/cs2.jpg' },
    { id: 'fortnite', name: 'Fortnite', bg: '/images/banners/fortnite.jpg' },
    { id: 'valorant', name: 'Valorant', bg: '/images/banners/valorant.jpg' },
    { id: 'minecraft', name: 'Minecraft', bg: '/images/banners/minecraft.jpg' },
    { id: 'lol', name: 'League of Legends', bg: '/images/banners/lol.jpg' },
];

export function Gaming() {
    const [, setLanguage] = useState<TfyLanguage>(() => getLanguage());
    const [cs2ModalOpen, setCs2ModalOpen] = useState(false);
    const [fortniteModalOpen, setFortniteModalOpen] = useState(false);
    const [powerPlanModalOpen, setPowerPlanModalOpen] = useState(false);
    useEffect(() => onLanguageChange(setLanguage), []);

    return (
        <div className="tfy-themed-page tfy-page-downloads h-full flex flex-col relative w-full translate-z-0 pl-1 pb-1">
            <div className="flex flex-wrap items-center justify-between gap-6 shrink-0 pb-3">
                <div>
                    <p className="section-title">GAMING HUB</p>
                    <h1 className="text-3xl md:text-4xl font-display font-semibold text-white mt-1 flex items-center gap-3">
                        <Zap size={28} className="text-accent" />
                        Gaming
                    </h1>
                    <p className="text-sm text-gray-400 mt-2 max-w-lg leading-snug">Boost FPS and sync community game configurations effortlessly.</p>
                    <div className="flex flex-wrap gap-3 mt-2">
                        <span className="chip flex items-center gap-2">
                            <Star size={13} /> Cloud Sync
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 pb-6 px-4 -mx-4" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* ── FPS Boost & Optimization ── */}
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2 px-1">
                        <div className="min-w-0 flex-1">
                            <div className="text-white font-semibold text-xl flex items-center gap-2">
                                <Activity size={22} className="text-accent" />
                                Universal Game Optimizers
                            </div>
                            <div className="text-sm text-gray-400 mt-1">Select specific optimization functions applicable to any game you play.</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[{ id: 'temp', icon: Trash2, label: 'Clear System Temp', desc: 'Flushes Windows temporary files and game shader caches.', active: true },
                        { id: 'memory', icon: Database, label: 'Clear Memory Cache', desc: 'Frees up standby RAM (Standby List) for immediate game allocation.', active: true },
                        { id: 'power', icon: Zap, label: 'Ultimate Power Plan', desc: 'Forces maximum CPU frequencies and unparks idle processor cores.', active: true },
                        { id: 'network', icon: Wifi, label: 'Network Optimizer', desc: 'Optimizes TCP/IP parameters and flushes DNS to reduce game ping.', active: false },
                        ].map(opt => (
                            <div key={`opt-${opt.id}`} className="download-card tfy-diagonal-glow">

                                <div className="download-card-head">
                                    <div className="download-logo" data-loaded="true" style={{ position: 'relative' }}>
                                        <div className="absolute inset-0 flex items-center justify-center bg-white/5 rounded-xl pointer-events-none">
                                            <opt.icon size={22} className="text-accent" />
                                        </div>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-white font-semibold truncate">{opt.label}</div>
                                        <div className="text-xs text-gray-400 truncate">{opt.desc}</div>
                                    </div>
                                </div>

                                <div className="download-meta">
                                    <span>Optimization</span>
                                    <span className="download-domain">System Tool</span>
                                </div>

                                <div className="download-action-row mt-auto">
                                    <button
                                        type="button"
                                        disabled={!opt.active}
                                        onClick={() => {
                                            if (!opt.active) return;
                                            if (opt.id === 'power') {
                                                setPowerPlanModalOpen(true);
                                                return;
                                            }
                                            if (window.chrome?.webview) {
                                                if (opt.id === 'temp') window.chrome.webview.postMessage('clean-files-run');
                                                else if (opt.id === 'memory') window.chrome.webview.postMessage('memory-cache-run');
                                                else window.chrome.webview.postMessage('gaming-inject-script');
                                            }
                                            window.__tfyNotify?.({ kind: 'success', title: opt.label, message: 'Optimization applied successfully.' });
                                        }}
                                        className={`fix-action resource-action download-btn view-details-btn`}
                                        style={{ display: 'inline-flex', opacity: opt.active ? 1 : 0.5, visibility: 'visible', width: '100%' }}
                                    >
                                        <Zap size={15} />
                                        <span>{opt.active ? 'Optimize Now' : 'Coming Soon'}</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Config Hub ── */}
                <div className="flex flex-col gap-4 mt-2">
                    <div className="flex items-center gap-4 mb-2 px-1">
                        <div className="min-w-0 flex-1">
                            <div className="text-white font-semibold text-xl flex items-center gap-2">
                                <SettingsIcon size={22} className="text-accent" />
                                Community Config Hub
                            </div>
                            <div className="text-sm text-gray-400 mt-1">Share your settings automatically or download configs from others and professional players.</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 xl:grid-cols-5 lg:grid-cols-3 gap-3">
                        {GAMES.map(g => {
                            const isClickable = g.id === 'cs2' || g.id === 'fortnite';
                            const btnText = (g.id === 'cs2' || g.id === 'fortnite') ? 'Open Hub' : 'Coming Soon';

                            return (
                                <button
                                    key={`cfg-${g.id}`}
                                    onClick={() => {
                                        if (g.id === 'cs2') setCs2ModalOpen(true);
                                        if (g.id === 'fortnite') setFortniteModalOpen(true);
                                    }}
                                    type="button"
                                    className={`relative text-left rounded-2xl overflow-hidden group border transition-all duration-300 h-28 flex flex-col justify-end p-3 focus:outline-none outline-none ${isClickable ? 'cursor-pointer hover:border-[var(--accent)] hover:shadow-[0_0_15px_-3px_var(--accent)] border-white/10 bg-black/20' : 'cursor-default border-transparent bg-black/40 opacity-70'}`}
                                >
                                    <div className={`absolute inset-0 bg-cover bg-center transition-transform duration-700 opacity-80 ${isClickable ? 'group-hover:scale-105 group-hover:opacity-100' : ''}`} style={{ backgroundImage: `url(${g.bg})` }} />

                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />

                                    <div className="relative z-10 flex items-center justify-between gap-2 mt-auto w-full">
                                        <div className="flex flex-col min-w-0">
                                            <div className="font-bold text-white text-sm drop-shadow-md truncate">{g.name}</div>
                                            <div
                                                className={`text-[10px] font-medium tracking-wide drop-shadow-md uppercase mt-0.5 transition-colors ${!isClickable ? 'text-gray-400' : ''}`}
                                                style={isClickable ? { color: 'var(--accent)' } : undefined}
                                            >
                                                {btnText}
                                            </div>
                                        </div>
                                        {isClickable && (
                                            <div
                                                className="w-8 h-8 rounded-full backdrop-blur-md flex items-center justify-center shrink-0 transition-all group-hover:brightness-125 shadow-lg"
                                                style={{
                                                    backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                                                    border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
                                                    color: 'var(--accent)'
                                                }}
                                            >
                                                <SettingsIcon size={14} />
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

            </div>

            {cs2ModalOpen && <Cs2ConfigModal isOpen={cs2ModalOpen} onClose={() => setCs2ModalOpen(false)} />}
            {fortniteModalOpen && <FortniteConfigModal onClose={() => setFortniteModalOpen(false)} />}
            {powerPlanModalOpen && <PowerPlanModal isOpen={powerPlanModalOpen} onClose={() => setPowerPlanModalOpen(false)} />}
        </div>
    );
}
