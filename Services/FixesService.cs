using System;
using System.Diagnostics;
using System.IO;

namespace TFY.Services
{
    public class FixResult
    {
        public bool Ok { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public class FixesService
    {
        public FixResult RunFix(string id)
        {
            try
            {
                switch (id)
                {
                    case "audio_mic":
                        return RunPowerShell("Restart-Service AudioSrv,AudioEndpointBuilder -Force");
                    case "bluetooth":
                        return RunPowerShell("Set-Service bthserv -StartupType Automatic; Start-Service bthserv -ErrorAction SilentlyContinue; Start-Service BluetoothUserService -ErrorAction SilentlyContinue");
                    case "clipboard":
                        return RunPowerShell("Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Clipboard' -Name EnableClipboardHistory -Value 1 -Type DWord");
                    case "diagnostics":
                        return RunPowerShell("Set-Service WerSvc -StartupType Automatic; Start-Service WerSvc -ErrorAction SilentlyContinue");
                    case "disk_shrinking":
                        return RunPowerShell("Set-Service vds -StartupType Manual; Start-Service vds -ErrorAction SilentlyContinue");
                    case "fax_printing":
                        return RunPowerShell("Set-Service Spooler -StartupType Automatic; Start-Service Spooler -ErrorAction SilentlyContinue; Start-Service Fax -ErrorAction SilentlyContinue");
                    case "gta":
                        return ClearFiveMCache();
                    case "edge":
                        return RunPowerShell("Set-Service edgeupdate -StartupType Automatic; Start-Service edgeupdate -ErrorAction SilentlyContinue; Set-Service edgeupdatem -StartupType Automatic; Start-Service edgeupdatem -ErrorAction SilentlyContinue");
                    case "store_apps":
                        return RunPowerShell("Start-Process wsreset.exe -WindowStyle Hidden; Get-AppxPackage -allusers Microsoft.WindowsStore | ForEach-Object { Add-AppxPackage -DisableDevelopmentMode -Register ($_.InstallLocation + '\\AppXManifest.xml') }", 180);
                    case "nvidia_highlights":
                        return RunPowerShell("Restart-Service NVDisplay.ContainerLocalSystem -ErrorAction SilentlyContinue");
                    case "nvidia_control_panel":
                        return RunPowerShell("Get-AppxPackage -allusers *NVIDIACorp.NVIDIAControlPanel* | ForEach-Object { Add-AppxPackage -DisableDevelopmentMode -Register ($_.InstallLocation + '\\AppXManifest.xml') }", 180);
                    case "restore_points":
                        return RunPowerShell("Enable-ComputerRestore -Drive 'C:\\'", 120);
                    case "search_indexing":
                        return RunPowerShell("Set-Service WSearch -StartupType Automatic; Start-Service WSearch -ErrorAction SilentlyContinue");
                    case "snipping_tool":
                        return RunPowerShell("Get-AppxPackage -allusers Microsoft.ScreenSketch | ForEach-Object { Add-AppxPackage -DisableDevelopmentMode -Register ($_.InstallLocation + '\\AppXManifest.xml') }", 180);
                    case "valorant":
                        return RunPowerShell("Set-Service vgc -StartupType Automatic; Start-Service vgc -ErrorAction SilentlyContinue");
                    case "webcam":
                        return RunPowerShell("Set-Service FrameServer -StartupType Automatic; Start-Service FrameServer -ErrorAction SilentlyContinue");
                    case "wifi":
                        return RunPowerShell("Set-Service WlanSvc -StartupType Automatic; Start-Service WlanSvc -ErrorAction SilentlyContinue");
                    case "windows_security":
                        return RunPowerShell("Set-Service WinDefend -StartupType Automatic; Start-Service WinDefend -ErrorAction SilentlyContinue; Set-Service SecurityHealthService -StartupType Automatic; Start-Service SecurityHealthService -ErrorAction SilentlyContinue");
                    case "windows_update":
                        return RunPowerShell("Set-Service wuauserv -StartupType Automatic; Start-Service wuauserv -ErrorAction SilentlyContinue; Set-Service BITS -StartupType Automatic; Start-Service BITS -ErrorAction SilentlyContinue");
                    case "xbox_gaming":
                        return RunPowerShell("Set-Service XboxGipSvc -StartupType Automatic; Start-Service XboxGipSvc -ErrorAction SilentlyContinue; Set-Service XblAuthManager -StartupType Automatic; Start-Service XblAuthManager -ErrorAction SilentlyContinue; Set-Service XblGameSave -StartupType Automatic; Start-Service XblGameSave -ErrorAction SilentlyContinue; Set-Service XboxNetApiSvc -StartupType Automatic; Start-Service XboxNetApiSvc -ErrorAction SilentlyContinue");
                    default:
                        return new FixResult { Ok = false, Message = "Unknown fix." };
                }
            }
            catch (Exception ex)
            {
                return new FixResult { Ok = false, Message = ex.Message };
            }
        }

        private FixResult ClearFiveMCache()
        {
            try
            {
                string basePath = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string cachePath = Path.Combine(basePath, "FiveM", "FiveM.app", "data", "cache");
                if (Directory.Exists(cachePath))
                {
                    foreach (var file in Directory.GetFiles(cachePath))
                    {
                        File.Delete(file);
                    }
                    foreach (var dir in Directory.GetDirectories(cachePath))
                    {
                        Directory.Delete(dir, true);
                    }
                    return new FixResult { Ok = true, Message = "FiveM cache cleared." };
                }
                return new FixResult { Ok = true, Message = "FiveM cache not found." };
            }
            catch (Exception ex)
            {
                return new FixResult { Ok = false, Message = ex.Message };
            }
        }

        private FixResult RunPowerShell(string script, int timeoutSeconds = 60)
        {
            var escaped = script.Replace("\"", "\\\"");
            var psi = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = $"-NoProfile -ExecutionPolicy Bypass -Command \"{escaped}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var proc = Process.Start(psi);
            if (proc == null)
            {
                return new FixResult { Ok = false, Message = "Failed to start PowerShell." };
            }

            if (!proc.WaitForExit(timeoutSeconds * 1000))
            {
                try { proc.Kill(true); } catch { }
                return new FixResult { Ok = false, Message = "Operation timed out." };
            }

            string err = proc.StandardError.ReadToEnd();
            return new FixResult
            {
                Ok = proc.ExitCode == 0,
                Message = proc.ExitCode == 0 ? "Fix applied." : (string.IsNullOrWhiteSpace(err) ? "Fix failed." : err.Trim())
            };
        }
    }
}
