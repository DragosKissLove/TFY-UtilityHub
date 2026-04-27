using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Management;
using System.Net.Http;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;
using LibreHardwareMonitor.Hardware;
using LhmComputer = LibreHardwareMonitor.Hardware.Computer;

namespace TFY.Services
{
    public class HardwareMonitorService
    {
        private bool _loggedNoSensors;
        private readonly HttpClient _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(1) };
        private Process? _lhmProcess;
        private string? _lhmExePath;
        private LhmComputer? _lhmComputer;
        private bool _lhmLibAvailable;
        private DateTime _lastLhmAttempt = DateTime.MinValue;

        private static string LogPath =>
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TFY", "boot.log");

        public HardwareMonitorService()
        {
            _lhmExePath = FindLibreHardwareMonitorExe();
            StartLibreHardwareMonitor();
            try
            {
                _lhmComputer = new LhmComputer
                {
                    IsCpuEnabled = true,
                    IsGpuEnabled = true,
                    IsMotherboardEnabled = true,
                    IsMemoryEnabled = true,
                    IsStorageEnabled = true,
                    IsControllerEnabled = true
                };
                _lhmComputer.Open();
                _lhmLibAvailable = true;
                WriteLog("LibreHardwareMonitorLib initialized.");
            }
            catch (Exception ex)
            {
                _lhmLibAvailable = false;
                WriteLog("LibreHardwareMonitorLib init failed: " + ex);
            }
            WriteLog("Hardware monitor initialized (LibreHardwareMonitor + WMI fallback).");
        }

        public object GetHardwareStats()
        {
            if (TryGetLibreHardwareLibStats(out var libStats))
            {
                return libStats;
            }

            if (TryGetLibreHardwareExeStats(out var lhmStats))
            {
                return lhmStats;
            }

            return GetWmiStats();
        }

        private object GetWmiStats()
        {
            var stats = new Dictionary<string, object>();

            try
            {
                stats["CPU"] = GetCpuStats();
                stats["GPU"] = GetGpuStats();
                stats["RAM"] = GetRamStats();
                stats["Drives"] = GetDriveInfo();
            }
            catch (Exception ex)
            {
                if (!_loggedNoSensors)
                {
                    WriteLog("Hardware stats error: " + ex);
                    _loggedNoSensors = true;
                }
            }

            return stats;
        }

        private bool TryGetLibreHardwareExeStats(out Dictionary<string, object> stats)
        {
            stats = new Dictionary<string, object>();

            try
            {
                EnsureLibreHardwareMonitorRunning();

                var json = _httpClient.GetStringAsync("http://127.0.0.1:8085/data.json").GetAwaiter().GetResult();
                if (string.IsNullOrWhiteSpace(json))
                {
                    return false;
                }

                var root = JToken.Parse(json);
                var sensors = new List<LhmSensor>();

                WalkSensors(root, "", string.Empty, sensors);

                if (sensors.Count == 0)
                {
                    WriteLog("LibreHardwareMonitor HTTP returned 0 sensors.");
                    return false;
                }

                                                                                                double cpuLoad = MaxSensor(sensors, s => IsType(s, "Load") && IsCpuSensor(s) && HasName(s, "total"));
                if (cpuLoad <= 0)
                {
                    cpuLoad = MaxSensor(sensors, s => IsType(s, "Load") && IsCpuSensor(s));
                }

                 double cpuPackage = PickSensorByName(
                    sensors,
                    s => IsType(s, "Temperature") && IsCpuSensor(s) && IsCpuPackageName(s.Name),
                    "cpu package", "package"
                );
                if (cpuPackage <= 0)
                {
                    cpuPackage = PickSensorByName(
                        sensors,
                        s => IsType(s, "Temperature") && IsCpuSensor(s) && !IsCpuJunctionName(s.Name),
                        "cpu package", "package"
                    );
                }
                if (cpuPackage <= 0)
                {
                    cpuPackage = PickSensorByName(
                        sensors,
                        s => IsType(s, "Temperature") && IsCpuSensor(s),
                        "tctl", "tdie"
                    );
                }
                var cpuCoreTemps = sensors
                    .Where(s => IsType(s, "Temperature") && IsCpuSensor(s) && IsCpuCoreName(s.Name))
                    .Select(s => s.Value)
                    .ToList();
                double cpuCoreAvg = PickSensorByName(
                    sensors,
                    s => IsType(s, "Temperature") && IsCpuSensor(s) && !IsCpuJunctionName(s.Name),
                    "core average", "average"
                );
                double cpuCoreMax = PickSensorByName(
                    sensors,
                    s => IsType(s, "Temperature") && IsCpuSensor(s) && !IsCpuJunctionName(s.Name),
                    "core max", "max"
                );
                if (cpuCoreAvg <= 0 && cpuCoreTemps.Count > 0)
                {
                    cpuCoreAvg = cpuCoreTemps.Average();
                }
                if (cpuCoreMax <= 0 && cpuCoreTemps.Count > 0)
                {
                    cpuCoreMax = cpuCoreTemps.Max();
                }
                if (cpuPackage > 0 && cpuCoreAvg > 0 && cpuPackage - cpuCoreAvg > 5)
                {
                    cpuPackage = cpuCoreAvg;
                }
                if (cpuPackage > 0 && cpuCoreMax > 0 && cpuPackage - cpuCoreMax > 5)
                {
                    cpuPackage = cpuCoreMax;
                }
                double cpuTemp = cpuPackage > 0 ? cpuPackage : (cpuCoreAvg > 0 ? cpuCoreAvg : 0);

                double gpuLoad = MaxSensor(sensors, s => IsType(s, "Load") && IsGpuSensor(s) && (HasName(s, "core") || HasName(s, "total")));
                if (gpuLoad <= 0)
                {
                    gpuLoad = MaxSensor(sensors, s => IsType(s, "Load") && IsGpuSensor(s));
                }

                var gpuTempSensors = sensors.Where(s => IsType(s, "Temperature") && IsGpuSensor(s)).ToList();
                double gpuHotSpot = PickSensorByName(
                    gpuTempSensors,
                    s => IsGpuHotSpotName(s.Name),
                    "hot spot", "hotspot", "junction"
                );
                double gpuCoreTemp = PickSensorByName(
                    gpuTempSensors,
                    s => !IsGpuHotSpotName(s.Name),
                    "gpu core", "core", "gpu temperature", "temperature"
                );
                if (gpuCoreTemp <= 0)
                {
                    var gpuCandidates = gpuTempSensors
                        .Where(s => !IsGpuHotSpotName(s.Name) && IsGpuTempCandidateName(s.Name))
                        .Select(s => s.Value)
                        .Where(v => v > 0)
                        .ToList();
                    if (gpuCandidates.Count > 0)
                    {
                        gpuCoreTemp = gpuCandidates.Min();
                    }
                }
                var gpuTempValues = gpuTempSensors.Select(s => s.Value).Where(v => v > 0).ToList();
                var gpuMin = gpuTempValues.Count > 0 ? gpuTempValues.Min() : 0;
                var gpuMax = gpuTempValues.Count > 0 ? gpuTempValues.Max() : 0;
                if (gpuCoreTemp <= 0) gpuCoreTemp = gpuMin;
                if (gpuHotSpot <= 0) gpuHotSpot = gpuMax;
                if (gpuHotSpot > 0 && gpuCoreTemp > 0 && Math.Abs(gpuHotSpot - gpuCoreTemp) < 0.2 && gpuMax > gpuMin)
                {
                    gpuHotSpot = gpuMax;
                    gpuCoreTemp = gpuMin;
                }
                double gpuTemp = gpuCoreTemp > 0 ? gpuCoreTemp : gpuHotSpot;
                double ramLoad = MaxSensor(sensors, s => IsType(s, "Load") && (HasPath(s, "memory") || HasPath(s, "ram")));
                double ramUsed = MaxSensor(sensors, s => IsType(s, "Data") && (HasPath(s, "memory") || HasPath(s, "ram")) && HasName(s, "used"));
                double ramAvailable = MaxSensor(sensors, s => IsType(s, "Data") && (HasPath(s, "memory") || HasPath(s, "ram")) && HasName(s, "available"));

                var cpuCores = sensors
                    .Where(s => IsType(s, "Temperature") && IsCpuSensor(s) && IsCpuCoreName(s.Name))
                    .Select(s => new { name = s.Name, value = s.Value })
                    .Cast<object>()
                    .ToList();

                stats["CPU"] = new Dictionary<string, object>
                {
                    { "Load", cpuLoad },
                    { "Temperature", cpuTemp },
                    { "PackageTemp", cpuPackage },
                    { "CoreAverage", cpuCoreAvg },
                    { "CoreMax", cpuCoreMax },
                    { "Cores", cpuCores }
                };

                stats["GPU"] = new Dictionary<string, object>
                {
                    { "Load", gpuLoad },
                    { "Temperature", gpuTemp },
                    { "CoreTemp", gpuCoreTemp },
                    { "HotSpot", gpuHotSpot }
                };

                var ramStats = new Dictionary<string, object>
                {
                    { "Load", ramLoad },
                    { "Used", ramUsed },
                    { "Available", ramAvailable },
                    { "VirtualUsed", 0 },
                    { "VirtualAvailable", 0 }
                };
                FillVirtualRamFromWmi(ramStats);
                if (GetRamStats() is Dictionary<string, object> wmiRam)
                {
                    ramStats["VirtualUsed"] = wmiRam.TryGetValue("VirtualUsed", out var vu) ? vu : ramStats["VirtualUsed"];
                    ramStats["VirtualAvailable"] = wmiRam.TryGetValue("VirtualAvailable", out var va) ? va : ramStats["VirtualAvailable"];
                }
                stats["RAM"] = ramStats;

                stats["Drives"] = GetDriveInfo();

                return true;
            }
            catch (Exception ex)
            {
                if (!_loggedNoSensors)
                {
                    WriteLog("LibreHardwareMonitor read failed: " + ex);
                    _loggedNoSensors = true;
                }
                return false;
            }
        }

        private bool TryGetLibreHardwareLibStats(out Dictionary<string, object> stats)
        {
            stats = new Dictionary<string, object>();

            if (!_lhmLibAvailable || _lhmComputer == null)
            {
                return false;
            }

            try
            {
                var sensors = new List<LibSensor>();

                _lhmComputer.Accept(new UpdateVisitor());

                foreach (var hw in _lhmComputer.Hardware)
                {
                    hw.Update();
                    foreach (var sub in hw.SubHardware)
                    {
                        sub.Update();
                    }
                    CollectLibSensors(hw, sensors);
                    foreach (var sub in hw.SubHardware)
                    {
                        CollectLibSensors(sub, sensors);
                    }
                }

                if (sensors.Count == 0)
                {
                    WriteLog("LibreHardwareMonitorLib returned 0 sensors.");
                    return false;
                }

                                                                                double cpuLoad = MaxLib(sensors, s => s.Type == SensorType.Load && IsCpu(s) && NameHas(s, "total"));
                if (cpuLoad <= 0)
                {
                    cpuLoad = MaxLib(sensors, s => s.Type == SensorType.Load && IsCpu(s));
                }

                 double cpuPackage = PickLibByName(
                    sensors,
                    s => s.Type == SensorType.Temperature && IsCpu(s) && IsCpuPackageName(s.Name),
                    "cpu package", "package"
                );
                if (cpuPackage <= 0)
                {
                    cpuPackage = PickLibByName(
                        sensors,
                        s => s.Type == SensorType.Temperature && IsCpu(s) && !IsCpuJunctionName(s.Name),
                        "cpu package", "package"
                    );
                }
                if (cpuPackage <= 0)
                {
                    cpuPackage = PickLibByName(
                        sensors,
                        s => s.Type == SensorType.Temperature && IsCpu(s),
                        "tctl", "tdie"
                    );
                }
                var cpuCoreTemps = sensors
                    .Where(s => s.Type == SensorType.Temperature && IsCpu(s) && IsCpuCoreName(s.Name))
                    .Select(s => s.Value)
                    .ToList();
                double cpuCoreAvg = PickLibByName(
                    sensors,
                    s => s.Type == SensorType.Temperature && IsCpu(s) && !IsCpuJunctionName(s.Name),
                    "core average", "average"
                );
                double cpuCoreMax = PickLibByName(
                    sensors,
                    s => s.Type == SensorType.Temperature && IsCpu(s) && !IsCpuJunctionName(s.Name),
                    "core max", "max"
                );
                if (cpuCoreAvg <= 0 && cpuCoreTemps.Count > 0)
                {
                    cpuCoreAvg = cpuCoreTemps.Average();
                }
                if (cpuCoreMax <= 0 && cpuCoreTemps.Count > 0)
                {
                    cpuCoreMax = cpuCoreTemps.Max();
                }
                if (cpuPackage > 0 && cpuCoreAvg > 0 && cpuPackage - cpuCoreAvg > 5)
                {
                    cpuPackage = cpuCoreAvg;
                }
                if (cpuPackage > 0 && cpuCoreMax > 0 && cpuPackage - cpuCoreMax > 5)
                {
                    cpuPackage = cpuCoreMax;
                }
                double cpuTemp = cpuPackage > 0 ? cpuPackage : (cpuCoreAvg > 0 ? cpuCoreAvg : 0);

                double gpuLoad = MaxLib(sensors, s => s.Type == SensorType.Load && IsGpu(s) && (NameHas(s, "core") || NameHas(s, "total")));
                if (gpuLoad <= 0)
                {
                    gpuLoad = MaxLib(sensors, s => s.Type == SensorType.Load && IsGpu(s));
                }

                var gpuTempSensors = sensors.Where(s => s.Type == SensorType.Temperature && IsGpu(s)).ToList();
                double gpuHotSpot = PickLibByName(
                    gpuTempSensors,
                    s => IsGpuHotSpotName(s.Name),
                    "hot spot", "hotspot", "junction"
                );
                double gpuCoreTemp = PickLibByName(
                    gpuTempSensors,
                    s => !IsGpuHotSpotName(s.Name),
                    "gpu core", "core", "gpu temperature", "temperature"
                );
                if (gpuCoreTemp <= 0)
                {
                    var gpuCandidates = gpuTempSensors
                        .Where(s => !IsGpuHotSpotName(s.Name) && IsGpuTempCandidateName(s.Name))
                        .Select(s => s.Value)
                        .Where(v => v > 0)
                        .ToList();
                    if (gpuCandidates.Count > 0)
                    {
                        gpuCoreTemp = gpuCandidates.Min();
                    }
                }
                var gpuTempValues = gpuTempSensors.Select(s => s.Value).Where(v => v > 0).ToList();
                var gpuMin = gpuTempValues.Count > 0 ? gpuTempValues.Min() : 0;
                var gpuMax = gpuTempValues.Count > 0 ? gpuTempValues.Max() : 0;
                if (gpuCoreTemp <= 0) gpuCoreTemp = gpuMin;
                if (gpuHotSpot <= 0) gpuHotSpot = gpuMax;
                if (gpuHotSpot > 0 && gpuCoreTemp > 0 && Math.Abs(gpuHotSpot - gpuCoreTemp) < 0.2 && gpuMax > gpuMin)
                {
                    gpuHotSpot = gpuMax;
                    gpuCoreTemp = gpuMin;
                }
                double gpuTemp = gpuCoreTemp > 0 ? gpuCoreTemp : gpuHotSpot;

                double ramLoad = MaxLib(sensors, s => s.Type == SensorType.Load && (PathHas(s, "memory") || PathHas(s, "ram")));
                double ramUsed = MaxLib(sensors, s => s.Type == SensorType.Data && (PathHas(s, "memory") || PathHas(s, "ram")) && NameHas(s, "used"));
                double ramAvailable = MaxLib(sensors, s => s.Type == SensorType.Data && (PathHas(s, "memory") || PathHas(s, "ram")) && NameHas(s, "available"));

                var cpuCores = sensors
                    .Where(s => s.Type == SensorType.Temperature && IsCpu(s) && IsCpuCoreName(s.Name))
                    .Select(s => new { name = s.Name, value = s.Value })
                    .Cast<object>()
                    .ToList();

                stats["CPU"] = new Dictionary<string, object>
                {
                    { "Load", cpuLoad },
                    { "Temperature", cpuTemp },
                    { "PackageTemp", cpuPackage },
                    { "CoreAverage", cpuCoreAvg },
                    { "CoreMax", cpuCoreMax },
                    { "Cores", cpuCores }
                };

                stats["GPU"] = new Dictionary<string, object>
                {
                    { "Load", gpuLoad },
                    { "Temperature", gpuTemp },
                    { "CoreTemp", gpuCoreTemp },
                    { "HotSpot", gpuHotSpot }
                };

                var ramStats = new Dictionary<string, object>
                {
                    { "Load", ramLoad },
                    { "Used", ramUsed },
                    { "Available", ramAvailable },
                    { "VirtualUsed", 0 },
                    { "VirtualAvailable", 0 }
                };
                FillVirtualRamFromWmi(ramStats);
                if (GetRamStats() is Dictionary<string, object> wmiRam)
                {
                    ramStats["VirtualUsed"] = wmiRam.TryGetValue("VirtualUsed", out var vu) ? vu : ramStats["VirtualUsed"];
                    ramStats["VirtualAvailable"] = wmiRam.TryGetValue("VirtualAvailable", out var va) ? va : ramStats["VirtualAvailable"];
                }
                stats["RAM"] = ramStats;

                stats["Drives"] = GetDriveInfo();

                return true;
            }
            catch (Exception ex)
            {
                if (!_loggedNoSensors)
                {
                    WriteLog("LibreHardwareMonitorLib read failed: " + ex);
                    _loggedNoSensors = true;
                }
                return false;
            }
        }

        private static void CollectLibSensors(IHardware hardware, List<LibSensor> sensors)
        {
            foreach (var sensor in hardware.Sensors)
            {
                if (!sensor.Value.HasValue) continue;
                sensors.Add(new LibSensor(
                    path: hardware.HardwareType + " > " + hardware.Name,
                    name: sensor.Name,
                    type: sensor.SensorType,
                    value: sensor.Value.Value,
                    hardwareType: hardware.HardwareType.ToString()
                ));
            }
        }

        private static double MaxLib(IEnumerable<LibSensor> sensors, Func<LibSensor, bool> predicate)
        {
            return sensors.Where(predicate).Select(s => s.Value).DefaultIfEmpty(0).Max();
        }
        private static double PickLibByName(IEnumerable<LibSensor> sensors, Func<LibSensor, bool> predicate, params string[] names)
        {
            foreach (var name in names)
            {
                var match = sensors.FirstOrDefault(s => predicate(s) && s.Name.Contains(name, StringComparison.OrdinalIgnoreCase));
                if (match != null)
                {
                    return match.Value;
                }
            }
            return 0;
        }

        private static bool NameHas(LibSensor sensor, string token)
        {
            return sensor.Name.Contains(token, StringComparison.OrdinalIgnoreCase);
        }

        private static bool PathHas(LibSensor sensor, string token)
        {
            return sensor.Path.Contains(token, StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsCpu(LibSensor sensor)
        {
            return sensor.HardwareType.Contains("cpu", StringComparison.OrdinalIgnoreCase) || sensor.Name.Contains("cpu", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsGpu(LibSensor sensor)
        {
            return sensor.HardwareType.Contains("gpu", StringComparison.OrdinalIgnoreCase) || sensor.Name.Contains("gpu", StringComparison.OrdinalIgnoreCase);
        }

        private static void WalkSensors(JToken node, string path, string hardwareType, List<LhmSensor> sensors)
        {
            string text = node["Text"]?.ToString() ?? node["Name"]?.ToString() ?? string.Empty;
            string nextPath = string.IsNullOrEmpty(path) ? text : path + " > " + text;

            string nodeType = node["Type"]?.ToString() ?? string.Empty;
            string sensorType = node["SensorType"]?.ToString() ?? string.Empty;
            string nextHardwareType = (!string.IsNullOrWhiteSpace(nodeType) && string.IsNullOrWhiteSpace(sensorType))
                ? nodeType
                : hardwareType;

            if (node["Sensors"] is JArray sensorArray)
            {
                foreach (var sensor in sensorArray)
                {
                    TryAddSensor(sensor, nextPath, nextHardwareType, sensors);
                }
            }

            TryAddSensor(node, nextPath, nextHardwareType, sensors);

            if (node["Children"] is JArray children)
            {
                foreach (var child in children)
                {
                    WalkSensors(child, nextPath, nextHardwareType, sensors);
                }
            }
        }

        private static void TryAddSensor(JToken sensorToken, string path, string hardwareType, List<LhmSensor> sensors)
        {
            string sensorType = sensorToken["SensorType"]?.ToString() ?? string.Empty;
            string name = sensorToken["Text"]?.ToString() ?? sensorToken["Name"]?.ToString() ?? string.Empty;
            string valueText = sensorToken["Value"]?.ToString() ?? sensorToken["value"]?.ToString() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(sensorType) || string.IsNullOrWhiteSpace(valueText))
            {
                return;
            }

            var match = Regex.Match(valueText, @"-?\d+(?:[\.,]\d+)?");
            if (!match.Success)
            {
                return;
            }

            string normalized = match.Value.Replace(',', '.');
            if (!double.TryParse(normalized, NumberStyles.Float, CultureInfo.InvariantCulture, out var value))
            {
                return;
            }

            sensors.Add(new LhmSensor(path, name, sensorType, value, hardwareType));
        }

        private static double MaxSensor(IEnumerable<LhmSensor> sensors, Func<LhmSensor, bool> predicate)
        {
            return sensors.Where(predicate).Select(s => s.Value).DefaultIfEmpty(0).Max();
        }
        private static double PickSensorByName(IEnumerable<LhmSensor> sensors, Func<LhmSensor, bool> predicate, params string[] names)
        {
            foreach (var name in names)
            {
                var match = sensors.FirstOrDefault(s => predicate(s) && s.Name.Contains(name, StringComparison.OrdinalIgnoreCase));
                if (match != null)
                {
                    return match.Value;
                }
            }
            return 0;
        }

        private static bool HasPath(LhmSensor sensor, string token)
        {
            return sensor.Path.Contains(token, StringComparison.OrdinalIgnoreCase);
        }

        private static bool HasName(LhmSensor sensor, string token)
        {
            return sensor.Name.Contains(token, StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsCpuPackageName(string name)
        {
            return name.Contains("package", StringComparison.OrdinalIgnoreCase) || name.Contains("tctl", StringComparison.OrdinalIgnoreCase) || name.Contains("tdie", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsCpuJunctionName(string name)
        {
            var lower = name.ToLowerInvariant();
            return lower.Contains("tjmax") || lower.Contains("junction") || lower.Contains("limit");
        }

        private static bool IsCpuCoreName(string name)
        {
            if (!name.Contains("core", StringComparison.OrdinalIgnoreCase)) return false;
            if (name.Contains("average", StringComparison.OrdinalIgnoreCase)) return false;
            if (name.Contains("max", StringComparison.OrdinalIgnoreCase)) return false;
            if (name.Contains("package", StringComparison.OrdinalIgnoreCase)) return false;
            return Regex.IsMatch(name, @"core\s*#?\s*\d+", RegexOptions.IgnoreCase);
        }

        private static bool IsGpuHotSpotName(string name)
        {
            return name.Contains("hot spot", StringComparison.OrdinalIgnoreCase)
                || name.Contains("hotspot", StringComparison.OrdinalIgnoreCase)
                || name.Contains("junction", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsGpuCoreName(string name)
        {
            if (IsGpuHotSpotName(name)) return false;
            var lower = name.ToLowerInvariant();
            if (lower.Contains("memory") || lower.Contains("vrm") || lower.Contains("hot") || lower.Contains("junction") || lower.Contains("edge") || lower.Contains("soc")) return false;
            return lower.Contains("core");
        }

        private static bool IsGpuTempCandidateName(string name)
        {
            if (IsGpuHotSpotName(name)) return false;
            var lower = name.ToLowerInvariant();
            if (lower.Contains("memory") || lower.Contains("vrm") || lower.Contains("hot") || lower.Contains("junction") || lower.Contains("edge") || lower.Contains("soc")) return false;
            return true;
        }
private static bool IsHardware(LhmSensor sensor, string token)
        {
            return sensor.HardwareType.Contains(token, StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsCpuSensor(LhmSensor sensor)
        {
            return IsHardware(sensor, "cpu") || HasPath(sensor, "cpu") || HasName(sensor, "cpu");
        }

        private static bool IsGpuSensor(LhmSensor sensor)
        {
            return IsHardware(sensor, "gpu") || HasPath(sensor, "gpu") || HasName(sensor, "gpu");
        }

        private static bool IsType(LhmSensor sensor, string type)
        {
            return sensor.Type.Equals(type, StringComparison.OrdinalIgnoreCase);
        }

        private void EnsureLibreHardwareMonitorRunning()
        {
            if (_lhmExePath == null)
            {
                return;
            }

            if ((DateTime.UtcNow - _lastLhmAttempt).TotalSeconds < 10)
            {
                return;
            }

            _lastLhmAttempt = DateTime.UtcNow;

            if (Process.GetProcessesByName("LibreHardwareMonitor").Length > 0)
            {
                return;
            }

            StartLibreHardwareMonitor();
        }

        private static void FillVirtualRamFromWmi(Dictionary<string, object> ram)
        {
            try
            {
                double currentUsed = Convert.ToDouble(ram.TryGetValue("VirtualUsed", out var vu) ? vu : 0);
                double currentAvail = Convert.ToDouble(ram.TryGetValue("VirtualAvailable", out var va) ? va : 0);
                if (currentUsed > 0 || currentAvail > 0)
                {
                    return;
                }

                using var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT TotalVirtualMemorySize, FreeVirtualMemory FROM Win32_OperatingSystem");
                foreach (ManagementObject obj in searcher.Get())
                {
                    double totalVirtualKb = Convert.ToDouble(obj["TotalVirtualMemorySize"] ?? 0);
                    double freeVirtualKb = Convert.ToDouble(obj["FreeVirtualMemory"] ?? 0);
                    double usedVirtualKb = Math.Max(0, totalVirtualKb - freeVirtualKb);
                    double usedGb = usedVirtualKb / (1024 * 1024);
                    double availGb = freeVirtualKb / (1024 * 1024);
                    ram["VirtualUsed"] = Math.Round(usedGb, 1);
                    ram["VirtualAvailable"] = Math.Round(availGb, 1);
                    break;
                }
            }
            catch
            {
            }
        }

        private void StartLibreHardwareMonitor()
        {
            if (_lhmExePath == null)
            {
                WriteLog("LibreHardwareMonitor.exe not found; using WMI fallback.");
                return;
            }

            try
            {
                var startInfo = new ProcessStartInfo
                {
                    FileName = _lhmExePath,
                    WorkingDirectory = Path.GetDirectoryName(_lhmExePath) ?? Environment.CurrentDirectory,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                };

                _lhmProcess = Process.Start(startInfo);
                WriteLog("LibreHardwareMonitor started.");
            }
            catch (Exception ex)
            {
                WriteLog("Failed to start LibreHardwareMonitor: " + ex);
                WriteLog("LibreHardwareMonitor requires elevation. Run it as admin or create a scheduled task to start it elevated.");
            }
        }

        private static string? FindLibreHardwareMonitorExe()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string current = baseDir;

            string localCandidate = Path.Combine(baseDir, "LibreHardwareMonitor.exe");
            if (File.Exists(localCandidate))
            {
                return localCandidate;
            }

            for (int i = 0; i < 6; i++)
            {
                string candidate = Path.Combine(current, "LibreHardware", "LibreHardwareMonitor.exe");
                if (File.Exists(candidate))
                {
                    return candidate;
                }

                var parent = Directory.GetParent(current);
                if (parent == null)
                {
                    break;
                }
                current = parent.FullName;
            }

            return null;
        }

        private object GetCpuStats()
        {
            float load = 0;
            float temp = 0;

            try
            {
                using var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT LoadPercentage FROM Win32_Processor");
                foreach (ManagementObject obj in searcher.Get())
                {
                    load = Convert.ToSingle(obj["LoadPercentage"] ?? 0);
                    break;
                }
            }
            catch { }

            try
            {
                using var searcher = new ManagementObjectSearcher("root\\WMI", "SELECT CurrentTemperature FROM MSAcpi_ThermalZoneTemperature");
                foreach (ManagementObject obj in searcher.Get())
                {
                    double kelvinTenths = Convert.ToDouble(obj["CurrentTemperature"] ?? 0);
                    temp = (float)((kelvinTenths / 10.0) - 273.15);
                    break;
                }
            }
            catch { }

            var safeTemp = temp > 0 ? Math.Round(temp, 1) : 0;
            return new Dictionary<string, object>
            {
                { "Load", Math.Min(100, load) },
                { "Temperature", safeTemp },
                { "PackageTemp", safeTemp },
                { "CoreAverage", safeTemp },
                { "CoreMax", safeTemp },
                { "Cores", new List<object>() }
            };
        }

        private object GetGpuStats()
        {
            return new Dictionary<string, object>
            {
                { "Load", 0 },
                { "Temperature", 0 },
                { "CoreTemp", 0 },
                { "HotSpot", 0 }
            };
        }
        private object GetRamStats()
        {
            float usedGb = 0;
            float availGb = 0;
            float load = 0;
            float virtualUsedGb = 0;
            float virtualAvailGb = 0;

            try
            {
                using var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT TotalVisibleMemorySize, FreePhysicalMemory, TotalVirtualMemorySize, FreeVirtualMemory FROM Win32_OperatingSystem");
                foreach (ManagementObject obj in searcher.Get())
                {
                    double totalKb = Convert.ToDouble(obj["TotalVisibleMemorySize"] ?? 0);
                    double freeKb = Convert.ToDouble(obj["FreePhysicalMemory"] ?? 0);
                    double usedKb = totalKb - freeKb;
                    usedGb = (float)(usedKb / (1024 * 1024));
                    availGb = (float)(freeKb / (1024 * 1024));
                    load = totalKb <= 0 ? 0 : (float)((usedKb / totalKb) * 100.0);

                    double totalVirtualKb = Convert.ToDouble(obj["TotalVirtualMemorySize"] ?? 0);
                    double freeVirtualKb = Convert.ToDouble(obj["FreeVirtualMemory"] ?? 0);
                    double usedVirtualKb = totalVirtualKb - freeVirtualKb;
                    virtualUsedGb = (float)(usedVirtualKb / (1024 * 1024));
                    virtualAvailGb = (float)(freeVirtualKb / (1024 * 1024));
                    break;
                }
            }
            catch { }

            return new Dictionary<string, object>
            {
                { "Load", load },
                { "Used", usedGb },
                { "Available", availGb },
                { "VirtualUsed", virtualUsedGb },
                { "VirtualAvailable", virtualAvailGb }
            };
        }

        public object GetDriveInfo()
        {
            try
            {
                return DriveInfo.GetDrives()
                    .Where(d => d.IsReady && (d.DriveType == DriveType.Fixed || d.DriveType == DriveType.Removable))
                    .Select(d => new
                    {
                        letter = d.Name.Replace("\\", ""),
                        used = (d.TotalSize - d.TotalFreeSpace) / (1024 * 1024 * 1024),
                        total = d.TotalSize / (1024 * 1024 * 1024),
                        label = string.IsNullOrEmpty(d.VolumeLabel) ? "Local Disk" : d.VolumeLabel
                    }).ToList();
            }
            catch
            {
                return new List<object>();
            }
        }

        public object GetSystemSpecs()
        {
            var specs = new Dictionary<string, object>();

            try
            {
                // Keep each WMI section isolated. A single provider failure must not blank the entire page.
                try
                {
                    using var cpuSearcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed FROM Win32_Processor");
                    foreach (ManagementObject obj in cpuSearcher.Get())
                    {
                        specs["Processor"] = obj["Name"]?.ToString() ?? "N/A";
                        specs["Cores"] = obj["NumberOfCores"]?.ToString() ?? "N/A";
                        specs["LogicalProcessors"] = obj["NumberOfLogicalProcessors"]?.ToString() ?? "N/A";
                        specs["MaxClockSpeed"] = obj["MaxClockSpeed"]?.ToString() ?? "N/A";
                        break;
                    }
                }
                catch (Exception ex) { WriteLog("System specs CPU error: " + ex.Message); }

                try
                {
                    using var boardSearcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT Manufacturer, Product FROM Win32_BaseBoard");
                    foreach (ManagementObject obj in boardSearcher.Get())
                    {
                        specs["MotherboardManufacturer"] = obj["Manufacturer"]?.ToString() ?? "N/A";
                        specs["MotherboardProduct"] = obj["Product"]?.ToString() ?? "N/A";
                        break;
                    }
                }
                catch (Exception ex) { WriteLog("System specs board error: " + ex.Message); }

                try
                {
                    using var biosSearcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT SMBIOSBIOSVersion, ReleaseDate FROM Win32_BIOS");
                    foreach (ManagementObject obj in biosSearcher.Get())
                    {
                        specs["BiosVersion"] = obj["SMBIOSBIOSVersion"]?.ToString() ?? "N/A";
                        string rawDate = obj["ReleaseDate"]?.ToString() ?? string.Empty;
                        specs["BiosDate"] = rawDate.Length >= 8
                            ? $"{rawDate.Substring(0, 4)}-{rawDate.Substring(4, 2)}-{rawDate.Substring(6, 2)}"
                            : "N/A";
                        break;
                    }
                }
                catch (Exception ex) { WriteLog("System specs BIOS error: " + ex.Message); }

                try
                {
                    using var memTotalSearcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT TotalPhysicalMemory FROM Win32_ComputerSystem");
                    foreach (ManagementObject obj in memTotalSearcher.Get())
                    {
                        if (double.TryParse(obj["TotalPhysicalMemory"]?.ToString(), out double bytes))
                        {
                            specs["MemoryTotal"] = $"{Math.Round(bytes / (1024 * 1024 * 1024), 1)} GB";
                        }
                        break;
                    }
                }
                catch (Exception ex) { WriteLog("System specs mem total error: " + ex.Message); }

                try
                {
                    var modules = new List<object>();
                    using var memModuleSearcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT BankLabel, Capacity, Speed, Manufacturer, PartNumber FROM Win32_PhysicalMemory");
                    foreach (ManagementObject obj in memModuleSearcher.Get())
                    {
                        double.TryParse(obj["Capacity"]?.ToString(), out double capacityBytes);
                        modules.Add(new
                        {
                            Bank = obj["BankLabel"]?.ToString() ?? "N/A",
                            Capacity = capacityBytes > 0 ? $"{Math.Round(capacityBytes / (1024 * 1024 * 1024), 1)} GB" : "N/A",
                            Speed = obj["Speed"]?.ToString() ?? "N/A",
                            Manufacturer = obj["Manufacturer"]?.ToString() ?? "N/A",
                            PartNumber = obj["PartNumber"]?.ToString() ?? "N/A"
                        });
                    }
                    specs["MemoryModules"] = modules;
                }
                catch (Exception ex) { WriteLog("System specs mem modules error: " + ex.Message); }

                try
                {
                    var graphicsAdapters = new List<object>();
                    using var gpuSearcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT Name, DriverVersion, AdapterRAM, VideoProcessor FROM Win32_VideoController");
                    bool firstGpuCaptured = false;
                    foreach (ManagementObject obj in gpuSearcher.Get())
                    {
                        string name = obj["Name"]?.ToString() ?? "N/A";
                        string driverVersion = obj["DriverVersion"]?.ToString() ?? "N/A";
                        string processor = obj["VideoProcessor"]?.ToString() ?? "N/A";
                        string vram = "N/A";
                        if (double.TryParse(obj["AdapterRAM"]?.ToString(), out double vramBytes))
                        {
                            vram = $"{Math.Round(vramBytes / (1024 * 1024 * 1024), 1)} GB";
                        }

                        graphicsAdapters.Add(new
                        {
                            Name = name,
                            DriverVersion = driverVersion,
                            VRAM = vram,
                            Processor = processor
                        });

                        if (!firstGpuCaptured)
                        {
                            // Keep single-GPU keys for backwards compatibility in existing UI code.
                            specs["GraphicsName"] = name;
                            specs["GraphicsDriverVersion"] = driverVersion;
                            specs["GraphicsVRAM"] = vram;
                            specs["GraphicsProcessor"] = processor;
                            firstGpuCaptured = true;
                        }
                    }
                    specs["GraphicsAdapters"] = graphicsAdapters;
                }
                catch (Exception ex) { WriteLog("System specs GPU error: " + ex.Message); }

                try
                {
                    var storageDevices = new List<object>();
                    using var diskSearcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT Model, Size, InterfaceType, MediaType, Partitions FROM Win32_DiskDrive");
                    foreach (ManagementObject obj in diskSearcher.Get())
                    {
                        double.TryParse(obj["Size"]?.ToString(), out double sizeBytes);
                        storageDevices.Add(new
                        {
                            Model = obj["Model"]?.ToString() ?? "N/A",
                            Size = sizeBytes > 0 ? $"{Math.Round(sizeBytes / (1024 * 1024 * 1024), 1)} GB" : "N/A",
                            Interface = obj["InterfaceType"]?.ToString() ?? "N/A",
                            MediaType = obj["MediaType"]?.ToString() ?? "N/A",
                            Partitions = obj["Partitions"]?.ToString() ?? "N/A"
                        });
                    }
                    specs["StorageDevices"] = storageDevices;
                }
                catch (Exception ex) { WriteLog("System specs storage error: " + ex.Message); }

                try
                {
                    var adapters = new List<object>();
                    using var netSearcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT Name, MACAddress, AdapterType, Speed, NetEnabled FROM Win32_NetworkAdapter WHERE MACAddress IS NOT NULL");
                    foreach (ManagementObject obj in netSearcher.Get())
                    {
                        string mac = obj["MACAddress"]?.ToString() ?? string.Empty;
                        string name = obj["Name"]?.ToString() ?? string.Empty;
                        if (string.IsNullOrWhiteSpace(mac)) continue;
                        if (name.StartsWith("WAN Miniport", StringComparison.OrdinalIgnoreCase)) continue;

                        adapters.Add(new
                        {
                            Name = name.Length > 0 ? name : "N/A",
                            MacAddress = mac,
                            Type = obj["AdapterType"]?.ToString() ?? "N/A",
                            Speed = obj["Speed"]?.ToString() ?? "N/A"
                        });
                    }
                    specs["NetworkAdapters"] = adapters;
                }
                catch (Exception ex) { WriteLog("System specs network error: " + ex.Message); }

                // Ensure essential keys always exist.
                if (!specs.ContainsKey("Processor")) specs["Processor"] = Environment.GetEnvironmentVariable("PROCESSOR_IDENTIFIER") ?? "N/A";
                if (!specs.ContainsKey("Cores")) specs["Cores"] = Environment.ProcessorCount.ToString();
                if (!specs.ContainsKey("LogicalProcessors")) specs["LogicalProcessors"] = Environment.ProcessorCount.ToString();
                if (!specs.ContainsKey("MaxClockSpeed")) specs["MaxClockSpeed"] = "N/A";
                if (!specs.ContainsKey("MemoryModules")) specs["MemoryModules"] = new List<object>();
                if (!specs.ContainsKey("StorageDevices")) specs["StorageDevices"] = new List<object>();
                if (!specs.ContainsKey("NetworkAdapters")) specs["NetworkAdapters"] = new List<object>();
            }
            catch (Exception ex)
            {
                WriteLog("System specs error: " + ex);
            }

            return specs;
        }

        public void Stop()
        {
            try
            {
                if (_lhmProcess != null && !_lhmProcess.HasExited)
                {
                    _lhmProcess.Kill();
                }
            }
            catch { }
        }

        private static void WriteLog(string message)
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(LogPath)!);
                File.AppendAllText(LogPath, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}{Environment.NewLine}");
            }
            catch
            {
            }
        }

        private sealed class LibSensor
        {
            public LibSensor(string path, string name, SensorType type, double value, string hardwareType)
            {
                Path = path;
                Name = name;
                Type = type;
                Value = value;
                HardwareType = hardwareType ?? string.Empty;
            }

            public string Path { get; }
            public string Name { get; }
            public SensorType Type { get; }
            public double Value { get; }
            public string HardwareType { get; }
        }

        private sealed class UpdateVisitor : IVisitor
        {
            public void VisitComputer(IComputer computer)
            {
                foreach (var hardware in computer.Hardware)
                {
                    hardware.Accept(this);
                }
            }

            public void VisitHardware(IHardware hardware)
            {
                hardware.Update();
                foreach (var subHardware in hardware.SubHardware)
                {
                    subHardware.Accept(this);
                }
            }

            public void VisitSensor(ISensor sensor) { }
            public void VisitParameter(IParameter parameter) { }
        }

        private sealed class LhmSensor
        {
            public LhmSensor(string path, string name, string type, double value, string hardwareType)
            {
                Path = path;
                Name = name;
                Type = type;
                Value = value;
                HardwareType = hardwareType ?? string.Empty;
            }

            public string Path { get; }
            public string Name { get; }
            public string Type { get; }
            public double Value { get; }
            public string HardwareType { get; }
        }
    }
}
























































