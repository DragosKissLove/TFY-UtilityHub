import { useState, useEffect } from 'react';
import { Cloud, UploadCloud, Download, Loader2, Check, RefreshCw, AlertCircle, Settings, Trash2, Search, FolderOpen } from 'lucide-react';
import { Modal } from './Modal';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';

interface FortniteConfigObj {
    IsInstalled: boolean;
    RenderingMode: string;
    ReflexMode: string;
    ResolutionX: string;
    ResolutionY: string;
    FpsLimit: string;
    AudioQuality: string;

    EnableFullscreen: boolean;
    DisableMotionBlur: boolean;
    DisableGrass: boolean;
    ShowFps: boolean;
    DisableAntiAliasing: boolean;
    SetCustomSuperResQuality: boolean;
    SetDlssQuality0: boolean;
    SetGlobalIllumination0: boolean;
    SetReflection0: boolean;
    DisableRayTracing: boolean;
    DisableEnergySaver: boolean;
    DisableMouseAcceleration: boolean;
    DisableVsync: boolean;
    SetViewDistance0: boolean;
    SetShadow0: boolean;
    SetTexture0: boolean;
    SetEffects0: boolean;
    SetFoliage0: boolean;
    SetShading0: boolean;

    ExePath: string;
    DisableFullscreenOptimizations: boolean;
    RawIniContent: string;
}

interface FortniteConfigModalProps {
    onClose: () => void;
}

interface CommunityConfig {
    id: string; // discord ID or generated
    authorName: string;
    avatarUrl?: string;
    rawIniContent: string;
    uploadedAt: number;
}

export function FortniteConfigModal({ onClose }: FortniteConfigModalProps) {
    const [activeTab, setActiveTab] = useState<'custom' | 'community' | 'local'>('custom');

    const [config, setConfig] = useState<FortniteConfigObj | null>(null);
    const [loading, setLoading] = useState(true);

    const [isUploading, setIsUploading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);

    // Community Configs State
    const [communityConfigs, setCommunityConfigs] = useState<CommunityConfig[]>([]);
    const [isFetchingCommunity, setIsFetchingCommunity] = useState(false);

    const fetchLocalConfig = () => {
        if (!window.chrome?.webview) return;
        setLoading(true);
        setUploadSuccess(false);
        window.chrome.webview.postMessage('fortnite-settings-get');
    };

    const fetchCommunityConfigs = async () => {
        setIsFetchingCommunity(true);
        try {
            const q = query(collection(db, 'fortnite_configs'), orderBy('uploadedAt', 'desc'), limit(50));
            const snapshot = await getDocs(q);
            const configs: CommunityConfig[] = [];
            snapshot.forEach(docSnap => {
                configs.push({ id: docSnap.id, ...docSnap.data() } as CommunityConfig);
            });
            setCommunityConfigs(configs);
        } catch (e) {
            console.error("Firestore fetch error:", e);
        } finally {
            setIsFetchingCommunity(false);
        }
    };

    useEffect(() => {
        fetchLocalConfig();
        fetchCommunityConfigs();
    }, []);

    useEffect(() => {
        const handleMessage = (e: MessageEvent) => {
            try {
                const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
                if (msg.type === 'fortnite-settings' && msg.data) {
                    const incomingConfig = { ...msg.data };
                    if (incomingConfig.FpsLimit) {
                        const parsed = parseFloat(incomingConfig.FpsLimit);
                        if (!isNaN(parsed)) {
                            incomingConfig.FpsLimit = parsed === 0 ? "Unlimited" : Math.round(parsed).toString();
                        }
                    }
                    setConfig(incomingConfig);
                    setLoading(false);
                }
                if (msg.type === 'fortnite-exe-selected' && msg.data?.path) {
                    setConfig(prev => prev ? { ...prev, ExePath: msg.data.path } : null);
                }
                if (msg.type === 'fortnite-save-result') {
                    if (!msg.data?.ok) {
                        window.__tfyNotify?.({ title: 'Fortnite Hub', message: 'Failed to auto-save settings.', kind: 'error' });
                    }
                }
            } catch { }
        };

        if (window.chrome?.webview) {
            window.chrome.webview.addEventListener('message', handleMessage);
        } else {
            setLoading(false);
        }

        return () => {
            if (window.chrome?.webview) window.chrome.webview.removeEventListener('message', handleMessage);
        };
    }, [onClose, activeTab]);

    const updateConfig = (updates: Partial<FortniteConfigObj>) => {
        setConfig(prev => {
            const newConfig = prev ? { ...prev, ...updates } : null;
            if (newConfig && window.chrome?.webview) {
                const payload = { ...newConfig };
                if (payload.FpsLimit.toLowerCase() === 'unlimited') {
                    payload.FpsLimit = '0';
                }
                window.chrome.webview.postMessage(`fortnite - settings - save | ${JSON.stringify(payload)} `);
            }
            return newConfig;
        });
    };

    const uploadToCloud = async () => {
        if (!config || !config.RawIniContent) {
            window.__tfyNotify?.({ kind: 'error', title: 'Upload Failed', message: 'No valid local configuration found to upload.' });
            return;
        }
        const discordId = localStorage.getItem('tfy.discord.id');
        if (!discordId) {
            window.__tfyNotify?.({ kind: 'error', title: 'Discord Required', message: 'You must connect your Discord account on the Home page to upload configs.' });
            return;
        }

        setIsUploading(true);
        try {
            const authorName = window.__tfyDiscordName || localStorage.getItem('tfy.discord.username') || 'TFY User';
            const avatarUrl = localStorage.getItem('tfy.discord.avatar') || '';

            const payload: CommunityConfig = {
                id: discordId,
                authorName,
                avatarUrl,
                rawIniContent: config.RawIniContent,
                uploadedAt: Date.now()
            };

            await setDoc(doc(collection(db, 'fortnite_configs'), discordId), payload);
            setUploadSuccess(true);
            fetchCommunityConfigs(); // Refresh list
        } catch (e) {
            console.error("Upload failed", e);
        } finally {
            setIsUploading(false);
        }
    };

    const applyConfig = (cfg: CommunityConfig) => {
        if (!window.chrome?.webview) return;
        window.chrome.webview.postMessage(`fortnite - raw - ini - apply | ${cfg.rawIniContent} `);
        window.__tfyNotify?.({ kind: 'success', title: 'Config Applied', message: `Applied settings from ${cfg.authorName} ` });
    };

    const deleteConfig = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'fortnite_configs', id));
            window.__tfyNotify?.({ kind: 'success', title: 'Deleted', message: 'Your config was removed from the community.' });
            fetchCommunityConfigs();
        } catch (e) {
            console.error("Delete failed", e);
        }
    };

    const renderRadioGroup = (
        title: string, value: string, options: { id: string, label: string }[], onChange: (id: string) => void
    ) => (
        <div className="group relative bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col gap-3 h-full transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_4px_20px_-5px_var(--accent)] overflow-hidden">
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: 'linear-gradient(135deg, transparent 40%, color-mix(in srgb, var(--accent) 15%, transparent) 100%)' }} />
            <div className="font-semibold text-white/90 relative z-10">{title}</div>
            <div className="flex flex-col gap-2 mt-1 relative z-10">
                {options.map(opt => (
                    <button
                        key={opt.id} type="button" onClick={() => onChange(opt.id)}
                        className="flex items-center gap-3 w-full text-left group/radio"
                    >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${value === opt.id ? 'border-[var(--accent)] scale-110' : 'border-white/25 group-hover/radio:border-white/50'}`}>
                            <div className={`rounded-full bg-[var(--accent)] transition-all duration-200 ${value === opt.id ? 'w-2 h-2 opacity-100 scale-100' : 'w-0 h-0 opacity-0 scale-0'}`} />
                        </div>
                        <span className={`text-sm transition-all duration-200 ${value === opt.id ? 'text-white font-semibold' : 'text-gray-400 group-hover/radio:text-gray-200'}`}>{opt.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );

    const renderCheckbox = (label: string, checked: boolean, onChange: (c: boolean) => void) => (
        <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-3 w-full text-left py-2 group">
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 shadow-sm relative ${checked ? 'bg-[var(--accent)] border-[var(--accent)] shadow-[0_0_10px_-2px_var(--accent)] scale-110' : 'border-white/25 bg-black/20 group-hover:border-white/50 group-hover:bg-white/5 scale-100'}`}>
                <Check size={12} strokeWidth={3} className={`text-white transition-all duration-200 ${checked ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`} />
            </div>
            <span className={`text-sm tracking-wide transition-all duration-200 ${checked ? 'text-white font-semibold' : 'text-gray-400 group-hover:text-gray-200'}`}>{label}</span>
        </button>
    );

    return (
        <Modal isOpen={true} onClose={onClose} title="Fortnite Config Hub" className="max-w-4xl relative" style={{ backgroundColor: '#0f1115' }}>
            {/* Ambient Background Neon */}
            <div className="absolute top-[-25%] right-[-15%] w-[80%] h-[70%] rounded-full blur-[200px] pointer-events-none opacity-15 mix-blend-screen transition-colors duration-500 z-0" style={{ backgroundColor: 'var(--accent)' }} />

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-white/[0.03] rounded-xl mb-4 border border-white/10 relative z-10 w-full">
                <button
                    onClick={() => setActiveTab('custom')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'custom' ? '' : 'text-gray-400 hover:text-gray-200'}`}
                    style={activeTab === 'custom' ? { background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', boxShadow: 'inset 0 0 0 1px var(--accent), 0 0 15px -3px color-mix(in srgb, var(--accent) 40%, transparent)' } : {}}
                >
                    <Settings size={16} /> Custom Settings
                </button>
                <button
                    onClick={() => setActiveTab('community')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'community' ? '' : 'text-gray-400 hover:text-gray-200'}`}
                    style={activeTab === 'community' ? { background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', boxShadow: 'inset 0 0 0 1px var(--accent), 0 0 15px -3px color-mix(in srgb, var(--accent) 40%, transparent)' } : {}}
                >
                    <Cloud size={16} /> Community Configs
                </button>
            </div>

            <div className="h-[60vh] flex-1 overflow-y-auto px-4 pt-2 pb-8 -mx-4 custom-scrollbar relative z-10">
                {loading && activeTab === 'custom' ? (
                    <div className="flex flex-col items-center justify-center py-12 text-[var(--accent)] gap-3">
                        <Loader2 className="animate-spin" size={32} />
                        <span className="text-gray-400 text-sm">Loading Settings...</span>
                    </div>
                ) : null}

                {activeTab === 'custom' && config && (
                    <div className="flex flex-col gap-6 pb-8">
                        {!config.IsInstalled && window.chrome?.webview && (
                            <div className="bg-[#1a140f] border border-amber-500/30 rounded-xl p-4 flex flex-col items-center">
                                <AlertCircle size={24} className="text-amber-500 mb-2" />
                                <h2 className="text-base font-bold text-amber-500 mb-1">Configuration Not Found</h2>
                                <p className="text-sm text-amber-500/70 text-center">Could not locate GameUserSettings.ini. Ensure Fortnite is installed and has been launched at least once on this PC.</p>
                            </div>
                        )}
                        <div className="group relative bg-white/[0.02] border border-white/5 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_4px_20px_-5px_var(--accent)] mt-4">
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl" style={{ background: 'linear-gradient(135deg, transparent 40%, color-mix(in srgb, var(--accent) 15%, transparent) 100%)' }} />
                            <div className="font-semibold text-white/90 mb-4 flex items-center gap-2 relative z-10">
                                <Settings size={16} className="text-[var(--accent)]" />
                                Display &amp; Resolution
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                                {renderRadioGroup("Rendering Mode", config.RenderingMode, [
                                    { id: 'dx12', label: 'DirectX 12' },
                                    { id: 'performance', label: 'Performance Mode' },
                                    { id: 'dx11', label: 'DirectX 11' },
                                    { id: 'legacy', label: 'Legacy Performance' },
                                ], (v) => updateConfig({ RenderingMode: v }))}

                                <div className="group relative bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col gap-3 h-full justify-between transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_4px_20px_-5px_var(--accent)] overflow-hidden">
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: 'linear-gradient(135deg, transparent 40%, color-mix(in srgb, var(--accent) 15%, transparent) 100%)' }} />
                                    <div className="flex flex-col gap-1 relative z-10">
                                        <div className="font-semibold text-white/90 text-sm">Resolution</div>
                                        <div className="flex items-center gap-2">
                                            <input type="text" value={config.ResolutionX} onChange={e => updateConfig({ ResolutionX: e.target.value })} className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-center text-white focus:outline-none focus:border-[var(--accent)] transition-colors" />
                                            <span className="text-gray-500 text-xs">x</span>
                                            <input type="text" value={config.ResolutionY} onChange={e => updateConfig({ ResolutionY: e.target.value })} className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-center text-white focus:outline-none focus:border-[var(--accent)] transition-colors" />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1 mt-2 lg:mt-0 relative z-10">
                                        <div className="font-semibold text-white/90 text-sm">FPS Limit [0 = Uncapped]</div>
                                        <input
                                            type="text"
                                            value={parseFloat(config.FpsLimit) === 0 ? '0' : config.FpsLimit}
                                            onChange={e => updateConfig({ FpsLimit: e.target.value })}
                                            className="w-full max-w-[120px] bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-center text-white focus:outline-none focus:border-[var(--accent)] transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="group relative bg-white/[0.02] border border-white/5 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_4px_20px_-5px_var(--accent)] overflow-hidden mt-6">
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: 'linear-gradient(135deg, transparent 40%, color-mix(in srgb, var(--accent) 15%, transparent) 100%)' }} />
                            <div className="font-semibold text-white/90 mb-4 flex items-center gap-2 relative z-10">
                                <Search size={16} className="text-[var(--accent)]" />
                                Graphics Quality (Set to Lowest)
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 relative z-10">
                                {renderCheckbox("Set Shading to Low", config.SetShading0, v => updateConfig({ SetShading0: v }))}
                                {renderCheckbox("Set Shadows to Low", config.SetShadow0, v => updateConfig({ SetShadow0: v }))}
                                {renderCheckbox("Set Textures to Low", config.SetTexture0, v => updateConfig({ SetTexture0: v }))}
                                {renderCheckbox("Set Effects to Low", config.SetEffects0, v => updateConfig({ SetEffects0: v }))}
                                {renderCheckbox("Set Foliage to Low", config.SetFoliage0, v => updateConfig({ SetFoliage0: v }))}
                                {renderCheckbox("Set View Dist to Low", config.SetViewDistance0, v => updateConfig({ SetViewDistance0: v }))}
                                {renderCheckbox("Disable Anti-Aliasing", config.DisableAntiAliasing, v => updateConfig({ DisableAntiAliasing: v }))}
                                {renderCheckbox("Disable Ray Tracing", config.DisableRayTracing, v => updateConfig({ DisableRayTracing: v }))}
                                {renderCheckbox("Set Global Illumination 0", config.SetGlobalIllumination0, v => updateConfig({ SetGlobalIllumination0: v }))}
                                {renderCheckbox("Set Reflection Quality 0", config.SetReflection0, v => updateConfig({ SetReflection0: v }))}
                                {renderCheckbox("Set DLSS Quality 0", config.SetDlssQuality0, v => updateConfig({ SetDlssQuality0: v }))}
                                {renderCheckbox("Custom Super Res Quality", config.SetCustomSuperResQuality, v => updateConfig({ SetCustomSuperResQuality: v }))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                            <div className="group relative bg-white/[0.02] border border-white/5 rounded-2xl p-5 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_4px_20px_-5px_var(--accent)] overflow-hidden">
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: 'linear-gradient(135deg, transparent 40%, color-mix(in srgb, var(--accent) 15%, transparent) 100%)' }} />
                                <div className="font-semibold text-white/90 flex items-center gap-2 relative z-10">
                                    <AlertCircle size={16} className="text-[var(--accent)]" />
                                    Advanced Tweaks
                                </div>
                                <div className="grid grid-cols-1 gap-1 flex-1 content-start relative z-10">
                                    {renderCheckbox("Disable Motion Blur", config.DisableMotionBlur, v => updateConfig({ DisableMotionBlur: v }))}
                                    {renderCheckbox("Disable Grass", config.DisableGrass, v => updateConfig({ DisableGrass: v }))}
                                    {renderCheckbox("Show FPS Counter", config.ShowFps, v => updateConfig({ ShowFps: v }))}
                                    {renderCheckbox("Disable Energy Saver", config.DisableEnergySaver, v => updateConfig({ DisableEnergySaver: v }))}
                                    {renderCheckbox("Disable Mouse Accel", config.DisableMouseAcceleration, v => updateConfig({ DisableMouseAcceleration: v }))}
                                    {renderCheckbox("Enable Fullscreen", config.EnableFullscreen, v => updateConfig({ EnableFullscreen: v }))}
                                    {renderCheckbox("Disable V-Sync", config.DisableVsync, v => updateConfig({ DisableVsync: v }))}
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-2 relative z-10">
                                    {renderRadioGroup("Reflex Low Latency", config.ReflexMode, [
                                        { id: '0', label: 'Off' },
                                        { id: '1', label: 'On' },
                                        { id: '2', label: 'On + Boost' }
                                    ], (v) => updateConfig({ ReflexMode: v }))}

                                    {renderRadioGroup("Audio Quality", config.AudioQuality, [
                                        { id: '0', label: 'Low' },
                                        { id: '1', label: 'High' }
                                    ], (v) => updateConfig({ AudioQuality: v }))}
                                </div>
                            </div>

                            <div className="group relative bg-white/[0.02] border border-white/5 rounded-2xl p-5 flex flex-col transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_4px_20px_-5px_var(--accent)] overflow-hidden">
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: 'linear-gradient(135deg, transparent 40%, color-mix(in srgb, var(--accent) 15%, transparent) 100%)' }} />
                                <div className="font-semibold text-white/90 mb-4 flex items-center gap-2 relative z-10">
                                    <FolderOpen size={16} className="text-[var(--accent)]" />
                                    Executable &amp; Optimizations
                                </div>
                                <div className="text-sm text-gray-400 mb-3 relative z-10">
                                    Path automatically discovered from Epic Games via TFY Engine. Focus entirely on optimizing performance.
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-[var(--accent)] truncate flex items-center mb-4 relative z-10" style={{ fontFamily: 'monospace' }}>
                                    {config.ExePath || 'No Executable Detected...'}
                                </div>

                                <div className="relative z-10 mb-4">
                                    {renderCheckbox("Disable Fullscreen Optimizations", config.DisableFullscreenOptimizations, v => updateConfig({ DisableFullscreenOptimizations: v }))}
                                </div>

                                <div className="mt-auto pt-4 border-t border-white/10 relative z-10">
                                    <p className="text-xs text-gray-500">
                                        For maximum performance, ensure 'Disable Fullscreen Optimizations' is enabled.
                                    </p>
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                {activeTab === 'community' && (
                    <div className="flex flex-col gap-4 pb-16">
                        {/* Upload Personal Config Card */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex-1 flex items-center gap-3 pl-2">
                                <UploadCloud size={16} className="text-gray-400" />
                                <span className="text-sm text-gray-300 font-medium">Share your current settings with the community</span>
                            </div>

                            {!localStorage.getItem('tfy.discord.id') ? (
                                <div className="text-amber-500 text-sm flex items-center gap-2 bg-amber-500/10 px-3 py-2 rounded-lg">
                                    <AlertCircle size={14} /> Discord Login Required
                                </div>
                            ) : config && config.IsInstalled ? (
                                <button
                                    onClick={uploadToCloud}
                                    disabled={isUploading || uploadSuccess}
                                    className={`px-4 py-2.5 flex items-center justify-center gap-2 rounded-xl font-medium transition-all border border-white/5 text-sm ${uploadSuccess ? 'opacity-80 cursor-not-allowed' : 'hover:brightness-125 hover:scale-105 shadow-[0_0_15px_-5px_var(--accent)]'}`}
                                    style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}
                                >
                                    {isUploading ? <Loader2 size={16} className="animate-spin" /> : uploadSuccess ? <Check size={16} /> : <UploadCloud size={16} />}
                                    {uploadSuccess ? 'Cloud Synced' : 'Upload Current Settings'}
                                </button>
                            ) : (
                                <button disabled className="px-4 py-2.5 rounded-xl font-medium text-sm border border-white/5 bg-white/5 text-gray-500 cursor-not-allowed">
                                    No Settings Detected
                                </button>
                            )}
                        </div>

                        <div className="flex items-center justify-between mb-0 border-b border-white/10 pb-2">
                            <span className="text-sm text-gray-300 font-medium">Browse Community Configurations</span>
                            <button onClick={fetchCommunityConfigs} className="btn-ghost flex items-center gap-2 text-xs">
                                <RefreshCw size={14} className={isFetchingCommunity ? 'animate-spin' : ''} /> Refresh List
                            </button>
                        </div>

                        {isFetchingCommunity ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-3">
                                <Loader2 className="animate-spin" size={24} />
                                <span>Loading community configs...</span>
                            </div>
                        ) : communityConfigs.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 bg-white/[0.02] rounded-xl border border-dashed border-white/10">
                                No configs uploaded yet. Be the first to share yours!
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {communityConfigs.map((cfg, i) => (
                                    <div key={i} className="group relative flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent)] hover:shadow-[0_4px_20px_-5px_var(--accent)] gap-4 overflow-hidden">
                                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: 'linear-gradient(135deg, transparent 40%, color-mix(in srgb, var(--accent) 25%, transparent) 100%)' }} />

                                        <div className="flex items-center gap-4 relative z-10 w-full sm:w-auto">
                                            <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-white/10 bg-white/5 flex items-center justify-center">
                                                {cfg.avatarUrl ? (
                                                    <img src={cfg.avatarUrl} alt={cfg.authorName} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${cfg.authorName}&background=random&color=fff`; }} />
                                                ) : (
                                                    <img src={`https://ui-avatars.com/api/?name=${cfg.authorName}&background=random&color=fff`} alt={cfg.authorName} className="w-full h-full object-cover" />
                                                )}
                                            </div >
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className="text-white font-medium truncate group-hover:text-[var(--accent)] transition-colors">{cfg.authorName}'s Settings</span>
                                                <span className="text-xs text-gray-500 mt-1">Uploaded {new Date(cfg.uploadedAt).toLocaleDateString()}</span>
                                            </div>
                                        </div >

                                        <div className="flex items-center gap-2 relative z-10 w-full sm:w-auto justify-end mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-white/5 sm:border-0">
                                            {(cfg.id === localStorage.getItem('tfy.discord.id') || cfg.authorName === (window.__tfyDiscordName || localStorage.getItem('tfy.discord.name'))) && (
                                                <button
                                                    onClick={() => deleteConfig(cfg.id)}
                                                    className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors border border-red-500/20 text-red-400 hover:bg-red-500/10"
                                                    title="Delete My Config"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => applyConfig(cfg)}
                                                className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all hover:brightness-125 border border-transparent hover:scale-105"
                                                style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)' }}
                                            >
                                                <Download size={16} /> Apply Config
                                            </button>
                                        </div>
                                    </div >
                                ))}
                            </div >
                        )}
                    </div >
                )}

            </div >
        </Modal >
    );
}
