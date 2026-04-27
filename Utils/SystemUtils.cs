using System;
using System.Diagnostics;
using System.IO;
using Microsoft.Win32;

namespace TFY.Utils
{
    public static class SystemUtils
    {
        public static void RestartExplorer()
        {
            try
            {
                foreach (var process in Process.GetProcessesByName("explorer"))
                {
                    process.Kill();
                    process.WaitForExit();
                }

                Process.Start(new ProcessStartInfo
                {
                    FileName = "explorer.exe",
                    Arguments = "/NORESTART",
                    UseShellExecute = true
                });
            }
            catch { }
        }

        public static void RunCommand(string command, string arguments)
        {
            try
            {
                ProcessStartInfo startInfo = new ProcessStartInfo
                {
                    FileName = command,
                    Arguments = arguments,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using (Process process = new Process { StartInfo = startInfo })
                {
                    process.Start();
                    process.WaitForExit();
                }
            }
            catch { }
        }

        public static string GetOS()
        {
            try
            {
                string productName = (string)Registry.GetValue(
                    "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion",
                    "ProductName", "Unknown");
                return productName ?? "Unknown";
            }
            catch
            {
                return "Unknown";
            }
        }

        public static string GetOSVersion()
        {
            try
            {
                string version = (string)Registry.GetValue(
                    "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion",
                    "CurrentVersion", "Unknown");
                return version ?? "Unknown";
            }
            catch
            {
                return "Unknown";
            }
        }

        public static void DisableWindowsDefender()
        {
            try
            {
                using (RegistryKey defenderKey = Registry.LocalMachine.CreateSubKey(
                    "SOFTWARE\\Policies\\Microsoft\\Windows Defender"))
                {
                    defenderKey?.SetValue("DisableAntiSpyware", 1, RegistryValueKind.DWord);
                }

                using (RegistryKey realtimeKey = Registry.LocalMachine.CreateSubKey(
                    "SOFTWARE\\Policies\\Microsoft\\Windows Defender\\Real-Time Protection"))
                {
                    realtimeKey?.SetValue("DisableBehaviorMonitoring", 1, RegistryValueKind.DWord);
                    realtimeKey?.SetValue("DisableOnAccessProtection", 1, RegistryValueKind.DWord);
                    realtimeKey?.SetValue("DisableRealtimeMonitoring", 1, RegistryValueKind.DWord);
                }

                Registry.SetValue(
                    "HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Windows Defender\\Spynet",
                    "SpyNetReporting", 0, RegistryValueKind.DWord);
            }
            catch { }
        }

        public static void EnableWindowsDefender()
        {
            try
            {
                using (RegistryKey defenderKey = Registry.LocalMachine.CreateSubKey(
                    "SOFTWARE\\Policies\\Microsoft\\Windows Defender"))
                {
                    defenderKey?.SetValue("DisableAntiSpyware", 0, RegistryValueKind.DWord);
                }

                using (RegistryKey realtimeKey = Registry.LocalMachine.CreateSubKey(
                    "SOFTWARE\\Policies\\Microsoft\\Windows Defender\\Real-Time Protection"))
                {
                    realtimeKey?.SetValue("DisableBehaviorMonitoring", 0, RegistryValueKind.DWord);
                    realtimeKey?.SetValue("DisableOnAccessProtection", 0, RegistryValueKind.DWord);
                    realtimeKey?.SetValue("DisableRealtimeMonitoring", 0, RegistryValueKind.DWord);
                }

                Registry.SetValue(
                    "HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Windows Defender\\Spynet",
                    "SpyNetReporting", 1, RegistryValueKind.DWord);
            }
            catch { }
        }

        public static void DisableWindowsUpdates()
        {
            try
            {
                using (RegistryKey key = Registry.LocalMachine.CreateSubKey(
                    "SYSTEM\\CurrentControlSet\\Services\\wuauserv"))
                {
                    key?.SetValue("Start", 4, RegistryValueKind.DWord);
                }
            }
            catch { }
        }

        public static void OptimizeNetwork()
        {
            try
            {
                Registry.SetValue(
                    "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters",
                    "Tcp1323Opts", 1, RegistryValueKind.DWord);
                
                Registry.SetValue(
                    "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters",
                    "TcpMaxDataRetransmissions", 5, RegistryValueKind.DWord);
            }
            catch { }
        }

        public static void CleanTempFiles()
        {
            try
            {
                string tempPath = Path.GetTempPath();
                DirectoryInfo di = new DirectoryInfo(tempPath);

                foreach (FileInfo file in di.GetFiles())
                {
                    try { file.Delete(); } catch { }
                }

                foreach (DirectoryInfo dir in di.GetDirectories())
                {
                    try { dir.Delete(true); } catch { }
                }
            }
            catch { }
        }

        public static void EmptyRecycleBin()
        {
            try
            {
                RunCommand("cmd.exe", "/c rd /s /q %systemdrive%\\$Recycle.bin");
            }
            catch { }
        }
    }
}
