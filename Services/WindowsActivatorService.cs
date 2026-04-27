using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace TFY.Services
{
    public class WindowsLicenseInfo
    {
        public string Name { get; set; }
        public int LicenseStatus { get; set; }
        public bool IsActivated => LicenseStatus == 1;
        public string StatusLabel => LicenseStatus switch
        {
            1 => "Activat",
            2 => "Grace",
            3 => "Expirat",
            4 => "Neautentic",
            5 => "Notificare",
            _ => "Neactivat"
        };
    }

    public class OfficeLicenseInfo
    {
        public string Name { get; set; }
        public int LicenseStatus { get; set; }
        public bool IsInstalled { get; set; }
        public bool IsActivated => LicenseStatus == 1;
        public string StatusLabel => !IsInstalled ? "Neinstalat" :
            LicenseStatus == 1 ? "Activat" :
            LicenseStatus == 2 ? "Perioadă grație" :
            "Neactivat";
    }

    public static class WindowsActivatorService
    {
        private const string MasUrl =
            "https://raw.githubusercontent.com/massgravel/Microsoft-Activation-Scripts/master/MAS/All-In-One-Version-KL/MAS_AIO.cmd";

        // Save outside temp folder — MAS_AIO.cmd detects and refuses %TEMP% paths
        private static string GetScriptDir() =>
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TFY", "Activator");

        // ── Status ───────────────────────────────────────────────────────────────

        public static async Task<WindowsLicenseInfo> GetWindowsStatusAsync()
        {
            try
            {
                // Use exact Windows AppId GUID + PartialProductKey filter — much faster than wildcard name scan
                string script =
                    "$p = Get-CimInstance SoftwareLicensingProduct " +
                    "-Filter \"ApplicationId='55c92734-d682-4d71-983e-d6ec3f16059f' AND PartialProductKey IS NOT NULL\" " +
                    "-Property Name,LicenseStatus -ErrorAction SilentlyContinue " +
                    "| Sort-Object LicenseStatus -Descending | Select-Object -First 1; " +
                    "if ($p) { \"$($p.Name)|$($p.LicenseStatus)\" } else { 'Windows|0' }";

                string result = await RunPsAsync(script);
                var parts = result.Split('|');
                string name = parts.Length > 0 ? CleanProductName(parts[0].Trim()) : "Windows";
                int.TryParse(parts.Length > 1 ? parts[1].Trim() : "0", out int status);
                return new WindowsLicenseInfo { Name = name, LicenseStatus = status };
            }
            catch
            {
                return new WindowsLicenseInfo { Name = "Windows", LicenseStatus = 0 };
            }
        }

        public static async Task<OfficeLicenseInfo> GetOfficeStatusAsync()
        {
            try
            {
                // Single PS call: check C2R install + license status together (no cscript/ospp.vbs)
                string script =
                    // Check C2R install
                    "$c2r = Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Office\\ClickToRun\\Configuration' -ErrorAction SilentlyContinue; " +
                    "if (-not $c2r) { Write-Output 'not_installed||'; return }; " +
                    "$name = if ($c2r.ProductReleaseIds) { $c2r.ProductReleaseIds.Split(',')[0].Trim() } else { 'Microsoft Office' }; " +
                    // Fast WMI: Office AppId GUID + PartialProductKey filter skips ghost/uninstalled entries
                    "$id = '0ff1ce15-a989-479d-af46-f275c6370663'; " +
                    "$p = Get-CimInstance SoftwareLicensingProduct " +
                    "-Filter \"ApplicationId='$id' AND PartialProductKey IS NOT NULL\" " +
                    "-Property Name,LicenseStatus -ErrorAction SilentlyContinue " +
                    "| Sort-Object LicenseStatus -Descending | Select-Object -First 1; " +
                    "$status = if ($p) { $p.LicenseStatus } else { 0 }; " +
                    "Write-Output \"installed|$name|$status\"";

                string result = (await RunPsAsync(script)).Trim();
                var parts = result.Split('|');

                if (parts[0].Trim().ToLower() == "not_installed")
                    return new OfficeLicenseInfo { Name = "Microsoft Office", LicenseStatus = 0, IsInstalled = false };

                string officeName = parts.Length > 1 ? parts[1].Trim() : "Microsoft Office";
                int.TryParse(parts.Length > 2 ? parts[2].Trim() : "0", out int licStatus);
                return new OfficeLicenseInfo { Name = officeName, LicenseStatus = licStatus, IsInstalled = true };
            }
            catch
            {
                return new OfficeLicenseInfo { Name = "", LicenseStatus = 0, IsInstalled = false };
            }
        }

        // ── Activation ───────────────────────────────────────────────────────────

        public static async Task<(bool ok, string message)> ActivateAsync(string method)
        {
            method = (method ?? "HWID").ToUpperInvariant();
            string masFlag = method switch
            {
                "KMS38" => "KMS38",
                "KMS"   => "KMS",
                _       => "HWID"
            };

            string[] valid = { "HWID", "KMS38", "KMS" };
            if (Array.IndexOf(valid, method) < 0)
                return (false, "Metodă invalidă: " + method);

            // IMPORTANT: MAS_AIO.cmd checks if its path contains temp/tmp/AppData\Local\Temp
            // and refuses to run from those directories. Save to a dedicated app folder instead.
            string scriptDir = GetScriptDir();
            Directory.CreateDirectory(scriptDir);
            string cmdPath = Path.Combine(scriptDir, "MAS_AIO.cmd");

            // Download MAS
            try
            {
                using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(45) };
                client.DefaultRequestHeaders.UserAgent.ParseAdd("TFY-UtilityHub/1.0");
                var bytes = await client.GetByteArrayAsync(MasUrl);
                File.WriteAllBytes(cmdPath, bytes);
                Console.WriteLine($"[TFY] MAS downloaded to: {cmdPath}");
            }
            catch (Exception ex)
            {
                return (false, "Nu s-a putut descărca activatorul. Verifică conexiunea. (" + ex.Message + ")");
            }

            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = $"/k \"{cmdPath}\" /{masFlag}",
                    UseShellExecute = true,
                    Verb = "runas",
                    WorkingDirectory = scriptDir,
                };
                using var proc = Process.Start(psi);
                if (proc == null) return (false, "Procesul nu a putut porni.");
                await Task.Run(() => proc.WaitForExit(180_000));
                return (true, "Procesul de activare s-a finalizat. Apasă Verifică Status.");
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        }

        // ── Helpers ──────────────────────────────────────────────────────────────

        private static string CleanProductName(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return raw;
            // Shorten e.g. "Windows 10 Pro" → "Windows 10 Pro"
            return raw.Replace(", RETAIL channel", "").Replace(", OEM_DM channel", "")
                      .Replace(", OEM_COA_SLP channel", "").Replace(", OEM_COA_NSLP channel", "")
                      .Replace(", VOLUME_KMSCLIENT channel", "").Trim();
        }

        private static async Task<string> RunPsAsync(string script)
        {
            var psi = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = $"-NoProfile -NonInteractive -WindowStyle Hidden -Command \"{script.Replace("\"", "\\\"")}\"",
                CreateNoWindow = true,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            };
            using var proc = Process.Start(psi);
            if (proc == null) return "";
            string output = await proc.StandardOutput.ReadToEndAsync();
            await Task.Run(() => proc.WaitForExit(20_000));
            return Regex.Replace(output.Trim(), @"\x1B\[[0-9;]*[mGKHF]", "");
        }
    }
}
