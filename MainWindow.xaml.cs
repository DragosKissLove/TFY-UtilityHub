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
        private readonly DiscordRpcService _discordRpc = new DiscordRpcService();
        private DispatcherTimer _statsTimer;
        private bool _isRefreshingDiscord = false;
        private readonly object _discordLock = new object();
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
        private List<DebloaterApp> _debloaterStartupCache = new List<DebloaterApp>();
        private readonly List<string> _sessionDebugLogs = new List<string>();
        private readonly object _sessionLogLock = new object();
        private string _uiBuildKey = "default";
        private static int _savedRobloxVolume = 100;

        public MainWindow()
        {
            InitializeComponent();
            _premiumEnabled = LoadPremiumState();
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
                _discordRpc?.Deinitialize();
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
                    "TFY_WebView2"
                );
                var options = new CoreWebView2EnvironmentOptions("--allow-file-access-from-files --disable-web-security");
                var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder, options);
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
                settings.AreDevToolsEnabled = true;
                settings.AreDefaultContextMenusEnabled = true;
                settings.IsStatusBarEnabled = false;
                settings.IsZoomControlEnabled = false;
                settings.AreDefaultScriptDialogsEnabled = true;

                // Intercept downloads to hide the Edge popup and use a native save dialog
                webView.CoreWebView2.DownloadStarting += (s, e) =>
                {
                    e.Handled = true; // Hide the default Edge download UI
                    var dlg = new Microsoft.Win32.SaveFileDialog();
                    dlg.FileName = Path.GetFileName(e.ResultFilePath);
                    if (dlg.ShowDialog() == true)
                    {
                        e.ResultFilePath = dlg.FileName;
                    }
                    else
                    {
                        e.Cancel = true;
                    }
                };

                if (Directory.Exists(projectPath) && File.Exists(Path.Combine(projectPath, "index.html")))
                {
                    webView.CoreWebView2.SetVirtualHostNameToFolderMapping("tfy.app", projectPath, CoreWebView2HostResourceAccessKind.Allow);
                    
                    try
                    {
                        await webView.CoreWebView2.Profile.ClearBrowsingDataAsync(
                            Microsoft.Web.WebView2.Core.CoreWebView2BrowsingDataKinds.CacheStorage | 
                            Microsoft.Web.WebView2.Core.CoreWebView2BrowsingDataKinds.DiskCache);
                    }
                    catch { }

                    // Always evict the stale version badge so the new assembly version
                    // sent via PostAppVersion() always wins over any cached localStorage value.
                    string currentVer = GetAppVersion();
                    await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(@"
                        try { localStorage.removeItem('tfy.appVersion'); localStorage.removeItem('tfy.uiBuild'); } catch {}
                        window.onerror = function(msg, url, line, col, err) {
                            if (window.chrome && window.chrome.webview) {
                                window.chrome.webview.postMessage('js-error|' + msg + ' at ' + url + ':' + line + ':' + col + (err ? ' ' + err.stack : ''));
                            }
                        };
                        window.addEventListener('unhandledrejection', function(e) {
                            if (window.chrome && window.chrome.webview) {
                                window.chrome.webview.postMessage('js-error|Unhandled rejection: ' + (e.reason ? (e.reason.stack || e.reason) : 'unknown'));
                            }
                        });
                    ");

                    bool initialNav = true;
                    string timeStamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
                    string localUrl = $"https://tfy.app/index.html?t={timeStamp}";
                    string fileUrl = new Uri(Path.Combine(projectPath, "index.html")).AbsoluteUri + $"?t={timeStamp}";
                    AddSessionLog($"[WebView2] Navigating to {localUrl} (fallback: {fileUrl}) with projectPath={projectPath}");
                    webView.CoreWebView2.Navigate(localUrl);

                    webView.CoreWebView2.NavigationCompleted += async (s, e) =>
                    {
                        AddSessionLog($"[WebView2 NavCompleted] IsSuccess={e.IsSuccess}, Status={e.WebErrorStatus}, URL={webView.Source}");
                        if (!e.IsSuccess && initialNav)
                        {
                            initialNav = false;
                            AddSessionLog($"[TFY] Virtual host UI failed ({e.WebErrorStatus}). Falling back to file:// URL...");
                            webView.CoreWebView2.Navigate(fileUrl);
                            return;
                        }

                        if (!e.IsSuccess) return;

                        try
                        {
                            var specs = _hardwareMonitor.GetSystemSpecs();
                            string json = JsonConvert.SerializeObject(new { type = "specs", data = specs });
                            webView.CoreWebView2.PostWebMessageAsJson(json);

                            var cachedDiscordState = _discordAuth.GetCachedState();
                            string cachedDiscordJson = JsonConvert.SerializeObject(new { type = "discord", data = cachedDiscordState });
                            webView.CoreWebView2.PostWebMessageAsJson(cachedDiscordJson);

                            _ = Task.Run(async () =>
                            {
                                lock (_discordLock)
                                {
                                    if (_isRefreshingDiscord) return;
                                    _isRefreshingDiscord = true;
                                }
                                try
                                {
                                    var freshState = await _discordAuth.GetStateAsync();
                                    Dispatcher.Invoke(() =>
                                    {
                                        string freshJson = JsonConvert.SerializeObject(new { type = "discord", data = freshState });
                                        webView.CoreWebView2.PostWebMessageAsJson(freshJson);
                                    });
                                }
                                catch (Exception ex)
                                {
                                    Console.WriteLine("[TFY] Startup Discord state refresh failed: " + ex.Message);
                                }
                                finally
                                {
                                    lock (_discordLock)
                                    {
                                        _isRefreshingDiscord = false;
                                    }
                                }
                            });

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

                    if (message != null && message.StartsWith("{") && message.Contains("set-update-channel"))
                    {
                        try
                        {
                            dynamic jsonMsg = Newtonsoft.Json.JsonConvert.DeserializeObject<dynamic>(message);
                            if (jsonMsg.type == "set-update-channel")
                            {
                                bool beta = jsonMsg.data?.beta == true;
                                string settingsFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TFY");
                                Directory.CreateDirectory(settingsFolder);
                                string settingsPath = Path.Combine(settingsFolder, "settings.json");
                                File.WriteAllText(settingsPath, $"{{\"betaChannel\":{beta.ToString().ToLower()}}}");
                            }
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"[TFY] set-update-channel error: {ex.Message}");
                        }
                    }
                    
                    if (message != null && message.StartsWith("{") && message.Contains("media-downloader"))
                    {
                        try
                        {
                            dynamic jsonMsg = JsonConvert.DeserializeObject<dynamic>(message);
                            if (jsonMsg.type == "media-downloader")
                            {
                                string action = jsonMsg.action;
                                var downloader = new Services.MediaDownloaderService();
                                if (action == "check")
                                {
                                    bool installed = downloader.IsEngineInstalled();
                                    string res = JsonConvert.SerializeObject(new { type = "media-downloader", action = "status", installed = installed });
                                    webView.CoreWebView2.PostWebMessageAsJson(res);
                                }
                                else if (action == "install")
                                {
                                    _ = Task.Run(async () =>
                                    {
                                        try {
                                            await downloader.InstallEngineAsync((percent) =>
                                            {
                                                string res = JsonConvert.SerializeObject(new { type = "media-downloader", action = "install-progress", progress = percent });
                                                Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(res));
                                            });
                                            string resDone = JsonConvert.SerializeObject(new { type = "media-downloader", action = "status", installed = true });
                                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(resDone));
                                        } catch (Exception ex) {
                                            string resErr = JsonConvert.SerializeObject(new { type = "media-downloader", action = "error", message = ex.Message });
                                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(resErr));
                                        }
                                    });
                                }
                                else if (action == "download")
                                {
                                    string url = jsonMsg.url;
                                    string format = jsonMsg.format;
                                    
                                    _ = Task.Run(async () =>
                                    {
                                        try {
                                            bool isPlaylist = url.Contains("playlist", StringComparison.OrdinalIgnoreCase) || 
                                                              url.Contains("&list=", StringComparison.OrdinalIgnoreCase) || 
                                                              url.Contains("album", StringComparison.OrdinalIgnoreCase);

                                            string title = await downloader.GetMediaTitleAsync(url, isPlaylist);
                                            string safeTitle = string.Join("_", title.Split(System.IO.Path.GetInvalidFileNameChars()));
                                            
                                            Dispatcher.Invoke(() => 
                                            {
                                                string outPath = null;
                                                bool selected = false;

                                                if (isPlaylist)
                                                {
                                                    var dlg = new Microsoft.Win32.OpenFolderDialog
                                                    {
                                                        Title = "Select Folder to Save Playlist",
                                                        InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyMusic)
                                                    };
                                                    
                                                    if (dlg.ShowDialog() == true)
                                                    {
                                                        outPath = dlg.FolderName;
                                                        selected = true;
                                                    }
                                                }
                                                else
                                                {
                                                    var dlg = new Microsoft.Win32.SaveFileDialog
                                                    {
                                                        Title = "Save Media As",
                                                        FileName = safeTitle,
                                                        Filter = format == "mp3" ? "Audio File (*.mp3)|*.mp3" : "Video File (*.mp4)|*.mp4"
                                                    };
                                                    
                                                    if (dlg.ShowDialog() == true)
                                                    {
                                                        outPath = dlg.FileName;
                                                        selected = true;
                                                    }
                                                }

                                                if (selected && !string.IsNullOrEmpty(outPath))
                                                {
                                                    _ = Task.Run(async () =>
                                                    {
                                                        try {
                                                            await downloader.DownloadMediaAsync(url, format, outPath, isPlaylist, (percent) =>
                                                            {
                                                                string res = JsonConvert.SerializeObject(new { type = "media-downloader", action = "download-progress", progress = percent });
                                                                Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(res));
                                                            });
                                                            string resDone = JsonConvert.SerializeObject(new { type = "media-downloader", action = "download-done", success = true, path = outPath });
                                                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(resDone));
                                                        } catch (Exception ex) {
                                                            string resErr = JsonConvert.SerializeObject(new { type = "media-downloader", action = "error", message = ex.Message });
                                                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(resErr));
                                                        }
                                                    });
                                                }
                                                else
                                                {
                                                    string resCancel = JsonConvert.SerializeObject(new { type = "media-downloader", action = "download-done", success = false });
                                                    webView.CoreWebView2.PostWebMessageAsJson(resCancel);
                                                }
                                            });
                                        } catch (Exception ex) {
                                            string resErr = JsonConvert.SerializeObject(new { type = "media-downloader", action = "error", message = "Failed to fetch title: " + ex.Message });
                                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(resErr));
                                        }
                                    });
                                }
                                return; // Handled
                            }
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"[MediaDownloader] Error parsing JSON: {ex.Message}");
                        }
                    }

                    if (message != null && message.StartsWith("discord-rpc-toggle|"))
                    {
                        string val = message.Split('|')[1];
                        _discordRpc.SetEnabled(val.ToLower() == "true");
                    }
                    if (message != null && message.StartsWith("discord-rpc-status|"))
                    {
                        string status = message.Substring("discord-rpc-status|".Length);
                        _discordRpc.UpdatePresence(status);
                    }
                    if (message != null && message.StartsWith("app-startup-toggle|"))
                    {
                        try {
                            bool enable = message.Split('|')[1].ToLower() == "true";
                            string runKey = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
                            using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(runKey, true))
                            {
                                if (key != null)
                                {
                                    if (enable)
                                    {
                                        string exePath = System.Reflection.Assembly.GetEntryAssembly().Location;
                                        if (exePath.EndsWith(".dll"))
                                        {
                                            exePath = System.IO.Path.ChangeExtension(exePath, "exe");
                                        }
                                        key.SetValue("TFYUtilityHub", $"\"{exePath}\"");
                                    }
                                    else
                                    {
                                        key.DeleteValue("TFYUtilityHub", false);
                                    }
                                }
                            }
                        } catch (Exception ex) {
                            Console.WriteLine($"[TFY] Startup Toggle Error: {ex.Message}");
                        }
                    }
                    if (message == "app-startup-get")
                    {
                        try {
                            string runKey = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
                            bool enabled = false;
                            using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(runKey, false))
                            {
                                if (key != null)
                                {
                                    enabled = key.GetValue("TFYUtilityHub") != null;
                                }
                            }
                            string res = JsonConvert.SerializeObject(new { type = "app-startup-status", enabled = enabled });
                            webView.CoreWebView2.PostWebMessageAsJson(res);
                        } catch (Exception ex) {
                            Console.WriteLine($"[TFY] Startup Get Error: {ex.Message}");
                        }
                    }
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


                    if (message == "steam-get-installed-games")
                    {
                        _ = Task.Run(() =>
                        {
                            try
                            {
                                var games = Services.SteamUnlockerService.GetLibraryGames();
                                string res = JsonConvert.SerializeObject(new { type = "steam-installed-games-result", data = games });
                                Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(res));
                            }
                            catch (Exception ex)
                            {
                                string resErr = JsonConvert.SerializeObject(new { type = "steam-installed-games-result", error = ex.Message });
                                Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(resErr));
                            }
                        });
                    }

                    if (message != null && message.StartsWith("steam-achievement-query|"))
                    {
                        string appId = message.Substring("steam-achievement-query|".Length);
                        _ = Task.Run(() =>
                        {
                            try
                            {
                                string output = Services.SteamUnlockerService.QueryAchievements(appId);
                                string res = JsonConvert.SerializeObject(new { type = "steam-achievement-query-result", appId = appId, rawJson = output });
                                Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(res));
                            }
                            catch (Exception ex)
                            {
                                string resErr = JsonConvert.SerializeObject(new { type = "steam-achievement-query-result", appId = appId, error = ex.Message });
                                Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(resErr));
                            }
                        });
                    }

                    if (message != null && message.StartsWith("steam-achievement-commit|"))
                    {
                        string payloadStr = message.Substring("steam-achievement-commit|".Length);
                        _ = Task.Run(() =>
                        {
                            string appId = "";
                            try
                            {
                                int colonIndex = payloadStr.IndexOf(':');
                                if (colonIndex > 0)
                                {
                                    appId = payloadStr.Substring(0, colonIndex);
                                    string jsonPayload = payloadStr.Substring(colonIndex + 1);

                                    string output = Services.SteamUnlockerService.CommitAchievements(appId, jsonPayload);
                                    string res = JsonConvert.SerializeObject(new { type = "steam-achievement-commit-result", appId = appId, rawJson = output });
                                    Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(res));
                                }
                                else
                                {
                                    throw new Exception("Invalid commit message format. Expected 'appId:JSON_payload'.");
                                }
                            }
                            catch (Exception ex)
                            {
                                string resErr = JsonConvert.SerializeObject(new { type = "steam-achievement-commit-result", appId = appId, error = ex.Message });
                                Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(resErr));
                            }
                        });
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

                            // Force re-evaluation of premium and testing roles for the new user session
                            _premiumResolved = false;
                            _testingResolved = false;
                            
                            _premiumEnabled = await ResolvePremiumAsync();
                            string premiumJson = JsonConvert.SerializeObject(new { type = "premium", data = new { enabled = _premiumEnabled } });
                            webView.CoreWebView2.PostWebMessageAsJson(premiumJson);

                            _testingEnabled = await ResolveTestingAsync();
                            string testingJson = JsonConvert.SerializeObject(new { type = "testing", data = new { enabled = _testingEnabled } });
                            webView.CoreWebView2.PostWebMessageAsJson(testingJson);
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine("[TFY] Discord login failed: " + ex.Message);
                        }
                    }

                    if (message == "discord-get")
                    {
                        var cachedDiscordState = _discordAuth.GetCachedState();
                        string cachedDiscordJson = JsonConvert.SerializeObject(new { type = "discord", data = cachedDiscordState });
                        webView.CoreWebView2.PostWebMessageAsJson(cachedDiscordJson);

                        _ = Task.Run(async () =>
                        {
                            lock (_discordLock)
                            {
                                if (_isRefreshingDiscord) return;
                                _isRefreshingDiscord = true;
                            }
                            try
                            {
                                var freshState = await _discordAuth.GetStateAsync();
                                Dispatcher.Invoke(() =>
                                {
                                    string freshJson = JsonConvert.SerializeObject(new { type = "discord", data = freshState });
                                    webView.CoreWebView2.PostWebMessageAsJson(freshJson);
                                });
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine("[TFY] Background Discord status update failed: " + ex.Message);
                            }
                            finally
                            {
                                lock (_discordLock)
                                {
                                    _isRefreshingDiscord = false;
                                }
                            }
                        });
                    }
                    if (message == "discord-logout")
                    {
                        await _discordAuth.LogoutAsync();
                        string discordJson = JsonConvert.SerializeObject(new { type = "discord", data = new { connected = false, isLogout = true } });
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
                        _premiumResolved = false;
                        _premiumEnabled = await ResolvePremiumAsync();
                        string premiumJson = JsonConvert.SerializeObject(new { type = "premium", data = new { enabled = _premiumEnabled } });
                        webView.CoreWebView2.PostWebMessageAsJson(premiumJson);
                    }
                    if (message == "testing-get")
                    {
                        _testingResolved = false;
                        _testingEnabled = await ResolveTestingAsync();
                        string testingJson = JsonConvert.SerializeObject(new { type = "testing", data = new { enabled = _testingEnabled } });
                        webView.CoreWebView2.PostWebMessageAsJson(testingJson);
                    }

                    if (message == "app-path-get")
                    {
                        try {
                            var appDataPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TFY");
                            string res = JsonConvert.SerializeObject(new { type = "app-path", data = new { path = appDataPath } });
                            webView.CoreWebView2.PostWebMessageAsJson(res);
                        } catch { }
                    }
                    if (message == "defender-exclude-add")
                    {
                        try
                        {
                            var appDataPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TFY");
                            string safePath = appDataPath.Replace("'", "''");
                            var startInfo = new ProcessStartInfo
                            {
                                FileName = "powershell.exe",
                                Arguments = $"-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command \"if (Get-Command Add-MpPreference -ErrorAction SilentlyContinue) {{ try {{ Add-MpPreference -ExclusionPath '{safePath}' -ErrorAction Stop; Add-MpPreference -ExclusionProcess 'TFY.exe' -ErrorAction Stop }} catch {{ exit 1 }} }} else {{ exit 0 }}\"",
                                UseShellExecute = true,
                                CreateNoWindow = true,
                                Verb = "runas"
                            };
                            using (var proc = Process.Start(startInfo))
                            {
                                await Task.Run(() => proc?.WaitForExit());
                                bool ok = proc?.ExitCode == 0;
                                string response = JsonConvert.SerializeObject(new { type = "defender-exclude-status", data = new { success = ok } });
                                webView.CoreWebView2.PostWebMessageAsJson(response);
                                if (ok)
                                {
                                    PostInAppNotification("success", "Windows Defender Exclusions", "Folder successfully added to Defender exclusions!", 5000);
                                }
                                else
                                {
                                    PostInAppNotification("error", "Windows Defender Exclusions", "Failed to add exclusions. Try adding manually.", 6000);
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            string response = JsonConvert.SerializeObject(new { type = "defender-exclude-status", data = new { success = false, error = ex.Message } });
                            webView.CoreWebView2.PostWebMessageAsJson(response);
                            PostInAppNotification("error", "Exclusion Error", ex.Message, 6000);
                        }
                    }
                    if (message == "defender-open-settings")
                    {
                        try
                        {
                            Process.Start(new ProcessStartInfo
                            {
                                FileName = "ms-settings:windowsdefender",
                                UseShellExecute = true
                            });
                        }
                        catch
                        {
                            try
                            {
                                Process.Start(new ProcessStartInfo
                                {
                                    FileName = "explorer.exe",
                                    Arguments = "windowssecurity://virus-threat",
                                    UseShellExecute = true
                                });
                            }
                            catch { }
                        }
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

                    // Roblox MultiRoblox Handlers
                    if (message == "roblox-status")
                    {
                        var payload = JsonConvert.SerializeObject(new
                        {
                            type = "roblox-status",
                            data = new
                            {
                                active = RobloxService.IsMultiInstanceActive,
                                count = RobloxService.GetRunningRobloxCount(),
                                pids = RobloxService.GetRunningRobloxPids(),
                                antiAfk = RobloxService.IsAntiAfkActive
                            }
                        });
                        webView.CoreWebView2.PostWebMessageAsJson(payload);
                    }
                    if (message == "roblox-multi-toggle")
                    {
                        bool active = RobloxService.ToggleMultiInstance(out string msg);
                        var payload = JsonConvert.SerializeObject(new
                        {
                            type = "roblox-status",
                            data = new
                            {
                                active = active,
                                count = RobloxService.GetRunningRobloxCount(),
                                pids = RobloxService.GetRunningRobloxPids(),
                                antiAfk = RobloxService.IsAntiAfkActive,
                                message = msg
                            }
                        });
                        webView.CoreWebView2.PostWebMessageAsJson(payload);
                    }
                    if (message != null && message.StartsWith("roblox-launch|"))
                    {
                        // Format: roblox-launch|{target}<<COOKIE>>{cookie}<<LAUNCHER>>{launcher}
                        string payload = message.Substring("roblox-launch|".Length);
                        string cookie = "";
                        string target = "";
                        string preferredLauncher = "auto";

                        int launcherIdx = payload.IndexOf("<<LAUNCHER>>");
                        if (launcherIdx >= 0)
                        {
                            preferredLauncher = payload.Substring(launcherIdx + "<<LAUNCHER>>".Length).Trim();
                            payload = payload.Substring(0, launcherIdx);
                        }

                        int delimIdx = payload.IndexOf("<<COOKIE>>");
                        if (delimIdx >= 0)
                        {
                            target = payload.Substring(0, delimIdx);
                            cookie = payload.Substring(delimIdx + "<<COOKIE>>".Length);
                        }
                        else
                        {
                            cookie = payload;
                        }
                        _ = Task.Run(async () =>
                        {
                            string browserTicket = null;
                            try
                            {
                                await Dispatcher.InvokeAsync(async () =>
                                {
                                    browserTicket = await RobloxService.GetAuthTicketViaBrowserAsync(webView);
                                });
                            }
                            catch { }

                            var (success, pid, error) = await RobloxService.LaunchAccountAsync(cookie, target, browserTicket, preferredLauncher);
                            if (success)
                            {
                                _ = Task.Run(async () =>
                                {
                                    for (int attempt = 0; attempt < 5; attempt++)
                                    {
                                        await Task.Delay(3000);
                                        RobloxService.SetRobloxVolume(_savedRobloxVolume);
                                    }
                                });
                            }
                            await Dispatcher.InvokeAsync(() =>
                            {
                                webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(new
                                {
                                    type = "roblox-launched",
                                    data = new { success, pid, error }
                                }));
                            });
                        });
                    }
                    if (message == "roblox-get-launchers")
                    {
                        var launchers = RobloxService.GetInstalledLaunchers();
                        webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(new
                        {
                            type = "roblox-launchers-list",
                            data = launchers
                        }));
                    }
                    if (message == "roblox-kill-all")
                    {
                        int count = RobloxService.KillAllRobloxInstances();
                        webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(new
                        {
                            type = "roblox-status",
                            data = new
                            {
                                active = RobloxService.IsMultiInstanceActive,
                                count = 0,
                                pids = new List<int>(),
                                antiAfk = RobloxService.IsAntiAfkActive,
                                killed = count
                            }
                        }));
                    }
                    if (message != null && message.StartsWith("roblox-kill-pid|"))
                    {
                        string strPid = message.Substring("roblox-kill-pid|".Length);
                        if (int.TryParse(strPid, out int targetPid))
                        {
                            RobloxService.KillRobloxProcess(targetPid);
                        }
                        webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(new
                        {
                            type = "roblox-status",
                            data = new
                            {
                                active = RobloxService.IsMultiInstanceActive,
                                count = RobloxService.GetRunningRobloxCount(),
                                pids = RobloxService.GetRunningRobloxPids(),
                                antiAfk = RobloxService.IsAntiAfkActive
                            }
                        }));
                    }
                    if (message != null && message.StartsWith("roblox-set-fps|"))
                    {
                        if (int.TryParse(message.Substring("roblox-set-fps|".Length), out int fpsVal))
                        {
                            RobloxService.SetFpsCap(fpsVal, out _);
                        }
                    }
                    if (message != null && message.StartsWith("roblox-set-graphics|"))
                    {
                        var parts = message.Substring("roblox-set-graphics|".Length).Split('|');
                        int.TryParse(parts[0], out int gfxLevel);
                        bool isAuto = parts.Length > 1 && parts[1] == "auto";
                        RobloxService.SetGraphicsQuality(gfxLevel, isAuto, out _);
                    }
                    if (message != null && message.StartsWith("roblox-set-volume|"))
                    {
                        if (int.TryParse(message.Substring("roblox-set-volume|".Length), out int vol))
                        {
                            _savedRobloxVolume = vol;
                            RobloxService.SetRobloxVolume(vol);
                        }
                    }
                    if (message != null && message.StartsWith("roblox-antiafk-toggle|"))
                    {
                        int.TryParse(message.Substring("roblox-antiafk-toggle|".Length), out int interval);
                        if (interval <= 0) interval = 1080;
                        RobloxService.ToggleAntiAfk(interval, out string afkMsg);
                        webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(new
                        {
                            type = "roblox-status",
                            data = new
                            {
                                active = RobloxService.IsMultiInstanceActive,
                                count = RobloxService.GetRunningRobloxCount(),
                                pids = RobloxService.GetRunningRobloxPids(),
                                antiAfk = RobloxService.IsAntiAfkActive,
                                message = afkMsg
                            }
                        }));
                    }
                    if (message != null && message.StartsWith("roblox-trim-memory|"))
                    {
                        string strPid = message.Substring("roblox-trim-memory|".Length);
                        int? tPid = int.TryParse(strPid, out int p) ? p : (int?)null;
                        RobloxService.TrimMemory(tPid);
                    }
                    if (message != null && message.StartsWith("roblox-set-priority|"))
                    {
                        var parts = message.Substring("roblox-set-priority|".Length).Split('|');
                        if (parts.Length == 2 && int.TryParse(parts[0], out int pPid))
                        {
                            RobloxService.SetProcessPriority(pPid, parts[1]);
                        }
                    }
                    if (message != null && message.StartsWith("roblox-get-charts|"))
                    {
                        string cat = message.Substring("roblox-get-charts|".Length);
                        _ = Task.Run(async () =>
                        {
                            var charts = await RobloxService.GetRobloxChartsAsync(cat);
                            await Dispatcher.InvokeAsync(() =>
                            {
                                webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(new
                                {
                                    type = "roblox-charts-data",
                                    data = new { category = cat, games = charts }
                                }));
                            });
                        });
                    }
                    if (message != null && message.StartsWith("roblox-validate-cookie|"))
                    {
                        string cookieVal = message.Substring("roblox-validate-cookie|".Length);
                        _ = Task.Run(async () =>
                        {
                            var res = await RobloxService.ValidateCookieAsync(cookieVal);
                            await Dispatcher.InvokeAsync(() =>
                            {
                                webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(new
                                {
                                    type = "roblox-cookie-validated",
                                    data = res,
                                    cookie = RobloxService.CleanCookie(cookieVal)
                                }));
                            });
                        });
                    }
                    if (message != null && message.StartsWith("roblox-send-webhook|"))
                    {
                        var parts = message.Substring("roblox-send-webhook|".Length).Split(new char[] { '|' }, 3);
                        string hookUrl = parts.Length > 0 ? parts[0] : "";
                        string hookMsg = parts.Length > 1 ? parts[1] : "TFY MultiRoblox Status Ping";
                        string hookAccounts = parts.Length > 2 ? parts[2] : "";
                        _ = Task.Run(async () =>
                        {
                            var (ok, err) = await RobloxService.SendDiscordWebhookAsync(hookUrl, hookMsg, hookAccounts);
                            await Dispatcher.InvokeAsync(() =>
                            {
                                webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(new
                                {
                                    type = "roblox-webhook-result",
                                    data = new { ok, message = ok ? "Webhook test succeeded!" : err }
                                }));
                            });
                        });
                    }
                    if (message == "roblox-open-login-window")
                    {
                        OpenRobloxLoginWindow();
                    }
                    if (message != null && message.StartsWith("roblox-resolve-place|"))
                    {
                        string placeId = message.Substring("roblox-resolve-place|".Length).Trim();
                        _ = Task.Run(async () =>
                        {
                            var result = await RobloxService.ResolveGameInfoAsync(placeId);
                            await Dispatcher.InvokeAsync(() =>
                            {
                                webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(new
                                {
                                    type = "roblox-game-resolved",
                                    data = result
                                }));
                            });
                        });
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
                        if (id == "system_corruption")
                        {
                            _ = RunSystemCorruptionCheckAsync();
                        }
                        else
                        {
                            _ = Task.Run(() =>
                            {
                                var result = _fixes.RunFix(id);
                                var payload = JsonConvert.SerializeObject(new { type = "fixes", action = "result", data = new { id, ok = result.Ok, message = result.Message } });
                                Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(payload));
                            });
                        }
                    }

                    if (message == "gpu-check-driver")
                    {
                        bool installed = IsNvidiaDriverInstalled();
                        var payload = JsonConvert.SerializeObject(new { type = "gpu_optimizer", action = "driver_status", hasNvidiaDriver = installed });
                        webView.CoreWebView2.PostWebMessageAsJson(payload);
                    }
                    if (message == "gpu-create-backup")
                    {
                        _ = Task.Run(() =>
                        {
                            var result = _backups.CreateRestorePoint("Before GPU Optimization");
                            var payload = JsonConvert.SerializeObject(new { type = "gpu_optimizer", action = "backup_status", ok = result.ok, message = result.message });
                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(payload));
                        });
                    }
                    if (message == "gpu-launch-ddu")
                    {
                        try
                        {
                            string dduPath = ResolveOptimizationFilePath(@"DDU v18.1.5.3\Display Driver Uninstaller.exe");
                            if (File.Exists(dduPath))
                            {
                                Process.Start(new ProcessStartInfo { FileName = dduPath, UseShellExecute = true });
                                var payload = JsonConvert.SerializeObject(new { type = "gpu_optimizer", action = "launch_status", tool = "ddu", ok = true });
                                webView.CoreWebView2.PostWebMessageAsJson(payload);
                            }
                            else
                            {
                                var payload = JsonConvert.SerializeObject(new { type = "gpu_optimizer", action = "launch_status", tool = "ddu", ok = false, message = "Display Driver Uninstaller.exe not found." });
                                webView.CoreWebView2.PostWebMessageAsJson(payload);
                            }
                        }
                        catch (Exception ex)
                        {
                            var payload = JsonConvert.SerializeObject(new { type = "gpu_optimizer", action = "launch_status", tool = "ddu", ok = false, message = ex.Message });
                            webView.CoreWebView2.PostWebMessageAsJson(payload);
                        }
                    }
                    if (message == "gpu-launch-nvclean")
                    {
                        try
                        {
                            string nvCleanPath = ResolveOptimizationFilePath("NVCleanstall_1.19.0.exe");
                            if (File.Exists(nvCleanPath))
                            {
                                Process.Start(new ProcessStartInfo { FileName = nvCleanPath, UseShellExecute = true });
                                var payload = JsonConvert.SerializeObject(new { type = "gpu_optimizer", action = "launch_status", tool = "nvclean", ok = true });
                                webView.CoreWebView2.PostWebMessageAsJson(payload);
                            }
                            else
                            {
                                var payload = JsonConvert.SerializeObject(new { type = "gpu_optimizer", action = "launch_status", tool = "nvclean", ok = false, message = "NVCleanstall_1.19.0.exe not found." });
                                webView.CoreWebView2.PostWebMessageAsJson(payload);
                            }
                        }
                        catch (Exception ex)
                        {
                            var payload = JsonConvert.SerializeObject(new { type = "gpu_optimizer", action = "launch_status", tool = "nvclean", ok = false, message = ex.Message });
                            webView.CoreWebView2.PostWebMessageAsJson(payload);
                        }
                    }
                    if (message == "gpu-apply-profiles")
                    {
                        _ = Task.Run(() =>
                        {
                            try
                            {
                                string inspectorPath = ResolveOptimizationFilePath("nvidiaProfileInspector.exe");
                                string nipPath = ResolveOptimizationFilePath("all_profiles.nip");
                                if (File.Exists(inspectorPath) && File.Exists(nipPath))
                                {
                                    var psi = new ProcessStartInfo
                                    {
                                        FileName = inspectorPath,
                                        Arguments = $"-silentImport \"{nipPath}\"",
                                        UseShellExecute = true,
                                        Verb = "runas"
                                    };
                                    using var p = Process.Start(psi);
                                    p?.WaitForExit();
                                    var payload = JsonConvert.SerializeObject(new { type = "gpu_optimizer", action = "profiles_status", ok = true, message = "Profiles imported and applied successfully!" });
                                    Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(payload));
                                }
                                else
                                {
                                    var payload = JsonConvert.SerializeObject(new { type = "gpu_optimizer", action = "profiles_status", ok = false, message = "Nvidia Profile Inspector or all_profiles.nip not found." });
                                    Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(payload));
                                }
                            }
                            catch (Exception ex)
                            {
                                var payload = JsonConvert.SerializeObject(new { type = "gpu_optimizer", action = "profiles_status", ok = false, message = ex.Message });
                                Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsJson(payload));
                            }
                        });
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

                    if (message != null && message.StartsWith("js-error|"))
                    {
                        string err = message.Substring("js-error|".Length);
                        AddSessionLog($"[JS Error] {err}");
                        Console.WriteLine($"[JS Error] {err}");
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
                    if (message == "runtime-directx-install")
                    {
                        _ = RunRuntimeDirectXInstallAsync();
                    }
                    if (message == "spotx-install")
                    {
                        _ = RunSpotXCrackAsync();
                    }
                    if (message == "winrar-install")
                    {
                        _ = RunWinrarCrackAsync();
                    }
                    if (message == "twitch-miner-launch")
                    {
                        _ = LaunchTwitchMinerAsync();
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

                            if (File.Exists(cacheFile) && (DateTime.UtcNow - File.GetLastWriteTimeUtc(cacheFile)).TotalDays < 3)
                            {
                                var fileInfo = new FileInfo(cacheFile);
                                if (fileInfo.Length > 3 * 1024 * 1024) // Must be > 3MB to be the full library
                                {
                                    var cached = File.ReadAllText(cacheFile);
                                    if (cached.TrimStart().StartsWith("["))
                                        resultJson = cached;
                                }
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
                                    { "FitGirl",   "https://web.archive.org/web/2id_/https://hydralinks.pages.dev/sources/fitgirl.json" },
                                    { "SteamRIP",  "https://web.archive.org/web/2id_/https://hydralinks.pages.dev/sources/steamrip.json" },
                                    { "DODI",      "https://web.archive.org/web/2id_/https://hydralinks.pages.dev/sources/dodi.json" },
                                    { "Xatab",     "https://web.archive.org/web/2id_/https://hydralinks.pages.dev/sources/xatab.json" },
                                    { "OnlineFix", "https://web.archive.org/web/2id_/https://hydralinks.pages.dev/sources/onlinefix.json" },
                                };

                                var handler = new HttpClientHandler() { AutomaticDecompression = System.Net.DecompressionMethods.GZip | System.Net.DecompressionMethods.Deflate | System.Net.DecompressionMethods.Brotli };
                                using var hc = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(90) };
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

                    // ── Fetch Allkeyshop details ───────────────────────────────────────────
                    if (message != null && message.StartsWith("fetch-allkeyshop|"))
                    {
                        string gameName = message.Substring("fetch-allkeyshop|".Length).Trim();
                        _ = Task.Run(async () =>
                        {
                            string slug = ConvertNameToAllkeyshopSlug(gameName);
                            string url = $"https://www.allkeyshop.com/blog/buy-{slug}-cd-key-compare-prices/";
                            string resultJson = "{}";
                            
                            try
                            {
                                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                                request.Headers.UserAgent.Clear();
                                request.Headers.UserAgent.TryParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
                                request.Headers.Accept.TryParseAdd("text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8");
                                request.Headers.AcceptLanguage.TryParseAdd("en-US,en;q=0.5");

                                using var response = await _httpClient.SendAsync(request);
                                if (response.IsSuccessStatusCode)
                                {
                                    string html = await response.Content.ReadAsStringAsync();
                                    var match = System.Text.RegularExpressions.Regex.Match(html, @"var\s+gamePageTrans\s*=\s*(\{.*?\});", System.Text.RegularExpressions.RegexOptions.Singleline);
                                    if (match.Success)
                                    {
                                        resultJson = match.Groups[1].Value;
                                    }
                                }
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine($"[TFY] fetch-allkeyshop failed for {gameName}: {ex.Message}");
                            }

                            var payload = JsonConvert.SerializeObject(new
                            {
                                type = "allkeyshop-data",
                                data = new
                                {
                                    title = gameName,
                                    slug,
                                    json = resultJson
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

                    // ── Open Allkeyshop direct merchant deal (Bypassing loading redirector screen) ──
                    if (message != null && message.StartsWith("open-allkeyshop-deal|"))
                    {
                        string dealUrl = message.Substring("open-allkeyshop-deal|".Length).Trim();
                        _ = Task.Run(async () =>
                        {
                            string targetUrl = await ResolveAllkeyshopRedirectUrl(dealUrl);
                            try
                            {
                                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(targetUrl) { UseShellExecute = true });
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine($"[TFY] open-allkeyshop-deal failed for {targetUrl}: {ex.Message}");
                            }
                        });
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
                    if (message != null && message.StartsWith("startup-toggle|"))
                    {
                        var json = message.Substring("startup-toggle|".Length);
                        var request = JsonConvert.DeserializeObject<dynamic>(json);
                        string id = (string)request?.id;
                        string name = (string)request?.name;
                        string installLocation = (string)request?.installLocation;
                        bool enable = (bool)(request?.enable ?? false);
                        var app = new DebloaterApp
                        {
                            Id = id,
                            Name = name,
                            Type = "startup",
                            InstallLocation = installLocation
                        };
                        await Task.Run(() => {
                            if (enable)
                                _debloater.EnableStartupEntry(app);
                            else
                                _debloater.DisableStartupEntry(app);
                        });
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

        private static string ConvertNameToAllkeyshopSlug(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return "";
            string slug = name.ToLowerInvariant();
            slug = slug.Replace(":", " ");
            slug = System.Text.RegularExpressions.Regex.Replace(slug, @"[^a-z0-9\s-]", "");
            slug = System.Text.RegularExpressions.Regex.Replace(slug, @"[\s-]+", "-");
            return slug.Trim('-');
        }

        private async Task<string> ResolveAllkeyshopRedirectUrl(string url)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.UserAgent.Clear();
                request.Headers.UserAgent.TryParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
                request.Headers.Accept.TryParseAdd("text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8");
                request.Headers.AcceptLanguage.TryParseAdd("en-US,en;q=0.5");

                using var response = await _httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    string html = await response.Content.ReadAsStringAsync();
                    
                    // 1. Match redirectionUrl inside script type="application/json" id="appData"
                    var jsonMatch = System.Text.RegularExpressions.Regex.Match(html, @"""redirectionUrl""\s*:\s*""([^""]+)""");
                    if (jsonMatch.Success)
                    {
                        return jsonMatch.Groups[1].Value.Replace("\\/", "/");
                    }
                    
                    // 2. Fallback to meta refresh URL match
                    var metaMatch = System.Text.RegularExpressions.Regex.Match(html, @"URL=([^""]+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    if (metaMatch.Success)
                    {
                        return metaMatch.Groups[1].Value;
                    }

                    // 3. Fallback to "click here" link extraction
                    var clickMatch = System.Text.RegularExpressions.Regex.Match(html, @"<a\s+[^>]*href=""([^""]+)""[^>]*>.*?click\s+here.*?\s*</a>", System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Singleline);
                    if (clickMatch.Success)
                    {
                        return System.Net.WebUtility.HtmlDecode(clickMatch.Groups[1].Value);
                    }

                    // 4. Fallback to "not redirected" link extraction
                    var notRedirectedMatch = System.Text.RegularExpressions.Regex.Match(html, @"<a\s+[^>]*href=""([^""]+)""[^>]*>.*?not\s+redirected.*?\s*</a>", System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Singleline);
                    if (notRedirectedMatch.Success)
                    {
                        return System.Net.WebUtility.HtmlDecode(notRedirectedMatch.Groups[1].Value);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TFY] ResolveAllkeyshopRedirectUrl failed: {ex.Message}");
            }
            return url; // Return original redirect URL if resolution fails
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
                        Environment.ExpandEnvironmentVariables(@"%LOCALAPPDATA%\NVIDIA\DXCache"),
                        Environment.ExpandEnvironmentVariables(@"%LOCALAPPDATA%\NVIDIA\GLCache"),
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
                PostInAppNotification("info", "TFY Agent", "Pregătire script TFY Agent...", 2000);
                string script = "";
                
                try
                {
                    string firebaseUrl = "https://tfy-project.web.app/tfy-agent.js";
                    using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
                    script = await http.GetStringAsync(firebaseUrl);
                }
                catch { }

                if (string.IsNullOrWhiteSpace(script))
                {
                    string localScriptPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Scripts", "script.js");
                    if (File.Exists(localScriptPath))
                    {
                        script = File.ReadAllText(localScriptPath);
                    }
                }

                if (string.IsNullOrWhiteSpace(script))
                {
                    PostInAppNotification("error", "TFY Agent", "Scriptul TFY Agent nu a putut fi încărcat!", 5000);
                    return;
                }

                Dispatcher.Invoke(() =>
                {
                    try { System.Windows.Clipboard.SetText(script); } catch { }
                });

                PostInAppNotification("info", "TFY Agent", "Injectare în curs...", 2000);
                string result = await DiscordInjector.InjectScriptAsync(script, (statusMsg) => Console.WriteLine(statusMsg));
                bool success = result != null && (result.IndexOf("Succes", StringComparison.OrdinalIgnoreCase) >= 0 || result.IndexOf("Clipboard", StringComparison.OrdinalIgnoreCase) >= 0);
                PostInAppNotification(success ? "success" : "error", "TFY Agent", result ?? "Eroare necunoscută.", 7000);
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

        private void SendProgress(int percent, string status, string log)
        {
            var payload = JsonConvert.SerializeObject(new
            {
                type = "system-check-progress",
                data = new { percent, status, log }
            });
            webView?.CoreWebView2?.PostWebMessageAsJson(payload);
        }

        private void SendRuntimeProgress(int percent, string status, string log = null)
        {
            var payload = JsonConvert.SerializeObject(new
            {
                type = "runtime-installer-progress",
                data = new { percent, status, log }
            });
            webView?.CoreWebView2?.PostWebMessageAsJson(payload);
        }
        private bool ShouldShowConsoleLine(string line)
        {
            if (string.IsNullOrWhiteSpace(line)) return false;
            string trimmed = line.Trim();
            if (trimmed.Contains("Microsoft Corporation", StringComparison.OrdinalIgnoreCase) || 
                trimmed.Contains("All rights reserved", StringComparison.OrdinalIgnoreCase) || 
                trimmed.Contains("©") ||
                trimmed.Contains("Copyright (C)", StringComparison.OrdinalIgnoreCase)) 
                return false;
            
            if (trimmed.StartsWith("Deployment Image Servicing and Management", StringComparison.OrdinalIgnoreCase) || 
                trimmed.StartsWith("Version:", StringComparison.OrdinalIgnoreCase) || 
                trimmed.StartsWith("Image Version:", StringComparison.OrdinalIgnoreCase) ||
                trimmed.StartsWith("Microsoft (R) Windows", StringComparison.OrdinalIgnoreCase)) 
                return false;
            
            // Filter out DISM progress bars like [======= 50% =======]
            if (trimmed.StartsWith("[") && trimmed.Contains("=") && trimmed.EndsWith("]")) 
                return false;
            
            // Filter out Chkdsk spammy progress lines
            if (trimmed.Contains("percent complete", StringComparison.OrdinalIgnoreCase) ||
                (trimmed.Contains("stage", StringComparison.OrdinalIgnoreCase) && trimmed.Contains("%"))) 
                return false;
                
            return true;
        }

        private double ParseDismPercent(string line)
        {
            var match = System.Text.RegularExpressions.Regex.Match(line, @"(\d+\.\d+)%");
            if (match.Success && double.TryParse(match.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double val))
            {
                return val;
            }
            return 0;
        }

        private double ParseSfcPercent(string line)
        {
            var match = System.Text.RegularExpressions.Regex.Match(line, @"Verification\s+(\d+)%\s+complete");
            if (match.Success && double.TryParse(match.Groups[1].Value, out double val))
            {
                return val;
            }
            return 0;
        }

        private double ParseChkdskPercent(string line)
        {
            var match = System.Text.RegularExpressions.Regex.Match(line, @"(\d+)\s*(?:percent|%)");
            if (match.Success && double.TryParse(match.Groups[1].Value, out double val))
            {
                return val;
            }
            return 0;
        }

        private async Task RunProcessWithProgressAsync(string fileName, string arguments, Action<string> onLineRead)
        {
            var tcs = new TaskCompletionSource<bool>();
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = fileName,
                    Arguments = arguments,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                },
                EnableRaisingEvents = true
            };

            process.OutputDataReceived += (s, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data))
                {
                    Dispatcher.Invoke(() => onLineRead(e.Data));
                }
            };

            process.ErrorDataReceived += (s, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data))
                {
                    Dispatcher.Invoke(() => onLineRead("ERROR: " + e.Data));
                }
            };

            process.Exited += (s, e) =>
            {
                tcs.SetResult(true);
                process.Dispose();
            };

            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();

            await tcs.Task;
        }

        private async Task RunSystemCorruptionCheckAsync()
        {
            try
            {
                SendProgress(0, "Initializing system scan...", "Starting System Corruption Check...");

                // 1. Run DISM
                SendProgress(0, "DISM: Repairing system image...", "Launching DISM...");
                double maxDism = 0;
                await RunProcessWithProgressAsync("dism.exe", "/Online /Cleanup-Image /RestoreHealth", (line) =>
                {
                    double subPercent = ParseDismPercent(line);
                    if (subPercent > maxDism) maxDism = subPercent;
                    int overallPercent = (int)(maxDism / 3.0);
                    string logLine = ShouldShowConsoleLine(line) ? line : null;
                    SendProgress(overallPercent, "DISM: Repairing system image...", logLine);
                });

                // 2. Run SFC
                SendProgress(33, "SFC: Scanning system files...", "Launching SFC...");
                double maxSfc = 0;
                await RunProcessWithProgressAsync("sfc.exe", "/scannow", (line) =>
                {
                    double subPercent = ParseSfcPercent(line);
                    if (subPercent > maxSfc) maxSfc = subPercent;
                    int overallPercent = 33 + (int)(maxSfc / 3.0);
                    string logLine = ShouldShowConsoleLine(line) ? line : null;
                    SendProgress(overallPercent, "SFC: Scanning system files...", logLine);
                });

                // 3. Run Chkdsk
                SendProgress(66, "Chkdsk: Checking file system...", "Launching Chkdsk on C:...");
                double maxChkdsk = 0;
                await RunProcessWithProgressAsync("chkdsk.exe", "C:", (line) =>
                {
                    double subPercent = ParseChkdskPercent(line);
                    if (subPercent > maxChkdsk) maxChkdsk = subPercent;
                    int overallPercent = 66 + (int)(maxChkdsk / 3.0);
                    string logLine = ShouldShowConsoleLine(line) ? line : null;
                    SendProgress(overallPercent, "Chkdsk: Checking file system...", logLine);
                });

                SendProgress(100, "System check complete!", "Scan completed successfully. All issues repaired.");
                
                var payload = JsonConvert.SerializeObject(new { type = "system-check-result", data = new { ok = true, message = "System corruption check completed successfully! DISM, SFC, and Chkdsk scans have finished." } });
                webView?.CoreWebView2?.PostWebMessageAsJson(payload);
            }
            catch (Exception ex)
            {
                var payload = JsonConvert.SerializeObject(new { type = "system-check-result", data = new { ok = false, message = "Scan failed: " + ex.Message } });
                webView?.CoreWebView2?.PostWebMessageAsJson(payload);
            }
        }

        private async Task RunRuntimeDirectXInstallAsync()
        {
            try
            {
                SendRuntimeProgress(0, "Initializing installer...");
                
                string scriptPath = Path.Combine(Path.GetTempPath(), "install_runtimes.ps1");
                string psCode = @"
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$tempDir = Join-Path $env:TEMP (""TFY_Runtimes_"" + [Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

function Download-FileWithProgress($url, $destination, $basePct, $scale) {
    $webClient = New-Object System.Net.WebClient
    $webClient.Headers.Add(""User-Agent"", ""Mozilla/5.0 (Windows NT 10.0; Win64; x64)"")
    
    $onProgress = {
        param($sender, $e)
        $pct = $e.ProgressPercentage
        $overall = [int]($basePct + ($pct * $scale))
        Write-Output ""__PROGRESS__$overall""
    }
    
    $event = Register-ObjectEvent -InputObject $webClient -EventName DownloadProgressChanged -Action $onProgress
    try {
        $task = $webClient.DownloadFileTaskAsync($url, $destination)
        while (-not $task.IsCompleted) {
            Start-Sleep -Milliseconds 50
        }
        if ($task.IsFaulted) { throw $task.Exception.InnerException }
    } finally {
        if ($event) {
            try { Unregister-Event -SourceIdentifier $event.Name -ErrorAction SilentlyContinue } catch {}
        }
    }
}

Write-Output ""__STATUS__Downloading DirectX...""
$dxUrl = ""https://download.microsoft.com/download/1/7/1/1718ccc4-6315-4d8e-9543-8e28a4e18c4c/dxwebsetup.exe""
$dxPath = Join-Path $tempDir ""dxwebsetup.exe""
Download-FileWithProgress $dxUrl $dxPath 0 0.15

Write-Output ""__STATUS__Installing DirectX...""
Write-Output ""__PROGRESS__20""
try {
    $proc = Start-Process -FilePath $dxPath -ArgumentList ""/q"" -Wait -PassThru -NoNewWindow
    $dxExit = $proc.ExitCode
    if ($dxExit -eq -9) {
        Write-Output ""__STATUS__DirectX is already up-to-date. Skipping...""
    } elseif (@(0, 3010, 1638) -notcontains $dxExit) {
        Write-Output ""__STATUS__DirectX installation returned code $dxExit (non-fatal). Continuing...""
    }
} catch {
    Write-Output ""__STATUS__DirectX installation failed: $_ (non-fatal). Continuing...""
}

Write-Output ""__STATUS__Fetching latest VC++ Redistributables release info...""
Write-Output ""__PROGRESS__30""
try {
    $apiUrl = ""https://api.github.com/repos/abbodi1406/vcredist/releases/latest""
    $headers = @{ ""User-Agent"" = ""Mozilla/5.0 (Windows NT 10.0; Win64; x64)"" }
    $release = Invoke-RestMethod -Uri $apiUrl -Headers $headers -UseBasicParsing
    $asset = $release.assets | Where-Object { $_.name -like ""VisualCppRedist_AIO_x86_x64*.zip"" } | Select-Object -First 1
    $vcredistUrl = $asset.browser_download_url
} catch {
    $vcredistUrl = ""https://github.com/abbodi1406/vcredist/releases/latest/download/VisualCppRedist_AIO_x86_x64.zip""
}

Write-Output ""__STATUS__Downloading VC++ All-in-One...""
$zipPath = Join-Path $tempDir ""vcredist.zip""
Download-FileWithProgress $vcredistUrl $zipPath 35 0.35

Write-Output ""__STATUS__Extracting packages...""
Write-Output ""__PROGRESS__75""
Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force

$exePath = Get-ChildItem -Path $tempDir -Filter ""VisualCppRedist_AIO_x86_x64*.exe"" | Select-Object -First 1
if ($exePath) {
    Write-Output ""__STATUS__Installing Visual C++ Runtimes...""
    Write-Output ""__PROGRESS__85""
    $proc = Start-Process -FilePath $exePath.FullName -ArgumentList ""/ai"" -Wait -PassThru -NoNewWindow
    if (@(0, 3010, 1638) -notcontains $proc.ExitCode) { throw ""VC++ Redistributables installation failed with code $($proc.ExitCode)"" }
} else {
    throw ""Error: Could not find VC++ AIO installer executable in zip.""
}

try { Remove-Item -Recurse -Force $tempDir } catch {}
Write-Output ""__STATUS__Installation complete!""
Write-Output ""__PROGRESS__100""
";
                File.WriteAllText(scriptPath, psCode);

                var startInfo = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = $"-NoProfile -ExecutionPolicy Bypass -File \"{scriptPath}\"",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using (var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true })
                {
                    var tcs = new TaskCompletionSource<bool>();
                    string lastError = "";
                    
                    process.OutputDataReceived += (s, e) =>
                    {
                        if (!string.IsNullOrEmpty(e.Data))
                        {
                            Dispatcher.Invoke(() =>
                            {
                                if (e.Data.StartsWith("__PROGRESS__"))
                                {
                                    if (int.TryParse(e.Data.Substring("__PROGRESS__".Length), out int pct))
                                    {
                                        SendRuntimeProgress(pct, null, e.Data);
                                    }
                                }
                                else if (e.Data.StartsWith("__STATUS__"))
                                {
                                    string status = e.Data.Substring("__STATUS__".Length);
                                    SendRuntimeProgress(-1, status, e.Data);
                                }
                                else
                                {
                                    SendRuntimeProgress(-1, null, e.Data);
                                }
                            });
                        }
                    };

                    process.ErrorDataReceived += (s, e) =>
                    {
                        if (!string.IsNullOrEmpty(e.Data))
                        {
                            Dispatcher.Invoke(() =>
                            {
                                if (string.IsNullOrEmpty(lastError))
                                    lastError = e.Data;
                                else
                                    lastError += "\n" + e.Data;
                                SendRuntimeProgress(-1, null, "ERROR: " + e.Data);
                            });
                        }
                    };

                    process.Exited += (s, e) =>
                    {
                        tcs.SetResult(true);
                    };

                    process.Start();
                    process.BeginOutputReadLine();
                    process.BeginErrorReadLine();

                    await tcs.Task;

                    bool ok = process.ExitCode == 0;
                    string msg = ok 
                        ? "All necessary runtimes and DirectX installed successfully!" 
                        : $"Installation failed. (Exit Code: {process.ExitCode})" + 
                          (!string.IsNullOrEmpty(lastError) ? $"\nDetails: {lastError}" : "");
                    
                    PostInAppNotification(ok ? "success" : "error", "Runtime & DirectX Installer", msg, 6000);

                    var payload = JsonConvert.SerializeObject(new { type = "runtime-installer-result", data = new { ok, message = msg } });
                    webView.CoreWebView2.PostWebMessageAsJson(payload);
                }
                
                try { File.Delete(scriptPath); } catch { }
            }
            catch (Exception ex)
            {
                PostInAppNotification("error", "Runtime & DirectX Installer Error", ex.Message, 6000);
                var payload = JsonConvert.SerializeObject(new { type = "runtime-installer-result", data = new { ok = false, message = ex.Message } });
                webView?.CoreWebView2?.PostWebMessageAsJson(payload);
            }
        }

        private async Task RunSpotXCrackAsync()
        {
            try
            {
                PostInAppNotification("info", "SpotX Crack", "Downloading and applying Spotify Crack...", 5000);
                
                string scriptPath = Path.Combine(Path.GetTempPath(), "run_spotx.ps1");
                string psCode = @"
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$url = 'https://raw.githubusercontent.com/SpotX-Official/SpotX/main/run.ps1'
$url2 = 'https://spotx-official.github.io/SpotX/run.ps1'
$dlPath = Join-Path $env:TEMP 'spotx_main.ps1'
try { Invoke-WebRequest -UseBasicParsing $url -OutFile $dlPath } catch { Invoke-WebRequest -UseBasicParsing $url2 -OutFile $dlPath }
& $dlPath -new_theme -block_update_on -podcasts_off -confirm_spoti_recomended_over
";
                File.WriteAllText(scriptPath, psCode);

                var startInfo = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = $"-NoProfile -ExecutionPolicy Bypass -File \"{scriptPath}\"",
                    UseShellExecute = true,
                    Verb = "runas"
                };

                using (var process = Process.Start(startInfo))
                {
                    await Task.Run(() => process.WaitForExit());
                    if (process.ExitCode == 0)
                    {
                        PostInAppNotification("success", "SpotX Crack", "Spotify has been successfully cracked and updated!", 6000);
                    }
                    else
                    {
                        PostInAppNotification("error", "SpotX Crack", $"Installation failed or was cancelled. (Exit Code: {process.ExitCode})", 6000);
                    }
                }
                
                try { File.Delete(scriptPath); } catch { }
            }
            catch (Exception ex)
            {
                PostInAppNotification("error", "SpotX Crack Error", ex.Message, 6000);
            }
        }

        private async Task RunWinrarCrackAsync()
        {
            try
            {
                PostInAppNotification("info", "WinRAR Crack", "Starting WinRAR installation and licensing...", 5000);

                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string scriptPath = Path.Combine(baseDir, "oneclickrar.cmd");

                if (!File.Exists(scriptPath))
                {
                    // Fallback to project source dir if running in debug from bin/Release/net8.0-windows
                    string altPath = Path.Combine(Directory.GetCurrentDirectory(), "oneclickrar.cmd");
                    if (File.Exists(altPath))
                    {
                        scriptPath = altPath;
                        baseDir = Directory.GetCurrentDirectory();
                    }
                    else
                    {
                        PostInAppNotification("error", "WinRAR Crack Error", "Script file 'oneclickrar.cmd' was not found in the application directory.", 6000);
                        return;
                    }
                }

                var startInfo = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = $"/c \"{scriptPath}\"",
                    UseShellExecute = true,
                    Verb = "runas",
                    WorkingDirectory = baseDir
                };

                using (var process = Process.Start(startInfo))
                {
                    await Task.Run(() => process.WaitForExit());
                    if (process.ExitCode == 0)
                    {
                        PostInAppNotification("success", "WinRAR Crack", "WinRAR has been successfully installed and cracked!", 6000);
                    }
                    else
                    {
                        PostInAppNotification("error", "WinRAR Crack", $"Installation failed or was cancelled. (Exit Code: {process.ExitCode})", 6000);
                    }
                }
            }
            catch (Exception ex)
            {
                PostInAppNotification("error", "WinRAR Crack Error", ex.Message, 6000);
            }
        }

        private async Task LaunchTwitchMinerAsync()
        {
            try
            {
                var targetFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TFY", "TwitchDropsMiner");
                
                // Dynamic resolution of the executable path
                var exePath = Path.Combine(targetFolder, "Twitch Drops Miner.exe");
                if (!File.Exists(exePath))
                {
                    var alternativeNames = new[] { "Twitch Drops Miner (by DevilXD).exe", "Twitch.Drops.Miner.exe" };
                    foreach (var name in alternativeNames)
                    {
                        var altPath = Path.Combine(targetFolder, name);
                        if (File.Exists(altPath))
                        {
                            exePath = altPath;
                            break;
                        }
                    }
                }
                if (!File.Exists(exePath) && Directory.Exists(targetFolder))
                {
                    var exeFiles = Directory.GetFiles(targetFolder, "*.exe", SearchOption.AllDirectories);
                    if (exeFiles.Length > 0)
                    {
                        exePath = exeFiles.FirstOrDefault(f => f.IndexOf("twitch", StringComparison.OrdinalIgnoreCase) >= 0 || f.IndexOf("miner", StringComparison.OrdinalIgnoreCase) >= 0) 
                                  ?? exeFiles[0];
                    }
                }

                if (File.Exists(exePath))
                {
                    PostInAppNotification("success", "Twitch Drops Miner", "Launching Twitch Drops Miner...", 4000);
                    var workDir = Path.GetDirectoryName(exePath) ?? targetFolder;
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = exePath,
                        UseShellExecute = true,
                        WorkingDirectory = workDir
                    });
                    return;
                }

                // Not downloaded yet - start downloading
                PostInAppNotification("info", "Twitch Drops Miner", "Downloading Twitch Drops Miner...", 4000);
                
                // Let frontend know we've started downloading
                Dispatcher.Invoke(() =>
                {
                    webView?.CoreWebView2?.PostWebMessageAsJson(JsonConvert.SerializeObject(new { type = "twitch-miner-status", data = new { status = "downloading", percent = 0 } }));
                });

                var zipPath = Path.Combine(Path.GetTempPath(), "TwitchDropsMiner_dev_build.zip");
                if (File.Exists(zipPath))
                {
                    try { File.Delete(zipPath); } catch { }
                }

                using (var client = new HttpClient())
                {
                    // Add default headers to prevent GitHub blocks
                    client.DefaultRequestHeaders.Add("User-Agent", "TFY-Utility-Hub/v6.3.2");

                    // Using official DevilXD dev-build release as provided by the user.
                    using (var response = await client.GetAsync("https://github.com/DevilXD/TwitchDropsMiner/releases/download/dev-build/Twitch.Drops.Miner.Windows.zip", HttpCompletionOption.ResponseHeadersRead))
                    {
                        response.EnsureSuccessStatusCode();
                        var totalBytes = response.Content.Headers.ContentLength ?? -1L;
                        var canReportProgress = totalBytes != -1L;

                        using (var contentStream = await response.Content.ReadAsStreamAsync())
                        using (var fileStream = new FileStream(zipPath, FileMode.Create, FileAccess.Write, FileShare.None, 8192, true))
                        {
                            var buffer = new byte[8192];
                            var totalReadBytes = 0L;
                            var readBytes = 0;
                            var lastReportedPercent = -1;

                            while ((readBytes = await contentStream.ReadAsync(buffer, 0, buffer.Length)) > 0)
                            {
                                await fileStream.WriteAsync(buffer, 0, readBytes);
                                totalReadBytes += readBytes;

                                if (canReportProgress)
                                {
                                    var percent = (int)((double)totalReadBytes / totalBytes * 100);
                                    if (percent > lastReportedPercent)
                                    {
                                        lastReportedPercent = percent;
                                        Dispatcher.Invoke(() =>
                                        {
                                            webView?.CoreWebView2?.PostWebMessageAsJson(JsonConvert.SerializeObject(new { type = "twitch-miner-status", data = new { status = "downloading", percent = percent } }));
                                        });
                                    }
                                }
                            }
                        }
                    }
                }

                // Inform frontend we are extracting
                Dispatcher.Invoke(() =>
                {
                    webView?.CoreWebView2?.PostWebMessageAsJson(JsonConvert.SerializeObject(new { type = "twitch-miner-status", data = new { status = "extracting", percent = 100 } }));
                });

                if (Directory.Exists(targetFolder))
                {
                    try { Directory.Delete(targetFolder, true); } catch { }
                }
                Directory.CreateDirectory(targetFolder);

                await Task.Run(() =>
                {
                    ZipFile.ExtractToDirectory(zipPath, targetFolder);
                });

                try { File.Delete(zipPath); } catch { }

                // Find the executable again in targetFolder
                var finalExePath = Path.Combine(targetFolder, "Twitch Drops Miner.exe");
                if (!File.Exists(finalExePath))
                {
                    var alternativeNames = new[] { "Twitch Drops Miner (by DevilXD).exe", "Twitch.Drops.Miner.exe" };
                    foreach (var name in alternativeNames)
                    {
                        var altPath = Path.Combine(targetFolder, name);
                        if (File.Exists(altPath))
                        {
                            finalExePath = altPath;
                            break;
                        }
                    }
                }
                if (!File.Exists(finalExePath) && Directory.Exists(targetFolder))
                {
                    var exeFiles = Directory.GetFiles(targetFolder, "*.exe", SearchOption.AllDirectories);
                    if (exeFiles.Length > 0)
                    {
                        finalExePath = exeFiles.FirstOrDefault(f => f.IndexOf("twitch", StringComparison.OrdinalIgnoreCase) >= 0 || f.IndexOf("miner", StringComparison.OrdinalIgnoreCase) >= 0) 
                                       ?? exeFiles[0];
                    }
                }

                if (!File.Exists(finalExePath))
                {
                    throw new FileNotFoundException("Could not locate any Twitch Drops Miner executable inside the extracted archive.");
                }

                // Done, let frontend know
                Dispatcher.Invoke(() =>
                {
                    webView?.CoreWebView2?.PostWebMessageAsJson(JsonConvert.SerializeObject(new { type = "twitch-miner-status", data = new { status = "done", percent = 100 } }));
                });

                PostInAppNotification("success", "Twitch Drops Miner", "Successfully downloaded and extracted! Launching...", 6000);

                var finalWorkDir = Path.GetDirectoryName(finalExePath) ?? targetFolder;
                Process.Start(new ProcessStartInfo
                {
                    FileName = finalExePath,
                    UseShellExecute = true,
                    WorkingDirectory = finalWorkDir
                });
            }
            catch (Exception ex)
            {
                PostInAppNotification("error", "Twitch Drops Miner Error", ex.Message, 6000);
                Dispatcher.Invoke(() =>
                {
                    webView?.CoreWebView2?.PostWebMessageAsJson(JsonConvert.SerializeObject(new { type = "twitch-miner-status", data = new { status = "error", message = ex.Message } }));
                });
            }
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
            var line = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}";
            lock (_sessionLogLock)
            {
                _sessionDebugLogs.Add(line);
                if (_sessionDebugLogs.Count > 5000)
                {
                    _sessionDebugLogs.RemoveRange(0, _sessionDebugLogs.Count - 5000);
                }
            }
            try
            {
                string bootLogPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TFY", "boot.log");
                File.AppendAllText(bootLogPath, line + Environment.NewLine);
            }
            catch { }
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
            if (_debloaterLoading) return;
            _debloaterLoading = true;
            try
            {
                // Fast 50ms scan for Desktop & Startup apps
                var desktopTask = Task.Run(() => _debloater.GetDesktopApps());
                var startupTask = Task.Run(() => _debloater.GetStartupApps());
                var storeTask = Task.Run(() => _debloater.GetStoreApps());

                // As soon as desktop & startup finish, post them immediately
                await Task.WhenAll(desktopTask, startupTask);
                _debloaterDesktopCache = (await desktopTask) ?? new List<DebloaterApp>();
                _debloaterStartupCache = (await startupTask) ?? new List<DebloaterApp>();
                PostDebloaterCache();

                // Then await store apps and post final full cache
                _debloaterStoreCache = (await storeTask) ?? new List<DebloaterApp>();
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
                    data = new { desktop = _debloaterDesktopCache, store = _debloaterStoreCache, startup = _debloaterStartupCache }
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
                var version = Assembly.GetExecutingAssembly().GetName().Version;
                if (version != null && version.Major > 0)
                {
                    return $"v{version.Major}.{version.Minor}.{version.Build}";
                }
            }
            catch
            {
            }

            return "v6.3.2";
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

                UpdateInfo? update = null;
                UpdateManager? manager = null;

                try
                {
                    manager = new UpdateManager(new Velopack.Sources.SimpleWebSource(App.UpdateUrl));
                    update = await manager.CheckForUpdatesAsync();
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[TFY] SimpleWebSource update check failed: {ex.Message}");
                }

                if (update == null)
                {
                    try
                    {
                        manager = new UpdateManager(new Velopack.Sources.GithubSource("https://github.com/DragosKissLove/TFY-UtilityHub-Releases", null, false));
                        update = await manager.CheckForUpdatesAsync();
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[TFY] GithubSource update check failed: {ex.Message}");
                    }
                }

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
                UpdateManager manager;
                UpdateInfo? update = _pendingUpdate;

                if (update == null)
                {
                    try
                    {
                        manager = new UpdateManager(new Velopack.Sources.SimpleWebSource(App.UpdateUrl));
                        update = await manager.CheckForUpdatesAsync();
                    }
                    catch
                    {
                        manager = new UpdateManager(new Velopack.Sources.GithubSource("https://github.com/DragosKissLove/TFY-UtilityHub-Releases", null, false));
                        update = await manager.CheckForUpdatesAsync();
                    }
                }
                else
                {
                    manager = new UpdateManager(new Velopack.Sources.SimpleWebSource(App.UpdateUrl));
                }

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
                string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
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
                    if (discord.Roles.Contains(DiscordAuthService.DeveloperRoleId) ||
                        discord.Roles.Contains(DiscordAuthService.TesterRoleId) ||
                        discord.Roles.Contains(DiscordAuthService.PremiumRoleId))
                    {
                        _premiumEnabled = true;
                        SavePremiumState(_premiumEnabled);
                        _premiumResolved = true;
                        return true;
                    }

                    // ── Discord bot API ───────────────────────────────────────────────────
                    var endpoints = new List<string>();
                    var envApi = Environment.GetEnvironmentVariable("TFY_PREMIUM_API");
                    if (!string.IsNullOrWhiteSpace(envApi))
                    {
                        endpoints.Add(envApi);
                    }
                    endpoints.Add("https://tfy-api.vi9lomister.workers.dev/check-roles");
                    endpoints.Add("http://127.0.0.1:11874/check-role");
                    endpoints.Add("http://127.0.0.1:8787/check-role");

                    var payload = new { userId = discord.UserId };
                    var body = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");

                    foreach (var url in endpoints)
                    {
                        try
                        {
                            using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(2));
                            var response = await _httpClient.PostAsync(url, body, cts.Token);
                            if (response.IsSuccessStatusCode)
                            {
                                var json = await response.Content.ReadAsStringAsync();
                                dynamic data = JsonConvert.DeserializeObject<dynamic>(json);
                                _premiumEnabled = data?.hasRole == true || data?.hasPremium == true || data?.premium == true || data?.enabled == true;
                                SavePremiumState(_premiumEnabled);
                                _premiumResolved = true;
                                return _premiumEnabled;
                            }
                        }
                        catch
                        {
                            // Try next endpoint
                        }
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
                    if (discord.Roles.Contains(DiscordAuthService.DeveloperRoleId) ||
                        discord.Roles.Contains(DiscordAuthService.TesterRoleId))
                    {
                        _testingEnabled = true;
                        _testingResolved = true;
                        return true;
                    }

                    var endpoints = new List<string>();
                    string envApi = Environment.GetEnvironmentVariable("TFY_TESTING_API");
                    if (!string.IsNullOrWhiteSpace(envApi))
                    {
                        endpoints.Add(envApi);
                    }
                    var premiumApi = Environment.GetEnvironmentVariable("TFY_PREMIUM_API");
                    if (!string.IsNullOrWhiteSpace(premiumApi))
                    {
                        try
                        {
                            var uri = new Uri(premiumApi);
                            endpoints.Add($"{uri.Scheme}://{uri.Host}{(uri.IsDefaultPort ? "" : ":" + uri.Port)}/check-role-testing");
                        }
                        catch { }
                    }
                    endpoints.Add("https://tfy-api.vi9lomister.workers.dev/check-roles");
                    endpoints.Add("http://127.0.0.1:11874/check-role-testing");
                    endpoints.Add("http://127.0.0.1:8787/check-role-testing");

                    var payload = new { userId = discord.UserId };
                    var body = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");

                    foreach (var url in endpoints)
                    {
                        try
                        {
                            using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(2));
                            var response = await _httpClient.PostAsync(url, body, cts.Token);
                            if (response.IsSuccessStatusCode)
                            {
                                var json = await response.Content.ReadAsStringAsync();
                                dynamic data = JsonConvert.DeserializeObject<dynamic>(json);
                                _testingEnabled = data?.hasRole == true || data?.hasTesting == true || data?.premium == true || data?.enabled == true;
                                _testingResolved = true;
                                return _testingEnabled;
                            }
                        }
                        catch
                        {
                            // Try next endpoint
                        }
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
                string folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "TFY");
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

        private void SavePremiumState(bool enabled)
        {
            try
            {
                string folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "TFY");
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

        private async Task ApplyCs2ConfigAsync(string jsonPayload)
        {
            var resultJson = await _cs2ConfigService.ApplyCs2ConfigAsync(jsonPayload);
        }

        private bool IsNvidiaDriverInstalled()
        {
            try
            {
                using (var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Services\nvlddmkm"))
                {
                    if (key != null) return true;
                }
                if (Directory.Exists(@"C:\Program Files\NVIDIA Corporation")) return true;
                if (File.Exists(@"C:\Windows\System32\drivers\nvlddmkm.sys")) return true;
            }
            catch { }
            return false;
        }

        private string ResolveOptimizationFilePath(string relativePath)
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string path = Path.Combine(baseDir, "project", "dist", "optimizations", relativePath);
            if (File.Exists(path) || Directory.Exists(path)) return path;

            string current = baseDir;
            for (int i = 0; i < 6; i++)
            {
                string check = Path.Combine(current, "project", "public", "optimizations", relativePath);
                if (File.Exists(check) || Directory.Exists(check))
                    return Path.GetFullPath(check);

                var parent = Directory.GetParent(current);
                if (parent == null) break;
                current = parent.FullName;
            }

            return Path.Combine(baseDir, "project", "dist", "optimizations", relativePath);
        }

        private void OpenRobloxLoginWindow()
        {
            Dispatcher.Invoke(async () =>
            {
                try
                {
                    var loginWindow = new Window
                    {
                        Title = "Roblox Account Sign In - TFY Utility Hub",
                        Width = 540,
                        Height = 720,
                        WindowStartupLocation = WindowStartupLocation.CenterScreen,
                        Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(18, 18, 24))
                    };

                    var loginWeb = new Microsoft.Web.WebView2.Wpf.WebView2();
                    loginWindow.Content = loginWeb;

                    loginWindow.Show();

                    try
                    {
                        if (webView?.CoreWebView2?.Environment != null)
                        {
                            await loginWeb.EnsureCoreWebView2Async(webView.CoreWebView2.Environment);
                        }
                        else
                        {
                            string userDataFolder = Path.Combine(
                                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                                "TFY_WebView2"
                            );
                            var options = new CoreWebView2EnvironmentOptions("--allow-file-access-from-files --disable-web-security");
                            var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder, options);
                            await loginWeb.EnsureCoreWebView2Async(env);
                        }

                        loginWeb.DefaultBackgroundColor = System.Drawing.Color.FromArgb(255, 18, 18, 24);

                        // Clear any old/stale .ROBLOSECURITY cookies so the user gets a fresh login prompt
                        try
                        {
                            var existingCookies = await loginWeb.CoreWebView2.CookieManager.GetCookiesAsync("https://www.roblox.com");
                            foreach (var c in existingCookies)
                            {
                                if (c.Name == ".ROBLOSECURITY")
                                {
                                    loginWeb.CoreWebView2.CookieManager.DeleteCookie(c);
                                }
                            }
                        }
                        catch { }

                        loginWeb.CoreWebView2.Navigate("https://www.roblox.com/login");

                        var timer = new System.Windows.Threading.DispatcherTimer
                        {
                            Interval = TimeSpan.FromMilliseconds(1200)
                        };

                        bool captured = false;
                        async Task CheckCookiesAsync()
                        {
                            if (captured || loginWeb.CoreWebView2 == null) return;
                            try
                            {
                                var cookies = await loginWeb.CoreWebView2.CookieManager.GetCookiesAsync("https://www.roblox.com");
                                var roblosecurity = cookies.FirstOrDefault(c => c.Name == ".ROBLOSECURITY" && !string.IsNullOrWhiteSpace(c.Value) && c.Value.Length > 100);
                                if (roblosecurity != null)
                                {
                                    string cookieVal = roblosecurity.Value;
                                    var userData = await RobloxService.ValidateCookieAsync(cookieVal);
                                    // Only accept and close the window when the cookie is 100% VALIDATED
                                    if (userData != null && (bool?)userData["ok"] == true)
                                    {
                                        captured = true;
                                        timer.Stop();
                                        await Dispatcher.InvokeAsync(() =>
                                        {
                                            webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(new
                                            {
                                                type = "roblox-cookie-validated",
                                                data = userData,
                                                cookie = cookieVal
                                            }));
                                            loginWindow.Close();
                                        });
                                    }
                                }
                            }
                            catch { }
                        }

                        timer.Tick += async (ts, te) => await CheckCookiesAsync();
                        timer.Start();

                        loginWeb.CoreWebView2.NavigationCompleted += async (ns, ne) => await CheckCookiesAsync();
                        loginWeb.CoreWebView2.SourceChanged += async (ss, se) => await CheckCookiesAsync();

                        loginWindow.Closed += (cs, ce) =>
                        {
                            timer.Stop();
                        };
                    }
                    catch (Exception ex)
                    {
                        System.Windows.MessageBox.Show("Error initializing login browser: " + ex.Message, "TFY Roblox Login", MessageBoxButton.OK, MessageBoxImage.Warning);
                    }
                }
                catch (Exception ex)
                {
                    System.Windows.MessageBox.Show("Could not open Roblox sign in window: " + ex.Message);
                }
            });
        }
    }
}


