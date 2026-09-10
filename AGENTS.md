# TFY Utility Hub (TFY Tool) - Agent Instructions & Project Guidelines

This file is automatically loaded by AI coding assistants working in this repository.

## 🚀 Quick Reference & Essential Rules

1. **Tech Stack**:
   - **Frontend**: React 18, TypeScript, Tailwind CSS, Vite (`project/`)
   - **Backend**: C# WPF .NET 8 (`TFY.csproj`, `MainWindow.xaml.cs`)
   - **Worker**: C# .NET 8 (`SteamWorker/SteamWorker.csproj`)
   - **Installer**: C# .NET 8 (`TFY.Installer/TFY.Installer.csproj`)

2. **Build Process (Must Run in Sequence)**:
   ```powershell
   # 1. Build React
   cd project && npm run build && cd ..

   # 2. Build C# Backend & Package Installer
   cmd /c "C:\Users\Regele\.gemini\antigravity\brain\57668031-e325-4aee-a0ea-bdc6b2d39e6a\scratch\build_only.bat"
   ```
   *Output file:* `$env:USERPROFILE\Desktop\TFY-Setup-v6.3.2.exe`

3. **Version Number**:
   - Current release version: **`6.3.2`**.
   - Because `TFY.csproj` disables auto assembly info generation, reflection version returns `0.0.0.0`. Version must always be explicitly defined as `"6.3.2"` in `DiscordRpcService.cs`, `package.json`, and UI headers.

4. **UI Theming Rules**:
   - Use dynamic CSS variable `var(--accent)` for theme accents.
   - Design language: **Dark Frosted Glass** (`bg-white/[0.03]`, `border-white/10`, `text-white`).
   - Compact button style: `px-3 py-1.5 rounded-lg text-xs font-medium`.
   - **Avoid harsh neon pink glow borders** (`shadow-[0_0_15px_-3px_var(--accent)]`). Prefer subtle dark glass styling with delicate accent icons.
   - Dropdown menus must have solid dark backgrounds (`#0a0d14`), high z-index (`z-[9999]`), and explicit button cards.

5. **Subsystem Architecture**:
   - **Debloater**: Pure C# registry scanning for Desktop & Startup apps in <50ms. Single hidden PowerShell command for Store apps. Incremental cache posting.
   - **Discord DevTools WebSocket**: Injects via WebSocket port 9222 without killing or restarting Discord if port 9222 is active.
   - **SteamWorker**: SAM native P/Invoke wrapper over `steamclient.dll` for achievement management.

For full technical specifications, inspect [.agents/skills/tfy-dev/SKILL.md](file:///c:/Users/Regele/Desktop/TFY%20TOOL%20CSharp/.agents/skills/tfy-dev/SKILL.md).
