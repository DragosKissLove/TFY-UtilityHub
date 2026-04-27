import { Zap, Activity, Cpu } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Modal } from './Modal';

interface PowerPlanModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function PowerPlanModal({ isOpen, onClose }: PowerPlanModalProps) {
    const [status, setStatus] = useState<'' | 'applying' | 'success'>('');

    useEffect(() => {
        if (isOpen) setStatus('');
    }, [isOpen]);

    const handleApply = (type: 'power-plan-only' | 'power-plan-full') => {
        setStatus('applying');
        if (window.chrome?.webview) {
            window.chrome.webview.postMessage(type);
        }
        setTimeout(() => {
            setStatus('success');
            window.__tfyNotify?.({
                kind: 'success',
                title: 'Optimization Applied',
                message: type === 'power-plan-full'
                    ? 'Full optimize complete. ParkControl + Process Lasso installed.'
                    : 'Ultimate Power Plan applied successfully.'
            });
            setTimeout(onClose, 1200);
        }, 2200);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Ultimate Power Plan"
            hideClose={status === 'applying'}
            className="tfy-modal-deep"
        >
            {/* subtitle */}
            <p className="text-sm text-gray-400 -mt-4 mb-2">
                Choose your optimization method
            </p>

            {status === 'applying' || status === 'success' ? (
                /* ─── Loading / Success state ─── */
                <div className="py-12 flex flex-col items-center justify-center gap-4">
                    {status === 'success' ? (
                        <div className="animate-in zoom-in spin-in-12 duration-500">
                            <Zap
                                size={64}
                                style={{ color: 'var(--accent)', filter: 'drop-shadow(0 0 18px var(--accent))' }}
                            />
                        </div>
                    ) : (
                        <div className="relative w-16 h-16">
                            <div
                                className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin"
                                style={{
                                    borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
                                    borderTopColor: 'var(--accent)'
                                }}
                            />
                            <Zap
                                className="absolute inset-0 m-auto animate-pulse"
                                size={24}
                                style={{ color: 'var(--accent)' }}
                            />
                        </div>
                    )}
                    <p className="text-xl font-bold text-white">
                        {status === 'success' ? 'Optimization Complete!' : 'Applying Optimizations…'}
                    </p>
                    <p className="text-sm text-gray-400 text-center max-w-xs">
                        {status === 'success'
                            ? 'Your system is now tuned for maximum frame rate.'
                            : 'Please wait while we modify system power states…'}
                    </p>
                </div>
            ) : (
                /* ─── Option cards — same pattern as CS2 community config cards ─── */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">

                    {/* ── Card 1: Power Plan Only ── */}
                    <div className="group relative flex flex-col p-5 rounded-2xl border border-white/5 bg-white/[0.02] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent)] hover:shadow-[0_4px_20px_-5px_var(--accent)] overflow-hidden">
                        {/* hover gradient sweep */}
                        <div
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                            style={{ background: 'linear-gradient(135deg, transparent 40%, color-mix(in srgb, var(--accent) 18%, transparent) 100%)' }}
                        />

                        <div className="relative z-10 flex items-center gap-3 mb-3">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                style={{
                                    background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)'
                                }}
                            >
                                <Activity size={20} style={{ color: 'var(--accent)' }} />
                            </div>
                            <h3 className="text-base font-bold text-white group-hover:text-[var(--accent)] transition-colors">
                                Power Plan Only
                            </h3>
                        </div>

                        <p className="relative z-10 text-sm text-gray-400 flex-1 leading-relaxed mb-5">
                            Imports and sets{' '}
                            <span className="text-white font-mono bg-white/10 px-1.5 py-0.5 rounded-md text-xs">fpsghoul.pow</span>{' '}
                            as your active power scheme. Forces max CPU frequency globally.
                        </p>

                        <button
                            onClick={() => handleApply('power-plan-only')}
                            className="relative z-10 w-full py-2.5 rounded-xl font-semibold text-sm transition-all hover:brightness-125"
                            style={{
                                background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                                color: 'var(--accent)',
                                border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)'
                            }}
                        >
                            Apply Light
                        </button>
                    </div>

                    {/* ── Card 2: Full Optimize (recommended) ── */}
                    <div
                        className="group relative flex flex-col p-5 rounded-2xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                        style={{
                            background: 'color-mix(in srgb, var(--accent) 5%, rgba(255,255,255,0.02))',
                            border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
                            boxShadow: '0 0 24px -6px color-mix(in srgb, var(--accent) 30%, transparent)'
                        }}
                    >
                        {/* RECOMMENDED pill — same style as CS2 pro configs */}
                        <div
                            className="absolute top-0 right-0 px-3 py-1 text-xs font-bold rounded-bl-xl rounded-tr-2xl"
                            style={{ background: 'var(--accent)', color: '#000' }}
                        >
                            RECOMMENDED
                        </div>

                        {/* hover gradient sweep */}
                        <div
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                            style={{ background: 'linear-gradient(135deg, transparent 40%, color-mix(in srgb, var(--accent) 22%, transparent) 100%)' }}
                        />

                        <div className="relative z-10 flex items-center gap-3 mb-3">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                style={{
                                    background: 'color-mix(in srgb, var(--accent) 18%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)'
                                }}
                            >
                                <Cpu size={20} style={{ color: 'var(--accent)', filter: 'drop-shadow(0 0 6px var(--accent))' }} />
                            </div>
                            <h3 className="text-base font-bold text-white group-hover:text-[var(--accent)] transition-colors">
                                Full Optimize
                            </h3>
                        </div>

                        <p className="relative z-10 text-sm text-gray-400 flex-1 leading-relaxed mb-5">
                            Installs{' '}
                            <span style={{ color: 'var(--accent)' }}>ParkControl</span>{' '}
                            (disables core parking AC/DC) +{' '}
                            <span style={{ color: 'var(--accent)' }}>Process Lasso</span>{' '}
                            configured for aggressive game scheduling. Best results.
                        </p>

                        <button
                            onClick={() => handleApply('power-plan-full')}
                            className="relative z-10 w-full py-2.5 rounded-xl font-bold text-sm transition-all hover:brightness-110"
                            style={{
                                background: 'var(--accent)',
                                color: '#000',
                                boxShadow: '0 0 18px -3px color-mix(in srgb, var(--accent) 55%, transparent)'
                            }}
                        >
                            Full Optimize
                        </button>
                    </div>

                </div>
            )}
        </Modal>
    );
}
