# 🚀 Master Guide: Dezvoltare, Update & Colaborare — TFY Utility Hub

Acest ghid este documentul complet de referință pentru tine și echipa ta. El explică cum este structurat **întregul proiect**, cum adaugi funcții noi în orice modul (C#, React, Steam, Roblox, Tweaks), cum schimbi versiunea, cum faci backup-uri ultra-ușoare și cum publici update-urile oficiale în producție.

---

## 🗺️ 1. Harta & Structura Completă a Proiectului

Proiectul TFY Utility Hub este o arhitectură hibridă de performanță înaltă:
- **Host & Core**: C# .NET 8 WPF cu WebView2 (`TFY.csproj`, `MainWindow.xaml.cs`)
- **Interfață Utilizator**: React 18, TypeScript, Tailwind CSS, Vite (`project/`)
- **Worker Nativ**: C# .NET 8 x86/x64 Steam Client P/Invoke (`SteamWorker/`)
- **Setup & Installer Personalizat**: C# .NET 8 WPF Single-File Self-Extracting (`TFY.Installer/`)
- **Bot Discord**: Node.js Discord.js v14 (`bot/`)

```
TFY TOOL CSharp/
├── TFY.csproj                 # Configurație .NET 8 host, versiune, referințe NuGet
├── TFY.sln                    # Soluția Visual Studio completă
├── MainWindow.xaml            # Fereastră WPF fără margini, suport Mica/Dark Glass
├── MainWindow.xaml.cs         # Dispecerul central de mesaje IPC WebView2 (peste 3000 linii)
│
├── Services/                  # TOATE serviciile modulare de backend C#
│   ├── RobloxService.cs       # Mutex bypass, FastFlags mixer, charts 16:9, Passive Rejoin
│   ├── DebloaterService.cs    # Pure C# Windows Registry scanning (<50ms), Store & Startup apps
│   ├── DiscordRpcService.cs   # Discord Rich Presence (RPC) & buton dinamic către Release
│   ├── DiscordAuthService.cs  # OAuth2 Discord direct API (fără server intermediar)
│   ├── SteamUnlockerService.cs# Orchestrează SteamWorker.exe pentru realizări
│   ├── MediaDownloaderService.cs# Descărcare video/audio HD/4K cu yt-dlp & FFmpeg
│   ├── HardwareMonitorService.cs# Monitorizare temperaturi CPU/GPU, frecvențe, RAM
│   ├── GamingTweaksService.cs # Optimizări GPU Nvidia/AMD, DDU, profiluri NIP, Process Lasso
│   ├── SystemTweaksService.cs # Setări de performanță Windows, servicii, rețea, telemetrie
│   ├── BackupsService.cs      # Creare puncte de restaurare sistem Windows (System Restore)
│   ├── FixesService.cs        # Reparații rapide sistem (SFC, DISM, DLL, DirectX)
│   └── ThemeService.cs        # Gestionare culori și teme Windows
│
├── SteamWorker/               # SAM (Steam Achievement Manager) Native Interface
│   ├── SteamWorker.csproj     # Sub-proiect compilat nativ x64
│   ├── NativeSteamClient.cs   # Interfață directă P/Invoke către steamclient.dll
│   └── Program.cs             # Proces worker de fundal pentru jocuri nelansate
│
├── TFY.Installer/             # Noul installer modern C# WPF
│   ├── TFY.Installer.csproj   # Compilat în TFY-Setup-vX.Y.Z.exe single-file
│   ├── MainWindow.xaml.cs     # Interfață modernă de instalare și progres
│   └── app.manifest           # Cerere drepturi Administrator (requireAdministrator)
│
├── project/                   # Frontend-ul aplicației (React 18 + Vite)
│   ├── package.json           # Dependențe React, Lucide, Tailwind, scripturi de build
│   ├── vite.config.ts         # Configurație bundler Vite cu suport Tauri/WebView2
│   ├── src/
│   │   ├── App.tsx            # Ruterul principal, ecran de încărcare, tour ghidat
│   │   ├── index.css          # Teme dark glass, variabile --accent, slider drag, scrollbars
│   │   ├── pages/             # Paginile individuale ale aplicației:
│   │   │   ├── Home.tsx       # Dashboard, statistici sistem, ce este nou (What's New)
│   │   │   ├── MultiRoblox.tsx# Conturi Roblox, Passive Rejoin, Charts 16:9, Mixer volum
│   │   │   ├── Debloater.tsx  # Dezinstalare aplicații Windows și servicii telemetrie
│   │   │   ├── GamingTweaks.tsx# Optimizări gaming, DDU, Cleanstall, Timer Resolution
│   │   │   ├── SystemTweaks.tsx# Optimizări Windows, reg tweaks, planuri de alimentare
│   │   │   ├── Downloads.tsx  # Catalog jocuri și softuri gratuite
│   │   │   ├── Backups.tsx    # Manager puncte de restaurare
│   │   │   ├── Fixes.tsx      # Reparații rapide Windows
│   │   │   └── Settings.tsx   # Teme de culori, limbă, actualizări, profil utilizator
│   │   ├── components/        # Componente reutilizabile (Modale, carduri, controale)
│   │   ├── data/              # downloads.json (biblioteca de descărcări)
│   │   └── lib/i18n.ts        # Traduceri în 5 limbi (Română, Engleză, Germană, Spaniolă, Franceză)
│   └── public/
│       └── data/games.json    # Baza de date a catalogului de jocuri (4.2 MB)
│
├── Backups/                   # Arhivele automate compacte de backup (.zip sub 25MB)
├── Releases/                  # Pachetele de lansare compilate (.exe, .nupkg, RELEASES)
├── scripts/
│   └── backup_version.ps1     # Scriptul automat de backup rapid
├── New-VersionBackup.bat      # Scurtătură 1-click pentru backup înainte de editare
└── Build-Installer.bat        # Scriptul complet de compilare și publicare în producție
```

---

## 🛠️ 2. Cum faci modificări în Proiect (Ghid Colaborare)

### A. Cum modifici Interfața (Frontend React)
1. Deschide un terminal în folderul `project`:
   ```bash
   cd project
   npm run dev
   ```
2. Deschide link-ul local afișat în browser (ex: `http://localhost:5173`) pentru a edita cu **Hot Module Replacement (schimbările apar instant fără restart)**.
3. Când editezi stilurile:
   - Folosește mereu variabila dinamică `var(--accent)` pentru culorile de accent (pentru ca tema aleasă de utilizator în Settings să se aplice automat).
   - Păstrează stilul **Dark Frosted Glass** (`bg-white/[0.03]`, `border-white/10`, `text-white`).
   - Folosește clasa `.badge-dark-glass` pentru etichete cu contrast puternic.

### B. Cum modifici Backend-ul C# (Logică de Sistem & Servicii)
1. Deschide `TFY.sln` în **Visual Studio 2022**.
2. Toate funcțiile de sistem sunt împărțite logic în folderul `Services/`:
   - Vrei să adaugi o setare de Roblox? -> modifică `Services/RobloxService.cs`.
   - Vrei să optimizezi scanarea de debloat? -> modifică `Services/DebloaterService.cs`.
   - Vrei o setare nouă de Windows? -> modifică `Services/SystemTweaksService.cs`.
3. Rulează cu **F5** pentru a testa backend-ul legat cu frontend-ul.

### C. Cum comunici între React și C# (Protocolul IPC WebView2)
Pentru a trimite o comandă din React în C#:
```typescript
// În React (ex: MultiRoblox.tsx):
if (window.chrome && window.chrome.webview) {
    window.chrome.webview.postMessage("comanda-mea:parametru");
}
```
Pentru a recepționa comanda în C#:
1. Deschide `MainWindow.xaml.cs` în metoda `OnWebMessageReceived`.
2. Adaugă un nou caz:
```csharp
else if (rawMessage.StartsWith("comanda-mea:"))
{
    string param = rawMessage.Substring("comanda-mea:".Length);
    // Execuți logica ta C#...
    
    // Dacă vrei să trimiți răspuns înapoi în React:
    await PostJsonToWebAsync(new { type = "comanda_finalizata", status = "ok" });
}
```

---

## 🔢 3. Cum lansezi o Versiune Nouă (Version Bumping)

Când tu și prietenii tăi ați terminat modificările și vreți să lansați o versiune nouă (de exemplu de la `6.3.2` la `6.3.3`):

### Cele 5 Fișiere ce trebuie actualizate:

1. **`TFY.csproj` (Linia 13)**:
   ```xml
   <Version>6.3.3</Version>
   ```
2. **`project/package.json` (Linia 4)**:
   ```json
   "version": "6.3.3"
   ```
3. **`project/src/App.tsx` (în jur de Linia 374)**:
   ```tsx
   v6.3.3 &middot; Loading
   ```
4. **`Services/DiscordRpcService.cs` (în interiorul `GetAppVersion()`)**:
   ```csharp
   return "6.3.3";
   ```
5. **`MainWindow.xaml.cs` (în User-Agent string)**:
   ```csharp
   client.DefaultRequestHeaders.Add("User-Agent", "TFY-Utility-Hub/v6.3.3");
   ```

### Actualizarea Notelor de Lansare (Changelog):
- Deschide `project/src/pages/Home.tsx` și adaugă noutățile la începutul listelor `whatsNewItemsRo` (pentru Română) și `whatsNewItemsEn` (pentru Engleză):
```typescript
{
  version: 'v6.3.3',
  type: 'Patch', // Tipuri: Minor | Major | Patch | Theme | Hotfix | Perf
  date: 'Sep 11, 2026',
  items: [
    'Am optimizat reconectarea în MultiRoblox.',
    'Am adăugat funcții noi în colaborare cu echipa.',
  ],
},
```

---

## 💾 4. Cum creezi un Backup Compact (sub 25MB)

Înainte de a face schimbări mari sau de a testa cod nou riscant, salvează o versiune locală curată:

1. Dă dublu-click pe:
   ```
   New-VersionBackup.bat
   ```
   *(sau rulează `.\scripts\backup_version.ps1` din terminal)*
2. Utilitarul va crea instant o arhivă completă în `Backups/`:
   `Backups/TFY-SourceBackup-v6.3.3-20260911-120000.zip`
3. **De ce este special acest backup?**
   - Salvează **100% din codul sursă** C#, React, baze de date și config-uri.
   - Exclude automat zecile de mii de fișiere din `node_modules` și folderele de build de 2-3 GB (`bin/`, `obj/`, `publish/`).
   - Rezultatul ocupă doar **~25 MB** pe disk!

---

## 📦 5. Cum compilezi și Publici Update-ul (Pas cu Pas)

Când totul este gata și testat:

### Pasul 1: Salvează și Încarcă Codul pe GitHub (Git Push)
Deschide PowerShell în folderul proiectului și rulează:
```powershell
git add .
git commit -m "Lansare versiune v6.3.3: descriere pe scurt"
git push origin master:main
git push origin master
git tag v6.3.3
git push origin v6.3.3
```
*Astfel, toți prietenii tăi primesc ultimele fișiere imediat când dau `git pull`.*

### Pasul 2: Compilarea Installer-ului de Producție
Rulează din terminal:
```cmd
Build-Installer.bat
```
Acest script va face automat toți pașii în serie:
1. Compilează React UI-ul cu Vite (`npm run build`).
2. Publică aplicația C# WPF și SteamWorker în modul Release x64.
3. Creează resursele zip compacte și compilează `TFY-Setup-v6.3.3.exe`.
4. Încarcă noile fișiere UI pe **Firebase Hosting**.
5. Creează noul release pe GitHub: `https://github.com/DragosKissLove/TFY-UtilityHub-Releases/releases/tag/v6.3.3` și uploadează automat executabilele și fișierele de update.
6. Copiază installer-ul gata de rulare direct pe **Desktop-ul tău**:
   `C:\Users\Regele\Desktop\TFY-Setup-v6.3.3.exe`

---

## 👥 6. Cum colaborează prietenii tăi la proiect

1. **Adăugare ca dezvoltatori**:
   - Mergi pe [GitHub Repo Settings](https://github.com/DragosKissLove/TFY-UtilityHub/settings/access).
   - Apasă pe **Collaborators** -> **Add people** -> adaugă username-urile lor.
2. **Preluare ultimele modificări**:
   - Când un prieten vrea să înceapă lucrul, rulează simplu:
   ```bash
   git pull origin main
   ```
3. **Trimitere modificări**:
   - După ce a modificat și a testat local:
   ```bash
   git add .
   git commit -m "Ce anume am modificat/adaugat"
   git push origin main
   ```

---

## ⚠️ Reguli de Aur pentru Echipă (Best Practices)

1. **Nu commite fișiere mari**:
   - Nu pune niciodată în Git fișiere `.exe`, `.zip`, `.nupkg` sau foldere de compilare (`bin/`, `obj/`, `publish/`). Fișierul `.gitignore` le blochează automat.
2. **Design Unitar Dark Glass**:
   - Păstrează stilul frosted glass elegant, fără lumini neon stridente sau fundaluri opace albe.
3. **Versiunea fixă**:
   - În `TFY.csproj` versiunea este declarată manual (ex: `6.3.3`). Nu lăsa string-uri `0.0.0.0` la compilare.
4. **Verificare înainte de release**:
   - Înainte de a da `Build-Installer.bat`, asigurați-vă că `npm run build` în folderul `project/` nu dă erori de TypeScript.
