import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type NotificationKind = 'success' | 'error' | 'warning' | 'info';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  kind: NotificationKind;
  duration: number;
  createdAt: number;
  closing?: boolean;
}

const kindIcon: Record<NotificationKind, ReactNode> = {
  success: <CheckCircle2 size={16} />,
  error: <XCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  info: <Info size={16} />,
};

export function NotificationCenter({
  items,
  onClose,
}: {
  items: NotificationItem[];
  onClose: (id: string) => void;
}) {
  return (
    <div className="notify-root pointer-events-none fixed z-[120] flex w-[360px] max-w-[92vw] flex-col gap-2">
      {items.map((item) => {
        return (
          <div
            key={item.id}
            className={`notify-item notify-${item.kind} pointer-events-auto ${item.closing ? 'notify-leave' : 'notify-enter'}`}
          >
            <div className="notify-icon">{kindIcon[item.kind]}</div>
            <div className="min-w-0 flex-1">
              <div className="notify-title">{item.title}</div>
              <div className="notify-message">{item.message}</div>
            </div>
            <button className="notify-close" onClick={() => onClose(item.id)} aria-label="Dismiss notification">
              <X size={14} />
            </button>
            <span className="notify-progress" style={{ animationDuration: `${item.duration}ms` }} />
          </div>
        );
      })}
    </div>
  );
}
