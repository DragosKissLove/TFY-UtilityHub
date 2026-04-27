import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  hideClose?: boolean;
}

export function Modal({ isOpen, onClose, title, children, className, style, hideClose }: ModalProps) {
  const [mounted, setMounted] = useState(isOpen);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!window.chrome?.webview) return;
    if (isOpen) {
      window.chrome.webview.postMessage('modal-open');
    } else {
      window.chrome.webview.postMessage('modal-close');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setClosing(false);
      return;
    }

    if (mounted) {
      setClosing(true);
      const timer = setTimeout(() => {
        setMounted(false);
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [isOpen, mounted]);

  if (!mounted) return null;

  const animationClass = closing ? 'animate-fadeOut' : 'animate-fadeIn';

  // Render via portal so `position: fixed` is relative to the viewport (not affected by page transforms).
  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md tfy-modal ${animationClass}`}>
      <div
        className={`panel panel-outline max-w-5xl w-[92%] max-h-[88vh] overflow-y-auto no-scrollbar p-6 md:p-8 tfy-modal-shell ${className || ''} ${animationClass} transition-shadow duration-500`}
        style={{ borderColor: 'var(--accent)', boxShadow: '0 0 40px 2px color-mix(in srgb, var(--accent) 50%, transparent)', ...style }}
      >
        <div className="flex items-center justify-between gap-4 mb-6 modal-head">
          <h2 className="text-2xl font-display font-semibold text-white">{title}</h2>
          {!hideClose && (
            <button onClick={onClose} className="window-button -mr-2" type="button" aria-label="Close">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="space-y-6">
          {children}
        </div>
      </div>
    </div>
    , document.body);
}
