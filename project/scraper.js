import puppeteer from 'puppeteer';

// Using basic fetch to seed firestore to avoid needing service accounts.
const projectId = "tfy-project";
const databaseId = "(default)";
const collectionId = "plugins";
const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collectionId}`;

async function seedData(pluginsData) {
    for (const plugin of pluginsData) {
        let tag = "VFX";
        const lowerTitle = plugin.title.toLowerCase();
        if (lowerTitle.includes("glow")) tag = "GLOW";
        if (lowerTitle.includes("color") || lowerTitle.includes("filmconvert") || lowerTitle.includes("dehancer")) tag = "COLOR";
        if (lowerTitle.includes("mocha") || lowerTitle.includes("tracker")) tag = "TRACK";
        if (lowerTitle.includes("glitch") || lowerTitle.includes("retro") || lowerTitle.includes("modulation")) tag = "GLITCH";
        if (lowerTitle.includes("audio") || lowerTitle.includes("beat")) tag = "AUDIO";
        if (lowerTitle.includes("3d") || lowerTitle.includes("element") || lowerTitle.includes("stardust")) tag = "3D";
        if (lowerTitle.includes("bundle") || lowerTitle.includes("suite") || lowerTitle.includes("all plugin")) tag = "PACK";

        // Create a clean id
        const docId = plugin.title.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();

        const firestoreDocument = {
            fields: {
                title: { stringValue: plugin.title },
                category: { stringValue: "After Effects" },
                tag: { stringValue: tag },
                scriptUrl: { stringValue: plugin.link },
                type: { stringValue: "Plugin" },
                version: { stringValue: plugin.version || "LATEST" },
                logoUrl: { stringValue: "" },
                size: { stringValue: plugin.size || "Remote" }
            }
        };

        try {
            const dbUrl = `${firestoreUrl}?documentId=${docId}`;
            let response = await fetch(firestoreUrl + '/' + docId);

            const method = response.status === 200 ? 'PATCH' : 'POST';
            const targetUrl = method === 'PATCH' ? firestoreUrl + '/' + docId : dbUrl;

            await fetch(targetUrl, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(firestoreDocument)
            });
            console.log(`[OK] Saved: ${plugin.title}`);
        } catch (e) {
            console.error(`[ERR] Failed to save ${plugin.title}`);
        }
    }
}

(async () => {
    console.log("Starting Puppeteer Scraper...");
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    await page.goto('https://graphicx.store/windows/?search=tag%3Aafter%20effects', { waitUntil: 'networkidle2' });
    await page.waitForSelector('.post-card', { timeout: 10000 }).catch(() => console.log("Timeout waiting for post-card"));

    console.log("Extracting products...");

    const products = await page.evaluate(() => {
        const items = [];
        const cards = document.querySelectorAll('.post-card');

        cards.forEach(card => {
            const titleEl = card.querySelector('h3');
            if (!titleEl) return;
            const title = titleEl.innerText.trim();

            let link = "";
            const dlBtn = card.querySelector('.download-button');
            if (dlBtn) link = dlBtn.href;

            let version = "LATEST";
            const versionEl = card.querySelector('.version');
            if (versionEl) {
                version = versionEl.innerText.replace("Version :", "").trim();
                if (!version.toLowerCase().startsWith('v')) version = 'v' + version;
            }

            let size = "Unknown";
            const sizeEl = card.querySelector('.post-size');
            if (sizeEl) size = sizeEl.innerText.trim();

            if (title && link) {
                items.push({ title, link, version, size });
            }
        });

        return items;
    });

    console.log(`Found ${products.length} products on the main page.`);

    await browser.close();

    if (products.length > 0) {
        console.log("Seeding to Firestore...");
        await seedData(products);
    } else {
        console.log("No products found, check selectors.");
    }
})();
