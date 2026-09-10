using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace TFY.Services
{
    public class DiscordAuthService
    {
        private const string ClientId = "1465554212770545728";
        private const string RedirectUri = "http://127.0.0.1:8743/callback/";
        private const string Scope = "identify guilds.members.read";

        public const string OfficialGuildId = "935948883119460432";
        public const string OwnerUserId = "328152058869972994";

        private static readonly string TokenPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "TFY",
            "discord.json");

        private static readonly string LogPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "TFY",
            "boot.log");
        public const string DeveloperRoleId = "1324496746574905347";
        public const string TesterRoleId = "1469669066024157234";
        public const string PremiumRoleId = "1465913284644311161";

        private readonly HttpClient _httpClient = new HttpClient();

        public async Task<DiscordState> GetStateAsync()
        {
            var state = await LoadStateAsync();
            if (state?.Token != null)
            {
                try
                {
                    if (state.Token.ExpiresAtUtc <= DateTime.UtcNow)
                    {
                        var refreshed = await RefreshTokenAsync(state.Token.RefreshToken);
                        if (refreshed == null)
                        {
                            if (state.User != null)
                            {
                                var cachedRoles = state.Roles != null && state.Roles.Count > 0
                                    ? state.Roles
                                    : await ResolveMemberRolesAsync(state.User.Id, state.Token?.AccessToken);
                                return new DiscordState
                                {
                                    Connected = true,
                                    UserId = state.User.Id,
                                    Username = state.User.DisplayName,
                                    AvatarUrl = state.User.AvatarUrl,
                                    Roles = cachedRoles,
                                    Tier = ResolveTier(cachedRoles)
                                };
                            }
                            return new DiscordState { Connected = false };
                        }

                        state.Token = refreshed;
                        await SaveStateAsync(state);
                    }

                    if (state.User == null)
                    {
                        var user = await FetchUserAsync(state.Token.AccessToken);
                        if (user != null)
                        {
                            state.User = user;
                            await SaveStateAsync(state);
                        }
                    }

                    if (state.User != null)
                    {
                        var roles = await ResolveMemberRolesAsync(state.User.Id, state.Token?.AccessToken);
                        state.Roles = roles;
                        state.Tier = ResolveTier(roles);
                        await SaveStateAsync(state);

                        return new DiscordState
                        {
                            Connected = true,
                            UserId = state.User.Id,
                            Username = state.User.DisplayName,
                            AvatarUrl = state.User.AvatarUrl,
                            Roles = roles,
                            Tier = state.Tier
                        };
                    }
                }
                catch (Exception ex)
                {
                    WriteLog("Discord auth refresh failed: " + ex.Message);
                }
            }

            return new DiscordState { Connected = false };
        }

        public DiscordState GetCachedState()
        {
            try
            {
                if (!File.Exists(TokenPath)) return new DiscordState { Connected = false };
                string json = File.ReadAllText(TokenPath);
                var state = JsonConvert.DeserializeObject<DiscordPersistedState>(json);
                if (state?.User != null)
                {
                    var roles = state.Roles ?? new List<string>();
                    if (state.User.Id == OwnerUserId && !roles.Contains(DeveloperRoleId))
                    {
                        roles.Add(DeveloperRoleId);
                    }
                    var tier = state.Tier ?? ResolveTier(roles);
                    return new DiscordState
                    {
                        Connected = true,
                        UserId = state.User.Id,
                        Username = state.User.DisplayName,
                        AvatarUrl = state.User.AvatarUrl,
                        Roles = roles,
                        Tier = tier
                    };
                }
            }
            catch { }
            return new DiscordState { Connected = false };
        }

        public async Task<DiscordState> LoginAsync(string theme = "jade")
        {
            string verifier = GenerateCodeVerifier();
            string challenge = GenerateCodeChallenge(verifier);
            string authUrl =
                "https://discord.com/oauth2/authorize" +
                $"?client_id={Uri.EscapeDataString(ClientId)}" +
                $"&response_type=code" +
                $"&redirect_uri={Uri.EscapeDataString(RedirectUri)}" +
                $"&scope={Uri.EscapeDataString(Scope)}" +
                $"&code_challenge={Uri.EscapeDataString(challenge)}" +
                $"&code_challenge_method=S256";

            string code = await ListenForCodeAsync(authUrl, theme);
            if (string.IsNullOrWhiteSpace(code))
            {
                WriteLog("Discord login cancelled or timed out.");
                return new DiscordState { Connected = false };
            }

            var token = await ExchangeCodeAsync(code, verifier);
            var user = await FetchUserAsync(token.AccessToken);

            var loginRoles = await ResolveMemberRolesAsync(user.Id, token.AccessToken);
            var loginTier = ResolveTier(loginRoles);

            var state = new DiscordPersistedState
            {
                Token = token,
                User = user,
                Roles = loginRoles,
                Tier = loginTier
            };
            await SaveStateAsync(state);

            return new DiscordState
            {
                Connected = true,
                UserId = user.Id,
                Username = user.DisplayName,
                AvatarUrl = user.AvatarUrl,
                Roles = loginRoles,
                Tier = loginTier
            };
        }

        public async Task LogoutAsync()
        {
            try
            {
                if (File.Exists(TokenPath))
                {
                    File.Delete(TokenPath);
                }
            }
            catch (Exception ex)
            {
                WriteLog("Discord logout failed: " + ex.Message);
            }

            await Task.CompletedTask;
        }

        private async Task<List<string>> ResolveMemberRolesAsync(string userId, string? accessToken = null)
        {
            var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            // 1. Owner bypass
            if (userId == OwnerUserId)
            {
                roles.Add(DeveloperRoleId);
            }

            // 2. Direct Discord User OAuth Member API with accessToken (guilds.members.read scope)
            if (!string.IsNullOrWhiteSpace(accessToken))
            {
                try
                {
                    using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(3.5));
                    var req = new HttpRequestMessage(HttpMethod.Get, $"https://discord.com/api/users/@me/guilds/{OfficialGuildId}/member");
                    req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
                    var res = await _httpClient.SendAsync(req, cts.Token);
                    if (res.IsSuccessStatusCode)
                    {
                        var json = await res.Content.ReadAsStringAsync();
                        dynamic member = JsonConvert.DeserializeObject<dynamic>(json);
                        if (member?.roles != null)
                        {
                            foreach (var r in member.roles)
                            {
                                string v = r?.ToString();
                                if (!string.IsNullOrWhiteSpace(v)) roles.Add(v);
                            }
                        }
                    }
                }
                catch { }
            }

            // 3. Discord Bot API if configured
            string? botToken = Environment.GetEnvironmentVariable("TFY_DISCORD_BOT_TOKEN");
            string guildId = Environment.GetEnvironmentVariable("TFY_DISCORD_GUILD_ID") ?? OfficialGuildId;
            if (!string.IsNullOrWhiteSpace(botToken) && !string.IsNullOrWhiteSpace(userId))
            {
                try
                {
                    using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(3.5));
                    var req = new HttpRequestMessage(HttpMethod.Get, $"https://discord.com/api/guilds/{guildId}/members/{userId}");
                    req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bot", botToken);
                    var res = await _httpClient.SendAsync(req, cts.Token);
                    if (res.IsSuccessStatusCode)
                    {
                        var json = await res.Content.ReadAsStringAsync();
                        dynamic member = JsonConvert.DeserializeObject<dynamic>(json);
                        if (member?.roles != null)
                        {
                            foreach (var r in member.roles)
                            {
                                string v = r?.ToString();
                                if (!string.IsNullOrWhiteSpace(v)) roles.Add(v);
                            }
                        }
                    }
                }
                catch { }
            }

            // 4. Remote role APIs (Cloudflare worker & local bot)
            if (roles.Count == 0 || (userId == OwnerUserId && roles.Count == 1))
            {
                var apiRoles = await ResolveRolesFromRoleApiAsync(userId);
                foreach (var ar in apiRoles) roles.Add(ar);
            }

            // Ensure owner always has DeveloperRoleId
            if (userId == OwnerUserId)
            {
                roles.Add(DeveloperRoleId);
            }

            return new List<string>(roles);
        }

        private async Task<List<string>> ResolveRolesFromRoleApiAsync(string userId)
        {
            var roles = new List<string>();
            if (string.IsNullOrWhiteSpace(userId)) return roles;

            var endpoints = new List<string>();
            var envApi = Environment.GetEnvironmentVariable("TFY_PREMIUM_API");
            if (!string.IsNullOrWhiteSpace(envApi)) endpoints.Add(envApi);
            endpoints.Add("https://tfy-api.vi9lomister.workers.dev/check-roles");
            endpoints.Add("http://127.0.0.1:11874/check-roles");
            endpoints.Add("http://127.0.0.1:8787/check-roles");

            var body = new StringContent(JsonConvert.SerializeObject(new { userId }), Encoding.UTF8, "application/json");

            foreach (var ep in endpoints)
            {
                try
                {
                    using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(2.5));
                    var response = await _httpClient.PostAsync(ep, body, cts.Token);
                    if (response.IsSuccessStatusCode)
                    {
                        var json = await response.Content.ReadAsStringAsync();
                        dynamic data = JsonConvert.DeserializeObject<dynamic>(json);
                        if (data?.hasDeveloper == true) roles.Add(DeveloperRoleId);
                        if (data?.hasTesting == true) roles.Add(TesterRoleId);
                        if (data?.hasPremium == true || data?.hasRole == true || data?.premium == true) roles.Add(PremiumRoleId);
                        if (roles.Count > 0) break;
                    }
                }
                catch { }
            }

            return roles;
        }

        private string ResolveTier(List<string> roles)
        {
            if (roles.Contains(DeveloperRoleId)) return "Developer";
            if (roles.Contains(TesterRoleId)) return "Tester App";
            if (roles.Contains(PremiumRoleId)) return "Premium User";
            return "Free User";
        }

        private async Task<string> ListenForCodeAsync(string url, string theme)
        {
            var colors = theme switch
            {
                "midnight" => ("#6366f1", "99,102,241"),
                "slate" => ("#0ea5e9", "14,165,233"),
                "sunset" => ("#f97316", "249,115,22"),
                "red" => ("#ef4444", "239,68,68"),
                "pink" => ("#ec4899", "236,72,153"),
                _ => ("#10b981", "16,185,129") // jade
            };
            string accentHex = colors.Item1;
            string accentRgba = colors.Item2;

            using var listener = new HttpListener();
            listener.Prefixes.Add("http://127.0.0.1:8743/callback/");
            listener.Start();

            OpenBrowser(url);

            var contextTask = listener.GetContextAsync();
            var completed = await Task.WhenAny(contextTask, Task.Delay(TimeSpan.FromMinutes(2)));
            if (completed != contextTask)
            {
                listener.Stop();
                return string.Empty;
            }

            var context = contextTask.Result;
            string code = context.Request.QueryString["code"] ?? string.Empty;

            string responseHtml = $@"<!doctype html>
<html>
<head>
<meta charset='utf-8'/>
<meta name='viewport' content='width=device-width,initial-scale=1'/>
<style>
:root{{--bg:#050608;--accent:{accentHex};--accent2:{accentHex};--card:rgba(10,14,18,.12);--border:rgba(255,255,255,.08);}} 
*{{box-sizing:border-box;font-family:'Segoe UI Variable','Segoe UI',system-ui,sans-serif;}}
html,body{{width:100%;height:100%;margin:0;}}
body{{display:flex;align-items:center;justify-content:center;background:
radial-gradient(circle at 15% 20%,rgba({accentRgba},.10),transparent 60%),
radial-gradient(circle at 80% 85%,rgba({accentRgba},.08),transparent 60%),
linear-gradient(180deg,#040608 0%, #06090c 100%);
color:#e6eef5;}}
.card{{position:relative;background:var(--card);border:1px solid var(--border);border-radius:18px;padding:26px 38px;min-width:320px;text-align:center;backdrop-filter:blur(44px);-webkit-backdrop-filter:blur(44px);box-shadow:0 24px 70px rgba(0,0,0,.55), inset 0 0 0 1px rgba({accentRgba},.15);}} 
.kicker{{font-size:11px;letter-spacing:.35em;text-transform:uppercase;color:#9aa3b2;margin-bottom:10px;}}
.title{{font-size:20px;font-weight:600;margin:0 0 6px;color:#f8fafc;}}
.sub{{font-size:13px;opacity:.75;margin:0;}}
</style>
</head>
<body>
  <div class='card'>
    <div class='kicker'>TFY Utility Hub</div>
    <div class='title'>Login Successful!</div>
    <div class='sub'>You can close this tab and return to the app.</div>
  </div>
</body>
</html>";
            byte[] buffer = Encoding.UTF8.GetBytes(responseHtml);
            context.Response.ContentLength64 = buffer.Length;
            await context.Response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
            context.Response.OutputStream.Close();
            listener.Stop();

            return code;
        }

        private async Task<DiscordToken> ExchangeCodeAsync(string code, string verifier)
        {
            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                { "client_id", ClientId },
                { "grant_type", "authorization_code" },
                { "code", code },
                { "redirect_uri", RedirectUri },
                { "code_verifier", verifier }
            });

            var response = await _httpClient.PostAsync("https://discord.com/api/oauth2/token", content);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync();
            var token = JsonConvert.DeserializeObject<DiscordToken>(json) ?? throw new Exception("Token parse failed");
            token.ExpiresAtUtc = DateTime.UtcNow.AddSeconds(token.ExpiresIn - 60);
            return token;
        }

        private async Task<DiscordToken?> RefreshTokenAsync(string refreshToken)
        {
            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                { "client_id", ClientId },
                { "grant_type", "refresh_token" },
                { "refresh_token", refreshToken }
            });

            var response = await _httpClient.PostAsync("https://discord.com/api/oauth2/token", content);
            if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.BadRequest)
            {
                WriteLog("Discord refresh returned unauthorized/bad request. Keeping stored token.");
                return null;
            }

            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync();
            var token = JsonConvert.DeserializeObject<DiscordToken>(json) ?? throw new Exception("Token parse failed");
            token.ExpiresAtUtc = DateTime.UtcNow.AddSeconds(token.ExpiresIn - 60);
            return token;
        }

        private async Task<DiscordUser?> FetchUserAsync(string accessToken)
        {
            var request = new HttpRequestMessage(HttpMethod.Get, "https://discord.com/api/users/@me");
            request.Headers.Add("Authorization", $"Bearer {accessToken}");
            var response = await _httpClient.SendAsync(request);
            if (response.StatusCode == HttpStatusCode.Unauthorized)
            {
                WriteLog("Discord /users/@me unauthorized.");
                return null;
            }

            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync();
            var raw = JsonConvert.DeserializeObject<DiscordUserRaw>(json) ?? new DiscordUserRaw();
            return new DiscordUser
            {
                Id = raw.Id ?? string.Empty,
                Username = raw.Username ?? string.Empty,
                GlobalName = raw.GlobalName ?? string.Empty,
                Avatar = raw.Avatar ?? string.Empty
            };
        }

        private async Task<DiscordPersistedState?> LoadStateAsync()
        {
            try
            {
                if (!File.Exists(TokenPath)) return null;
                string json = await File.ReadAllTextAsync(TokenPath);
                return JsonConvert.DeserializeObject<DiscordPersistedState>(json);
            }
            catch
            {
                return null;
            }
        }

        private async Task SaveStateAsync(DiscordPersistedState state)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(TokenPath)!);
            string json = JsonConvert.SerializeObject(state, Formatting.Indented);
            await File.WriteAllTextAsync(TokenPath, json);
        }

        private static void OpenBrowser(string url)
        {
            var psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = url,
                UseShellExecute = true
            };
            System.Diagnostics.Process.Start(psi);
        }

        private static string GenerateCodeVerifier()
        {
            byte[] bytes = new byte[32];
            RandomNumberGenerator.Fill(bytes);
            return Base64UrlEncode(bytes);
        }

        private static string GenerateCodeChallenge(string verifier)
        {
            byte[] bytes = SHA256.HashData(Encoding.ASCII.GetBytes(verifier));
            return Base64UrlEncode(bytes);
        }

        private static string Base64UrlEncode(byte[] bytes)
        {
            return Convert.ToBase64String(bytes)
                .Replace("+", "-")
                .Replace("/", "_")
                .Replace("=", "");
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
    }

    public class DiscordToken
    {
        [JsonProperty("access_token")]
        public string AccessToken { get; set; } = string.Empty;

        [JsonProperty("token_type")]
        public string TokenType { get; set; } = string.Empty;

        [JsonProperty("expires_in")]
        public int ExpiresIn { get; set; }

        [JsonProperty("refresh_token")]
        public string RefreshToken { get; set; } = string.Empty;

        [JsonIgnore]
        public DateTime ExpiresAtUtc { get; set; }
    }

    public class DiscordUserRaw
    {
        [JsonProperty("id")]
        public string? Id { get; set; }

        [JsonProperty("username")]
        public string? Username { get; set; }

        [JsonProperty("global_name")]
        public string? GlobalName { get; set; }

        [JsonProperty("avatar")]
        public string? Avatar { get; set; }
    }

    public class DiscordUser
    {
        public string Id { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string GlobalName { get; set; } = string.Empty;
        public string Avatar { get; set; } = string.Empty;

        [JsonIgnore]
        public string DisplayName => string.IsNullOrWhiteSpace(GlobalName) ? Username : GlobalName;

        [JsonIgnore]
        public string AvatarUrl
        {
            get
            {
                if (!string.IsNullOrWhiteSpace(Avatar) && !string.IsNullOrWhiteSpace(Id))
                {
                    return $"https://cdn.discordapp.com/avatars/{Id}/{Avatar}.png?size=128";
                }

                if (!string.IsNullOrWhiteSpace(Id) && ulong.TryParse(Id, out var snowflake))
                {
                    var index = (int)(snowflake % 5);
                    return $"https://cdn.discordapp.com/embed/avatars/{index}.png";
                }

                return "";
            }
        }
    }

    public class DiscordPersistedState
    {
        public DiscordToken? Token { get; set; }
        public DiscordUser? User { get; set; }
        public List<string> Roles { get; set; } = new List<string>();
        public string? Tier { get; set; }
    }

    public class DiscordState
    {
        public bool Connected { get; set; }
        public string? UserId { get; set; }
        public string? Username { get; set; }
        public string? AvatarUrl { get; set; }
        public List<string> Roles { get; set; } = new List<string>();
        public string? Tier { get; set; }
    }
}















