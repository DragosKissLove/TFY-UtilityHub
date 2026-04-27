import { Download } from 'lucide-react';
import { Modal } from './Modal';
import { t, type TfyLanguage } from '../lib/i18n';

interface UpdateData {
    currentVersion?: string;
    latestVersion?: string;
    sizeMb?: number | null;
    notes?: string[] | null;
    mandatory?: boolean;
}

interface UpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    updateInfo: UpdateData | null;
    language: TfyLanguage;
}

export function UpdateModal({ isOpen, onClose, updateInfo, language }: UpdateModalProps) {
    const isMandatory = updateInfo?.mandatory;

    const notes = updateInfo?.notes && updateInfo.notes.length > 0
        ? updateInfo.notes
        : [
            t(language, 'about.note1'),
            t(language, 'about.note2'),
            t(language, 'about.note3')
        ];

    const sendHostMessage = (message: string) => {
        if (window.chrome?.webview) {
            window.chrome.webview.postMessage(message);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={isMandatory ? () => { } : onClose}
            title={t(language, 'about.updateAvailable')}
            className="tfy-modal-deep"
            hideClose={isMandatory}
        >
            <div className="panel panel-outline rounded-2xl p-0 overflow-hidden update-glow">
                <div className="update-hero">
                    <div className="update-hero-icon">
                        <Download size={20} />
                    </div>
                    <div>
                        <p className="update-kicker">{t(language, 'about.updateAvailable').toUpperCase()}</p>
                        <div className="text-2xl font-semibold text-white">
                            {t(language, 'about.version')} {updateInfo?.latestVersion ?? 'v5.0.1'}
                        </div>
                        <p className="text-sm text-gray-400 mt-1">{t(language, 'about.updateStable')}</p>
                    </div>
                </div>

                <div className="p-5 space-y-4">
                    <div className="update-version-grid">
                        <div className="panel panel-outline rounded-xl p-3 text-center">
                            <div className="text-xs text-gray-500">{t(language, 'about.current')}</div>
                            <div className="text-white font-semibold">{updateInfo?.currentVersion ?? 'v5.0.0'}</div>
                        </div>
                        <div className="panel panel-outline rounded-xl p-3 text-center border-accent/60">
                            <div className="text-xs text-gray-500">{t(language, 'about.new')}</div>
                            <div className="text-accent font-semibold">{updateInfo?.latestVersion ?? 'v5.0.1'}</div>
                        </div>
                        <div className="panel panel-outline rounded-xl p-3 text-center">
                            <div className="text-xs text-gray-500">{t(language, 'about.downloadSize')}</div>
                            <div className="text-white font-semibold">
                                {updateInfo?.sizeMb ? `${updateInfo.sizeMb.toFixed(1)} MB` : '-'}
                            </div>
                        </div>
                    </div>

                    {isMandatory && (
                        <div className="update-warning">
                            {t(language, 'about.updateRequired')}
                        </div>
                    )}

                    <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-gray-500">{t(language, 'home.whatsNew')}</p>
                        <ul className="mt-3 space-y-2 text-sm text-gray-400">
                            {notes.map((note, index) => (
                                <li key={index}>- {note}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-gray-500">{t(language, 'about.statusReady')}</div>
                        <div className="flex items-center gap-2">
                            {!isMandatory && (
                                <button className="btn-ghost" onClick={onClose}>
                                    {t(language, 'about.later')}
                                </button>
                            )}
                            <button
                                className="btn-primary px-8"
                                onClick={() => sendHostMessage('update-apply')}
                            >
                                {t(language, 'about.downloadUpdate')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
