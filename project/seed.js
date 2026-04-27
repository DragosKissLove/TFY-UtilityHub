const projectId = "tfy-project";
const databaseId = "(default)";
const collectionId = "plugins";

const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collectionId}`;

const plugins = [
    { "title": "Maxon Red Giant", "link": "https://drive.google.com/uc?export=download&id=1UVPSIhUzx5iyukoShjbDJMsB4kUR5M-o" },
    { "title": "Maxon Universe", "link": "https://drive.google.com/uc?export=download&id=1lAy0OwfFBXNDUJIyLWL92IC67X_P1hpQ" },
    { "title": "Maxon Cinema 4D", "link": "https://drive.google.com/uc?export=download&id=1KzO_yHew0RX2CsHxTDSAZg5k4JbZc5sn" },
    { "title": "Boris FX Continuum AE PR", "link": "https://drive.google.com/uc?export=download&id=1viQVC_bjPhXcAbCj1FaIT0RiOo23d6JJ" },
    { "title": "Boris FX Mocha Pro AE PR", "link": "https://drive.google.com/uc?export=download&id=1K3dKPX-VRxr57J4T5X0KX7ZWvAGyPzeI" },
    { "title": "Boris FX Sapphire AE PR", "link": "https://drive.google.com/uc?export=download&id=1veItqodWqneRhWRKuvv6l8qTEd8YzEMw" },
    { "title": "Autokroma All Plugins", "link": "https://drive.google.com/uc?export=download&id=1bZVPlsXJrwV9NKQNdv90L6Nz1SaSkjFq" },
    { "title": "CROSSPHERE All Plugins", "link": "https://drive.google.com/uc?export=download&id=13E7Enz8kRiplau5T1g4McAa2Dsz5zR2N" },
    { "title": "Frischluft All Plugins", "link": "https://drive.google.com/uc?export=download&id=12U_arF2zNppn9qwKLrckOolCDnwjExnU" },
    { "title": "Plugin Everything All Plugins", "link": "https://drive.google.com/uc?export=download&id=1VQ__B-URq2Ft0wLu7N91_urAWEw59sEv" },
    { "title": "Pixel Sorter Studio All Plugins", "link": "https://drive.google.com/uc?export=download&id=1k6wbH8gffJqxXXjoAHe9umbIU34vILUb" },
    { "title": "REVisionFX All Plugins", "link": "https://drive.google.com/uc?export=download&id=1nVAO_9vFoBxP1BkQLNxPIUQLpNrzvlQe" },
    { "title": "Motion Boutique All Plugins", "link": "https://drive.google.com/uc?export=download&id=1s1w-HgusxJV4MVVDZ7Iw2XHZo_x0OFj6" },
    { "title": "Rowbyte All Plugins", "link": "https://drive.google.com/uc?export=download&id=1RVECOpTBanIcBOhmowp0YFU70iRZszRg" },
    { "title": "Satori All Plugins", "link": "https://drive.google.com/uc?export=download&id=1eLUrInQdlHvVImG5Vv5HQZf-AFp0x2Fg" },
    { "title": "Zaebects All Plugins", "link": "https://drive.google.com/uc?export=download&id=1rw9rd2TeeCoeQjnDXTLT6hoc5T9rMMxr" },
    { "title": "Vranos All Plugins", "link": "https://drive.google.com/uc?export=download&id=1qTZ3ZnGUNIHz-MUQQxGDlp1crDK85F-z" },
    { "title": "Wunkolo All Plugins", "link": "https://drive.google.com/uc?export=download&id=1GWotq87vpvz4tJN1Eaafjpp10UOA43p4" },
    { "title": "FilmConvert All Plugins", "link": "https://drive.google.com/uc?export=download&id=16HOMJhG1zCbJO7XeOa9Dw_FQzLyxQGgf" },
    { "title": "Vimager All Plugins", "link": "https://drive.google.com/uc?export=download&id=156NegqOdJDs0e3IDWMwTyFdHVJZ-oqJb" },
    { "title": "Mettle All Plugin", "link": "https://drive.google.com/uc?export=download&id=1j4DYn1iFAaukxTsMVvk67rkiYXDHUuqA" },
    { "title": "Video Copilot All Plugin", "link": "https://drive.google.com/uc?export=download&id=100VEdHhYiKkSxwPkKE52R1koEHb93Kym" },
    { "title": "Newton 4", "link": "https://drive.google.com/uc?export=download&id=1-yb1Wk8oeGfNsPvmSQd6vswOyaSOSi7D" },
    { "title": "Retro Dither", "link": "https://drive.google.com/uc?export=download&id=1Z8Eh-Ttv4jXnkuzLnkdLKoLy-K4_l7jm" },
    { "title": "Crates Godrays", "link": "https://drive.google.com/uc?export=download&id=11qx3w2xG-Vnhpp3yvPWCQY6TLtxw6ZKl" },
    { "title": "ContrastUp", "link": "https://drive.google.com/uc?export=download&id=1l7P4EDFiLAkW4aKHDcwZyAoSdmvqP8eR" },
    { "title": "Glitchify", "link": "https://drive.google.com/uc?export=download&id=104vJvjFYXHiSbcnWGgTAtP8sqtA0oiVZ" },
    { "title": "Diffusae 2", "link": "https://drive.google.com/uc?export=download&id=1CqblhjrNA7mAl1Au10n9UDSFnJvBhQJx" },
    { "title": "LoopFlow", "link": "https://drive.google.com/uc?export=download&id=1GMFDr7OarSmFqhPhwN3NL2RdCtzMohPj" },
    { "title": "Glitch 7in1", "link": "https://drive.google.com/uc?export=download&id=1FyDUXx_dHxqi1pk4lNfJLUxBM31bwhKv" },
    { "title": "Polytrace", "link": "https://drive.google.com/uc?export=download&id=10rVwF6wwutnvhF8QNNKYpBSMwWeaPEeb" },
    { "title": "Mask Prompter", "link": "https://drive.google.com/uc?export=download&id=1rwEeEEt_UCj-qF2fg5nBL73Lce-Z6_m1" },
    { "title": "Depth Scanner", "link": "https://drive.google.com/uc?export=download&id=1p5_nNgM6ApaagU59w8d2K77CFqF43Fvk" },
    { "title": "Dehancer Pro", "link": "https://drive.google.com/uc?export=download&id=1vuYTTzirzuxQaZbH-UVkUKM_-llK92gH" },
    { "title": "Composite Brush", "link": "https://drive.google.com/uc?export=download&id=1PtUID1ua6NDR69kLk84lw-TC8S8-P7Gp" },
    { "title": "Superluminal Stardust + Library", "link": "https://drive.google.com/uc?export=download&id=1oHjQAgl1IZvDtHuSzCwbLzudtjmZtpdN" },
    { "title": "Omino Suite", "link": "https://drive.google.com/uc?export=download&id=1qng7l9zwvHueRVi3IRbeN6ZlbSCb26zf" },
    { "title": "Modulation 2", "link": "https://drive.google.com/uc?export=download&id=1BqKi1u9-iKQ8p-aoVk5qYRTWZCNXAhou" }
];

async function seed() {
    for (const plugin of plugins) {
        let tag = "VFX";
        const lowerTitle = plugin.title.toLowerCase();
        if (lowerTitle.includes("glow")) tag = "GLOW";
        if (lowerTitle.includes("color") || lowerTitle.includes("filmconvert") || lowerTitle.includes("dehancer")) tag = "COLOR";
        if (lowerTitle.includes("mocha") || lowerTitle.includes("tracker")) tag = "TRACK";
        if (lowerTitle.includes("glitch") || lowerTitle.includes("retro") || lowerTitle.includes("modulation")) tag = "GLITCH";

        const firestoreDocument = {
            fields: {
                title: { stringValue: plugin.title },
                category: { stringValue: "After Effects" },
                tag: { stringValue: tag },
                scriptUrl: { stringValue: plugin.link },
                type: { stringValue: "Plugin" },
                version: { stringValue: "LATEST" },
                logoUrl: { stringValue: "" }
            }
        };

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(firestoreDocument)
            });

            const data = await response.json();
            console.log(`[OK] Added: ${plugin.title}`);
        } catch (e) {
            console.error(`[ERR] Failed to add ${plugin.title}`, e);
        }
    }
}

seed();
