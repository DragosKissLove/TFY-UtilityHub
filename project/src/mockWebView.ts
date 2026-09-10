/**
 * Mock WebView2 Bridge — lets the TFY UI run standalone in a browser
 * without the C# WPF backend. All IPC postMessage calls are logged
 * to the console and return fake/demo data so every page renders.
 */

// Demo system stats payload matching C# HardwareMonitorService output
const demoStatsPayload = {
  CPU: {
    Load: 32,
    Temperature: 58,
    PackageTemp: 58,
    CoreAverage: 55,
    CoreMax: 62,
    Cores: [
      { name: "Core #1", value: 54 },
      { name: "Core #2", value: 58 },
      { name: "Core #3", value: 52 },
      { name: "Core #4", value: 56 },
      { name: "Core #5", value: 55 },
      { name: "Core #6", value: 59 },
      { name: "Core #7", value: 53 },
      { name: "Core #8", value: 62 },
    ]
  },
  GPU: {
    Load: 45,
    Temperature: 67,
    CoreTemp: 67,
    HotSpot: 72,
  },
  RAM: {
    Load: 38,
    Used: 12.4,
    Available: 19.6,
    VirtualUsed: 14.2,
    VirtualAvailable: 22.0
  },
  Drives: [
    { letter: "C:", used: 380, total: 1000, label: "NVMe System" },
    { letter: "D:", used: 650, total: 2000, label: "SSD Games" }
  ]
};

// Initial parsed stats matching Home.tsx defaultStats structure
const initialParsedStats = {
  cpuUsage: 32,
  gpuUsage: 45,
  ramUsage: 38,
  cpuTemp: 58,
  gpuTemp: 67,
  cpuPackage: 58,
  cpuCoreAverage: 55,
  cpuCoreMax: 62,
  gpuCoreTemp: 67,
  gpuHotSpot: 72,
  ramUsed: 12.4,
  ramAvailable: 19.6,
  ramVirtualUsed: 14.2,
  ramVirtualAvailable: 22.0,
  cpuCores: [
    { name: "Core #1", value: 54 },
    { name: "Core #2", value: 58 },
    { name: "Core #3", value: 52 },
    { name: "Core #4", value: 56 },
    { name: "Core #5", value: 55 },
    { name: "Core #6", value: 59 },
    { name: "Core #7", value: 53 },
    { name: "Core #8", value: 62 },
  ],
  drives: [
    { letter: "C:", used: 380, total: 1000, label: "NVMe System" },
    { letter: "D:", used: 650, total: 2000, label: "SSD Games" }
  ]
};

const demoSpecs = {
  Processor: "AMD Ryzen 7 5800X 8-Core Processor",
  Cores: 8,
  LogicalProcessors: 16,
  MaxClockSpeed: 4200,
  MotherboardManufacturer: "ASUSTeK COMPUTER INC.",
  MotherboardProduct: "ROG STRIX B550-F GAMING",
  BiosVersion: "AGESA 1.2.0.7",
  BiosDate: "2024-05-15",
  MemoryModules: [
    { Bank: "BANK 0", Capacity: "16 GB", Speed: "3600 MHz", Manufacturer: "Corsair", PartNumber: "CMK32GX4M2D3600C18" },
    { Bank: "BANK 2", Capacity: "16 GB", Speed: "3600 MHz", Manufacturer: "Corsair", PartNumber: "CMK32GX4M2D3600C18" },
  ],
  GraphicsAdapters: [
    { Name: "NVIDIA GeForce RTX 3070", DriverVersion: "560.94", VRAM: "8192 MB GDDR6", Processor: "GA104" }
  ],
  StorageDevices: [
    { Model: "Samsung SSD 980 PRO 1TB", Size: "1000 GB", Interface: "NVMe PCIe 4.0", MediaType: "SSD", Partitions: 3 },
    { Model: "WD Blue SN570 2TB", Size: "2000 GB", Interface: "NVMe PCIe 3.0", MediaType: "SSD", Partitions: 1 }
  ],
  NetworkAdapters: [
    { Name: "Intel(R) Ethernet Controller I225-V", MacAddress: "AA:BB:CC:DD:EE:FF", Type: "Ethernet 802.3", Speed: "2500000000" },
    { Name: "Intel(R) Wi-Fi 6 AX200 160MHz", MacAddress: "11:22:33:44:55:66", Type: "Wireless", Speed: "1200000000" }
  ]
};

type EventListener = (event: { data: any }) => void;
const listeners: EventListener[] = [];

function broadcastToListeners(data: any) {
  const event = { data: typeof data === 'string' ? data : JSON.stringify(data) };
  listeners.forEach(fn => {
    try { fn(event); } catch (e) { console.warn('[MockWebView] listener error:', e); }
  });
}

// Respond to IPC messages with demo data
function handleMessage(msg: string) {
  console.log('%c[WebView2 IPC]%c ' + msg, 'color:#10b981;font-weight:bold', 'color:#888');

  // System stats polling
  if (msg === 'get-stats' || msg === 'request-stats') {
    const s = JSON.parse(JSON.stringify(demoStatsPayload));
    s.CPU.Load = Math.min(100, Math.max(5, s.CPU.Load + Math.floor(Math.random() * 20 - 10)));
    s.GPU.Load = Math.min(100, Math.max(5, s.GPU.Load + Math.floor(Math.random() * 15 - 7)));
    s.RAM.Load = Math.min(100, Math.max(10, s.RAM.Load + Math.random() * 4 - 2));
    s.CPU.Temperature = Math.min(95, Math.max(40, s.CPU.Temperature + Math.floor(Math.random() * 6 - 3)));
    s.GPU.Temperature = Math.min(90, Math.max(40, s.GPU.Temperature + Math.floor(Math.random() * 4 - 2)));

    setTimeout(() => broadcastToListeners({ type: 'stats', data: s }), 50);
  }

  if (msg === 'specs-get' || msg === 'get-specs' || msg === 'request-specs') {
    setTimeout(() => {
      (window as any).__tfySpecs = demoSpecs;
      broadcastToListeners({ type: 'specs', data: demoSpecs });
    }, 100);
  }

  // Discord state
  if (msg === 'discord-status') {
    setTimeout(() => broadcastToListeners({
      type: 'discord',
      data: { connected: true, username: 'TFY Developer', Username: 'TFY Developer', avatarUrl: '' },
    }), 100);
  }

  // Update check
  if (msg === 'update-check') {
    console.log('[MockWebView] Update check (mock: no updates)');
  }

  // Debloater
  if (msg === 'scan-apps' || msg === 'debloater-scan') {
    setTimeout(() => broadcastToListeners({
      type: 'debloater',
      action: 'apps',
      data: [
        { Name: 'Microsoft Edge', Publisher: 'Microsoft Corporation', Type: 'Desktop', CanRemove: true },
        { Name: 'OneDrive', Publisher: 'Microsoft Corporation', Type: 'Desktop', CanRemove: true },
        { Name: 'Cortana', Publisher: 'Microsoft Corporation', Type: 'Store', CanRemove: true },
        { Name: 'Xbox Game Bar', Publisher: 'Microsoft Corporation', Type: 'Store', CanRemove: false },
        { Name: 'Phone Link', Publisher: 'Microsoft Corporation', Type: 'Store', CanRemove: true },
        { Name: 'Feedback Hub', Publisher: 'Microsoft Corporation', Type: 'Store', CanRemove: true },
      ],
    }), 200);
  }

  // Notify for any action-type messages
  if (msg.startsWith('apply-') || msg.startsWith('run-') || msg.startsWith('tweak-') || msg.startsWith('clean-files')) {
    setTimeout(() => broadcastToListeners({
      type: 'notify',
      data: { kind: 'success', title: 'Action Executed', message: `Simulated action: ${msg}`, duration: 3000 },
    }), 300);
  }
}

export function installMockWebView() {
  if ((window as any).chrome?.webview) {
    console.log('[MockWebView] Real WebView2 detected — skipping mock.');
    return;
  }

  console.log(
    '%c[TFY UI Mockup]%c Running in standalone browser mode with mock IPC',
    'color:#f59e0b;font-weight:bold;font-size:14px',
    'color:#999;font-size:12px'
  );

  (window as any).chrome = {
    webview: {
      postMessage: (msg: any) => {
        const str = typeof msg === 'string' ? msg : JSON.stringify(msg);
        handleMessage(str);
      },
      addEventListener: (_type: string, listener: EventListener) => {
        listeners.push(listener);
      },
      removeEventListener: (_type: string, listener: EventListener) => {
        const idx = listeners.indexOf(listener);
        if (idx >= 0) listeners.splice(idx, 1);
      },
    },
  };

  // Seed initial data with correct parsed shape
  (window as any).__tfyStats = initialParsedStats;
  (window as any).__tfyLastGoodStats = initialParsedStats;
  (window as any).__tfySpecs = demoSpecs;
  (window as any).__tfyDiscordName = "TFY Developer";
  (window as any).__tfyTempHistory = {
    cpu: Array(60).fill(55).map((v, i) => v + Math.sin(i / 5) * 5),
    gpu: Array(60).fill(62).map((v, i) => v + Math.cos(i / 4) * 6),
  };

  // Simulate periodic stats updates
  setInterval(() => {
    handleMessage('get-stats');
  }, 2000);
}
