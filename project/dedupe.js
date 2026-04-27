import puppeteer from 'puppeteer';
// using firestore REST
const projectId = "tfy-project";
const databaseId = "(default)";
const collectionId = "plugins";
const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collectionId}`;

(async () => {
    console.log("Fetching plugins to deduplicate...");
    const res = await fetch(firestoreUrl);
    const data = await res.json();
    if (!data.documents) {
        console.log("No documents found.");
        return;
    }

    const seenTitles = new Set();
    const duplicates = [];

    for (const doc of data.documents) {
        const title = doc.fields.title.stringValue.toLowerCase().trim();
        if (seenTitles.has(title)) {
            duplicates.push(doc.name); // document path
        } else {
            seenTitles.add(title);
        }
    }

    console.log(`Found ${duplicates.length} duplicates out of ${data.documents.length} total docs.`);

    for (const docName of duplicates) {
        const url = `https://firestore.googleapis.com/v1/${docName}`;
        try {
            await fetch(url, { method: 'DELETE' });
            console.log("Deleted duplicate:", docName);
        } catch (e) {
            console.error("Failed to delete", docName, e);
        }
    }
    console.log("Deduplication complete.");
})();
