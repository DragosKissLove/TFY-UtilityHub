import urllib.request
import re

players = ["s1mple", "zywoo", "donk", "m0nesy", "niko", "ropz", "b1t", "twistzz"]
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

for p in players:
    try:
        req = urllib.request.Request(f"https://prosettings.net/players/{p}/", headers=headers)
        html = urllib.request.urlopen(req).read().decode('utf-8')
        links = re.findall(r'href="(https://prosettings\.net/wp-content/uploads/[^"]+\.zip)"', html)
        if not links:
            links = re.findall(r'href="(https://prosettings\.net/wp-content/uploads/[^"]+\.rar)"', html)
        print(f"{p}: {links[0] if links else 'NOT FOUND'}")
    except Exception as e:
        print(f"{p}: {e}")
