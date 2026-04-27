using System;
using Microsoft.Win32;

namespace TFY.Services
{
    public class SystemTweaksService
    {
        private static readonly RegistryKey TfyRegistry = Registry.CurrentUser.CreateSubKey(@"Software\TFY", RegistryKeyPermissionCheck.ReadWriteSubTree);

        public static bool CheckTweakState(string tweakName, int defaultValue = 0)
        {
            try
            {
                object value = TfyRegistry?.GetValue(tweakName);
                if (value == null) return defaultValue == 1;
                return ((int)value) == 1;
            }
            catch { return defaultValue == 1; }
        }

        public static bool DetectTweakState(string tweakName)
        {
            return tweakName switch
            {
                "tsWiFi" => DetectWiFiDisabled(),
                "tsBluetooth" => DetectBluetoothDisabled(),
                "tsVPN" => DetectVPNDisabled(),
                "tsPrefetch" => DetectPrefetchDisabled(),
                "tsHyperV" => DetectHyperVDisabled(),
                "tsPrintSpooler" => DetectPrintSpoolerDisabled(),
                "tsFSOGamebar" => DetectFSOGamebarDisabled(),
                "tsNotifications" => DetectNotificationsDisabled(),
                "tsAnimations" => DetectAnimationsDisabled(),
                "tsLockScreen" => DetectLockScreenDisabled(),
                "tsStartMenu" => DetectStartMenuDisabled(),
                "tsUAC" => DetectUACDisabled(),
                "tsNoLazyMode" => DetectNoLazyModeEnabled(),
                "tsNTFSEncryption" => DetectNTFSEncryptionDisabled(),
                "tsIntelTSX" => DetectIntelTSXEnabled(),
                "tsDEP" => DetectDEPDisabled(),
                "tsLargeSystemCache" => DetectLargeSystemCacheEnabled(),
                _ => false
            };
        }

        public static bool DetectWiFiDisabled()
        {
            try
            {
                object value = Registry.GetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\WlanSvc", "Start", null);
                return value != null && ((int)value) == 4;
            }
            catch { return false; }
        }

        public static bool DetectBluetoothDisabled()
        {
            try
            {
                object value = Registry.GetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\BthA4dp", "Start", null);
                return value != null && ((int)value) == 4;
            }
            catch { return false; }
        }

        public static bool DetectVPNDisabled()
        {
            try
            {
                object value = Registry.GetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\IKEEXT", "Start", null);
                return value != null && ((int)value) == 4;
            }
            catch { return false; }
        }

        public static bool DetectPrefetchDisabled()
        {
            try
            {
                object value = Registry.GetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\SysMain", "Start", null);
                return value != null && ((int)value) == 4;
            }
            catch { return false; }
        }

        public static bool DetectHyperVDisabled()
        {
            try
            {
                object value = Registry.GetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\nvspwmi", "Start", null);
                return value != null && ((int)value) == 4;
            }
            catch { return false; }
        }

        public static bool DetectPrintSpoolerDisabled()
        {
            try
            {
                object value = Registry.GetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\Spooler", "Start", null);
                return value != null && ((int)value) == 4;
            }
            catch { return false; }
        }

        public static bool DetectFSOGamebarDisabled()
        {
            try
            {
                object value = Registry.GetValue(@"HKEY_CURRENT_USER\Software\Microsoft\GameBar", "ShowStartupPanel", null);
                return value != null && ((int)value) == 0;
            }
            catch { return false; }
        }

        public static bool DetectNotificationsDisabled()
        {
            try
            {
                object value = Registry.GetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\WpnService", "Start", null);
                return value != null && ((int)value) == 4;
            }
            catch { return false; }
        }

        public static bool DetectAnimationsDisabled()
        {
            try
            {
                object value = Registry.GetValue("HKEY_CURRENT_USER\\Control Panel\\Desktop", "MenuShowDelay", null);
                return value != null && value.ToString() == "0";
            }
            catch { return false; }
        }

        public static bool DetectLockScreenDisabled()
        {
            try
            {
                object value = Registry.GetValue("HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Windows\\Personalization", "NoLockScreen", null);
                return value != null && ((int)value) == 1;
            }
            catch { return false; }
        }

        public static bool DetectStartMenuDisabled()
        {
            try
            {
                object value = Registry.GetValue("HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced", "Start_ShowStartPanel", null);
                return value != null && ((int)value) == 0;
            }
            catch { return false; }
        }

        public static bool DetectUACDisabled()
        {
            try
            {
                object value = Registry.GetValue("HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System", "EnableLUA", null);
                return value != null && ((int)value) == 0;
            }
            catch { return false; }
        }

        public static bool DetectNoLazyModeEnabled()
        {
            try
            {
                object value = Registry.GetValue("HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile", "NoLazyMode", null);
                return value != null && ((int)value) == 1;
            }
            catch { return false; }
        }

        public static bool DetectNTFSEncryptionDisabled()
        {
            try
            {
                object value = Registry.GetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Policies", "NtfsDisableEncryption", null);
                return value != null && ((int)value) == 1;
            }
            catch { return false; }
        }

        public static bool DetectIntelTSXEnabled()
        {
            try
            {
                object value = Registry.GetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\ControlSet001\\Control\\Session Manager\\kernel", "DisableTsx", null);
                return value != null && ((int)value) == 0;
            }
            catch { return false; }
        }

        public static bool DetectDEPDisabled()
        {
            try
            {
                object value = TfyRegistry?.GetValue("DisableNX");
                return value != null && ((int)value) == 1;
            }
            catch { return false; }
        }

        public static bool DetectLargeSystemCacheEnabled()
        {
            try
            {
                object value = Registry.GetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management", "LargeSystemCache", null);
                return value != null && ((int)value) == 1;
            }
            catch { return false; }
        }

        public static bool ToggleWiFi(bool disable)
        {
            try
            {
                if (disable)
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\WlanSvc", "Start", 4, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\vwififlt", "Start", 4, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\netprofm", "Start", 4, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\NlaSvc", "Start", 4, RegistryValueKind.DWord);
                    TfyRegistry?.SetValue("DisableWiFi", 1);
                }
                else
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\WlanSvc", "Start", 2, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\vwififlt", "Start", 1, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\netprofm", "Start", 3, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\NlaSvc", "Start", 2, RegistryValueKind.DWord);
                    TfyRegistry?.DeleteValue("DisableWiFi");
                }
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"ToggleWiFi error: {ex.Message}");
                return false;
            }
        }

        public static bool ToggleBluetooth(bool disable)
        {
            try
            {
                int value = disable ? 4 : 3;
                Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\BthA4dp", "Start", value, RegistryValueKind.DWord);
                Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\BthEnum", "Start", value, RegistryValueKind.DWord);
                Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\BthHFEnum", "Start", value, RegistryValueKind.DWord);
                Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\BthLEEnum", "Start", value, RegistryValueKind.DWord);
                Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\BTHMODEM", "Start", value, RegistryValueKind.DWord);
                Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\BluetoothUserService", "Start", value, RegistryValueKind.DWord);
                Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\BthAvctpSvc", "Start", value, RegistryValueKind.DWord);
                Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\RFCOMM", "Start", value, RegistryValueKind.DWord);
                Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\bthserv", "Start", value, RegistryValueKind.DWord);
                Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\BTAGService", "Start", value, RegistryValueKind.DWord);
                Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\BTHUSB", "Start", value, RegistryValueKind.DWord);
                Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\BTHPORT", "Start", value, RegistryValueKind.DWord);
                Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\BthMini", "Start", value, RegistryValueKind.DWord);
                Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\HidBth", "Start", value, RegistryValueKind.DWord);
                TfyRegistry?.SetValue("DisableBluetooth", disable ? 1 : 0);
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"ToggleBluetooth error: {ex.Message}");
                return false;
            }
        }

        public static bool ToggleVPN(bool disable)
        {
            try
            {
                if (disable)
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\IKEEXT", "Start", 4, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\RasMan", "Start", 4, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\SstpSvc", "Start", 4, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\Eaphost", "Start", 4, RegistryValueKind.DWord);
                    TfyRegistry?.SetValue("DisableVPN", 1);
                }
                else
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\IKEEXT", "Start", 3, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\RasMan", "Start", 3, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\SstpSvc", "Start", 3, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\Eaphost", "Start", 3, RegistryValueKind.DWord);
                    TfyRegistry?.DeleteValue("DisableVPN");
                }
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"ToggleVPN error: {ex.Message}");
                return false;
            }
        }

        public static bool TogglePrefetch(bool disable)
        {
            try
            {
                if (disable)
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\SysMain", "Start", 4, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\FontCache", "Start", 4, RegistryValueKind.DWord);
                    TfyRegistry?.SetValue("DisablePrefetch", 1);
                }
                else
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\SysMain", "Start", 2, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\FontCache", "Start", 2, RegistryValueKind.DWord);
                    TfyRegistry?.DeleteValue("DisablePrefetch");
                }
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"TogglePrefetch error: {ex.Message}");
                return false;
            }
        }

        public static bool ToggleHyperV(bool disable)
        {
            try
            {
                if (disable)
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\nvspwmi", "Start", 4, RegistryValueKind.DWord);
                    TfyRegistry?.SetValue("DisableHyperV", 1);
                }
                else
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\nvspwmi", "Start", 3, RegistryValueKind.DWord);
                    TfyRegistry?.DeleteValue("DisableHyperV");
                }
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"ToggleHyperV error: {ex.Message}");
                return false;
            }
        }

        public static bool TogglePrintSpooler(bool disable)
        {
            try
            {
                Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\Spooler", "Start", 
                    disable ? 4 : 2, RegistryValueKind.DWord);
                TfyRegistry?.SetValue("DisablePrinter", disable ? 1 : 0);
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"TogglePrintSpooler error: {ex.Message}");
                return false;
            }
        }

        public static bool DisableFSOGamebar(bool disable)
        {
            try
            {
                if (disable)
                {
                    Registry.SetValue(@"HKEY_CURRENT_USER\Software\Microsoft\GameBar", "ShowStartupPanel", 0, RegistryValueKind.DWord);
                    Registry.SetValue(@"HKEY_CURRENT_USER\Software\Microsoft\GameBar", "AllowAutoGameMode", 0, RegistryValueKind.DWord);
                    Registry.SetValue(@"HKEY_CURRENT_USER\System\GameConfigStore", "GameDVR_Enabled", 0, RegistryValueKind.DWord);
                    TfyRegistry?.SetValue("DisableFSO", 1);
                }
                else
                {
                    Registry.SetValue(@"HKEY_CURRENT_USER\System\GameConfigStore", "GameDVR_Enabled", 0, RegistryValueKind.DWord);
                    TfyRegistry?.DeleteValue("DisableFSO");
                }
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"DisableFSOGamebar error: {ex.Message}");
                return false;
            }
        }

        public static bool DisableNotifications(bool disable)
        {
            try
            {
                if (disable)
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\WpnService", "Start", 4, RegistryValueKind.DWord);
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\PushNotifications", "ToastEnabled", 0, RegistryValueKind.DWord);
                    TfyRegistry?.SetValue("DisableNotifications", 1);
                }
                else
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\WpnService", "Start", 2, RegistryValueKind.DWord);
                    TfyRegistry?.DeleteValue("DisableNotifications");
                }
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"DisableNotifications error: {ex.Message}");
                return false;
            }
        }

        public static bool DisableAnimations(bool disable)
        {
            try
            {
                if (disable)
                {
                    Registry.SetValue("HKEY_CURRENT_USER\\Control Panel\\Desktop", "MenuShowDelay", "0", RegistryValueKind.String);
                    TfyRegistry?.SetValue("DisableAnimations", 1);
                }
                else
                {
                    Registry.SetValue("HKEY_CURRENT_USER\\Control Panel\\Desktop", "MenuShowDelay", "400", RegistryValueKind.String);
                    TfyRegistry?.DeleteValue("DisableAnimations");
                }
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"DisableAnimations error: {ex.Message}");
                return false;
            }
        }

        public static bool DisableLockScreen(bool disable)
        {
            try
            {
                if (disable)
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Windows\\Personalization", "NoLockScreen", 1, RegistryValueKind.DWord);
                    TfyRegistry?.SetValue("DisableLockScreen", 1);
                }
                else
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Windows\\Personalization", "NoLockScreen", 0, RegistryValueKind.DWord);
                    TfyRegistry?.DeleteValue("DisableLockScreen");
                }
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"DisableLockScreen error: {ex.Message}");
                return false;
            }
        }

        public static bool DisableStartMenu(bool disable)
        {
            try
            {
                if (disable)
                {
                    Registry.SetValue("HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced", "Start_ShowStartPanel", 0, RegistryValueKind.DWord);
                    TfyRegistry?.SetValue("DisableStartmenu", 1);
                }
                else
                {
                    Registry.SetValue("HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced", "Start_ShowStartPanel", 1, RegistryValueKind.DWord);
                    TfyRegistry?.DeleteValue("DisableStartmenu");
                }
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"DisableStartMenu error: {ex.Message}");
                return false;
            }
        }

        public static bool DisableUAC(bool disable)
        {
            try
            {
                if (disable)
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System", "EnableLUA", 0, RegistryValueKind.DWord);
                    TfyRegistry?.SetValue("EnableUAC", 0);
                }
                else
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System", "EnableLUA", 1, RegistryValueKind.DWord);
                    TfyRegistry?.DeleteValue("EnableUAC");
                }
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"DisableUAC error: {ex.Message}");
                return false;
            }
        }

        public static bool EnableNoLazyMode(bool enable)
        {
            try
            {
                if (enable)
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile", "NoLazyMode", 1, RegistryValueKind.DWord);
                    TfyRegistry?.SetValue("NoLazyMode", 1);
                }
                else
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile", "NoLazyMode", 0, RegistryValueKind.DWord);
                    TfyRegistry?.DeleteValue("NoLazyMode");
                }
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"EnableNoLazyMode error: {ex.Message}");
                return false;
            }
        }

        public static bool DisableNTFSEncryption(bool disable)
        {
            try
            {
                if (disable)
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Policies", "NtfsDisableEncryption", 1, RegistryValueKind.DWord);
                    TfyRegistry?.SetValue("DisableNTFSEncryption", 1);
                }
                else
                {
                    TfyRegistry?.DeleteValue("DisableNTFSEncryption");
                }
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"DisableNTFSEncryption error: {ex.Message}");
                return false;
            }
        }

        public static bool EnableIntelTSX(bool enable)
        {
            try
            {
                if (enable)
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\ControlSet001\\Control\\Session Manager\\kernel", "DisableTsx", 0, RegistryValueKind.DWord);
                    TfyRegistry?.SetValue("EnableTSX", 1);
                }
                else
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\ControlSet001\\Control\\Session Manager\\kernel", "DisableTsx", 1, RegistryValueKind.DWord);
                    TfyRegistry?.DeleteValue("EnableTSX");
                }
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"EnableIntelTSX error: {ex.Message}");
                return false;
            }
        }

        public static bool DisableDEP(bool disable)
        {
            try
            {
                TfyRegistry?.SetValue("DisableNX", disable ? 1 : 0);
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"DisableDEP error: {ex.Message}");
                return false;
            }
        }

        public static bool EnableLargeSystemCache(bool enable)
        {
            try
            {
                if (enable)
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management", "LargeSystemCache", 1, RegistryValueKind.DWord);
                    TfyRegistry?.SetValue("EnableLargeSystemCache", 1);
                }
                else
                {
                    Registry.SetValue("HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management", "LargeSystemCache", 0, RegistryValueKind.DWord);
                    TfyRegistry?.DeleteValue("EnableLargeSystemCache");
                }
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"EnableLargeSystemCache error: {ex.Message}");
                return false;
            }
        }
    }
}
