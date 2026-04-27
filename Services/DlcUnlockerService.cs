using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Win32;
using Newtonsoft.Json;

namespace TFY.Services
{
    public class DlcUnlockerGame
    {
        public string Platform { get; set; }
        public string Id       { get; set; }
        public string Name     { get; set; }
        public string Path     { get; set; }
        public bool   HasUnlocker { get; set; }
    }

    public static class DlcUnlockerService
    {
        // ── persisted installed paths ────────────────────────────────────────────

        private static string InstalledPathsPath => System.IO.Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TFY", "DlcUnlockerInstalled.json");

        private static HashSet<string> LoadPersisted()
        {
            try
            {
                if (!File.Exists(InstalledPathsPath)) return new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                var list = JsonConvert.DeserializeObject<List<string>>(File.ReadAllText(InstalledPathsPath, Encoding.UTF8));
                var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                if (list != null) foreach (string p in list) { try { set.Add(System.IO.Path.GetFullPath(p.Trim())); } catch { } }
                return set;
            }
            catch { return new HashSet<string>(StringComparer.OrdinalIgnoreCase); }
        }

        private static void SavePersisted(HashSet<string> paths)
        {
            try
            {
                string dir = System.IO.Path.GetDirectoryName(InstalledPathsPath);
                if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
                File.WriteAllText(InstalledPathsPath, JsonConvert.SerializeObject(paths?.ToList() ?? new List<string>()), Encoding.UTF8);
            }
            catch { }
        }

        private static void AddPersisted(string p)   { if (string.IsNullOrWhiteSpace(p)) return; var s = LoadPersisted(); s.Add(System.IO.Path.GetFullPath(p.Trim())); SavePersisted(s); }
        private static void RemovePersisted(string p) { if (string.IsNullOrWhiteSpace(p)) return; var s = LoadPersisted(); s.Remove(System.IO.Path.GetFullPath(p.Trim())); SavePersisted(s); }
        private static bool IsPersisted(string p)     { if (string.IsNullOrWhiteSpace(p)) return false; return LoadPersisted().Contains(System.IO.Path.GetFullPath(p.Trim())); }

        // ── helpers ──────────────────────────────────────────────────────────────

        private static string NormPath(string p) => string.IsNullOrEmpty(p) ? null : System.IO.Path.GetFullPath(p.TrimEnd(System.IO.Path.DirectorySeparatorChar, System.IO.Path.AltDirectorySeparatorChar));

        private static bool FileIn(string dir, string file) => File.Exists(System.IO.Path.Combine(dir, file));

        // Detect game exe architecture (64-bit → true, 32-bit → false)
        private static bool Is64BitGame(string gamePath)
        {
            try
            {
                foreach (string exe in Directory.EnumerateFiles(gamePath, "*.exe", SearchOption.TopDirectoryOnly))
                {
                    string fn = System.IO.Path.GetFileName(exe).ToLowerInvariant();
                    if (fn.Contains("uninst") || fn.Contains("setup") || fn.Contains("install") ||
                        fn.Contains("crash") || fn.Contains("report") || fn.Contains("helper")) continue;
                    try
                    {
                        using var fs = File.OpenRead(exe);
                        using var br = new BinaryReader(fs);
                        fs.Seek(0x3C, SeekOrigin.Begin); int peOffset = br.ReadInt32();
                        fs.Seek(peOffset + 4, SeekOrigin.Begin); ushort machine = br.ReadUInt16();
                        return machine == 0x8664 || machine == 0xAA64; // AMD64 or ARM64
                    }
                    catch { }
                }
            }
            catch { }
            return true; // default assume 64-bit
        }

        // ── Koaloader helper (version.dll + config) ──────────────────────────────

        private static void DeployKoaloader(string gamePath, bool is64bit)
        {
            string src = DlcUnlockerCacheService.GetKoaloaderSourceDir();
            string srcDll = System.IO.Path.Combine(src, is64bit ? "version_x64.dll" : "version_x86.dll");
            // fallback to other bitness if preferred not found
            if (!File.Exists(srcDll))
                srcDll = System.IO.Path.Combine(src, is64bit ? "version_x86.dll" : "version_x64.dll");
            if (File.Exists(srcDll))
                File.Copy(srcDll, System.IO.Path.Combine(gamePath, "version.dll"), true);

            // Koaloader config with auto_load so it finds the unlocker DLL automatically
            string cfg = "{\"logging\":false,\"enabled\":true,\"auto_load\":true,\"targets\":[],\"modules\":[],\"_generated_by\":\"TFY DLC Unlocker\"}";
            File.WriteAllText(System.IO.Path.Combine(gamePath, "Koaloader.config.json"), cfg, Encoding.UTF8);
        }

        private static void RemoveKoaloader(string gamePath)
        {
            foreach (string f in new[] { "version.dll", "Koaloader.config.json" })
            { string p = System.IO.Path.Combine(gamePath, f); if (File.Exists(p)) File.Delete(p); }
        }

        // Check if Koaloader is installed (unlocker DLL present)
        private static bool KoaloaderInstalled(string gamePath) =>
            FileIn(gamePath, "version.dll") && (
                FileIn(gamePath, "UplayR1Unlocker.dll")  || FileIn(gamePath, "UplayR1Unlocker32.dll") ||
                FileIn(gamePath, "UplayR2Unlocker.dll")  || FileIn(gamePath, "UplayR2Unlocker32.dll") ||
                FileIn(gamePath, "Lyptus.dll")           || FileIn(gamePath, "Lyptus32.dll"));

        // ── Steam scanning ───────────────────────────────────────────────────────

        private static string GetSteamInstallPath()
        {
            string p = Registry.GetValue(@"HKEY_LOCAL_MACHINE\SOFTWARE\Valve\Steam", "InstallPath", null) as string;
            p ??= Registry.GetValue(@"HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Valve\Steam", "InstallPath", null) as string;
            return string.IsNullOrEmpty(p) ? null : NormPath(p);
        }

        private static List<string> GetSteamLibraries(string steamPath)
        {
            var list = new List<string>();
            if (string.IsNullOrEmpty(steamPath) || !Directory.Exists(steamPath)) return list;
            string steamApps = System.IO.Path.Combine(steamPath, "steamapps");
            if (!Directory.Exists(steamApps)) return list;
            list.Add(steamApps);
            string vdf = System.IO.Path.Combine(steamApps, "libraryfolders.vdf");
            if (!File.Exists(vdf)) return list;
            try
            {
                string text = File.ReadAllText(vdf, Encoding.UTF8);
                foreach (Match m in Regex.Matches(text, @"""path""\s+""([^""]+)""", RegexOptions.IgnoreCase))
                {
                    string folder = System.IO.Path.Combine(m.Groups[1].Value.Trim(), "steamapps");
                    if (Directory.Exists(folder) && !list.Contains(folder)) list.Add(folder);
                }
            }
            catch { }
            return list;
        }

        private static string VdfVal(string vdf, string key)
        {
            var m = Regex.Match(vdf, "\"" + Regex.Escape(key) + "\"\\s+\"([^\"]*)\"", RegexOptions.IgnoreCase);
            return m.Success && m.Groups.Count > 1 ? m.Groups[1].Value.Trim() : null;
        }

        public static async Task<List<DlcUnlockerGame>> ScanSteamAsync()
        {
            return await Task.Run(() =>
            {
                var games = new List<DlcUnlockerGame>();
                string steamPath = GetSteamInstallPath();
                if (string.IsNullOrEmpty(steamPath)) return games;
                foreach (string lib in GetSteamLibraries(steamPath))
                {
                    try
                    {
                        foreach (string acf in Directory.EnumerateFiles(lib, "*.acf"))
                        {
                            try
                            {
                                string content = File.ReadAllText(acf, Encoding.UTF8);
                                string appId = VdfVal(content, "appid");
                                string name = VdfVal(content, "name");
                                string installdir = VdfVal(content, "installdir");
                                if (string.IsNullOrEmpty(appId) || string.IsNullOrEmpty(installdir)) continue;
                                string gameDir = NormPath(System.IO.Path.Combine(lib, "common", installdir));
                                if (!Directory.Exists(gameDir)) continue;
                                if (games.Any(g => g.Id == appId && string.Equals(g.Path, gameDir, StringComparison.OrdinalIgnoreCase))) continue;

                                bool has64Backup = FileIn(gameDir, "steam_api64_o.dll");
                                bool has32Backup = FileIn(gameDir, "steam_api_o.dll");
                                bool has64 = FileIn(gameDir, "steam_api64.dll");
                                bool has32 = FileIn(gameDir, "steam_api.dll");
                                // Koaloader mode detection: smoke_api64.dll alongside original
                                bool hasKoaloader = FileIn(gameDir, "smoke_api64.dll") || FileIn(gameDir, "smoke_api.dll");
                                bool hasUnlocker = (has64Backup && has64) || (has32Backup && has32) || hasKoaloader;

                                games.Add(new DlcUnlockerGame
                                {
                                    Platform = "Steam", Id = appId,
                                    Name = name ?? installdir, Path = gameDir, HasUnlocker = hasUnlocker
                                });
                            }
                            catch { }
                        }
                    }
                    catch { }
                }
                return games;
            });
        }

        // ── Epic scanning ────────────────────────────────────────────────────────

        private static string GetEpicManifestsPath()
        {
            string path =
                Registry.GetValue(@"HKEY_CURRENT_USER\Software\Epic Games\EOS", "ModSdkMetadataDir", null) as string ??
                Registry.GetValue(@"HKEY_CURRENT_USER\Software\Wow6432Node\Epic Games\EOS", "ModSdkMetadataDir", null) as string ??
                Registry.GetValue(@"HKEY_LOCAL_MACHINE\SOFTWARE\Epic Games\EpicGamesLauncher", "AppDataPath", null) as string ??
                Registry.GetValue(@"HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Epic Games\EpicGamesLauncher", "AppDataPath", null) as string;
            if (string.IsNullOrEmpty(path)) return null;
            if (path.EndsWith("Data", StringComparison.OrdinalIgnoreCase)) path = System.IO.Path.Combine(path, "Manifests");
            return path;
        }

        public static async Task<List<DlcUnlockerGame>> ScanEpicAsync()
        {
            return await Task.Run(() =>
            {
                var games = new List<DlcUnlockerGame>();
                string manifestsPath = GetEpicManifestsPath();
                if (string.IsNullOrEmpty(manifestsPath) || !Directory.Exists(manifestsPath)) return games;
                try
                {
                    foreach (string file in Directory.EnumerateFiles(manifestsPath, "*.item"))
                    {
                        try
                        {
                            var doc = Newtonsoft.Json.Linq.JObject.Parse(File.ReadAllText(file, Encoding.UTF8));
                            string catalogId = doc["CatalogItemId"]?.ToString();
                            string mainId = doc["MainGameCatalogItemId"]?.ToString();
                            string installLocation = doc["InstallLocation"]?.ToString();
                            string displayName = doc["DisplayName"]?.ToString();
                            string appName = doc["AppName"]?.ToString();

                            if (string.IsNullOrEmpty(installLocation) || !Directory.Exists(installLocation)) continue;
                            // Only main games: main game has catalogId == mainId, or mainId is null/empty
                            if (!string.IsNullOrEmpty(mainId) && !string.IsNullOrEmpty(catalogId) &&
                                !string.Equals(catalogId, mainId, StringComparison.OrdinalIgnoreCase)) continue;

                            string fullPath = NormPath(installLocation);
                            bool eosBackup = FileIn(fullPath, "EOSSDK-Win64-Shipping_o.dll") || FileIn(fullPath, "EOSSDK-Win32-Shipping_o.dll");
                            bool eosDll = FileIn(fullPath, "EOSSDK-Win64-Shipping.dll") || FileIn(fullPath, "EOSSDK-Win32-Shipping.dll");
                            bool hasUnlocker = eosBackup && eosDll;

                            games.Add(new DlcUnlockerGame
                            {
                                Platform = "Epic",
                                Id = catalogId ?? appName ?? "",
                                Name = displayName ?? System.IO.Path.GetFileName(fullPath),
                                Path = fullPath, HasUnlocker = hasUnlocker
                            });
                        }
                        catch { }
                    }
                }
                catch { }
                return games;
            });
        }

        // ── Ubisoft Connect scanning ─────────────────────────────────────────────

        public static async Task<List<DlcUnlockerGame>> ScanUbisoftAsync()
        {
            return await Task.Run(() =>
            {
                var games = new List<DlcUnlockerGame>();
                string[] regPaths =
                {
                    @"SOFTWARE\WOW6432Node\Ubisoft\Launcher\Installs",
                    @"SOFTWARE\Ubisoft\Launcher\Installs",
                    @"SOFTWARE\WOW6432Node\Ubisoft Connect\Installs",
                };
                var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (string regPath in regPaths)
                {
                    try
                    {
                        using var key = Registry.LocalMachine.OpenSubKey(regPath);
                        if (key == null) continue;
                        foreach (string appId in key.GetSubKeyNames())
                        {
                            try
                            {
                                using var gameKey = key.OpenSubKey(appId);
                                string installDir = gameKey?.GetValue("InstallDir") as string;
                                if (string.IsNullOrEmpty(installDir)) continue;
                                string fullPath = NormPath(installDir);
                                if (string.IsNullOrEmpty(fullPath) || !Directory.Exists(fullPath)) continue;
                                if (!seen.Add(fullPath.ToUpperInvariant())) continue;

                                // Detect R1 or R2
                                bool isR1 = FileIn(fullPath, "uplay_r1_loader64.dll") || FileIn(fullPath, "uplay_r1_loader.dll");
                                bool isR2 = FileIn(fullPath, "uplay_r2_loader64.dll");
                                if (!isR1 && !isR2) continue; // Skip non-Ubisoft games in launcher

                                bool hasUnlocker = KoaloaderInstalled(fullPath) || IsPersisted(fullPath);
                                // Derive name from folder
                                string name = System.IO.Path.GetFileName(fullPath.TrimEnd(System.IO.Path.DirectorySeparatorChar));

                                games.Add(new DlcUnlockerGame
                                {
                                    Platform = isR1 ? "Ubisoft R1" : "Ubisoft R2",
                                    Id = appId, Name = name, Path = fullPath, HasUnlocker = hasUnlocker
                                });
                            }
                            catch { }
                        }
                    }
                    catch { }
                }
                return games;
            });
        }

        // ── EA App scanning ──────────────────────────────────────────────────────

        public static async Task<List<DlcUnlockerGame>> ScanEaAsync()
        {
            return await Task.Run(() =>
            {
                var games = new List<DlcUnlockerGame>();
                var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                void TryAddFromDir(string installDir, string name)
                {
                    if (string.IsNullOrEmpty(installDir)) return;
                    string fullPath = NormPath(installDir);
                    if (string.IsNullOrEmpty(fullPath) || !Directory.Exists(fullPath)) return;
                    if (!seen.Add(fullPath.ToUpperInvariant())) return;
                    bool hasUnlocker = (FileIn(fullPath, "version.dll") && FileIn(fullPath, "Lyptus.dll")) || IsPersisted(fullPath);
                    games.Add(new DlcUnlockerGame
                    {
                        Platform = "EA", Id = fullPath, Name = name ?? System.IO.Path.GetFileName(fullPath),
                        Path = fullPath, HasUnlocker = hasUnlocker
                    });
                }

                // Registry: HKLM\SOFTWARE\WOW6432Node\EA Games\{GameName} — "Install Dir"
                string[] eaKeys = { @"SOFTWARE\WOW6432Node\EA Games", @"SOFTWARE\EA Games",
                                    @"SOFTWARE\WOW6432Node\Electronic Arts", @"SOFTWARE\Electronic Arts" };
                foreach (string regPath in eaKeys)
                {
                    try
                    {
                        using var key = Registry.LocalMachine.OpenSubKey(regPath);
                        if (key == null) continue;
                        foreach (string gameName in key.GetSubKeyNames())
                        {
                            try
                            {
                                using var gk = key.OpenSubKey(gameName);
                                string installDir = gk?.GetValue("Install Dir") as string
                                    ?? gk?.GetValue("InstallDir") as string
                                    ?? gk?.GetValue("InstallLocation") as string;
                                TryAddFromDir(installDir, gameName);
                            }
                            catch { }
                        }
                    }
                    catch { }
                }

                // EA Desktop manifest folder
                string eaDesktop = System.IO.Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                    "Electronic Arts", "EA Desktop", "Installed Games");
                if (Directory.Exists(eaDesktop))
                {
                    try
                    {
                        foreach (string subDir in Directory.EnumerateDirectories(eaDesktop))
                        {
                            try
                            {
                                // Look for content.json in subdir/__Installer or subdir
                                string contentJson = System.IO.Path.Combine(subDir, "content.json");
                                if (!File.Exists(contentJson))
                                    contentJson = Directory.EnumerateFiles(subDir, "content.json", SearchOption.AllDirectories).FirstOrDefault();
                                if (contentJson == null) continue;
                                var doc = Newtonsoft.Json.Linq.JObject.Parse(File.ReadAllText(contentJson, Encoding.UTF8));
                                string installDir = doc["installDirectory"]?.ToString() ?? doc["InstallDirectory"]?.ToString();
                                string gameName = doc["name"]?.ToString() ?? doc["displayName"]?.ToString();
                                TryAddFromDir(installDir, gameName);
                            }
                            catch { }
                        }
                    }
                    catch { }
                }

                return games;
            });
        }

        // ── Scan all platforms ───────────────────────────────────────────────────

        public static async Task<List<DlcUnlockerGame>> ScanAllAsync()
        {
            var tasks = new[]
            {
                ScanSteamAsync(),
                ScanEpicAsync(),
                ScanUbisoftAsync(),
                ScanEaAsync(),
            };
            var results = await Task.WhenAll(tasks);
            return results.SelectMany(r => r).ToList();
        }

        // ── DLC list (Steam only) ────────────────────────────────────────────────

        public static async Task<List<(string id, string name)>> GetDlcListAsync(string appId)
        {
            var list = new List<(string, string)>();
            if (string.IsNullOrEmpty(appId)) return list;
            try
            {
                await SteamCmdHelper.EnsureSteamCmdAsync();
                var ids = await SteamCmdHelper.GetDlcAppIdsAsync(appId);
                foreach (string id in ids) list.Add((id, "DLC " + id));
            }
            catch { }
            return list;
        }

        // ── Steam install/uninstall ──────────────────────────────────────────────

        public static async Task<(bool ok, string message)> InstallSteamAsync(string gamePath, string appId, List<string> selectedDlcIds = null, bool proxy = true)
        {
            string root = DlcUnlockerCacheService.GetSmokeApiSourceDir();
            string steam64 = System.IO.Path.Combine(gamePath, "steam_api64.dll");
            string steam64O = System.IO.Path.Combine(gamePath, "steam_api64_o.dll");
            string steam32 = System.IO.Path.Combine(gamePath, "steam_api.dll");
            string steam32O = System.IO.Path.Combine(gamePath, "steam_api_o.dll");
            string src64 = System.IO.Path.Combine(root, "steam_api64.dll");
            string src32 = System.IO.Path.Combine(root, "steam_api.dll");
            if (!File.Exists(src64) && !File.Exists(src32))
                return (false, "Lipseste SmokeAPI. Incearca din nou sau pune DLL-urile in DlcUnlocker/SmokeAPI.");

            var dlcIds = selectedDlcIds?.Count > 0 ? selectedDlcIds : new List<string>();
            // Note: SteamCMD is only invoked from GetDlcListAsync (the picker), not here.
            // default_app_status: "unlocked" in the config handles DLC unlock regardless of list.

            try
            {
                if (proxy)
                {
                    // ── Proxy mode: replace steam_api.dll with SmokeAPI ──────────
                    if (File.Exists(steam64) && !File.Exists(steam64O)) File.Move(steam64, steam64O);
                    if (File.Exists(src64)) File.Copy(src64, steam64, true);
                    if (File.Exists(steam32) && !File.Exists(steam32O)) File.Move(steam32, steam32O);
                    if (File.Exists(src32)) File.Copy(src32, steam32, true);
                }
                else
                {
                    // ── Koaloader mode: version.dll + SmokeAPI.dll alongside original ──
                    // Koaloader auto_load scans for "SmokeAPI.dll" — must use that exact name.
                    var (koaOk, koaMsg) = await DlcUnlockerCacheService.EnsureKoaloaderCacheAsync();
                    if (!koaOk) return (false, "Nu s-a putut descărca loader-ul. Verifică conexiunea.");
                    bool is64 = Is64BitGame(gamePath);
                    DeployKoaloader(gamePath, is64);
                    // Place as SmokeAPI.dll — Koaloader auto_load picks this up by name
                    string smokeApiDest = System.IO.Path.Combine(gamePath, "SmokeAPI.dll");
                    if (File.Exists(src64)) File.Copy(src64, smokeApiDest, true);
                    else if (File.Exists(src32)) File.Copy(src32, smokeApiDest, true);
                }

                File.WriteAllText(System.IO.Path.Combine(gamePath, "SmokeAPI.config.json"),
                    BuildSmokeApiConfig(appId, dlcIds), Encoding.UTF8);
                AddPersisted(gamePath);
                return (true, dlcIds.Count > 0 ? $"Instalat cu {dlcIds.Count} DLC-uri." : "Instalat.");
            }
            catch (Exception ex) { return (false, ex.Message); }
        }

        private static string BuildSmokeApiConfig(string appId, List<string> dlcIds)
        {
            var sb = new StringBuilder();
            sb.Append("{\"$version\":2,\"logging\":false,\"unlock_family_sharing\":true,\"default_app_status\":\"unlocked\",\"override_app_status\":{},");
            sb.Append("\"override_dlc_status\":{},\"auto_inject_inventory\":true,\"extra_inventory_items\":[],");
            if (!string.IsNullOrEmpty(appId) && dlcIds?.Count > 0)
            {
                sb.Append("\"extra_dlcs\":{\"").Append(appId).Append("\":{\"dlcs\":{");
                for (int i = 0; i < dlcIds.Count; i++)
                {
                    string id = dlcIds[i];
                    sb.Append("\"").Append(id).Append("\":\"DLC ").Append(id).Append("\"");
                    if (i < dlcIds.Count - 1) sb.Append(",");
                }
                sb.Append("}}},");
            }
            else sb.Append("\"extra_dlcs\":{},");
            sb.Append("\"store_config\":null,\"_generated_by\":\"TFY DLC Unlocker\"}");
            return sb.ToString();
        }

        public static (bool ok, string message) UninstallSteam(string gamePath)
        {
            string steam64 = System.IO.Path.Combine(gamePath, "steam_api64.dll");
            string steam64O = System.IO.Path.Combine(gamePath, "steam_api64_o.dll");
            string steam32 = System.IO.Path.Combine(gamePath, "steam_api.dll");
            string steam32O = System.IO.Path.Combine(gamePath, "steam_api_o.dll");
            try
            {
                if (File.Exists(steam64O)) { if (File.Exists(steam64)) File.Delete(steam64); File.Move(steam64O, steam64); }
                else if (File.Exists(steam64)) File.Delete(steam64);
                if (File.Exists(steam32O)) { if (File.Exists(steam32)) File.Delete(steam32); File.Move(steam32O, steam32); }
                else if (File.Exists(steam32)) File.Delete(steam32);
                foreach (string f in new[] { "SmokeAPI.config.json", "SmokeAPI.json", "SmokeAPI.cache.json", "cream_api.ini" })
                { string p = System.IO.Path.Combine(gamePath, f); if (File.Exists(p)) File.Delete(p); }
                RemovePersisted(gamePath);
                return (true, "Dezinstalat.");
            }
            catch (Exception ex) { return (false, ex.Message); }
        }

        // ── Epic install/uninstall ───────────────────────────────────────────────

        public static (bool ok, string message) InstallEpic(string gamePath)
        {
            string root = DlcUnlockerCacheService.GetScreamApiSourceDir();
            string eos64 = System.IO.Path.Combine(gamePath, "EOSSDK-Win64-Shipping.dll");
            string eos64O = System.IO.Path.Combine(gamePath, "EOSSDK-Win64-Shipping_o.dll");
            string eos32 = System.IO.Path.Combine(gamePath, "EOSSDK-Win32-Shipping.dll");
            string eos32O = System.IO.Path.Combine(gamePath, "EOSSDK-Win32-Shipping_o.dll");
            string src64 = System.IO.Path.Combine(root, "EOSSDK-Win64-Shipping.dll");
            string src32 = System.IO.Path.Combine(root, "EOSSDK-Win32-Shipping.dll");
            if (!File.Exists(src64) && !File.Exists(src32))
                return (false, "Fișierele necesare lipsesc. Încearcă din nou sau verifică conexiunea.");
            try
            {
                if (File.Exists(eos64) && !File.Exists(eos64O)) File.Move(eos64, eos64O);
                if (File.Exists(src64)) File.Copy(src64, eos64, true);
                if (File.Exists(eos32) && !File.Exists(eos32O)) File.Move(eos32, eos32O);
                if (File.Exists(src32)) File.Copy(src32, eos32, true);
                // ScreamAPI v4 config format
                string cfg = "{\"$version\":3,\"logging\":false,\"unlock_achievements\":true,\"log_eos\":false,\"default_dlc_status\":\"unlocked\",\"override_dlc_status\":{},\"extra_entitlements\":[],\"_generated_by\":\"TFY DLC Unlocker\"}";
                File.WriteAllText(System.IO.Path.Combine(gamePath, "ScreamAPI.config.json"), cfg, Encoding.UTF8);
                AddPersisted(gamePath);
                return (true, "Instalat.");
            }
            catch (Exception ex) { return (false, ex.Message); }
        }

        public static (bool ok, string message) UninstallEpic(string gamePath)
        {
            string eos64 = System.IO.Path.Combine(gamePath, "EOSSDK-Win64-Shipping.dll");
            string eos64O = System.IO.Path.Combine(gamePath, "EOSSDK-Win64-Shipping_o.dll");
            string eos32 = System.IO.Path.Combine(gamePath, "EOSSDK-Win32-Shipping.dll");
            string eos32O = System.IO.Path.Combine(gamePath, "EOSSDK-Win32-Shipping_o.dll");
            try
            {
                if (File.Exists(eos64O)) { if (File.Exists(eos64)) File.Delete(eos64); File.Move(eos64O, eos64); }
                else if (File.Exists(eos64)) File.Delete(eos64);
                if (File.Exists(eos32O)) { if (File.Exists(eos32)) File.Delete(eos32); File.Move(eos32O, eos32); }
                else if (File.Exists(eos32)) File.Delete(eos32);
                string cfgPath = System.IO.Path.Combine(gamePath, "ScreamAPI.config.json");
                if (File.Exists(cfgPath)) File.Delete(cfgPath);
                RemovePersisted(gamePath);
                return (true, "Dezinstalat.");
            }
            catch (Exception ex) { return (false, ex.Message); }
        }

        // ── Ubisoft install/uninstall (Koaloader) ────────────────────────────────

        public static async Task<(bool ok, string message)> InstallUbisoftAsync(string gamePath, string platform)
        {
            bool isR1 = platform.IndexOf("R1", StringComparison.OrdinalIgnoreCase) >= 0;
            var (koaOk, koaMsg) = await DlcUnlockerCacheService.EnsureKoaloaderCacheAsync();
            if (!koaOk) return (false, koaMsg);
            var (unlOk, unlMsg) = isR1
                ? await DlcUnlockerCacheService.EnsureUplayR1CacheAsync()
                : await DlcUnlockerCacheService.EnsureUplayR2CacheAsync();
            if (!unlOk) return (false, unlMsg);
            try
            {
                bool is64 = Is64BitGame(gamePath);
                DeployKoaloader(gamePath, is64);

                // Copy the appropriate unlocker DLL
                string srcDir = isR1 ? DlcUnlockerCacheService.GetUplayR1SourceDir() : DlcUnlockerCacheService.GetUplayR2SourceDir();
                string dllName = isR1 ? (is64 ? "UplayR1Unlocker.dll" : "UplayR1Unlocker32.dll")
                                      : (is64 ? "UplayR2Unlocker.dll" : "UplayR2Unlocker32.dll");
                string fallback = isR1 ? (is64 ? "UplayR1Unlocker32.dll" : "UplayR1Unlocker.dll")
                                       : (is64 ? "UplayR2Unlocker32.dll" : "UplayR2Unlocker.dll");
                string srcDll = System.IO.Path.Combine(srcDir, dllName);
                if (!File.Exists(srcDll)) srcDll = System.IO.Path.Combine(srcDir, fallback);
                if (!File.Exists(srcDll)) return (false, $"DLL {dllName} negăsit in cache.");

                string destName = isR1 ? "UplayR1Unlocker.dll" : "UplayR2Unlocker.dll";
                File.Copy(srcDll, System.IO.Path.Combine(gamePath, destName), true);
                AddPersisted(gamePath);
                return (true, "Instalat.");
            }
            catch (Exception ex) { return (false, ex.Message); }
        }

        public static (bool ok, string message) UninstallUbisoft(string gamePath)
        {
            try
            {
                RemoveKoaloader(gamePath);
                foreach (string f in new[] { "UplayR1Unlocker.dll", "UplayR1Unlocker32.dll", "UplayR2Unlocker.dll", "UplayR2Unlocker32.dll" })
                { string p = System.IO.Path.Combine(gamePath, f); if (File.Exists(p)) File.Delete(p); }
                RemovePersisted(gamePath);
                return (true, "Dezinstalat.");
            }
            catch (Exception ex) { return (false, ex.Message); }
        }

        // ── EA install/uninstall (Koaloader + Lyptus) ───────────────────────────

        public static async Task<(bool ok, string message)> InstallEaAsync(string gamePath)
        {
            var (koaOk, koaMsg) = await DlcUnlockerCacheService.EnsureKoaloaderCacheAsync();
            if (!koaOk) return (false, koaMsg);
            var (lypOk, lypMsg) = await DlcUnlockerCacheService.EnsureLyptusCacheAsync();
            if (!lypOk) return (false, lypMsg);
            try
            {
                bool is64 = Is64BitGame(gamePath);
                DeployKoaloader(gamePath, is64);
                string srcDir = DlcUnlockerCacheService.GetLyptusSourceDir();
                string dllName = is64 ? "Lyptus.dll" : "Lyptus32.dll";
                string srcDll = System.IO.Path.Combine(srcDir, dllName);
                if (!File.Exists(srcDll)) srcDll = System.IO.Path.Combine(srcDir, is64 ? "Lyptus32.dll" : "Lyptus.dll");
                if (!File.Exists(srcDll)) return (false, $"Lyptus.dll negăsit in cache.");
                File.Copy(srcDll, System.IO.Path.Combine(gamePath, "Lyptus.dll"), true);
                // Template Lyptus config (game-specific patches not included — advanced use)
                string lypCfg = "{\"logging\":false,\"patches\":[]}";
                File.WriteAllText(System.IO.Path.Combine(gamePath, "Lyptus.json"), lypCfg, Encoding.UTF8);
                AddPersisted(gamePath);
                return (true, "Instalat. Configurează manual Lyptus.json pentru patch-uri specifice jocului.");
            }
            catch (Exception ex) { return (false, ex.Message); }
        }

        public static (bool ok, string message) UninstallEa(string gamePath)
        {
            try
            {
                RemoveKoaloader(gamePath);
                foreach (string f in new[] { "Lyptus.dll", "Lyptus32.dll", "Lyptus.json" })
                { string p = System.IO.Path.Combine(gamePath, f); if (File.Exists(p)) File.Delete(p); }
                RemovePersisted(gamePath);
                return (true, "EA unlocker dezinstalat.");
            }
            catch (Exception ex) { return (false, ex.Message); }
        }

        // ── Router ───────────────────────────────────────────────────────────────

        public static async Task<(bool ok, string message)> InstallAsync(
            string gamePath, string platform, string gameId = null,
            List<string> selectedDlcIds = null, bool proxy = true)
        {
            if (string.Equals(platform, "Steam", StringComparison.OrdinalIgnoreCase))
            {
                var (ok, msg) = await DlcUnlockerCacheService.EnsureSmokeApiCacheAsync();
                if (!ok) return (false, msg);
                return await InstallSteamAsync(gamePath, gameId ?? "", selectedDlcIds, proxy);
            }
            if (string.Equals(platform, "Epic", StringComparison.OrdinalIgnoreCase))
            {
                var (ok, msg) = await DlcUnlockerCacheService.EnsureScreamApiCacheAsync();
                if (!ok) return (false, msg);
                return InstallEpic(gamePath);
            }
            if (platform.StartsWith("Ubisoft", StringComparison.OrdinalIgnoreCase))
                return await InstallUbisoftAsync(gamePath, platform);
            if (string.Equals(platform, "EA", StringComparison.OrdinalIgnoreCase))
                return await InstallEaAsync(gamePath);
            return (false, "Platforma necunoscuta: " + platform);
        }

        public static (bool ok, string message) Uninstall(string gamePath, string platform)
        {
            if (string.Equals(platform, "Steam", StringComparison.OrdinalIgnoreCase)) return UninstallSteam(gamePath);
            if (string.Equals(platform, "Epic", StringComparison.OrdinalIgnoreCase)) return UninstallEpic(gamePath);
            if (platform.StartsWith("Ubisoft", StringComparison.OrdinalIgnoreCase)) return UninstallUbisoft(gamePath);
            if (string.Equals(platform, "EA", StringComparison.OrdinalIgnoreCase)) return UninstallEa(gamePath);
            return (false, "Platforma necunoscuta: " + platform);
        }
    }
}
