using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Microsoft.Win32;

namespace TFY.Services
{
    public class FortniteConfigService
    {
        private string GetConfigPath()
        {
            var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            return Path.Combine(localAppData, "FortniteGame", "Saved", "Config", "WindowsClient", "GameUserSettings.ini");
        }

        public FortniteConfigObj GetCurrentConfig()
        {
            var config = new FortniteConfigObj();
            var path = GetConfigPath();

            if (File.Exists(path))
            {
                var content = File.ReadAllText(path);

                config.ResolutionX = ExtractValue(content, "ResolutionSizeX", "1920");
                config.ResolutionY = ExtractValue(content, "ResolutionSizeY", "1080");
                config.FpsLimit = ExtractValue(content, "FrameRateLimit", "0");
                config.ReflexMode = ExtractValue(content, "LowLatencyMode", "0");
                config.AudioQuality = ExtractValue(content, "AudioQualityLevel", "1");
                config.RenderingMode = GetRenderingMode(content);

                // Additional Checkboxes
                config.EnableFullscreen = ExtractValue(content, "FullscreenMode", "1") == "0";
                config.DisableMotionBlur = ExtractValue(content, "bMotionBlur", "True").Equals("False", StringComparison.OrdinalIgnoreCase);
                config.DisableGrass = ExtractValue(content, "bShowGrass", "True").Equals("False", StringComparison.OrdinalIgnoreCase);
                config.ShowFps = ExtractValue(content, "bShowFPS", "False").Equals("True", StringComparison.OrdinalIgnoreCase);
                config.DisableAntiAliasing = ExtractValue(content, "sg.AntiAliasingQuality", "3") == "0";
                config.SetCustomSuperResQuality = ExtractValue(content, "sg.ResolutionQuality", "100") != "100";
                config.SetDlssQuality0 = ExtractValue(content, "DLSSQuality", "2") == "0" || ExtractValue(content, "bUseDLSS", "True").Equals("False", StringComparison.OrdinalIgnoreCase);
                config.SetGlobalIllumination0 = ExtractValue(content, "sg.GlobalIlluminationQuality", "3") == "0";
                config.SetReflection0 = ExtractValue(content, "sg.ReflectionQuality", "3") == "0";
                config.DisableRayTracing = ExtractValue(content, "bRayTracing", "True").Equals("False", StringComparison.OrdinalIgnoreCase);
                config.DisableEnergySaver = ExtractValue(content, "bEnableEnergySaving", "True").Equals("False", StringComparison.OrdinalIgnoreCase);
                config.DisableMouseAcceleration = ExtractValue(content, "bDisableMouseAcceleration", "False").Equals("True", StringComparison.OrdinalIgnoreCase);
                config.DisableVsync = ExtractValue(content, "bUseVSync", "True").Equals("False", StringComparison.OrdinalIgnoreCase);
                config.SetViewDistance0 = ExtractValue(content, "sg.ViewDistanceQuality", "3") == "0";
                config.SetShadow0 = ExtractValue(content, "sg.ShadowQuality", "3") == "0";
                config.SetTexture0 = ExtractValue(content, "sg.TextureQuality", "3") == "0";
                config.SetEffects0 = ExtractValue(content, "sg.EffectsQuality", "3") == "0";
                config.SetFoliage0 = ExtractValue(content, "sg.FoliageQuality", "3") == "0";
                config.SetShading0 = ExtractValue(content, "sg.ShadingQuality", "3") == "0";

                config.RawIniContent = content;
                config.IsInstalled = true;
            }
            else
            {
                config.IsInstalled = false;
            }

            config.ExePath = GetSavedExePath();
            if (!string.IsNullOrEmpty(config.ExePath) && File.Exists(config.ExePath))
            {
                config.DisableFullscreenOptimizations = CheckFullscreenOptimizations(config.ExePath);
            }

            return config;
        }

        public bool SaveConfig(FortniteConfigObj config)
        {
            var path = GetConfigPath();
            if (!File.Exists(path))
            {
                try
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(path));
                    File.WriteAllText(path, "[/Script/FortniteGame.FortGameUserSettings]\n");
                }
                catch { return false; }
            }

            try
            {
                var content = File.ReadAllText(path);

                content = UpdateOrAddValue(content, "ResolutionSizeX", config.ResolutionX);
                content = UpdateOrAddValue(content, "ResolutionSizeY", config.ResolutionY);
                content = UpdateOrAddValue(content, "LastUserConfirmedResolutionSizeX", config.ResolutionX);
                content = UpdateOrAddValue(content, "LastUserConfirmedResolutionSizeY", config.ResolutionY);
                content = UpdateOrAddValue(content, "FrameRateLimit", config.FpsLimit);
                content = UpdateOrAddValue(content, "LowLatencyMode", config.ReflexMode);
                content = UpdateOrAddValue(content, "AudioQualityLevel", config.AudioQuality);

                // Rendering Mode
                content = SetRenderingMode(content, config.RenderingMode);

                // Additional Checkboxes
                content = UpdateOrAddValue(content, "FullscreenMode", config.EnableFullscreen ? "0" : "1");
                content = UpdateOrAddValue(content, "LastConfirmedFullscreenMode", config.EnableFullscreen ? "0" : "1");
                content = UpdateOrAddValue(content, "PreferredFullscreenMode", config.EnableFullscreen ? "0" : "1");
                content = UpdateOrAddValue(content, "bMotionBlur", config.DisableMotionBlur ? "False" : "True");
                content = UpdateOrAddValue(content, "bShowGrass", config.DisableGrass ? "False" : "True");
                content = UpdateOrAddValue(content, "bShowFPS", config.ShowFps ? "True" : "False");
                content = UpdateOrAddValue(content, "sg.AntiAliasingQuality", config.DisableAntiAliasing ? "0" : "3");
                
                if (config.SetDlssQuality0)
                {
                    content = UpdateOrAddValue(content, "DLSSQuality", "0");
                    content = UpdateOrAddValue(content, "bUseDLSS", "False");
                }
                else
                {
                    content = UpdateOrAddValue(content, "DLSSQuality", "2");
                    content = UpdateOrAddValue(content, "bUseDLSS", "True");
                }

                content = UpdateOrAddValue(content, "sg.GlobalIlluminationQuality", config.SetGlobalIllumination0 ? "0" : "3");
                content = UpdateOrAddValue(content, "sg.ReflectionQuality", config.SetReflection0 ? "0" : "3");
                content = UpdateOrAddValue(content, "bRayTracing", config.DisableRayTracing ? "False" : "True");
                content = UpdateOrAddValue(content, "bDisableMouseAcceleration", config.DisableMouseAcceleration ? "True" : "False");
                content = UpdateOrAddValue(content, "bUseVSync", config.DisableVsync ? "False" : "True");
                content = UpdateOrAddValue(content, "sg.ViewDistanceQuality", config.SetViewDistance0 ? "0" : "3");
                content = UpdateOrAddValue(content, "sg.ShadowQuality", config.SetShadow0 ? "0" : "3");
                content = UpdateOrAddValue(content, "sg.TextureQuality", config.SetTexture0 ? "0" : "3");
                content = UpdateOrAddValue(content, "sg.EffectsQuality", config.SetEffects0 ? "0" : "3");
                content = UpdateOrAddValue(content, "sg.FoliageQuality", config.SetFoliage0 ? "0" : "3");
                content = UpdateOrAddValue(content, "sg.ShadingQuality", config.SetShading0 ? "0" : "3");

                File.WriteAllText(path, content);

                // Exe Config
                if (!string.IsNullOrEmpty(config.ExePath))
                {
                    SaveExePath(config.ExePath);
                    SetFullscreenOptimizations(config.ExePath, config.DisableFullscreenOptimizations);
                }

                return true;
            }
            catch
            {
                return false;
            }
        }

        public bool ApplyRawIni(string content)
        {
            var path = GetConfigPath();
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                File.WriteAllText(path, content);
                return true;
            }
            catch
            {
                return false;
            }
        }

        private string ExtractValue(string content, string key, string def)
        {
            var match = Regex.Match(content, $@"^{key}=(.*)$", RegexOptions.Multiline);
            return match.Success ? match.Groups[1].Value.Trim() : def;
        }

        private string UpdateOrAddValue(string content, string key, string val)
        {
            if (Regex.IsMatch(content, $@"^{key}=.*$", RegexOptions.Multiline))
            {
                return Regex.Replace(content, $@"^{key}=.*$", $"{key}={val}", RegexOptions.Multiline);
            }
            else
            {
                // Appends under proper section
                string targetSection = "[/Script/FortniteGame.FortGameUserSettings]";
                if (key.StartsWith("sg.")) targetSection = "[ScalabilityGroups]";
                else if (key == "PreferredRHI" || key == "PreferredFeatureLevel") targetSection = "[D3DRHIPreference]";
                
                if (content.Contains(targetSection))
                {
                    var regex = new Regex($@"({Regex.Escape(targetSection)}\r?\n)");
                    return regex.Replace(content, $"$1{key}={val}\n", 1);
                }
                else
                {
                    return content + $"\n{targetSection}\n{key}={val}\n";
                }
            }
        }

        private string GetRenderingMode(string content)
        {
            // PreferredFeatureLevel=es31 means Performance Mode (highest priority check)
            var preferredFeatureLevel = ExtractValue(content, "PreferredFeatureLevel", "");
            var preferredRhi = ExtractValue(content, "PreferredRHI", "");
            var preferD3D12 = ExtractValue(content, "bPreferD3D12InGame", "False");
            var targetRhi = ExtractValue(content, "TargetedRHIName", "");
            
            // Performance Mode: es31 feature level is the definitive indicator
            if (preferredFeatureLevel.Equals("es31", StringComparison.OrdinalIgnoreCase)) return "performance";
            // Legacy Mode
            if (preferredRhi.Equals("legacy", StringComparison.OrdinalIgnoreCase) || targetRhi.Equals("Legacy", StringComparison.OrdinalIgnoreCase)) return "legacy";
            // DX12
            if (preferredRhi.Equals("dx12", StringComparison.OrdinalIgnoreCase) || preferD3D12.Equals("True", StringComparison.OrdinalIgnoreCase)) return "dx12";
            // Performance via TargetedRHIName
            if (targetRhi.Equals("Performance", StringComparison.OrdinalIgnoreCase) || targetRhi.Equals("PerformanceMode", StringComparison.OrdinalIgnoreCase)) return "performance";
            return "dx11";
        }

        private string SetRenderingMode(string content, string mode)
        {
            if (mode == "dx12")
            {
                content = UpdateOrAddValue(content, "bPreferD3D12InGame", "True");
                content = UpdateOrAddValue(content, "TargetedRHIName", "Default");
                content = UpdateOrAddValue(content, "PreferredRHI", "dx12");
                content = UpdateOrAddValue(content, "PreferredFeatureLevel", "sm6"); // DX12 uses SM6
            }
            else if (mode == "performance")
            {
                content = UpdateOrAddValue(content, "bPreferD3D12InGame", "False");
                content = UpdateOrAddValue(content, "TargetedRHIName", "Performance");
                content = UpdateOrAddValue(content, "PreferredRHI", "dx12"); // stays dx12 key but es31 level
                content = UpdateOrAddValue(content, "PreferredFeatureLevel", "es31"); // Performance Mode marker
            }
            else if (mode == "legacy")
            {
                content = UpdateOrAddValue(content, "bPreferD3D12InGame", "False");
                content = UpdateOrAddValue(content, "TargetedRHIName", "Legacy");
                content = UpdateOrAddValue(content, "PreferredRHI", "legacy");
                content = UpdateOrAddValue(content, "PreferredFeatureLevel", "sm5"); // Legacy uses SM5 / DX11
            }
            else // dx11
            {
                content = UpdateOrAddValue(content, "bPreferD3D12InGame", "False");
                content = UpdateOrAddValue(content, "TargetedRHIName", "Default");
                content = UpdateOrAddValue(content, "PreferredRHI", "dx11");
                content = UpdateOrAddValue(content, "PreferredFeatureLevel", "sm5"); // DX11 = SM5
            }
            return content;
        }

        private string GetSavedExePath()
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(@"Software\TFY");
                var saved = key?.GetValue("FortniteExePath") as string;
                if (!string.IsNullOrEmpty(saved) && File.Exists(saved))
                {
                    return saved;
                }
            }
            catch { }

            // Auto-detect from Epic Games Manifests
            try
            {
                var programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
                var manifestsPath = Path.Combine(programData, "Epic", "EpicGamesLauncher", "Data", "Manifests");
                
                if (Directory.Exists(manifestsPath))
                {
                    var files = Directory.GetFiles(manifestsPath, "*.item");
                    foreach (var file in files)
                    {
                        var content = File.ReadAllText(file);
                        if (content.Contains("\"AppName\": \"Fortnite\""))
                        {
                            var match = Regex.Match(content, @"\""InstallLocation\"":\s*\""([^\""]+)\""");
                            if (match.Success)
                            {
                                var installDir = match.Groups[1].Value.Replace("\\\\", "\\");
                                var exePath = Path.Combine(installDir, "FortniteGame", "Binaries", "Win64", "FortniteClient-Win64-Shipping.exe");
                                if (File.Exists(exePath))
                                {
                                    SaveExePath(exePath); // Save it for next time
                                    return exePath;
                                }
                            }
                        }
                    }
                }
            }
            catch { }

            return "";
        }

        private void SaveExePath(string path)
        {
            try
            {
                using var key = Registry.CurrentUser.CreateSubKey(@"Software\TFY");
                key.SetValue("FortniteExePath", path);
            }
            catch { }
        }

        private bool CheckFullscreenOptimizations(string path)
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers");
                if (key != null)
                {
                    var val = key.GetValue(path) as string;
                    return val != null && val.Contains("DISABLEDXMAXIMIZEDWINDOWEDMODE");
                }
            }
            catch { }
            return false;
        }

        private void SetFullscreenOptimizations(string path, bool disable)
        {
            try
            {
                using var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers");
                var currentVal = key.GetValue(path) as string ?? "~";
                
                if (disable && !currentVal.Contains("DISABLEDXMAXIMIZEDWINDOWEDMODE"))
                {
                    currentVal += " DISABLEDXMAXIMIZEDWINDOWEDMODE";
                    key.SetValue(path, currentVal.Trim());
                }
                else if (!disable && currentVal.Contains("DISABLEDXMAXIMIZEDWINDOWEDMODE"))
                {
                    currentVal = currentVal.Replace("DISABLEDXMAXIMIZEDWINDOWEDMODE", "").Trim();
                    if (currentVal == "~" || string.IsNullOrEmpty(currentVal))
                    {
                        key.DeleteValue(path, false);
                    }
                    else
                    {
                        key.SetValue(path, currentVal);
                    }
                }
            }
            catch { }
        }
    }

    public class FortniteConfigObj
    {
        public bool IsInstalled { get; set; }
        public string RenderingMode { get; set; } = "dx11";
        public string ReflexMode { get; set; } = "0";
        public string ResolutionX { get; set; } = "1920";
        public string ResolutionY { get; set; } = "1080";
        public string FpsLimit { get; set; } = "0";
        public string AudioQuality { get; set; } = "1";
        
        public bool EnableFullscreen { get; set; }
        public bool DisableMotionBlur { get; set; }
        public bool DisableGrass { get; set; }
        public bool ShowFps { get; set; }
        public bool DisableAntiAliasing { get; set; }
        public bool SetCustomSuperResQuality { get; set; }
        public bool SetDlssQuality0 { get; set; }
        public bool SetGlobalIllumination0 { get; set; }
        public bool SetReflection0 { get; set; }
        public bool DisableRayTracing { get; set; }
        public bool DisableEnergySaver { get; set; }
        public bool DisableMouseAcceleration { get; set; }
        public bool DisableVsync { get; set; }
        public bool SetViewDistance0 { get; set; }
        public bool SetShadow0 { get; set; }
        public bool SetTexture0 { get; set; }
        public bool SetEffects0 { get; set; }
        public bool SetFoliage0 { get; set; }
        public bool SetShading0 { get; set; }

        public string ExePath { get; set; } = string.Empty;
        public bool DisableFullscreenOptimizations { get; set; }
        public string RawIniContent { get; set; } = string.Empty;
    }
}
