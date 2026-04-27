using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Gameloop.Vdf;
using Gameloop.Vdf.Linq;

namespace TFY.Services
{
    internal static class VdfExtensions
    {
        internal static VToken GetChild(this VToken token, string key)
        {
            try
            {
                if (token is VObject vo && vo.ContainsKey(key)) return vo[key];
                if (token is VProperty vp && vp.Value is VObject o && o.ContainsKey(key)) return o[key];
                return null;
            }
            catch { return null; }
        }
    }

    public static class SteamCmdHelper
    {
        private static string _directoryPath;
        private static string DirectoryPath => _directoryPath ??= Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "TFY", "SteamCmd");

        private static string SteamCmdExe => Path.Combine(DirectoryPath, "steamcmd.exe");
        private static readonly HttpClient HttpClient = new HttpClient() { Timeout = TimeSpan.FromMinutes(5) };

        public static async Task<bool> EnsureSteamCmdAsync()
        {
            if (File.Exists(SteamCmdExe))
                return true;
            try
            {
                Directory.CreateDirectory(DirectoryPath);
                string zipPath = Path.Combine(DirectoryPath, "steamcmd.zip");
                if (!File.Exists(zipPath))
                {
                    byte[] bytes = await HttpClient.GetByteArrayAsync(
                        new Uri("https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip"));
                    await File.WriteAllBytesAsync(zipPath, bytes);
                }
                ZipFile.ExtractToDirectory(zipPath, DirectoryPath);
                try { File.Delete(zipPath); } catch { }
                return File.Exists(SteamCmdExe);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("SteamCMD ensure failed: " + ex.Message);
                return false;
            }
        }

        public static async Task<List<string>> GetDlcAppIdsAsync(string appId)
        {
            if (!File.Exists(SteamCmdExe))
                return new List<string>();
            var dlcIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                string output = await RunSteamCmdAppInfoAsync(appId);
                if (string.IsNullOrWhiteSpace(output)) return dlcIds.ToList();
                int openBrace = output.IndexOf('{');
                int closeBrace = output.LastIndexOf('}');
                if (openBrace < 0 || closeBrace <= openBrace) return dlcIds.ToList();
                string vdfBlock = "\"" + appId + "\"\n" + output.Substring(openBrace, closeBrace - openBrace + 1);
                var parsed = VdfConvert.Deserialize(vdfBlock);
                if (parsed?.Value is not VObject root) return dlcIds.ToList();
                VToken extended = root.GetChild("extended");
                if (extended is VObject extObj)
                {
                    VToken listofdlc = extObj.GetChild("listofdlc");
                    if (listofdlc != null)
                    {
                        string list = listofdlc.ToString().Trim('"');
                        foreach (string id in list.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries))
                            if (int.TryParse(id.Trim(), out int n) && n > 0)
                                dlcIds.Add(id.Trim());
                    }
                }
                VToken depots = root.GetChild("depots");
                if (depots is VObject depObj)
                {
                    foreach (var child in depObj.Children().OfType<VProperty>())
                    {
                        if (child.Value is VObject depotObj)
                        {
                            VToken dlcAppId = depotObj.GetChild("dlcappid");
                            if (dlcAppId != null && int.TryParse(dlcAppId.ToString().Trim('"'), out int n) && n > 0)
                                dlcIds.Add(dlcAppId.ToString().Trim('"'));
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("GetDlcAppIds failed: " + ex.Message);
            }
            return dlcIds.ToList();
        }

        private static async Task<string> RunSteamCmdAppInfoAsync(string appId)
        {
            var sb = new StringBuilder();
            var psi = new ProcessStartInfo
            {
                FileName = SteamCmdExe,
                Arguments = $"+@ShutdownOnFailedCommand 0 +force_install_dir \"{DirectoryPath}\" +login anonymous +app_info_print {appId} +quit",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            };
            using (var process = Process.Start(psi))
            {
                if (process == null) return null;
                process.OutputDataReceived += (_, e) => { if (e.Data != null) sb.AppendLine(e.Data); };
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
                await process.WaitForExitAsync();
            }
            return sb.ToString();
        }
    }
}
