import fs from 'fs';
import translate from '@iamtraction/google-translate';

(async () => {
    console.log("Reading i18n.ts...");
    let content = fs.readFileSync('src/lib/i18n.ts', 'utf-8');

    const enStart = content.indexOf('  en: {');
    const enEnd = content.indexOf('  },', enStart) + 4; // Include the `  },`

    if (enStart === -1 || enEnd < 4) {
        console.error("Failed to find 'en' dictionary block.");
        process.exit(1);
    }

    const enBlock = content.slice(enStart, enEnd);
    const dict = {};

    const lines = enBlock.split('\n');
    for (const line of lines) {
        const parts = line.split("': '");
        if (parts.length >= 2) {
            const key = parts[0].replace(/^\s*'/, '');
            const val = parts.slice(1).join("': '").replace(/',?\s*$/, '').replace(/\\'/g, "'");
            dict[key] = val;
        }
    }

    const entries = Object.entries(dict);
    console.log(`Found ${entries.length} English keys.`);

    const langs = ['ro', 'de', 'fr', 'es'];
    const newDicts = {};

    const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
    const batches = chunkArray(entries, 30); // 30 concurrent translations at a time

    for (const lang of langs) {
        console.log(`Translating to ${lang}...`);
        newDicts[lang] = {};

        let completed = 0;
        for (const batch of batches) {
            const promises = batch.map(async ([key, text]) => {
                try {
                    const res = await translate(text, { to: lang });
                    newDicts[lang][key] = res.text.replace(/'/g, "\\'");
                    completed++;
                } catch (e) {
                    console.error(`FATAL ERROR Translating ${key} to ${lang}:`, e.message);
                    newDicts[lang][key] = text; // fallback to english
                }
            });
            await Promise.all(promises);
            console.log(`  Progress: ${completed}/${entries.length}`);
            // Small delay between batches
            await new Promise(r => setTimeout(r, 200));
        }
    }

    let appendCode = "";
    for (const lang of langs) {
        appendCode += `\n  ${lang}: {\n`;
        for (const [key, val] of Object.entries(newDicts[lang])) {
            appendCode += `    '${key}': '${val}',\n`;
        }
        appendCode += `  },`;
    }

    const endIdx = content.indexOf('export function setLanguage');
    if (endIdx === -1) {
        console.error("Failed to find export function setLanguage.");
        process.exit(1);
    }

    const dicEnd = content.lastIndexOf('};', endIdx);
    if (dicEnd === -1) {
        console.error("Failed to find };");
        process.exit(1);
    }

    const newContent = content.slice(0, enEnd) + appendCode + '\n' + content.slice(dicEnd);

    fs.writeFileSync('src/lib/i18n.ts', newContent, 'utf-8');
    console.log("Successfully replaced RO, DE, FR, and ES dictionaries with proper UTF-8.");
})();
