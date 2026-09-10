# 🤝 TFY Utility Hub — Ghid de Colaborare & Dezvoltare

Acest ghid este destinat colaboratorilor și prietenilor care lucrează la proiectul **TFY Utility Hub**.

---

## 🚀 1. Cum începi (Setup Colaborator)

### Cerințe de sistem:
- **Windows 10 / 11** (x64)
- **.NET 8.0 SDK** ([Descarcă .NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0))
- **Node.js v18+ & npm** ([Descarcă Node.js](https://nodejs.org/))
- **Git** ([Descarcă Git](https://git-scm.com/))
- **Visual Studio 2022** (cu sarcina de lucru *.NET Desktop Development*) sau **VS Code**

### Clonare proiect:
```bash
git clone https://github.com/DragosKissLove/TFY-UtilityHub.git
cd TFY-UtilityHub
```

### Instalare dependențe React (Frontend):
```bash
cd project
npm install
cd ..
```

---

## 🗄️ 2. Unde sunt stocate Datele & Baza de Date

Proiectul folosește mai multe layere de date pentru viteză maximă și portabilitate:

1. **Baza de date Games & Catalog**:
   - Locație: `project/public/data/games.json`
   - Conține catalogul de jocuri, link-uri magnet, metadate și surse.
2. **Preset-uri & Reguli de Optimizare**:
   - Locație: `project/public/optimizations/processlasso_rules.json` și profilurile GPU `.nip`.
3. **Conturi & Sesiuni MultiRoblox**:
   - Stocate local în WebView2 `localStorage` (`tfy_roblox_ram_accounts`, `tfy_roblox_rejoin_*`).
4. **Discord RPC & Auth Cache**:
   - Stocate local în `%LOCALAPPDATA%\TFY\discord.json`.
   - Permite persistența rolurilor și a tier-ului fără re-autentificare la fiecare lansare.

---

## 🛠️ 3. Rulare în Development

### Modul Rapid (Live Reload):
1. **Pornire server Frontend (React)**:
   ```bash
   cd project
   npm run dev
   ```
2. **Pornire Backend (C# WPF)**:
   - Deschide `TFY.sln` în Visual Studio și apasă **F5** sau din terminal:
   ```bash
   dotnet run --project TFY.csproj
   ```

---

## 💾 4. Sistemul de Backup cu Consum Redus de MB

Pentru a nu încărca discul sau Git-ul cu foldere de compilare grele (de peste 2-3 GB), proiectul include un utilitar automat de backup compact:

### Cum creezi un backup cu 1-Click:
- Dă dublu-click pe fișierul:
  ```
  New-VersionBackup.bat
  ```
- Sau din PowerShell:
  ```powershell
  .\scripts\backup_version.ps1
  ```

### Ce face utilitarul:
- Citește automat versiunea curentă din `TFY.csproj` (ex: `6.3.2`).
- Include **100% din codul sursă** (C#, React, CSS, scripturi, baza de date `games.json`, config-uri).
- Exclude automat toate fișierele temporare, binarele compilate (`bin/`, `obj/`, `publish/`), `node_modules` și executabilele mari.
- Salvează o arhivă `.zip` curată în folderul `Backups/`:
  `Backups/TFY-SourceBackup-v6.3.2-[DATA].zip` (~25 MB în loc de 2000 MB).

---

## 👥 5. Cum adaugi prieteni ca Colaboratori pe GitHub

Pentru a le permite prietenilor să dea `git push` direct:
1. Intră pe GitHub pe repo-ul tău: `https://github.com/DragosKissLove/TFY-UtilityHub`
2. Mergi la tab-ul **Settings** (în dreapta sus).
3. În meniul din stânga, apasă pe **Collaborators**.
4. Apasă pe butonul verde **Add people**.
5. Tastează username-ul de GitHub sau adresa de email a prietenului tău și trimite-i invitația.
6. Odată ce acceptă invitația pe email sau pe GitHub, pot da direct `git push` la noile modificări!

---

## 📦 6. Compilare Installer de Lansare

Când o versiune nouă este gata:
```cmd
Build-Installer.bat
```
Acest script va compila React-ul, va publica aplicația .NET C#, va genera noul installer pe Desktop și poate publica update-ul pe GitHub Releases și Firebase.
