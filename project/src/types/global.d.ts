export {};

import type { NotificationKind } from '../components/NotificationCenter';

type TfyNotifyInput =
  | string
  | {
      title?: string;
      message: string;
      kind?: NotificationKind;
      duration?: number;
    };

declare global {
  interface Window {
    __tfyAccess?: {
      premium: boolean | null;
      testing: boolean | null;
    };
    __tfyNotify?: (input: TfyNotifyInput) => void;
  }
}

