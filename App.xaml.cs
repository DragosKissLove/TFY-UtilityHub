using System;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using TFY.Services;
using Velopack;

namespace TFY
{
    public partial class App : Application
    {
        private static string SettingsPath =>
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TFY", "settings.json");

        internal static string UpdateUrl
        {
            get
            {
                try
                {
                    if (File.Exists(SettingsPath))
                    {
                        string json = File.ReadAllText(SettingsPath);
                        if (json.Contains("\"betaChannel\":true") || json.Contains("\"betaChannel\": true"))
                        {
                            return "https://tfy-project.web.app/Releases/beta/";
                        }
                    }
                }
                catch { }
                return "https://tfy-project.web.app/Releases/stable/";
            }
        }
        public HardwareMonitorService? HardwareMonitor { get; private set; }
        private static System.Threading.Mutex? _appMutex;
        private static string LogPath =>
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TFY", "boot.log");

        protected override void OnStartup(StartupEventArgs e)
        {
            try
            {
                WriteLog("OnStartup initiated. Args: " + string.Join(" ", e.Args));
                try
                {
                    VelopackApp.Build().Run();
                }
                catch (Exception ex)
                {
                    WriteLog("Velopack hook error: " + ex.Message);
                }

                // Single Instance Protection
                const string mutexName = "Global\\TFY_Utility_Hub_Single_Instance_Mutex";
                _appMutex = new System.Threading.Mutex(true, mutexName, out bool createdNew);
                if (!createdNew)
                {
                    WriteLog("Single instance mutex exists, exiting duplicate instance.");
                    _appMutex.Dispose();
                    _appMutex = null;
                    Application.Current.Shutdown();
                    return;
                }

                SetupCrashLogging();
                WriteLog("App starting");
                try
                {
                    HardwareMonitor = new HardwareMonitorService();
                }
                catch (Exception ex)
                {
                    WriteLog("Hardware monitor init failed: " + ex);
                    HardwareMonitor = null;
                }
                TryUpdateInBackground();
                base.OnStartup(e);
            }
            catch (Exception fatalEx)
            {
                WriteLog("FATAL OnStartup EXCEPTION: " + fatalEx);
                MessageBox.Show("Fatal Startup Error: " + fatalEx.ToString(), "TFY Startup Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }



        protected override void OnExit(ExitEventArgs e)
        {
            HardwareMonitor?.Stop();
            base.OnExit(e);
        }

        private void SetupCrashLogging()
        {
            Directory.CreateDirectory(Path.GetDirectoryName(LogPath)!);

            AppDomain.CurrentDomain.UnhandledException += (_, args) =>
            {
                WriteLog("UnhandledException: " + args.ExceptionObject);
            };

            DispatcherUnhandledException += (_, args) =>
            {
                WriteLog("DispatcherUnhandledException: " + args.Exception);
                args.Handled = true;
            };

            TaskScheduler.UnobservedTaskException += (_, args) =>
            {
                WriteLog("UnobservedTaskException: " + args.Exception);
                args.SetObserved();
            };
        }

        private void TryUpdateInBackground()
        {
            Task.Run(async () =>
            {
                try
                {
                    Velopack.UpdateInfo? update = null;
                    try
                    {
                        var manager = new UpdateManager(new Velopack.Sources.SimpleWebSource(UpdateUrl));
                        update = await manager.CheckForUpdatesAsync();
                    }
                    catch { }

                    if (update == null)
                    {
                        try
                        {
                            var manager = new UpdateManager(new Velopack.Sources.GithubSource("https://github.com/DragosKissLove/TFY-UtilityHub-Releases", null, false));
                            update = await manager.CheckForUpdatesAsync();
                        }
                        catch { }
                    }

                    if (update == null)
                    {
                        WriteLog("Updater: no updates available.");
                        return;
                    }

                    WriteLog($"Updater: update available {update.TargetFullRelease.Version}.");
                }
                catch (Exception ex)
                {
                    WriteLog("Updater failed: " + ex.Message);
                }
            });
        }


        private static void WriteLog(string message)
        {
            try
            {
                File.AppendAllText(LogPath, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}{Environment.NewLine}");
            }
            catch
            {
                // Ignore logging failures.
            }
        }
    }
}

