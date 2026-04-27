import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const urls = [
  "https://hydralinks.pages.dev/sources/onlinefix.json",
  "https://hydralinks.pages.dev/sources/steamrip.json",
  "https://hydralinks.pages.dev/sources/gog.json",
  "https://hydralinks.pages.dev/sources/dodi.json",
  "https://hydralinks.pages.dev/sources/fitgirl.json",
  "https://hydralinks.pages.dev/sources/xatab.json",
  "https://hydralinks.pages.dev/sources/rexagames.json"
];

(async () => {
    console.log("Starting Puppeteer test for Hydralinks...");
    try {
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        // Emulate realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        let allGames = [];

        for (const url of urls) {
            console.log(`Fetching ${url}...`);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            
            // Extract body text, might be JSON or might be 451 error frame.
            const content = await page.evaluate(() => document.body.innerText);
            
            if (content && content.includes('451 Unavailable For Legal Reasons')) {
                console.log(`Failed: ${url} returned 451 Unavailable For Legal Reasons. Skipping...`);
                continue;
            }

            try {
                const parsed = JSON.parse(content);
                console.log(`Success: Found "${parsed.name}" with ${parsed.downloads?.length || 0} games.`);
                if (parsed.downloads) {
                    parsed.downloads.forEach(d => {
                        allGames.push({
                            ...d,
                            source: parsed.name || 'Unknown'
                        });
                    });
                }
            } catch(e) {
                console.log(`Failed to parse json on ${url}. First 100 chars:`, content.substring(0,100));
            }
            
            // Wait to avoid rate-limiting
            await new Promise(r => setTimeout(r, 2000));
        }

        console.log(`Total games extracted: ${allGames.length}`);
        
        const outPath = path.join(process.cwd(), 'public', 'data', 'games.json');
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        
        // Write the games if we have any, or even if we don't, just to create the structure
        fs.writeFileSync(outPath, JSON.stringify(allGames, null, 2));
        console.log(`Saved to ${outPath}`);

        await browser.close();
    } catch(err) {
        console.error("Puppeteer Script Error:", err);
    }
})();
