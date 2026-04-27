using System;
using System.IO;
using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Win32;
using System.Linq;

namespace TFY.Services
{
    public static class SystemOptimizerService
    {
        #region MEMORY OPTIMIZER

        [DllImport("psapi.dll")]
        static extern bool EmptyWorkingSet(IntPtr hProcess);

        [DllImport("ntdll.dll")]
        static extern uint NtSetSystemInformation(
            int SystemInformationClass,
            IntPtr SystemInformation,
            int SystemInformationLength);

        [DllImport("kernel32.dll")]
        static extern bool SetSystemFileCacheSize(
            UIntPtr MinimumFileCacheSize,
            UIntPtr MaximumFileCacheSize,
            uint Flags);

        const int SystemMemoryListInformation = 80;

        public static void OptimizeMemory()
        {
            try
            {
                ClearProcessWorkingSets();
                ClearStandbyList();
                ResetFileCache();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TFY] Memory Optimization Error: {ex.Message}");
            }
        }

        static void ClearProcessWorkingSets()
        {
            foreach (Process process in Process.GetProcesses())
            {
                try { EmptyWorkingSet(process.Handle); }
                catch { }
            }
        }

        static void ClearStandbyList()
        {
            int[] commands = { 4, 5 };
            // 4 = Standby list
            // 5 = Modified page list

            foreach (int command in commands)
            {
                try
                {
                    IntPtr ptr = Marshal.AllocHGlobal(sizeof(int));
                    Marshal.WriteInt32(ptr, command);
                    NtSetSystemInformation(SystemMemoryListInformation, ptr, sizeof(int));
                    Marshal.FreeHGlobal(ptr);
                }
                catch { }
            }
        }

        static void ResetFileCache()
        {
            try
            {
                SetSystemFileCacheSize(UIntPtr.Zero, UIntPtr.Zero, 0x1);
            }
            catch { }
        }

        #endregion

        #region TEMP CLEANER

        public static void RunFullClean()
        {
            Console.WriteLine("[TFY] Starting FULL Temp Clean...\n");

            ClearDirectories();
            EmptyRecycleBin();
            ClearEventLogs();
            ClearDNS();
            ResetWinsock();
            RunDiskCleanup();
            RunComponentCleanup();

            Console.WriteLine("\n[TFY] Temp Cleaning Finished.");
        }

        static void ClearDirectories()
        {
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);

            string[] paths =
            {
                Path.GetTempPath(),
                @"C:\Windows\Temp",
                @"C:\Windows\Prefetch",
                @"C:\Windows\SoftwareDistribution\Download",
                @"C:\ProgramData\Microsoft\Windows\DeliveryOptimization\Cache",
                @"C:\Windows\Logs",
                @"C:\Windows\Minidump",
                @"C:\Windows\System32\LogFiles",
                localAppData + @"\Temp",
                localAppData + @"\Microsoft\Windows\Explorer",     // Thumbnails
                localAppData + @"\D3DSCache",                      // DirectX Shader Cache
                localAppData + @"\CrashDumps",
                appData + @"\Microsoft\Windows\Recent"
            };

            foreach (string path in paths)
                TryClean(path);
        }

        static void TryClean(string path)
        {
            try
            {
                if (!Directory.Exists(path)) return;

                foreach (string file in Directory.GetFiles(path))
                {
                    try { File.Delete(file); } catch { }
                }

                foreach (string dir in Directory.GetDirectories(path))
                {
                    try { Directory.Delete(dir, true); } catch { }
                }

                Console.WriteLine("Cleaned: " + path);
            }
            catch { }
        }

        [DllImport("Shell32.dll")]
        static extern uint SHEmptyRecycleBin(IntPtr hwnd, string pszRootPath, uint dwFlags);

        static void EmptyRecycleBin()
        {
            try
            {
                SHEmptyRecycleBin(IntPtr.Zero, null, 0);
                Console.WriteLine("Recycle Bin emptied.");
            }
            catch { }
        }

        static void ClearDNS()
        {
            RunCmd("ipconfig /flushdns");
            Console.WriteLine("DNS cache cleared.");
        }

        static void ResetWinsock()
        {
            RunCmd("netsh winsock reset");
            Console.WriteLine("Winsock reset.");
        }

        static void ClearEventLogs()
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo("wevtutil", "el");
                psi.RedirectStandardOutput = true;
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;

                var p = Process.Start(psi);
                string logs = p.StandardOutput.ReadToEnd();
                p.WaitForExit();

                foreach (string log in logs.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries))
                    RunCmd($"wevtutil cl \"{log}\"");

                Console.WriteLine("Event Logs cleared.");
            }
            catch { }
        }

        static void RunDiskCleanup()
        {
            try
            {
                Console.WriteLine("Running Disk Cleanup...");

                string baseKey = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VolumeCaches";

                using (RegistryKey categories = Registry.LocalMachine.OpenSubKey(baseKey))
                {
                    if (categories != null)
                    {
                        foreach (string subKeyName in categories.GetSubKeyNames())
                        {
                            try
                            {
                                using (RegistryKey subKey = Registry.LocalMachine.OpenSubKey(baseKey + "\\" + subKeyName, true))
                                {
                                    subKey?.SetValue("StateFlags0001", 2, RegistryValueKind.DWord);
                                }
                            }
                            catch { }
                        }
                    }
                }

                RunCmd("cleanmgr /sagerun:1");
            }
            catch { }
        }

        static void RunComponentCleanup()
        {
            try
            {
                Console.WriteLine("Running Component Cleanup (DISM)...");
                RunCmd("dism /online /cleanup-image /startcomponentcleanup");
                Console.WriteLine("Component Cleanup completed.");
            }
            catch { }
        }

        static void RunCmd(string command)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo("cmd.exe", "/c " + command);
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.RedirectStandardOutput = true;
                psi.RedirectStandardError = true;

                var process = Process.Start(psi);
                process?.WaitForExit();
            }
            catch { }
        }

        #endregion
    }
}
