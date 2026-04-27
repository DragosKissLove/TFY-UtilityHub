import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
    console.log("Starting Debug Scraper...");
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    await page.goto('https://graphicx.store/windows/?search=tag%3Aafter%20effects', { waitUntil: 'networkidle0' });

    // wait 5 seconds for any JS to finish rendering
    await new Promise(r => setTimeout(r, 5000));

    const html = await page.content();
    fs.writeFileSync('debug.html', html);
    console.log("Dumped HTML to debug.html");

    await browser.close();
})();
