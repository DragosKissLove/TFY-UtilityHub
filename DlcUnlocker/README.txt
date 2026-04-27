DLC Unlocker - SmokeAPI / ScreamAPI
===================================

TFY descarcă automat SmokeAPI și ScreamAPI de pe GitHub (release latest) la prima
instalare pe un joc și le păstrează în cache (ProgramData\TFY\DlcUnlockerCache).
Nu este nevoie să copiezi manual DLL-urile.

Opțional, pentru utilizare offline sau versiuni proprii, poți pune DLL-urile aici.
Structură (lângă TFY.exe sau în folderul de build):

  DlcUnlocker/
    SmokeAPI/
      steam_api.dll
      steam_api64.dll
    ScreamAPI/
      EOSSDK-Win32-Shipping.dll
      EOSSDK-Win64-Shipping.dll

Dacă aceste foldere există și conțin fișierele, TFY le folosește în locul cache-ului.
Pentru Steam, DLC-urile sunt puse automat în SmokeAPI.config.json (lista se ia
prin SteamCMD din informațiile jocului).
