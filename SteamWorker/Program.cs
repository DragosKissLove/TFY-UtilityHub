using System;
using System.IO;
using System.Net;
using System.Text.RegularExpressions;
using System.Collections.Generic;
using System.Diagnostics;
using Newtonsoft.Json;

namespace SteamWorker
{
    class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            if (args.Length < 2)
            {
                PrintJsonError("Invalid arguments. Usage: SteamWorker <query|commit|check-owned> <appid|appid_list>");
                return;
            }

            string command = args[0].ToLowerInvariant();

            // ── check-owned: verify ownership of a batch of AppIDs ──
            if (command == "check-owned")
            {
                RunCheckOwned(args[1]);
                return;
            }

            if (!uint.TryParse(args[1], out uint appId))
            {
                PrintJsonError("Invalid AppID. AppID must be a positive integer.");
                return;
            }

            // ── Use native Steam client (SAM-style) for query/commit ──
            using (var steam = new NativeSteamClient())
            {
                try
                {
                    if (!steam.Initialize(appId))
                    {
                        PrintJsonError($"Failed to get ISteamUserStats interface for AppID {appId}.");
                        return;
                    }

                    if (command == "query")
                    {
                        RunQuery(steam, appId);
                    }
                    else if (command == "commit")
                    {
                        RunCommit(steam, appId);
                    }
                    else
                    {
                        PrintJsonError($"Unknown command: {command}");
                    }
                }
                catch (Exception ex)
                {
                    PrintJsonError($"SteamWorker error: {ex.Message}");
                }
            }
        }

        /// <summary>
        /// Checks ownership of a batch of AppIDs using native Steam client.
        /// </summary>
        static void RunCheckOwned(string appIdList)
        {
            using (var steam = new NativeSteamClient())
            {
                try
                {
                    // Initialize with AppID 480 (Spacewar - free, every Steam user has it)
                    if (!steam.Initialize(480))
                    {
                        PrintJsonError("Failed to initialize native Steam client for ownership check.");
                        return;
                    }

                    var ownedIds = new List<string>();
                    string[] ids = appIdList.Split(',');

                    foreach (string idStr in ids)
                    {
                        string trimmed = idStr.Trim();
                        if (uint.TryParse(trimmed, out uint id))
                        {
                            if (steam.BIsSubscribedApp(id))
                            {
                                ownedIds.Add(trimmed);
                            }
                        }
                    }

                    Console.WriteLine(JsonConvert.SerializeObject(new { ok = true, owned = ownedIds }));
                }
                catch (Exception ex)
                {
                    PrintJsonError($"Error checking ownership: {ex.Message}");
                }
            }
        }

        static void RunQuery(NativeSteamClient steam, uint appId)
        {
            // Request stats and wait for callback
            if (!steam.RequestAndWaitForStats(appId, 5000))
            {
                PrintJsonError("Timed out waiting for stats and achievements from Steam client.");
                return;
            }

            uint numAchievements = steam.GetNumAchievements();

            string resolvedGameName = null;
            // Try fetching the community page to map display names to colored icon URLs
            var webIconMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                using (var webClient = new WebClient())
                {
                    webClient.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
                    string url = $"https://steamcommunity.com/stats/{appId}/achievements/?l=english";
                    string html = webClient.DownloadString(url);

                    // Extract resolvedGameName
                    int titleStart = html.IndexOf("<title>Steam Community ::", StringComparison.OrdinalIgnoreCase);
                    if (titleStart != -1)
                    {
                        int titleEnd = html.IndexOf(":: Achievements</title>", titleStart, StringComparison.OrdinalIgnoreCase);
                        if (titleEnd != -1)
                        {
                            int startIdx = titleStart + "<title>Steam Community ::".Length;
                            resolvedGameName = WebUtility.HtmlDecode(html.Substring(startIdx, titleEnd - startIdx).Trim());
                        }
                    }

                    // Fast index-of parser (no regex backtracking, 100% safe for thousands of achievements)
                    int pos = 0;
                    while (true)
                    {
                        pos = html.IndexOf("class=\"achieveImgHolder\"", pos, StringComparison.OrdinalIgnoreCase);
                        if (pos == -1) break;

                        int srcStart = html.IndexOf("src=\"", pos, StringComparison.OrdinalIgnoreCase);
                        if (srcStart == -1) break;
                        srcStart += 5;
                        int srcEnd = html.IndexOf("\"", srcStart, StringComparison.OrdinalIgnoreCase);
                        if (srcEnd == -1) break;
                        string imgUrl = html.Substring(srcStart, srcEnd - srcStart);

                        int h3Start = html.IndexOf("<h3>", srcEnd, StringComparison.OrdinalIgnoreCase);
                        if (h3Start != -1 && h3Start - srcEnd < 1000)
                        {
                            h3Start += 4;
                            int h3End = html.IndexOf("</h3>", h3Start, StringComparison.OrdinalIgnoreCase);
                            if (h3End != -1)
                            {
                                string name = WebUtility.HtmlDecode(html.Substring(h3Start, h3End - h3Start).Trim());
                                if (!string.IsNullOrEmpty(name))
                                {
                                    webIconMap[name] = imgUrl;
                                }
                            }
                        }
                        pos = srcEnd;
                    }
                }
            }
            catch
            {
                // Ignore web fetch failures
            }

            var list = new List<object>();

            for (uint i = 0; i < numAchievements; i++)
            {
                string apiName = steam.GetAchievementApiName(i);
                if (string.IsNullOrEmpty(apiName)) continue;

                var (unlocked, unlockTime) = steam.GetAchievementAndUnlockTime(apiName);

                string displayName = steam.GetAchievementDisplayAttribute(apiName, "name");
                string displayDesc = steam.GetAchievementDisplayAttribute(apiName, "desc");
                bool isHidden = steam.GetAchievementDisplayAttribute(apiName, "hidden") == "1";

                string iconUrl = null;
                if (!string.IsNullOrEmpty(displayName) && webIconMap.TryGetValue(displayName, out var foundUrl))
                {
                    iconUrl = foundUrl;
                }

                list.Add(new
                {
                    id = apiName,
                    name = string.IsNullOrEmpty(displayName) ? apiName : displayName,
                    desc = displayDesc ?? "",
                    unlocked = unlocked,
                    unlockTime = unlockTime,
                    hidden = isHidden,
                    icon = iconUrl
                });
            }

            var result = new
            {
                ok = true,
                appId = appId,
                gameName = resolvedGameName,
                achievements = list
            };

            Console.WriteLine(JsonConvert.SerializeObject(result));
        }

        static void RunCommit(NativeSteamClient steam, uint appId)
        {
            // Read targets from stdin
            string inputJson = Console.In.ReadToEnd();
            if (string.IsNullOrWhiteSpace(inputJson))
            {
                PrintJsonError("No commit configuration received on standard input.");
                return;
            }

            CommitPayload payload;
            try
            {
                payload = JsonConvert.DeserializeObject<CommitPayload>(inputJson);
            }
            catch (Exception ex)
            {
                PrintJsonError($"Failed to parse commit payload JSON: {ex.Message}");
                return;
            }

            if (payload == null)
            {
                PrintJsonError("Parsed commit payload was null.");
                return;
            }

            // Request stats first (required before modifying)
            if (!steam.RequestAndWaitForStats(appId, 5000))
            {
                PrintJsonError("Timed out waiting for stats from Steam before committing changes.");
                return;
            }

            if (payload.Unlock != null)
            {
                foreach (var id in payload.Unlock)
                {
                    if (!string.IsNullOrWhiteSpace(id))
                    {
                        steam.SetAchievement(id);
                    }
                }
            }

            if (payload.Lock != null)
            {
                foreach (var id in payload.Lock)
                {
                    if (!string.IsNullOrWhiteSpace(id))
                    {
                        steam.ClearAchievement(id);
                    }
                }
            }

            if (steam.StoreStatsAndWait(appId, 5000))
            {
                Console.WriteLine(JsonConvert.SerializeObject(new { ok = true, message = "Achievements updated successfully!" }));
            }
            else
            {
                PrintJsonError("Failed to store updated stats in Steam client.");
            }
        }

        static void PrintJsonError(string message)
        {
            Console.WriteLine(JsonConvert.SerializeObject(new { ok = false, error = message }));
        }
    }

    public class CommitPayload
    {
        public List<string> Unlock { get; set; }
        public List<string> Lock { get; set; }
    }
}
