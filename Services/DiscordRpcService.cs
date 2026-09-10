using System;
using System.IO;
using DiscordRPC;
using DiscordRPC.Logging;

namespace TFY.Services
{
    public class DiscordRpcService
    {
        private DiscordRpcClient _client;
        private bool _isEnabled = true;
        private string _currentState = "Using TFY Utility Hub";
        private const string AppId = "1465554212770545728";

        private static readonly string SettingsPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "TFY",
            "rpc_enabled.txt");

        public DiscordRpcService()
        {
            if (File.Exists(SettingsPath))
            {
                var content = File.ReadAllText(SettingsPath).Trim();
                _isEnabled = (content == "1" || content.ToLower() == "true");
            }
            
            InitializeClient();
        }

        private void InitializeClient()
        {
            if (!_isEnabled) return;

            try
            {
                var logPath = SettingsPath + ".log";
                try { File.WriteAllText(logPath, $"[Start] Initializing RPC Client with AppId {AppId} at {DateTime.Now}\n"); } catch { }

                _client = new DiscordRpcClient(AppId)
                {
                    Logger = new ConsoleLogger { Level = DiscordRPC.Logging.LogLevel.Warning }
                };

                _client.OnReady += (sender, e) => {
                    try { File.AppendAllText(logPath, $"[Ready] Connection established. User: {e.User.Username} ({e.User.ID})\n"); } catch { }
                    UpdatePresence(_currentState);
                };

                _client.OnError += (sender, e) => {
                    try { File.AppendAllText(logPath, $"[Error] Code: {e.Code}, Message: {e.Message}\n"); } catch { }
                };

                _client.OnPresenceUpdate += (sender, e) => {
                    var richPres = e.Presence as RichPresence;
                    var buttonsCount = richPres?.Buttons?.Length ?? 0;
                    try { File.AppendAllText(logPath, $"[PresenceUpdate] Details: {e.Presence.Details}, State: {e.Presence.State}, ButtonsCount: {buttonsCount}\n"); } catch { }
                };

                _client.Initialize();
                UpdatePresence(_currentState);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[RPC] Failed to initialize: {ex.Message}");
                try { File.AppendAllText(SettingsPath + ".log", $"[InitException] {ex.Message}\n{ex.StackTrace}\n"); } catch { }
            }
        }

        public void SetEnabled(bool enabled)
        {
            _isEnabled = enabled;
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(SettingsPath)!);
                File.WriteAllText(SettingsPath, enabled ? "1" : "0");
            }
            catch { }

            if (enabled)
            {
                if (_client == null || _client.IsDisposed)
                {
                    InitializeClient();
                }
                else
                {
                    UpdatePresence(_currentState);
                }
            }
            else
            {
                if (_client != null)
                {
                    _client.ClearPresence();
                    _client.Dispose();
                    _client = null;
                }
            }
        }

        public bool IsEnabled() => _isEnabled;

        private string GetAppVersion()
        {
            try
            {
                var version = System.Reflection.Assembly.GetExecutingAssembly().GetName().Version;
                if (version != null && version.Major > 0)
                {
                    return $"{version.Major}.{version.Minor}.{version.Build}";
                }
            }
            catch { }
            return "6.3.2";
        }

        public void UpdatePresence(string details)
        {
            _currentState = details;

            var logPath = SettingsPath + ".log";
            try { File.AppendAllText(logPath, $"[UpdatePresence] Called with details: '{details}'\n"); } catch { }

            if (!_isEnabled || _client == null || _client.IsDisposed)
            {
                try { File.AppendAllText(logPath, $"[UpdatePresence] Skipped: IsEnabled={_isEnabled}, ClientNull={_client == null}, IsDisposed={_client?.IsDisposed}\n"); } catch { }
                return;
            }

            try
            {
                _client.SetPresence(new RichPresence()
                {
                    Details = details,
                    State = $"v{GetAppVersion()} Stable Release",
                    Assets = new Assets()
                    {
                        LargeImageKey = "icon",
                        LargeImageText = "TFY Utility Hub"
                    },
                    Buttons = new Button[]
                    {
                        new Button()
                        {
                            Label = "Get The App",
                            Url = "https://github.com/DragosKissLove/TFY-UtilityHub-Releases/releases/latest"
                        }
                    },
                    Timestamps = Timestamps.Now
                });
                try { File.AppendAllText(logPath, $"[UpdatePresence] SetPresence called successfully for version {GetAppVersion()}\n"); } catch { }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[RPC] Failed to update presence: {ex.Message}");
                try { File.AppendAllText(logPath, $"[UpdatePresenceException] {ex.Message}\n{ex.StackTrace}\n"); } catch { }
            }
        }

        public void Deinitialize()
        {
            if (_client != null)
            {
                _client.Dispose();
                _client = null;
            }
        }
    }
}
