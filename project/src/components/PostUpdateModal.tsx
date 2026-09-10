import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { t, type TfyLanguage } from '../lib/i18n';

interface PostUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    version: string;
    notes: string[];
    language: TfyLanguage;
}

const postUpdateStyles = `
@keyframes puFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes puFadeOut { from { opacity: 1; } to { opacity: 0; } }
@keyframes puSlideIn { from { opacity: 0; transform: scale(0.92) translateY(30px); } to { opacity: 1; transform: scale(1) translateY(0); } }
@keyframes puSlideOut { from { opacity: 1; transform: scale(1) translateY(0); } to { opacity: 0; transform: scale(0.92) translateY(20px); } }
@keyframes puFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes puPulseRing { 0% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.15); opacity: 0; } 100% { transform: scale(1); opacity: 0; } }
@keyframes puNoteSlide { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }

.pu-overlay {
  position: fixed; inset: 0; z-index: 99999;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  display: flex; align-items: center; justify-content: center;
  animation: puFadeIn 0.25s ease-out forwards;
}
.pu-overlay.closing { animation: puFadeOut 0.3s ease-in forwards; }
.pu-card {
  position: relative; width: 500px; max-width: calc(100% - 40px); max-height: calc(100vh - 60px);
  overflow-y: auto; scrollbar-width: none; border-radius: 20px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.01) 100%) !important;
  backdrop-filter: blur(48px) saturate(150%); -webkit-backdrop-filter: blur(48px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset, 0 0 40px -8px color-mix(in srgb, var(--accent) 15%, transparent);
  animation: puSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.pu-card.closing { animation: puSlideOut 0.3s ease-in forwards; }
.pu-card::-webkit-scrollbar { display: none; }
.pu-glow-line {
  position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent); opacity: 0.7;
}
.pu-header { padding: 28px 28px 0; }
.pu-title { display: flex; align-items: center; gap: 12px; font-size: 19px; font-weight: 700; color: #fff; }
.pu-title-badge {
  position: relative; display: flex; align-items: center; justify-content: center;
  width: 38px; height: 38px; border-radius: 12px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 18%, transparent), color-mix(in srgb, var(--accent) 6%, transparent));
  border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
  color: var(--accent); animation: puFloat 3s ease-in-out infinite;
}
.pu-title-badge::after {
  content: ''; position: absolute; inset: -3px; border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--accent) 10%, transparent);
  animation: puPulseRing 3s ease-in-out infinite;
}
.pu-ver-box {
  margin: 20px 28px 0; padding: 12px 16px; border-radius: 12px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, transparent), color-mix(in srgb, var(--accent) 3%, transparent));
  border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
  display: flex; justify-content: space-between; align-items: center;
}
.pu-ver-label { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.05em; }
.pu-ver-val { font-size: 16px; font-weight: 700; color: var(--accent); font-family: monospace; }
.pu-notes { margin: 24px 28px 0; }
.pu-notes-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: rgba(255,255,255,0.3); margin-bottom: 12px; }
.pu-note { display: flex; align-items: flex-start; gap: 10px; padding: 6px 0; animation: puNoteSlide 0.4s ease-out both; }
.pu-note:nth-child(1) { animation-delay: 0.1s; }
.pu-note:nth-child(2) { animation-delay: 0.2s; }
.pu-note:nth-child(3) { animation-delay: 0.3s; }
.pu-note:nth-child(4) { animation-delay: 0.4s; }
.pu-note-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); margin-top: 5px; flex-shrink: 0; box-shadow: 0 0 6px color-mix(in srgb, var(--accent) 40%, transparent); }
.pu-note-text { font-size: 13px; line-height: 1.5; color: rgba(255,255,255,0.7); }
.pu-footer { padding: 24px 28px; display: flex; justify-content: flex-end; }
.pu-btn {
  padding: 10px 24px; border-radius: 10px; border: none; cursor: pointer;
  background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #000));
  color: #fff; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px;
  box-shadow: 0 4px 16px color-mix(in srgb, var(--accent) 25%, transparent); transition: all 0.2s;
}
.pu-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px color-mix(in srgb, var(--accent) 35%, transparent); filter: brightness(1.1); }
.pu-btn:active { transform: scale(0.96); }
`;

export function PostUpdateModal({ isOpen, onClose, version, notes, language }: PostUpdateModalProps) {
    const [visible, setVisible] = useState(false);
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
            setClosing(false);
        }
    }, [isOpen]);

    const handleClose = useCallback(() => {
        setClosing(true);
        setTimeout(() => {
            setClosing(false);
            setVisible(false);
            onClose();
        }, 280);
    }, [onClose]);

    if (!visible && !isOpen) return null;

    return createPortal(
        <>
            <style>{postUpdateStyles}</style>
            <div className={`pu-overlay ${closing ? 'closing' : ''}`} onClick={handleClose}>
                <div className={`pu-card ${closing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
                    <div className="pu-glow-line" />
                    
                    <div className="pu-header">
                        <div className="pu-title">
                            <div className="pu-title-badge">
                                <Sparkles size={18} />
                            </div>
                            Update Successful!
                        </div>
                    </div>

                    <div className="pu-ver-box">
                        <span className="pu-ver-label">New Version Installed</span>
                        <span className="pu-ver-val">{version}</span>
                    </div>

                    <div className="pu-notes">
                        <div className="pu-notes-label">What's New</div>
                        {notes.map((note, i) => (
                            <div key={i} className="pu-note">
                                <div className="pu-note-dot" />
                                <div className="pu-note-text">{note}</div>
                            </div>
                        ))}
                    </div>

                    <div className="pu-footer">
                        <button className="pu-btn" onClick={handleClose}>
                            <CheckCircle2 size={16} />
                            Awesome!
                        </button>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}
