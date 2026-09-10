using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;

class Program {
    static async Task Main() {
        var handler = new HttpClientHandler() { AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli };
        var hc = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(30) };
        hc.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        var resp = await hc.GetAsync("https://web.archive.org/web/2id_/https://hydralinks.pages.dev/sources/fitgirl.json");
        var json = await resp.Content.ReadAsStringAsync();
        Console.WriteLine(json.Substring(0, Math.Min(json.Length, 300)));
    }
}
