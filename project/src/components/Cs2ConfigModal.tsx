import { useState, useEffect } from 'react';
import { Cloud, UploadCloud, Download, Loader2, Check, RefreshCw, AlertCircle, Star, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';

interface Cs2ConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface LocalCs2Payload {
    steamId: string;
    installPath: string;
    launchOptions: string;
    files: Record<string, string>;
}

interface CommunityConfig {
    id: string; // discord ID or generated
    authorName: string;
    avatarUrl?: string;
    launchOptions: string;
    files: Record<string, string>;
    uploadedAt: number;
}

const PRO_CONFIGS = [
    {
        id: "pro_s1mple",
        authorName: "s1mple",
        team: "Natus Vincere",
        role: "AWPer",
        imageUrl: "https://prosettings.net/wp-content/uploads/s1mple.png",
        downloadUrl: "https://prosettings.net/wp-content/uploads/s1mple.zip?lastmod=2026-02-22+04%3A28%3A59"
    },
    {
        id: "pro_zywoo",
        authorName: "ZywOo",
        team: "Team Vitality",
        role: "AWPer",
        imageUrl: "https://prosettings.net/wp-content/uploads/zywoo.png",
        downloadUrl: "https://prosettings.net/wp-content/uploads/zywoo.zip?lastmod=2026-02-22+04%3A28%3A59"
    },
    {
        id: "pro_donk",
        authorName: "donk",
        team: "Team Spirit",
        role: "Rifler",
        imageUrl: "https://prosettings.net/wp-content/uploads/donk.png",
        downloadUrl: "https://prosettings.net/wp-content/uploads/donk.zip?lastmod=2026-02-22+04%3A28%3A59"
    },
    {
        id: "pro_m0nesy",
        authorName: "m0NESY",
        team: "G2 Esports",
        role: "AWPer",
        imageUrl: "https://prosettings.net/wp-content/uploads/m0nesy.png",
        downloadUrl: "https://prosettings.net/wp-content/uploads/m0nesy.zip?lastmod=2026-02-22+04%3A28%3A59"
    },
    {
        id: "pro_niko",
        authorName: "NiKo",
        team: "G2 Esports",
        role: "Rifler",
        imageUrl: "https://prosettings.net/wp-content/uploads/niko.png",
        downloadUrl: "https://prosettings.net/wp-content/uploads/niko.zip?lastmod=2026-02-22+04%3A28%3A59"
    },
    {
        id: "pro_ropz",
        authorName: "ropz",
        team: "FaZe Clan",
        role: "Rifler",
        imageUrl: "https://prosettings.net/wp-content/uploads/ropz.png",
        downloadUrl: "https://prosettings.net/wp-content/uploads/ropz.zip?lastmod=2026-02-22+04%3A28%3A59"
    },
    {
        id: "pro_b1t",
        authorName: "b1t",
        team: "Natus Vincere",
        role: "Rifler",
        imageUrl: "https://prosettings.net/wp-content/uploads/b1t.png",
        downloadUrl: "https://prosettings.net/wp-content/uploads/b1t.zip?lastmod=2026-02-22+04%3A28%3A59"
    },
    {
        id: "pro_twistzz",
        authorName: "Twistzz",
        team: "Team Liquid",
        role: "Rifler",
        imageUrl: "https://prosettings.net/wp-content/uploads/twistzz.png",
        downloadUrl: "https://prosettings.net/wp-content/uploads/twistzz.zip?lastmod=2026-02-22+04%3A28%3A59"
    },
    {
        id: "pro_elige",
        authorName: "EliGE",
        team: "Complexity",
        role: "Rifler",
        imageUrl: "https://prosettings.net/wp-content/uploads/elige.png",
        downloadUrl: "https://prosettings.net/wp-content/uploads/elige.zip?lastmod=2026-02-22+04%3A28%3A59"
    },
    {
        id: "pro_spinx",
        authorName: "Spinx",
        team: "Team Vitality",
        role: "Rifler",
        imageUrl: "https://prosettings.net/wp-content/uploads/spinx.png",
        downloadUrl: "https://prosettings.net/wp-content/uploads/spinx.zip?lastmod=2026-02-22+04%3A28%3A59"
    },
    {
        id: "pro_karrigan",
        authorName: "karrigan",
        team: "FaZe Clan",
        role: "IGL",
        imageUrl: "https://prosettings.net/wp-content/uploads/karrigan.png",
        downloadUrl: "https://prosettings.net/wp-content/uploads/karrigan.zip?lastmod=2026-02-22+04%3A28%3A59"
    },
    {
        id: "pro_im",
        authorName: "iM",
        team: "Natus Vincere",
        role: "Rifler",
        imageUrl: "https://prosettings.net/wp-content/uploads/im.png",
        downloadUrl: "https://prosettings.net/wp-content/uploads/im.zip?lastmod=2026-02-22+04%3A28%3A59"
    }
];

export function Cs2ConfigModal({ isOpen, onClose }: Cs2ConfigModalProps) {
    const [activeTab, setActiveTab] = useState<'local' | 'community' | 'pro'>('pro');

    // Local Config State
    const [localConfig, setLocalConfig] = useState<LocalCs2Payload | null>(null);
    const [isFetchingLocal, setIsFetchingLocal] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);

    // Community Configs State
    const [communityConfigs, setCommunityConfigs] = useState<CommunityConfig[]>([]);
    const [isFetchingCommunity, setIsFetchingCommunity] = useState(false);

    // 1. Fetch Local from C# Backend
    const fetchLocalConfig = () => {
        if (!window.chrome?.webview) return;
        setIsFetchingLocal(true);
        setUploadSuccess(false);
        window.chrome.webview.postMessage('cs2-config-fetch');
    };

    // 2. Fetch Community from Firestore
    const fetchCommunityConfigs = async () => {
        setIsFetchingCommunity(true);
        try {
            const q = query(collection(db, 'cs2_configs'), orderBy('uploadedAt', 'desc'), limit(50));
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
        if (isOpen) {
            if (!localConfig) fetchLocalConfig();
            fetchCommunityConfigs();
        }
    }, [isOpen]);

    useEffect(() => {
        const handleMessage = (event: any) => {
            let message = event.data;
            if (typeof message === 'string') {
                try { message = JSON.parse(message); } catch { return; }
            }

            if (message?.type === 'cs2-config') {
                setIsFetchingLocal(false);
                if (message.data?.success && message.data?.data) {
                    setLocalConfig(message.data.data);
                } else {
                    console.error("Failed to parse CS2 local config");
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

    const uploadToCloud = async () => {
        if (!localConfig) return;
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
                launchOptions: localConfig.launchOptions,
                files: localConfig.files,
                uploadedAt: Date.now()
            };

            await setDoc(doc(collection(db, 'cs2_configs'), discordId), payload);
            setUploadSuccess(true);
            fetchCommunityConfigs(); // Refresh list
        } catch (e) {
            console.error("Upload failed", e);
        } finally {
            setIsUploading(false);
        }
    };

    const applyConfig = (config: CommunityConfig) => {
        // We will send this to C# to overwrite the local files.
        if (!window.chrome?.webview) return;

        const payload = JSON.stringify({
            launchOptions: config.launchOptions,
            files: config.files
        });

        window.chrome.webview.postMessage(`cs2-config-apply|${payload}`);
        window.__tfyNotify?.({ kind: 'success', title: 'Config Applied', message: `Applied settings from ${config.authorName}` });
    };

    const deleteConfig = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'cs2_configs', id));
            window.__tfyNotify?.({ kind: 'success', title: 'Deleted', message: 'Your config was removed from the community.' });
            fetchCommunityConfigs();
        } catch (e) {
            console.error("Delete failed", e);
        }
    };

    const downloadProConfig = (url: string) => {
        if (!window.chrome?.webview) return;
        window.chrome.webview.postMessage(`cs2-config-install-pro|${url}`);
        window.__tfyNotify?.({ kind: 'success', title: 'Installing...', message: 'Downloading and extracting configuration in background.' });
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Counter-Strike 2 Config Hub" className="max-w-3xl relative" style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 7%, var(--panel) 100%)' }}>
            {/* Ambient Background Neon */}
            <div className="absolute top-[-25%] right-[-15%] w-[80%] h-[70%] rounded-full blur-[200px] pointer-events-none opacity-15 mix-blend-screen transition-colors duration-500 z-0" style={{ backgroundColor: 'var(--accent)' }} />

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-white/[0.03] rounded-xl mb-0 border border-white/10 relative z-10">
                <button
                    onClick={() => setActiveTab('pro')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'pro' ? '' : 'text-gray-400 hover:text-gray-200'}`}
                    style={activeTab === 'pro' ? { background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', boxShadow: 'inset 0 0 0 1px var(--accent), 0 0 15px -3px color-mix(in srgb, var(--accent) 40%, transparent)' } : {}}
                >
                    <Star size={16} /> Pro Players
                </button>
                <button
                    onClick={() => setActiveTab('community')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'community' ? '' : 'text-gray-400 hover:text-gray-200'}`}
                    style={activeTab === 'community' ? { background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', boxShadow: 'inset 0 0 0 1px var(--accent), 0 0 15px -3px color-mix(in srgb, var(--accent) 40%, transparent)' } : {}}
                >
                    <Cloud size={16} /> Community Configs
                </button>
            </div>

            <div className="h-[60vh] flex-1 overflow-y-auto px-4 py-0 -mx-4 custom-scrollbar relative z-10">
                {activeTab === 'pro' && (
                    <div className="flex flex-col gap-3 pb-16 pt-2">
                        <div className="flex items-center justify-between mb-0">
                            <span className="text-sm text-gray-400">Download the exact configurations of CS2 World Champions.</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {PRO_CONFIGS.map((cfg) => (
                                <div key={cfg.id} className="group relative flex items-center p-3 rounded-2xl border border-white/5 bg-white/[0.02] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent)] hover:shadow-[0_4px_20px_-5px_var(--accent)] gap-4 overflow-hidden">
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: 'linear-gradient(135deg, transparent 40%, color-mix(in srgb, var(--accent) 25%, transparent) 100%)' }} />
                                    <div className="w-14 h-14 rounded-full overflow-hidden bg-black/40 border-2 border-white/10 shrink-0 relative z-10">
                                        <img src={cfg.imageUrl} alt={cfg.authorName} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = 'https://ui-avatars.com/api/?name=' + cfg.authorName + '&background=random&color=fff'; }} />
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0 relative z-10">
                                        <span className="text-white font-bold text-lg group-hover:text-[var(--accent)] transition-colors">{cfg.authorName}</span>
                                        <span className="text-xs text-gray-400 font-medium">{cfg.team} • {cfg.role}</span>
                                    </div>
                                    <button
                                        onClick={() => downloadProConfig(cfg.downloadUrl)}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl transition-all shrink-0 hover:brightness-125 relative z-10"
                                        style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}
                                        title="Download and Auto-Install Config"
                                    >
                                        <Download size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'community' && (
                    <div className="flex flex-col gap-6 pb-16 pt-2">
                        {/* Upload Personal Config Card */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex-1 flex items-center gap-3 pl-2">
                                <UploadCloud size={16} className="text-gray-400" />
                                <span className="text-sm text-gray-300 font-medium">Share your current settings with the community</span>
                            </div>

                            {!localStorage.getItem('tfy.discord.id') ? (
                                <div className="text-amber-500 text-sm flex items-center gap-2 bg-amber-500/10 px-3 py-2 rounded-lg"><AlertCircle size={14} /> Discord Login Required</div>
                            ) : !localConfig ? (
                                <button disabled className="px-4 py-2.5 rounded-xl font-medium text-sm border border-white/5 bg-white/5 text-gray-500 cursor-not-allowed flex items-center gap-2">
                                    <Loader2 size={16} className="animate-spin" /> Scanning...
                                </button>
                            ) : (
                                <button
                                    onClick={uploadToCloud}
                                    disabled={isUploading || uploadSuccess}
                                    className={`px-4 py-2.5 flex items-center justify-center gap-2 rounded-xl font-medium transition-all border border-white/5 text-sm ${uploadSuccess ? 'opacity-80 cursor-not-allowed' : 'hover:brightness-125 hover:scale-105 shadow-[0_0_15px_-5px_var(--accent)]'}`}
                                    style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}
                                >
                                    {isUploading ? <Loader2 size={16} className="animate-spin" /> : uploadSuccess ? <Check size={16} /> : <UploadCloud size={16} />}
                                    {uploadSuccess ? 'Cloud Synced' : 'Upload Current Settings'}
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
                                    <div key={i} className="group relative flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent)] hover:shadow-[0_4px_20px_-5px_var(--accent)] gap-4 overflow-hidden">
                                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: 'linear-gradient(135deg, transparent 40%, color-mix(in srgb, var(--accent) 25%, transparent) 100%)' }} />
                                        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-white/10 bg-white/5 flex items-center justify-center relative z-10">
                                            {cfg.avatarUrl ? (
                                                <img src={cfg.avatarUrl} alt={cfg.authorName} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${cfg.authorName}&background=random&color=fff`; }} />
                                            ) : (
                                                <img src={`https://ui-avatars.com/api/?name=${cfg.authorName}&background=random&color=fff`} alt={cfg.authorName} className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                        <div className="flex flex-col flex-1 min-w-0 relative z-10">
                                            <span className="text-white font-medium truncate group-hover:text-[var(--accent)] transition-colors">{cfg.authorName}'s Settings</span>
                                            <span className="text-xs text-gray-500 mt-1">{Object.keys(cfg.files).length} files included{cfg.launchOptions ? ' + Launch Options' : ''}</span>
                                        </div>
                                        <div className="flex items-center gap-2 relative z-10">
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
                                                className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors hover:brightness-110"
                                                style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)' }}
                                            >
                                                <Download size={16} /> Apply Config
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
}



