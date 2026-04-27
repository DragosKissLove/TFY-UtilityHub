using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Management;
using System.Diagnostics;
using System.Runtime.InteropServices;
using Newtonsoft.Json;

namespace TFY.Services
{
    public class BackupPoint
    {
        [JsonProperty("id")]
        public int Id { get; set; }
        [JsonProperty("name")]
        public string Name { get; set; } = string.Empty;
        [JsonProperty("createdAt")]
        public string CreatedAt { get; set; } = string.Empty;
        [JsonProperty("type")]
        public string Type { get; set; } = "manual";
    }

    public class BackupsService
    {
        [DllImport("srclient.dll", SetLastError = true)]
        private static extern uint SRRemoveRestorePoint(uint dwRPNum);

        public bool CanDeleteRestorePoints()
        {
            try
            {
                using var restore = new ManagementClass(@"root\default", "SystemRestore", null);
                return restore.GetMethodParameters("RemoveRestorePoint") != null;
            }
            catch
            {
                return false;
            }
        }

        public List<BackupPoint> GetRestorePoints()
        {
            var list = new List<(BackupPoint item, DateTime createdAt)>();
            try
            {
                using var searcher = new ManagementObjectSearcher(
                    @"root\default",
                    "SELECT SequenceNumber, Description, CreationTime, RestorePointType FROM SystemRestore"
                );

                foreach (ManagementObject rp in searcher.Get())
                {
                    var id = Convert.ToInt32(rp["SequenceNumber"] ?? 0);
                    var name = rp["Description"]?.ToString() ?? "Restore Point";
                    var createdRaw = rp["CreationTime"]?.ToString() ?? string.Empty;
                    var created = ParseWmiDate(createdRaw);
                    var type = Convert.ToUInt32(rp["RestorePointType"] ?? 0u);

                    list.Add((new BackupPoint
                    {
                        Id = id,
                        Name = name,
                        CreatedAt = created == DateTime.MinValue
                            ? "-"
                            : created.ToString("ddd, MMM d", CultureInfo.InvariantCulture),
                        Type = MapType(type)
                    }, created));
                }
            }
            catch
            {
                // WMI restore points can fail on some systems; return empty instead of crashing host.
            }

            if (list.Count == 0)
            {
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = "powershell.exe",
                        Arguments = "-NoProfile -ExecutionPolicy Bypass -Command \"$pts = Get-ComputerRestorePoint; if ($pts -eq $null) { Write-Output '[]' } else { @($pts) | Select-Object SequenceNumber, Description, CreationTime, RestorePointType | ConvertTo-Json -Compress }\"",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        CreateNoWindow = true
                    };
                    using var proc = Process.Start(psi);
                    if (proc != null)
                    {
                        var json = proc.StandardOutput.ReadToEnd();
                        proc.WaitForExit();
                        if (proc.ExitCode == 0 && !string.IsNullOrWhiteSpace(json) && json.Trim() != "[]")
                        {
                            var rawPoints = JsonConvert.DeserializeObject<dynamic[]>(json);
                            if (rawPoints != null)
                            {
                                foreach (var rp in rawPoints)
                                {
                                    if (rp == null) continue;
                                    var id = Convert.ToInt32(rp.SequenceNumber ?? 0);
                                    var name = rp.Description?.ToString() ?? "Restore Point";
                                    var createdRaw = rp.CreationTime?.ToString() ?? string.Empty;
                                    var createdStr = createdRaw.Length >= 14
                                        ? $"{createdRaw.Substring(0, 4)}-{createdRaw.Substring(4, 2)}-{createdRaw.Substring(6, 2)}T{createdRaw.Substring(8, 2)}:{createdRaw.Substring(10, 2)}:00"
                                        : "";
                                    DateTime.TryParse(createdStr, out DateTime created);
                                    var type = Convert.ToUInt32(rp.RestorePointType ?? 0u);

                                    list.Add((new BackupPoint
                                    {
                                        Id = id,
                                        Name = name,
                                        CreatedAt = created == DateTime.MinValue
                                            ? "-"
                                            : created.ToString("ddd, MMM d", CultureInfo.InvariantCulture),
                                        Type = MapType(type)
                                    }, created));
                                }
                            }
                        }
                    }
                }
                catch { }
            }

            return list
                .OrderByDescending(x => x.createdAt)
                .ThenByDescending(x => x.item.Id)
                .Select(x => x.item)
                .ToList();
        }

        public (bool ok, string message) CreateRestorePoint(string name)
        {
            try
            {
                using var restore = new ManagementClass(@"root\default", "SystemRestore", null);
                var inParams = restore.GetMethodParameters("CreateRestorePoint");
                inParams["Description"] = name;
                inParams["RestorePointType"] = 12;
                inParams["EventType"] = 100;
                var outParams = restore.InvokeMethod("CreateRestorePoint", inParams, null);
                var result = Convert.ToInt32(outParams?["ReturnValue"] ?? 1);
                if (result == 0)
                {
                    return (true, "Backup created.");
                }

                var fallback = RunCheckpointFallback(name);
                return fallback.ok
                    ? (true, "Backup created.")
                    : (false, $"Failed to create backup (code {result}). {fallback.message}");
            }
            catch (Exception ex)
            {
                var fallback = RunCheckpointFallback(name);
                return fallback.ok
                    ? (true, "Backup created.")
                    : (false, $"{ex.Message}. {fallback.message}");
            }
        }

        public (bool ok, string message) DeleteRestorePoint(int sequence)
        {
            try
            {
                using var restore = new ManagementClass(@"root\default", "SystemRestore", null);
                var inParams = restore.GetMethodParameters("RemoveRestorePoint");
                inParams["SequenceNumber"] = Convert.ToUInt32(sequence);
                var outParams = restore.InvokeMethod("RemoveRestorePoint", inParams, null);
                var result = Convert.ToInt32(outParams?["ReturnValue"] ?? 1);

                var mapped = result switch
                {
                    0 => (true, "Backup deleted."),
                    5 => (false, "Access denied. Please run TFY as Administrator."),
                    _ => (false, $"Failed to delete backup (code {result}).")
                };

                if (!mapped.Item1)
                {
                    var fallback = TryDeleteWithSrClient(sequence);
                    if (fallback.ok) return fallback;
                }

                return mapped;
            }
            catch (ManagementException mex) when (
                mex.Message != null &&
                (mex.Message.IndexOf("not implemented", StringComparison.OrdinalIgnoreCase) >= 0 ||
                 mex.Message.IndexOf("invalid method", StringComparison.OrdinalIgnoreCase) >= 0))
            {
                return TryDeleteWithSrClient(sequence);
            }
            catch (Exception ex)
            {
                var fallback = TryDeleteWithSrClient(sequence);
                return fallback.ok ? fallback : (false, ex.Message);
            }
        }

        public (bool ok, string message) RestorePoint(int sequence)
        {
            try
            {
                using var restore = new ManagementClass(@"root\default", "SystemRestore", null);
                var inParams = restore.GetMethodParameters("Restore");
                inParams["SequenceNumber"] = sequence;
                var outParams = restore.InvokeMethod("Restore", inParams, null);
                var result = Convert.ToInt32(outParams?["ReturnValue"] ?? 1);
                return result == 0 ? (true, "Restore started. Restart may be required.") : (false, "Failed to start restore.");
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        }

        private static DateTime ParseWmiDate(string wmiTime)
        {
            if (string.IsNullOrWhiteSpace(wmiTime)) return DateTime.MinValue;
            try
            {
                return ManagementDateTimeConverter.ToDateTime(wmiTime);
            }
            catch
            {
                return DateTime.MinValue;
            }
        }

        private static string MapType(uint restorePointType)
        {
            return restorePointType switch
            {
                0 or 10 or 12 => "windows",
                1 or 11 or 13 => "automatic",
                _ => "windows",
            };
        }

        private static (bool ok, string message) TryDeleteWithSrClient(int sequence)
        {
            try
            {
                var code = SRRemoveRestorePoint(Convert.ToUInt32(sequence));
                if (code == 0)
                {
                    return (true, "Backup deleted.");
                }
                if (code == 5)
                {
                    return (false, "Access denied. Please run TFY as Administrator.");
                }
                return (false, $"Failed to delete backup (srclient code {code}).");
            }
            catch (Exception ex)
            {
                return (false, $"Delete restore points is not supported by Windows on this system. {ex.Message}");
            }
        }

        private static (bool ok, string message) RunCheckpointFallback(string name)
        {
            try
            {
                var safeName = string.IsNullOrWhiteSpace(name) ? "TFY Restore Point" : name.Replace("'", "''");
                var psi = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = $"-NoProfile -ExecutionPolicy Bypass -Command \"Set-Service -Name vss -StartupType Manual -ErrorAction SilentlyContinue; Set-Service -Name srservice -StartupType Automatic -ErrorAction SilentlyContinue; Enable-ComputerRestore -Drive 'C:\\' -ErrorAction SilentlyContinue; Checkpoint-Computer -Description '{safeName}' -RestorePointType 'MODIFY_SETTINGS'\"",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                };

                using var proc = Process.Start(psi);
                if (proc == null)
                {
                    return (false, "Could not start PowerShell fallback.");
                }

                if (!proc.WaitForExit(120000))
                {
                    try { proc.Kill(true); } catch { }
                    return (false, "Fallback timed out.");
                }

                if (proc.ExitCode == 0)
                {
                    return (true, "Fallback succeeded.");
                }

                var err = proc.StandardError.ReadToEnd();
                return (false, string.IsNullOrWhiteSpace(err) ? "Fallback failed." : err.Trim());
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        }
    }
}
