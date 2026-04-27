import { useState, useEffect } from 'react';
import { ChevronRight, Globe, Palette, LogIn, CheckCircle2, Sparkles, Rocket } from 'lucide-react';
import { setLanguage, t, type TfyLanguage } from '../lib/i18n';

interface WelcomeTourProps {
    onComplete: () => void;
}

export function WelcomeTour({ onComplete }: WelcomeTourProps) {
    const [slide, setSlide] = useState(0);
    const [isClosing, setIsClosing] = useState(false);
    const [lang, setLang] = useState<TfyLanguage>('en');
    const [theme, setTheme] = useState('jade');

    // Load defaults from what App currently has
    useEffect(() => {
        try {
            const savedTheme = localStorage.getItem('tfy.setting.theme') || 'jade';
            setTheme(savedTheme);
            const savedLang = localStorage.getItem('tfy.setting.language') as TfyLanguage || 'en';
            setLang(savedLang);
        } catch { }
    }, []);

    const handleLanguageSelect = (l: TfyLanguage) => {
        setLang(l);
        setLanguage(l);
    };

    const handleThemeSelect = (tName: string) => {
        setTheme(tName);
        try {
            localStorage.setItem('tfy.setting.theme', tName);
            document.documentElement.setAttribute('data-tfy-theme', tName);
        } catch { }
    };

    const handleDiscordClick = () => {
        if (window.chrome?.webview) {
            window.chrome.webview.postMessage(`discord-login|${theme}`);
        }
        setSlide(slide + 1);
    };

    const finishTour = () => {
        try {
            localStorage.setItem('tfy-tour-completed', 'true');
            window.dispatchEvent(new Event('tfy-tour-finished'));
        } catch { }
        setIsClosing(true);
        setTimeout(onComplete, 400); // Wait for fade out
    };

    const nextSlide = () => {
        setSlide(s => s + 1);
    };

    const slides = [
        // Slide 0: Welcome
        (
            <div className="flex flex-col items-center justify-center text-center max-w-sm h-full w-full">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 shadow-xl">
                    <Sparkles size={32} className="text-accent" />
                </div>
                <div className="min-h-[140px] flex flex-col items-center justify-start w-full">
                    <h2 className="text-2xl font-display font-medium text-white mb-2">{t(lang, 'tour.welcome.title') || 'Welcome to TFY'}</h2>
                    <p className="text-gray-400 leading-relaxed text-xs">
                        {t(lang, 'tour.welcome.desc') || 'Optimize, tweak, and control your system with precision.'}
                    </p>
                    <button onClick={nextSlide} className="btn-primary mt-6 py-2.5 px-6 text-xs flex items-center gap-2 group">
                        {t(lang, 'tour.welcome.btn') || 'Get Started'} <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        ),
        // Slide 1: Language
        (
            <div className="flex flex-col items-center justify-center text-center max-w-sm w-full h-full">
                <Globe size={28} className="text-white/40 mb-3" />
                <div className="min-h-[130px] flex flex-col items-center justify-start w-full">
                    <h2 className="text-xl font-display font-medium text-white mb-1">{t(lang, 'settings.lang') || 'Language'}</h2>
                    <p className="text-gray-400 text-xs mb-4 pb-1">{t(lang, 'tour.lang.desc') || 'Choose your preferred language.'}</p>

                    <div className="grid grid-cols-2 gap-3 w-full">
                        {[
                            { id: 'en', label: 'English', flag: '🇺🇸' },
                            { id: 'ro', label: 'Română', flag: '🇷🇴' },
                            { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
                            { id: 'fr', label: 'Français', flag: '🇫🇷' },
                            { id: 'es', label: 'Español', flag: '🇪🇸' }
                        ].map((l) => (
                            <button
                                key={l.id}
                                onClick={() => handleLanguageSelect(l.id as TfyLanguage)}
                                className="flex flex-col items-center justify-center p-3 rounded-xl transition-all w-full gap-1"
                                style={{
                                    background: lang === l.id ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${lang === l.id ? 'var(--accent)' : 'rgba(255,255,255,0.05)'}`,
                                    boxShadow: lang === l.id ? '0 6px 16px color-mix(in srgb, var(--accent) 15%, transparent)' : 'none'
                                }}
                            >
                                <span className="text-xl">{l.flag}</span>
                                <span className="font-semibold text-xs text-white">
                                    {l.label}
                                </span>
                                {lang === l.id && (
                                    <div className="absolute top-1.5 right-1.5">
                                        <CheckCircle2 size={12} className="text-accent" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
                <button onClick={nextSlide} className="btn-primary mt-5 py-2 w-full text-sm shrink-0">{t(lang, 'tour.continue') || 'Continue'}</button>
            </div >
        ),
        // Slide 2: Theme
        (
            <div className="flex flex-col items-center justify-center text-center max-w-md w-full h-full">
                <Palette size={28} className="text-white/40 mb-3" />
                <div className="min-h-[130px] flex flex-col items-center justify-start w-full">
                    <h2 className="text-xl font-display font-medium text-white mb-1">{t(lang, 'settings.themes') || 'Theme'}</h2>
                    <p className="text-gray-400 text-xs mb-4">{t(lang, 'tour.theme.desc') || 'Personalize your hub.'}</p>

                    <div className="grid grid-cols-3 gap-3 w-full">
                        {[
                            { id: 'jade', hex: '#10b981', label: 'Green' },
                            { id: 'midnight', hex: '#6366f1', label: 'Indigo' },
                            { id: 'slate', hex: '#0ea5e9', label: 'Cyan' },
                            { id: 'sunset', hex: '#f97316', label: 'Orange' },
                            { id: 'red', hex: '#ef4444', label: 'Red' },
                            { id: 'pink', hex: '#ec4899', label: 'Pink' }
                        ].map((tOpt) => (
                            <button
                                key={tOpt.id}
                                onClick={() => handleThemeSelect(tOpt.id)}
                                className="flex flex-col items-center p-4 rounded-xl transition-all"
                                style={{
                                    background: theme === tOpt.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                                    border: `1px solid ${theme === tOpt.id ? 'var(--accent)' : 'rgba(255,255,255,0.05)'}`
                                }}
                            >
                                <div className="w-8 h-8 rounded-full mb-3" style={{ background: tOpt.hex, boxShadow: `0 0 15px ${tOpt.hex}40` }} />
                                <span className="text-xs text-white/70">{tOpt.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <button onClick={nextSlide} className="btn-primary mt-8 py-2.5 w-full text-sm shrink-0">{t(lang, 'tour.continue') || 'Continue'}</button>
            </div >
        ),
        // Slide 3: Discord
        (
            <div className="flex flex-col items-center justify-center text-center max-w-sm w-full h-full">
                <LogIn size={32} className="text-white/40 mb-4" />
                <div className="min-h-[160px] flex flex-col items-center justify-start w-full">
                    <h2 className="text-2xl font-display font-medium text-white mb-2">{t(lang, 'tour.discord.title') || 'Connect Discord'}</h2>
                    <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                        {t(lang, 'tour.discord.desc') || 'Link your TFY Discord account to unlock cloud backups, premium tweaks, and priority support.'}
                    </p>

                    <button onClick={handleDiscordClick} className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-3 font-medium text-sm transition-all hover:brightness-110 text-black shadow-lg"
                        style={{ background: 'var(--accent)', boxShadow: '0 4px 16px color-mix(in srgb, var(--accent) 30%, transparent)' }}
                    >
                        {t(lang, 'tour.discord.btn') || 'Login with Discord'}
                    </button>

                    <button onClick={nextSlide} className="mt-4 text-xs text-gray-500 hover:text-white transition-colors">
                        {t(lang, 'tour.skip') || 'Skip for now'}
                    </button>
                </div>
            </div>
        ),
        // Slide 4: Finish
        (
            <div className="flex flex-col items-center justify-center text-center max-w-sm h-full w-full">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}>
                    <Rocket size={32} className="text-accent" />
                </div>
                <div className="min-h-[140px] flex flex-col items-center justify-start w-full">
                    <h2 className="text-2xl font-display font-medium text-white mb-2">{t(lang, 'tour.finish.title') || 'All Set!'}</h2>
                    <p className="text-gray-400 leading-relaxed text-xs">
                        {t(lang, 'tour.finish.desc') || 'Your experience is configured and ready to go.'}
                    </p>
                    <button onClick={finishTour} className="btn-primary mt-6 py-2.5 px-10 text-xs font-medium">
                        {t(lang, 'tour.finish.btn') || 'Launch Hub'}
                    </button>
                </div>
            </div>
        )
    ];

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-500 ease-out ${isClosing ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100'}`} style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(20px)' }}>
            {/* Decorative glows */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full pointer-events-none opacity-20 transition-all duration-700"
                style={{
                    background: 'radial-gradient(circle, var(--accent) 0%, transparent 60%)',
                    filter: 'blur(100px)',
                    opacity: isClosing ? 0 : 0.2
                }}
            />

            <div className={`relative bg-[#050608]/90 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-6 sm:p-8 w-full max-w-[500px] min-h-[440px] shadow-[0_0_80px_rgba(0,0,0,0.9)] flex flex-col items-center overflow-hidden transition-all duration-500 ${isClosing ? 'translate-y-4 opacity-0' : 'animate-in fade-in zoom-in-95'}`} style={{ boxShadow: '0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent), 0 0 40px rgba(0,0,0,0.8)' }}>
                {/* Subtle top edge accent glow */}
                <div className="absolute top-0 left-0 right-0 h-[2px] opacity-70" style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />

                {/* Progress Dots */}
                <div className="absolute top-8 flex items-center justify-center gap-2">
                    {slides.map((_, i) => (
                        <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${slide === i ? 'w-6' : 'w-1.5'}`}
                            style={{ background: slide === i ? 'var(--accent)' : 'rgba(255,255,255,0.1)' }}
                        />
                    ))}
                </div>

                {/* Slide Content Wrapper */}
                <div className="mt-6 w-full grid flex-1">
                    {slides.map((content, i) => (
                        <div
                            key={i}
                            className={`col-start-1 row-start-1 flex flex-col items-center justify-center h-full transition-all duration-300 ease-in-out ${slide === i
                                ? 'opacity-100 translate-x-0 pointer-events-auto z-10'
                                : slide > i
                                    ? 'opacity-0 -translate-x-12 pointer-events-none z-0'
                                    : 'opacity-0 translate-x-12 pointer-events-none z-0'
                                }`}
                        >
                            {content}
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}
