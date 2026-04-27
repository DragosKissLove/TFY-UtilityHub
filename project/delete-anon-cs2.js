import puppeteer from 'puppeteer'; // Just to keep package.json happy if needed, though we only use fetch

const projectId = "tfy-project";
const databaseId = "(default)";
const collectionId = "cs2_configs";
const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collectionId}?pageSize=100`;

(async () => {
    console.log("Fetching cs2_configs to delete Anonymous ones...");
    const res = await fetch(firestoreUrl);
    const data = await res.json();
    if (!data.documents) {
        console.log("No documents found.");
        return;
    }

    const toDelete = [];

    for (const doc of data.documents) {
        const authorName = doc.fields?.authorName?.stringValue || "";
        const docIdMatch = doc.name.match(/([^\/]+)$/);
        const id = docIdMatch ? docIdMatch[1] : "";

        if (authorName === "Anonymous TFY User" || id.startsWith("anon_")) {
            toDelete.push(doc.name); // document path
        }
    }

    console.log(`Found ${toDelete.length} Anonymous configs out of ${data.documents.length} total docs.`);

    for (const docName of toDelete) {
        const url = `https://firestore.googleapis.com/v1/${docName}`;
        try {
            await fetch(url, { method: 'DELETE' });
            console.log("Deleted:", docName);
        } catch (e) {
            console.error("Failed to delete", docName, e);
        }
    }
    console.log("Cleanup complete.");
})();
