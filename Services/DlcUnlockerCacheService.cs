using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

namespace TFY.Services
{
    public static class DlcUnlockerCacheService
    {
        private static string CacheRoot => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "TFY", "DlcUnlockerCache");

        private static string SmokeApiCacheDir    => Path.Combine(CacheRoot, "SmokeAPI");
        private static string ScreamApiCacheDir   => Path.Combine(CacheRoot, "ScreamAPI");
        private static string KoaloaderCacheDir   => Path.Combine(CacheRoot, "Koaloader");
        private static string UplayR1CacheDir     => Path.Combine(CacheRoot, "UplayR1Unlocker");
        private static string UplayR2CacheDir     => Path.Combine(CacheRoot, "UplayR2Unlocker");
        private static string LyptusCacheDir      => Path.Combine(CacheRoot, "Lyptus");

        private static readonly HttpClient HttpClient = new HttpClient
        {
            Timeout = TimeSpan.FromMinutes(5),
            DefaultRequestHeaders = { { "User-Agent", "TFY-UtilityHub/1.0" } }
        };

        // ── helpers ─────────────────────────────────────────────────────────────

        private static string EntryFileName(ZipArchiveEntry e)
        {
            string n = (e.FullName ?? "").Replace('\\', '/').TrimEnd('/');
            int i = n.LastIndexOf('/');
            return i >= 0 ? n.Substring(i + 1) : n;
        }

        private static bool EntryIsDir(ZipArchiveEntry e) =>
            e.FullName.TrimEnd('/').EndsWith("/") || e.Length == 0;

        private static string LatestZipUrl(JObject release)
        {
            if (release["assets"] is not JArray assets) return null;
            foreach (var a in assets)
                if (a["name"]?.ToString().EndsWith(".zip", StringComparison.OrdinalIgnoreCase) == true)
                    return a["browser_download_url"]?.ToString();
            return null;
        }

        private static async Task<JObject> FetchReleaseAsync(string repo)
        {
            string json = await HttpClient.GetStringAsync(
                new Uri($"https://api.github.com/repos/{repo}/releases/latest"));
            return JObject.Parse(json);
        }

        private static async Task<string> DownloadZipAsync(string url, string prefix)
        {
            byte[] bytes = await HttpClient.GetByteArrayAsync(new Uri(url));
            string path = Path.Combine(Path.GetTempPath(), $"TFY-{prefix}-{Guid.NewGuid():N}.zip");
            await File.WriteAllBytesAsync(path, bytes);
            return path;
        }

        // ── SmokeAPI (Steam) ─────────────────────────────────────────────────────

        public static async Task<(bool ok, string message)> EnsureSmokeApiCacheAsync()
        {
            string api64 = Path.Combine(SmokeApiCacheDir, "steam_api64.dll");
            string api32 = Path.Combine(SmokeApiCacheDir, "steam_api.dll");
            if (File.Exists(api64) || File.Exists(api32)) return (true, "Cache OK.");

            try
            {
                var release = await FetchReleaseAsync("acidicoala/SmokeAPI");
                string zipUrl = LatestZipUrl(release);
                if (string.IsNullOrEmpty(zipUrl)) return (false, "SmokeAPI: arhivă negăsită.");
                string zipPath = await DownloadZipAsync(zipUrl, "SmokeAPI");
                try
                {
                    Directory.CreateDirectory(SmokeApiCacheDir);
                    using var archive = ZipFile.OpenRead(zipPath);
                    ZipArchiveEntry entry64 = null, entry32 = null;
                    foreach (var e in archive.Entries)
                    {
                        if (EntryIsDir(e)) continue;
                        string name = EntryFileName(e);
                        string nl = name.ToLowerInvariant();
                        // smoke_api64.dll  /  SmokeAPI64.dll  /  SmokeAPI.dll (single build)
                        if (nl == "smoke_api64.dll" || nl == "smokeapi64.dll") { entry64 ??= e; continue; }
                        if (nl == "smoke_api32.dll" || nl == "smokeapi32.dll" || nl == "smoke_api.dll") { entry32 ??= e; continue; }
                        if (nl == "smokeapi.dll") { entry64 ??= e; continue; }
                        if (entry64 == null && nl.Contains("smoke") && nl.Contains("64")) { entry64 = e; continue; }
                        if (entry32 == null && nl.Contains("smoke") && (nl.Contains("32") || nl.Contains("86"))) { entry32 = e; continue; }
                        if (entry64 == null && nl.Contains("steam") && nl.Contains("64")) { entry64 = e; continue; }
                        if (entry32 == null && nl.Contains("steam_api") && !nl.Contains("64")) entry32 = e;
                    }
                    if (entry64 != null) entry64.ExtractToFile(api64, true);
                    if (entry32 != null) entry32.ExtractToFile(api32, true);
                    if (entry64 == null && entry32 == null) return (false, "SmokeAPI: fișiere negăsite în arhivă.");
                    return (true, "SmokeAPI descărcat.");
                }
                finally { try { File.Delete(zipPath); } catch { } }
            }
            catch (Exception ex) { return (false, "SmokeAPI eroare: " + ex.Message); }
        }

        // ── ScreamAPI (Epic) ─────────────────────────────────────────────────────

        /// <summary>
        /// Finds a DLL entry in a Koaloader-style zip (proxyName/x64/proxyName.dll or flat).
        /// Bitness = "64" or "32" or "x64" or "x86"
        /// </summary>
        private static ZipArchiveEntry FindDllInZip(ZipArchive archive, string[] nameHints, string bitHint)
        {
            // 1. Exact name + bitness path
            foreach (string hint in nameHints)
            {
                var match = archive.Entries.FirstOrDefault(e =>
                    !EntryIsDir(e) &&
                    string.Equals(EntryFileName(e), hint, StringComparison.OrdinalIgnoreCase) &&
                    e.FullName.Replace('\\', '/').ToLowerInvariant().Contains(bitHint.ToLowerInvariant()));
                if (match != null) return match;
            }
            // 2. Name hint without bitness path requirement
            foreach (string hint in nameHints)
            {
                var match = archive.Entries.FirstOrDefault(e =>
                    !EntryIsDir(e) &&
                    string.Equals(EntryFileName(e), hint, StringComparison.OrdinalIgnoreCase));
                if (match != null) return match;
            }
            // 3. Any DLL in x64/x86 subfolder
            return archive.Entries.FirstOrDefault(e =>
                !EntryIsDir(e) &&
                e.FullName.Replace('\\', '/').ToLowerInvariant().Contains("/" + bitHint.ToLowerInvariant() + "/") &&
                EntryFileName(e).EndsWith(".dll", StringComparison.OrdinalIgnoreCase));
        }

        public static async Task<(bool ok, string message)> EnsureScreamApiCacheAsync()
        {
            string eos64 = Path.Combine(ScreamApiCacheDir, "EOSSDK-Win64-Shipping.dll");
            string eos32 = Path.Combine(ScreamApiCacheDir, "EOSSDK-Win32-Shipping.dll");
            if (File.Exists(eos64) || File.Exists(eos32)) return (true, "Cache OK.");

            try
            {
                var release = await FetchReleaseAsync("acidicoala/ScreamAPI");
                string zipUrl = LatestZipUrl(release);
                if (string.IsNullOrEmpty(zipUrl)) return (false, "ScreamAPI: arhivă negăsită.");
                string zipPath = await DownloadZipAsync(zipUrl, "ScreamAPI");
                try
                {
                    Directory.CreateDirectory(ScreamApiCacheDir);
                    using var archive = ZipFile.OpenRead(zipPath);

                    // ScreamAPI v4+ uses Koaloader-style zip: EOSSDK-Win64-Shipping.dll/x64/EOSSDK-Win64-Shipping.dll
                    string[] hints64 = { "EOSSDK-Win64-Shipping.dll", "scream_api64.dll", "ScreamAPI64.dll", "ScreamAPI.dll" };
                    string[] hints32 = { "EOSSDK-Win32-Shipping.dll", "scream_api32.dll", "scream_api.dll", "ScreamAPI32.dll" };

                    var e64 = FindDllInZip(archive, hints64, "x64");
                    var e32 = FindDllInZip(archive, hints32, "x86");

                    if (e64 != null) e64.ExtractToFile(eos64, true);
                    if (e32 != null) e32.ExtractToFile(eos32, true);
                    if (e64 == null && e32 == null) return (false, "ScreamAPI: fișiere negăsite în arhivă.");
                    return (true, "ScreamAPI descărcat.");
                }
                finally { try { File.Delete(zipPath); } catch { } }
            }
            catch (Exception ex) { return (false, "ScreamAPI eroare: " + ex.Message); }
        }

        // ── Koaloader (proxy DLL injector) ───────────────────────────────────────

        public static async Task<(bool ok, string message)> EnsureKoaloaderCacheAsync()
        {
            string v64 = Path.Combine(KoaloaderCacheDir, "version_x64.dll");
            string v32 = Path.Combine(KoaloaderCacheDir, "version_x86.dll");
            if (File.Exists(v64) || File.Exists(v32)) return (true, "Cache OK.");

            try
            {
                var release = await FetchReleaseAsync("acidicoala/Koaloader");
                string zipUrl = LatestZipUrl(release);
                if (string.IsNullOrEmpty(zipUrl)) return (false, "Koaloader: arhivă negăsită.");
                string zipPath = await DownloadZipAsync(zipUrl, "Koaloader");
                try
                {
                    Directory.CreateDirectory(KoaloaderCacheDir);
                    using var archive = ZipFile.OpenRead(zipPath);
                    // Zip structure: version.dll/x64/version.dll and version.dll/x86/version.dll
                    ZipArchiveEntry found64 = null, found32 = null;
                    foreach (var e in archive.Entries)
                    {
                        if (EntryIsDir(e)) continue;
                        string fn = e.FullName.Replace('\\', '/').ToLowerInvariant();
                        string name = EntryFileName(e).ToLowerInvariant();
                        if (name != "version.dll") continue;
                        // determine bitness by path component
                        if (fn.Contains("/x64/") || fn.Contains("\\x64\\")) { found64 ??= e; }
                        else if (fn.Contains("/x86/") || fn.Contains("\\x86\\")) { found32 ??= e; }
                        else { found64 ??= e; } // assume 64 for unknown
                    }
                    if (found64 != null) found64.ExtractToFile(v64, true);
                    if (found32 != null) found32.ExtractToFile(v32, true);
                    if (found64 == null && found32 == null) return (false, "Koaloader: version.dll negăsit în arhivă.");
                    return (true, "Koaloader descărcat.");
                }
                finally { try { File.Delete(zipPath); } catch { } }
            }
            catch (Exception ex) { return (false, "Koaloader eroare: " + ex.Message); }
        }

        // ── UplayR1Unlocker (Ubisoft R1) ─────────────────────────────────────────

        public static async Task<(bool ok, string message)> EnsureUplayR1CacheAsync()
        {
            string dll64 = Path.Combine(UplayR1CacheDir, "UplayR1Unlocker.dll");
            string dll32 = Path.Combine(UplayR1CacheDir, "UplayR1Unlocker32.dll");
            if (File.Exists(dll64) || File.Exists(dll32)) return (true, "Cache OK.");

            try
            {
                // Prefer the Proxy (loader) zip
                string json = await HttpClient.GetStringAsync(
                    new Uri("https://api.github.com/repos/acidicoala/UplayR1Unlocker/releases/latest"));
                var release = JObject.Parse(json);
                if (release["assets"] is not JArray assets) return (false, "UplayR1Unlocker: assets negăsite.");

                string zipUrl = null;
                // prefer "-Proxy" zip, fallback to first zip
                foreach (var a in assets)
                {
                    string n = a["name"]?.ToString() ?? "";
                    if (n.EndsWith(".zip", StringComparison.OrdinalIgnoreCase) &&
                        (n.IndexOf("Proxy", StringComparison.OrdinalIgnoreCase) >= 0 || zipUrl == null))
                        zipUrl = a["browser_download_url"]?.ToString();
                }
                if (string.IsNullOrEmpty(zipUrl)) return (false, "UplayR1Unlocker: arhivă negăsită.");
                string zipPath = await DownloadZipAsync(zipUrl, "UplayR1");
                try
                {
                    Directory.CreateDirectory(UplayR1CacheDir);
                    using var archive = ZipFile.OpenRead(zipPath);
                    ZipArchiveEntry e64 = null, e32 = null;
                    foreach (var e in archive.Entries)
                    {
                        if (EntryIsDir(e)) continue;
                        string fn = e.FullName.Replace('\\', '/').ToLowerInvariant();
                        string name = EntryFileName(e).ToLowerInvariant();
                        if (!name.Contains("uplayr1") && !name.Contains("uplay_r1")) continue;
                        if (fn.Contains("/x64/") || fn.Contains("x64") || name.Contains("64")) e64 ??= e;
                        else e32 ??= e;
                    }
                    if (e64 != null) e64.ExtractToFile(dll64, true);
                    if (e32 != null) e32.ExtractToFile(dll32, true);
                    if (e64 == null && e32 == null) return (false, "UplayR1Unlocker: DLL negăsit în arhivă.");
                    return (true, "UplayR1Unlocker descărcat.");
                }
                finally { try { File.Delete(zipPath); } catch { } }
            }
            catch (Exception ex) { return (false, "UplayR1Unlocker eroare: " + ex.Message); }
        }

        // ── UplayR2Unlocker (Ubisoft R2) ─────────────────────────────────────────

        public static async Task<(bool ok, string message)> EnsureUplayR2CacheAsync()
        {
            string dll64 = Path.Combine(UplayR2CacheDir, "UplayR2Unlocker.dll");
            string dll32 = Path.Combine(UplayR2CacheDir, "UplayR2Unlocker32.dll");
            if (File.Exists(dll64) || File.Exists(dll32)) return (true, "Cache OK.");

            try
            {
                var release = await FetchReleaseAsync("acidicoala/UplayR2Unlocker");
                string zipUrl = LatestZipUrl(release);
                if (string.IsNullOrEmpty(zipUrl)) return (false, "UplayR2Unlocker: arhivă negăsită.");
                string zipPath = await DownloadZipAsync(zipUrl, "UplayR2");
                try
                {
                    Directory.CreateDirectory(UplayR2CacheDir);
                    using var archive = ZipFile.OpenRead(zipPath);
                    ZipArchiveEntry e64 = null, e32 = null;
                    foreach (var e in archive.Entries)
                    {
                        if (EntryIsDir(e)) continue;
                        string fn = e.FullName.Replace('\\', '/').ToLowerInvariant();
                        string name = EntryFileName(e).ToLowerInvariant();
                        if (!name.Contains("uplayr2") && !name.Contains("uplay_r2")) continue;
                        if (fn.Contains("/x64/") || fn.Contains("x64") || name.Contains("64")) e64 ??= e;
                        else e32 ??= e;
                    }
                    // fallback: any DLL in x64 folder
                    if (e64 == null) e64 = archive.Entries.FirstOrDefault(e =>
                        !EntryIsDir(e) && e.FullName.ToLowerInvariant().Contains("x64") && EntryFileName(e).EndsWith(".dll", StringComparison.OrdinalIgnoreCase));
                    if (e64 != null) e64.ExtractToFile(dll64, true);
                    if (e32 != null) e32.ExtractToFile(dll32, true);
                    if (e64 == null && e32 == null) return (false, "UplayR2Unlocker: DLL negăsit în arhivă.");
                    return (true, "UplayR2Unlocker descărcat.");
                }
                finally { try { File.Delete(zipPath); } catch { } }
            }
            catch (Exception ex) { return (false, "UplayR2Unlocker eroare: " + ex.Message); }
        }

        // ── Lyptus (EA App) ──────────────────────────────────────────────────────

        public static async Task<(bool ok, string message)> EnsureLyptusCacheAsync()
        {
            string dll64 = Path.Combine(LyptusCacheDir, "Lyptus.dll");
            string dll32 = Path.Combine(LyptusCacheDir, "Lyptus32.dll");
            if (File.Exists(dll64) || File.Exists(dll32)) return (true, "Cache OK.");

            try
            {
                var release = await FetchReleaseAsync("acidicoala/Lyptus");
                string zipUrl = LatestZipUrl(release);
                if (string.IsNullOrEmpty(zipUrl)) return (false, "Lyptus: arhivă negăsită.");
                string zipPath = await DownloadZipAsync(zipUrl, "Lyptus");
                try
                {
                    Directory.CreateDirectory(LyptusCacheDir);
                    using var archive = ZipFile.OpenRead(zipPath);
                    ZipArchiveEntry e64 = null, e32 = null;
                    foreach (var e in archive.Entries)
                    {
                        if (EntryIsDir(e)) continue;
                        string fn = e.FullName.Replace('\\', '/').ToLowerInvariant();
                        string name = EntryFileName(e).ToLowerInvariant();
                        if (!name.Contains("lyptus")) continue;
                        if (fn.Contains("/x64/") || fn.Contains("x64") || (!name.Contains("32") && !fn.Contains("x86"))) e64 ??= e;
                        else e32 ??= e;
                    }
                    if (e64 != null) e64.ExtractToFile(dll64, true);
                    if (e32 != null) e32.ExtractToFile(dll32, true);
                    if (e64 == null && e32 == null) return (false, "Lyptus: DLL negăsit în arhivă.");
                    return (true, "Lyptus descărcat.");
                }
                finally { try { File.Delete(zipPath); } catch { } }
            }
            catch (Exception ex) { return (false, "Lyptus eroare: " + ex.Message); }
        }

        // ── Source dir helpers ────────────────────────────────────────────────────

        private static string GetCachedOrFallback(string cacheDir, string fallbackSubDir, params string[] checkFiles)
        {
            if (Directory.Exists(cacheDir) && checkFiles.Any(f => File.Exists(Path.Combine(cacheDir, f))))
                return cacheDir;
            string fallback = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "DlcUnlocker", fallbackSubDir);
            return Directory.Exists(fallback) ? fallback : cacheDir;
        }

        public static string GetSmokeApiSourceDir()  => GetCachedOrFallback(SmokeApiCacheDir,  "SmokeAPI",  "steam_api64.dll", "steam_api.dll");
        public static string GetScreamApiSourceDir() => GetCachedOrFallback(ScreamApiCacheDir, "ScreamAPI", "EOSSDK-Win64-Shipping.dll", "EOSSDK-Win32-Shipping.dll");
        public static string GetKoaloaderSourceDir() => GetCachedOrFallback(KoaloaderCacheDir, "Koaloader", "version_x64.dll", "version_x86.dll");
        public static string GetUplayR1SourceDir()   => GetCachedOrFallback(UplayR1CacheDir,   "UplayR1Unlocker", "UplayR1Unlocker.dll", "UplayR1Unlocker32.dll");
        public static string GetUplayR2SourceDir()   => GetCachedOrFallback(UplayR2CacheDir,   "UplayR2Unlocker", "UplayR2Unlocker.dll", "UplayR2Unlocker32.dll");
        public static string GetLyptusSourceDir()    => GetCachedOrFallback(LyptusCacheDir,    "Lyptus",          "Lyptus.dll", "Lyptus32.dll");
    }
}
