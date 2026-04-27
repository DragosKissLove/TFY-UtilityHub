using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;
using Newtonsoft.Json;
using TFY.Services;
using Velopack;

using System.Runtime.InteropServices;
using System.Windows.Interop;

namespace TFY
{
    public partial class MainWindow : Window
    {
        // P/Invoke for window dragging
        [DllImport("user32.dll")]
        public static extern IntPtr SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);
        [DllImport("user32.dll")]
        public static extern bool ReleaseCapture();
        [DllImport("dwmapi.dll")]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int dwAttribute, ref int pvAttribute, int cbAttribute);
        private const int WM_NCLBUTTONDOWN = 0xA1;
        private const int HT_CAPTION = 0x2;
        private const int DWMWA_WINDOW_CORNER_PREFERENCE = 33;
        private const int DWMWCP_DONOTROUND = 1;

        private readonly HardwareMonitorService _hardwareMonitor;
        private readonly bool _ownsHardwareMonitor;
        private readonly DiscordAuthService _discordAuth = new DiscordAuthService();
        private readonly DebloaterService _debloater = new DebloaterService();
        private readonly FixesService _fixes = new FixesService();
        private readonly BackupsService _backups = new BackupsService();
        private readonly Cs2ConfigService _cs2ConfigService = new Cs2ConfigService();
        private readonly FortniteConfigService _fortniteConfig = new FortniteConfigService();
        private readonly HttpClient _httpClient = new HttpClient();
        private DispatcherTimer _statsTimer;
        private bool _premiumEnabled;
        private bool _premiumResolved;
        private bool _testingEnabled;
        private bool _testingResolved;
        private UpdateInfo _pendingUpdate;
        private bool _updateCheckInProgress;
        private bool _debloaterLoaded;
        private bool _debloaterLoading;
        private List<DebloaterApp> _debloaterDesktopCache = new List<DebloaterApp>();
        private List<DebloaterApp> _debloaterStoreCache = new List<DebloaterApp>();
        private readonly List<string> _sessionDebugLogs = new List<string>();
        private readonly object _sessionLogLock = new object();
        private string _uiBuildKey = "default";

        public MainWindow()
        {
            InitializeComponent();
            ClearPremiumCache();
            Console.WriteLine("[TFY] App Starting...");

            var app = Application.Current as App;
            if (app?.HardwareMonitor != null)
            {
            _hardwareMonitor = app.HardwareMonitor;
            _ownsHardwareMonitor = false;
            }
            else
            {
            _hardwareMonitor = new HardwareMonitorService();
            _ownsHardwareMonitor = true;
        }

            AddSessionLog("App session started.");
            SourceInitialized += (_, __) => ApplyWindowCornerPreference();

            Loaded += (s, e) => InitializeWebView();
            Closed += (s, e) =>
            {
                AddSessionLog("App window closed.");
                if (_ownsHardwareMonitor)
                {
                    _hardwareMonitor?.Stop();
                }
            };
        }

        private void ApplyWindowCornerPreference()
        {
            try
            {
                var hwnd = new WindowInteropHelper(this).Handle;
                if (hwnd == IntPtr.Zero) return;
                int preference = DWMWCP_DONOTROUND;
                DwmSetWindowAttribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, ref preference, Marshal.SizeOf<int>());
            }
            catch
            {
                // Ignore on unsupported systems.
            }
        }

        private async void InitializeWebView()
        {
            try
            {
                if (webView.CoreWebView2 != null) return;

                Console.WriteLine("[TFY] Initializing WebView2 Environment...");
                AddSessionLog("Initializing WebView2 environment.");

                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string projectPath = "";

                // Prefer installed dist under the app folder, fallback to dev tree.
                string installedDist = Path.Combine(baseDir, "project", "dist");
                if (Directory.Exists(installedDist))
                {
                    projectPath = installedDist;
                }
                else
                {
                    string current = baseDir;
                    for (int i = 0; i < 6; i++)
                    {
                        string check = Path.Combine(current, "project", "dist");
                        if (Directory.Exists(check))
                        {
                            projectPath = Path.GetFullPath(check);
                            break;
                        }
                        var parent = Directory.GetParent(current);
                        if (parent == null) break;
                        current = parent.FullName;
                    }
                }
                string cacheKey = "default";
                try
                {
                    string indexPath = Path.Combine(projectPath, "index.html");
                    if (File.Exists(indexPath))
                    {
                        var bytes = File.ReadAllBytes(indexPath);
                        string stamp = File.GetLastWriteTimeUtc(indexPath).ToString("yyyyMMddHHmmss");
                        string size = bytes.Length.ToString();
                        string hash;
                        using (var sha = SHA256.Create())
                        {
                            hash = BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").Substring(0, 10);
                        }
                        cacheKey = $"{stamp}-{size}-{hash}";
                    }
                }
                catch { }

                _uiBuildKey = cacheKey;

                PurgeLegacyWebViewCaches();

                string uiKeyPath = Path.Combine(baseDir, "TFY.ui.key");
                string lastUiKey = null;
                try { if (File.Exists(uiKeyPath)) lastUiKey = File.ReadAllText(uiKeyPath).Trim(); } catch { }
                bool uiChanged = lastUiKey != cacheKey;

                string userDataFolder = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "TFY",
                    "WebView2"
                );
                Directory.CreateDirectory(userDataFolder);
                var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
                await webView.EnsureCoreWebView2Async(env);
                
                // Prevent white/black flash during initialization
                webView.DefaultBackgroundColor = System.Drawing.Color.FromArgb(255, 11, 11, 14);

                // IMPORTANT: Do not clear browsing data on upgrade.
                // Theme/language are stored in localStorage and must persist across reinstalls.
                // We rely on cache-busting `?v=` + hashed asset names for UI refresh.
                if (uiChanged)
                {
                    try { File.WriteAllText(uiKeyPath, cacheKey); } catch { }
                }

                Console.WriteLine($"[TFY] WebView2 cache: {userDataFolder}");
                Console.WriteLine($"[TFY] Using dist folder: {projectPath}");

                // Security: disable developer tools and inspect access
                var settings = webView.CoreWebView2.Settings;
                settings.AreDevToolsEnabled = false;
                settings.AreDefaultContextMenusEnabled = false;
                settings.IsStatusBarEnabled = false;
                settings.IsZoomControlEnabled = false;
                settings.AreDefaultScriptDialogsEnabled = false;

                if (Directory.Exists(projectPath) && File.Exists(Path.Combine(projectPath, "index.html")))
                {
                    webView.CoreWebView2.SetVirtualHostNameToFolderMapping("tfy.app", projectPath, CoreWebView2HostResourceAccessKind.Allow);
                    
                    if (uiChanged)
                    {
                        Console.WriteLine("[TFY] UI Version changed. Clearing browser cache...");
                        await webView.CoreWebView2.Profile.ClearBrowsingDataAsync();
                    }

                    // Always evict the stale version badge so the new assembly version
                    // sent via PostAppVersion() always wins over any cached localStorage value.
                    string currentVer = GetAppVersion();
                    await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(
                        $"try {{ localStorage.removeItem('tfy.appVersion'); localStorage.removeItem('tfy.uiBuild'); }} catch {{}}");

                    bool initialNav = true;
                    // Prioritize local build (tfy.app) for instant responsiveness and dev sync
                    // Fallback to Firebase Hosting if local files are missing
                    string localUrl = $"http://tfy.app/index.html?v={Uri.EscapeDataString(cacheKey)}";
                    webView.CoreWebView2.Navigate(localUrl);

                    webView.CoreWebView2.NavigationCompleted += async (s, e) =>
                    {
                        if (!e.IsSuccess && initialNav)
                        {
                            initialNav = false;
                            string firebaseUrl = $"https://tfy-project.web.app/?t={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
                            Console.WriteLine($"[TFY] Local UI failed ({e.WebErrorStatus}). Falling back to Firebase Hosting...");
                            webView.CoreWebView2.Navigate(firebaseUrl);
                            return;
                        }

                        if (!e.IsSuccess) return;

                        try
                        {
                            var specs = _hardwareMonitor.GetSystemSpecs();
                            string json = JsonConvert.SerializeObject(new { type = "specs", data = specs });
                            webView.CoreWebView2.PostWebMessageAsJson(json);

                            var discordState = await _discordAuth.GetStateAsync();
                            string discordJson = JsonConvert.SerializeObject(new { type = "discord", data = discordState });
                            webView.CoreWebView2.PostWebMessageAsJson(discordJson);

                            _premiumEnabled = await ResolvePremiumAsync();
                            string premiumJson = JsonConvert.SerializeObject(new { type = "premium", data = new { enabled = _premiumEnabled } });
                            webView.CoreWebView2.PostWebMessageAsJson(premiumJson);

                            _testingEnabled = await ResolveTestingAsync();
                            string testingJson = JsonConvert.SerializeObject(new { type = "testing", data = new { enabled = _testingEnabled } });
                            webView.CoreWebView2.PostWebMessageAsJson(testingJson);

                            PostAppVersion();
                            _ = CheckForUpdatesAsync(false);
                            _ = PreloadDebloaterAsync();
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"[TFY] Specs Error: {ex.Message}");
                        }
                    };

                    StartStatsTimer();
                }
                else
                {
                    string error = $"[TFY] FOLDER ERROR: Could not find 'index.html' in {projectPath}";
                    Console.WriteLine(error);
                    webView.NavigateToString($"<body style='background:#111; color:red; padding:50px; font-family:sans-serif;'><h1>{error}</h1></body>");
                }

                webView.CoreWebView2.WebMessageReceived += async (s, e) =>
                {
                    string message = e.TryGetWebMessageAsString();
                    AddSessionLog($"WebMessageReceived: {message}");
                    if (message == "close") Close();
                    if (message == "minimize") WindowState = WindowState.Minimized;
                    
                    if (message == "window-drag")
                    {
                        try
                        {
                            // Force drag without checking button state (message implies intent)
                            ReleaseCapture();
                            SendMessage(new WindowInteropHelper(this).Handle, WM_NCLBUTTONDOWN, HT_CAPTION, 0);
                        }
                        catch { }
                    }


                    if (message != null && message.StartsWith("discord-login"))
                    {
                        try
                        {
                            string theme = "jade";
                            if (message.Contains("|"))
                            {
                                theme = message.Split('|')[1];
                            }
                            var state = await _discordAuth.LoginAsync(theme);
                            string discordJson = JsonConvert.SerializeObject(new { type = "discord", data = state });
                            webView.CoreWebView2.PostWebMessageAsJson(discordJson);
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine("[TFY] Discord login failed: " + ex.Message);
                        }
                    }

                    if (message == "discord-get")
                    {
                        var discordState = await _discordAuth.GetStateAsync();
                        string discordJson = JsonConvert.SerializeObject(new { type = "discord", data = discordState });
                        webView.CoreWebView2.PostWebMessageAsJson(discordJson);
                    }
                    if (message == "discord-logout")
                    {
                        await _discordAuth.LogoutAsync();
                        string discordJson = JsonConvert.SerializeObject(new { type = "discord", data = new { connected = false } });
                        webView.CoreWebView2.PostWebMessageAsJson(discordJson);
                    }

                    if (message == "specs-get")
                    {
                        var specs = _hardwareMonitor.GetSystemSpecs();
                        string json = JsonConvert.SerializeObject(new { type = "specs", data = specs });
                        webView.CoreWebView2.PostWebMessageAsJson(json);
                    }

                    if (message == "premium-get")
                    {
                        _premiumEnabled = await ResolvePremiumAsync();
                        string premiumJson = JsonConvert.SerializeObject(new { type = "premium", data = new { enabled = _premiumEnabled } });
                        webView.CoreWebView2.PostWebMessageAsJson(premiumJson);
                    }
                    if (message == "testing-get")
                    {
                        _testingEnabled = await ResolveTestingAsync();
                        string testingJson = JsonConvert.SerializeObject(new { type = "testing", data = new { enabled = _testingEnabled } });
                        webView.CoreWebView2.PostWebMessageAsJson(testingJson);
                    }
                    if (message == "update-check")
                    {
                        await CheckForUpdatesAsync(true);
                    }
                    if (message == "update-apply")
                    {
                        await ApplyPendingUpdateAsync();
                    }
                    if (message == "debloater-list")
                    {
                        if (_debloaterLoaded)
                        {
                            PostDebloaterCache();
                        }
                        else
                        {
                            _ = PreloadDebloaterAsync();
                        }
                    }
                    if (message == "debloater-refresh")
                    {
                        _ = RefreshDebloaterCacheAsync();
                    }
                    if (message == "app-export-logs")
                    {
                        await ExportDebugLogsAsync();
                    }
                    if (message == "clean-files-run")
                    {
                        await Task.Run(() => SystemOptimizerService.RunFullClean());
                        webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(new { type = "clean-files", data = new { ok = true, message = "System Cleaned" } }));
                    }
                    if (message == "memory-cache-run")
                    {
                        await Task.Run(() => SystemOptimizerService.OptimizeMemory());
                        webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(new { type = "memory-cache", data = new { ok = true, message = "Memory Optimized" } }));
                    }
                    if (message == "power-plan-only")
                    {
                        var result = await GamingTweaksService.ApplyUltimatePowerPlanAsync();
                        webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(new { type = "power-plan-only", data = new { ok = result } }));
                    }
                    if (message == "power-plan-full")
                    {
                        var result = await GamingTweaksService.ApplyFullOptimizationAsync();
                        webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(new { type = "power-plan-full", data = new { ok = result } }));
                    }
                    if (message != null && message.StartsWith("clean-files-run|"))
                    {
                        var json = message.Substring("clean-files-run|".Length);
                        List<string> selected = new List<string>();
                        try
                        {
                            dynamic request = JsonConvert.DeserializeObject<dynamic>(json);
                            if (request?.selected != null)
                            {
                                foreach (var item in request.selected)
                                {
                                    var key = item?.ToString();
                                    if (!string.IsNullOrWhiteSpace(key))
                                    {
                                        selected.Add(key);
                                    }
                                }
                            }
                        }
                        catch
                        {
                        }
                        await RunTempCleanupAsync(selected);
                    }

                    
                    if (message == "backups-list")
                    {
                        try
                        {
                            var items = _backups.GetRestorePoints();
                            var payload = JsonConvert.SerializeObject(new
                            {
                                type = "backups",
                                action = "list",
                                data = new
                                {
                                    items,
                                    caps = new { canDelete = _backups.CanDeleteRestorePoints() }
                                }
                            });
                            webView.CoreWebView2.PostWebMessageAsJson(payload);
                        }
                        catch (Exception ex)
                        {
                            AddSessionLog($"backups-list failed: {ex.Message}");
                            var payload = JsonConvert.SerializeObject(new
                            {
                                type = "backups",
                                action = "list",
                                data = new
                                {
                                    items = new List<BackupPoint>(),
                                    caps = new { canDelete = false }
                                }
                            });
                            webView.CoreWebView2.PostWebMessageAsJson(payload);
                        }
                    }

                    if (message != null && message.StartsWith("backups-create|"))
                    {
                        var name = message.Substring("backups-create|".Length);
                        var result = _backups.CreateRestorePoint(name);
                        var payload = JsonConvert.SerializeObject(new { type = "backups", action = "result", data = new { ok = result.ok, message = result.message } });
                        webView.CoreWebView2.PostWebMessageAsJson(payload);
                        var items = _backups.GetRestorePoints();
                        var listPayload = JsonConvert.SerializeObject(new
                        {
                            type = "backups",
                            action = "list",
                            data = new
                            {
                                items,
                                caps = new { canDelete = _backups.CanDeleteRestorePoints() }
                            }
                        });
                        webView.CoreWebView2.PostWebMessageAsJson(listPayload);
                    }

                    if (message == "backups-refresh")
                    {
                        var items = _backups.GetRestorePoints();
                        var payload = JsonConvert.SerializeObject(new
                        {
                            type = "backups",
                            action = "list",
                            data = new
                            {
                                items,
                                caps = new { canDelete = _backups.CanDeleteRestorePoints() }
                            }
                        });
                        webView.CoreWebView2.PostWebMessageAsJson(payload);
                    }

                    if (message == "fortnite-settings-get")
                    {
                        try
                        {
                            var cfg = _fortniteConfig.GetCurrentConfig();
                            var payload = JsonConvert.SerializeObject(new { type = "fortnite-settings", data = cfg });
                            webView.CoreWebView2.PostWebMessageAsJson(payload);
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine("[TFY] Fortnite get error: " + ex.Message);
                        }
                    }

                    if (message != null && message.StartsWith("fortnite-settings-save|"))
                    {
                        try
                        {
                            var json = message.Substring("fortnite-settings-save|".Length);
                            var cfg = JsonConvert.DeserializeObject<FortniteConfigObj>(json);
                            if (cfg != null)
                            {
                                bool success = _fortniteConfig.SaveConfig(cfg);
                                var resp = JsonConvert.SerializeObject(new { type = "fortnite-save-result", data = new { ok = success } });
                                webView.CoreWebView2.PostWebMessageAsJson(resp);
                            }
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine("[TFY] Fortnite save error: " + ex.Message);
                        }
                    }

                    if (message != null && message.StartsWith("fortnite-raw-ini-apply|"))
                    {
                        try
                        {
                            var payload = message.Substring("fortnite-raw-ini-apply|".Length);
                            bool success = _fortniteConfig.ApplyRawIni(payload);
                            var resp = JsonConvert.SerializeObject(new { type = "fortnite-save-result", data = new { ok = success } });
                            webView.CoreWebView2.PostWebMessageAsJson(resp);
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine("[TFY] Fortnite raw apply error: " + ex.Message);
                        }
                    }

                    if (message == "fortnite-browse-exe")
                    {
                        var dlg = new Microsoft.Win32.OpenFileDialog
                        {
                            Filter = "Fortnite Executable|FortniteClient-Win64-Shipping.exe;FortniteClient-Win64-Shipping_BE.exe;FortniteClient-Win64-Shipping_EAC.exe",
                            Title = "Select Fortnite Executable"
                        };
                        if (dlg.ShowDialog() == true)
                        {
                            var resp = JsonConvert.SerializeObject(new { type = "fortnite-exe-selected", data = new { path = dlg.FileName } });
                            webView.CoreWebView2.PostWebMessageAsJson(resp);
                        }
                    }

                    if (message != null && message.StartsWith("backups-delete|"))
                    {
                        var idStr = message.Substring("backups-delete|".Length);
                        if (int.TryParse(idStr, out var seq))
                        {
                            var result = _backups.DeleteRestorePoint(seq);
                            var payload = JsonConvert.SerializeObject(new { type = "backups", action = "result", data = new { ok = result.ok, message = result.message } });
                            webView.CoreWebView2.PostWebMessageAsJson(payload);
                            var items = _backups.GetRestorePoints();
                            var listPayload = JsonConvert.SerializeObject(new
                            {
                                type = "backups",
                                action = "list",
                                data = new
                                {
                                    items,
                                    caps = new { canDelete = _backups.CanDeleteRestorePoints() }
                                }
                            });
                            webView.CoreWebView2.PostWebMessageAsJson(listPayload);
                        }
                    }

                    if (message != null && message.StartsWith("backups-restore|"))
                    {
                        var idStr = message.Substring("backups-restore|".Length);
                        if (int.TryParse(idStr, out var seq))
                        {
                            var result = _backups.RestorePoint(seq);
                            var payload = JsonConvert.SerializeObject(new { type = "backups", action = "result", data = new { ok = result.ok, message = result.message } });
                            webView.CoreWebView2.PostWebMessageAsJson(payload);
                        }
                    }

                    if (message != null && message.StartsWith("fix-run|"))
                    {
                        var id = message.Substring("fix-run|".Length);
                        var result = _fixes.RunFix(id);
                        var payload = JsonConvert.SerializeObject(new { type = "fixes", action = "result", data = new { id, ok = result.Ok, message = result.Message } });
                        webView.CoreWebView2.PostWebMessageAsJson(payload);
                    }

                    if (message == "gaming-inject-script")
                    {
                        _ = RunGamingInjectScriptAsync();
                    }

                    if (message == "dlcunlocker-scan")
                    {
                        _ = RunDlcUnlockerScanAsync();
                    }
                    if (message != null && message.StartsWith("dlcunlocker-getdlcs|"))
                    {
                        var appId = message.Substring("dlcunlocker-getdlcs|".Length).Trim();
                        RunDlcUnlockerGetDlcsAsync(appId);
                    }
                    if (message != null && message.StartsWith("dlcunlocker-install|"))
                    {
                        var json = message.Substring("dlcunlocker-install|".Length);
                        RunDlcUnlockerInstallAsync(json);
                    }
                    if (message != null && message.StartsWith("dlcunlocker-uninstall|"))
                    {
                        var json = message.Substring("dlcunlocker-uninstall|".Length);
                        RunDlcUnlockerUninstallAsync(json);
                    }

                    // ── System Activator ───────────────────────────────────────────
                    if (message == "windows-activator-status")
                    {
                        _ = RunActivatorStatusAsync();
                    }
                    if (message != null && message.StartsWith("windows-activator-run|"))
                    {
                        string method = message.Substring("windows-activator-run|".Length).Trim();
                        _ = RunActivatorAsync(method);
                    }

                    // ── CS2 Config Hub ─────────────────────────────────────────────
                    if (message == "cs2-config-fetch")
                    {
                        _ = FetchCs2ConfigAsync();
                    }
                    if (message != null && message.StartsWith("cs2-config-apply|"))
                    {
                        string jsonPayload = message.Substring("cs2-config-apply|".Length);
                        _ = ApplyCs2ConfigAsync(jsonPayload);
                    }
                    if (message != null && message.StartsWith("cs2-config-install-pro|"))
                    {
                        string url = message.Substring("cs2-config-install-pro|".Length).Trim();
                        _ = InstallProConfigAsync(url);
                    }

                    // ── Fetch all game sources server-side (browser headers bypass 403) ──
                    if (message == "games-fetch")
                    {
                        _ = Task.Run(async () =>
                        {
                            var cacheFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TFY");
                            Directory.CreateDirectory(cacheFolder);
                            var cacheFile = Path.Combine(cacheFolder, "GamesCache4.json");

                            string resultJson = "[]";

                            // Check cache (valid for 3 days, must be real JSON array)
                            if (File.Exists(cacheFile) && (DateTime.UtcNow - File.GetLastWriteTimeUtc(cacheFile)).TotalDays < 3)
                            {
                                var cached = File.ReadAllText(cacheFile);
                                if (cached.TrimStart().StartsWith("[") && cached.Length > 1000)
                                    resultJson = cached;
                            }
                            
                            if (resultJson == "[]")
                            {
                                // HYBRID STRATEGY (tested 2026-04-27):
                                // - GOG & RexaGames: work DIRECT from pages.dev (no Cloudflare block)
                                // - FitGirl, SteamRIP, DODI, Xatab, OnlineFix: return 451 direct, 
                                //   but work perfectly via Wayback Machine archive
                                var sources = new Dictionary<string, string>
                                {
                                    { "GOG",       "https://hydralinks.pages.dev/sources/gog.json" },
                                    { "RexaGames", "https://hydralinks.pages.dev/sources/rexagames.json" },
                                    { "FitGirl",   "https://web.archive.org/web/2/https://hydralinks.pages.dev/sources/fitgirl.json" },
                                    { "SteamRIP",  "https://web.archive.org/web/2/https://hydralinks.pages.dev/sources/steamrip.json" },
                                    { "DODI",      "https://web.archive.org/web/2/https://hydralinks.pages.dev/sources/dodi.json" },
                                    { "Xatab",     "https://web.archive.org/web/2/https://hydralinks.pages.dev/sources/xatab.json" },
                                    { "OnlineFix", "https://web.archive.org/web/2/https://hydralinks.pages.dev/sources/onlinefix.json" },
                                };

                                using var hc = new HttpClient { Timeout = TimeSpan.FromSeconds(90) };
                                hc.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent",
                                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

                                var tasks = sources.Select(async kvp =>
                                {
                                    var games = new List<object>();
                                    try
                                    {
                                        var resp = await hc.GetAsync(kvp.Value);
                                        if (!resp.IsSuccessStatusCode) return games;
                                        
                                        var json = await resp.Content.ReadAsStringAsync();
                                        
                                        // VALIDATE: Cloudflare/archive can return HTML instead of JSON
                                        var trimmed = json.TrimStart();
                                        if (!trimmed.StartsWith("{") && !trimmed.StartsWith("[")) return games;
                                        
                                        // Strip Wayback Machine URL rewrites from download links
                                        json = System.Text.RegularExpressions.Regex.Replace(json,
                                            @"https?://web\.archive\.org/web/\d+(im_)?/", "");

                                        dynamic data = JsonConvert.DeserializeObject<dynamic>(json);
                                        if (data?.downloads != null)
                                        {
                                            foreach (var d in data.downloads)
                                            {
                                                var uriList = new List<string>();
                                                try
                                                {
                                                    var raw = d.uris?.ToString();
                                                    if (!string.IsNullOrEmpty(raw))
                                                        uriList = JsonConvert.DeserializeObject<List<string>>(raw);
                                                }
                                                catch { }
                                                games.Add(new
                                                {
                                                    source = kvp.Key,
                                                    title = d.title?.ToString() ?? "",
                                                    fileSize = d.fileSize?.ToString() ?? "",
                                                    uploadDate = d.uploadDate?.ToString() ?? "",
                                                    uris = uriList
                                                });
                                            }
                                        }
                                    }
                                    catch { }
                                    return games;
                                });

                                var results = await Task.WhenAll(tasks);
                                var allGames = results.SelectMany(g => g).ToList();
                                Console.WriteLine($"[TFY] games-fetch completed: {allGames.Count} games loaded");
                                
                                resultJson = JsonConvert.SerializeObject(allGames);
                                // Only cache if we got real data (prevent caching empty/broken results)
                                if (allGames.Count > 100)
                                {
                                    try { File.WriteAllText(cacheFile, resultJson); } catch { }
                                }
                            }

                            string payload = JsonConvert.SerializeObject(new { type = "games-list", data = new { games = JsonConvert.DeserializeObject(resultJson) } });
                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(payload));
                        });
                    }

                    // ── Steam image + details proxy (bypass WebView2 CORS) ──────
                    if (message != null && message.StartsWith("fetch-steam|"))
                    {
                        string gameTitle = message.Substring("fetch-steam|".Length).Trim();
                        _ = Task.Run(async () =>
                        {
                            string appId = null;
                            string imageUrl = "fallback";
                            string trailerUrl = null;
                            string description = null;
                            string steamUrl = null;
                            string releaseDate = null;
                            var genres = new List<string>();
                            int? metacritic = null;
                            double? steamScore = null;

                            try
                            {
                                // 1. Search for appId
                                _httpClient.DefaultRequestHeaders.UserAgent.TryParseAdd("Mozilla/5.0");
                                string cleanTitle = CleanGameTitleForSearch(gameTitle);
                                string searchUrl = $"https://store.steampowered.com/api/storesearch/?term={Uri.EscapeDataString(cleanTitle)}&l=english&cc=US";
                                var searchResp = await _httpClient.GetStringAsync(searchUrl);
                                dynamic searchResult = JsonConvert.DeserializeObject<dynamic>(searchResp);

                                if (searchResult?.items != null && searchResult.items.Count > 0)
                                {
                                    appId = searchResult.items[0]?.id?.ToString();
                                }

                                if (!string.IsNullOrEmpty(appId))
                                {
                                    imageUrl = $"https://cdn.akamai.steamstatic.com/steam/apps/{appId}/header.jpg";
                                    steamUrl = $"https://store.steampowered.com/app/{appId}";

                                    // 2. Fetch full app details for trailer, description, genres etc.
                                    try
                                    {
                                        string detailUrl = $"https://store.steampowered.com/api/appdetails?appids={appId}&l=english";
                                        var detailResp = await _httpClient.GetStringAsync(detailUrl);
                                        dynamic detailResult = JsonConvert.DeserializeObject<dynamic>(detailResp);
                                        var appData = detailResult?[appId]?.data;

                                        if (appData != null)
                                        {
                                            // Short description
                                            description = appData.short_description?.ToString();

                                            // Release date
                                            releaseDate = appData.release_date?.date?.ToString();

                                            // Genres
                                            if (appData.genres != null)
                                            {
                                                foreach (var g in appData.genres)
                                                {
                                                    string gName = g?.description?.ToString();
                                                    if (!string.IsNullOrEmpty(gName)) genres.Add(gName);
                                                    if (genres.Count >= 4) break;
                                                }
                                            }

                                            // Metacritic
                                            if (appData.metacritic?.score != null)
                                                metacritic = (int)appData.metacritic.score;

                                            // Steam review score (0-10 scale → convert to %)
                                            if (appData.recommendations?.total != null)
                                                steamScore = null; // can't compute % without both fields easily

                                            // Trailer (mp4 max quality)
                                            if (appData.movies != null && appData.movies.Count > 0)
                                            {
                                                var movie = appData.movies[0];
                                                try { trailerUrl = movie?.mp4?.max?.ToString() ?? movie?.webm?.max?.ToString(); }
                                                catch { /* dynamic access failed, skip trailer */ }
                                            }
                                        }
                                    }
                                    catch (Exception detailEx)
                                    {
                                        Console.WriteLine($"[TFY] appdetails failed: {detailEx.Message}");
                                    }
                                }
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine($"[TFY] fetch-steam failed: {ex.Message}");
                            }

                            var payload = JsonConvert.SerializeObject(new
                            {
                                type = "steam-image",
                                data = new
                                {
                                    title = gameTitle,
                                    url = imageUrl,
                                    appId,
                                    steamUrl,
                                    trailerUrl,
                                    description,
                                    genres,
                                    metacritic,
                                    releaseDate,
                                }
                            });
                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(payload));
                        });
                    }

                    // ── Open URL in default browser ────────────────────────────────────────
                    if (message != null && message.StartsWith("open-url|"))
                    {
                        string url = message.Substring("open-url|".Length).Trim();
                        try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url) { UseShellExecute = true }); }
                        catch (Exception ex) { Console.WriteLine($"[TFY] open-url failed: {ex.Message}"); }
                    }

                    if (message != null && message.StartsWith("download-install|"))
                    {
                        var json = message.Substring("download-install|".Length);
                        await HandleDownloadInstallAsync(json);
                    }
if (message != null && message.StartsWith("debloater-uninstall|"))
                    {
                        var json = message.Substring("debloater-uninstall|".Length);
                        var request = JsonConvert.DeserializeObject<dynamic>(json);
                        bool deepClean = request?.deepClean == true;
                        var items = new List<DebloaterApp>();
                        foreach (var item in request?.items)
                        {
                            string type = item?.type;
                            string id = item?.id;
                            string name = item?.name;
                            string uninstallString = item?.uninstallString;
                            string quietUninstallString = item?.quietUninstallString;
                            string installLocation = item?.installLocation;
                            string packageFullName = item?.packageFullName;
                            string packageFamilyName = item?.packageFamilyName;
                            if (string.Equals(type, "store", StringComparison.OrdinalIgnoreCase))
                            {
                                items.Add(new DebloaterApp
                                {
                                    Type = "store",
                                    Name = name,
                                    PackageFullName = string.IsNullOrWhiteSpace(packageFullName) ? id : packageFullName,
                                    PackageFamilyName = packageFamilyName,
                                    Id = id
                                });
                            }
                            else
                            {
                                var desktopApp = _debloater.FindDesktopAppById(id);
                                if (desktopApp != null)
                                {
                                    items.Add(desktopApp);
                                }
                                else
                                {
                                    items.Add(new DebloaterApp
                                    {
                                        Type = "desktop",
                                        Name = name,
                                        Id = id,
                                        UninstallString = uninstallString,
                                        QuietUninstallString = quietUninstallString,
                                        InstallLocation = installLocation
                                    });
                                }
                            }
                        }

                        string logPath = await Task.Run(() => _debloater.UninstallApps(items, deepClean));
                        string done = JsonConvert.SerializeObject(new { type = "debloater", action = "done", data = new { logPath } });
                        webView.CoreWebView2.PostWebMessageAsJson(done);
                        _ = RefreshDebloaterCacheAsync();
                    }
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TFY] WebView2 Crash: {ex.Message}");
                AddSessionLog($"WebView2 crash: {ex.Message}");
            }
        }

        /// <summary>
        /// Cleans a repack title so it can be searched on Steam.
        /// Strips version numbers, DLC tags, patch suffixes and parenthetical text.
        /// e.g. "Terraria v1.4.5.4" → "Terraria"
        ///      "Astral Ascent v1207 +4DLC" → "Astral Ascent"
        ///      "Resident Evil 2 v1.0 hotfix5" → "Resident Evil 2"
        /// </summary>
        private static string CleanGameTitleForSearch(string title)
        {
            if (string.IsNullOrWhiteSpace(title)) return title;

            // Remove content in parentheses e.g. (RC14), (Demo Out Now), (v1.0)
            title = System.Text.RegularExpressions.Regex.Replace(title, @"\s*\(.*?\)", "");

            // Remove content in square brackets e.g. [v6.25], [Early Access]
            title = System.Text.RegularExpressions.Regex.Replace(title, @"\s*\[.*?\]", "");

            // Remove +NdlcDLC or +NDLC tags e.g. "+4DLC", "+2DLC", "+Online"
            title = System.Text.RegularExpressions.Regex.Replace(title, @"\s*\+\d+(dlc|DLC)", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            title = System.Text.RegularExpressions.Regex.Replace(title, @"\s*\+\w+", "");

            // Remove version patterns: v1.2.3.4 / v12345 / v1.2 (with optional leading space)
            title = System.Text.RegularExpressions.Regex.Replace(title, @"\s+v\d+(\.\d+)*\b", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

            // Remove build/patch suffixes like "hotfix5", "build12345", "patch1"
            title = System.Text.RegularExpressions.Regex.Replace(title, @"\s+(hotfix|patch|build|rc|beta|alpha)\w*", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

            // Remove trailing punctuation and whitespace
            title = title.Trim().TrimEnd('-', ':', ' ');

            // Collapse multiple spaces
            title = System.Text.RegularExpressions.Regex.Replace(title, @"\s{2,}", " ");

            return title.Trim();
        }

        private void PurgeLegacyWebViewCaches()
        {
            try
            {
                var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                foreach (var dir in Directory.EnumerateDirectories(localAppData, "TFY_WebView2_*"))
                {
                    try
                    {
                        Directory.Delete(dir, true);
                    }
                    catch
                    {
                        // Best-effort only.
                    }
                }
            }
            catch
            {
            }
        }

        private async Task HandleDownloadInstallAsync(string json)
        {
            string id = "";
            try
            {
                dynamic request = JsonConvert.DeserializeObject<dynamic>(json);
                id = request?.id?.ToString() ?? "";
                string title = request?.title?.ToString() ?? "Installer";
                string link = request?.link?.ToString() ?? "";

                if (string.IsNullOrWhiteSpace(link))
                {
                    PostDownloadResult(id, false, "Invalid download link.");
                    return;
                }

                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string outputDir = Path.Combine(desktop, "TFY Installer Drops");
                Directory.CreateDirectory(outputDir);

                using var response = await _httpClient.GetAsync(link, HttpCompletionOption.ResponseHeadersRead);
                if (!response.IsSuccessStatusCode)
                {
                    PostDownloadResult(id, false, $"Download failed ({(int)response.StatusCode}).");
                    return;
                }

                if (response.Content.Headers.ContentType?.MediaType?.Contains("text/html") == true)
                {
                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(link) { UseShellExecute = true });
                    PostDownloadResult(id, true, "Deschis în browser (Fișierul necesită confirmare de securitate directă în Google Drive).");
                    return;
                }

                string extension = GuessInstallerExtension(response, link);
                string baseName = MakeSafeFileName(string.IsNullOrWhiteSpace(title) ? "Installer" : title);
                string targetPath = Path.Combine(outputDir, $"{baseName}{extension}");
                int seq = 1;
                while (File.Exists(targetPath))
                {
                    targetPath = Path.Combine(outputDir, $"{baseName}_{seq}{extension}");
                    seq++;
                }

                var contentLength = response.Content.Headers.ContentLength;

                await using (var sourceStream = await response.Content.ReadAsStreamAsync())
                await using (var fileStream = new FileStream(targetPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                {
                    var buffer = new byte[81920];
                    long totalBytesRead = 0;
                    int bytesRead;
                    var lastUpdate = DateTime.MinValue;

                    while ((bytesRead = await sourceStream.ReadAsync(buffer, 0, buffer.Length)) != 0)
                    {
                        await fileStream.WriteAsync(buffer, 0, bytesRead);
                        totalBytesRead += bytesRead;

                        if (contentLength.HasValue && (DateTime.Now - lastUpdate).TotalMilliseconds > 300)
                        {
                            lastUpdate = DateTime.Now;
                            double percent = (double)totalBytesRead / contentLength.Value * 100;
                            double mb = totalBytesRead / 1048576.0;
                            double totalMb = contentLength.Value / 1048576.0;
                            
                            string progressMsg = JsonConvert.SerializeObject(new { 
                                type = "download-progress", 
                                id = id,
                                percent = Math.Round(percent, 1),
                                mb = Math.Round(mb, 1),
                                totalMb = Math.Round(totalMb, 1)
                            });
                            
                            Dispatcher.Invoke(() => {
                                webView.CoreWebView2.PostWebMessageAsJson(progressMsg);
                            });
                        }
                    }
                }

                bool isSpotify = title.IndexOf("spotify", StringComparison.OrdinalIgnoreCase) >= 0;
                if (!isSpotify)
                {
                    OpenDownloadedFile(targetPath);
                    PostDownloadResult(id, true, $"Saved to {targetPath}");
                }
                else
                {
                    PostDownloadResult(id, true, $"Saved to {targetPath}. Spotify setup must be started from a normal user session (not elevated).");
                }
            }
            catch (Exception ex)
            {
                PostDownloadResult(id, false, $"Download error: {ex.Message}");
            }
        }

        private void OpenDownloadedFile(string path)
        {
            try
            {
                string ext = Path.GetExtension(path).ToLowerInvariant();
                bool runnable = ext == ".exe" || ext == ".msi" || ext == ".msix" || ext == ".msixbundle";

                if (runnable)
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = path,
                        UseShellExecute = true
                    });
                    return;
                }

                Process.Start(new ProcessStartInfo
                {
                    FileName = "explorer.exe",
                    Arguments = $"/select,\"{path}\"",
                    UseShellExecute = true
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TFY] Open downloaded file failed: {ex.Message}");
            }
        }

        private void PostDownloadResult(string id, bool ok, string message)
        {
            try
            {
                if (webView?.CoreWebView2 == null) return;
                var payload = JsonConvert.SerializeObject(new
                {
                    type = "downloads",
                    action = "result",
                    data = new { id, ok, message }
                });
                Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(payload));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TFY] Download result post failed: {ex.Message}");
            }
        }

        private static string MakeSafeFileName(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "Installer";
            foreach (var c in Path.GetInvalidFileNameChars())
            {
                value = value.Replace(c, '_');
            }
            return value.Trim();
        }

        private static string GuessInstallerExtension(HttpResponseMessage response, string link)
        {
            var contentDisposition = response.Content.Headers.ContentDisposition;
            if (contentDisposition != null && !string.IsNullOrWhiteSpace(contentDisposition.FileName))
            {
                string fileName = contentDisposition.FileName.Trim('"');
                string extFromFileName = Path.GetExtension(fileName).ToLowerInvariant();
                if (!string.IsNullOrWhiteSpace(extFromFileName))
                {
                    return extFromFileName;
                }
            }

            string extFromUrl = "";
            try
            {
                var uri = new Uri(link);
                extFromUrl = Path.GetExtension(uri.AbsolutePath);
            }
            catch { }

            if (!string.IsNullOrWhiteSpace(extFromUrl))
            {
                var normalized = extFromUrl.ToLowerInvariant();
                if (normalized == ".exe" || normalized == ".msi" || normalized == ".zip" || normalized == ".msix" || normalized == ".msixbundle" || normalized == ".rar" || normalized == ".7z")
                {
                    return normalized;
                }
            }

            var contentType = response.Content.Headers.ContentType?.MediaType?.ToLowerInvariant() ?? "";
            if (contentType.Contains("msi")) return ".msi";
            if (contentType.Contains("zip") || contentType.Contains("compressed")) return ".zip";
            if (contentType.Contains("rar")) return ".rar";
            if (contentType.Contains("msix")) return ".msix";
            return ".exe";
        }

        private async Task RunTempCleanupAsync(List<string> selectedKeys = null)
        {
            try
            {
                int removedItems = 0;
                int failedItems = 0;
                var allTargets = new Dictionary<string, string[]>
                {
                    ["temp"] = new[]
                    {
                        Environment.ExpandEnvironmentVariables("%TEMP%"),
                        Environment.ExpandEnvironmentVariables(@"%LOCALAPPDATA%\Temp"),
                        @"C:\Windows\Temp",
                    },
                    ["prefetch"] = new[] { @"C:\Windows\Prefetch" },
                    ["crash"] = new[] { Environment.ExpandEnvironmentVariables(@"%LOCALAPPDATA%\CrashDumps") },
                    ["wer"] = new[]
                    {
                        @"C:\ProgramData\Microsoft\Windows\WER\ReportArchive",
                        @"C:\ProgramData\Microsoft\Windows\WER\ReportQueue",
                        @"C:\ProgramData\Microsoft\Windows\WER\Temp",
                    },
                    ["windowsUpdate"] = new[]
                    {
                        @"C:\Windows\SoftwareDistribution\DeliveryOptimization\Cache",
                        @"C:\Windows\SoftwareDistribution\Download",
                    },
                    ["windowsLogs"] = new[] { @"C:\Windows\Logs\CBS", @"C:\Windows\Logs\DISM" },
                    ["shader"] = new[]
                    {
                        Environment.ExpandEnvironmentVariables(@"%LOCALAPPDATA%\D3DSCache"),
                        Environment.ExpandEnvironmentVariables(@"%LOCALAPPDATA%\NVIDIA\DXCache"),
                        Environment.ExpandEnvironmentVariables(@"%LOCALAPPDATA%\NVIDIA\GLCache"),
                    },
                    ["recent"] = new[]
                    {
                        Environment.ExpandEnvironmentVariables(@"%APPDATA%\Microsoft\Windows\Recent"),
                        Environment.ExpandEnvironmentVariables(@"%APPDATA%\Microsoft\Windows\Recent\AutomaticDestinations"),
                        Environment.ExpandEnvironmentVariables(@"%APPDATA%\Microsoft\Windows\Recent\CustomDestinations"),
                    },
                    ["cache"] = new[]
                    {
                        Environment.ExpandEnvironmentVariables(@"%LOCALAPPDATA%\Microsoft\Windows\Explorer"),
                        Environment.ExpandEnvironmentVariables(@"%LOCALAPPDATA%\IconCache.db"),
                    },
                    ["storeCache"] = new[]
                    {
                        Environment.ExpandEnvironmentVariables(@"%LOCALAPPDATA%\Packages\Microsoft.WindowsStore_8wekyb3d8bbwe\LocalCache"),
                        Environment.ExpandEnvironmentVariables(@"%LOCALAPPDATA%\Packages\Microsoft.WindowsStore_8wekyb3d8bbwe\AC"),
                        Environment.ExpandEnvironmentVariables(@"%LOCALAPPDATA%\Packages\Microsoft.WindowsStore_8wekyb3d8bbwe\TempState"),
                    },
                    ["extras"] = new[]
                    {
                        @"C:\Windows\Panther",
                        @"C:\Windows\Minidump",
                        @"C:\found.000",
                        @"C:\$WINDOWS.~BT",
                        @"C:\$WINDOWS.~WS",
                    }
                };

                var keyList = (selectedKeys != null && selectedKeys.Count > 0)
                    ? selectedKeys
                    : new List<string>(allTargets.Keys);

                await Task.Run(() =>
                {
                    foreach (var key in keyList)
                    {
                        if (!allTargets.ContainsKey(key)) continue;
                        foreach (var target in allTargets[key])
                        {
                            TryCleanTarget(target, ref removedItems, ref failedItems);
                        }
                    }
                });

                var payload = JsonConvert.SerializeObject(new
                {
                    type = "clean-files",
                    data = new
                    {
                        ok = true,
                        removedItems,
                        failedItems
                    }
                });
                webView?.CoreWebView2?.PostWebMessageAsJson(payload);
            }
            catch (Exception ex)
            {
                var payload = JsonConvert.SerializeObject(new
                {
                    type = "clean-files",
                    data = new
                    {
                        ok = false,
                        removedItems = 0,
                        failedItems = 0,
                        message = ex.Message
                    }
                });
                webView?.CoreWebView2?.PostWebMessageAsJson(payload);
            }
        }

        private async Task RunGamingInjectScriptAsync()
        {
            try
            {
                PostInAppNotification("info", "TFY Agent", "Se descarcă datele din Cloud (Securizat)...", 2000);
                string firebaseUrl = "https://tfy-project.web.app/tfy-agent.js";
                
                using var http = new HttpClient();
                string script = await http.GetStringAsync(firebaseUrl);

                if (string.IsNullOrWhiteSpace(script))
                {
                    PostInAppNotification("error", "TFY Agent", "Scriptul descărcat este invalid!", 5000);
                    return;
                }

                PostInAppNotification("info", "TFY Agent", "Injectare în curs...", 2000);
                string result = await DiscordInjector.InjectScriptAsync(script, (statusMsg) => Console.WriteLine(statusMsg));
                bool success = result != null && result.IndexOf("Succes", StringComparison.OrdinalIgnoreCase) >= 0;
                PostInAppNotification(success ? "success" : "error", "TFY Agent", result ?? "Eroare necunoscută.", success ? 4200 : 6000);
            }
            catch (Exception ex)
            {
                PostInAppNotification("error", "TFY Agent", $"Eroare la pornirea TFY Agent: {ex.Message}", 6000);
            }
        }

        private async Task RunDlcUnlockerScanAsync()
        {
            try
            {
                var games = await DlcUnlockerService.ScanAllAsync();
                var payload = JsonConvert.SerializeObject(new { type = "dlcunlocker", action = "scan", data = new { games } });
                webView?.CoreWebView2?.PostWebMessageAsJson(payload);
            }
            catch (Exception ex)
            {
                PostInAppNotification("error", "DLC Unlocker", "Scan eșuat: " + ex.Message, 5000);
            }
        }

        private async void RunDlcUnlockerGetDlcsAsync(string appId)
        {
            try
            {
                var dlcs = await DlcUnlockerService.GetDlcListAsync(appId);
                var list = dlcs.Select(d => new { id = d.id, name = d.name }).ToList();
                var payload = JsonConvert.SerializeObject(new { type = "dlcunlocker", action = "dlclist", data = new { appId, dlcs = list } });
                webView?.CoreWebView2?.PostWebMessageAsJson(payload);
            }
            catch (Exception ex)
            {
                var payload = JsonConvert.SerializeObject(new { type = "dlcunlocker", action = "dlclist", data = new { appId = appId, dlcs = new object[0], error = ex.Message } });
                webView?.CoreWebView2?.PostWebMessageAsJson(payload);
            }
        }

        private async void RunDlcUnlockerInstallAsync(string json)
        {
            try
            {
                var req = JsonConvert.DeserializeObject<dynamic>(json);
                string path = req?.path?.ToString();
                string platform = req?.platform?.ToString();
                string id = req?.id?.ToString();
                bool proxy = req?.proxy != null && (bool)req.proxy;
                var selectedDlcIds = new List<string>();
                if (req?.selectedDlcIds != null)
                {
                    foreach (var x in req.selectedDlcIds)
                        selectedDlcIds.Add(x?.ToString());
                }
                if (string.IsNullOrEmpty(path) || string.IsNullOrEmpty(platform))
                {
                    PostInAppNotification("error", "DLC Unlocker", "Lipsesc path sau platform.", 4000);
                    return;
                }
                var (ok, message) = await DlcUnlockerService.InstallAsync(path, platform, id, selectedDlcIds.Count > 0 ? selectedDlcIds : null, proxy);
                var payload = JsonConvert.SerializeObject(new { type = "dlcunlocker", action = "install", data = new { ok, message, path } });
                webView?.CoreWebView2?.PostWebMessageAsJson(payload);
                PostInAppNotification(ok ? "success" : "error", "DLC Unlocker", message, ok ? 4200 : 5500);
            }
            catch (Exception ex)
            {
                PostInAppNotification("error", "DLC Unlocker", ex.Message, 5500);
            }
        }

        private void RunDlcUnlockerUninstallAsync(string json)
        {
            try
            {
                var req = JsonConvert.DeserializeObject<dynamic>(json);
                string path = req?.path?.ToString();
                string platform = req?.platform?.ToString();
                if (string.IsNullOrEmpty(path) || string.IsNullOrEmpty(platform))
                {
                    PostInAppNotification("error", "DLC Unlocker", "Lipsesc path sau platform.", 4000);
                    return;
                }
                var (ok, message) = DlcUnlockerService.Uninstall(path, platform);
                var payload = JsonConvert.SerializeObject(new { type = "dlcunlocker", action = "uninstall", data = new { ok, message, path } });
                webView?.CoreWebView2?.PostWebMessageAsJson(payload);
                PostInAppNotification(ok ? "success" : "error", "DLC Unlocker", message, ok ? 4200 : 5500);
            }
            catch (Exception ex)
            {
                PostInAppNotification("error", "DLC Unlocker", ex.Message, 5500);
            }
        }

        // ── System Activator ─────────────────────────────────────────────────────

        private async Task RunActivatorStatusAsync()
        {
            try
            {
                // Run both checks in parallel for faster response
                var winTask = WindowsActivatorService.GetWindowsStatusAsync();
                var offTask = WindowsActivatorService.GetOfficeStatusAsync();
                await Task.WhenAll(winTask, offTask);

                var winStatus = winTask.Result;
                var offStatus = offTask.Result;

                var data = new
                {
                    windows = new { name = winStatus.Name, status = winStatus.LicenseStatus, isActivated = winStatus.IsActivated, label = winStatus.StatusLabel },
                    office  = new { name = offStatus.Name, status = offStatus.LicenseStatus, isActivated = offStatus.IsActivated, isInstalled = offStatus.IsInstalled, label = offStatus.StatusLabel }
                };
                var payload = JsonConvert.SerializeObject(new { type = "activator", action = "status", data });
                webView?.CoreWebView2?.PostWebMessageAsJson(payload);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TFY] Activator status error: {ex.Message}");
            }
        }

        private async Task RunActivatorAsync(string method)
        {
            var payload = JsonConvert.SerializeObject(new { type = "activator", action = "running", data = new { method } });
            webView?.CoreWebView2?.PostWebMessageAsJson(payload);

            var (ok, message) = await WindowsActivatorService.ActivateAsync(method);

            // Send 'done' immediately so spinner stops — no delay waiting for status refetch
            var done = JsonConvert.SerializeObject(new { type = "activator", action = "done", data = new { ok, message, method } });
            webView?.CoreWebView2?.PostWebMessageAsJson(done);

            PostInAppNotification(ok ? "success" : "error", "System Activator", message, ok ? 4500 : 6000);

            // Refetch status in background — doesn't block spinner
            _ = RunActivatorStatusAsync();
        }

        private async Task FetchCs2ConfigAsync()
        {
            try
            {
                object payloadObj = await _cs2ConfigService.GetCs2ConfigPayloadAsync();
                
                var response = new {
                    type = "cs2-config",
                    data = payloadObj
                };
                var settings = new Newtonsoft.Json.JsonSerializerSettings { ContractResolver = new Newtonsoft.Json.Serialization.CamelCasePropertyNamesContractResolver() };
                webView?.CoreWebView2?.PostWebMessageAsJson(Newtonsoft.Json.JsonConvert.SerializeObject(response, settings));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TFY] CS2 Config fetch error: {ex}");
                var errResponse = new {
                    type = "cs2-config",
                    data = new { error = ex.Message }
                };
                webView?.CoreWebView2?.PostWebMessageAsJson(Newtonsoft.Json.JsonConvert.SerializeObject(errResponse));
            }
        }

        private async Task InstallProConfigAsync(string url)
        {
            try
            {
                string result = await _cs2ConfigService.InstallProConfigAsync(url);
                bool ok = result.StartsWith("Success");
                PostInAppNotification(ok ? "success" : "error", "CS2 Pro Configs", result, ok ? 4500 : 6000);
            }
            catch (Exception ex)
            {
                PostInAppNotification("error", "CS2 Pro Configs", ex.Message, 5000);
            }
        }

        private static void TryCleanTarget(string target, ref int removedItems, ref int failedItems)
        {
            if (string.IsNullOrWhiteSpace(target)) return;
            try
            {
                if (target.Contains('*'))
                {
                    var directory = Path.GetDirectoryName(target);
                    if (string.IsNullOrWhiteSpace(directory) || !Directory.Exists(directory)) return;
                    CleanDirectoryContents(directory, ref removedItems, ref failedItems);
                    return;
                }

                if (File.Exists(target))
                {
                    TryDeleteFile(target, ref removedItems, ref failedItems);
                    return;
                }

                if (!Directory.Exists(target)) return;

                CleanDirectoryContents(target, ref removedItems, ref failedItems);
            }
            catch
            {
                failedItems++;
            }
        }

        private static void CleanDirectoryContents(string directoryPath, ref int removedItems, ref int failedItems)
        {
            if (!Directory.Exists(directoryPath)) return;

            try
            {
                foreach (var file in Directory.GetFiles(directoryPath))
                {
                    TryDeleteFile(file, ref removedItems, ref failedItems);
                }
            }
            catch
            {
                failedItems++;
            }

            string[] subDirectories = Array.Empty<string>();
            try
            {
                subDirectories = Directory.GetDirectories(directoryPath);
            }
            catch
            {
                failedItems++;
            }

            foreach (var subDirectory in subDirectories)
            {
                CleanDirectoryContents(subDirectory, ref removedItems, ref failedItems);
                try
                {
                    Directory.Delete(subDirectory, false);
                    removedItems++;
                }
                catch
                {
                    failedItems++;
                }
            }
        }

        private static void TryDeleteFile(string filePath, ref int removedItems, ref int failedItems)
        {
            try
            {
                var attributes = File.GetAttributes(filePath);
                if ((attributes & FileAttributes.ReadOnly) == FileAttributes.ReadOnly)
                {
                    File.SetAttributes(filePath, attributes & ~FileAttributes.ReadOnly);
                }
                File.Delete(filePath);
                removedItems++;
            }
            catch
            {
                failedItems++;
            }
        }

        private static void TryDeleteDirectory(string directoryPath, ref int removedItems, ref int failedItems)
        {
            try
            {
                CleanDirectoryContents(directoryPath, ref removedItems, ref failedItems);
                Directory.Delete(directoryPath, true);
                removedItems++;
            }
            catch
            {
                failedItems++;
            }
        }

        private async Task ExportDebugLogsAsync()
        {
            try
            {
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string exportDir = Path.Combine(desktop, "TFY Debug Logs");
                Directory.CreateDirectory(exportDir);

                string zipPath = Path.Combine(exportDir, $"TFY_Debug_Logs_{DateTime.Now:yyyyMMdd_HHmmss}.zip");
                if (File.Exists(zipPath))
                {
                    File.Delete(zipPath);
                }

                using (var archive = ZipFile.Open(zipPath, ZipArchiveMode.Create))
                {
                    string manifest = $"ExportedAt={DateTime.Now:O}{Environment.NewLine}" +
                                      $"AppVersion={GetAppVersion()}{Environment.NewLine}" +
                                      $"Machine={Environment.MachineName}{Environment.NewLine}" +
                                      $"User={Environment.UserName}{Environment.NewLine}" +
                                      $"Scope=Current runtime session only{Environment.NewLine}";

                    var entry = archive.CreateEntry("manifest.txt");
                    using (var writer = new StreamWriter(entry.Open()))
                    {
                        writer.Write(manifest);
                    }

                    var sessionEntry = archive.CreateEntry("session-logs.txt");
                    using (var sessionWriter = new StreamWriter(sessionEntry.Open()))
                    {
                        foreach (var line in GetSessionLogSnapshot())
                        {
                            sessionWriter.WriteLine(line);
                        }
                    }
                }

                Process.Start(new ProcessStartInfo
                {
                    FileName = "explorer.exe",
                    Arguments = $"/select,\"{zipPath}\"",
                    UseShellExecute = true
                });

                PostInAppNotification("success", "Debug Logs Exported", $"Saved to {zipPath}", 4200);
            }
            catch (Exception ex)
            {
                PostInAppNotification("error", "Debug Logs Export Failed", ex.Message, 5600);
                AddSessionLog($"Debug logs export failed: {ex.Message}");
                await Task.CompletedTask;
            }
        }

        private static void AddDirectoryToZipIfExists(ZipArchive archive, string directory, string rootFolder)
        {
            if (!Directory.Exists(directory)) return;

            var files = Directory.GetFiles(directory, "*", SearchOption.AllDirectories);
            foreach (var file in files)
            {
                string relative = Path.GetRelativePath(directory, file);
                string zipEntry = Path.Combine(rootFolder, relative).Replace('\\', '/');
                archive.CreateEntryFromFile(file, zipEntry, CompressionLevel.Fastest);
            }
        }

        private void AddSessionLog(string message)
        {
            var line = $"[{DateTime.Now:HH:mm:ss}] {message}";
            lock (_sessionLogLock)
            {
                _sessionDebugLogs.Add(line);
                if (_sessionDebugLogs.Count > 5000)
                {
                    _sessionDebugLogs.RemoveRange(0, _sessionDebugLogs.Count - 5000);
                }
            }
        }

        private List<string> GetSessionLogSnapshot()
        {
            lock (_sessionLogLock)
            {
                return new List<string>(_sessionDebugLogs);
            }
        }

        private void PostInAppNotification(string kind, string title, string message, int durationMs = 4200)
        {
            try
            {
                if (webView?.CoreWebView2 == null) return;
                var payload = JsonConvert.SerializeObject(new
                {
                    type = "notify",
                    data = new
                    {
                        kind,
                        title,
                        message,
                        duration = durationMs
                    }
                });
                Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(payload));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TFY] Notify post failed: {ex.Message}");
            }
        }

        private async Task PreloadDebloaterAsync()
        {
            if (_debloaterLoaded || _debloaterLoading) return;
            _debloaterLoading = true;
            try
            {
                var desktop = await Task.Run(() => _debloater.GetDesktopApps());
                var store = await Task.Run(() => _debloater.GetStoreApps());
                _debloaterDesktopCache = desktop ?? new List<DebloaterApp>();
                _debloaterStoreCache = store ?? new List<DebloaterApp>();
                _debloaterLoaded = true;
                PostDebloaterCache();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TFY] Debloater preload failed: {ex.Message}");
            }
            finally
            {
                _debloaterLoading = false;
            }
        }

        private async Task RefreshDebloaterCacheAsync()
        {
            _debloaterLoaded = false;
            _debloaterLoading = false;
            await PreloadDebloaterAsync();
        }

        private void PostDebloaterCache()
        {
            try
            {
                if (webView?.CoreWebView2 == null) return;
                var payload = JsonConvert.SerializeObject(new
                {
                    type = "debloater",
                    action = "list",
                    data = new { desktop = _debloaterDesktopCache, store = _debloaterStoreCache }
                });
                Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(payload));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TFY] Debloater cache post failed: {ex.Message}");
            }
        }

        private string GetAppVersion()
        {
            try
            {
                var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString();
                if (!string.IsNullOrWhiteSpace(version))
                {
                    return version.StartsWith("v", StringComparison.OrdinalIgnoreCase) ? version : $"v{version}";
                }
            }
            catch
            {
            }

            return "v5.0.0";
        }

        private void PostAppVersion()
        {
            try
            {
                if (webView?.CoreWebView2 == null) return;
                var payload = JsonConvert.SerializeObject(new
                {
                    type = "update",
                    action = "version",
                    currentVersion = GetAppVersion(),
                    uiBuild = _uiBuildKey
                });
                webView.CoreWebView2.PostWebMessageAsJson(payload);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TFY] Post version failed: {ex.Message}");
            }
        }

        private void PostUpdateStatus(string action)
        {
            try
            {
                if (webView?.CoreWebView2 == null) return;
                var payload = JsonConvert.SerializeObject(new { type = "update", action });
                webView.CoreWebView2.PostWebMessageAsJson(payload);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TFY] Post update status failed: {ex.Message}");
            }
        }

        private void PostUpdateAvailable(UpdateInfo update)
        {
            try
            {
                if (webView?.CoreWebView2 == null) return;
                var target = update?.TargetFullRelease;
                var notes = new List<string>();
                if (!string.IsNullOrWhiteSpace(target?.NotesMarkdown))
                {
                    var lines = target.NotesMarkdown.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                    foreach (var raw in lines)
                    {
                        var line = raw.TrimStart('-', '*', '•', ' ').Trim();
                        if (!string.IsNullOrWhiteSpace(line))
                        {
                            notes.Add(line);
                        }
                    }
                }

                var payload = JsonConvert.SerializeObject(new
                {
                    type = "update",
                    action = "available",
                    data = new
                    {
                        currentVersion = GetAppVersion(),
                        latestVersion = target?.Version?.ToString(),
                        sizeMb = target?.Size != null ? Math.Round(target.Size / (1024d * 1024d), 2) : (double?)null,
                        notes = notes.Count > 0 ? notes : null,
                        mandatory = false
                    }
                });
                webView.CoreWebView2.PostWebMessageAsJson(payload);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TFY] Post update available failed: {ex.Message}");
            }
        }

        private async Task CheckForUpdatesAsync(bool notifyIfNone)
        {
            if (_updateCheckInProgress) return;
            _updateCheckInProgress = true;
            try
            {
                PostUpdateStatus("checking");
                if (notifyIfNone) NotificationService.ShowInfo("Checking for updates...");

                var manager = new UpdateManager(App.UpdateUrl);
                var update = await manager.CheckForUpdatesAsync();
                if (update == null)
                {
                    _pendingUpdate = null;
                    PostUpdateStatus("none");
                    if (notifyIfNone) NotificationService.ShowInfo("You're up to date.");
                    return;
                }

                _pendingUpdate = update;
                PostUpdateAvailable(update);
                if (notifyIfNone) NotificationService.ShowSuccess("Update available.");
            }
            catch (Exception ex)
            {
                PostUpdateStatus("error");
                if (notifyIfNone) NotificationService.ShowError("Update check failed: " + ex.Message);
                Console.WriteLine($"[TFY] Update check failed: {ex.Message}");
            }
            finally
            {
                _updateCheckInProgress = false;
            }
        }

        private async Task ApplyPendingUpdateAsync()
        {
            try
            {
                var manager = new UpdateManager(App.UpdateUrl);
                var update = _pendingUpdate ?? await manager.CheckForUpdatesAsync();
                if (update == null)
                {
                    NotificationService.ShowInfo("You're up to date.");
                    PostUpdateStatus("none");
                    return;
                }

                NotificationService.ShowInfo("Downloading update...");
                await manager.DownloadUpdatesAsync(update);
                NotificationService.ShowSuccess("Update ready. Restarting...");
                manager.ApplyUpdatesAndRestart(update);
            }
            catch (Exception ex)
            {
                NotificationService.ShowError("Update failed: " + ex.Message);
                Console.WriteLine($"[TFY] Update apply failed: {ex.Message}");
            }
        }

        private void StartStatsTimer()
        {
            _statsTimer = new DispatcherTimer();
            _statsTimer.Interval = TimeSpan.FromSeconds(1);
            _statsTimer.Tick += (s, e) =>
            {
                try
                {
                    var stats = _hardwareMonitor.GetHardwareStats();
                    string json = JsonConvert.SerializeObject(new { type = "stats", data = stats });
                    webView.CoreWebView2.PostWebMessageAsJson(json);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[TFY] Stats Timer Error: {ex.Message}");
                }
            };
            _statsTimer.Start();
        }
        private void ClearPremiumCache()
        {
            try
            {
                string appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string premiumPath = Path.Combine(appData, "TFY", "premium.json");
                if (File.Exists(premiumPath))
                {
                    File.Delete(premiumPath);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TFY] Failed to clear premium cache: {ex.Message}");
            }
        }
        private async Task<bool> ResolvePremiumAsync()
        {
            if (_premiumResolved) return _premiumEnabled;
            try
            {
                var discord = await _discordAuth.GetStateAsync();
                if (!string.IsNullOrWhiteSpace(discord.UserId))
                {
                    // ── Discord bot API ───────────────────────────────────────────────────
                    string apiUrl = Environment.GetEnvironmentVariable("TFY_PREMIUM_API") ?? "http://217.154.161.167:11874/check-role";
                    var payload = new { userId = discord.UserId };
                    var body = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");
                    var response = await _httpClient.PostAsync(apiUrl, body);
                    if (response.IsSuccessStatusCode)
                    {
                        var json = await response.Content.ReadAsStringAsync();
                        dynamic data = JsonConvert.DeserializeObject<dynamic>(json);
                        _premiumEnabled = data?.hasRole == true || data?.premium == true || data?.enabled == true;
                        SavePremiumState(_premiumEnabled);
                        _premiumResolved = true;
                        return _premiumEnabled;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TFY] Premium check failed: {ex.Message}");
            }

            // Fallback: last saved local state
            _premiumResolved = true;
            return _premiumEnabled;
        }

        private async Task<bool> ResolveTestingAsync()
        {
            if (_testingResolved) return _testingEnabled;
            try
            {
                var discord = await _discordAuth.GetStateAsync();
                if (!string.IsNullOrWhiteSpace(discord.UserId))
                {
                    string apiUrl = Environment.GetEnvironmentVariable("TFY_TESTING_API");
                    if (string.IsNullOrWhiteSpace(apiUrl))
                    {
                        var premiumApi = Environment.GetEnvironmentVariable("TFY_PREMIUM_API");
                        if (!string.IsNullOrWhiteSpace(premiumApi))
                        {
                            try
                            {
                                var uri = new Uri(premiumApi);
                                apiUrl = $"{uri.Scheme}://{uri.Host}{(uri.IsDefaultPort ? "" : ":" + uri.Port)}/check-role-testing";
                            }
                            catch
                            {
                                apiUrl = null;
                            }
                        }
                    }
                    if (string.IsNullOrWhiteSpace(apiUrl))
                    {
                        apiUrl = "http://217.154.161.167:11874/check-role-testing";
                    }

                    var payload = new { userId = discord.UserId };
                    var body = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");
                    var response = await _httpClient.PostAsync(apiUrl, body);
                    if (response.IsSuccessStatusCode)
                    {
                        var json = await response.Content.ReadAsStringAsync();
                        dynamic data = JsonConvert.DeserializeObject<dynamic>(json);
                        _testingEnabled = data?.hasRole == true || data?.premium == true || data?.enabled == true;
                        _testingResolved = true;
                        return _testingEnabled;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TFY] Testing access check failed: {ex.Message}");
            }

            _testingResolved = true;
            return _testingEnabled;
        }

        private bool LoadPremiumState()
        {
            try
            {
                string folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TFY");
                string path = Path.Combine(folder, "premium.json");
                if (!File.Exists(path)) return false;
                var payload = JsonConvert.DeserializeObject<dynamic>(File.ReadAllText(path));
                return payload?.enabled == true;
            }
            catch
            {
                return false;
            }
        }



        private async Task ApplyCs2ConfigAsync(string jsonPayload)
        {
            var resultJson = await _cs2ConfigService.ApplyCs2ConfigAsync(jsonPayload);
            // We can post a message back if needed, but UI uses internal notifications directly
            // Still, it's good practice to log or return something
        }

        private void SavePremiumState(bool enabled)
        {
            try
            {
                string folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TFY");
                Directory.CreateDirectory(folder);
                string path = Path.Combine(folder, "premium.json");
                var payload = new { enabled, updatedAt = DateTimeOffset.UtcNow };
                File.WriteAllText(path, JsonConvert.SerializeObject(payload, Formatting.Indented));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TFY] Premium save failed: {ex.Message}");
            }
        }
    }
}


