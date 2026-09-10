using System;
using System.Collections.Generic;
using System.IO;
using System.Diagnostics;
using System.Linq;
using System.Net.Http;
using Microsoft.Win32;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace TFY.Services
{
    public class SteamGameInfo
    {
        [JsonProperty("appid")]
        public string AppId { get; set; } = string.Empty;

        [JsonProperty("name")]
        public string Name { get; set; } = string.Empty;

        [JsonProperty("icon")]
        public string Icon { get; set; } = string.Empty;
    }

    public static class SteamUnlockerService
    {
        private static string GetSteamPath()
        {
            string steamPath = "";
            using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam"))
            {
                if (key != null)
                {
                    steamPath = key.GetValue("SteamPath")?.ToString() ?? "";
                }
            }

            if (string.IsNullOrEmpty(steamPath) || !Directory.Exists(steamPath))
            {
                using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\Valve\Steam"))
                {
                    if (key != null)
                    {
                        steamPath = key.GetValue("InstallPath")?.ToString() ?? "";
                    }
                }
            }

            if (string.IsNullOrEmpty(steamPath) || !Directory.Exists(steamPath))
            {
                steamPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Steam");
            }

            return steamPath;
        }

        private static string GetActiveUserAccountId()
        {
            try
            {
                using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam\ActiveProcess"))
                {
                    if (key != null)
                    {
                        var val = key.GetValue("ActiveUser");
                        if (val != null)
                        {
                            return val.ToString();
                        }
                    }
                }
            }
            catch { }
            return string.Empty;
        }

        private static string ExtractVdfBlock(string content, string blockName)
        {
            int index = content.IndexOf($"\"{blockName}\"", StringComparison.OrdinalIgnoreCase);
            if (index == -1)
            {
                index = content.IndexOf(blockName, StringComparison.OrdinalIgnoreCase);
            }
            if (index == -1) return string.Empty;

            int braceStart = content.IndexOf('{', index);
            if (braceStart == -1) return string.Empty;

            int braceCount = 1;
            int i = braceStart + 1;
            while (i < content.Length && braceCount > 0)
            {
                if (content[i] == '{') braceCount++;
                else if (content[i] == '}') braceCount--;
                i++;
            }

            if (braceCount == 0)
            {
                return content.Substring(braceStart, i - braceStart);
            }
            return string.Empty;
        }

        // Local name cache file path
        private static string NameCachePath => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "TFY", "steam_names_cache.json");

        private static readonly HttpClient _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };

        public static List<SteamGameInfo> GetLibraryGames()
        {
            var games = new List<SteamGameInfo>();
            var appIds = new HashSet<string>();
            var nameCache = LoadNameCache();

            try
            {
                // 1. Add all locally installed games first (always accurate names from .acf manifests)
                var installed = GetInstalledGames();
                foreach (var g in installed)
                {
                    if (!appIds.Contains(g.AppId))
                    {
                        appIds.Add(g.AppId);
                        games.Add(g);
                        // Cache the name if we have it
                        if (!string.IsNullOrEmpty(g.Name))
                        {
                            nameCache[g.AppId] = g.Name;
                        }
                    }
                }

                // 2. Parse localconfig.vdf and sharedconfig.vdf for additional game AppIDs
                string steamPath = GetSteamPath();
                var vdfAppIds = new HashSet<string>();

                if (!string.IsNullOrEmpty(steamPath) && Directory.Exists(steamPath))
                {
                    string accountId = GetActiveUserAccountId();
                    var vdfPaths = new List<string>();

                    if (!string.IsNullOrEmpty(accountId) && accountId != "0")
                    {
                        string userFolder = Path.Combine(steamPath, "userdata", accountId);
                        if (Directory.Exists(userFolder))
                        {
                            string localConfig = Path.Combine(userFolder, "config", "localconfig.vdf");
                            if (File.Exists(localConfig)) vdfPaths.Add(localConfig);

                            string sharedConfig = Path.Combine(userFolder, "7", "remote", "sharedconfig.vdf");
                            if (File.Exists(sharedConfig)) vdfPaths.Add(sharedConfig);
                        }
                    }
                    else
                    {
                        string userdataPath = Path.Combine(steamPath, "userdata");
                        if (Directory.Exists(userdataPath))
                        {
                            foreach (var dir in Directory.GetDirectories(userdataPath))
                            {
                                string localConfig = Path.Combine(dir, "config", "localconfig.vdf");
                                if (File.Exists(localConfig)) vdfPaths.Add(localConfig);

                                string sharedConfig = Path.Combine(dir, "7", "remote", "sharedconfig.vdf");
                                if (File.Exists(sharedConfig)) vdfPaths.Add(sharedConfig);
                            }
                        }
                    }

                    foreach (var path in vdfPaths)
                    {
                        try
                        {
                            string content = File.ReadAllText(path);
                            string appsBlock = ExtractVdfBlock(content, "apps");
                            if (string.IsNullOrEmpty(appsBlock))
                            {
                                appsBlock = ExtractVdfBlock(content, "Apps");
                            }
                            if (string.IsNullOrEmpty(appsBlock))
                            {
                                appsBlock = content;
                            }

                            var appMatches = Regex.Matches(appsBlock, @"\""(\d+)\""\s*\{");
                            foreach (Match m in appMatches)
                            {
                                string appid = m.Groups[1].Value;
                                if (appid.Length >= 2 && !appIds.Contains(appid))
                                {
                                    // Try to extract name from VDF block
                                    int startIndex = m.Index + m.Length;
                                    int len = Math.Min(350, appsBlock.Length - startIndex);
                                    string blockSample = appsBlock.Substring(startIndex, len);
                                    int closeBrace = blockSample.IndexOf('}');
                                    if (closeBrace > 0) blockSample = blockSample.Substring(0, closeBrace);

                                    var nameMatch = Regex.Match(blockSample, @"\""[nN]ame\""\s+\""([^\""]+)\""");
                                    if (nameMatch.Success && !string.IsNullOrEmpty(nameMatch.Groups[1].Value))
                                    {
                                        nameCache[appid] = nameMatch.Groups[1].Value;
                                    }

                                    vdfAppIds.Add(appid);
                                }
                            }
                        }
                        catch { }
                    }
                }

                // 3. Use SteamWorker check-owned to verify which VDF AppIDs the user actually owns
                var unverifiedIds = vdfAppIds.Where(id => !appIds.Contains(id)).ToList();
                if (unverifiedIds.Count > 0)
                {
                    var ownedSet = CheckOwnedAppIds(unverifiedIds);
                    if (ownedSet.Count == 0)
                    {
                        // Fallback: If Steam is closed/not running, include all VDF games in the list
                        ownedSet = new HashSet<string>(unverifiedIds);
                    }

                    foreach (var appid in ownedSet)
                    {
                        if (!appIds.Contains(appid))
                        {
                            appIds.Add(appid);
                            string name = nameCache.ContainsKey(appid) ? nameCache[appid] : "";
                            games.Add(new SteamGameInfo
                            {
                                AppId = appid,
                                Name = name,
                                Icon = $"https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appid}/header.jpg"
                            });
                        }
                    }
                }

                // 4. Resolve missing names via Steam Store API (with caching)
                var needsName = games.Where(g => string.IsNullOrEmpty(g.Name)).ToList();
                if (needsName.Count > 0)
                {
                    ResolveGameNames(needsName, nameCache);
                    // Remove non-game entries from the main games list
                    games.RemoveAll(g => g.Name != null && g.Name.StartsWith("__SKIP__"));
                }

                // Save updated name cache
                SaveNameCache(nameCache);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SteamUnlocker] Error getting library games: {ex.Message}");
            }

            // Sort: named games alphabetically first, then unnamed games by AppID
            games.Sort((x, y) =>
            {
                bool xHasName = !string.IsNullOrEmpty(x.Name);
                bool yHasName = !string.IsNullOrEmpty(y.Name);
                if (xHasName && yHasName) return string.Compare(x.Name, y.Name, StringComparison.OrdinalIgnoreCase);
                if (xHasName) return -1;
                if (yHasName) return 1;
                return string.Compare(x.AppId, y.AppId, StringComparison.Ordinal);
            });
            return games;
        }

        /// <summary>
        /// Calls SteamWorker check-owned to verify which AppIDs the user is subscribed to.
        /// Returns a HashSet of owned AppIDs.
        /// </summary>
        private static HashSet<string> CheckOwnedAppIds(List<string> appIds)
        {
            var ownedSet = new HashSet<string>();
            try
            {
                string exePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "SteamWorker.exe");
                if (!File.Exists(exePath))
                {
                    exePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "SteamWorker", "bin", "Release", "net8.0-windows", "win-x64", "SteamWorker.exe");
                }

                if (!File.Exists(exePath))
                {
                    Console.WriteLine("[SteamUnlocker] SteamWorker.exe not found for ownership check, including all VDF games.");
                    return new HashSet<string>(appIds); // If SteamWorker not found, include all
                }

                // Process in batches of 500 to avoid command line length issues
                int batchSize = 500;
                for (int i = 0; i < appIds.Count; i += batchSize)
                {
                    var batch = appIds.Skip(i).Take(batchSize).ToList();
                    string idList = string.Join(",", batch);

                    var startInfo = new ProcessStartInfo
                    {
                        FileName = exePath,
                        Arguments = $"check-owned {idList}",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };

                    using (var process = Process.Start(startInfo))
                    {
                        string output = process.StandardOutput.ReadToEnd();
                        string error = process.StandardError.ReadToEnd();

                        // Timeout after 15 seconds to prevent infinite hang
                        if (!process.WaitForExit(15000))
                        {
                            try { process.Kill(); } catch { }
                            Console.WriteLine("[SteamUnlocker] SteamWorker check-owned timed out, including all VDF games.");
                            return new HashSet<string>(appIds);
                        }

                        if (!string.IsNullOrWhiteSpace(output))
                        {
                            try
                            {
                                var result = JObject.Parse(output);
                                if (result["ok"]?.Value<bool>() == true && result["owned"] is JArray owned)
                                {
                                    foreach (var id in owned)
                                    {
                                        ownedSet.Add(id.ToString());
                                    }
                                }
                            }
                            catch { }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SteamUnlocker] Error checking ownership: {ex.Message}");
                // If check fails, include all games as fallback
                return new HashSet<string>(appIds);
            }

            return ownedSet;
        }

        /// <summary>
        /// Resolves missing game names by querying Steam Store API.
        /// Results are cached in the nameCache dictionary.
        /// </summary>
        private static void ResolveGameNames(List<SteamGameInfo> games, Dictionary<string, string> nameCache)
        {
            foreach (var game in games)
            {
                // Check cache first
                if (nameCache.ContainsKey(game.AppId) && !string.IsNullOrEmpty(nameCache[game.AppId]))
                {
                    game.Name = nameCache[game.AppId];
                    continue;
                }

                try
                {
                    // Use fully synchronous HTTP to avoid WPF SynchronizationContext deadlock
                    string url = $"https://store.steampowered.com/api/appdetails?appids={game.AppId}&filters=basic";
                    var request = new HttpRequestMessage(HttpMethod.Get, url);
                    var response = _httpClient.Send(request);
                    if (response.IsSuccessStatusCode)
                    {
                        using var stream = response.Content.ReadAsStream();
                        using var reader = new System.IO.StreamReader(stream);
                        string json = reader.ReadToEnd();
                        var root = JObject.Parse(json);
                        var appData = root[game.AppId];
                        if (appData?["success"]?.Value<bool>() == true)
                        {
                            string name = appData["data"]?["name"]?.ToString() ?? "";
                            string type = appData["data"]?["type"]?.ToString() ?? "";

                            // Filter out non-game types (tools, demos, DLC, etc.)
                            if (type == "game" || type == "mod")
                            {
                                game.Name = name;
                                nameCache[game.AppId] = name;
                            }
                            else
                            {
                                // Mark as non-game so we skip it
                                game.Name = $"__SKIP__{type}";
                            }
                        }
                        else
                        {
                            // App not found on store - mark for removal
                            game.Name = "__SKIP__notfound";
                        }
                    }
                }
                catch
                {
                    // If API call fails, leave name empty (banner will still show)
                }

                // Small delay to avoid rate limiting
                System.Threading.Thread.Sleep(50);
            }
        }

        private static Dictionary<string, string> LoadNameCache()
        {
            try
            {
                string path = NameCachePath;
                if (File.Exists(path))
                {
                    string json = File.ReadAllText(path);
                    return JsonConvert.DeserializeObject<Dictionary<string, string>>(json) ?? new Dictionary<string, string>();
                }
            }
            catch { }
            return new Dictionary<string, string>();
        }

        private static void SaveNameCache(Dictionary<string, string> cache)
        {
            try
            {
                string dir = Path.GetDirectoryName(NameCachePath);
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                File.WriteAllText(NameCachePath, JsonConvert.SerializeObject(cache, Formatting.Indented));
            }
            catch { }
        }

        public static List<SteamGameInfo> GetInstalledGames()
        {
            var games = new List<SteamGameInfo>();
            try
            {
                // Find Steam path
                string steamPath = "";
                using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam"))
                {
                    if (key != null)
                    {
                        steamPath = key.GetValue("SteamPath")?.ToString() ?? "";
                    }
                }

                if (string.IsNullOrEmpty(steamPath) || !Directory.Exists(steamPath))
                {
                    using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\Valve\Steam"))
                    {
                        if (key != null)
                        {
                            steamPath = key.GetValue("InstallPath")?.ToString() ?? "";
                        }
                    }
                }

                if (string.IsNullOrEmpty(steamPath) || !Directory.Exists(steamPath))
                {
                    steamPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Steam");
                }

                if (!Directory.Exists(steamPath))
                {
                    return games;
                }

                var libraryFolders = new List<string> { steamPath };
                string vdfPath = Path.Combine(steamPath, "steamapps", "libraryfolders.vdf");
                if (File.Exists(vdfPath))
                {
                    // Parse libraryfolders.vdf using regex to extract "path"
                    string vdfContent = File.ReadAllText(vdfPath);
                    var matches = Regex.Matches(vdfContent, @"\""path\""\s+\""([^\""]+)\""");
                    foreach (Match m in matches)
                    {
                        string path = m.Groups[1].Value.Replace(@"\\", @"\");
                        if (Directory.Exists(path) && !libraryFolders.Contains(path))
                        {
                            libraryFolders.Add(path);
                        }
                    }
                }

                var appids = new HashSet<string>();

                foreach (var folder in libraryFolders)
                {
                    string steamapps = Path.Combine(folder, "steamapps");
                    if (!Directory.Exists(steamapps)) continue;

                    foreach (var file in Directory.GetFiles(steamapps, "appmanifest_*.acf"))
                    {
                        try
                        {
                            string acfContent = File.ReadAllText(file);
                            var appidMatch = Regex.Match(acfContent, @"\""appid\""\s+\""([^\""]+)\""");
                            var nameMatch = Regex.Match(acfContent, @"\""name\""\s+\""([^\""]+)\""");

                            if (appidMatch.Success && nameMatch.Success)
                            {
                                string appid = appidMatch.Groups[1].Value;
                                string name = nameMatch.Groups[1].Value;

                                if (!appids.Contains(appid))
                                {
                                    appids.Add(appid);
                                    games.Add(new SteamGameInfo
                                    {
                                        AppId = appid,
                                        Name = name,
                                        Icon = $"https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appid}/header.jpg"
                                    });
                                }
                            }
                        }
                        catch { }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SteamUnlocker] Error getting installed games: {ex.Message}");
            }

            // Sort alphabetically by name
            games.Sort((x, y) => string.Compare(x.Name, y.Name, StringComparison.OrdinalIgnoreCase));
            return games;
        }

        public static string QueryAchievements(string appId)
        {
            try
            {
                string exePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "SteamWorker.exe");
                if (!File.Exists(exePath))
                {
                    // Fallback to local development directory path if not published
                    exePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "SteamWorker", "bin", "Release", "net8.0-windows", "win-x64", "SteamWorker.exe");
                }

                if (!File.Exists(exePath))
                {
                    return JsonConvert.SerializeObject(new { ok = false, error = "SteamWorker.exe helper process not found in execution directory." });
                }

                var startInfo = new ProcessStartInfo
                {
                    FileName = exePath,
                    Arguments = $"query {appId}",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using (var process = Process.Start(startInfo))
                {
                    string output = process.StandardOutput.ReadToEnd();
                    string error = process.StandardError.ReadToEnd();
                    process.WaitForExit();

                    if (process.ExitCode != 0 || string.IsNullOrWhiteSpace(output))
                    {
                        return JsonConvert.SerializeObject(new { ok = false, error = !string.IsNullOrEmpty(error) ? error : $"SteamWorker process exited with code {process.ExitCode}" });
                    }
                    return output;
                }
            }
            catch (Exception ex)
            {
                return JsonConvert.SerializeObject(new { ok = false, error = ex.Message });
            }
        }

        public static string CommitAchievements(string appId, string jsonPayload)
        {
            try
            {
                string exePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "SteamWorker.exe");
                if (!File.Exists(exePath))
                {
                    exePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "SteamWorker", "bin", "Release", "net8.0-windows", "win-x64", "SteamWorker.exe");
                }

                if (!File.Exists(exePath))
                {
                    return JsonConvert.SerializeObject(new { ok = false, error = "SteamWorker.exe helper process not found in execution directory." });
                }

                var startInfo = new ProcessStartInfo
                {
                    FileName = exePath,
                    Arguments = $"commit {appId}",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    RedirectStandardInput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using (var process = Process.Start(startInfo))
                {
                    // Write payload to standard input
                    using (var writer = process.StandardInput)
                    {
                        writer.Write(jsonPayload);
                    }

                    string output = process.StandardOutput.ReadToEnd();
                    string error = process.StandardError.ReadToEnd();
                    process.WaitForExit();

                    if (process.ExitCode != 0 || string.IsNullOrWhiteSpace(output))
                    {
                        return JsonConvert.SerializeObject(new { ok = false, error = !string.IsNullOrEmpty(error) ? error : $"SteamWorker process exited with code {process.ExitCode}" });
                    }
                    return output;
                }
            }
            catch (Exception ex)
            {
                return JsonConvert.SerializeObject(new { ok = false, error = ex.Message });
            }
        }
    }
}
