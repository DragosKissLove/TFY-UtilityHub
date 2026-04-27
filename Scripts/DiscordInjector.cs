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
        
        // Căi pentru ambele versiuni
        private static string StablePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Discord", "Update.exe");
        private static string CanaryPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "discordcanary", "Update.exe");

        public static async Task<string> InjectScriptAsync(string scriptContent, Action<string> logCallback)
        {
            return await Task.Run(() =>
            {
                try
                {
                    string targetExe = "";
                    string targetPath = "";

                    // Detectăm automat ce e instalat (Canary are prioritate dacă există ambele)
                    if (File.Exists(CanaryPath)) {
                        targetPath = CanaryPath;
                        targetExe = "DiscordCanary.exe";
                        logCallback?.Invoke("Detectat: Discord Canary");
                    }
                    else if (File.Exists(StablePath)) {
                        targetPath = StablePath;
                        targetExe = "Discord.exe";
                        logCallback?.Invoke("Detectat: Discord Stable");
                    }
                    else {
                        return "Eroare: Nu am găsit nici Discord Stable, nici Canary instalat.";
                    }

                    logCallback?.Invoke("Oprire procese Discord vechi...");
                    KillDiscordProcesses();
                    Thread.Sleep(2500);

                    logCallback?.Invoke("Pornire Discord (Debug Mode)...");
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = targetPath,
                        Arguments = $"--processStart {targetExe} --process-start-args \"--remote-debugging-port={DebugPort}\"",
                        UseShellExecute = false
                    });

                    logCallback?.Invoke("Așteptare inițializare (15 secunde)...");
                    Thread.Sleep(15000);

                    return PerformInjection(scriptContent, logCallback);
                }
                catch (Exception ex) { return $"Eroare critică: {ex.Message}"; }
            });
        }

        private static void KillDiscordProcesses()
        {
            // Oprim toate variantele pentru a curăța portul 9222
            foreach (var proc in Process.GetProcessesByName("Discord")) try { proc.Kill(); } catch { }
            foreach (var proc in Process.GetProcessesByName("DiscordCanary")) try { proc.Kill(); } catch { }
            foreach (var proc in Process.GetProcessesByName("Update")) try { proc.Kill(); } catch { }
        }

        private static string PerformInjection(string script, Action<string> log)
        {
            string url = $"http://localhost:{DebugPort}/json/list";
            using (var http = new HttpClient())
            {
                try
                {
                    string jsonPages = http.GetStringAsync(url).Result;
                    string wsUrl = ExtractWebSocketUrl(jsonPages);
                    if (wsUrl == null) return "Eroare: Conexiune refuzată. Încearcă din nou.";

                    log?.Invoke("Injectare TFY Agent...");
                    using (var ws = new WebSocket(wsUrl))
                    {
                        ws.Connect();
                        if (!ws.IsAlive) return "Eroare: WebSocket indisponibil.";

                        string jsonScript = JsonConvert.SerializeObject(script);
                        string command = @"{""id"": 1, ""method"": ""Runtime.evaluate"", ""params"": { ""expression"": " + jsonScript + @", ""userGesture"": true }}";
                        
                        ws.Send(command);
                        Thread.Sleep(1000);
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
                if (data != null && data.Count > 0) return data[0].webSocketDebuggerUrl;
            }
            catch { }
            return null;
        }
    }
}