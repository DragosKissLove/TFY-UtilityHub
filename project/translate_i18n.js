import fs from 'fs';
import translate from '@iamtraction/google-translate';

(async () => {
    console.log("Reading i18n.ts...");
    let content = fs.readFileSync('src/lib/i18n.ts', 'utf-8');

    const enStart = content.indexOf('en: {');
    const enEnd = content.indexOf('},', enStart);

    if (enStart === -1 || enEnd === -1) {
        console.error("Failed to find 'en' dictionary block.");
        process.exit(1);
    }

    const enBlock = content.slice(enStart + 5, enEnd);
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

    const keysCount = Object.keys(dict).length;
    console.log(`Found ${keysCount} English keys.`);
    if (keysCount === 0) process.exit(1);

    const langs = ['de', 'fr', 'es'];
    const newDicts = {};

    for (const lang of langs) {
        console.log(`Translating to ${lang}...`);
        newDicts[lang] = {};
        let count = 0;

        for (const [key, text] of Object.entries(dict)) {
            try {
                const res = await translate(text, { to: lang });
                newDicts[lang][key] = res.text.replace(/'/g, "\\'");
                count++;
                if (count % 25 === 0) console.log(`  Translated ${count} items for ${lang}`);
                await new Promise(r => setTimeout(r, 200)); // Be gentle
            } catch (e) {
                console.error(`FATAL ERROR Translating ${key} to ${lang}:`, e.message);
                process.exit(1);
            }
        }
    }

    let appendCode = "";
    for (const lang of langs) {
        appendCode += `  ${lang}: {\n`;
        for (const [key, val] of Object.entries(newDicts[lang])) {
            appendCode += `    '${key}': '${val}',\n`;
        }
        appendCode += `  },\n`;
    }

    const dictEndStr = '// Ensure complete key coverage for all languages.';
    const endIdx = content.indexOf(dictEndStr);
    if (endIdx === -1) {
        console.error("Failed to find end of dictionary object.");
        process.exit(1);
    }

    // Find the '};' before the comment
    const insertIdx = content.lastIndexOf('};', endIdx);

    const newContent = content.slice(0, insertIdx) + ',\n' + appendCode + content.slice(insertIdx);
    fs.writeFileSync('src/lib/i18n.ts', newContent);
    console.log("Successfully injected DE, FR, and ES dictionaries into i18n.ts");
})();
