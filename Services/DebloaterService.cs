using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;
using System.Drawing;
using System.Drawing.Imaging;
using Microsoft.Win32;

namespace TFY.Services
{
    public class DebloaterApp
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Version { get; set; }
        public string Publisher { get; set; }
        public long? EstimatedSizeKb { get; set; }
        public string InstallDate { get; set; }
        public string InstallLocation { get; set; }
        public string UninstallString { get; set; }
        public string QuietUninstallString { get; set; }
        public string Type { get; set; }
        public string PackageFullName { get; set; }
        public string PackageFamilyName { get; set; }
        public string RegistryHive { get; set; }
        public string RegistryView { get; set; }
        public string RegistrySubKey { get; set; }
        public string DisplayIcon { get; set; }
    }

    public class DebloaterService
    {
        private const string LogFolderName = "debloater\\logs";
        private static readonly string[] StoreFrameworkPrefixes = new[]
        {
            "Microsoft.NET.Native",
            "Microsoft.VCLibs",
            "Microsoft.UI.Xaml",
            "Microsoft.WindowsAppRuntime",
            "Microsoft.Advertising",
            "Microsoft.Services.Store.Engagement",
            "Microsoft.DirectX",
            "Microsoft.GamingServices",
            "Microsoft.XboxGameCallableUI",
            "Microsoft.XboxIdentityProvider",
            "Microsoft.StorePurchaseApp",
            "Microsoft.Store.Engagement",
            "Microsoft.HEIFImageExtension",
            "Microsoft.VP9VideoExtensions",
            "Microsoft.WebMediaExtensions",
            "Microsoft.WebpImageExtension"
        };

        private static void WriteBoot(string message)
        {
            try
            {
                string path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TFY", "boot.log");
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                File.AppendAllText(path, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}{Environment.NewLine}");
            }
            catch { }
        }

        public List<DebloaterApp> GetDesktopApps()
        {
            var results = new List<DebloaterApp>();
            foreach (var hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
            {
                results.AddRange(ReadUninstallKey(hive, RegistryView.Registry64));
                results.AddRange(ReadUninstallKey(hive, RegistryView.Registry32));
            }

            return results
                .GroupBy(a => BuildDesktopKey(a))
                .Select(g => g.First())
                .OrderBy(a => a.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        public List<DebloaterApp> GetStoreApps()
        {
            var attempts = new[]
            {
                "Get-AppxPackage -PackageTypeFilter Main | Select Name, PackageFullName, Version, PublisherDisplayName, InstallLocation, IsFramework, IsResourcePackage, IsBundle, NonRemovable, SignatureKind | ConvertTo-Json -Depth 3 -Compress",
                "Get-AppxPackage | Select Name, PackageFullName, Version, PublisherDisplayName, InstallLocation, IsFramework, IsResourcePackage, IsBundle, NonRemovable, SignatureKind | ConvertTo-Json -Depth 3 -Compress",
                "Get-AppxPackage -AllUsers -PackageTypeFilter Main | Select Name, PackageFullName, Version, PublisherDisplayName, InstallLocation, IsFramework, IsResourcePackage, IsBundle, NonRemovable, SignatureKind | ConvertTo-Json -Depth 3 -Compress",
                "Get-AppxPackage -AllUsers | Select Name, PackageFullName, Version, PublisherDisplayName, InstallLocation, IsFramework, IsResourcePackage, IsBundle, NonRemovable, SignatureKind | ConvertTo-Json -Depth 3 -Compress"
            };

            List<AppxItem> list = new List<AppxItem>();
            foreach (var cmd in attempts)
            {
                var raw = RunPowerShell(cmd);
                var json = ExtractJson(raw);
                list = ParseAppxJson(json);
                WriteBoot($"Debloater PS attempt: {cmd.Substring(0, Math.Min(48, cmd.Length))}... raw={raw?.Length ?? 0} json={json?.Length ?? 0} items={list.Count}");
                if (list.Count > 0) break;
            }

            var filtered = list
                .Where(a => a != null && !string.IsNullOrWhiteSpace(a.Name))
                .Where(a => !a.IsFramework && !a.IsResourcePackage && !a.IsBundle)
                .Where(a => IsStoreVisible(a))
                .Select(ToStoreApp)
                .GroupBy(a => a.PackageFamilyName ?? $"{a.Name}|{a.Publisher}")
                .Select(g => g.First())
                .OrderBy(a => a.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();

            WriteBoot($"Debloater store apps: {filtered.Count}");
            if (filtered.Count > 0)
            {
                WriteBoot($"Debloater store sample: {string.Join(", ", filtered.Take(5).Select(a => a.Name))}");
            }

            return filtered;
        }

        private static List<AppxItem> ParseAppxJson(string json)
        {
            if (string.IsNullOrWhiteSpace(json)) return new List<AppxItem>();
            try
            {
                if (json.TrimStart().StartsWith("["))
                {
                    return JsonSerializer.Deserialize<List<AppxItem>>(json) ?? new List<AppxItem>();
                }
                var single = JsonSerializer.Deserialize<AppxItem>(json);
                return single == null ? new List<AppxItem>() : new List<AppxItem> { single };
            }
            catch
            {
                return new List<AppxItem>();
            }
        }

        private static string ExtractJson(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
            var start = raw.IndexOf('[');
            var brace = raw.IndexOf('{');
            if (start < 0 || (brace >= 0 && brace < start)) start = brace;
            if (start < 0) return string.Empty;
            var end = raw.LastIndexOf(']');
            if (end < 0) end = raw.LastIndexOf('}');
            if (end < start) return string.Empty;
            return raw.Substring(start, end - start + 1).Trim();
        }

        public List<DebloaterApp> GetStartupApps()
        {
            var apps = new List<DebloaterApp>();
            var startupPaths = new[]
            {
                (Microsoft.Win32.Registry.CurrentUser, @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run"),
                (Microsoft.Win32.Registry.CurrentUser, @"SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce"),
                (Microsoft.Win32.Registry.LocalMachine, @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run"),
                (Microsoft.Win32.Registry.LocalMachine, @"SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce"),
                (Microsoft.Win32.Registry.LocalMachine, @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run"),
            };
            foreach (var (hive, subKey) in startupPaths)
            {
                try
                {
                    using var key = hive.OpenSubKey(subKey);
                    if (key == null) continue;
                    foreach (string name in key.GetValueNames())
                    {
                        if (string.IsNullOrWhiteSpace(name)) continue;
                        string value = key.GetValue(name)?.ToString() ?? "";
                        apps.Add(new DebloaterApp
                        {
                            Id = $"{hive.Name}\\{subKey}\\{name}",
                            Name = name,
                            Type = "startup",
                            InstallLocation = value,
                            RegistryHive = hive == Microsoft.Win32.Registry.CurrentUser ? "HKCU" : "HKLM",
                            RegistrySubKey = subKey
                        });
                    }
                }
                catch { }
            }
            // Also scan shell:startup folder
            try
            {
                string startupFolder = Environment.GetFolderPath(Environment.SpecialFolder.Startup);
                if (Directory.Exists(startupFolder))
                {
                    foreach (string file in Directory.GetFiles(startupFolder))
                    {
                        string fname = Path.GetFileName(file);
                        apps.Add(new DebloaterApp
                        {
                            Id = $"startup-folder:{fname}",
                            Name = Path.GetFileNameWithoutExtension(fname),
                            Type = "startup",
                            InstallLocation = file
                        });
                    }
                }
            }
            catch { }
            return apps;
        }

        public void EnableStartupEntry(DebloaterApp app)
        {
            if (app.Id.StartsWith("startup-folder:"))
            {
                // Can't re-enable a deleted shortcut
                return;
            }
            // Registry entry: restore from disabled key
            try
            {
                var parts = ParseRegistryId(app.Id);
                if (parts == null) return;
                var hive = parts.Value.hive;
                // Try to move from DisabledRun back to Run
                string disabledKey = parts.Value.subKey.Replace(@"\Run", @"\RunDisabled");
                using var srcKey = hive.OpenSubKey(disabledKey, true);
                if (srcKey != null)
                {
                    object val = srcKey.GetValue(parts.Value.name);
                    if (val != null)
                    {
                        using var dstKey = hive.OpenSubKey(parts.Value.subKey, true);
                        dstKey?.SetValue(parts.Value.name, val);
                        srcKey.DeleteValue(parts.Value.name, false);
                    }
                }
            }
            catch { }
        }

        public void DisableStartupEntry(DebloaterApp app)
        {
            if (app.Id.StartsWith("startup-folder:"))
            {
                string fname = app.Id.Substring("startup-folder:".Length);
                string startupFolder = Environment.GetFolderPath(Environment.SpecialFolder.Startup);
                string path = Path.Combine(startupFolder, fname);
                try { if (File.Exists(path)) File.Delete(path); } catch { }
                return;
            }
            // Registry entry: move to disabled key
            try
            {
                var parts = ParseRegistryId(app.Id);
                if (parts == null) return;
                var hive = parts.Value.hive;
                using var srcKey = hive.OpenSubKey(parts.Value.subKey, true);
                if (srcKey == null) return;
                object val = srcKey.GetValue(parts.Value.name);
                if (val != null)
                {
                    srcKey.DeleteValue(parts.Value.name, false);
                }
            }
            catch { }
        }

        private (Microsoft.Win32.RegistryKey hive, string subKey, string name)? ParseRegistryId(string id)
        {
            // Format: HKEY_CURRENT_USER\SOFTWARE\...\Run\EntryName
            try
            {
                int firstSlash = id.IndexOf('\\');
                if (firstSlash < 0) return null;
                string hiveName = id.Substring(0, firstSlash);
                string rest = id.Substring(firstSlash + 1);
                int lastSlash = rest.LastIndexOf('\\');
                if (lastSlash < 0) return null;
                string subKey = rest.Substring(0, lastSlash);
                string name = rest.Substring(lastSlash + 1);
                Microsoft.Win32.RegistryKey hive = hiveName switch
                {
                    "HKEY_CURRENT_USER" => Microsoft.Win32.Registry.CurrentUser,
                    "HKEY_LOCAL_MACHINE" => Microsoft.Win32.Registry.LocalMachine,
                    _ => null
                };
                if (hive == null) return null;
                return (hive, subKey, name);
            }
            catch { return null; }
        }

        public string UninstallApps(IEnumerable<DebloaterApp> apps, bool deepClean)
        {
            string logPath = CreateLogPath();
            var sb = new StringBuilder();
            sb.AppendLine($"[{DateTimeOffset.Now:u}] Debloater run started");
            sb.AppendLine($"DeepClean: {deepClean}");

            foreach (var app in apps)
            {
                sb.AppendLine($"---- {app.Type?.ToUpperInvariant()} :: {app.Name}");
                try
                {
                    if (string.Equals(app.Type, "store", StringComparison.OrdinalIgnoreCase))
                    {
                        UninstallStoreApp(app, deepClean, sb);
                    }
                    else
                    {
                        UninstallDesktopApp(app, deepClean, sb);
                    }
                }
                catch (Exception ex)
                {
                    sb.AppendLine($"ERROR: {ex.Message}");
                }
            }

            sb.AppendLine($"[{DateTimeOffset.Now:u}] Debloater run finished");
            File.WriteAllText(logPath, sb.ToString());
            return logPath;
        }

        public DebloaterApp FindDesktopAppById(string id)
        {
            foreach (var hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
            {
                var match = ReadUninstallKey(hive, RegistryView.Registry64).FirstOrDefault(a => a.Id == id);
                if (match != null) return match;
                match = ReadUninstallKey(hive, RegistryView.Registry32).FirstOrDefault(a => a.Id == id);
                if (match != null) return match;
            }
            return null;
        }

        private List<DebloaterApp> ReadUninstallKey(RegistryHive hive, RegistryView view)
        {
            var apps = new List<DebloaterApp>();
            try
            {
                using var baseKey = RegistryKey.OpenBaseKey(hive, view);
                using var key = baseKey.OpenSubKey(@"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall");
                if (key == null) return apps;

                foreach (var subName in key.GetSubKeyNames())
                {
                    using var subKey = key.OpenSubKey(subName);
                    if (subKey == null) continue;

                    var displayName = subKey.GetValue("DisplayName") as string;
                    if (string.IsNullOrWhiteSpace(displayName)) continue;

                    var systemComponent = subKey.GetValue("SystemComponent");
                    if (systemComponent != null && systemComponent.ToString() == "1") continue;

                    var displayIcon = subKey.GetValue("DisplayIcon") as string;

                    var app = new DebloaterApp
                    {
                        Id = $"{hive}\\{view}\\{subName}",
                        Name = displayName.Trim(),
                        Version = subKey.GetValue("DisplayVersion") as string,
                        Publisher = subKey.GetValue("Publisher") as string,
                        InstallLocation = subKey.GetValue("InstallLocation") as string,
                        UninstallString = subKey.GetValue("UninstallString") as string,
                        QuietUninstallString = subKey.GetValue("QuietUninstallString") as string,
                        InstallDate = NormalizeInstallDate(subKey.GetValue("InstallDate") as string),
                        EstimatedSizeKb = TryParseLong(subKey.GetValue("EstimatedSize")),
                        Type = "desktop",
                        RegistryHive = hive.ToString(),
                        RegistryView = view.ToString(),
                        RegistrySubKey = $@"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{subName}",
                        DisplayIcon = NormalizeIconPath(displayIcon)
                    };

                    if (app.EstimatedSizeKb == null)
                    {
                        app.EstimatedSizeKb = GetDirectorySizeKb(app.InstallLocation);
                    }

                    if (string.IsNullOrWhiteSpace(app.InstallDate))
                    {
                        app.InstallDate = GetDirectoryInstallDate(app.InstallLocation);
                    }

                    apps.Add(app);
                }
            }
            catch
            {
                // ignore
            }

            return apps;
        }

        private static string ParseInstallDate(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            if (DateTime.TryParseExact(value, "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            {
                return date.ToString("yyyy-MM-dd");
            }
            return value;
        }

        private static long? TryParseLong(object value)
        {
            if (value == null) return null;
            if (long.TryParse(value.ToString(), out var result)) return result;
            return null;
        }

        private static bool IsStoreVisible(AppxItem item)
        {
            if (item == null || string.IsNullOrWhiteSpace(item.Name)) return false;
            if (string.IsNullOrWhiteSpace(item.InstallLocation)) return false;
            if (item.InstallLocation.IndexOf("WindowsApps", StringComparison.OrdinalIgnoreCase) < 0) return false;
            if (item.NonRemovable) return false;
            if (item.IsFramework || item.IsResourcePackage || item.IsBundle) return false;


            foreach (var prefix in StoreFrameworkPrefixes)
            {
                if (item.Name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) return false;
            }

            return true;
        }

        private static DebloaterApp ToStoreApp(AppxItem item)
        {
            var family = BuildPackageFamilyName(item.PackageFullName);
            var icon = GetStoreIcon(item.InstallLocation);
            return new DebloaterApp
            {
                Id = item.PackageFullName,
                Name = item.Name,
                Version = item.Version,
                Publisher = item.PublisherDisplayName ?? GetStorePublisherName(item.InstallLocation) ?? (item.Name != null && item.Name.StartsWith("Microsoft.", StringComparison.OrdinalIgnoreCase) ? "Microsoft" : null),
                InstallLocation = item.InstallLocation,
                PackageFullName = item.PackageFullName,
                PackageFamilyName = family,
                DisplayIcon = icon,
                InstallDate = GetStoreInstallDate(item.InstallLocation),
                EstimatedSizeKb = GetStoreSizeKb(item.InstallLocation),
                Type = "store",
            };
        }

        private static string BuildPackageFamilyName(string packageFullName)
        {
            if (string.IsNullOrWhiteSpace(packageFullName)) return null;
            var parts = packageFullName.Split('_');
            if (parts.Length < 4) return null;
            return $"{parts[0]}_{parts[3]}";
        }

        private static string NormalizeIconPath(string displayIcon)
        {
            if (string.IsNullOrWhiteSpace(displayIcon)) return null;
            var cleaned = displayIcon.Trim().Trim('"').Trim();
            if (cleaned.StartsWith("@")) cleaned = cleaned.Substring(1);
            cleaned = Environment.ExpandEnvironmentVariables(cleaned);
            var commaIndex = cleaned.IndexOf(',');
            if (commaIndex > 0)
            {
                cleaned = cleaned.Substring(0, commaIndex);
            }
            if (string.IsNullOrWhiteSpace(cleaned)) return null;
            if (!File.Exists(cleaned)) return null;
            var pngPath = ExtractIconToPng(cleaned);
            return ReadFileAsDataUri(pngPath ?? cleaned);
        }

        private static string ExtractIconToPng(string sourcePath)
        {
            try
            {
                var ext = Path.GetExtension(sourcePath).ToLowerInvariant();
                if (ext != ".exe" && ext != ".dll" && ext != ".ico") return null;

                var cacheDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TFY", "debloater", "icons");
                Directory.CreateDirectory(cacheDir);

                var hash = BitConverter.ToString(System.Security.Cryptography.SHA1.HashData(Encoding.UTF8.GetBytes(sourcePath))).Replace("-", "").ToLowerInvariant();
                var target = Path.Combine(cacheDir, $"{hash}.png");
                if (File.Exists(target)) return target;

                using var icon = Icon.ExtractAssociatedIcon(sourcePath);
                if (icon == null) return null;
                using var bmp = icon.ToBitmap();
                bmp.Save(target, ImageFormat.Png);
                return target;
            }
            catch
            {
                return null;
            }
        }

        private static string GetStoreIcon(string installLocation)
        {
            if (string.IsNullOrWhiteSpace(installLocation)) return null;
            var manifestPath = Path.Combine(installLocation, "AppxManifest.xml");
            if (!File.Exists(manifestPath)) return null;

            try
            {
                var doc = XDocument.Load(manifestPath);
                XNamespace uap = "http://schemas.microsoft.com/appx/manifest/uap/windows10";
                XNamespace uap2 = "http://schemas.microsoft.com/appx/manifest/uap/windows10/2";
                var visual = doc.Descendants(uap + "VisualElements").FirstOrDefault()
                            ?? doc.Descendants(uap2 + "VisualElements").FirstOrDefault();
                if (visual == null) return null;

                var logo = visual.Attribute("Square44x44Logo")?.Value
                    ?? visual.Attribute("Logo")?.Value
                    ?? visual.Attribute("Square150x150Logo")?.Value;

                return ResolveStoreLogoPath(installLocation, logo);
            }
            catch
            {
                return null;
            }
        }

        private static string ResolveStoreLogoPath(string installLocation, string logo)
        {
            if (string.IsNullOrWhiteSpace(installLocation) || string.IsNullOrWhiteSpace(logo)) return null;
            var relative = logo.Replace("/", "\\").TrimStart('\\');
            var basePath = Path.Combine(installLocation, relative);
            if (File.Exists(basePath)) return ReadFileAsDataUri(basePath);

            var dir = Path.GetDirectoryName(basePath);
            var fileName = Path.GetFileNameWithoutExtension(basePath);
            var ext = Path.GetExtension(basePath);
            if (Directory.Exists(dir))
            {
                var candidates = Directory.GetFiles(dir, $"{fileName}*{ext}");
                var pick = candidates
                    .OrderByDescending(p => ScoreLogoCandidate(p))
                    .FirstOrDefault();
                if (!string.IsNullOrWhiteSpace(pick))
                {
                    return ReadFileAsDataUri(pick);
                }
            }
            return null;
        }

        private static int ScoreLogoCandidate(string path)
        {
            var name = Path.GetFileName(path).ToLowerInvariant();
            if (name.Contains("targetsize-256")) return 100;
            if (name.Contains("targetsize-128")) return 90;
            if (name.Contains("targetsize-64")) return 80;
            if (name.Contains("scale-200")) return 70;
            if (name.Contains("scale-150")) return 60;
            if (name.Contains("scale-125")) return 50;
            if (name.Contains("scale-100")) return 40;
            return 10;
        }

        private static string ReadFileAsDataUri(string path)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) return null;
                var bytes = File.ReadAllBytes(path);
                var ext = Path.GetExtension(path).TrimStart('.').ToLowerInvariant();
                var mime = ext switch
                {
                    "png" => "image/png",
                    "jpg" => "image/jpeg",
                    "jpeg" => "image/jpeg",
                    "ico" => "image/x-icon",
                    _ => "image/png"
                };
                var base64 = Convert.ToBase64String(bytes);
                return $"data:{mime};base64,{base64}";
            }
            catch
            {
                return null;
            }
        }

        private static long? GetDirectorySizeKb(string installLocation)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(installLocation) || !Directory.Exists(installLocation)) return null;
                long total = 0;
                int files = 0;
                foreach (var file in Directory.EnumerateFiles(installLocation, "*", SearchOption.AllDirectories))
                {
                    try
                    {
                        var info = new FileInfo(file);
                        total += info.Length;
                        files++;
                        if (files > 5000) return null;
                    }
                    catch { }
                }
                return total / 1024;
            }
            catch { return null; }
        }

        private static string GetDirectoryInstallDate(string installLocation)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(installLocation) || !Directory.Exists(installLocation)) return null;
                var dt = Directory.GetCreationTime(installLocation);
                if (dt == DateTime.MinValue) return null;
                return dt.ToString("yyyy-MM-dd");
            }
            catch { return null; }
        }
        private static string BuildDesktopKey(DebloaterApp app)
        {
            var name = (app.Name ?? string.Empty).Trim().ToLowerInvariant();
            var publisher = (app.Publisher ?? string.Empty).Trim().ToLowerInvariant();
            var version = (app.Version ?? string.Empty).Trim().ToLowerInvariant();
            var location = (app.InstallLocation ?? string.Empty).Trim().ToLowerInvariant();
            return $"{name}|{publisher}|{version}|{location}";
        }

        private void UninstallDesktopApp(DebloaterApp app, bool deepClean, StringBuilder log)
        {
            var cmd = !string.IsNullOrWhiteSpace(app.QuietUninstallString)
                ? app.QuietUninstallString
                : app.UninstallString;

            if (string.IsNullOrWhiteSpace(cmd))
            {
                log.AppendLine("No uninstall command found.");
                return;
            }

            cmd = NormalizeMsiCommand(cmd);
            log.AppendLine($"Uninstall: {cmd}");

            var exitCode = RunCommand(cmd);
            log.AppendLine($"ExitCode: {exitCode}");

            // Remove stale uninstall entry so app disappears from list even when uninstallers leave orphan keys.
            if (!string.IsNullOrWhiteSpace(app.RegistrySubKey))
            {
                TryDeleteRegistryKey(app, app.RegistrySubKey, log);
            }
            else if (!string.IsNullOrWhiteSpace(app.Id))
            {
                var parsedSubKey = TryExtractRegistrySubKeyFromId(app.Id);
                if (!string.IsNullOrWhiteSpace(parsedSubKey))
                {
                    TryDeleteRegistryKey(app, parsedSubKey, log);
                }
            }

            if (deepClean)
            {
                CleanupDesktopApp(app, log);
            }
        }

        private void UninstallStoreApp(DebloaterApp app, bool deepClean, StringBuilder log)
        {
            if (string.IsNullOrWhiteSpace(app.PackageFullName))
            {
                log.AppendLine("Missing PackageFullName.");
                return;
            }

            var cmd = $"Remove-AppxPackage -Package \"{app.PackageFullName}\"";
            log.AppendLine($"PowerShell: {cmd}");
            var output = RunPowerShell(cmd);
            log.AppendLine(output?.Trim());

            if (deepClean && !string.IsNullOrWhiteSpace(app.PackageFamilyName))
            {
                var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                var packagePath = Path.Combine(local, "Packages", app.PackageFamilyName);
                TryDeleteDirectory(packagePath, log);
                CleanupShortcuts(app, log);
            }
        }

        private static string NormalizeMsiCommand(string cmd)
        {
            if (cmd.IndexOf("msiexec", StringComparison.OrdinalIgnoreCase) >= 0 && cmd.IndexOf("/I", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                cmd = cmd.Replace("/I", "/X", StringComparison.OrdinalIgnoreCase);
            }
            return cmd;
        }

        private void CleanupDesktopApp(DebloaterApp app, StringBuilder log)
        {
            if (!string.IsNullOrWhiteSpace(app.InstallLocation))
            {
                TryDeleteDirectory(app.InstallLocation, log);
            }

            var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var roaming = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            var localLow = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "AppData", "LocalLow");

            var name = SafeFolderName(app.Name);
            if (!string.IsNullOrWhiteSpace(name))
            {
                TryDeleteDirectory(Path.Combine(local, name), log);
                TryDeleteDirectory(Path.Combine(roaming, name), log);
                TryDeleteDirectory(Path.Combine(localLow, name), log);
                TryDeleteRegistryKey(app, $@"Software\\{name}", log);
            }

            if (!string.IsNullOrWhiteSpace(app.RegistrySubKey))
            {
                TryDeleteRegistryKey(app, app.RegistrySubKey, log);
            }

            CleanupShortcuts(app, log);
        }

        private static string SafeFolderName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return null;
            foreach (var c in Path.GetInvalidFileNameChars())
            {
                name = name.Replace(c, '_');
            }
            return name.Trim();
        }

        private static void TryDeleteDirectory(string path, StringBuilder log)
        {
            try
            {
                if (Directory.Exists(path))
                {
                    Directory.Delete(path, true);
                    log.AppendLine($"Deleted: {path}");
                }
            }
            catch (Exception ex)
            {
                log.AppendLine($"Delete failed: {path} :: {ex.Message}");
            }
        }

        private static void TryDeleteRegistryKey(DebloaterApp app, string subKey, StringBuilder log)
        {
            try
            {
                if (!Enum.TryParse(app.RegistryHive, out RegistryHive hive)) return;
                var view = RegistryView.Registry64;
                if (!string.IsNullOrWhiteSpace(app.RegistryView))
                {
                    Enum.TryParse(app.RegistryView, out view);
                }

                using var baseKey = RegistryKey.OpenBaseKey(hive, view);
                baseKey.DeleteSubKeyTree(subKey, false);
                log.AppendLine($"Registry deleted: {hive}\\{subKey}");
            }
            catch (Exception ex)
            {
                log.AppendLine($"Registry delete failed: {subKey} :: {ex.Message}");
            }
        }

        private static void CleanupShortcuts(DebloaterApp app, StringBuilder log)
        {
            try
            {
                var name = (app.Name ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(name)) return;

                var roots = new[]
                {
                    Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                    Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Microsoft", "Windows", "Start Menu", "Programs"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Microsoft", "Windows", "Start Menu", "Programs"),
                };

                foreach (var root in roots)
                {
                    if (string.IsNullOrWhiteSpace(root) || !Directory.Exists(root)) continue;
                    foreach (var lnk in Directory.EnumerateFiles(root, "*.lnk", SearchOption.AllDirectories))
                    {
                        var fileName = Path.GetFileNameWithoutExtension(lnk);
                        if (fileName.IndexOf(name, StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            try
                            {
                                File.Delete(lnk);
                                log.AppendLine($"Shortcut removed: {lnk}");
                            }
                            catch (Exception ex)
                            {
                                log.AppendLine($"Shortcut remove failed: {lnk} :: {ex.Message}");
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                log.AppendLine($"Shortcut cleanup failed: {ex.Message}");
            }
        }

        private static string TryExtractRegistrySubKeyFromId(string id)
        {
            try
            {
                var parts = id.Split('\\');
                if (parts.Length < 3) return null;
                var subName = parts[^1];
                if (string.IsNullOrWhiteSpace(subName)) return null;
                return $@"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{subName}";
            }
            catch
            {
                return null;
            }
        }

        private static int RunCommand(string command)
        {
            var psi = new ProcessStartInfo("cmd.exe", $"/c {command}")
            {
                UseShellExecute = true,
                CreateNoWindow = true
            };

            using var process = Process.Start(psi);
            process?.WaitForExit();
            return process?.ExitCode ?? -1;
        }

        private static string RunPowerShell(string command)
        {
            var psi = new ProcessStartInfo("powershell.exe", $"-NoProfile -ExecutionPolicy Bypass -Command {command}")
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = Process.Start(psi);
            if (process == null) return string.Empty;
            var output = process.StandardOutput.ReadToEnd();
            var error = process.StandardError.ReadToEnd();
            process.WaitForExit();
            return string.IsNullOrWhiteSpace(error) ? output : output + Environment.NewLine + error;
        }

        private static string CreateLogPath()
        {
            var baseDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TFY", LogFolderName);
            Directory.CreateDirectory(baseDir);
            var name = $"debloat-{DateTime.Now:yyyyMMdd-HHmmss}.log";
            return Path.Combine(baseDir, name);
        }


        private static string NormalizeInstallDate(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;

            var formats = new[] { "yyyyMMdd", "yyyy-MM-dd", "yyyy.MM.dd", "dd.MM.yyyy", "MM/dd/yyyy", "M/d/yyyy" };
            if (DateTime.TryParseExact(value, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            {
                return date.ToString("yyyy-MM-dd");
            }

            if (DateTime.TryParse(value, CultureInfo.CurrentCulture, DateTimeStyles.None, out date))
            {
                return date.ToString("yyyy-MM-dd");
            }

            return value;
        }

        private static string GetStorePublisherName(string installLocation)
        {
            if (string.IsNullOrWhiteSpace(installLocation)) return null;
            var manifestPath = Path.Combine(installLocation, "AppxManifest.xml");
            if (!File.Exists(manifestPath)) return null;
            try
            {
                var doc = XDocument.Load(manifestPath);
                var props = doc.Descendants().FirstOrDefault(d => d.Name.LocalName == "Properties");
                var pub = props?.Elements().FirstOrDefault(e => e.Name.LocalName == "PublisherDisplayName")?.Value;
                if (!string.IsNullOrWhiteSpace(pub)) return pub.Trim();
            }
            catch { }
            return null;
        }

        private static string GetStoreInstallDate(string installLocation)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(installLocation) || !Directory.Exists(installLocation)) return null;
                var dt = Directory.GetCreationTime(installLocation);
                if (dt == DateTime.MinValue) return null;
                return dt.ToString("yyyy-MM-dd");
            }
            catch { return null; }
        }

        private static long? GetStoreSizeKb(string installLocation)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(installLocation) || !Directory.Exists(installLocation)) return null;
                long total = 0;
                int files = 0;
                foreach (var file in Directory.EnumerateFiles(installLocation, "*", SearchOption.AllDirectories))
                {
                    try
                    {
                        var info = new FileInfo(file);
                        total += info.Length;
                        files++;
                        if (files > 5000) return null;
                    }
                    catch { }
                }
                return total / 1024;
            }
            catch { return null; }
        }

        private class AppxItem
        {
            public string Name { get; set; }
            public string PackageFullName { get; set; }
            public string Version { get; set; }
            public string PublisherDisplayName { get; set; }
            public string InstallLocation { get; set; }
            public bool IsFramework { get; set; }
            public bool IsResourcePackage { get; set; }
            public bool IsBundle { get; set; }
            public bool NonRemovable { get; set; }
            public int? SignatureKind { get; set; }
        }
    }
}

















