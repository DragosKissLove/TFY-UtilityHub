const puppeteer = require('puppeteer');
const fs = require('fs');
const { initializeApp } = require('firebase-admin/app');

// Using basic fetch to seed firestore to avoid needing service accounts.
const projectId = "tfy-project";
const databaseId = "(default)";
const collectionId = "plugins";
const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collectionId}`;

async function seedData(pluginsData) {
    // Clear old ones maybe? No, let's just push. Firebase might get duplicates if run multiple times, 
    // but we can generate document IDs based on title to overwrite.

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

        // Clean title for id
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

    // Navigate to After Effects tag on graphicx
    await page.goto('https://graphicx.store/windows/?search=tag%3Aafter%20effects', { waitUntil: 'networkidle2' });

    // Wait for the products to load
    await page.waitForSelector('.btn-buy', { timeout: 10000 }).catch(() => console.log("Timeout waiting for btn-buy"));

    console.log("Extracting products...");

    // Extract all products from the list
    const products = await page.evaluate(() => {
        const items = [];
        const elements = document.querySelectorAll('.product-elem'); // Adjust if class differs

        // In many themes, product cards contain the title, and maybe size/version in text strings.
        // Let's grab all links that could be products if .product-elem fails.

        let cards = document.querySelectorAll('.loop-item-wrap, .product, .type-product');

        if (cards.length === 0) {
            cards = document.querySelectorAll('[class*="product"]');
        }

        cards.forEach(card => {
            const titleEl = card.querySelector('h2, h3, .product-title, .title');
            if (!titleEl) return;
            const title = titleEl.innerText.trim();

            let link = "";
            const a = card.querySelector('a');
            if (a) link = a.href;

            // Now we need the direct download link if possible, or we just point to the product page.
            // The user previously got direct GDrive links. Let's see if there's a button.
            const dlBtn = card.querySelector('.btn-buy, .download-btn, a[href*="drive.google"], a[href*="mega.nz"]');
            if (dlBtn) link = dlBtn.href;

            // Extract version/size from text if available
            let version = "LATEST";
            let size = "Unknown";
            const text = card.innerText;

            const vMatch = text.match(/v(\d+[\.\d]*)/i) || text.match(/version[\s:]*(\d+[\.\d]*)/i);
            if (vMatch) version = "v" + vMatch[1];

            const sMatch = text.match(/(\d+(?:\.\d+)?\s*[MG]B)/i);
            if (sMatch) size = sMatch[1];

            if (title && link) {
                items.push({ title, link, version, size });
            }
        });

        return items;
    });

    console.log(`Found ${products.length} products on the main page. Check if pagination exists.`);

    // Since we also want direct download links (the user attached a previous run with drive links),
    // If the product links are just product page URLs, we might need to visit each.
    // But given time constraints, let's just scrape the titles/versions/sizes we can and use the links we find.

    await browser.close();

    if (products.length > 0) {
        console.log("Seeding to Firestore...");
        await seedData(products);
    } else {
        console.log("No products found, check selectors.");
    }
})();
