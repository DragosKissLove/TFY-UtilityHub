using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace TFY.Services
{
    public static class RobloxService
    {
        private static Mutex _robloxSingletonMutex;
        private static Mutex _robloxSingletonEventMutex;
        private static bool _isMultiInstanceActive = false;
        private static bool _isAntiAfkActive = false;
        private static CancellationTokenSource _antiAfkCts;
        private static readonly HttpClient _httpClient = new HttpClient(new SocketsHttpHandler
        {
            UseCookies = false,
            AutomaticDecompression = DecompressionMethods.All,
            AllowAutoRedirect = true
        });
        private static readonly ConcurrentDictionary<string, (string token, long ts)> _csrfCache = new ConcurrentDictionary<string, (string, long)>();

        public static bool IsMultiInstanceActive => _isMultiInstanceActive;
        public static bool IsAntiAfkActive => _isAntiAfkActive;

        static RobloxService()
        {
            _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36");
        }

        public static string CleanCookie(string cookie)
        {
            if (string.IsNullOrWhiteSpace(cookie)) return "";
            string c = cookie.Trim();
            if (c.StartsWith(".ROBLOSECURITY=", StringComparison.OrdinalIgnoreCase))
            {
                c = c.Substring(".ROBLOSECURITY=".Length);
            }
            c = c.Trim(' ', ';', '"', '\'', '\r', '\n', '\t');
            if (c.StartsWith(".ROBLOSECURITY=", StringComparison.OrdinalIgnoreCase))
            {
                c = c.Substring(".ROBLOSECURITY=".Length);
            }
            return c.Trim();
        }

        #region Multi-Instance Mutex & Handle Closer

        public static bool ToggleMultiInstance(out string message)
        {
            if (_isMultiInstanceActive)
            {
                try
                {
                    _robloxSingletonMutex?.ReleaseMutex();
                    _robloxSingletonMutex?.Dispose();
                    _robloxSingletonMutex = null;

                    _robloxSingletonEventMutex?.ReleaseMutex();
                    _robloxSingletonEventMutex?.Dispose();
                    _robloxSingletonEventMutex = null;

                    _isMultiInstanceActive = false;
                    message = "Multi-Instance Roblox is now Disabled.";
                    return false;
                }
                catch
                {
                    _isMultiInstanceActive = false;
                    _robloxSingletonMutex = null;
                    _robloxSingletonEventMutex = null;
                    message = "Disabled Multi-Instance Roblox.";
                    return false;
                }
            }
            else
            {
                try
                {
                    bool created;
                    _robloxSingletonMutex = new Mutex(true, "ROBLOX_singletonMutex", out created);
                    if (!created)
                    {
                        try { _robloxSingletonMutex.WaitOne(0); } catch { }
                    }

                    CloseRobloxSingletonHandles();

                    _robloxSingletonEventMutex = new Mutex(true, "ROBLOX_singletonEvent", out created);
                    if (!created)
                    {
                        try { _robloxSingletonEventMutex.WaitOne(0); } catch { }
                    }

                    _isMultiInstanceActive = true;
                    message = "Multi-Instance Roblox is now Active! You can run unlimited Roblox accounts simultaneously.";
                    return true;
                }
                catch (Exception ex)
                {
                    _isMultiInstanceActive = false;
                    message = "Failed to enable Multi-Instance: " + ex.Message;
                    return false;
                }
            }
        }

        public static void EnsureMultiInstance()
        {
            if (!_isMultiInstanceActive)
            {
                ToggleMultiInstance(out _);
            }
            else
            {
                CloseRobloxSingletonHandles();
            }
        }

        public static void CloseRobloxSingletonHandles()
        {
            try
            {
                var processes = Process.GetProcessesByName("RobloxPlayerBeta");
                foreach (var proc in processes)
                {
                    try
                    {
                        CloseProcessHandles(proc.Id, "ROBLOX_singletonEvent");
                    }
                    catch { }
                }
            }
            catch { }
        }

        private static void CloseProcessHandles(int pid, string matchName)
        {
            IntPtr hProcess = OpenProcess(PROCESS_DUP_HANDLE | PROCESS_QUERY_INFORMATION, false, pid);
            if (hProcess == IntPtr.Zero) return;

            try
            {
                int bufferSize = 0x10000;
                IntPtr pInfo = Marshal.AllocHGlobal(bufferSize);
                int returnLength;

                while (NtQuerySystemInformation(SYSTEM_EXTENDED_HANDLE_INFORMATION, pInfo, bufferSize, out returnLength) == STATUS_INFO_LENGTH_MISMATCH)
                {
                    Marshal.FreeHGlobal(pInfo);
                    bufferSize = returnLength + 0x10000;
                    pInfo = Marshal.AllocHGlobal(bufferSize);
                }

                long handleCount = Marshal.ReadInt64(pInfo);
                IntPtr pHandle = new IntPtr(pInfo.ToInt64() + 16);

                for (long i = 0; i < handleCount; i++)
                {
                    SYSTEM_HANDLE_TABLE_ENTRY_INFO_EX entry = Marshal.PtrToStructure<SYSTEM_HANDLE_TABLE_ENTRY_INFO_EX>(pHandle);
                    pHandle = new IntPtr(pHandle.ToInt64() + Marshal.SizeOf<SYSTEM_HANDLE_TABLE_ENTRY_INFO_EX>());

                    if (entry.UniqueProcessId == (IntPtr)pid)
                    {
                        IntPtr dupHandle = IntPtr.Zero;
                        if (NtDuplicateObject(hProcess, (IntPtr)entry.HandleValue, GetCurrentProcess(), out dupHandle, 0, 0, 2) == 0) // DUPLICATE_SAME_ACCESS
                        {
                            string name = GetObjectName(dupHandle);
                            if (!string.IsNullOrEmpty(name) && name.IndexOf(matchName, StringComparison.OrdinalIgnoreCase) >= 0)
                            {
                                // Close the remote handle
                                IntPtr closedHandle = IntPtr.Zero;
                                NtDuplicateObject(hProcess, (IntPtr)entry.HandleValue, IntPtr.Zero, out closedHandle, 0, 0, 1); // DUPLICATE_CLOSE_SOURCE
                            }
                            CloseHandle(dupHandle);
                        }
                    }
                }

                Marshal.FreeHGlobal(pInfo);
            }
            catch { }
            finally
            {
                CloseHandle(hProcess);
            }
        }

        private static string GetObjectName(IntPtr handle)
        {
            int length = 0x400;
            IntPtr pName = Marshal.AllocHGlobal(length);
            try
            {
                int retLen;
                if (NtQueryObject(handle, ObjectNameInformation, pName, length, out retLen) == 0)
                {
                    UNICODE_STRING us = Marshal.PtrToStructure<UNICODE_STRING>(pName);
                    if (us.Buffer != IntPtr.Zero && us.Length > 0)
                    {
                        return Marshal.PtrToStringUni(us.Buffer, us.Length / 2);
                    }
                }
            }
            catch { }
            finally
            {
                Marshal.FreeHGlobal(pName);
            }
            return null;
        }

        #endregion

        #region Anti-AFK Engine

        public static bool ToggleAntiAfk(int intervalSeconds, out string message)
        {
            if (_isAntiAfkActive)
            {
                _antiAfkCts?.Cancel();
                _antiAfkCts?.Dispose();
                _antiAfkCts = null;
                _isAntiAfkActive = false;
                message = "Anti-AFK Disabled.";
                return false;
            }
            else
            {
                _antiAfkCts = new CancellationTokenSource();
                _isAntiAfkActive = true;
                int safeInterval = Math.Clamp(intervalSeconds, 30, 1140);
                Task.Run(() => RunAntiAfkLoop(safeInterval, _antiAfkCts.Token));
                message = $"Anti-AFK Activated! Tapping Roblox instances every {safeInterval} seconds.";
                return true;
            }
        }

        private static async Task RunAntiAfkLoop(int intervalSeconds, CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(intervalSeconds * 1000, token);
                    if (token.IsCancellationRequested) break;

                    var processes = Process.GetProcessesByName("RobloxPlayerBeta");
                    foreach (var proc in processes)
                    {
                        try
                        {
                            IntPtr hWnd = proc.MainWindowHandle;
                            if (hWnd != IntPtr.Zero)
                            {
                                PostMessage(hWnd, WM_KEYDOWN, (IntPtr)VK_SHIFT, IntPtr.Zero);
                                await Task.Delay(50, token);
                                PostMessage(hWnd, WM_KEYUP, (IntPtr)VK_SHIFT, IntPtr.Zero);
                            }
                        }
                        catch { }
                    }
                }
                catch (TaskCanceledException) { break; }
                catch { }
            }
            _isAntiAfkActive = false;
        }

        #endregion

        #region Discord Webhook

        public static async Task<(bool ok, string error)> SendDiscordWebhookAsync(string webhookUrl, string messageText, string connectedAccounts = "")
        {
            if (string.IsNullOrWhiteSpace(webhookUrl))
            {
                return (false, "Discord Webhook URL is empty.");
            }

            try
            {
                int count = GetRunningRobloxCount();
                var fieldsList = new List<object>
                {
                    new { name = "<:checkwhite:1522355854928642249> Active Instances", value = $"**{count}** Process(es) Running", @inline = true },
                    new { name = "🛡️ Multi-Instance", value = IsMultiInstanceActive ? "<:checkwhite:1522355854928642249> `ENABLED`" : "<:xwhite:1522355766122512645> `DISABLED`", @inline = true },
                    new { name = "⚡ Anti-AFK Shield", value = IsAntiAfkActive ? "<:checkwhite:1522355854928642249> `ACTIVE (20m)`" : "<:xwhite:1522355766122512645> `OFF`", @inline = true }
                };

                if (!string.IsNullOrWhiteSpace(connectedAccounts))
                {
                    fieldsList.Add(new { name = "<:starsilver:1522356076324851732> Connected Accounts", value = connectedAccounts, @inline = false });
                }

                long nowUnix = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                fieldsList.Add(new { name = "⏱️ Host Heartbeat", value = $"<t:{nowUnix}:R> • <t:{nowUnix}:T>", @inline = true });
                fieldsList.Add(new { name = "🚀 Engine Hub", value = "`TFY Tool v6.3.2`", @inline = true });
                
                if (!string.IsNullOrWhiteSpace(messageText) && messageText != "15-Minute Periodic Health Status" && messageText != "TFY MultiRoblox Status Ping" && messageText != "Manual Status Ping")
                {
                    fieldsList.Add(new { name = "📝 Note", value = messageText, @inline = false });
                }

                var payload = new
                {
                    username = "TFY Utility Hub",
                    embeds = new[]
                    {
                        new
                        {
                            title = "MultiRoblox Live Operations Monitor",
                            color = 0x2b2d31, // Premium Dark
                            fields = fieldsList.ToArray(),
                            footer = new 
                            { 
                                text = "TFY Utility Hub • v6.3.2"
                            },
                            timestamp = DateTime.UtcNow.ToString("o")
                        }
                    }
                };

                var content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");
                var resp = await _httpClient.PostAsync(webhookUrl.Trim(), content);

                if (resp.IsSuccessStatusCode)
                {
                    return (true, "");
                }
                else
                {
                    string err = await resp.Content.ReadAsStringAsync();
                    return (false, $"Discord API error ({(int)resp.StatusCode}): {err}");
                }
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        }

        #endregion

        #region Process & Audio Management

        public static int KillAllRobloxInstances()
        {
            int killedCount = 0;
            try
            {
                var processes = Process.GetProcessesByName("RobloxPlayerBeta");
                foreach (var p in processes)
                {
                    try
                    {
                        p.Kill();
                        killedCount++;
                    }
                    catch { }
                }
            }
            catch { }
            return killedCount;
        }

        public static bool KillRobloxProcess(int pid)
        {
            try
            {
                var p = Process.GetProcessById(pid);
                if (p.ProcessName.Equals("RobloxPlayerBeta", StringComparison.OrdinalIgnoreCase))
                {
                    p.Kill();
                    return true;
                }
            }
            catch { }
            return false;
        }

        public static int GetRunningRobloxCount()
        {
            try
            {
                return Process.GetProcessesByName("RobloxPlayerBeta").Length;
            }
            catch
            {
                return 0;
            }
        }

        public static List<int> GetRunningRobloxPids()
        {
            var pids = new List<int>();
            try
            {
                foreach (var p in Process.GetProcessesByName("RobloxPlayerBeta"))
                {
                    pids.Add(p.Id);
                }
            }
            catch { }
            return pids;
        }

        public static bool TrimMemory(int? pid = null)
        {
            try
            {
                if (pid.HasValue)
                {
                    var p = Process.GetProcessById(pid.Value);
                    SetProcessWorkingSetSize(p.Handle, -1, -1);
                    return true;
                }
                else
                {
                    foreach (var p in Process.GetProcessesByName("RobloxPlayerBeta"))
                    {
                        try { SetProcessWorkingSetSize(p.Handle, -1, -1); } catch { }
                    }
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }

        public static bool SetProcessPriority(int pid, string priorityName)
        {
            try
            {
                var p = Process.GetProcessById(pid);
                ProcessPriorityClass prio = ProcessPriorityClass.Normal;
                switch (priorityName.ToLowerInvariant())
                {
                    case "realtime": prio = ProcessPriorityClass.RealTime; break;
                    case "high": prio = ProcessPriorityClass.High; break;
                    case "abovenormal": prio = ProcessPriorityClass.AboveNormal; break;
                    case "normal": prio = ProcessPriorityClass.Normal; break;
                    case "belownormal": prio = ProcessPriorityClass.BelowNormal; break;
                    case "low": prio = ProcessPriorityClass.Idle; break;
                }
                p.PriorityClass = prio;
                return true;
            }
            catch
            {
                return false;
            }
        }

        public static bool SetRobloxVolume(int volumePercent)
        {
            float level = Math.Clamp(volumePercent, 0, 100) / 100.0f;
            try
            {
                IMMDeviceEnumerator deviceEnumerator = (IMMDeviceEnumerator)(new MMDeviceEnumerator());
                IMMDevice speakers;
                int hr = deviceEnumerator.GetDefaultAudioEndpoint(EDataFlow.eRender, ERole.eMultimedia, out speakers);
                if (hr != 0 || speakers == null) return false;

                Guid IID_IAudioSessionManager2 = typeof(IAudioSessionManager2).GUID;
                object o;
                speakers.Activate(ref IID_IAudioSessionManager2, 0, IntPtr.Zero, out o);
                IAudioSessionManager2 mgr = (IAudioSessionManager2)o;

                IAudioSessionEnumerator sessionEnumerator;
                mgr.GetSessionEnumerator(out sessionEnumerator);
                if (sessionEnumerator == null) return false;

                int count;
                sessionEnumerator.GetCount(out count);

                var robloxPids = new HashSet<int>(GetRunningRobloxPids());

                for (int i = 0; i < count; i++)
                {
                    try
                    {
                        IAudioSessionControl ctl;
                        sessionEnumerator.GetSession(i, out ctl);
                        if (ctl == null) continue;

                        IAudioSessionControl2 ctl2 = (IAudioSessionControl2)ctl;
                        int pid;
                        ctl2.GetProcessId(out pid);

                        bool isRoblox = robloxPids.Contains(pid);
                        if (!isRoblox && pid > 0)
                        {
                            try
                            {
                                string pName = Process.GetProcessById(pid).ProcessName;
                                if (pName.Equals("RobloxPlayerBeta", StringComparison.OrdinalIgnoreCase)) isRoblox = true;
                            }
                            catch { }
                        }

                        if (isRoblox)
                        {
                            ISimpleAudioVolume vol = (ISimpleAudioVolume)ctl;
                            Guid empty = Guid.Empty;
                            vol.SetMasterVolume(level, ref empty);
                            bool isMute = volumePercent <= 0;
                            vol.SetMute(isMute, ref empty);
                        }
                    }
                    catch { }
                }
                return true;
            }
            catch
            {
                return false;
            }
        }

        #endregion

        #region FastFlags & Settings

        public static bool SetFpsCap(int targetFps, out string message)
        {
            try
            {
                string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string[] roots = { "Roblox", "Bloxstrap", "Froststrap", "Voidstrap", "Fishstrap" };

                int updatedCount = 0;
                foreach (var root in roots)
                {
                    string rootFolder = Path.Combine(localAppData, root);
                    if (!Directory.Exists(rootFolder)) continue;

                    // 1. Check Modifications/ClientSettings
                    string modSettingsDir = Path.Combine(rootFolder, "Modifications", "ClientSettings");
                    try
                    {
                        if (!Directory.Exists(modSettingsDir)) Directory.CreateDirectory(modSettingsDir);
                        string modConfigFile = Path.Combine(modSettingsDir, "ClientAppSettings.json");
                        JObject json = new JObject();
                        if (File.Exists(modConfigFile))
                        {
                            try { json = JObject.Parse(File.ReadAllText(modConfigFile)); } catch { }
                        }
                        json["DFIntTaskSchedulerTargetFps"] = targetFps;
                        File.WriteAllText(modConfigFile, json.ToString(Formatting.Indented));
                        updatedCount++;
                    }
                    catch { }

                    // 2. Check ClientSettings in root
                    string rootSettingsDir = Path.Combine(rootFolder, "ClientSettings");
                    try
                    {
                        if (!Directory.Exists(rootSettingsDir)) Directory.CreateDirectory(rootSettingsDir);
                        string rootConfigFile = Path.Combine(rootSettingsDir, "ClientAppSettings.json");
                        JObject json = new JObject();
                        if (File.Exists(rootConfigFile))
                        {
                            try { json = JObject.Parse(File.ReadAllText(rootConfigFile)); } catch { }
                        }
                        json["DFIntTaskSchedulerTargetFps"] = targetFps;
                        File.WriteAllText(rootConfigFile, json.ToString(Formatting.Indented));
                        updatedCount++;
                    }
                    catch { }

                    // 3. Check all version folders
                    string versionsFolder = Path.Combine(rootFolder, "Versions");
                    if (Directory.Exists(versionsFolder))
                    {
                        foreach (var versionDir in Directory.GetDirectories(versionsFolder, "version-*"))
                        {
                            try
                            {
                                string clientSettingsDir = Path.Combine(versionDir, "ClientSettings");
                                if (!Directory.Exists(clientSettingsDir)) Directory.CreateDirectory(clientSettingsDir);

                                string configFile = Path.Combine(clientSettingsDir, "ClientAppSettings.json");
                                JObject json = new JObject();
                                if (File.Exists(configFile))
                                {
                                    try { json = JObject.Parse(File.ReadAllText(configFile)); } catch { }
                                }

                                json["DFIntTaskSchedulerTargetFps"] = targetFps;
                                File.WriteAllText(configFile, json.ToString(Formatting.Indented));
                                updatedCount++;
                            }
                            catch { }
                        }
                    }

                    // GlobalBasicSettings_13.xml
                    string globalXml = Path.Combine(rootFolder, "GlobalBasicSettings_13.xml");
                    if (File.Exists(globalXml))
                    {
                        try
                        {
                            string xml = File.ReadAllText(globalXml);
                            string replacement = $"<int name=\"FramerateCap\">{targetFps}</int>";
                            if (Regex.IsMatch(xml, @"(?i)<int\s+name=""FramerateCap""\s*>\d+</int>"))
                            {
                                xml = Regex.Replace(xml, @"(?i)<int\s+name=""FramerateCap""\s*>\d+</int>", replacement);
                            }
                            else
                            {
                                xml = xml.Replace("</Item>", $"\t\t{replacement}\n</Item>");
                            }
                            File.WriteAllText(globalXml, xml);
                        }
                        catch { }
                    }
                }

                message = $"Target FPS configured to {(targetFps == 9999 ? "Unlimited" : targetFps.ToString())} FPS.";
                return true;
            }
            catch (Exception ex)
            {
                message = "Failed to update FPS: " + ex.Message;
                return false;
            }
        }

        public static bool SetGraphicsQuality(int qualityLevel, bool auto, out string message)
        {
            try
            {
                string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string[] roots = { "Roblox", "Bloxstrap", "Froststrap", "Voidstrap", "Fishstrap" };

                foreach (var root in roots)
                {
                    string rootFolder = Path.Combine(localAppData, root);
                    if (!Directory.Exists(rootFolder)) continue;

                    // 1. Modifications/ClientSettings
                    string modSettingsDir = Path.Combine(rootFolder, "Modifications", "ClientSettings");
                    try
                    {
                        if (!Directory.Exists(modSettingsDir)) Directory.CreateDirectory(modSettingsDir);
                        string modConfigFile = Path.Combine(modSettingsDir, "ClientAppSettings.json");
                        JObject json = new JObject();
                        if (File.Exists(modConfigFile))
                        {
                            try { json = JObject.Parse(File.ReadAllText(modConfigFile)); } catch { }
                        }
                        if (auto)
                        {
                            json.Remove("FIntRomRenderingQualityLevel");
                        }
                        else
                        {
                            json["FIntRomRenderingQualityLevel"] = qualityLevel;
                        }
                        File.WriteAllText(modConfigFile, json.ToString(Formatting.Indented));
                    }
                    catch { }

                    // 2. All version folders
                    string versionsFolder = Path.Combine(rootFolder, "Versions");
                    if (Directory.Exists(versionsFolder))
                    {
                        foreach (var versionDir in Directory.GetDirectories(versionsFolder, "version-*"))
                        {
                            try
                            {
                                string clientSettingsDir = Path.Combine(versionDir, "ClientSettings");
                                if (!Directory.Exists(clientSettingsDir)) Directory.CreateDirectory(clientSettingsDir);

                                string configFile = Path.Combine(clientSettingsDir, "ClientAppSettings.json");
                                JObject json = new JObject();
                                if (File.Exists(configFile))
                                {
                                    try { json = JObject.Parse(File.ReadAllText(configFile)); } catch { }
                                }

                                if (auto)
                                {
                                    json.Remove("FIntRomRenderingQualityLevel");
                                }
                                else
                                {
                                    json["FIntRomRenderingQualityLevel"] = qualityLevel;
                                }

                                File.WriteAllText(configFile, json.ToString(Formatting.Indented));
                            }
                            catch { }
                        }
                    }
                }

                message = auto ? "Graphics set to Auto" : $"Graphics Quality set to Level {qualityLevel}";
                return true;
            }
            catch (Exception ex)
            {
                message = ex.Message;
                return false;
            }
        }

        #endregion

        #region Roblox Web API & Launch

        public static async Task<JObject> ResolveGameInfoAsync(string placeId)
        {
            if (string.IsNullOrWhiteSpace(placeId) || !long.TryParse(placeId.Trim(), out _))
            {
                return new JObject { ["ok"] = false, ["error"] = "Invalid Place ID" };
            }

            string pid = placeId.Trim();
            try
            {
                // Step 1: Public Universe ID resolution
                string uResp = await _httpClient.GetStringAsync($"https://apis.roblox.com/universes/v1/places/{pid}/universe");
                var uJson = JObject.Parse(uResp);
                string universeId = uJson["universeId"]?.ToString();

                if (string.IsNullOrEmpty(universeId))
                {
                    return new JObject { ["ok"] = false, ["placeId"] = pid, ["error"] = "Universe not found" };
                }

                // Step 2: Public Game Details resolution
                string gResp = await _httpClient.GetStringAsync($"https://games.roblox.com/v1/games?universeIds={universeId}");
                var gJson = JObject.Parse(gResp);
                var gameData = gJson["data"]?[0];
                string name = gameData?["name"]?.ToString() ?? "Unknown Game";

                // Step 3: Optional Game Icon Thumbnail
                string thumbnail = "";
                try
                {
                    var thumbResp = await _httpClient.GetStringAsync($"https://thumbnails.roblox.com/v1/games/icons?universeIds={universeId}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false");
                    var thumbJson = JObject.Parse(thumbResp);
                    thumbnail = thumbJson["data"]?[0]?["imageUrl"]?.ToString() ?? "";
                }
                catch { }

                return new JObject
                {
                    ["ok"] = true,
                    ["placeId"] = pid,
                    ["name"] = name,
                    ["universeId"] = universeId,
                    ["thumbnail"] = thumbnail
                };
            }
            catch (Exception ex)
            {
                return new JObject { ["ok"] = false, ["placeId"] = pid, ["error"] = ex.Message };
            }
        }

        public static async Task<JObject> ValidateCookieAsync(string rawCookie)
        {
            string cookie = CleanCookie(rawCookie);
            if (string.IsNullOrEmpty(cookie))
            {
                return new JObject { ["ok"] = false, ["error"] = "Empty cookie" };
            }

            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, "https://users.roblox.com/v1/users/authenticated");
                req.Headers.Add("Cookie", $".ROBLOSECURITY={cookie}");
                var resp = await _httpClient.SendAsync(req);
                var content = await resp.Content.ReadAsStringAsync();

                if (resp.IsSuccessStatusCode)
                {
                    var data = JObject.Parse(content);
                    string userId = data["id"]?.ToString();
                    string username = data["name"]?.ToString();
                    string displayName = data["displayName"]?.ToString();

                    // Get headshot avatar
                    string avatarUrl = "";
                    try
                    {
                        var avatarResp = await _httpClient.GetStringAsync($"https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds={userId}&size=150x150&format=Png&isCircular=false");
                        var avatarJson = JObject.Parse(avatarResp);
                        avatarUrl = avatarJson["data"]?[0]?["imageUrl"]?.ToString() ?? "";
                    }
                    catch { }

                    return new JObject
                    {
                        ["ok"] = true,
                        ["userId"] = userId,
                        ["username"] = username,
                        ["displayName"] = displayName,
                        ["avatarUrl"] = avatarUrl
                    };
                }
                else
                {
                    return new JObject { ["ok"] = false, ["error"] = "Invalid or expired cookie. Please re-check the .ROBLOSECURITY string." };
                }
            }
            catch (Exception ex)
            {
                return new JObject { ["ok"] = false, ["error"] = ex.Message };
            }
        }

        public static async Task<string> GetAuthTicketViaBrowserAsync(Microsoft.Web.WebView2.Wpf.WebView2 browser)
        {
            if (browser?.CoreWebView2 == null) return null;
            try
            {
                string js = @"(async () => {
                    try {
                        let csrf = '';
                        const csrfRes = await fetch('https://auth.roblox.com/v2/logout', { method: 'POST', credentials: 'include' });
                        csrf = csrfRes.headers.get('x-csrf-token') || '';
                        if (!csrf) {
                            const csrfRes2 = await fetch('https://auth.roblox.com/v1/logout', { method: 'POST', credentials: 'include' });
                            csrf = csrfRes2.headers.get('x-csrf-token') || '';
                        }
                        const res = await fetch('https://auth.roblox.com/v1/authentication-ticket', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf },
                            credentials: 'include'
                        });
                        return res.headers.get('rbx-authentication-ticket') || '';
                    } catch (e) {
                        return '';
                    }
                })()";
                string resultJson = await browser.CoreWebView2.ExecuteScriptAsync(js);
                if (!string.IsNullOrEmpty(resultJson))
                {
                    string ticket = JsonConvert.DeserializeObject<string>(resultJson);
                    if (!string.IsNullOrEmpty(ticket) && ticket.Length > 20)
                    {
                        return ticket;
                    }
                }
            }
            catch { }
            return null;
        }

        public static async Task<string> GetCsrfTokenAsync(string rawCookie)
        {
            string cookie = CleanCookie(rawCookie);
            if (string.IsNullOrEmpty(cookie)) return null;

            long now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            if (_csrfCache.TryGetValue(cookie, out var entry) && now - entry.ts < 300000)
            {
                return entry.token;
            }

            // CRITICAL: /v2/logout and /v1/logout return 401 WITHOUT x-csrf-token.
            // /v2/login ALWAYS returns 403 WITH x-csrf-token, even without a cookie.
            // /v1/authentication-ticket also returns 403 with x-csrf-token when cookie is valid.
            string[] endpoints = {
                "https://auth.roblox.com/v2/login",
                "https://auth.roblox.com/v1/authentication-ticket",
                "https://friends.roblox.com/v1/users/1/request-friendship"
            };
            foreach (var url in endpoints)
            {
                try
                {
                    using var req = new HttpRequestMessage(HttpMethod.Post, url);
                    req.Headers.TryAddWithoutValidation("Cookie", $".ROBLOSECURITY={cookie}");
                    req.Headers.TryAddWithoutValidation("Origin", "https://www.roblox.com");
                    req.Headers.TryAddWithoutValidation("Referer", "https://www.roblox.com/");
                    req.Headers.TryAddWithoutValidation("Accept", "application/json, text/plain, */*");
                    req.Content = new ByteArrayContent(Array.Empty<byte>());
                    req.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");

                    var resp = await _httpClient.SendAsync(req);
                    if (resp.Headers.TryGetValues("x-csrf-token", out var tokens))
                    {
                        string token = tokens.FirstOrDefault();
                        if (!string.IsNullOrEmpty(token))
                        {
                            _csrfCache[cookie] = (token, now);
                            return token;
                        }
                    }
                }
                catch { }
            }

            return null;
        }

        public static async Task<(bool ok, string ticket, string error)> GetAuthTicketAsync(string rawCookie)
        {
            string cookie = CleanCookie(rawCookie);
            if (string.IsNullOrEmpty(cookie)) return (false, null, "Empty cookie");

            string csrf = await GetCsrfTokenAsync(cookie);

            int[] delays = { 0, 1500, 3000 };
            for (int attempt = 0; attempt < 3; attempt++)
            {
                if (delays[attempt] > 0)
                {
                    await Task.Delay(delays[attempt]);
                }

                try
                {
                    using var req = new HttpRequestMessage(HttpMethod.Post, "https://auth.roblox.com/v1/authentication-ticket");
                    req.Headers.TryAddWithoutValidation("Cookie", $".ROBLOSECURITY={cookie}");
                    req.Headers.TryAddWithoutValidation("Origin", "https://www.roblox.com");
                    req.Headers.TryAddWithoutValidation("Referer", "https://www.roblox.com/");
                    req.Headers.TryAddWithoutValidation("Accept", "application/json, text/plain, */*");
                    if (!string.IsNullOrEmpty(csrf))
                    {
                        req.Headers.TryAddWithoutValidation("X-CSRF-TOKEN", csrf);
                    }
                    req.Content = new ByteArrayContent(Array.Empty<byte>());
                    req.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");

                    var resp = await _httpClient.SendAsync(req);

                    // First check for ticket in response (success case)
                    if (resp.Headers.TryGetValues("rbx-authentication-ticket", out var tickets))
                    {
                        string ticket = tickets.FirstOrDefault();
                        if (!string.IsNullOrEmpty(ticket))
                        {
                            return (true, ticket, "");
                        }
                    }

                    if ((int)resp.StatusCode == 403)
                    {
                        if (resp.Headers.TryGetValues("x-csrf-token", out var newTokens))
                        {
                            csrf = newTokens.FirstOrDefault();
                            if (!string.IsNullOrEmpty(csrf))
                            {
                                _csrfCache[cookie] = (csrf, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
                                continue;
                            }
                        }
                        _csrfCache.TryRemove(cookie, out _);
                        csrf = await GetCsrfTokenAsync(cookie);
                        continue;
                    }

                    if ((int)resp.StatusCode == 429)
                    {
                        _csrfCache.TryRemove(cookie, out _);
                        await Task.Delay(3000);
                        csrf = await GetCsrfTokenAsync(cookie);
                        continue;
                    }

                    if ((int)resp.StatusCode == 401)
                    {
                        if (attempt == 0)
                        {
                            _csrfCache.TryRemove(cookie, out _);
                            csrf = await GetCsrfTokenAsync(cookie);
                            continue;
                        }
                    }
                }
                catch (Exception ex)
                {
                    if (attempt == 2) return (false, null, ex.Message);
                }
            }

            return (false, null, "Failed to retrieve authentication ticket from Roblox servers. Please re-login with Browser Sign-In.");
        }

        public static async Task<(bool success, int pid, string error)> LaunchAccountAsync(string rawCookie, string target, string explicitTicket = null, string preferredLauncher = null)
        {
            EnsureMultiInstance();
            string cookie = CleanCookie(rawCookie);

            string ticket = !string.IsNullOrEmpty(explicitTicket) ? explicitTicket : null;
            if (string.IsNullOrEmpty(ticket) && !string.IsNullOrWhiteSpace(cookie))
            {
                var (ticketOk, authTicket, ticketErr) = await GetAuthTicketAsync(cookie);
                if (ticketOk && !string.IsNullOrEmpty(authTicket))
                {
                    ticket = authTicket;
                }
                else
                {
                    return (false, 0, ticketErr ?? "Roblox authentication failed. Please re-login via Browser Sign-In.");
                }
            }

            long launchTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            long browserTrackerId = new Random().Next(100000000, 999999999);
            string launcherUrl = "https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestGame&isPlayTogetherGame=false";

            string t = target?.Trim() ?? "";
            if (!string.IsNullOrEmpty(t))
            {
                if (long.TryParse(t, out long pidNum))
                {
                    launcherUrl = $"https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestGame&placeId={pidNum}&isPlayTogetherGame=false";
                }
                else if (t.Contains("http") || t.Contains("roblox.com"))
                {
                    try
                    {
                        var uri = new Uri(t);
                        var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
                        string placeId = query["placeId"];
                        string privateCode = query["privateServerLinkCode"] ?? query["code"];
                        string jobId = query["jobId"] ?? query["gameInstanceId"];

                        if (string.IsNullOrEmpty(placeId))
                        {
                            var match = Regex.Match(uri.AbsolutePath, @"/games/(\d+)");
                            if (match.Success) placeId = match.Groups[1].Value;
                        }

                        if (!string.IsNullOrEmpty(jobId) && !string.IsNullOrEmpty(placeId))
                        {
                            launcherUrl = $"https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestGameJob&placeId={placeId}&gameId={jobId}&isPlayTogetherGame=false";
                        }
                        else if (!string.IsNullOrEmpty(privateCode) && !string.IsNullOrEmpty(placeId))
                        {
                            launcherUrl = $"https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestPrivateGame&placeId={placeId}&linkCode={privateCode}&isPlayTogetherGame=false";
                        }
                        else if (!string.IsNullOrEmpty(placeId))
                        {
                            launcherUrl = $"https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestGame&placeId={placeId}&isPlayTogetherGame=false";
                        }
                    }
                    catch { }
                }
            }

            string encodedUrl = Uri.EscapeDataString(launcherUrl);
            string robloxUri = !string.IsNullOrEmpty(ticket)
                ? $"roblox-player:1+launchmode:play+gameinfo:{ticket}+launchtime:{launchTime}+placelauncherurl:{encodedUrl}+browsertrackerid:{browserTrackerId}+robloxLocale:en_us+gameLocale:en_us+channel:+LaunchExp:InApp"
                : $"roblox-player:1+launchmode:play+launchtime:{launchTime}+placelauncherurl:{encodedUrl}+browsertrackerid:{browserTrackerId}+robloxLocale:en_us+gameLocale:en_us+channel:+LaunchExp:InApp";

            string robloxWebviewData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Roblox", "WebView2");
            try { Directory.CreateDirectory(robloxWebviewData); } catch { }
            try { Environment.SetEnvironmentVariable("WEBVIEW2_USER_DATA_FOLDER", robloxWebviewData, EnvironmentVariableTarget.Process); } catch { }
            try { Environment.SetEnvironmentVariable("WEBVIEW2_USER_DATA_FOLDER", robloxWebviewData, EnvironmentVariableTarget.User); } catch { }

            // Find bootstrapper / executable (Fishstrap, Bloxstrap, Voidstrap, Froststrap, RobloxPlayerBeta)
            string robloxExe = FindLatestRobloxPlayer(preferredLauncher);
            if (!string.IsNullOrEmpty(robloxExe) && File.Exists(robloxExe))
            {
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = robloxExe,
                        Arguments = robloxUri,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };
                    psi.EnvironmentVariables["WEBVIEW2_USER_DATA_FOLDER"] = robloxWebviewData;
                    var p = Process.Start(psi);

                    return (true, p?.Id ?? 0, "");
                }
                catch (Exception ex)
                {
                    // Fallback to ShellExecute
                    try
                    {
                        var psi2 = new ProcessStartInfo
                        {
                            FileName = robloxUri,
                            UseShellExecute = true
                        };
                        var p2 = Process.Start(psi2);
                        return (true, p2?.Id ?? 0, "");
                    }
                    catch
                    {
                        return (false, 0, ex.Message);
                    }
                }
            }
            else
            {
                try
                {
                    var psi3 = new ProcessStartInfo
                    {
                        FileName = robloxUri,
                        UseShellExecute = true
                    };
                    var p = Process.Start(psi3);
                    return (true, p?.Id ?? 0, "");
                }
                catch (Exception ex)
                {
                    return (false, 0, ex.Message);
                }
            }
        }

        public static string GetRegistryProtocolHandlerExe()
        {
            try
            {
                using var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Classes\roblox-player\shell\open\command") 
                             ?? Microsoft.Win32.Registry.ClassesRoot.OpenSubKey(@"roblox-player\shell\open\command");
                if (key != null)
                {
                    string cmd = key.GetValue("")?.ToString();
                    if (!string.IsNullOrEmpty(cmd))
                    {
                        string exePath = cmd.Trim();
                        if (exePath.StartsWith("\""))
                        {
                            int endQuote = exePath.IndexOf('"', 1);
                            if (endQuote > 1)
                            {
                                exePath = exePath.Substring(1, endQuote - 1);
                            }
                        }
                        else
                        {
                            int space = exePath.IndexOf(' ');
                            if (space > 0)
                            {
                                exePath = exePath.Substring(0, space);
                            }
                        }

                        if (File.Exists(exePath))
                        {
                            return exePath;
                        }
                    }
                }
            }
            catch { }
            return null;
        }

        public static string FindSpecificLauncher(string name)
        {
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);

            string[] standalonePaths = {
                Path.Combine(localAppData, name, name + ".exe"),
                Path.Combine(localAppData, "Programs", name, name + ".exe"),
                Path.Combine(programFiles, name, name + ".exe")
            };
            foreach (var p in standalonePaths)
            {
                if (File.Exists(p)) return p;
            }

            string versionsFolder = Path.Combine(localAppData, name, "Versions");
            if (Directory.Exists(versionsFolder))
            {
                try
                {
                    DateTime bestTime = DateTime.MinValue;
                    string best = null;
                    foreach (var dir in Directory.GetDirectories(versionsFolder, "version-*"))
                    {
                        string exe = Path.Combine(dir, "RobloxPlayerBeta.exe");
                        if (File.Exists(exe))
                        {
                            var fi = new FileInfo(exe);
                            if (fi.Length > 5000000 && fi.LastWriteTimeUtc > bestTime)
                            {
                                bestTime = fi.LastWriteTimeUtc;
                                best = exe;
                            }
                        }
                    }
                    if (best != null) return best;
                }
                catch { }
            }

            return null;
        }

        public static JArray GetInstalledLaunchers()
        {
            var list = new JArray();
            string defaultHandlerExe = GetRegistryProtocolHandlerExe();

            // Auto
            list.Add(new JObject
            {
                ["id"] = "auto",
                ["name"] = "Auto Detect (Recommended)",
                ["installed"] = true,
                ["path"] = defaultHandlerExe ?? "Default Protocol Handler"
            });

            // Check Fishstrap
            string fishstrapExe = FindSpecificLauncher("Fishstrap");
            list.Add(new JObject
            {
                ["id"] = "fishstrap",
                ["name"] = "Fishstrap",
                ["installed"] = !string.IsNullOrEmpty(fishstrapExe),
                ["path"] = fishstrapExe ?? ""
            });

            // Check Bloxstrap
            string bloxstrapExe = FindSpecificLauncher("Bloxstrap");
            list.Add(new JObject
            {
                ["id"] = "bloxstrap",
                ["name"] = "Bloxstrap",
                ["installed"] = !string.IsNullOrEmpty(bloxstrapExe),
                ["path"] = bloxstrapExe ?? ""
            });

            // Check Froststrap
            string froststrapExe = FindSpecificLauncher("Froststrap");
            list.Add(new JObject
            {
                ["id"] = "froststrap",
                ["name"] = "Froststrap",
                ["installed"] = !string.IsNullOrEmpty(froststrapExe),
                ["path"] = froststrapExe ?? ""
            });

            // Check Voidstrap
            string voidstrapExe = FindSpecificLauncher("Voidstrap");
            list.Add(new JObject
            {
                ["id"] = "voidstrap",
                ["name"] = "Voidstrap",
                ["installed"] = !string.IsNullOrEmpty(voidstrapExe),
                ["path"] = voidstrapExe ?? ""
            });

            // Check Roblox Official
            string robloxExe = FindSpecificLauncher("Roblox");
            list.Add(new JObject
            {
                ["id"] = "roblox",
                ["name"] = "Vanilla Roblox",
                ["installed"] = !string.IsNullOrEmpty(robloxExe),
                ["path"] = robloxExe ?? ""
            });

            return list;
        }

        private static string FindLatestRobloxPlayer(string preferredLauncher = null)
        {
            if (!string.IsNullOrEmpty(preferredLauncher) && preferredLauncher != "auto")
            {
                string specific = FindSpecificLauncher(preferredLauncher);
                if (!string.IsNullOrEmpty(specific)) return specific;

                string titleCased = char.ToUpper(preferredLauncher[0]) + preferredLauncher.Substring(1).ToLower();
                specific = FindSpecificLauncher(titleCased);
                if (!string.IsNullOrEmpty(specific)) return specific;
            }

            // 1. Check Windows Protocol Handler Registration (Default bootstrapper like Fishstrap or Bloxstrap)
            string regExe = GetRegistryProtocolHandlerExe();
            if (!string.IsNullOrEmpty(regExe) && File.Exists(regExe))
            {
                return regExe;
            }

            // 2. Check Bootstrapper standalone binaries (Fishstrap, Bloxstrap, Voidstrap, Froststrap, Roblox)
            string[] directBootstrappers = {
                FindSpecificLauncher("Fishstrap"),
                FindSpecificLauncher("Bloxstrap"),
                FindSpecificLauncher("Froststrap"),
                FindSpecificLauncher("Voidstrap"),
                FindSpecificLauncher("Roblox")
            };

            foreach (var b in directBootstrappers)
            {
                if (!string.IsNullOrEmpty(b) && File.Exists(b))
                {
                    return b;
                }
            }

            return null;
        }

        public static async Task<JArray> GetRobloxChartsAsync(string category)
        {
            string sortId = "top-playing-now";
            if (category == "topRated") sortId = "top-rated";
            if (category == "topEarning") sortId = "top-earning";
            if (category == "trending") sortId = "top-trending";

            try
            {
                string sessionId = Guid.NewGuid().ToString();
                string url = $"https://apis.roblox.com/explore-api/v1/get-sort-content?sessionId={sessionId}&sortId={sortId}&device=computer&country=all";
                
                var resp = await _httpClient.GetStringAsync(url);
                var json = JObject.Parse(resp);
                var games = json["games"] as JArray ?? json["sorts"]?[0]?["games"] as JArray;

                if (games != null && games.Count > 0)
                {
                    var resultList = new JArray();
                    var universeIds = new List<string>();

                    foreach (var g in games.Take(36))
                    {
                        string uid = g["universeId"]?.ToString();
                        if (!string.IsNullOrEmpty(uid)) universeIds.Add(uid);
                    }

                    // Fetch 16:9 widescreen 768x432 game thumbnails
                    var thumbDict = new Dictionary<string, string>();
                    if (universeIds.Count > 0)
                    {
                        try
                        {
                            string thumbUrl = $"https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds={string.Join(",", universeIds)}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false";
                            var thumbResp = await _httpClient.GetStringAsync(thumbUrl);
                            var thumbJson = JObject.Parse(thumbResp);
                            var dataArray = thumbJson["data"] as JArray;
                            if (dataArray != null)
                            {
                                foreach (var item in dataArray)
                                {
                                    string uid = item["universeId"]?.ToString();
                                    var thumbs = item["thumbnails"] as JArray;
                                    string imgUrl = thumbs?[0]?["imageUrl"]?.ToString();
                                    if (!string.IsNullOrEmpty(uid) && !string.IsNullOrEmpty(imgUrl))
                                    {
                                        thumbDict[uid] = imgUrl;
                                    }
                                }
                            }
                        }
                        catch { }

                        // Fallback icon pass for any games without widescreen thumbnail
                        var missingUids = universeIds.Where(u => !thumbDict.ContainsKey(u)).ToList();
                        if (missingUids.Count > 0)
                        {
                            try
                            {
                                string iconUrl = $"https://thumbnails.roblox.com/v1/games/icons?universeIds={string.Join(",", missingUids)}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false";
                                var iconResp = await _httpClient.GetStringAsync(iconUrl);
                                var iconJson = JObject.Parse(iconResp);
                                var iconArray = iconJson["data"] as JArray;
                                if (iconArray != null)
                                {
                                    foreach (var item in iconArray)
                                    {
                                        string tid = item["targetId"]?.ToString();
                                        string imgUrl = item["imageUrl"]?.ToString();
                                        if (!string.IsNullOrEmpty(tid) && !string.IsNullOrEmpty(imgUrl) && !thumbDict.ContainsKey(tid))
                                        {
                                            thumbDict[tid] = imgUrl;
                                        }
                                    }
                                }
                            }
                            catch { }
                        }
                    }

                    foreach (var g in games.Take(36))
                    {
                        string uid = g["universeId"]?.ToString();
                        string placeId = g["rootPlaceId"]?.ToString() ?? g["placeId"]?.ToString();
                        string name = g["name"]?.ToString() ?? "Roblox Experience";
                        long playerCount = g["playerCount"]?.Value<long>() ?? 0;
                        int upVotes = g["totalUpVotes"]?.Value<int>() ?? 0;
                        int downVotes = g["totalDownVotes"]?.Value<int>() ?? 0;
                        int rating = (upVotes + downVotes > 0) ? (int)((double)upVotes / (upVotes + downVotes) * 100) : 90;
                        string creator = g["creatorName"]?.ToString() ?? g["creator"]?["name"]?.ToString() ?? "";
                        
                        // Default fallback thumbnail if CDN thumbnail not present
                        string thumbnail = (uid != null && thumbDict.TryGetValue(uid, out var tUrl)) ? tUrl : $"https://tr.rbxcdn.com/180DAY-2fc4a4f895ceb701cbf30dfba711124d/512/512/Image/Png";

                        resultList.Add(new JObject
                        {
                            ["placeId"] = placeId,
                            ["universeId"] = uid,
                            ["name"] = name,
                            ["playerCount"] = playerCount,
                            ["rating"] = rating,
                            ["creator"] = creator,
                            ["thumbnail"] = thumbnail
                        });
                    }
                    return resultList;
                }
            }
            catch { }

            // Fallback rich catalog with 24 active games
            return GetFallbackCharts();
        }

        private static JArray GetFallbackCharts()
        {
            var arr = new JArray();
            var list = new (string placeId, string name, long players, int rating, string creator, string thumb)[]
            {
                ("107778070777162", "Steal An Egg", 1187000, 93, "Crazy Studios", "https://tr.rbxcdn.com/180DAY-875b2a6dc156ce6dd64eb637e73238ce/768/432/Image/Png/noFilter"),
                ("4924922222", "Brookhaven 🏡RP", 385000, 86, "Wolfpaq", "https://tr.rbxcdn.com/180DAY-2f146143dc81d9fee97a4a83e0696090/768/432/Image/Png/noFilter"),
                ("2753915549", "Blox Fruits", 295000, 92, "Gamer Robot Inc", "https://tr.rbxcdn.com/180DAY-09e621f1df2e404a391adf389d2bea47/768/432/Image/Png/noFilter"),
                ("142823291", "Murder Mystery 2", 233000, 91, "Nikilis", "https://tr.rbxcdn.com/180DAY-fe7335c3ad752e84323cd81ae38de69a/768/432/Image/Png/noFilter"),
                ("17625359962", "RIVALS 🔫", 160000, 94, "Nosniy Games", "https://tr.rbxcdn.com/180DAY-fb02f48458ff689309df8d52bf516d04/768/432/Image/Png/noFilter"),
                ("9391468976", "Jujutsu Shenanigans", 150000, 86, "The Strongest", "https://tr.rbxcdn.com/180DAY-decec85a41b80e4ac0beca8bc2952a7f/768/432/Image/Png/noFilter"),
                ("920587237", "Adopt Me!", 125000, 86, "DreamCraft", "https://tr.rbxcdn.com/180DAY-a3a8f2a3869c4ab2702c11c45af08c49/768/432/Image/Png/noFilter"),
                ("79546208627805", "99 Nights in the Forest 🔦", 118000, 90, "DarkForest Studios", "https://tr.rbxcdn.com/180DAY-c5215eabc21f46723f0084f99bb7622c/768/432/Image/Png/noFilter"),
                ("109983668079237", "Steal a Brainrot", 84000, 85, "Brainrot Team", "https://tr.rbxcdn.com/180DAY-052ec1882b4ef3f0d72785be062b836a/768/432/Image/Png/noFilter"),
                ("16732694052", "Fisch 🎣", 75000, 91, "WoozyNate", "https://tr.rbxcdn.com/180DAY-17ce753c4b1f087c5eda362c24457e25/768/432/Image/Png/noFilter"),
                ("15101393044", "Dress To Impress [DTI]", 68000, 91, "Dress To Impress Group", "https://tr.rbxcdn.com/180DAY-93dd2075c61008cf59af69d997d0292a/768/432/Image/Png/noFilter"),
                ("8737899170", "Pet Simulator 99! 💰", 62000, 95, "BIG Games Pets", "https://tr.rbxcdn.com/180DAY-30489fe9f38246b85ae26a70609457f1/768/432/Image/Png/noFilter"),
                ("7041939546", "Catalog Avatar Creator", 65000, 94, "ItsMuneeeb", "https://tr.rbxcdn.com/180DAY-22c1dc925ae96a79a1b1e242c6b0d0fe/768/432/Image/Png/noFilter"),
                ("18687417158", "Forsaken", 61000, 85, "Forsaken Group", "https://tr.rbxcdn.com/180DAY-ade3a7a657babdc426cad38911362395/768/432/Image/Png/noFilter"),
                ("13772394625", "Blade Ball", 55000, 89, "Wyncore Studios", "https://tr.rbxcdn.com/180DAY-2fc4a4f895ceb701cbf30dfba711124d/768/432/Image/Png/noFilter"),
                ("10449761463", "The Strongest Battlegrounds", 52000, 92, "Yielding Arts", "https://tr.rbxcdn.com/180DAY-fe7335c3ad752e84323cd81ae38de69a/768/432/Image/Png/noFilter"),
                ("6516141723", "DOORS 👁️", 38000, 94, "LSPLASH", "https://tr.rbxcdn.com/180DAY-d3369a4e9dae4a5bf46f7c9e0d15e9a4/768/432/Image/Png/noFilter"),
                ("189707", "Natural Disaster Survival", 25000, 93, "Stickmasterluke", "https://tr.rbxcdn.com/180DAY-56f8f830ca0481cf13d52c1ef5a4e320/768/432/Image/Png/noFilter"),
                ("6872265039", "BedWars", 42000, 87, "Easy.gg", "https://tr.rbxcdn.com/180DAY-548c772cba27caab9d40b490f23023e3/768/432/Image/Png/noFilter"),
                ("606849622", "Jailbreak", 22000, 91, "Badimo", "https://tr.rbxcdn.com/180DAY-996ff6d21f8a846c4fa191b72e0085a3/768/432/Image/Png/noFilter")
            };

            foreach (var item in list)
            {
                arr.Add(new JObject
                {
                    ["placeId"] = item.placeId,
                    ["name"] = item.name,
                    ["playerCount"] = item.players,
                    ["rating"] = item.rating,
                    ["creator"] = item.creator,
                    ["thumbnail"] = item.thumb
                });
            }
            return arr;
        }

        #endregion

        #region Native Windows P/Invoke & COM Definitions

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool SetProcessWorkingSetSize(IntPtr hProcess, IntPtr dwMinimumWorkingSetSize, IntPtr dwMaximumWorkingSetSize);

        [DllImport("user32.dll")]
        private static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr OpenProcess(uint processAccess, bool bInheritHandle, int processId);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr GetCurrentProcess();

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool CloseHandle(IntPtr hObject);

        [DllImport("ntdll.dll")]
        private static extern int NtQuerySystemInformation(int SystemInformationClass, IntPtr SystemInformation, int SystemInformationLength, out int ReturnLength);

        [DllImport("ntdll.dll")]
        private static extern int NtDuplicateObject(IntPtr SourceProcessHandle, IntPtr SourceHandle, IntPtr TargetProcessHandle, out IntPtr TargetHandle, uint DesiredAccess, uint Attributes, uint Options);

        [DllImport("ntdll.dll")]
        private static extern int NtQueryObject(IntPtr ObjectHandle, int ObjectInformationClass, IntPtr ObjectInformation, int ObjectInformationLength, out int ReturnLength);

        private const int SYSTEM_EXTENDED_HANDLE_INFORMATION = 64;
        private const int STATUS_INFO_LENGTH_MISMATCH = unchecked((int)0xC0000004);
        private const int ObjectNameInformation = 1;
        private const uint PROCESS_DUP_HANDLE = 0x0040;
        private const uint PROCESS_QUERY_INFORMATION = 0x0400;
        private const uint WM_KEYDOWN = 0x0100;
        private const uint WM_KEYUP = 0x0101;
        private const int VK_SHIFT = 0x10;

        [StructLayout(LayoutKind.Sequential)]
        private struct SYSTEM_HANDLE_TABLE_ENTRY_INFO_EX
        {
            public IntPtr Object;
            public IntPtr UniqueProcessId;
            public IntPtr HandleValue;
            public uint GrantedAccess;
            public ushort CreatorBackTraceIndex;
            public ushort ObjectTypeIndex;
            public uint HandleAttributes;
            public uint Reserved;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct UNICODE_STRING
        {
            public ushort Length;
            public ushort MaximumLength;
            public IntPtr Buffer;
        }

        // CoreAudio COM — FLAT VTABLE (no inheritance, all slots declared explicitly)
        [ComImport]
        [Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
        private class MMDeviceEnumerator { }

        private enum EDataFlow { eRender, eCapture, eAll }
        private enum ERole { eConsole, eMultimedia, eCommunications }

        [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IMMDeviceEnumerator
        {
            [PreserveSig] int EnumAudioEndpoints(EDataFlow dataFlow, int dwStateMask, out IntPtr ppDevices);
            [PreserveSig] int GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice ppEndpoint);
        }

        [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IMMDevice
        {
            [PreserveSig] int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
        }

        [Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IAudioSessionManager2
        {
            [PreserveSig] int GetAudioSessionControl(ref Guid AudioSessionGuid, int StreamFlags, out IntPtr SessionControl);
            [PreserveSig] int GetSimpleAudioVolume(ref Guid AudioSessionGuid, int StreamFlags, out IntPtr AudioVolume);
            [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator SessionEnum);
        }

        [Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IAudioSessionEnumerator
        {
            [PreserveSig] int GetCount(out int SessionCount);
            [PreserveSig] int GetSession(int SessionIndex, out IAudioSessionControl Session);
        }

        // Full 9-method vtable for IAudioSessionControl
        [Guid("F4B1A599-7266-4319-A8CA-E70ACB11E8CD"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IAudioSessionControl
        {
            [PreserveSig] int QueryState(out int pRetVal);
            [PreserveSig] int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
            [PreserveSig] int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string Value, ref Guid EventContext);
            [PreserveSig] int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
            [PreserveSig] int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string Value, ref Guid EventContext);
            [PreserveSig] int GetGroupingParam(out Guid pRetVal);
            [PreserveSig] int SetGroupingParam(ref Guid Override, ref Guid EventContext);
            [PreserveSig] int RegisterAudioSessionNotification(IntPtr NewNotifications);
            [PreserveSig] int UnregisterAudioSessionNotification(IntPtr NewNotifications);
        }

        // Flat 14-method vtable for IAudioSessionControl2 (NO inheritance)
        [Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IAudioSessionControl2
        {
            // Slots 0-8: IAudioSessionControl base methods
            [PreserveSig] int QueryState(out int pRetVal);
            [PreserveSig] int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
            [PreserveSig] int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string Value, ref Guid EventContext);
            [PreserveSig] int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
            [PreserveSig] int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string Value, ref Guid EventContext);
            [PreserveSig] int GetGroupingParam(out Guid pRetVal);
            [PreserveSig] int SetGroupingParam(ref Guid Override, ref Guid EventContext);
            [PreserveSig] int RegisterAudioSessionNotification(IntPtr NewNotifications);
            [PreserveSig] int UnregisterAudioSessionNotification(IntPtr NewNotifications);
            // Slots 9-13: IAudioSessionControl2 own methods
            [PreserveSig] int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
            [PreserveSig] int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
            [PreserveSig] int GetProcessId(out int pRetVal);
            [PreserveSig] int IsSystemSoundsSession();
            [PreserveSig] int SetDuckingPreference(bool optOut);
        }

        [Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface ISimpleAudioVolume
        {
            [PreserveSig] int SetMasterVolume(float fLevel, ref Guid EventContext);
            [PreserveSig] int GetMasterVolume(out float pfLevel);
            [PreserveSig] int SetMute(bool bMute, ref Guid EventContext);
            [PreserveSig] int GetMute(out bool pbMute);
        }

        #endregion
    }
}
