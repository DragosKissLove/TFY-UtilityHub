using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Text.Json;
using System.Threading.Tasks;

namespace TFY.Services
{
    public class MediaDownloaderService
    {
        private static readonly string AppDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "TFY", "engine");
        private static readonly string YtDlpPath = Path.Combine(AppDataFolder, "yt-dlp.exe");
        private static readonly string FfmpegPath = Path.Combine(AppDataFolder, "ffmpeg.exe");

        public bool IsEngineInstalled()
        {
            return File.Exists(YtDlpPath) && File.Exists(FfmpegPath);
        }

        public async Task InstallEngineAsync(Action<int> progressCallback)
        {
            Directory.CreateDirectory(AppDataFolder);

            using var httpClient = new HttpClient();
            httpClient.Timeout = TimeSpan.FromMinutes(10);
            
            // 1. Download yt-dlp.exe
            progressCallback?.Invoke(10);
            await DownloadFileAsync(httpClient, "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe", YtDlpPath);
            progressCallback?.Invoke(40);

            // 2. Download ffmpeg.zip (using the much smaller 6.0 essentials build, 85MB vs 220MB)
            string ffmpegZipPath = Path.Combine(AppDataFolder, "ffmpeg.zip");
            await DownloadFileAsync(httpClient, "https://github.com/GyanD/codexffmpeg/releases/download/6.0/ffmpeg-6.0-essentials_build.zip", ffmpegZipPath);
            progressCallback?.Invoke(80);

            // 3. Extract ffmpeg.exe
            await Task.Run(() =>
            {
                using var archive = ZipFile.OpenRead(ffmpegZipPath);
                foreach (var entry in archive.Entries)
                {
                    if (entry.FullName.EndsWith("bin/ffmpeg.exe", StringComparison.OrdinalIgnoreCase))
                    {
                        entry.ExtractToFile(FfmpegPath, true);
                        break;
                    }
                }
            });

            // Cleanup zip
            if (File.Exists(ffmpegZipPath)) File.Delete(ffmpegZipPath);

            // 4. Download spotdl.exe (optional, best-effort)
            try
            {
                string spotDlPath = Path.Combine(AppDataFolder, "spotdl.exe");
                await DownloadFileAsync(httpClient, "https://github.com/spotDL/spotify-downloader/releases/download/v4.4.4/spotdl-4.4.4-win32.exe", spotDlPath);
            }
            catch { /* spotdl is optional */ }

            progressCallback?.Invoke(100);
        }

        private async Task DownloadFileAsync(HttpClient client, string url, string destPath)
        {
            var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
            response.EnsureSuccessStatusCode();

            using var stream = await response.Content.ReadAsStreamAsync();
            using var fileStream = new FileStream(destPath, FileMode.Create, FileAccess.Write, FileShare.None, 8192, true);
            await stream.CopyToAsync(fileStream);
        }

        public async Task DownloadMediaAsync(string url, string format, string outputPath, bool isPlaylist, Action<int> progressCallback)
        {
            if (!IsEngineInstalled())
            {
                throw new Exception("Media engine is not installed.");
            }

            string args;
            string executable = YtDlpPath;
            string albumArtUrl = null; // Will hold the square album art URL from Odesli

            bool isUrl = Uri.TryCreate(url, UriKind.Absolute, out var uriResult) && (uriResult.Scheme == Uri.UriSchemeHttp || uriResult.Scheme == Uri.UriSchemeHttps);
            bool isSpotify = isUrl && url.Contains("spotify.com", StringComparison.OrdinalIgnoreCase);
            bool isYouTube = isUrl && (url.Contains("youtube.com", StringComparison.OrdinalIgnoreCase) || url.Contains("youtu.be", StringComparison.OrdinalIgnoreCase));

            // For music links: resolve via Odesli API to get the best square album art (Spotify) and reliable YouTube URL
            if ((isSpotify || isYouTube) && !isPlaylist)
            {
                using var client = new HttpClient();
                client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
                try
                {
                    string json = await client.GetStringAsync($"https://api.song.link/v1-alpha.1/links?url={Uri.EscapeDataString(url)}");
                    
                    using var document = JsonDocument.Parse(json);
                    var root = document.RootElement;
                    
                    if (root.TryGetProperty("entitiesByUniqueId", out var entitiesProp))
                    {
                        // 1. Look for a perfectly square album art from major streaming platforms
                        string[] preferredPlatforms = { "SPOTIFY_SONG::", "APPLE_MUSIC_SONG::", "TIDAL_SONG::", "DEEZER_SONG::", "PANDORA_SONG::", "YANDEX_SONG::", "AMAZON_SONG::" };
                        foreach (var platformPrefix in preferredPlatforms)
                        {
                            foreach (var prop in entitiesProp.EnumerateObject())
                            {
                                if (prop.Name.StartsWith(platformPrefix, StringComparison.OrdinalIgnoreCase))
                                {
                                    if (prop.Value.TryGetProperty("thumbnailUrl", out var thumbProp))
                                    {
                                        albumArtUrl = thumbProp.GetString();
                                        break;
                                    }
                                }
                            }
                            if (albumArtUrl != null) break;
                        }
                        
                        // 2. If no Spotify art found, fallback to the original requested entity's thumbnail
                        if (albumArtUrl == null && root.TryGetProperty("entityUniqueId", out var uniqueIdProp))
                        {
                            string entityId = uniqueIdProp.GetString();
                            if (entitiesProp.TryGetProperty(entityId, out var entityProp) &&
                                entityProp.TryGetProperty("thumbnailUrl", out var origThumbProp))
                            {
                                albumArtUrl = origThumbProp.GetString();
                            }
                        }
                    }

                    if (root.TryGetProperty("linksByPlatform", out var linksProp))
                    {
                        if (linksProp.TryGetProperty("youtubeMusic", out var ytMusicProp) && ytMusicProp.TryGetProperty("url", out var ytmUrl))
                        {
                            url = ytmUrl.GetString();
                            isSpotify = false;
                        }
                        else if (linksProp.TryGetProperty("youtube", out var ytProp) && ytProp.TryGetProperty("url", out var ytUrl))
                        {
                            url = ytUrl.GetString();
                            isSpotify = false;
                        }
                    }
                    
                    if (isSpotify) 
                    {
                        // Fallback: extract title/artist for ytsearch if we couldn't find a youtube link
                        if (root.TryGetProperty("entitiesByUniqueId", out var entitiesPropFallback) && 
                            root.TryGetProperty("entityUniqueId", out var uniqueIdPropFallback))
                        {
                            string entityId = uniqueIdPropFallback.GetString();
                            if (entitiesPropFallback.TryGetProperty(entityId, out var entityPropFallback))
                            {
                                string t = entityPropFallback.TryGetProperty("title", out var titleProp) ? titleProp.GetString() : "";
                                string a = entityPropFallback.TryGetProperty("artistName", out var artistProp) ? artistProp.GetString() : "";
                                if (!string.IsNullOrEmpty(t))
                                {
                                    url = $"ytsearch1:{a} {t}";
                                    isSpotify = false;
                                }
                            }
                        }
                    }
                }
                catch { /* If Odesli fails, fallback to standard yt-dlp/spotdl logic */ }
            }

            if (!isUrl && !url.StartsWith("ytsearch") && !isSpotify)
            {
                url = $"ytsearch1:{url}";
            }

            // If still a Spotify URL (playlist/album or Odesli failed), try spotDL
            if (isSpotify)
            {
                string spotDlPath = Path.Combine(AppDataFolder, "spotdl.exe");
                if (File.Exists(spotDlPath))
                {
                    executable = spotDlPath;

                    string outTemplate = isPlaylist
                        ? Path.Combine(outputPath, "{list-name}", "{list-position} - {title}.{output-ext}")
                        : outputPath;

                    args = $"\"{url}\" --format {(format.ToLower() == "mp3" ? "mp3" : "m4a")} --output \"{outTemplate}\"";
                }
                else
                {
                    throw new Exception("Spotify playlists are temporarily unavailable (YouTube Music rate limit). Try again later or use individual song links.");
                }
            }
            else
            {
                string outTemplate = isPlaylist
                    ? Path.Combine(outputPath, "%(playlist_title)s", "%(playlist_index)s - %(title)s.%(ext)s")
                    : outputPath;

                string formatArg = format.ToLower() == "mp3"
                    ? "-f bestaudio --extract-audio --audio-format mp3 --audio-quality 0"
                    : "-f \"bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best\" --merge-output-format mp4";

                string playlistArg = isPlaylist ? "--yes-playlist" : "--no-playlist";

                // Embed metadata (title, artist, album). Album art will be added separately if available.
                string metadataArgs = albumArtUrl != null
                    ? "--embed-metadata"
                    : "--embed-thumbnail --embed-metadata --convert-thumbnails jpg";

                args = $"--ffmpeg-location \"{FfmpegPath}\" --no-colors --newline {playlistArg} --force-ipv4 -N 2 {formatArg} {metadataArgs} -o \"{outTemplate}\" \"{url}\"";
            }

            var startInfo = new ProcessStartInfo
            {
                FileName = executable,
                Arguments = args,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                WorkingDirectory = AppDataFolder
            };
            
            // Adaugam ffmpeg in PATH pt spotDL
            startInfo.EnvironmentVariables["PATH"] = AppDataFolder + ";" + Environment.GetEnvironmentVariable("PATH");

            using var process = new Process { StartInfo = startInfo };
            
            // Regex for yt-dlp: [download]  15.3%
            // Regex for spotdl: ] 15%
            var progressRegex = new Regex(@"(?:\[download\]|\])\s+(?<percent>\d+(\.\d+)?)%");

            var errors = new System.Text.StringBuilder();

            process.OutputDataReceived += (sender, e) =>
            {
                if (string.IsNullOrWhiteSpace(e.Data)) return;
                var match = progressRegex.Match(e.Data);
                if (match.Success && double.TryParse(match.Groups["percent"].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double percent))
                {
                    progressCallback?.Invoke((int)percent);
                }
            };

            process.ErrorDataReceived += (sender, e) =>
            {
                if (string.IsNullOrWhiteSpace(e.Data)) return;
                errors.AppendLine(e.Data);
                var match = progressRegex.Match(e.Data);
                if (match.Success && double.TryParse(match.Groups["percent"].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double percent))
                {
                    progressCallback?.Invoke((int)percent);
                }
            };

            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
            
            await process.WaitForExitAsync();

            if (process.ExitCode != 0)
            {
                throw new Exception($"Download failed. yt-dlp error: {errors}");
            }

            // Embed square album art from Odesli (Spotify/Apple Music cover) into the MP3
            if (albumArtUrl != null && format.ToLower() == "mp3" && !isPlaylist && File.Exists(outputPath))
            {
                try
                {
                    string artPath = Path.Combine(AppDataFolder, "temp_cover.jpg");
                    using (var artClient = new HttpClient())
                    {
                        var artBytes = await artClient.GetByteArrayAsync(albumArtUrl);
                        await File.WriteAllBytesAsync(artPath, artBytes);
                    }

                    string tempMp3 = outputPath + ".tmp.mp3";
                    if (File.Exists(tempMp3)) File.Delete(tempMp3);
                    
                    var ffmpegInfo = new ProcessStartInfo
                    {
                        FileName = FfmpegPath,
                        Arguments = $"-y -i \"{outputPath}\" -i \"{artPath}\" -map 0:a -map 1:0 -c copy -id3v2_version 3 -metadata:s:v title=\"Album cover\" -metadata:s:v comment=\"Cover (front)\" -disposition:v attached_pic \"{tempMp3}\"",
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        WorkingDirectory = AppDataFolder
                    };

                    using var ffProc = new Process { StartInfo = ffmpegInfo };
                    ffProc.Start();
                    await ffProc.WaitForExitAsync();

                    if (ffProc.ExitCode == 0 && File.Exists(tempMp3))
                    {
                        File.Delete(outputPath);
                        File.Move(tempMp3, outputPath);
                    }
                    else if (File.Exists(tempMp3))
                    {
                        File.Delete(tempMp3);
                    }

                    if (File.Exists(artPath)) File.Delete(artPath);
                }
                catch { /* Album art embedding failed, but the MP3 is still valid */ }
            }
        }

        public async Task<string> GetMediaTitleAsync(string url, bool isPlaylist)
        {
            if (!IsEngineInstalled()) return "download";

            bool isUrl = Uri.TryCreate(url, UriKind.Absolute, out var uriResult) && (uriResult.Scheme == Uri.UriSchemeHttp || uriResult.Scheme == Uri.UriSchemeHttps);

            if (isPlaylist)
            {
                return "playlist_download";
            }

            if (isUrl && url.Contains("spotify.com"))
            {
                using var client = new HttpClient();
                client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
                try {
                    string json = await client.GetStringAsync($"https://api.song.link/v1-alpha.1/links?url={url}");
                    var matchTitle = Regex.Match(json, @"(?i)""title""\s*:\s*""([^""]+)""");
                    var matchArtist = Regex.Match(json, @"(?i)""artistName""\s*:\s*""([^""]+)""");
                    if (matchTitle.Success)
                    {
                        string t = matchTitle.Groups[1].Value.Replace("\\\"", "\"");
                        string a = matchArtist.Success ? matchArtist.Groups[1].Value.Replace("\\\"", "\"") : "";
                        return $"{a} - {t}".Trim(' ', '-');
                    }
                } catch { }
            }

            if (!isUrl && !url.StartsWith("ytsearch"))
            {
                return url.Trim();
            }

            var startInfo = new ProcessStartInfo
            {
                FileName = YtDlpPath,
                Arguments = $"--no-playlist --print title \"{url}\"",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                CreateNoWindow = true,
                WorkingDirectory = AppDataFolder
            };

            using var process = new Process { StartInfo = startInfo };
            process.Start();
            
            string processTitle = await process.StandardOutput.ReadToEndAsync();
            await process.WaitForExitAsync();

            processTitle = processTitle.Trim();
            return string.IsNullOrWhiteSpace(processTitle) ? "download" : processTitle;
        }
    }
}
