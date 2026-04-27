const https = require('https');
const http = require('http');
const url = require('url');

const links = {
    "OBS Studio": "https://cdn-fastly.obsproject.com/downloads/OBS-Studio-32.0.4-Windows-x64-Installer.exe",
    "VPN Tuxler": "https://api.tuxlervpn.com/extension_event.php?id=download_desktop_win",
    "WinRAR": "https://www.win-rar.com/fileadmin/winrar-versions/winrar/winrar-x64-720.exe",
    "Stremio": "https://dl.strem.io/stremio-shell-ng/v5.0.16/StremioSetup-v5.0.16_x64.exe",
    "Malwarebytes": "https://downloads.malwarebytes.com/file/mb-windows",
    "FL Studio 21": "https://drive.google.com/file/d/1lKNuKea7MuyfzraJyrQ9F4UD3EStyZeB/view?usp=sharing",
    "Media Encoder 2024": "https://drive.google.com/drive/folders/1p3oQ17XtByMhfswGWAe3dwStaQ1xvpnQ?usp=drive_link",
    "After Effects 2024": "https://drive.google.com/drive/folders/1WysjpnM-eWev-jXsgq81XjQXbBMtvLRN?usp=sharing",
    "Photoshop 2021": "https://drive.google.com/drive/folders/1nTe7dnytA2bQZ2yXEoufk6Z70H3RG3fh?usp=sharing"
};

async function getSize(link) {
    return new Promise((resolve) => {
        const q = url.parse(link);
        const mod = q.protocol === 'https:' ? https : http;

        // GDrive links won't work simply this way usually for folders or without api key, but we'll try head.
        const req = mod.request(link, { method: 'HEAD' }, (res) => {
            let sizeBytes = res.headers['content-length'];
            if (sizeBytes) {
                const sizeMb = (parseInt(sizeBytes) / (1024 * 1024)).toFixed(1);
                resolve(`${sizeMb} Mb`);
            } else {
                resolve('-');
            }
        });
        req.on('error', () => resolve('-'));
        req.end();
    });
}

(async () => {
    for (const [name, link] of Object.entries(links)) {
        console.log(`Checking ${name}...`);
        const size = await getSize(link);
        console.log(`${name}: ${size}`);
    }
})();
