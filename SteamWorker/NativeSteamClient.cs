using System;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace SteamWorker
{
    /// <summary>
    /// Native Steam client that connects directly to steamclient64.dll via CreateSteamPipe + ConnectToGlobalUser.
    /// This is the same approach used by SAM (Steam Achievement Manager) and works for ALL games,
    /// including non-installed ones, unlike SteamAPI.Init().
    /// </summary>
    public class NativeSteamClient : IDisposable
    {
        private IntPtr _steamClientDll;
        private IntPtr _steamClient;     // ISteamClient*
        private IntPtr _steamUserStats;  // ISteamUserStats*
        private IntPtr _steamApps;       // ISteamApps*
        private ulong _steamId;          // Active Steam ID
        private int _pipe;
        private int _user;
        private bool _disposed;

        // ── steamclient64.dll export delegates ──

        [UnmanagedFunctionPointer(CallingConvention.Cdecl, CharSet = CharSet.Ansi)]
        private delegate IntPtr NativeCreateInterface(string version, IntPtr returnCode);

        [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
        [return: MarshalAs(UnmanagedType.I1)]
        private delegate bool NativeSteamBGetCallback(int pipe, ref CallbackMsg_t msg);

        [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
        private delegate void NativeSteamFreeLastCallback(int pipe);

        private NativeCreateInterface _createInterface;
        private NativeSteamBGetCallback _bGetCallback;
        private NativeSteamFreeLastCallback _freeLastCallback;

        [StructLayout(LayoutKind.Sequential)]
        private struct CallbackMsg_t
        {
            public int m_hSteamUser;
            public int m_iCallback;
            public IntPtr m_pubParam;
            public int m_cubParam;
        }

        private const int k_iUserStatsReceived = 1101;
        private const int k_iUserStatsStored = 1102;

        // ── ISteamClient vtable delegates (index matches Steamworks SDK isteamclient.h) ──

        [UnmanagedFunctionPointer(CallingConvention.ThisCall)]
        private delegate int VT_CreateSteamPipe(IntPtr self);

        [UnmanagedFunctionPointer(CallingConvention.ThisCall)]
        [return: MarshalAs(UnmanagedType.I1)]
        private delegate bool VT_BReleaseSteamPipe(IntPtr self, int pipe);

        [UnmanagedFunctionPointer(CallingConvention.ThisCall)]
        private delegate int VT_ConnectToGlobalUser(IntPtr self, int pipe);

        [UnmanagedFunctionPointer(CallingConvention.ThisCall)]
        private delegate void VT_ReleaseUser(IntPtr self, int pipe, int user);

        [UnmanagedFunctionPointer(CallingConvention.ThisCall, CharSet = CharSet.Ansi)]
        private delegate IntPtr VT_GetInterface3(IntPtr self, int user, int pipe, string version);

        // ── ISteamUserStats vtable delegates (matches SAM ISteamUserStats013 vtable) ──
        // RequestCurrentStats is NOT in the vtable - use RequestUserStats instead

        [UnmanagedFunctionPointer(CallingConvention.ThisCall)]
        private delegate ulong VT_RequestUserStats(IntPtr self, ulong steamIdUser);

        [UnmanagedFunctionPointer(CallingConvention.ThisCall)]
        private delegate uint VT_GetNumAchievements(IntPtr self);

        [UnmanagedFunctionPointer(CallingConvention.ThisCall)]
        private delegate IntPtr VT_GetAchievementName(IntPtr self, uint index);

        [UnmanagedFunctionPointer(CallingConvention.ThisCall, CharSet = CharSet.Ansi)]
        [return: MarshalAs(UnmanagedType.I1)]
        private delegate bool VT_GetAchievementAndUnlockTime(IntPtr self, string name,
            [MarshalAs(UnmanagedType.I1)] ref bool achieved, ref uint unlockTime);

        [UnmanagedFunctionPointer(CallingConvention.ThisCall, CharSet = CharSet.Ansi)]
        private delegate IntPtr VT_GetAchievementDisplayAttribute(IntPtr self, string name, string key);

        [UnmanagedFunctionPointer(CallingConvention.ThisCall, CharSet = CharSet.Ansi)]
        private delegate int VT_GetAchievementIcon(IntPtr self, string name);

        [UnmanagedFunctionPointer(CallingConvention.ThisCall, CharSet = CharSet.Ansi)]
        [return: MarshalAs(UnmanagedType.I1)]
        private delegate bool VT_SetAchievement(IntPtr self, string name);

        [UnmanagedFunctionPointer(CallingConvention.ThisCall, CharSet = CharSet.Ansi)]
        [return: MarshalAs(UnmanagedType.I1)]
        private delegate bool VT_ClearAchievement(IntPtr self, string name);

        [UnmanagedFunctionPointer(CallingConvention.ThisCall)]
        [return: MarshalAs(UnmanagedType.I1)]
        private delegate bool VT_StoreStats(IntPtr self);

        // ── ISteamApps vtable delegates ──

        [UnmanagedFunctionPointer(CallingConvention.ThisCall)]
        [return: MarshalAs(UnmanagedType.I1)]
        private delegate bool VT_BIsSubscribedApp(IntPtr self, uint appId);

        // ── kernel32 imports ──

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        private static extern IntPtr LoadLibraryEx(string path, IntPtr file, uint flags);

        [DllImport("kernel32.dll", SetLastError = true, BestFitMapping = false, ThrowOnUnmappableChar = true)]
        private static extern IntPtr GetProcAddress(IntPtr module, string name);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool FreeLibrary(IntPtr module);

        // ── Helpers ──

        private T GetVTable<T>(IntPtr iface, int index) where T : Delegate
        {
            IntPtr vtable = Marshal.ReadIntPtr(iface);
            IntPtr funcPtr = Marshal.ReadIntPtr(vtable, index * IntPtr.Size);
            return Marshal.GetDelegateForFunctionPointer<T>(funcPtr);
        }

        private static string FindSteamPath()
        {
            try
            {
                using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam"))
                {
                    string p = key?.GetValue("SteamPath")?.ToString();
                    if (!string.IsNullOrEmpty(p)) return p.Replace('/', '\\');
                }
            }
            catch { }
            try
            {
                using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\Valve\Steam"))
                {
                    string p = key?.GetValue("InstallPath")?.ToString();
                    if (!string.IsNullOrEmpty(p)) return p;
                }
            }
            catch { }
            string fallback = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Steam");
            return Directory.Exists(fallback) ? fallback : null;
        }

        // ── Public API ──

        public bool Initialize(uint appId)
        {
            string steamPath = FindSteamPath();
            if (string.IsNullOrEmpty(steamPath))
                throw new Exception("Steam installation not found.");

            // Set AppID environment variable (used by Steam internals)
            Environment.SetEnvironmentVariable("SteamAppId", appId.ToString());

            // Load steamclient64.dll directly from Steam's installation directory
            string dllPath = Path.Combine(steamPath, "steamclient64.dll");
            if (!File.Exists(dllPath))
                throw new Exception($"steamclient64.dll not found at: {dllPath}");

            _steamClientDll = LoadLibraryEx(dllPath, IntPtr.Zero, 0x00000008 /* LOAD_WITH_ALTERED_SEARCH_PATH */);
            if (_steamClientDll == IntPtr.Zero)
                throw new Exception($"Failed to load steamclient64.dll (error {Marshal.GetLastWin32Error()})");

            // Get exported functions
            IntPtr pCreateInterface = GetProcAddress(_steamClientDll, "CreateInterface");
            if (pCreateInterface == IntPtr.Zero)
                throw new Exception("CreateInterface export not found in steamclient64.dll");
            _createInterface = Marshal.GetDelegateForFunctionPointer<NativeCreateInterface>(pCreateInterface);

            IntPtr pBGetCallback = GetProcAddress(_steamClientDll, "Steam_BGetCallback");
            IntPtr pFreeCallback = GetProcAddress(_steamClientDll, "Steam_FreeLastCallback");
            if (pBGetCallback != IntPtr.Zero)
                _bGetCallback = Marshal.GetDelegateForFunctionPointer<NativeSteamBGetCallback>(pBGetCallback);
            if (pFreeCallback != IntPtr.Zero)
                _freeLastCallback = Marshal.GetDelegateForFunctionPointer<NativeSteamFreeLastCallback>(pFreeCallback);

            // Create ISteamClient interface (try multiple versions for compatibility)
            string[] clientVersions = { "SteamClient021", "SteamClient020", "SteamClient019", "SteamClient018", "SteamClient017" };
            foreach (var ver in clientVersions)
            {
                _steamClient = _createInterface(ver, IntPtr.Zero);
                if (_steamClient != IntPtr.Zero) break;
            }
            if (_steamClient == IntPtr.Zero)
                throw new Exception("Failed to create ISteamClient interface. Is Steam running?");

            // CreateSteamPipe (vtable index 0)
            _pipe = GetVTable<VT_CreateSteamPipe>(_steamClient, 0)(_steamClient);
            if (_pipe == 0)
                throw new Exception("CreateSteamPipe failed. Make sure Steam client is running and you are logged into your account.");

            // ConnectToGlobalUser (vtable index 2)
            _user = GetVTable<VT_ConnectToGlobalUser>(_steamClient, 2)(_steamClient, _pipe);
            if (_user == 0)
                throw new Exception("ConnectToGlobalUser failed. Make sure Steam is running and a user is logged in.");

            // Get active user SteamID safely from Windows Registry
            _steamId = GetActiveSteamIdFromRegistry();

            // GetISteamUserStats (vtable index 13)
            var getInterface = GetVTable<VT_GetInterface3>(_steamClient, 13);
            _steamUserStats = getInterface(_steamClient, _user, _pipe, "STEAMUSERSTATS_INTERFACE_VERSION013");
            if (_steamUserStats == IntPtr.Zero)
            {
                // Fallback to older versions if 013 is not supported (unlikely)
                string[] statsVersions = { "STEAMUSERSTATS_INTERFACE_VERSION012", "STEAMUSERSTATS_INTERFACE_VERSION011" };
                foreach (var ver in statsVersions)
                {
                    _steamUserStats = getInterface(_steamClient, _user, _pipe, ver);
                    if (_steamUserStats != IntPtr.Zero) break;
                }
            }

            // GetISteamApps (vtable index 15)
            var getApps = GetVTable<VT_GetInterface3>(_steamClient, 15);
            string[] appsVersions = { "STEAMAPPS_INTERFACE_VERSION008", "STEAMAPPS_INTERFACE_VERSION007" };
            foreach (var ver in appsVersions)
            {
                _steamApps = getApps(_steamClient, _user, _pipe, ver);
                if (_steamApps != IntPtr.Zero) break;
            }

            return _steamUserStats != IntPtr.Zero;
        }

        public bool RequestAndWaitForStats(uint appId, int timeoutMs = 5000)
        {
            if (_steamUserStats == IntPtr.Zero) return false;

            // RequestUserStats (vtable index 15) - SAM-compatible, pass SteamID by value
            ulong callHandle = GetVTable<VT_RequestUserStats>(_steamUserStats, 15)(_steamUserStats, _steamId);
            if (callHandle == 0)
            {
                // Fallback: wait and hope stats are already cached
                System.Threading.Thread.Sleep(2000);
                return true;
            }

            if (_bGetCallback == null || _freeLastCallback == null)
            {
                // No callback mechanism available, wait and hope
                System.Threading.Thread.Sleep(2000);
                return true;
            }

            var sw = System.Diagnostics.Stopwatch.StartNew();
            while (sw.ElapsedMilliseconds < timeoutMs)
            {
                var msg = new CallbackMsg_t();
                if (_bGetCallback(_pipe, ref msg))
                {
                    bool isOurs = msg.m_iCallback == k_iUserStatsReceived;
                    if (isOurs && msg.m_pubParam != IntPtr.Zero && msg.m_cubParam >= 12)
                    {
                        ulong gameId = (ulong)Marshal.ReadInt64(msg.m_pubParam, 0);
                        if ((gameId & 0xFFFFFFFF) == appId)
                        {
                            int result = Marshal.ReadInt32(msg.m_pubParam, 8);
                            _freeLastCallback(_pipe);
                            return result == 1; // k_EResultOK
                        }
                    }
                    _freeLastCallback(_pipe);
                }
                System.Threading.Thread.Sleep(50);
            }
            return false;
        }

        public uint GetNumAchievements()
        {
            if (_steamUserStats == IntPtr.Zero) return 0;
            return GetVTable<VT_GetNumAchievements>(_steamUserStats, 13)(_steamUserStats);
        }

        public string GetAchievementApiName(uint index)
        {
            if (_steamUserStats == IntPtr.Zero) return null;
            IntPtr ptr = GetVTable<VT_GetAchievementName>(_steamUserStats, 14)(_steamUserStats, index);
            return ptr != IntPtr.Zero ? Marshal.PtrToStringAnsi(ptr) : null;
        }

        public (bool achieved, uint unlockTime) GetAchievementAndUnlockTime(string name)
        {
            if (_steamUserStats == IntPtr.Zero) return (false, 0);
            bool achieved = false;
            uint unlockTime = 0;
            GetVTable<VT_GetAchievementAndUnlockTime>(_steamUserStats, 8)(_steamUserStats, name, ref achieved, ref unlockTime);
            return (achieved, unlockTime);
        }

        public string GetAchievementDisplayAttribute(string name, string key)
        {
            if (_steamUserStats == IntPtr.Zero) return null;
            IntPtr ptr = GetVTable<VT_GetAchievementDisplayAttribute>(_steamUserStats, 11)(_steamUserStats, name, key);
            return ptr != IntPtr.Zero ? Marshal.PtrToStringAnsi(ptr) : null;
        }

        public int GetAchievementIcon(string name)
        {
            if (_steamUserStats == IntPtr.Zero) return 0;
            return GetVTable<VT_GetAchievementIcon>(_steamUserStats, 10)(_steamUserStats, name);
        }

        public bool SetAchievement(string name)
        {
            if (_steamUserStats == IntPtr.Zero) return false;
            return GetVTable<VT_SetAchievement>(_steamUserStats, 6)(_steamUserStats, name);
        }

        public bool ClearAchievement(string name)
        {
            if (_steamUserStats == IntPtr.Zero) return false;
            return GetVTable<VT_ClearAchievement>(_steamUserStats, 7)(_steamUserStats, name);
        }

        public bool StoreStats()
        {
            if (_steamUserStats == IntPtr.Zero) return false;
            return GetVTable<VT_StoreStats>(_steamUserStats, 9)(_steamUserStats);
        }

        public bool StoreStatsAndWait(uint appId, int timeoutMs = 5000)
        {
            if (_steamUserStats == IntPtr.Zero) return false;

            bool ok = GetVTable<VT_StoreStats>(_steamUserStats, 9)(_steamUserStats);
            if (!ok) return false;

            if (_bGetCallback == null || _freeLastCallback == null)
            {
                System.Threading.Thread.Sleep(2000);
                return true;
            }

            var sw = System.Diagnostics.Stopwatch.StartNew();
            while (sw.ElapsedMilliseconds < timeoutMs)
            {
                var msg = new CallbackMsg_t();
                if (_bGetCallback(_pipe, ref msg))
                {
                    bool isOurs = msg.m_iCallback == k_iUserStatsStored;
                    if (isOurs && msg.m_pubParam != IntPtr.Zero && msg.m_cubParam >= 12)
                    {
                        ulong gameId = (ulong)Marshal.ReadInt64(msg.m_pubParam, 0);
                        if ((gameId & 0xFFFFFFFF) == appId)
                        {
                            int result = Marshal.ReadInt32(msg.m_pubParam, 8);
                            _freeLastCallback(_pipe);
                            return result == 1; // k_EResultOK
                        }
                    }
                    _freeLastCallback(_pipe);
                }
                System.Threading.Thread.Sleep(50);
            }
            return false;
        }

        public bool BIsSubscribedApp(uint appId)
        {
            if (_steamApps == IntPtr.Zero) return false;
            return GetVTable<VT_BIsSubscribedApp>(_steamApps, 6)(_steamApps, appId);
        }

        private static ulong GetActiveSteamIdFromRegistry()
        {
            try
            {
                using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam\ActiveProcess"))
                {
                    if (key != null)
                    {
                        var activeUserObj = key.GetValue("ActiveUser");
                        if (activeUserObj is int activeUser && activeUser > 0)
                        {
                            return 76561197960265728UL + (ulong)activeUser;
                        }
                        else if (activeUserObj is long activeUserLong && activeUserLong > 0)
                        {
                            return 76561197960265728UL + (ulong)activeUserLong;
                        }
                    }
                }
            }
            catch { }
            return 0;
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;

            try
            {
                if (_steamClient != IntPtr.Zero && _pipe != 0)
                {
                    if (_user != 0)
                    {
                        try { GetVTable<VT_ReleaseUser>(_steamClient, 4)(_steamClient, _pipe, _user); } catch { }
                    }
                    try { GetVTable<VT_BReleaseSteamPipe>(_steamClient, 1)(_steamClient, _pipe); } catch { }
                }
            }
            catch { }

            // Note: We intentionally do NOT call FreeLibrary on steamclient64.dll
            // because Steam's internal state may still reference it.
        }
    }
}
