using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Win32;

namespace TFY.Services
{
    public class Cs2ConfigData
    {
        public string InstallPath { get; set; } = "";
        public string LaunchOptions { get; set; } = "";
        public bool IsInstalled { get; set; } = false;
        public Dictionary<string, string> Files { get; set; } = new Dictionary<string, string>();
    }

    public class Cs2ConfigService
    {
        private const string REG_STEAM_ACTIVE = @"Software\Valve\Steam\ActiveProcess";
        private const string REG_STEAM_PATH = @"Software\Valve\Steam";
        private const string CS2_APP_ID = "730";

        private readonly JsonSerializerOptions _jsonOptions = new JsonSerializerOptions 
        { 
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase 
        };

        public async Task<object> GetCs2ConfigPayloadAsync()
        {
            try
            {
                var result = new Cs2ConfigData();

                // 1. Get Steam Path & Active User ID
                string steamPath = GetSteamPath();
                int activeUserId = GetActiveSteamId();

                if (string.IsNullOrEmpty(steamPath) || activeUserId <= 0)
                {
                    return new { error = "Steam not found or no active user logged in." };
                }

                // 2. Find Launch Options
                string localConfigPath = Path.Combine(steamPath, "userdata", activeUserId.ToString(), "config", "localconfig.vdf");
                if (File.Exists(localConfigPath))
                {
                    result.LaunchOptions = ExtractLaunchOptions(await File.ReadAllTextAsync(localConfigPath));
                }
                
                result.InstallPath = steamPath; // Pass this so UI has something to show


                // 3. Find CS2 Installation Path (checking all library folders)
                string cs2InstallPath = GetCs2InstallPath(steamPath);
                if (!string.IsNullOrEmpty(cs2InstallPath))
                {
                    result.IsInstalled = true;
                }

                // 4. Read Userdata files (Video & ConVar)
                string userdataCfgPath = Path.Combine(steamPath, "userdata", activeUserId.ToString(), "730", "local", "cfg");
                string[] userFilesToRead = { "cs2_video.txt", "cs2_machine_convars.vcfg", "cs2_user_convars_0_slot0.vcfg" };
                
                if (Directory.Exists(userdataCfgPath))
                {
                    foreach (var file in userFilesToRead)
                    {
                        string fullPath = Path.Combine(userdataCfgPath, file);
                        if (File.Exists(fullPath))
                        {
                            result.Files[file] = await File.ReadAllTextAsync(fullPath);
                        }
                    }
                }

                // 5. Read Game Installation files (config & autoexec)
                if (result.IsInstalled)
                {
                    string gameCfgPath = Path.Combine(cs2InstallPath, "game", "csgo", "cfg");
                    string[] gameFilesToRead = { "config.cfg", "autoexec.cfg" };

                    if (Directory.Exists(gameCfgPath))
                    {
                        foreach (var file in gameFilesToRead)
                        {
                            string fullPath = Path.Combine(gameCfgPath, file);
                            if (File.Exists(fullPath))
                            {
                                result.Files[file] = await File.ReadAllTextAsync(fullPath);
                            }
                        }
                    }
                }

                return new { success = true, data = result };
            }
            catch (Exception ex)
            {
                return new { error = ex.Message };
            }
        }

        public async Task<string> ApplyCs2ConfigAsync(string jsonPayload)
        {
            try
            {
                var data = JsonSerializer.Deserialize<Cs2ConfigData>(jsonPayload, _jsonOptions);
                if (data == null) return JsonSerializer.Serialize(new { error = "Invalid payload" });

                string steamPath = GetSteamPath();
                int activeUserId = GetActiveSteamId();
                if (string.IsNullOrEmpty(steamPath) || activeUserId <= 0)
                {
                    return JsonSerializer.Serialize(new { error = "Steam not found or no active user logged in." });
                }

                string userdataBase = Path.Combine(steamPath, "userdata");
                if (Directory.Exists(userdataBase))
                {
                    foreach (var userDir in Directory.GetDirectories(userdataBase))
                    {
                        string targetLocalCfg = Path.Combine(userDir, "730", "local", "cfg");
                        if (!Directory.Exists(targetLocalCfg)) Directory.CreateDirectory(targetLocalCfg);

                        string[] userFilesToRead = { "cs2_video.txt", "cs2_machine_convars.vcfg", "cs2_user_convars_0_slot0.vcfg" };
                        foreach (var file in userFilesToRead)
                        {
                            if (data.Files.ContainsKey(file) && data.Files[file] != null) // Allow empty string to trigger wipes
                            {
                                await File.WriteAllTextAsync(Path.Combine(targetLocalCfg, file), data.Files[file]);
                            }
                        }

                        // We must close Steam before touching localconfig.vdf, otherwise it overwrites our changes on exit.
                        if (!string.IsNullOrEmpty(data.LaunchOptions))
                        {
                            var steamProcesses = Process.GetProcessesByName("steam");
                            if (steamProcesses.Length > 0)
                            {
                                foreach (var p in steamProcesses)
                                {
                                    try { p.Kill(); p.WaitForExit(2000); } catch { }
                                }
                                await Task.Delay(500); // Give filesystem time to release locks
                            }

                            string targetLocalConfig = Path.Combine(userDir, "config", "localconfig.vdf");
                            if (File.Exists(targetLocalConfig))
                            {
                                string vdfContent = await File.ReadAllTextAsync(targetLocalConfig);
                                int appIndex = vdfContent.IndexOf($"\"{CS2_APP_ID}\"");
                                if (appIndex != -1)
                                {
                                    int len = Math.Min(3000, vdfContent.Length - appIndex);
                                    string chunk = vdfContent.Substring(appIndex, len);

                                    var match = Regex.Match(chunk, @"""LaunchOptions""\s*""([^""]*)""", RegexOptions.IgnoreCase);
                                    if (match.Success)
                                    {
                                        string oldVal = match.Groups[0].Value;
                                        string newVal = $"\"LaunchOptions\"\t\t\"{data.LaunchOptions}\"";
                                        string newChunk = chunk.Replace(oldVal, newVal);
                                        vdfContent = vdfContent.Remove(appIndex, len).Insert(appIndex, newChunk);
                                        await File.WriteAllTextAsync(targetLocalConfig, vdfContent);
                                    }
                                    else
                                    {
                                        int bracketIndex = vdfContent.IndexOf('{', appIndex);
                                        if (bracketIndex != -1)
                                        {
                                            string insertStr = $"\n\t\t\t\t\t\t\"LaunchOptions\"\t\t\"{data.LaunchOptions}\"";
                                            vdfContent = vdfContent.Insert(bracketIndex + 1, insertStr);
                                            await File.WriteAllTextAsync(targetLocalConfig, vdfContent);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                string cs2InstallPath = GetCs2InstallPath(steamPath);
                if (!string.IsNullOrEmpty(cs2InstallPath))
                {
                    string gameCfgPath = Path.Combine(cs2InstallPath, "game", "csgo", "cfg");
                    if (!Directory.Exists(gameCfgPath)) Directory.CreateDirectory(gameCfgPath);

                    string[] gameFilesToRead = { "config.cfg", "autoexec.cfg" };
                    foreach (var file in gameFilesToRead)
                    {
                        if (data.Files.ContainsKey(file) && data.Files[file] != null)
                        {
                            await File.WriteAllTextAsync(Path.Combine(gameCfgPath, file), data.Files[file]);
                        }
                    }
                }

                // Restart steam if we killed it earlier for LaunchOptions
                if (!string.IsNullOrEmpty(data.LaunchOptions))
                {
                    try
                    {
                        Process.Start(new ProcessStartInfo(Path.Combine(steamPath, "steam.exe")) { UseShellExecute = true });
                    }
                    catch { }
                }

                return JsonSerializer.Serialize(new { success = true });
            }
            catch (Exception ex)
            {
                return JsonSerializer.Serialize(new { error = ex.Message });
            }
        }

        private string GetSteamPath()
        {
            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(REG_STEAM_PATH))
            {
                if (key != null)
                {
                    return key.GetValue("SteamPath") as string;
                }
            }
            return null;
        }

        private int GetActiveSteamId()
        {
            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(REG_STEAM_ACTIVE))
            {
                if (key != null)
                {
                    object val = key.GetValue("ActiveUser");
                    if (val is int id) return id;
                }
            }
            return 0;
        }

        private string GetCs2InstallPath(string mainSteamPath)
        {
            // First check default
            string defaultPath = Path.Combine(mainSteamPath, "steamapps", "common", "Counter-Strike Global Offensive");
            if (Directory.Exists(defaultPath)) return defaultPath;

            // Check libraryfolders.vdf
            string vdfPath = Path.Combine(mainSteamPath, "steamapps", "libraryfolders.vdf");
            if (!File.Exists(vdfPath)) return null;

            string content = File.ReadAllText(vdfPath);
            
            // Simple VDF parser for paths containing 730
            // Format is roughly: 
            // "1" { "path" "D:\\SteamLibrary" ... "apps" { "730" "size" } }
            
            var blocks = content.Split(new[] { "\"path\"" }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var block in blocks)
            {
                if (block.Contains($"\"{CS2_APP_ID}\""))
                {
                    var match = Regex.Match(block, @"\s+""([^""]+)""");
                    if (match.Success)
                    {
                        string libPath = match.Groups[1].Value.Replace("\\\\", "\\");
                        string testPath = Path.Combine(libPath, "steamapps", "common", "Counter-Strike Global Offensive");
                        if (Directory.Exists(testPath))
                        {
                            return testPath;
                        }
                    }
                }
            }
            return null;
        }

        private string ExtractLaunchOptions(string vdfContent)
        {
            try 
            {
                // To avoid Catastrophic Regex Backtracking on huge VDF files, use index-based search.
                int appIndex = vdfContent.IndexOf($"\"{CS2_APP_ID}\"");
                if (appIndex == -1) return "";

                // Restrict chunk size to 3000 chars max so Regex doesn't hit catastrophic backtracking
                // if VDF file is huge.
                int len = Math.Min(3000, vdfContent.Length - appIndex);
                string chunk = vdfContent.Substring(appIndex, len);

                var match = Regex.Match(chunk, @"""LaunchOptions""\s*""([^""]+)""", RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    return match.Groups[1].Value;
                }
            }
            catch { }
            return "";
        }

        public async Task<string> InstallProConfigAsync(string zipUrl)
        {
            string tempDir = null;
            string zipPath = null;
            try
            {
                string steamPath = GetSteamPath();
                if (string.IsNullOrEmpty(steamPath))
                    return "Steam installation not found.";

                string cs2InstallPath = GetCs2InstallPath(steamPath);
                if (string.IsNullOrEmpty(cs2InstallPath))
                    return "CS2 installation directory not found.";

                string gameCfgPath = Path.Combine(cs2InstallPath, "game", "csgo", "cfg");
                if (!Directory.Exists(gameCfgPath))
                    Directory.CreateDirectory(gameCfgPath);

                tempDir = Path.Combine(Path.GetTempPath(), "TFY_Cs2ProConfig_" + Guid.NewGuid().ToString("N"));
                Directory.CreateDirectory(tempDir);
                zipPath = Path.Combine(tempDir, "config.zip");

                using (var handler = new System.Net.Http.HttpClientHandler { AutomaticDecompression = System.Net.DecompressionMethods.All })
                using (var client = new System.Net.Http.HttpClient(handler))
                {
                    client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
                    client.DefaultRequestHeaders.Add("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8");
                    client.DefaultRequestHeaders.Add("Accept-Encoding", "gzip, deflate, br");
                    using (var s = await client.GetStreamAsync(zipUrl))
                    using (var fs = new FileStream(zipPath, FileMode.CreateNew))
                    {
                        await s.CopyToAsync(fs);
                    }
                }

                System.IO.Compression.ZipFile.ExtractToDirectory(zipPath, tempDir, true);

                string[] cfgFiles = Directory.GetFiles(tempDir, "*.cfg", SearchOption.AllDirectories);
                int count = 0;
                foreach (string cfg in cfgFiles)
                {
                    string fileName = Path.GetFileName(cfg);
                    string targetPath = Path.Combine(gameCfgPath, fileName);
                    File.Copy(cfg, targetPath, true);
                    count++;
                }

                if (count == 0)
                {
                    return "Downloaded archive did not contain any .cfg files.";
                }

                return $"Successfully installed {count} configuration files!";
            }
            catch (Exception ex)
            {
                return $"Failed to install config: {ex.Message}";
            }
            finally
            {
                try
                {
                    if (zipPath != null && File.Exists(zipPath)) File.Delete(zipPath);
                    if (tempDir != null && Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
                }
                catch { }
            }
        }
    }
}
