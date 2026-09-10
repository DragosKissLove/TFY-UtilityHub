using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net.Http;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using Microsoft.Win32;
using Newtonsoft.Json;
using Microsoft.Web.WebView2.Core;

namespace TFY.Installer
{
    public partial class MainWindow : Window
    {
        private string _tempUiFolder;
        private bool _isInstalling = false;
        private string _logFile;

        public MainWindow()
        {
            InitializeComponent();
            
            _logFile = Path.Combine(Path.GetTempPath(), "TFY_Installer_debug.log");
            Log("=== TFY Installer started ===");
            
            string[] args = Environment.GetCommandLineArgs();
            Log($"Args: {string.Join(" ", args)}");
            if (args.Contains("/uninstall") || args.Contains("-uninstall"))
            {
                RunSilentUninstall();
                Application.Current.Shutdown();
                return;
            }

            Loaded += MainWindow_Loaded;
            Closed += MainWindow_Closed;

            // Force window to display instantly on startup
            this.Show();
        }

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool ReleaseCapture();

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern IntPtr SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);

        [System.Runtime.InteropServices.DllImport("gdi32.dll")]
        public static extern IntPtr CreateRoundRectRgn(int x1, int y1, int x2, int y2, int cx, int cy);

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern int SetWindowRgn(IntPtr hWnd, IntPtr hRgn, bool bRedraw);

        [System.Runtime.InteropServices.DllImport("dwmapi.dll")]
        public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

        protected override void OnSourceInitialized(EventArgs e)
        {
            base.OnSourceInitialized(e);
            try
            {
                IntPtr handle = new System.Windows.Interop.WindowInteropHelper(this).Handle;
                
                // Windows 11 DWM rounded corners (DWMWA_WINDOW_CORNER_PREFERENCE = 33, DWMWCP_ROUND = 2)
                int cornerPreference = 2;
                DwmSetWindowAttribute(handle, 33, ref cornerPreference, sizeof(int));

                // Win32 Region clipping: physically rounds window and all child HWNDs (including WebView2)
                IntPtr rgn = CreateRoundRectRgn(0, 0, (int)this.Width + 1, (int)this.Height + 1, 32, 32);
                SetWindowRgn(handle, rgn, true);
            }
            catch { }
        }

        private const int WM_NCLBUTTONDOWN = 0xA1;
        private const int HT_CAPTION = 0x2;

        private void Log(string message)
        {
            try { File.AppendAllText(_logFile, $"[{DateTime.Now:HH:mm:ss.fff}] {message}\n"); } catch { }
        }

        private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            try
            {
                Log("Window loaded, starting initialization...");
                string exePath = Environment.ProcessPath;
                string buildKey = "dev";
                try
                {
                    if (!string.IsNullOrEmpty(exePath) && File.Exists(exePath))
                        buildKey = File.GetLastWriteTimeUtc(exePath).ToString("yyyyMMddHHmmss");
                }
                catch { }

                _tempUiFolder = Path.Combine(Path.GetTempPath(), $"TFY_Installer_UI_v629_{buildKey}");
                if (!Directory.Exists(_tempUiFolder))
                {
                    Directory.CreateDirectory(_tempUiFolder);
                    Log("Extracting UI resources...");
                    ExtractUiFromResources(_tempUiFolder);
                    Log("UI resources extracted successfully");
                }
                else
                {
                    Log("UI resources already cached, skipping extraction.");
                }

                Log("Initializing WebView2...");
                string userDataFolder = Path.Combine(Path.GetTempPath(), "TFY_Installer_WV2_Cache");
                Directory.CreateDirectory(userDataFolder);
                var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
                Log("WebView2 environment created");
                
                await webView.EnsureCoreWebView2Async(env);
                webView.DefaultBackgroundColor = System.Drawing.Color.Transparent;
                Log("WebView2 core initialized");

                var settings = webView.CoreWebView2.Settings;
                settings.AreDevToolsEnabled = false;
                settings.AreDefaultContextMenusEnabled = false;
                settings.IsStatusBarEnabled = false;
                settings.IsZoomControlEnabled = false;

                webView.CoreWebView2.SetVirtualHostNameToFolderMapping("tfy.app", _tempUiFolder, CoreWebView2HostResourceAccessKind.Allow);
                Log("Virtual host mapping set");

                webView.CoreWebView2.WebMessageReceived += WebView_WebMessageReceived;

                // Inject JS error capture after navigation
                webView.CoreWebView2.NavigationCompleted += async (s, args) =>
                {
                    Log($"Navigation completed: IsSuccess={args.IsSuccess}, Status={args.WebErrorStatus}");
                    
                    // WebView2 navigation is completed, page is ready to render

                    if (!args.IsSuccess) { Log($"Navigation FAILED: {args.WebErrorStatus}"); return; }
                    
                    // Inject error catcher
                    try
                    {
                        await webView.CoreWebView2.ExecuteScriptAsync(@"
                            window.onerror = function(msg, url, line, col, err) {
                                window.chrome.webview.postMessage(JSON.stringify({type:'js-error', data: msg + ' at ' + url + ':' + line}));
                            };
                            window.addEventListener('unhandledrejection', function(e) {
                                window.chrome.webview.postMessage(JSON.stringify({type:'js-error', data: 'Unhandled rejection: ' + e.reason}));
                            });
                            var _origErr = console.error;
                            console.error = function() {
                                var args = Array.from(arguments).map(function(a){return String(a)}).join(' ');
                                window.chrome.webview.postMessage(JSON.stringify({type:'js-error', data: args}));
                                _origErr.apply(console, arguments);
                            };
                            window.chrome.webview.postMessage(JSON.stringify({type:'js-error', data: 'Error catcher injected OK. Root innerHTML length: ' + document.getElementById('root').innerHTML.length}));
                        ");
                    }
                    catch (Exception ex) { Log($"Script injection error: {ex.Message}"); }
                };
                webView.CoreWebView2.WebResourceResponseReceived += (s, args) =>
                {
                    int status = args.Response.StatusCode;
                    if (status >= 400)
                        Log($"Resource FAILED [{status}]: {args.Request.Uri}");
                };

                // Log temp folder contents for debugging
                try
                {
                    var files = System.IO.Directory.GetFiles(_tempUiFolder, "*", SearchOption.AllDirectories);
                    Log($"Temp folder has {files.Length} files:");
                    foreach (var f in files.Take(20))
                        Log($"  {f.Replace(_tempUiFolder, ".")}");
                }
                catch { }

                webView.Visibility = Visibility.Visible;

                string navUrl = "http://tfy.app/installer.html";
                Log($"Navigating to: {navUrl}");
                webView.CoreWebView2.Navigate(navUrl);
                Log("Navigation started");
            }
            catch (Exception ex)
            {
                Log($"ERROR: {ex}");
                MessageBox.Show($"Failed to initialize installer UI:\n\n{ex.Message}\n\nLog: {_logFile}", "TFY Setup Error", MessageBoxButton.OK, MessageBoxImage.Error);
                Application.Current.Shutdown();
            }
        }

        private void MainWindow_Closed(object sender, EventArgs e)
        {
            // Keep extracted files cached in temp directory for ultra-fast subsequent launches
        }

        private void ExtractUiFromResources(string targetPath)
        {
            var assembly = Assembly.GetExecutingAssembly();
            string resourceName = assembly.GetManifestResourceNames().FirstOrDefault(r => r.EndsWith("dist.zip"));
            if (string.IsNullOrEmpty(resourceName))
                throw new Exception("Embedded UI resource 'dist.zip' not found.");

            using (var stream = assembly.GetManifestResourceStream(resourceName))
            using (var archive = new ZipArchive(stream))
            {
                archive.ExtractToDirectory(targetPath, true);
            }
        }

        private void SendToWeb(object obj)
        {
            Dispatcher.Invoke(() =>
            {
                try
                {
                    string json = JsonConvert.SerializeObject(obj);
                    webView.CoreWebView2.PostWebMessageAsJson(json);
                }
                catch { }
            });
        }

        private async void WebView_WebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            string rawMsg = e.TryGetWebMessageAsString();
            if (string.IsNullOrEmpty(rawMsg)) return;

            try
            {
                dynamic msg = JsonConvert.DeserializeObject<dynamic>(rawMsg);
                string type = msg.type;
                Log($"IPC received: {type}");

                switch (type)
                {
                    case "js-error":
                        string errData = msg.data;
                        Log($"JS ERROR: {errData}");
                        break;

                    case "window-drag":
                        try
                        {
                            ReleaseCapture();
                            SendMessage(new System.Windows.Interop.WindowInteropHelper(this).Handle, WM_NCLBUTTONDOWN, HT_CAPTION, 0);
                        }
                        catch { }
                        break;

                    case "check-prereqs":
                        Log("Checking prerequisites...");
                        bool netOk = IsNet8Installed();
                        bool vcOk = IsVcRedistInstalled();
                        string oldPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TFY");
                        bool oldVersionDetected = Directory.Exists(oldPath) && File.Exists(Path.Combine(oldPath, "TFY.exe"));
                        Log($"Prerequisites: .NET8={netOk}, VC++={vcOk}, OldVersionDetected={oldVersionDetected}");
                        SendToWeb(new
                        {
                            type = "prereqs-status",
                            data = new
                            {
                                netInstalled = netOk,
                                netVersion = "8.0.x",
                                vcInstalled = vcOk,
                                oldVersionDetected = oldVersionDetected,
                                oldVersionPath = oldPath
                            }
                        });
                        break;

                    case "browse-folder":
                        using (var dialog = new System.Windows.Forms.FolderBrowserDialog())
                        {
                            dialog.Description = "Select target installation folder:";
                            dialog.SelectedPath = @"C:\Program Files\TFY";
                            if (dialog.ShowDialog() == System.Windows.Forms.DialogResult.OK)
                            {
                                SendToWeb(new { type = "folder-selected", data = new { path = dialog.SelectedPath } });
                            }
                        }
                        break;

                    case "start-install":
                        if (_isInstalling) return;
                        _isInstalling = true;
                        string path = msg.data.path;
                        bool createLink = msg.data.createShortcut == true;
                        bool installNet = msg.data.installNet == true;
                        bool installVc = msg.data.installVc == true;
                        bool cleanOldVersion = msg.data.cleanOldVersion == true;
                        bool overwriteConfirmed = msg.data.overwriteConfirmed == true;
                        Log($"Starting install to: {path}, cleanOld={cleanOldVersion}, overwriteConfirmed={overwriteConfirmed}");

                        // Prompt user if the target folder exists and is not empty, and overwrite is not confirmed yet
                        if (!overwriteConfirmed && Directory.Exists(path) && Directory.EnumerateFileSystemEntries(path).Any())
                        {
                            _isInstalling = false;
                            SendToWeb(new { type = "overwrite-warning", data = new { path = path } });
                            return;
                        }

                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                await PerformInstallationAsync(path, createLink, installNet, installVc, cleanOldVersion);
                                SendToWeb(new { type = "install-complete", data = new { ok = true } });
                            }
                            catch (Exception ex)
                            {
                                Log($"Install error: {ex}");
                                SendToWeb(new { type = "install-complete", data = new { ok = false, message = ex.Message } });
                            }
                            finally
                            {
                                _isInstalling = false;
                            }
                        });
                        break;

                    case "launch-app":
                        bool launch = msg.data?.launch == true;
                        if (launch)
                        {
                            string appPath = null;
                            try
                            {
                                using (var regKey = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\TFYUtilityHub"))
                                {
                                    if (regKey != null)
                                    {
                                        string installLoc = regKey.GetValue("InstallLocation") as string;
                                        if (!string.IsNullOrEmpty(installLoc))
                                            appPath = Path.Combine(installLoc, "TFY.exe");
                                    }
                                }
                            }
                            catch { }

                            if (string.IsNullOrEmpty(appPath) || !File.Exists(appPath))
                                appPath = Path.Combine(@"C:\Program Files\TFY", "TFY.exe");

                            if (File.Exists(appPath))
                            {
                                try
                                {
                                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                                    {
                                        FileName = appPath,
                                        UseShellExecute = true
                                    });
                                }
                                catch { }
                            }
                        }
                        break;

                    case "close-installer":
                        if (!_isInstalling) Close();
                        break;

                    case "minimize":
                        WindowState = WindowState.Minimized;
                        break;
                }
            }
            catch (Exception ex)
            {
                Log($"Message error: {ex.Message}");
            }
        }

        private bool IsNet8Installed()
        {
            string[] paths = new[]
            {
                @"SOFTWARE\dotnet\Setup\InstalledVersions\x64\sharedfx\Microsoft.WindowsDesktop.App",
                @"SOFTWARE\WOW6432Node\dotnet\Setup\InstalledVersions\x64\sharedfx\Microsoft.WindowsDesktop.App",
                @"SOFTWARE\dotnet\Setup\InstalledVersions\x86\sharedfx\Microsoft.WindowsDesktop.App",
                @"SOFTWARE\WOW6432Node\dotnet\Setup\InstalledVersions\x86\sharedfx\Microsoft.WindowsDesktop.App"
            };

            foreach (var path in paths)
            {
                try
                {
                    using (var key = Registry.LocalMachine.OpenSubKey(path))
                    {
                        if (key != null)
                        {
                            var valNames = key.GetValueNames();
                            if (valNames.Any(n => n.StartsWith("8.")))
                                return true;
                        }
                    }
                }
                catch { }
            }
            return false;
        }

        private bool IsVcRedistInstalled()
        {
            string[] paths = new[]
            {
                @"SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64",
                @"SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64",
                @"SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x86",
                @"SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x86"
            };

            foreach (var path in paths)
            {
                try
                {
                    using (var key = Registry.LocalMachine.OpenSubKey(path))
                    {
                        if (key != null)
                        {
                            if (Convert.ToInt32(key.GetValue("Installed") ?? 0) == 1)
                                return true;
                        }
                    }
                }
                catch { }
            }
            return false;
        }

        private async Task PerformInstallationAsync(string targetPath, bool createLink, bool installNet, bool installVc, bool cleanOldVersion)
        {
            // Reset progress to 0% and wait for slide transition to finish
            SendToWeb(new { type = "install-progress", data = new { percent = 0, status = "Initializing installation..." } });
            await Task.Delay(500);

            if (cleanOldVersion)
            {
                SendToWeb(new { type = "install-progress", data = new { percent = 0, status = "Cleaning up old installation folder..." } });
                try
                {
                    string oldPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TFY");
                    if (Directory.Exists(oldPath))
                    {
                        Directory.Delete(oldPath, true);
                        Log("Cleaned up old AppData/Local/TFY directory successfully.");
                    }
                }
                catch (Exception ex)
                {
                    Log($"Failed to clean up old AppData directory: {ex.Message}");
                }
                await Task.Delay(500);
            }

            int totalSteps = 4; // Create Dir, Extract, Exe Copy, Shortcuts/Registry
            if (installNet) totalSteps++;
            if (installVc) totalSteps++;

            int currentStep = 0;
            Action<string> reportProgress = (status) =>
            {
                currentStep++;
                int percent = (currentStep * 100) / totalSteps;
                if (percent > 95) percent = 95; // Leave 100% for the final completion message
                SendToWeb(new { type = "install-progress", data = new { percent = percent, status = status } });
            };

            if (installNet)
            {
                reportProgress("Downloading .NET 8 Runtime...");
                string netUrl = "https://aka.ms/dotnet/8.0/windowsdesktop-runtime-win-x64.exe";
                string netInstaller = Path.Combine(Path.GetTempPath(), "dotnet_installer.exe");
                await DownloadFileAsync(netUrl, netInstaller);

                reportProgress("Installing .NET 8 Runtime...");
                await RunInstallerSilentAsync(netInstaller, "/quiet /norestart");
            }

            if (installVc)
            {
                reportProgress("Downloading Visual C++ Redistributables...");
                string vcUrl = "https://aka.ms/vs/17/release/vc_redist.x64.exe";
                string vcInstaller = Path.Combine(Path.GetTempPath(), "vc_installer.exe");
                await DownloadFileAsync(vcUrl, vcInstaller);

                reportProgress("Installing Visual C++ Redistributables...");
                await RunInstallerSilentAsync(vcInstaller, "/quiet /norestart");
            }

            reportProgress("Creating destination directory...");
            Directory.CreateDirectory(targetPath);

            reportProgress("Extracting TFY files...");
            var assembly = Assembly.GetExecutingAssembly();
            string resourceName = assembly.GetManifestResourceNames().FirstOrDefault(r => r.EndsWith("publish.zip"));
            if (string.IsNullOrEmpty(resourceName))
                throw new Exception("Embedded application resource 'publish.zip' not found.");

            using (var stream = assembly.GetManifestResourceStream(resourceName))
            using (var archive = new ZipArchive(stream))
            {
                archive.ExtractToDirectory(targetPath, true);
            }

            reportProgress("Configuring uninstaller...");
            string currentExe = System.Diagnostics.Process.GetCurrentProcess().MainModule?.FileName;
            if (!string.IsNullOrEmpty(currentExe) && File.Exists(currentExe))
                File.Copy(currentExe, Path.Combine(targetPath, "Uninstall.exe"), true);

            reportProgress("Creating shortcuts and registry entries...");
            if (createLink)
            {
                string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string shortcutPath = Path.Combine(desktopPath, "TFY.lnk");
                string exePath = Path.Combine(targetPath, "TFY.exe");
                CreateShortcut(exePath, shortcutPath, exePath);
            }

            string startMenuPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonPrograms), "TFY");
            Directory.CreateDirectory(startMenuPath);
            string startShortcutPath = Path.Combine(startMenuPath, "TFY.lnk");
            string appExePath = Path.Combine(targetPath, "TFY.exe");
            CreateShortcut(appExePath, startShortcutPath, appExePath);

            RegisterUninstallInfo(targetPath, "6.3.2");
            
            SendToWeb(new { type = "install-progress", data = new { percent = 100, status = "Finished!" } });
        }

        private async Task DownloadFileAsync(string url, string destinationPath)
        {
            using (var client = new HttpClient())
            using (var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead))
            {
                response.EnsureSuccessStatusCode();
                using (var contentStream = await response.Content.ReadAsStreamAsync())
                using (var fileStream = new FileStream(destinationPath, FileMode.Create, FileAccess.Write, FileShare.None, 8192, true))
                {
                    await contentStream.CopyToAsync(fileStream);
                }
            }
        }

        private Task<int> RunInstallerSilentAsync(string fileName, string arguments)
        {
            var tcs = new TaskCompletionSource<int>();
            try
            {
                var process = new System.Diagnostics.Process
                {
                    StartInfo = new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = fileName,
                        Arguments = arguments,
                        UseShellExecute = true,
                        Verb = "runas"
                    },
                    EnableRaisingEvents = true
                };
                process.Exited += (sender, args) => { tcs.SetResult(process.ExitCode); process.Dispose(); };
                process.Start();
            }
            catch (Exception ex) { tcs.SetException(ex); }
            return tcs.Task;
        }

        private void CreateShortcut(string targetPath, string shortcutPath, string iconPath)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                dynamic shell = Activator.CreateInstance(shellType);
                dynamic shortcut = shell.CreateShortcut(shortcutPath);
                shortcut.TargetPath = targetPath;
                shortcut.WorkingDirectory = Path.GetDirectoryName(targetPath);
                shortcut.IconLocation = iconPath;
                shortcut.Save();
            }
            catch (Exception ex) { Log($"Shortcut error: {ex.Message}"); }
        }

        private void RegisterUninstallInfo(string installPath, string version)
        {
            try
            {
                string uninstallKey = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\TFYUtilityHub";
                using (var key = Registry.LocalMachine.CreateSubKey(uninstallKey))
                {
                    key.SetValue("DisplayName", "TFY");
                    key.SetValue("DisplayVersion", version);
                    key.SetValue("Publisher", "DragosKissLove");
                    key.SetValue("UninstallString", $"\"{Path.Combine(installPath, "Uninstall.exe")}\" /uninstall");
                    key.SetValue("DisplayIcon", Path.Combine(installPath, "TFY.exe"));
                    key.SetValue("InstallLocation", installPath);
                    key.SetValue("NoModify", 1);
                    key.SetValue("NoRepair", 1);
                }
            }
            catch (Exception ex) { Log($"Registry error: {ex.Message}"); }
        }

        private void RunSilentUninstall()
        {
            try
            {
                string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string desktopLnk = Path.Combine(desktopPath, "TFY.lnk");
                if (File.Exists(desktopLnk)) File.Delete(desktopLnk);

                string startMenuPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonPrograms), "TFY");
                if (Directory.Exists(startMenuPath)) Directory.Delete(startMenuPath, true);

                string uninstallKey = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\TFYUtilityHub";
                Registry.LocalMachine.DeleteSubKey(uninstallKey, false);

                string appDir = AppDomain.CurrentDomain.BaseDirectory;
                string tempCmd = Path.Combine(Path.GetTempPath(), "tfy_uninstall.bat");
                string cmdContent = $@"@echo off
timeout /t 2 /nobreak > nul
rmdir /s /q ""{appDir}""
del ""%~f0""
";
                File.WriteAllText(tempCmd, cmdContent);
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                {
                    FileName = tempCmd,
                    CreateNoWindow = true,
                    UseShellExecute = false
                });
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Uninstall failed: {ex.Message}", "TFY Uninstall", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}
