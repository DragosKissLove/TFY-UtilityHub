# Ghid de Update & Lansare Versiuni Noi — TFY Utility Hub

Acest ghid detaliază pas cu pas toate fișierele și variabilele pe care trebuie să le modifici de fiecare dată când lansezi o versiune nouă a aplicației (de exemplu, de la `6.2.8` la `6.2.9`).

---

## 🛠️ Pasul 1: Actualizarea Versiunii în Proiect (5 Locații)

Trebuie să actualizezi numărul versiunii atât în backend-ul de C#, cât și în frontend-ul de React.

### 1. C# Metadata (`TFY.csproj`)
Deschide [TFY.csproj](file:///c:/Users/Regele/Desktop/TFY%20TOOL%20CSharp/TFY.csproj) și modifică versiunea:
* **Linia 13**: `<Version>6.3.2</Version>`

### 2. Frontend Metadata (`project/package.json`)
Deschide [package.json](file:///c:/Users/Regele/Desktop/TFY%20TOOL%20CSharp/project/package.json) și modifică câmpul version:
* **Linia 4**: `"version": "6.3.2"`

### 3. Ecranul de Încărcare (`project/src/App.tsx`)
Deschide [App.tsx](file:///c:/Users/Regele/Desktop/TFY%20TOOL%20CSharp/project/src/App.tsx) și actualizează versiunea afișată pe ecranul de pornire (loading screen):
* **Linia 374**: `v6.3.2 &middot; Loading`

### 4. Discord RPC Fallback (`Services/DiscordRpcService.cs`)
Deschide [DiscordRpcService.cs](file:///c:/Users/Regele/Desktop/TFY%20TOOL%20CSharp/Services/DiscordRpcService.cs) și actualizează versiunea de siguranță returnată în caz de eroare la citirea metadatelor:
* **Linia 115**: `return "6.3.2";` (în interiorul metodei `GetAppVersion()`)

### 5. HTTP User-Agent Backend (`MainWindow.xaml.cs`)
Deschide [MainWindow.xaml.cs](file:///c:/Users/Regele/Desktop/TFY%20TOOL%20CSharp/MainWindow.xaml.cs) și actualizează string-ul de User-Agent trimis la descărcarea patch-urilor:
* **Linia 2700**: `client.DefaultRequestHeaders.Add("User-Agent", "TFY-Utility-Hub/v6.3.2");`

---

## 📝 Pasul 2: Actualizarea Changelog-ului din Dashboard ("What's New")

Deschide [Home.tsx](file:///c:/Users/Regele/Desktop/TFY%20TOOL%20CSharp/project/src/pages/Home.tsx). Trebuie să adaugi noul set de modificări la **începutul** listei pentru toate limbile suportate:

1. **English**: Adaugă la începutul `whatsNewItemsEn` (în jurul liniei 87)
2. **Română**: Adaugă la începutul `whatsNewItemsRo` (în jurul liniei 233)
3. **Germană**: Adaugă la începutul `whatsNewItemsDe` (în jurul liniei 379)
4. **Spaniolă**: Adaugă la începutul `whatsNewItemsEs` (în jurul liniei 430)
5. **Franceză**: Adaugă la începutul `whatsNewItemsFr` (în jurul liniei 481)

**Formatul obiectului:**
```typescript
  {
    version: 'vX.Y.Z',
    type: 'Patch', // Tipuri posibile: Minor | Major | Patch | Theme | Hotfix | UX | Perf | Security
    date: 'Jun 12, 2026', // Data lansării
    items: [
      'Descrierea pe scurt a noutăților introduse.',
    ],
  },
```

---

## 💬 Pasul 3: Actualizarea Notelor din Pop-up-ul de Update (`UpdateModal.tsx`)

Când utilizatorii primesc notificarea de update în aplicație, acest pop-up le arată detaliile actualizării.
Deschide [UpdateModal.tsx](file:///c:/Users/Regele/Desktop/TFY%20TOOL%20CSharp/project/src/components/UpdateModal.tsx) și adaugă traducerea noutăților în metoda `getRealReleaseNotes`:

* **Adaugă block-ul `if (v === 'X.Y.Z')`** chiar la începutul funcției (înainte de versiunea anterioară):
```typescript
        if (v === 'X.Y.Z') {
            if (lang === 'ro') {
                return [
                    'Traducerea noutăților în limba română (ex: Am rezolvat problemele la DLC Unlocker...).'
                ];
            }
            return [
                'The English version of the release notes...'
            ];
        }
```

---

## 📢 Pasul 4: Actualizarea Anunțului pe Discord Bot

Dacă folosești bot-ul automat pentru a anunța pe canalul de Discord:
Deschide [TFY_Release_Announcer.py](file:///c:/Users/Regele/Desktop/TFY%20TOOL%20CSharp/TFY_Release_Announcer.py) și actualizează:
* **Linia 22**: Versiunea din titlul embed-ului (`*Version: vX.Y.Z*`)
* **Linia 35**: Bullet point-urile cu noutățile din changelog
* **Linia 49**: Linkul butonului de descărcare de pe GitHub Releases: `https://github.com/DragosKissLove/TFY-UtilityHub-Releases/releases/download/vX.Y.Z/TFY-UtilityHub-Setup.exe`

> [!NOTE]
> **Butonul Discord Rich Presence (RPC) "Get The App"**
> Butonul RPC configurat în [DiscordRpcService.cs](file:///c:/Users/Regele/Desktop/TFY%20TOOL%20CSharp/Services/DiscordRpcService.cs) folosește linkul dinamic:
> `https://github.com/DragosKissLove/TFY-UtilityHub-Releases/releases/latest`
> **NU** trebuie să schimbi acest link la fiecare update! GitHub va redirecționa automat utilizatorii către ultima versiune lansată pe contul tău.

---

## 🚀 Pasul 5: Compilarea și Lansarea

Ai la dispoziție două metode de a compila aplicația:

### Opțiunea A: Compilare Locală (Doar pe Desktop-ul tău pentru testare)
Pentru a testa installer-ul fără a schimba nimic în producție, rulează în PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File .\build_local.ps1
```
*Acest script va compila UI-ul, va compila proiectul .NET C#, va genera pachetul cu Velopack și va pune executabilul `TFY-Setup-vX.Y.Z.exe` direct pe Desktop-ul tău.*

### Opțiunea B: Publicare Oficială în Producție (GitHub + Firebase Hosting)
Când ești gata să trimiți update-ul tuturor utilizatorilor tăi, rulează din terminal sau dă dublu-click pe:
```cmd
Build-Installer.bat
```
*Acest script va executa următoarele acțiuni automate:*
1. Compilează React UI-ul.
2. Compilează backend-ul .NET C# în modul Release.
3. Împachetează versiunea cu Velopack.
4. Încarcă noile fișiere UI pe Firebase Hosting.
5. Creează un release nou pe contul tău de GitHub (`DragosKissLove/TFY-UtilityHub-Releases`) sub tagul `vX.Y.Z` și uploadează automat fișierele `.exe`, `.nupkg` și fișierul `RELEASES` necesar pentru auto-update.
6. Copiază installer-ul pe Desktop-ul tău pentru o ultimă verificare.
