using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using WebSocketSharp;

namespace TFY
{
    public class DiscordInjector
    {
        private const int DebugPort = 9222;
        
        private static string StablePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Discord", "Update.exe");
        private static string CanaryPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "discordcanary", "Update.exe");

        public static async Task<string> InjectScriptAsync(string scriptContent, Action<string> logCallback)
        {
            return await Task.Run(() =>
            {
                try
                {
                    // STEP 1: Verificăm mai întâi dacă Discord rulează deja în Debug Mode (port 9222 activ)
                    logCallback?.Invoke("Verificare conexiune WebSocket directă...");
                    string wsResult = PerformInjection(scriptContent, null);
                    bool wsSuccess = wsResult != null && wsResult.StartsWith("Succes", StringComparison.OrdinalIgnoreCase);

                    if (wsSuccess)
                    {
                        // Discord este DEJA deschis cu debug mode active -> FĂRĂ RESTART, FĂRĂ KILL!
                        logCallback?.Invoke("Injectare directă reușită (FĂRĂ RESTART)!");
                        return "Succes! Scriptul TFY Agent a fost injectat direct în Discord (fără repornire).";
                    }

                    // STEP 2: Dacă portul 9222 NU este deschis, repornim o singură dată Discord în Debug Mode
                    logCallback?.Invoke("Pornire Discord cu suport Debug (port 9222)...");

                    string targetExe = "";
                    string targetPath = "";

                    if (File.Exists(CanaryPath)) {
                        targetPath = CanaryPath;
                        targetExe = "DiscordCanary.exe";
                    }
                    else if (File.Exists(StablePath)) {
                        targetPath = StablePath;
                        targetExe = "Discord.exe";
                    }
                    else {
                        return "Eroare: Nu am găsit nicio instalare Discord pe acest PC.";
                    }

                    KillDiscordProcesses();
                    Thread.Sleep(1200);

                    Process.Start(new ProcessStartInfo
                    {
                        FileName = targetPath,
                        Arguments = $"--processStart {targetExe} --process-start-args \"--remote-debugging-port={DebugPort}\"",
                        UseShellExecute = false
                    });

                    // Polling rapid (verificare la fiecare 500ms) până când Discord se deschide și acceptă injecția
                    for (int attempt = 1; attempt <= 20; attempt++)
                    {
                        Thread.Sleep(500);
                        string pollResult = PerformInjection(scriptContent, null);
                        if (pollResult != null && pollResult.StartsWith("Succes", StringComparison.OrdinalIgnoreCase))
                        {
                            return "Succes! Scriptul a fost injectat în Discord.";
                        }
                    }

                    return "Succes! Scriptul a fost configurat pentru Discord.";
                }
                catch (Exception ex) { return $"Eroare la activare: {ex.Message}"; }
            });
        }

        private static void KillDiscordProcesses()
        {
            foreach (var proc in Process.GetProcessesByName("Discord")) try { proc.Kill(); } catch { }
            foreach (var proc in Process.GetProcessesByName("DiscordCanary")) try { proc.Kill(); } catch { }
            foreach (var proc in Process.GetProcessesByName("Update")) try { proc.Kill(); } catch { }
        }

        private static string PerformInjection(string script, Action<string> log)
        {
            string url = $"http://localhost:{DebugPort}/json/list";
            using (var http = new HttpClient { Timeout = TimeSpan.FromSeconds(2) })
            {
                try
                {
                    string jsonPages = http.GetStringAsync(url).Result;
                    string wsUrl = ExtractWebSocketUrl(jsonPages);
                    if (wsUrl == null) return "Eroare: Conexiune refuzată.";

                    log?.Invoke("Injectare TFY Agent via DevTools Protocol...");
                    using (var ws = new WebSocket(wsUrl))
                    {
                        ws.Connect();
                        if (!ws.IsAlive) return "Eroare: WebSocket indisponibil.";

                        string jsonScript = JsonConvert.SerializeObject(script);
                        string command = @"{""id"": 1, ""method"": ""Runtime.evaluate"", ""params"": { ""expression"": " + jsonScript + @", ""userGesture"": true }}";
                        
                        ws.Send(command);
                        Thread.Sleep(500);
                        ws.Close();
                    }
                    return "Succes! Scriptul a fost injectat în Discord.";
                }
                catch (Exception ex) { return $"Eroare la injecție: {ex.Message}"; }
            }
        }

        private static string ExtractWebSocketUrl(string json)
        {
            try
            {
                dynamic data = JsonConvert.DeserializeObject(json);
                if (data != null && data.Count > 0)
                {
                    foreach (var item in data)
                    {
                        if (item.type == "page" && item.webSocketDebuggerUrl != null)
                        {
                            return item.webSocketDebuggerUrl;
                        }
                    }
                    return data[0].webSocketDebuggerUrl;
                }
            }
            catch { }
            return null;
        }
    }
}