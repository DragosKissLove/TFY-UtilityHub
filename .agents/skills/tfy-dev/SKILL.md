---
name: tfy-dev
description: >-
  Comprehensive guide, architecture reference, and development runbook for TFY Utility Hub (TFY Tool).
  Covers the hybrid C# WPF .NET 8 WebView2 host, React 18 TypeScript frontend, build & packaging pipeline,
  WebView2 IPC message protocol, Debloater optimization engine, Discord RPC & DevTools WebSocket injection,
  SteamWorker SAM achievement unlocker, dark glass UI style guide, and debugging procedures.
---

# TFY Utility Hub (TFY Tool) Development Guide & Knowledge Base

## 1. Project Overview & Architecture

TFY Tool is a high-performance Windows optimization and gaming utility desktop application. It employs a modern hybrid architecture:

```
+-------------------------------------------------------------------------+
|                         TFY Utility Hub Desktop                         |
+-------------------------------------------------------------------------+
|  Frontend: React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons   |
|  (Embedded inside Microsoft Edge WebView2 control)                      |
+-------------------------------------------------------------------------+
                                  |
               JSON IPC via CoreWebView2 Web Messages
             (window.chrome.webview.postMessage / PostWebMessageAsJson)
                                  |
+-------------------------------------------------------------------------+
|  Backend Host: WPF C# .NET 8 (win-x64, Self-Contained)                 |
|  - MainWindow.xaml / MainWindow.xaml.cs (IPC Router & Specs Engine)     |
|  - Services/DebloaterService.cs (Registry App Scanner & Uninstaller)    |
|  - Services/DiscordRpcService.cs (Discord Rich Presence v6.3.2)         |
|  - Scripts/DiscordInjector.cs (WebSocket DevTools Client on Port 9222)   |
|  - Services/RobloxService.cs (Multi-Roblox Mutex Engine)                |
|  - Services/BackupService.cs (System Restore Points & Registry Backups) |
+-------------------------------------------------------------------------+
                                  |
+---------------------------------+---------------------------------------+
|  SteamWorker (.NET 8 Win-x64)   |  TFY.Installer (.NET 8 Win-x64)       |
|  SAM P/Invoke NativeWrapper for |  Custom Self-Extracting Installer     |
|  Achievement & DLC Unlocking    |  Unzips publish.zip to %LocalAppData% |
+---------------------------------+---------------------------------------+
```

---

## 2. Build Pipeline & Packaging Runbook

To produce the production installer (`TFY-Setup-v6.3.2.exe`) on the user's Desktop, follow this exact 2-step procedure:

### Step 1: Compile React Frontend
```powershell
cd "c:\Users\Regele\Desktop\TFY TOOL CSharp\project"
npm run build
```
*Output:* `project/dist/` containing `index.html`, `installer.html`, and bundled JS/CSS assets.

### Step 2: Compile .NET Backend & Assemble Installer
Run the automated build script:
```powershell
cmd /c "C:\Users\Regele\.gemini\antigravity\brain\57668031-e325-4aee-a0ea-bdc6b2d39e6a\scratch\build_only.bat"
```
Or manually execute:
1. `dotnet publish TFY.csproj -c Release -r win-x64 --no-self-contained -o publish`
2. `dotnet publish SteamWorker\SteamWorker.csproj -c Release -r win-x64 --no-self-contained -o publish`
3. Copy `project/dist/*` to `publish/project/dist/`
4. Zip `publish/*` into `TFY.Installer/publish.zip` and `project/dist/*` into `TFY.Installer/dist.zip`
5. `dotnet publish TFY.Installer\TFY.Installer.csproj -c Release -r win-x64 /p:PublishSingleFile=true /p:IncludeNativeLibrariesForSelfExtract=true -o publish_installer`
6. Copy `publish_installer/TFY-Setup-v6.3.2.exe` to `$env:USERPROFILE\Desktop\TFY-Setup-v6.3.2.exe`

> [!IMPORTANT]
> `TFY.csproj` has `<GenerateAssemblyInfo>false</GenerateAssemblyInfo>`, which causes reflection assembly version to be `0.0.0.0`. Version strings must always be explicitly hardcoded as `"6.3.2"`.

---

## 3. WebView2 Inter-Process Communication (IPC) Protocol

The frontend communicates with C# through `window.chrome.webview.postMessage(stringMessage)`.
The backend replies via `webView.CoreWebView2.PostWebMessageAsJson(jsonPayload)`.

### Message Formats & Channels:

| Message Channel / Command | Direction | Description |
| :--- | :--- | :--- |
| `debloater-list` | Frontend $\to$ Backend | Requests cached apps list immediately. |
| `debloater-refresh` | Frontend $\to$ Backend | Forces re-scan of Desktop, Store, and Startup apps. |
| `debloater-uninstall\|{items, deepClean}` | Frontend $\to$ Backend | Triggers quiet or deep uninstall for selected applications. |
| `startup-toggle\|{id, name, path, enable}` | Frontend $\to$ Backend | Toggles startup entry in registry or startup folder. |
| `startup-disable\|{items}` | Frontend $\to$ Backend | Disables selected startup applications. |
| `discord-inject` | Frontend $\to$ Backend | Injects custom client script into Discord via WebSocket DevTools. |
| `steam-unlock\|{appId, achievementIds}` | Frontend $\to$ Backend | Spawns SteamWorker with SAM wrappers to unlock achievements. |
| `backups-list` / `backups-create` | Frontend $\to$ Backend | Lists or creates Windows System Restore Points. |
| `specs` | Backend $\to$ Frontend | Pushes real-time CPU, GPU, RAM, temps & hardware metrics. |
| `premium` / `testing` | Backend $\to$ Frontend | Transmits user license & testing permissions flags. |

---

## 4. Subsystem Architectural Details

### 4.1. Debloater Engine (`Services/DebloaterService.cs` & `MainWindow.xaml.cs`)
- **Desktop Apps Scan:** Reads Uninstall registry keys (`HKLM` & `HKCU` 32-bit and 64-bit) in pure C# in parallel with in-memory icon & size caches. Takes **<30ms**.
- **Startup Apps Scan:** Scans `Run` and `RunOnce` registry keys and Startup folders (`shell:startup`, `shell:common startup`). Pure C# Registry APIs taking **<5ms**.
- **Store Apps Scan:** Executes single hidden PowerShell query:
  `powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -Command "Get-AppxPackage -PackageTypeFilter Main -AllUsers | ..."`
- **Incremental Fast Caching:** `PreloadDebloaterAsync()` posts Desktop and Startup apps **immediately** to the frontend within 50ms, then posts full results once Store apps finish scanning.
- **Frontend Memory Cache:** `cachedDebloaterApps` in `Debloater.tsx` ensures navigating to the Debloater tab is **0ms instant**.

### 4.2. Discord DevTools WebSocket Injection (`Scripts/DiscordInjector.cs`)
- **Non-Restart Injection:** Checks if `http://127.0.0.1:9222/json` is already active. If active, connects via WebSocket and injects JavaScript **instantly in <100ms without killing or restarting Discord**.
- If port 9222 is closed, restarts Discord once with `--remote-debugging-port=9222` flag.
- **RPC Version:** `DiscordRpcService.cs` reports version `"6.3.2"`.

### 4.3. SteamWorker SAM Integration (`SteamWorker/`)
- Utilizes Gibbed's SteamAchievementManager native P/Invoke wrapper over `steamclient.dll`.
- Creates native IPC pipe connection to running Steam instance, obtains `ISteamUserStats013` and `ISteamClient018` interfaces.
- Interacts with game statistics and achievements for both installed and non-installed games owned by the authenticated user.

---

## 5. UI Style Guide & Theming Principles

The TFY UI is built on a dark, sleek, frosted glass aesthetic:
- **Active Theme Color:** Dynamic CSS variable `var(--accent)` (default emerald/cyan/purple depending on active user theme).
- **Tab & Control Buttons:**
  - Standard button size: Compact `px-3 py-1.5 rounded-lg text-xs font-medium`.
  - Inactive state: `bg-white/[0.03] text-gray-400 border border-white/5 hover:text-white hover:bg-white/[0.06]`.
  - Active state: `bg-white/10 text-white border border-white/20 shadow-sm` with `text-accent` icon.
  - **NEVER use bright neon pink glows** (`shadow-[0_0_15px_-3px_var(--accent)]` or `border-accent/40`) on large boxes unless explicitly requested. Keep the aesthetic dark, frosted, and subtle.
- **Dropdown Menus:**
  - Background must be solid dark: `#0a0d14` with `border: 1px solid color-mix(in srgb, var(--accent) 30%, rgba(255, 255, 255, 0.15))`.
  - High `z-index` (`z-[9999]`) and solid opacity (`opacity: 1`) to prevent bleeding from elements underneath.
  - Each dropdown item must be an explicit button card with `cursor-pointer`, distinct hover styling, and clear icon/checkmark feedback.
