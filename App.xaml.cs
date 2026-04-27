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
        internal const string UpdateUrl = "https://tfy-project.web.app/Releases";
        public HardwareMonitorService? HardwareMonitor { get; private set; }
        private static string LogPath =>
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TFY", "boot.log");

        protected override void OnStartup(StartupEventArgs e)
        {
            try
            {
                VelopackApp.Build().Run();
            }
            catch (Exception ex)
            {
                // Guard against Velopack install/uninstall hook crashes
                WriteLog("Velopack hook error: " + ex.Message);
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
                    var manager = new UpdateManager(UpdateUrl);
                    var update = await manager.CheckForUpdatesAsync();
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

