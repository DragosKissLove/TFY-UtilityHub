using System;
using Microsoft.Win32;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
namespace TFY.Services
{
    public class GamingTweaksService
    {
        private static readonly RegistryKey TfyRegistry = Registry.CurrentUser.CreateSubKey(@"Software\TFY", RegistryKeyPermissionCheck.ReadWriteSubTree);

        public static async Task<bool> ApplyUltimatePowerPlanAsync()
        {
            try
            {
                string tempDir = Path.GetTempPath();
                string powPath = Path.Combine(tempDir, "fpsghoul.pow");
                
                using (var hc = new HttpClient())
                {
                    var bytes = await hc.GetByteArrayAsync("https://tfy-project.web.app/optimizations/fpsghoul.pow");
                    await File.WriteAllBytesAsync(powPath, bytes);
                }

                if (!File.Exists(powPath)) return false;

                var psi = new ProcessStartInfo("powercfg", $"-import \"{powPath}\"")
                {
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                using var p = Process.Start(psi);
                if (p == null) return false;
                
                string output = await p.StandardOutput.ReadToEndAsync();
                await p.WaitForExitAsync();

                int guidIndex = output.IndexOf("GUID: ");
                if (guidIndex != -1)
                {
                    string guidStr = output.Substring(guidIndex + 6).Trim();
                    var parts = guidStr.Split(new[] { ' ', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length > 0)
                    {
                        string guid = parts[0];
                        
                        // Disable core parking matching ParkControl "Off" and 100%
                        Process.Start(new ProcessStartInfo("powercfg", $"-setacvalueindex {guid} SUB_PROCESSOR 0cc5b647-c1df-4637-891a-dec35c318583 100") { CreateNoWindow = true })?.WaitForExit();
                        Process.Start(new ProcessStartInfo("powercfg", $"-setdcvalueindex {guid} SUB_PROCESSOR 0cc5b647-c1df-4637-891a-dec35c318583 100") { CreateNoWindow = true })?.WaitForExit();
                        // Disable frequency scaling matching ParkControl "Off" and 100%
                        Process.Start(new ProcessStartInfo("powercfg", $"-setacvalueindex {guid} SUB_PROCESSOR 893dee8e-2bef-41e0-89c6-b55d0929964c 100") { CreateNoWindow = true })?.WaitForExit();
                        Process.Start(new ProcessStartInfo("powercfg", $"-setdcvalueindex {guid} SUB_PROCESSOR 893dee8e-2bef-41e0-89c6-b55d0929964c 100") { CreateNoWindow = true })?.WaitForExit();
                        
                        Process.Start(new ProcessStartInfo("powercfg", $"-setactive {guid}") { CreateNoWindow = true })?.WaitForExit();
                        return true;
                    }
                }
                return false;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"ApplyUltimatePowerPlanAsync error: {ex.Message}");
                return false;
            }
        }

        public static async Task<bool> ApplyFullOptimizationAsync()
        {
            try
            {
                await ApplyUltimatePowerPlanAsync();

                string tempPath = Path.GetTempPath();

                using (var hc = new HttpClient())
                {
                    // 1. Install ParkControl silently
                    string parkControlTmp = Path.Combine(tempPath, "parkcontrolsetup64.exe");
                    var pcBytes = await hc.GetByteArrayAsync("https://bitsum.com/files/parkcontrolsetup64.exe");
                    await File.WriteAllBytesAsync(parkControlTmp, pcBytes);
                    Process.Start(new ProcessStartInfo(parkControlTmp, "/S") { CreateNoWindow = true })?.WaitForExit();

                    // 2. Install Process Lasso silently
                    string lassoTmp = Path.Combine(tempPath, "processlassosetup64.exe");
                    var plBytes = await hc.GetByteArrayAsync("https://bitsum.com/files/processlassosetup64.exe");
                    await File.WriteAllBytesAsync(lassoTmp, plBytes);
                    Process.Start(new ProcessStartInfo(lassoTmp, "/S") { CreateNoWindow = true })?.WaitForExit();
                }

                // 3. Download and Copy Configurations from Firebase Cloud
                string iniPath = Path.Combine(tempPath, "prolasso.ini");
                string rulesPath = Path.Combine(tempPath, "processlasso_rules.json");
                
                using (var hc = new HttpClient())
                {
                    var iniBytes = await hc.GetByteArrayAsync("https://tfy-project.web.app/optimizations/prolasso.ini");
                    await File.WriteAllBytesAsync(iniPath, iniBytes);
                    
                    var rulesBytes = await hc.GetByteArrayAsync("https://tfy-project.web.app/optimizations/processlasso_rules.json");
                    await File.WriteAllBytesAsync(rulesPath, rulesBytes);
                }

                string appDataLasso = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ProcessLasso");
                string appDataLassoConfig = Path.Combine(appDataLasso, "config");
                Directory.CreateDirectory(appDataLasso);
                Directory.CreateDirectory(appDataLassoConfig);

                // Kill Process Lasso so it doesn't overwrite the files on exit
                foreach(var p in Process.GetProcessesByName("ProcessLasso")) { try { p.Kill(); } catch { } }
                foreach(var p in Process.GetProcessesByName("processgovernor")) { try { p.Kill(); } catch { } }
                await Task.Delay(500); // give it time to release file handles

                if (File.Exists(iniPath)) File.Copy(iniPath, Path.Combine(appDataLassoConfig, "prolasso.ini"), true);
                if (File.Exists(rulesPath)) File.Copy(rulesPath, Path.Combine(appDataLasso, "processlasso_rules.json"), true);

                string lassoExe = @"C:\Program Files\Process Lasso\ProcessLasso.exe";
                if (File.Exists(lassoExe))
                {
                    Process.Start(new ProcessStartInfo(lassoExe) { UseShellExecute = true });
                }

                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"ApplyFullOptimizationAsync error: {ex.Message}");
                return false;
            }
        }

        public static bool DisablePreemption(bool enable)
        {
            try
            {
                if (enable)
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers\\Scheduler", "EnablePreemption", 0, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\System\\CurrentControlSet\\Services\\nvlddmkm", "DisablePreemption", 1, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\System\\CurrentControlSet\\Services\\nvlddmkm", "DisableCudaContextPreemption", 1, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\System\\CurrentControlSet\\Services\\nvlddmkm", "EnableCEPreemption", 0, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\System\\CurrentControlSet\\Services\\nvlddmkm", "DisablePreemptionOnS3S4", 1, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\System\\CurrentControlSet\\Services\\nvlddmkm", "ComputePreemption", 0, RegistryValueKind.DWord);
                    TfyRegistry.SetValue("Preemption", 1);
                }
                else
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers\\Scheduler", "EnablePreemption", 1, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\System\\CurrentControlSet\\Services\\nvlddmkm", "DisablePreemption", 0, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\System\\CurrentControlSet\\Services\\nvlddmkm", "DisableCudaContextPreemption", 0, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\System\\CurrentControlSet\\Services\\nvlddmkm", "EnableCEPreemption", 1, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\System\\CurrentControlSet\\Services\\nvlddmkm", "DisablePreemptionOnS3S4", 0, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\System\\CurrentControlSet\\Services\\nvlddmkm", "ComputePreemption", 1, RegistryValueKind.DWord);
                    TfyRegistry.DeleteValue("Preemption");
                }
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"DisablePreemption error: {ex.Message}");
                return false;
            }
        }

        public static bool DisableHDCP(bool enable)
        {
            try
            {
                if (enable)
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0001", "RMHdcpKeyglobZero", 1, RegistryValueKind.DWord);
                    TfyRegistry.SetValue("HDCP", 1);
                }
                else
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0001", "RMHdcpKeyglobZero", 0, RegistryValueKind.DWord);
                    TfyRegistry.DeleteValue("HDCP");
                }
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"DisableHDCP error: {ex.Message}");
                return false;
            }
        }

        public static bool SetWin32PrioritySeparation(int hexValue)
        {
            try
            {
                Registry.SetValue(@"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\PriorityControl",
                                "Win32PrioritySeparation", hexValue, RegistryValueKind.DWord);
                TfyRegistry.SetValue("Win32PrioritySeparation", hexValue);
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"SetWin32PrioritySeparation error: {ex.Message}");
                return false;
            }
        }

        public static bool SetSvcHostSplitThreshold(int ramValue)
        {
            try
            {
                Registry.SetValue(@"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control",
                                "SvcHostSplitThresholdInKB", ramValue * 1024 * 1024, RegistryValueKind.DWord);
                TfyRegistry.SetValue("SvcHostSplitThreshold", ramValue);
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"SetSvcHostSplitThreshold error: {ex.Message}");
                return false;
            }
        }

        public static bool NvidiaP0State(bool enable)
        {
            try
            {
                int value = enable ? 1 : 0;
                Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0000", "DisableDynamicPstate", value, RegistryValueKind.DWord);
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"NvidiaP0State error: {ex.Message}");
                return false;
            }
        }

        public static bool NvidiaDisableTelemetry()
        {
            try
            {
                Registry.SetValue("HKEY_LOCAL_MACHINE\\System\\CurrentControlSet\\Services\\nvlddmkm\\Global\\Startup", "SendTelemetryData", 0, RegistryValueKind.DWord);
                Registry.SetValue("HKEY_LOCAL_MACHINE\\SOFTWARE\\NVIDIA Corporation\\NvControlPanel2\\Client", "OptInOrOutPreference", 0, RegistryValueKind.DWord);
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"NvidiaDisableTelemetry error: {ex.Message}");
                return false;
            }
        }

        public static bool AmdShaderCacheOn()
        {
            try
            {
                Registry.SetValue(@"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0000\UMD", 
                                "ShaderCache", new byte[] { 0x32, 0x00 }, RegistryValueKind.Binary);
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"AmdShaderCacheOn error: {ex.Message}");
                return false;
            }
        }

        public static bool AmdShaderCacheDefault()
        {
            try
            {
                Registry.SetValue(@"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0000\UMD",
                                "ShaderCache", new byte[] { 0x31, 0x00 }, RegistryValueKind.Binary);
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"AmdShaderCacheDefault error: {ex.Message}");
                return false;
            }
        }

        public static bool CheckTweakState(string tweakName, int defaultValue)
        {
            try
            {
                object value = TfyRegistry.GetValue(tweakName);
                if (value == null) return defaultValue == 1;
                return ((int)value) == 1;
            }
            catch
            {
                return defaultValue == 1;
            }
        }

        public static int GetRegistryValue(string keyPath, string valueName, int defaultValue)
        {
            try
            {
                object value = Registry.GetValue(keyPath, valueName, defaultValue);
                return value != null ? (int)value : defaultValue;
            }
            catch
            {
                return defaultValue;
            }
        }
    }
}
