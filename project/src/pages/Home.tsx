import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Cpu,
  HardDrive,
  Thermometer,
  MemoryStick,
  Gauge,
  CircuitBoard,
  PcCase,
  Monitor,
  Network,
  Sparkles,
  Activity,
  ShieldCheck,
  Wand2,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { CircularProgress } from '../components/CircularProgress';
import { TemperatureGraph } from '../components/TemperatureGraph';
import { getLanguage, onLanguageChange, t, type TfyLanguage } from '../lib/i18n';
import { notify } from '../lib/notify';

declare global {
  interface Window {
    chrome: {
      webview: {
        addEventListener: (type: string, listener: (event: any) => void) => void;
        removeEventListener: (type: string, listener: (event: any) => void) => void;
        postMessage: (message: any) => void;
      };
    };
    __tfyStats?: any;
    __tfyLastGoodStats?: any;
    __tfyTempHistory?: { cpu: number[]; gpu: number[] };
    __tfyDiscordName?: string;
    __tfySpecs?: any;
  }
}
type SystemTab = 'cpu' | 'mainboard' | 'memory' | 'graphics' | 'storage' | 'network';

type DiscordState = {
  connected?: boolean;
  username?: string;
  Username?: string;
};

type StatsPayload = {
  CPU?: any;
  GPU?: any;
  RAM?: any;
  Drives?: any;
};

type HoverState = {
  index: number;
  value: number;
};

type ReleaseType = 'Minor' | 'Major' | 'Patch' | 'Theme' | 'Hotfix' | 'UX' | 'Perf' | 'Security' | 'Preview';

type ReleaseItem = {
  version: string;
  type: ReleaseType;
  date: string;
  items: string[];
};

const defaultStats = {
  cpuUsage: 0,
  gpuUsage: 0,
  ramUsage: 0,
  cpuTemp: 0,
  gpuTemp: 0,
  cpuPackage: 0,
  cpuCoreAverage: 0,
  cpuCoreMax: 0,
  gpuCoreTemp: 0,
  gpuHotSpot: 0,
  ramUsed: 0,
  ramAvailable: 0,
  ramVirtualUsed: 0,
  ramVirtualAvailable: 0,
  cpuCores: [] as { name: string; value: number }[],
  drives: [] as { letter: string; used: number; total: number; label: string }[]
};
const whatsNewItemsEn: ReleaseItem[] = [
  {
    version: 'v6.3.2',
    type: 'Major',
    date: 'Sep 11, 2026',
    items: [
      '[NEW] MultiRoblox — Run unlimited accounts, Passive Rejoin auto-reconnect & 16:9 charts.',
      '[UPDATED] Debloating Sort — Instant category filtering, smart search & fast list sorting.',
      '[FIXED] Bug Fixes — Resolved UI glitches, modernized drag sliders & overall stability improvements.',
    ],
  },
  {
    version: 'v6.1.1',
    type: 'Major',
    date: 'Mar 19, 2026',
    items: [
      'Added Ultimate Power Plan with max CPU unparking and frequency scaling.',
      'Integrating Process Lasso & ParkControl auto-configuration via Cloud.',
      'Fortnite Config Hub now supports community configs sharing natively.',
    ],
  },
  {
    version: 'v4.9.0',
    type: 'Perf',
    date: 'Feb 23, 2026',
    items: [
      'Debloater uninstall flow now refreshes list after run.',
      'Discord logout now clears local session and updates UI state.',
      'Testing Lab is now role-gated to Tester App and Developer.',
    ],
  },
  {
    version: 'v4.8.0',
    type: 'Theme',
    date: 'Feb 22, 2026',
    items: [
      'Backups modal styling unified with details modal system.',
      'Create New button now keeps readable dark text on bright themes.',
      'Create Note panel now uses amber warning style for consistency.',
    ],
  },
  {
    version: 'v4.7.0',
    type: 'Patch',
    date: 'Feb 20, 2026',
    items: [
      'Backup delete pipeline updated for broader Windows compatibility.',
      'Added native fallback removal path for restore points.',
      'Improved backup operation feedback in notifications.',
    ],
  },
  {
    version: 'v4.5.0',
    type: 'UX',
    date: 'Feb 14, 2026',
    items: [
      'Window controls cleaned and aligned in top bar.',
      'Debloat checkboxes updated for better visual alignment.',
      'Sidebar Discord block and settings motion refined.',
    ],
  },
  {
    version: 'v4.2.0',
    type: 'Theme',
    date: 'Jan 30, 2026',
    items: [
      'Home cards updated with unified cyberpunk theming.',
      'Temperature monitor header and controls updated to outline style.',
      'Disk icon and action controls aligned with home design language.',
    ],
  },
  {
    version: 'v4.0.0',
    type: 'Minor',
    date: 'Jan 20, 2026',
    items: [
      'Core UI modernization baseline for the v4 line.',
      'Expanded telemetry cards and detail modal structure.',
      'Improved system info surfacing and module navigation.',
    ],
  },
];

const whatsNewItemsRo: ReleaseItem[] = [
  {
    version: 'v6.3.2',
    type: 'Major',
    date: '11 Sep 2026',
    items: [
      '[NEW] MultiRoblox — Rulează conturi nelimitate, reconectare automată (Passive Rejoin) și catalog 16:9.',
      '[UPDATED] Debloating Sort — Filtrare rapidă pe categorii, căutare inteligentă și sortare instantă.',
      '[FIXED] Bug Fixes — Rezolvat erori vizuale, slidere modernizate și stabilitate generală.',
    ],
  },
  {
    version: 'v6.1.1',
    type: 'Major',
    date: 'Mar 19, 2026',
    items: [
      'Adaugat Ultimate Power Plan cu unparking maxim pe CPU si scalare a frecventei.',
      'Integrare Process Lasso & ParkControl cu auto-configurare via Cloud.',
      'Fortnite Config Hub suporta acum partajarea configuratiilor in comunitate.',
    ],
  },
  {
    version: 'v4.9.0',
    type: 'Perf',
    date: 'Feb 23, 2026',
    items: [
      'Fluxul de dezinstalare din Debloater face acum refresh automat dupa rulare.',
      'Logout pe Discord sterge sesiunea locala si actualizeaza UI-ul.',
      'Testing Lab este restrictionat pe rolurile Tester App si Developer.',
    ],
  },
  {
    version: 'v4.8.0',
    type: 'Theme',
    date: 'Feb 22, 2026',
    items: [
      'Modalele Backups au acelasi stil vizual ca modalele de detalii.',
      'Butonul Create New are text inchis pentru lizibilitate pe temele luminoase.',
      'Panoul Note din Create foloseste stil amber, ca in Restore.',
    ],
  },
  {
    version: 'v4.7.0',
    type: 'Patch',
    date: 'Feb 20, 2026',
    items: [
      'Pipeline-ul de delete pentru backup a fost extins pentru compatibilitate Windows.',
      'A fost adaugat fallback nativ pentru stergerea restore point-urilor.',
      'Notificarile pentru backup au feedback mai clar.',
    ],
  },
  {
    version: 'v4.5.0',
    type: 'UX',
    date: 'Feb 14, 2026',
    items: [
      'Window controls au fost curatate si aliniate in top bar.',
      'Checkbox-urile din Debloat au fost aliniate mai bine vizual.',
      'Cardul Discord din sidebar are tranzitii mai curate.',
    ],
  },
  {
    version: 'v4.2.0',
    type: 'Theme',
    date: 'Jan 30, 2026',
    items: [
      'Cardurile din Home au primit stil cyberpunk unitar pe teme.',
      'Header-ul Temperature Monitor are stil outline ca usage cards.',
      'Iconul din cardul Disk este aliniat la limbajul nou de design.',
    ],
  },
  {
    version: 'v4.0.0',
    type: 'Minor',
    date: 'Jan 20, 2026',
    items: [
      'Baza de modernizare UI pentru linia v4.',
      'Carduri extinse pentru telemetrie si structura de modale.',
      'Navigare si suprafatare mai clara pentru informatii de sistem.',
    ],
  },
];

const whatsNewItemsDe: ReleaseItem[] = [
  { version: 'v6.3.2', type: 'Major', date: 'Sep 11, 2026', items: ['[NEW] MultiRoblox — Unbegrenzte Accounts, Passive Rejoin & 16:9-Charts.', '[UPDATED] Debloating Sort — Schnelle Kategoriefilterung & Sofort-Sortierung.', '[FIXED] Bug Fixes — Visuelle Fehler behoben, moderne Regler & mehr Stabilitat.'] },
  { version: 'v6.1.1', type: 'Major', date: 'Mar 19, 2026', items: ['Ultimate Power Plan mit max CPU Unparking hinzugefugt.', 'Process Lasso & ParkControl Auto-Konfiguration via Cloud integriert.', 'Fortnite Config Hub unterstutzt jetzt native Community-Configs.'] },
  { version: 'v4.9.0', type: 'Perf', date: 'Feb 23, 2026', items: ['Debloater-Deinstallation aktualisiert die Liste jetzt automatisch.', 'Discord-Logout leert jetzt die lokale Sitzung und aktualisiert die UI.', 'Testing Lab ist jetzt auf Tester App und Developer Rollen beschrankt.'] },
  { version: 'v4.8.0', type: 'Theme', date: 'Feb 22, 2026', items: ['Backups-Modalstil an Details-Modalstil angeglichen.', 'Create-New-Button nutzt dunklen Text fur bessere Lesbarkeit.', 'Hinweisfeld in Create nutzt jetzt den amber Warnstil wie Restore.'] },
  { version: 'v4.7.0', type: 'Patch', date: 'Feb 20, 2026', items: ['Backup-Delete-Pipeline fur mehr Windows-Kompatibilitat erweitert.', 'Nativer Fallback fur RemoveRestorePoint hinzugefugt.', 'Backup-Benachrichtigungen mit klarerem Feedback.'] },
  { version: 'v4.5.0', type: 'UX', date: 'Feb 14, 2026', items: ['Window Controls in der Top-Bar sauber ausgerichtet.', 'Debloat-Checkboxen visuell besser ausgerichtet.', 'Discord-Block in der Sidebar mit weicheren Ubergangen.'] },
  { version: 'v4.2.0', type: 'Theme', date: 'Jan 30, 2026', items: ['Home-Karten auf einheitlichen Cyberpunk-Stil gebracht.', 'Temperature-Monitor Header im Outline-Stil wie Usage-Karten.', 'Disk-Karten-Icon an neues Designsystem angepasst.'] },
  { version: 'v4.0.0', type: 'Minor', date: 'Jan 20, 2026', items: ['Basis-Modernisierung der UI fur die v4-Linie.', 'Erweiterte Telemetrie-Karten und Modal-Struktur.', 'Bessere Navigation und Darstellung von Systeminformationen.'] },
];
const whatsNewItemsEs: ReleaseItem[] = [
  { version: 'v6.3.2', type: 'Major', date: 'Sep 11, 2026', items: ['[NEW] MultiRoblox — Cuentas ilimitadas, reconexion Passive Rejoin y charts 16:9.', '[UPDATED] Debloating Sort — Filtrado rapido por categorias y ordenamiento.', '[FIXED] Bug Fixes — Errores visuales corregidos, sliders modernos y estabilidad.'] },
  { version: 'v6.1.1', type: 'Major', date: 'Mar 19, 2026', items: ['Ultimate Power Plan con CPU unparking anadido.', 'Process Lasso & ParkControl auto-configuracion via Cloud.', 'Fortnite Config Hub ahora soporta la configuracion comunitaria.'] },
  { version: 'v4.9.0', type: 'Perf', date: 'Feb 23, 2026', items: ['El flujo de desinstalacion en Debloater ahora refresca la lista automaticamente.', 'El logout de Discord ahora limpia la sesion local y actualiza la UI.', 'Testing Lab ahora esta limitado a roles Tester App y Developer.'] },
  { version: 'v4.8.0', type: 'Theme', date: 'Feb 22, 2026', items: ['El estilo de modales Backups se unifico con los modales de detalles.', 'El boton Create New ahora usa texto oscuro para mejor lectura.', 'La nota de Create ahora usa estilo amber como en Restore.'] },
  { version: 'v4.7.0', type: 'Patch', date: 'Feb 20, 2026', items: ['Pipeline de borrado de backups ampliado para mejor compatibilidad Windows.', 'Se agrego fallback nativo para RemoveRestorePoint.', 'Notificaciones de backup con feedback mas claro.'] },
  { version: 'v4.5.0', type: 'UX', date: 'Feb 14, 2026', items: ['Window controls alineados y limpiados en la barra superior.', 'Checkboxes de Debloat mejor alineados visualmente.', 'Tarjeta Discord en sidebar con transiciones mas suaves.'] },
  { version: 'v4.2.0', type: 'Theme', date: 'Jan 30, 2026', items: ['Tarjetas Home actualizadas con estilo cyberpunk unificado.', 'Header de Temperature Monitor en estilo outline como usage cards.', 'Icono de Disk alineado con el nuevo lenguaje visual.'] },
  { version: 'v4.0.0', type: 'Minor', date: 'Jan 20, 2026', items: ['Base de modernizacion de UI para la linea v4.', 'Tarjetas de telemetria ampliadas y estructura de modales.', 'Mejor navegacion y presentacion de informacion del sistema.'] },
];
const whatsNewItemsFr: ReleaseItem[] = [
  { version: 'v6.3.2', type: 'Major', date: 'Sep 11, 2026', items: ['[NEW] MultiRoblox — Comptes illimites, reconnexion Passive Rejoin et charts 16:9.', '[UPDATED] Debloating Sort — Tri instantane et filtrage par categories.', '[FIXED] Bug Fixes — Corrections graphiques, sliders modernises et stabilite.'] },
  { version: 'v6.1.1', type: 'Major', date: 'Mar 19, 2026', items: ['Ultimate Power Plan avec deparking CPU ajoute.', 'Process Lasso & ParkControl configuration via Cloud.', 'Fortnite Config Hub prend desormais en charge le partage communautaire.'] },
  { version: 'v4.9.0', type: 'Perf', date: 'Feb 23, 2026', items: ['Le flux de desinstallation Debloater rafraichit maintenant la liste automatiquement.', 'La deconnexion Discord nettoie maintenant la session locale et met a jour l UI.', 'Testing Lab est desormais limite aux roles Tester App et Developer.'] },
  { version: 'v4.8.0', type: 'Theme', date: 'Feb 22, 2026', items: ['Le style des modales Backups est aligne avec les modales de details.', 'Le bouton Create New utilise maintenant un texte sombre pour la lisibilite.', 'La note dans Create utilise maintenant le style amber comme Restore.'] },
  { version: 'v4.7.0', type: 'Patch', date: 'Feb 20, 2026', items: ['Pipeline de suppression backup etendu pour une meilleure compatibilite Windows.', 'Ajout d un fallback natif pour RemoveRestorePoint.', 'Notifications backup avec retour plus clair.'] },
  { version: 'v4.5.0', type: 'UX', date: 'Feb 14, 2026', items: ['Window controls nettoyes et mieux alignes dans la barre du haut.', 'Cases Debloat mieux alignees visuellement.', 'Carte Discord de la sidebar avec transitions plus fluides.'] },
  { version: 'v4.2.0', type: 'Theme', date: 'Jan 30, 2026', items: ['Cartes Home mises a jour avec un style cyberpunk unifie.', 'Header Temperature Monitor en style outline comme les cartes usage.', 'Icone Disk alignee avec le nouveau langage visuel.'] },
  { version: 'v4.0.0', type: 'Minor', date: 'Jan 20, 2026', items: ['Base de modernisation UI pour la ligne v4.', 'Cartes de telemetrie et structure de modales etendues.', 'Meilleure navigation et presentation des informations systeme.'] },
];

const typeClass: Record<ReleaseType, string> = {
  Minor: 'tag tag-minor',
  Major: 'tag tag-major',
  Patch: 'tag tag-patch',
  Theme: 'tag tag-theme',
  Hotfix: 'tag tag-hotfix',
  UX: 'tag tag-ux',
  Perf: 'tag tag-perf',
  Security: 'tag tag-security',
  Preview: 'tag tag-preview',
};

const releaseTypeKey: Record<ReleaseType, string> = {
  Minor: 'release.type.minor',
  Major: 'release.type.major',
  Patch: 'release.type.patch',
  Theme: 'release.type.theme',
  Hotfix: 'release.type.hotfix',
  UX: 'release.type.ux',
  Perf: 'release.type.perf',
  Security: 'release.type.security',
  Preview: 'release.type.preview',
};

export function Home() {
  const toNumber = (value: any, fallback = 0) => {
    if (typeof value === 'string') {
      const cleaned = value.replace(',', '.').replace(/[^\\d.-]/g, '');
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  };

  const pickPositive = (...values: number[]) => values.find((v) => Number.isFinite(v) && v > 0) ?? 0;
  const round1 = (value: number) => Math.round(value * 10) / 10;
  const formatTemp = (value: number) => (value > 0 ? `${value.toFixed(1)} ${String.fromCharCode(176)}C` : 'N/A');
  const formatTempInt = (value: number) => (value > 0 ? `${Math.round(value)} ${String.fromCharCode(176)}C` : 'N/A');
  const hasNonZero = (value: typeof defaultStats) => value.cpuUsage > 0 || value.gpuUsage > 0 || value.ramUsage > 0 || value.cpuTemp > 0 || value.gpuTemp > 0;

  const cachedStats = (() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('tfyStats');
        if (raw) return JSON.parse(raw);
      }
    } catch {
    }
    return null;
  })();
  if (!window.__tfyStats && cachedStats) {
    window.__tfyStats = cachedStats;
  }
  if (!window.__tfyLastGoodStats && window.__tfyStats && hasNonZero(window.__tfyStats)) {
    window.__tfyLastGoodStats = window.__tfyStats;
  }
  const initialStats = window.__tfyLastGoodStats ?? window.__tfyStats ?? cachedStats ?? defaultStats;
  const lastNonZeroRef = useRef(hasNonZero(initialStats));
  const statsRef = useRef(initialStats);
  const lastGoodRef = useRef(initialStats);
  const lastTempRef = useRef({ cpu: 0, gpu: 0 });
  const [openModal, setOpenModal] = useState<string | null>(null);
  const [systemInfoOpen, setSystemInfoOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [uiBuild, setUiBuild] = useState(() => {
    try { return localStorage.getItem('tfy.uiBuild') || ''; } catch { return ''; }
  });
  const [appVersion, setAppVersion] = useState(() => {
    try { return localStorage.getItem('tfy.appVersion') || ''; } catch { return ''; }
  });
  const [systemTab, setSystemTab] = useState<SystemTab>('cpu');
  const [discordName, setDiscordName] = useState<string | null>(() => {
    if (window.__tfyDiscordName) return window.__tfyDiscordName;
    try {
      return localStorage.getItem('tfy.discord.name');
    } catch {
      return null;
    }
  });
  const [tempView, setTempView] = useState<'cpu' | 'gpu'>('cpu');
  const [cpuHistory, setCpuHistory] = useState<number[]>(() => window.__tfyTempHistory?.cpu ?? Array(60).fill(0));
  const [gpuHistory, setGpuHistory] = useState<number[]>(() => window.__tfyTempHistory?.gpu ?? Array(60).fill(0));
  const [hover, setHover] = useState<HoverState | null>(null);
  const [specs, setSpecs] = useState<any>(() => {
    if (window.__tfySpecs) return window.__tfySpecs;
    try {
      const raw = localStorage.getItem('tfy.specs');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [stats, setStats] = useState(initialStats);
  const [language, setLanguage] = useState<TfyLanguage>(() => getLanguage());
  const [cleanModalOpen, setCleanModalOpen] = useState(false);
  const [cleanSelection, setCleanSelection] = useState<Record<string, boolean>>({
    temp: true,
    prefetch: true,
    crash: true,
    wer: true,
    windowsUpdate: true,
    windowsLogs: true,
    shader: true,
    recent: true,
    cache: true,
    storeCache: true,
    extras: false,
  });
  const viewStats = useMemo(() => {
    if (hasNonZero(stats)) return stats;
    if (lastGoodRef.current && hasNonZero(lastGoodRef.current)) return lastGoodRef.current;
    if (window.__tfyStats && hasNonZero(window.__tfyStats)) return window.__tfyStats;
    return stats;
  }, [stats]);

  useEffect(() => {
    if (!hasNonZero(stats) && window.__tfyStats && hasNonZero(window.__tfyStats)) {
      setStats(window.__tfyStats);
    }
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      if (!hasNonZero(statsRef.current) && window.__tfyLastGoodStats && hasNonZero(window.__tfyLastGoodStats)) {
        setStats(window.__tfyLastGoodStats);
      }
    }, 1500);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    statsRef.current = stats;
    if (hasNonZero(stats)) {
      lastNonZeroRef.current = true;
      lastGoodRef.current = stats;
      window.__tfyLastGoodStats = stats;
      window.__tfyStats = stats;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('tfyStats', JSON.stringify(stats));
        }
      } catch {
      }
    }
  }, [stats]);
  useEffect(() => {
    const handleMessage = (event: any) => {
      let message = event.data;
      if (typeof message === 'string') {
        try {
          message = JSON.parse(message);
        } catch {
          return;
        }
      }

      if (message?.type === 'update' && message?.action === 'version') {
        const version = String(message?.currentVersion || '').trim();
        const build = String(message?.uiBuild || '').trim();
        if (version) {
          setAppVersion(version);
          try { localStorage.setItem('tfy.appVersion', version); } catch { }
        }
        if (build) {
          setUiBuild(build);
          try { localStorage.setItem('tfy.uiBuild', build); } catch { }
        }
      }

      if (message?.type === 'stats') {
        const data = (message.data || {}) as StatsPayload;
        const cpu = data.CPU || data.cpu || {};
        const gpu = data.GPU || data.gpu || {};
        const ram = data.RAM || data.ram || {};
        const drives = data.Drives || data.drives || [];

        const cpuCores = (cpu.Cores || cpu.cores || []) as { name: string; value: number }[];
        const coreValues = cpuCores.map((core) => Number(core.value || 0)).filter((value) => Number.isFinite(value) && value > 0);
        const computedCoreAvg = coreValues.length > 0 ? coreValues.reduce((a, b) => a + b, 0) / coreValues.length : 0;
        const computedCoreMax = coreValues.length > 0 ? Math.max(...coreValues) : 0;

        const cpuPackageRaw = pickPositive(
          toNumber(cpu.PackageTemp),
          toNumber(cpu.packageTemp),
          toNumber(cpu.Temperature),
          toNumber(cpu.temperature)
        );
        const cpuCoreAvgRaw = pickPositive(
          toNumber(cpu.CoreAverage),
          toNumber(cpu.coreAverage),
          toNumber(cpu.CoreAvg),
          toNumber(cpu.coreAvg)
        );
        const cpuCoreMaxRaw = pickPositive(toNumber(cpu.CoreMax), toNumber(cpu.coreMax));

        const cpuCoreAverage = round1(cpuCoreAvgRaw || computedCoreAvg);
        const cpuCoreMax = round1(cpuCoreMaxRaw || computedCoreMax);
        const cpuPackage = round1(cpuPackageRaw || cpuCoreAverage || computedCoreMax || 0);
        const cpuTemp = cpuPackage;

        const gpuCoreTempRaw = pickPositive(
          toNumber(gpu.CoreTemp),
          toNumber(gpu.coreTemp),
          toNumber(gpu.Temperature),
          toNumber(gpu.temperature)
        );
        const gpuHotSpotRaw = pickPositive(toNumber(gpu.HotSpot), toNumber(gpu.hotSpot));
        const gpuCoreTemp = round1(gpuCoreTempRaw);
        const gpuHotSpot = round1(gpuHotSpotRaw);
        const gpuTemp = gpuCoreTemp;

        const ramUsed = round1(toNumber(ram.Used ?? ram.used));
        const ramAvailable = round1(toNumber(ram.Available ?? ram.available));
        const ramVirtualUsed = round1(toNumber(ram.VirtualUsed ?? ram.virtualUsed));
        const ramVirtualAvailable = round1(toNumber(ram.VirtualAvailable ?? ram.virtualAvailable));
        const ramVirtualUsedFixed = ramVirtualUsed > 0 ? ramVirtualUsed : (statsRef.current?.ramVirtualUsed ?? 0);
        const ramVirtualAvailableFixed = ramVirtualAvailable > 0 ? ramVirtualAvailable : (statsRef.current?.ramVirtualAvailable ?? 0);
        const nextCpuUsage = Math.round(toNumber(cpu.Load ?? cpu.load));
        const nextGpuUsage = Math.round(toNumber(gpu.Load ?? gpu.load));
        const nextRamUsage = Math.round(toNumber(ram.Load ?? ram.load));
        const prevStats = statsRef.current ?? defaultStats;

        const cpuTempFinal = cpuTemp > 0 ? cpuTemp : (prevStats.cpuTemp ?? 0);
        const cpuPackageFinal = cpuPackage > 0 ? cpuPackage : (prevStats.cpuPackage ?? cpuTempFinal);
        const cpuCoreAverageFinal = cpuCoreAverage > 0 ? cpuCoreAverage : (prevStats.cpuCoreAverage ?? 0);
        const cpuCoreMaxFinal = cpuCoreMax > 0 ? cpuCoreMax : (prevStats.cpuCoreMax ?? 0);
        const gpuCoreTempFinal = gpuCoreTemp > 0 ? gpuCoreTemp : (prevStats.gpuCoreTemp ?? 0);
        const gpuHotSpotFinal = gpuHotSpot > 0 ? gpuHotSpot : (prevStats.gpuHotSpot ?? 0);
        const gpuTempFinal = gpuCoreTempFinal > 0 ? gpuCoreTempFinal : (prevStats.gpuTemp ?? 0);

        const nextStats = {
          cpuUsage: lastNonZeroRef.current && nextCpuUsage === 0 ? prevStats.cpuUsage : nextCpuUsage,
          gpuUsage: lastNonZeroRef.current && nextGpuUsage === 0 ? prevStats.gpuUsage : nextGpuUsage,
          ramUsage: lastNonZeroRef.current && nextRamUsage === 0 ? prevStats.ramUsage : nextRamUsage,
          cpuTemp: cpuTempFinal,
          gpuTemp: gpuTempFinal,
          cpuPackage: cpuPackageFinal,
          cpuCoreAverage: cpuCoreAverageFinal,
          cpuCoreMax: cpuCoreMaxFinal,
          gpuCoreTemp: gpuCoreTempFinal,
          gpuHotSpot: gpuHotSpotFinal,
          ramUsed,
          ramAvailable,
          ramVirtualUsed: ramVirtualUsedFixed,
          ramVirtualAvailable: ramVirtualAvailableFixed,
          cpuCores,
          drives: drives as { letter: string; used: number; total: number; label: string }[],
        };

        const isZeroSnapshot =
          nextStats.cpuUsage === 0 &&
          nextStats.gpuUsage === 0 &&
          nextStats.ramUsage === 0 &&
          nextStats.cpuTemp === 0 &&
          nextStats.gpuTemp === 0;

        if (!lastNonZeroRef.current && !isZeroSnapshot) {
          lastNonZeroRef.current = true;
        }

        const hadNonZero = hasNonZero(statsRef.current);
        if ((lastNonZeroRef.current || hadNonZero) && isZeroSnapshot) {
          return;
        }

        setStats(nextStats);

        const cpuHistoryValue = cpuPackage || cpuTemp || lastTempRef.current.cpu;
        const gpuHistoryValue = gpuCoreTemp || gpuTemp || lastTempRef.current.gpu;
        if (cpuHistoryValue > 0) lastTempRef.current.cpu = cpuHistoryValue;
        if (gpuHistoryValue > 0) lastTempRef.current.gpu = gpuHistoryValue;

        setCpuHistory((prev) => {
          return [...prev.slice(-59), cpuHistoryValue];
        });
        setGpuHistory((prev) => {
          return [...prev.slice(-59), gpuHistoryValue];
        });
      }

      if (message?.type === 'specs') {
        const data = message.data || {};
        window.__tfySpecs = data;
        try {
          localStorage.setItem('tfy.specs', JSON.stringify(data));
        } catch {
        }
        setSpecs(data);
      }
      if (message?.type === 'discord') {
        const data = message.data as DiscordState;
        const name = data?.Username || data?.username;
        const id = (data as any)?.UserId || (data as any)?.userId || (data as any)?.Id || (data as any)?.id;
        const avatarUrl = (data as any)?.AvatarUrl || (data as any)?.avatarUrl;

        const connected = (data as any)?.Connected || (data as any)?.connected;

        if (connected && name) {
          window.__tfyDiscordName = name;
          try {
            localStorage.setItem('tfy.discord.name', name);
            if (id) localStorage.setItem('tfy.discord.id', id);
            if (avatarUrl) localStorage.setItem('tfy.discord.avatar', avatarUrl);
          } catch {
          }
          setDiscordName(name);
        } else if (!connected) {
          window.__tfyDiscordName = '';
          try {
            localStorage.removeItem('tfy.discord.id');
            localStorage.removeItem('tfy.discord.name');
            localStorage.removeItem('tfy.discord.avatar');
          } catch {
          }
          setDiscordName('');
        }
      }
      if (message?.type === 'clean-files') {
        const ok = Boolean(message?.data?.ok);
        const removed = Number(message?.data?.removedItems ?? 0);
        const failed = Number(message?.data?.failedItems ?? 0);
        notify({
          title: ok ? t(language, 'home.cleanDone') : t(language, 'home.cleanError'),
          message: ok
            ? `${t(language, 'home.cleanDoneDesc')} (${removed} ${t(language, 'home.items')}, ${failed} ${t(language, 'home.failed')}).`
            : (message?.data?.message || t(language, 'home.cleanErrorDesc')),
          kind: ok ? 'success' : 'error',
          duration: ok ? 4200 : 5400,
        });
      }
    };

    if (window.chrome?.webview) {
      window.chrome.webview.addEventListener('message', handleMessage);
      window.chrome.webview.postMessage('specs-get');
      window.chrome.webview.postMessage('discord-get');
    }

    return () => {
      if (window.chrome?.webview) {
        window.chrome.webview.removeEventListener('message', handleMessage);
      }
    };
  }, [language]);
  useEffect(() => {
    if (!systemInfoOpen || !window.chrome?.webview) return;
    window.chrome.webview.postMessage('specs-get');
  }, [systemInfoOpen]);
  useEffect(() => {
    if (hasNonZero(stats)) {
      window.__tfyStats = stats;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('tfyStats', JSON.stringify(stats));
        }
      } catch {
      }
    }
  }, [stats]);
  useEffect(() => {
    if (cpuHistory.some((v) => v > 0) || gpuHistory.some((v) => v > 0)) {
      window.__tfyTempHistory = { cpu: cpuHistory, gpu: gpuHistory };
    }
  }, [cpuHistory, gpuHistory]);

  useEffect(() => {
    if (!window.chrome?.webview) return;
    const fetchSpecs = () => { window.chrome?.webview?.postMessage('specs-get'); };
    fetchSpecs();
    let attempts = 0;
    const id = setInterval(() => {
      attempts++;
      const currentSpecs = window.__tfySpecs || {};
      const isFailed = currentSpecs.Processor === 'N/A' || !currentSpecs.StorageDevices?.length;
      if (!isFailed || attempts >= 8) {
        clearInterval(id);
        return;
      }
      fetchSpecs();
    }, 3800);
    return () => clearInterval(id);
  }, []);

  const monitoringCards = [
    {
      id: 'cpu',
      icon: <Cpu size={20} />,
      label: t(language, 'home.cpuUsage'),
      value: viewStats.cpuUsage,
      color: 'var(--accent)',
    },
    {
      id: 'gpu',
      icon: <PcCase size={20} />,
      label: t(language, 'home.gpuUsage'),
      value: viewStats.gpuUsage,
      color: 'var(--accent)',
    },
    {
      id: 'ram',
      icon: <MemoryStick size={20} />,
      label: t(language, 'home.ramUsage'),
      value: viewStats.ramUsage,
      color: 'var(--accent)',
    },
  ];

  const systemTabs = [
    { id: 'cpu', label: t(language, 'home.tab.cpu'), icon: <Cpu size={16} /> },
    { id: 'mainboard', label: t(language, 'home.tab.mainboard'), icon: <CircuitBoard size={16} /> },
    { id: 'memory', label: t(language, 'home.tab.memory'), icon: <MemoryStick size={16} /> },
    { id: 'graphics', label: t(language, 'home.tab.graphics'), icon: <Monitor size={16} /> },
    { id: 'storage', label: t(language, 'home.tab.storage'), icon: <HardDrive size={16} /> },
    { id: 'network', label: t(language, 'home.tab.network'), icon: <Network size={16} /> },
  ] as const;

  const virtualAvailableDisplay = viewStats.ramVirtualAvailable;
  const virtualUsedDisplay = viewStats.ramVirtualUsed;
  const formatGB = (value: number) => (value > 0 ? `${value} GB` : 'N/A');
  const formatNetworkSpeed = (value: unknown) => {
    const raw = String(value ?? '').trim();
    const numeric = Number(raw.replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(numeric) || numeric <= 0) return raw || 'N/A';
    const gbps = numeric / 1_000_000_000;
    if (gbps >= 1) return `${gbps.toFixed(gbps >= 10 ? 0 : 1)} Gbps`;
    const mbps = numeric / 1_000_000;
    if (mbps >= 1) return `${mbps.toFixed(mbps >= 100 ? 0 : 1)} Mbps`;
    const kbps = numeric / 1_000;
    if (kbps >= 1) return `${kbps.toFixed(kbps >= 100 ? 0 : 1)} Kbps`;
    return `${numeric.toFixed(0)} bps`;
  };

  const rawSeries = tempView === 'cpu' ? cpuHistory : gpuHistory;
  const tempFallback = tempView === 'cpu'
    ? (viewStats.cpuPackage || viewStats.cpuTemp || lastTempRef.current.cpu)
    : (viewStats.gpuCoreTemp || viewStats.gpuTemp || lastTempRef.current.gpu);
  const tempSeries = useMemo(() => normalizeSeries(rawSeries, tempFallback), [rawSeries, tempFallback]);
  const hasTempData = tempSeries.some((v) => v > 0);
  const sparkline = useMemo(() => buildSparkline(tempSeries), [tempSeries]);
  const latestPoint = sparkline.points.length ? sparkline.points[sparkline.points.length - 1] : null;
  const secondsAgo = hover ? (tempSeries.length - 1 - hover.index) : 0;
  const hoverPoint = hover ? sparkline.points[hover.index] : null;
  const tooltipLeft = hoverPoint ? Math.min(Math.max(hoverPoint.x, 6), 94) : 0;
  const tooltipTop = hoverPoint ? Math.min(Math.max((hoverPoint.y / 70) * 100, 10), 90) : 0;

  const handleChartMove = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (tempSeries.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const denom = Math.max(1, tempSeries.length - 1);
    const index = Math.min(Math.max(Math.round((x / rect.width) * denom), 0), tempSeries.length - 1);
    const rawValue = tempSeries[index] ?? tempSeries[tempSeries.length - 1] ?? 0;
    const pointValue = sparkline.points[index]?.value ?? rawValue;
    const fallback = tempFallback;
    const latestNonZero = [...tempSeries].reverse().find((v) => v > 0) ?? fallback;
    const value = pointValue > 0 ? pointValue : latestNonZero;
    if (value <= 0) {
      setHover(null);
      return;
    }

    setHover({ index, value });
  };

  const renderSystemInfo = () => {
    const specValue = (...keys: string[]) => {
      for (const key of keys) {
        const value = (specs as Record<string, any>)?.[key];
        if (value !== undefined && value !== null && value !== '') return value;
      }
      return 'N/A';
    };
    const specArray = (...keys: string[]) => {
      for (const key of keys) {
        const value = (specs as Record<string, any>)?.[key];
        if (Array.isArray(value)) return value;
      }
      return [];
    };
    switch (systemTab) {
      case 'cpu':
        return (
          <div className="panel panel-outline rounded-2xl p-4 tfy-diagonal-glow">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div>
                <div className="text-gray-400 text-xs">{t(language, 'sys.name')}</div>
                <div className="text-white text-sm mt-1">{specValue('Processor', 'processor', 'CpuName', 'cpuName')}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">{t(language, 'sys.cores')}</div>
                <div className="text-white text-sm mt-1">{specValue('Cores', 'cores', 'CpuCores', 'cpuCores')}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">{t(language, 'sys.logicalProcessors')}</div>
                <div className="text-white text-sm mt-1">{specValue('LogicalProcessors', 'logicalProcessors', 'Threads', 'threads')}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">{t(language, 'sys.maxClockSpeed')}</div>
                <div className="text-white text-sm mt-1">{specValue('MaxClockSpeed', 'maxClockSpeed')} MHz</div>
              </div>
            </div>
          </div>
        );
      case 'mainboard':
        return (
          <div className="panel panel-outline rounded-2xl p-4 tfy-diagonal-glow">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div>
                <div className="text-gray-400 text-xs">{t(language, 'sys.manufacturer')}</div>
                <div className="text-white text-sm mt-1">{specValue('MotherboardManufacturer', 'motherboardManufacturer', 'BoardVendor', 'boardVendor')}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">{t(language, 'sys.product')}</div>
                <div className="text-white text-sm mt-1">{specValue('MotherboardProduct', 'motherboardProduct', 'BoardName', 'boardName')}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">{t(language, 'sys.biosVersion')}</div>
                <div className="text-white text-sm mt-1">{specValue('BiosVersion', 'biosVersion')}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">{t(language, 'sys.biosDate')}</div>
                <div className="text-white text-sm mt-1">{specValue('BiosDate', 'biosDate')}</div>
              </div>
            </div>
          </div>
        );
      case 'memory':
        return (
          <div className="space-y-3">

            <div className="space-y-3">
              {specArray('MemoryModules', 'memoryModules').length > 0 ? specArray('MemoryModules', 'memoryModules').map((mod: any, index: number) => (
                <div key={index} className="panel panel-outline rounded-2xl p-4 tfy-diagonal-glow">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400 text-xs">{t(language, 'sys.bankSlot')}</div>
                      <div className="text-white text-sm mt-1">{mod.Bank}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">{t(language, 'sys.capacity')}</div>
                      <div className="text-white text-sm mt-1">{mod.Capacity}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">{t(language, 'sys.speed')}</div>
                      <div className="text-white text-sm mt-1">{mod.Speed}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">{t(language, 'sys.manufacturer')}</div>
                      <div className="text-white text-sm mt-1">{mod.Manufacturer || 'N/A'}</div>
                    </div>
                    <div className="md:col-span-2">
                      <div className="text-gray-400 text-xs">{t(language, 'sys.partNumber')}</div>
                      <div className="text-white text-sm mt-1">{mod.PartNumber || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-gray-500 text-sm">{t(language, 'sys.noMemoryModules')}</div>
              )}
            </div>
          </div>
        );
      case 'graphics':
        const graphicsAdapters = specArray('GraphicsAdapters', 'graphicsAdapters');
        if (graphicsAdapters.length > 0) {
          return (
            <div className="space-y-3">
              {graphicsAdapters.map((gpu: any, index: number) => (
                <div key={index} className="panel panel-outline rounded-2xl p-4 tfy-diagonal-glow">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-1">
                    <div>
                      <div className="text-gray-400 text-xs">{t(language, 'sys.name')}</div>
                      <div className="text-white text-sm mt-1">{gpu?.Name || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">{t(language, 'sys.driverVersion')}</div>
                      <div className="text-white text-sm mt-1">{gpu?.DriverVersion || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">{t(language, 'sys.vram')}</div>
                      <div className="text-white text-sm mt-1">{gpu?.VRAM || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">{t(language, 'sys.processor')}</div>
                      <div className="text-white text-sm mt-1">{gpu?.Processor || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        }
        return (
          <div className="panel panel-outline rounded-2xl p-4 tfy-diagonal-glow">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div>
                <div className="text-gray-400 text-xs">{t(language, 'sys.name')}</div>
                <div className="text-white text-sm mt-1">{specValue('GraphicsName', 'graphicsName', 'GpuName', 'gpuName')}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">{t(language, 'sys.driverVersion')}</div>
                <div className="text-white text-sm mt-1">{specValue('GraphicsDriverVersion', 'graphicsDriverVersion')}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">{t(language, 'sys.vram')}</div>
                <div className="text-white text-sm mt-1">{specValue('GraphicsVRAM', 'graphicsVRAM', 'Vram', 'vram')}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">{t(language, 'sys.processor')}</div>
                <div className="text-white text-sm mt-1">{specValue('GraphicsProcessor', 'graphicsProcessor')}</div>
              </div>
            </div>
          </div>
        );
      case 'storage':
        return (
          <div className="space-y-4">

            <div className="space-y-3">
              {specArray('StorageDevices', 'storageDevices').length > 0 ? specArray('StorageDevices', 'storageDevices').map((drive: any, index: number) => (
                <div key={index} className="panel panel-outline rounded-2xl p-4 tfy-diagonal-glow">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400 text-xs">{t(language, 'sys.model')}</div>
                      <div className="text-white text-sm mt-1">{drive.Model}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">{t(language, 'sys.size')}</div>
                      <div className="text-white text-sm mt-1">{drive.Size}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">{t(language, 'sys.interface')}</div>
                      <div className="text-white text-sm mt-1">{drive.Interface}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">{t(language, 'sys.mediaType')}</div>
                      <div className="text-white text-sm mt-1">{drive.MediaType}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">{t(language, 'sys.partitions')}</div>
                      <div className="text-white text-sm mt-1">{drive.Partitions}</div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-gray-500 text-sm">{t(language, 'sys.noStorageDevices')}</div>
              )}
            </div>
          </div>
        );
      case 'network':
        return (
          <div className="space-y-4">

            <div className="space-y-3">
              {specArray('NetworkAdapters', 'networkAdapters').length > 0 ? specArray('NetworkAdapters', 'networkAdapters').map((adapter: any, index: number) => (
                <div key={index} className="panel panel-outline rounded-2xl p-4 tfy-diagonal-glow">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400 text-xs">{t(language, 'sys.name')}</div>
                      <div className="text-white text-sm mt-1">{adapter.Name}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">{t(language, 'sys.macAddress')}</div>
                      <div className="text-white text-sm mt-1">{adapter.MacAddress}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">{t(language, 'sys.type')}</div>
                      <div className="text-white text-sm mt-1">{adapter.Type}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">{t(language, 'sys.speed')}</div>
                      <div className="text-white text-sm mt-1">{formatNetworkSpeed(adapter.Speed)}</div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-gray-500 text-sm">{t(language, 'sys.noAdapters')}</div>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full overflow-hidden flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="section-title">{t(language, 'nav.home')}</p>
          <h1 className="text-3xl md:text-4xl font-display font-semibold text-white mt-2">
            {`${t(language, 'home.welcome')}${discordName ? ` ${discordName}` : ''}!`}
          </h1>
          <p className="text-gray-400 mt-1 max-w-xl text-sm">
            {t(language, 'home.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3 home-header-actions">
          <button className="btn-ghost home-action-btn home-header-btn" onClick={() => setSystemInfoOpen(true)}>{t(language, 'home.systemInfo')}</button>
          <button className="btn-ghost home-action-btn home-header-btn" onClick={() => setWhatsNewOpen(true)}>{t(language, 'home.whatsNew')}</button>
        </div>
      </div>

      <div className="shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <Gauge size={18} className="text-accent" />
          <h2 className="text-lg font-semibold text-white">{t(language, 'home.realtime')}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {monitoringCards.map((card) => (
            <div
              key={card.id}
              className="liquid-card rounded-2xl p-4 monitor-card home-feature-card tfy-diagonal-glow"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-xl metric-ring text-accent">
                  {card.icon}
                </div>
                <button
                  onClick={() => setOpenModal(card.id)}
                  className="btn-ghost text-xs relative z-10 text-gray-300 home-action-btn view-details-btn"
                >
                  {t(language, 'home.viewDetails')}
                </button>
              </div>

              <div className="mt-3 flex items-end gap-4">
                <div className="w-[120px] flex flex-col items-start">
                  <p className="text-4xl font-display text-white mb-1 tabular-nums text-left" style={{ fontVariantNumeric: 'tabular-nums' }}>{card.value}%</p>
                  <p className="text-gray-400 text-xs text-left">{card.label}</p>
                </div>
                <div className="w-[140px] flex-shrink-0 scale-90 origin-right ml-auto">
                  <CircularProgress
                    percentage={card.value}
                    label=""
                    color={card.color}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0">
        <div className="liquid-card rounded-2xl p-4 lg:col-span-2 min-h-0 flex flex-col temp-root-card home-feature-card tfy-diagonal-glow">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl metric-ring text-accent home-section-icon">
                <Thermometer size={16} />
              </div>
              <h3 className="text-white font-semibold">{t(language, 'home.temperatureMonitor')}</h3>
            </div>
          </div>
          <div className="liquid-card rounded-xl p-3 flex-1 min-h-0 thermal-summary tfy-diagonal-glow">
            <TemperatureGraph cpuHistory={cpuHistory} gpuHistory={gpuHistory} />
          </div>
        </div>
        <div className="liquid-card rounded-2xl p-4 min-h-0 home-feature-card tfy-diagonal-glow">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl metric-ring text-accent home-section-icon">
                <HardDrive size={16} />
              </div>
              <h3 className="text-white font-semibold">{t(language, 'home.disk')}</h3>
            </div>
            <button className="btn-ghost text-xs relative z-10 home-action-btn" onClick={() => setCleanModalOpen(true)}>
              {t(language, 'home.cleanFiles')}
            </button>
          </div>
          <div className="space-y-4">
            {viewStats.drives.length > 0 ? viewStats.drives.map((drive) => {
              const free = Math.max(0, drive.total - drive.used);
              const freePct = Math.round((free / Math.max(1, drive.total)) * 100);
              return (
                <div key={drive.letter} className="text-xs text-gray-400">
                  <div className="flex justify-between items-center">
                    <span>{drive.letter} {drive.label}</span>
                    <span>{drive.used}/{drive.total} GB Used</span>
                  </div>
                  <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden mt-2">
                    <div
                      className="h-full bg-gradient-accent rounded-full transition-all duration-500"
                      style={{ width: `${(drive.used / Math.max(1, drive.total)) * 100}%` }}
                    ></div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                    <span>{t(language, 'home.free')}</span>
                    <span>{free.toFixed(0)} GB ({freePct}%)</span>
                  </div>
                </div>
              );
            }) : (
              <div className="text-gray-500 text-sm">{t(language, 'home.noDrives')}</div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={whatsNewOpen}
        onClose={() => {
          try {
            if (uiBuild) localStorage.setItem('tfy.whatsNew.seenBuild', uiBuild);
          } catch {
          }
          setWhatsNewOpen(false);
        }}
        title={t(language, 'home.whatsNew')}
        className="tfy-modal-deep"
      >
        {appVersion ? (
          <div className="text-xs text-gray-500 mb-3">
            {t(language, 'about.version')} {appVersion}
          </div>
        ) : null}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pr-1">
          {(language === 'ro'
            ? whatsNewItemsRo
            : language === 'de'
              ? whatsNewItemsDe
              : language === 'es'
                ? whatsNewItemsEs
                : language === 'fr'
                  ? whatsNewItemsFr
                  : whatsNewItemsEn).map((item) => (
                    <div key={item.version} className="panel panel-outline rounded-2xl p-5 tfy-detail-tile whatsnew-card">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-lg font-semibold text-white">{item.version}</div>
                          <span className={`${typeClass[item.type]} whatsnew-tag`}>{t(language, releaseTypeKey[item.type])}</span>
                        </div>
                        <div className="text-xs text-gray-500">{item.date}</div>
                      </div>
                      <ul className="mt-3 space-y-2 text-sm text-gray-300">
                        {item.items.map((line) => (
                          <li key={line} className="flex items-start gap-2"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent/70" /><span>{line}</span></li>
                        ))}
                      </ul>
                    </div>
                  ))}
        </div>
      </Modal>

      <Modal
        isOpen={systemInfoOpen}
        onClose={() => setSystemInfoOpen(false)}
        title={t(language, 'home.systemInformation')}
        className="tfy-modal-deep"
      >
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] items-start gap-3 system-info-shell">
          <div className="panel panel-outline p-3 liquid-card tfy-detail-tile h-fit">
            <div className="space-y-2">
              {systemTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSystemTab(tab.id)}
                  className={`system-tab w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium ${systemTab === tab.id
                    ? 'active bg-accent/15 text-accent'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <span className="text-accent w-5 h-5 flex items-center justify-center">{tab.icon}</span>
                  <span className="flex-1 text-left">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="panel panel-outline p-4 liquid-card tfy-detail-tile system-info-content-panel md:min-h-[340px] overflow-hidden">
            <div className="max-h-[52vh] overflow-y-auto no-scrollbar pr-3 pb-6 pt-1">
              <div key={systemTab} className="system-info-tab-enter">
                {renderSystemInfo()}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={cleanModalOpen}
        onClose={() => setCleanModalOpen(false)}
        title={t(language, 'home.cleanFiles')}
        className="tfy-modal-deep clean-files-modal"
      >
        <div className="text-sm text-gray-400">
          {t(language, 'home.cleanSelectDesc')}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            ['temp', t(language, 'home.cleanOpt.temp')],
            ['prefetch', t(language, 'home.cleanOpt.prefetch')],
            ['crash', t(language, 'home.cleanOpt.crash')],
            ['wer', t(language, 'home.cleanOpt.wer')],
            ['windowsUpdate', t(language, 'home.cleanOpt.windowsUpdate')],
            ['windowsLogs', t(language, 'home.cleanOpt.windowsLogs')],
            ['shader', t(language, 'home.cleanOpt.shader')],
            ['recent', t(language, 'home.cleanOpt.recent')],
            ['cache', t(language, 'home.cleanOpt.cache')],
            ['storeCache', t(language, 'home.cleanOpt.storeCache')],
            ['extras', t(language, 'home.cleanOpt.extras')],
          ].map(([key, label]) => (
            <label key={key} className="panel panel-outline rounded-xl px-3 py-2 flex items-center gap-3 text-sm text-gray-300 clean-option-card">
              <input
                type="checkbox"
                className="clean-checkbox"
                checked={Boolean(cleanSelection[key])}
                onChange={(e) => setCleanSelection((prev) => ({ ...prev, [key]: e.target.checked }))}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <button className="btn-ghost" onClick={() => setCleanModalOpen(false)}>Cancel</button>
          <button
            className="btn-primary text-black no-glow"
            onClick={() => {
              const selected = Object.entries(cleanSelection).filter(([, on]) => on).map(([k]) => k);
              if (!selected.length) {
                notify({ title: t(language, 'home.cleanError'), message: t(language, 'home.cleanSelectOne'), kind: 'warning', duration: 2600 });
                return;
              }
              window.chrome?.webview?.postMessage(`clean-files-run|${JSON.stringify({ selected })}`);
              setCleanModalOpen(false);
              notify({
                title: t(language, 'home.cleaningStart'),
                message: t(language, 'home.cleaningStartDesc'),
                kind: 'info',
                duration: 2200,
              });
            }}
          >
            {t(language, 'home.cleanFiles')}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={openModal === 'cpu'}
        onClose={() => setOpenModal(null)}
        title={t(language, 'home.cpuDetails')}
        className="tfy-modal-deep"
      >
        <div className="panel panel-outline rounded-2xl p-4 details-main-card">
          <h3 className="text-gray-400 text-sm font-semibold mb-4">{t(language, 'home.temperatures')}</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="panel panel-outline p-3 tfy-detail-tile">
              <p className="text-gray-400 text-xs font-semibold mb-2">{t(language, 'home.cpuPackage')}</p>
              <p className="text-2xl font-bold text-white">{formatTemp(viewStats.cpuPackage || viewStats.cpuTemp)}</p>
            </div>
            <div className="panel panel-outline p-3 tfy-detail-tile">
              <p className="text-gray-400 text-xs font-semibold mb-2">{t(language, 'home.coreAverage')}</p>
              <p className="text-2xl font-bold text-white">{formatTemp(viewStats.cpuCoreAverage || 0)}</p>
            </div>
            <div className="panel panel-outline p-3 tfy-detail-tile">
              <p className="text-gray-400 text-xs font-semibold mb-2">{t(language, 'home.coreMax')}</p>
              <p className="text-2xl font-bold text-white">{formatTemp(viewStats.cpuCoreMax || 0)}</p>
            </div>
          </div>
        </div>

        <div className="panel panel-outline rounded-2xl p-4 details-main-card">
          <h3 className="text-gray-400 text-sm font-semibold mb-4">{t(language, 'home.coreTemperatures')}</h3>
          <div className="grid grid-cols-2 gap-2">
            {viewStats.cpuCores.length > 0 ? viewStats.cpuCores.map((core, index) => (
              <div key={index} className="panel panel-outline p-4 tfy-detail-tile">
                <p className="text-gray-400 text-xs font-semibold mb-2">{core.name}</p>
                <p className="text-lg font-bold text-accent">{formatTempInt(core.value)}</p>
              </div>
            )) : (
              <p className="text-gray-500 text-xs col-span-2 text-center py-4">{t(language, 'home.noCoreData')}</p>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={openModal === 'gpu'}
        onClose={() => setOpenModal(null)}
        title={t(language, 'home.gpuDetails')}
        className="tfy-modal-deep"
      >
        <div className="panel panel-outline rounded-2xl p-4 details-main-card">
          <h3 className="text-gray-400 text-sm font-semibold mb-4">{t(language, 'home.temperatures')}</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="panel panel-outline p-3 tfy-detail-tile">
              <p className="text-gray-400 text-xs font-semibold mb-2">{t(language, 'home.gpuCore')}</p>
              <p className="text-3xl font-bold text-white">{formatTemp(viewStats.gpuCoreTemp || viewStats.gpuTemp)}</p>
            </div>
            <div className="panel panel-outline p-3 tfy-detail-tile">
              <p className="text-gray-400 text-xs font-semibold mb-2">{t(language, 'home.gpuHotSpot')}</p>
              <p className="text-3xl font-bold text-white">{formatTemp(viewStats.gpuHotSpot || 0)}</p>
            </div>
            <div className="panel panel-outline p-3 tfy-detail-tile">
              <p className="text-gray-400 text-xs font-semibold mb-2">{t(language, 'home.gpuUsage')}</p>
              <p className="text-3xl font-bold text-white">{viewStats.gpuUsage}%</p>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={openModal === 'ram'}
        onClose={() => setOpenModal(null)}
        title={t(language, 'home.ramDetails')}
        className="tfy-modal-deep"
      >
        <div className="panel panel-outline rounded-2xl p-4 details-main-card">
          <h3 className="text-gray-400 text-sm font-semibold mb-4">{t(language, 'home.readings')}</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="panel panel-outline p-3 tfy-detail-tile">
              <p className="text-gray-400 text-xs font-semibold mb-2">{t(language, 'home.memoryAvailable')}</p>
              <p className="text-3xl font-bold text-accent">{formatGB(viewStats.ramAvailable)}</p>
            </div>
            <div className="panel panel-outline p-3 tfy-detail-tile">
              <p className="text-gray-400 text-xs font-semibold mb-2">{t(language, 'home.memoryUsed')}</p>
              <p className="text-3xl font-bold text-white">{formatGB(viewStats.ramUsed)}</p>
            </div>
            <div className="panel panel-outline p-3 tfy-detail-tile">
              <p className="text-gray-400 text-xs font-semibold mb-2">{t(language, 'home.virtualAvailable')}</p>
              <p className="text-3xl font-bold text-accent">{formatGB(virtualAvailableDisplay)}</p>
            </div>
            <div className="panel panel-outline p-3 tfy-detail-tile">
              <p className="text-gray-400 text-xs font-semibold mb-2">{t(language, 'home.virtualUsed')}</p>
              <p className="text-3xl font-bold text-white">{formatGB(virtualUsedDisplay)}</p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function buildSparkline(values: number[]) {
  if (values.length === 0) {
    return { line: '', smoothLine: '', area: '', points: [], grid: [], min: 0, max: 0 };
  }

  const minRaw = Math.min(...values);
  const maxRaw = Math.max(...values);
  const pad = Math.max(2, (maxRaw - minRaw) * 0.15);
  const min = Math.max(0, minRaw - pad);
  const max = maxRaw + pad;
  const range = max - min || 1;

  const top = 8;
  const bottom = 62;
  const usable = bottom - top;
  const denom = Math.max(1, values.length - 1);

  const points = values.map((value, index) => {
    const x = (index / denom) * 100;
    const y = bottom - ((value - min) / range) * usable;
    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)), value };
  });

  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const smoothLine = buildSmoothPath(points);
  const area = `M 0,${bottom.toFixed(2)} L ${points.map((point) => `${point.x},${point.y}`).join(' L ')} L 100,${bottom.toFixed(2)} Z`;
  const grid = [top, top + usable * 0.25, top + usable * 0.5, top + usable * 0.75, bottom].map((value) => Number(value.toFixed(2)));

  return {
    line,
    smoothLine,
    area,
    points,
    grid,
    min: Math.round(min * 10) / 10,
    max: Math.round(max * 10) / 10,
  };
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length <= 1) return '';
  let path = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const cx = ((prev.x + cur.x) / 2).toFixed(2);
    path += ` Q ${prev.x},${prev.y} ${cx},${((prev.y + cur.y) / 2).toFixed(2)}`;
    if (i === points.length - 1) {
      path += ` T ${cur.x},${cur.y}`;
    }
  }
  return path;
}

function normalizeSeries(values: number[], fallback = 0) {
  if (values.length === 0) return values;
  const dense = Array.from({ length: values.length }, (_, index) => {
    const value = values[index];
    return Number.isFinite(value) ? value : 0;
  });
  const firstNonZero = dense.find((v) => v > 0) ?? (fallback > 0 ? fallback : 0);
  if (firstNonZero <= 0) return dense;
  let last = firstNonZero;
  return dense.map((value) => {
    if (value > 0) {
      last = value;
      return value;
    }
    return last;
  });
}

































































































































































