export interface SystemStats {
  cpuUsage: number;
  gpuUsage: number;
  ramUsage: number;
  cpuTemp: number;
  diskUsage: number;
  diskTotal: number;
}

export interface PCSpec {
  processor: string;
  motherboard: string;
  gpu: string;
  os: string;
  ram: string;
  storage: string;
}

export interface GameTweak {
  id: string;
  name: string;
  description: string;
  actions: {
    label: string;
    action: () => void;
  }[];
}

export interface SystemTweak {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export interface AppDownload {
  id: string;
  name: string;
  description: string;
  size: string;
  category: string;
  icon?: string;
}

export type Page =
  | 'home'
  | 'backups'
  | 'fixes'
  | 'gaming'
  | 'gaming_tweaks'
  | 'system'
  | 'debloater'
  | 'testing'
  | 'downloads'
  | 'info';


