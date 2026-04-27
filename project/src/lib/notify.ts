import type { NotificationKind } from '../components/NotificationCenter';

export type NotifyInput = {
  title?: string;
  message: string;
  kind?: NotificationKind;
  duration?: number;
};

export function notify(input: NotifyInput | string) {
  if (window.__tfyNotify) {
    window.__tfyNotify(input);
    return;
  }

  if (typeof input === 'string') {
    console.log(input);
    return;
  }

  console.log(`${input.title ? `${input.title}: ` : ''}${input.message}`);
}
