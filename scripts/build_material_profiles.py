import hashlib
import io
import json
import math
import re
import ssl
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "chrome-extension" / "colors-profile-data.js"
CACHE = ROOT / ".cache" / "official-swatches"

PAGES = {
    "automotive": "https://www.alcantara.com/colors/automotive-colour-charts/",
    "interior": "https://www.alcantara.com/colors/interior-nautical-aviation-colour-charts/",
    "fashion": "https://www.alcantara.com/colors/fashion-colour-charts/",
    "electronics": "https://www.alcantara.com/colors/consumer-electronics-colour-charts/",
}


def fetch(url, timeout=20):
    ctx = ssl._create_unverified_context()
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, context=ctx, timeout=timeout) as resp:
        return resp.read()


def rgb_to_lab(r, g, b):
    def f(c):
        c = c / 255
        return ((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92

    r, g, b = f(r), f(g), f(b)
    x = r * 0.4124 + g * 0.3576 + b * 0.1805
    y = r * 0.2126 + g * 0.7152 + b * 0.0722
    z = r * 0.0193 + g * 0.1192 + b * 0.9505
    xn, yn, zn = 0.95047, 1, 1.08883

    def k(t):
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116

    fx, fy, fz = k(x / xn), k(y / yn), k(z / zn)
    return [round(116 * fy - 16, 2), round(500 * (fx - fy), 2), round(200 * (fy - fz), 2)]


def ciede2000(lab1, lab2):
    l1, a1, b1 = lab1
    l2, a2, b2 = lab2
    rad = math.pi / 180
    deg = 180 / math.pi
    c1 = math.sqrt(a1 * a1 + b1 * b1)
    c2 = math.sqrt(a2 * a2 + b2 * b2)
    cb = (c1 + c2) / 2
    g = 0.5 * (1 - math.sqrt((cb**7) / (cb**7 + 25**7))) if cb else 0
    a1p = (1 + g) * a1
    a2p = (1 + g) * a2
    c1p = math.sqrt(a1p * a1p + b1 * b1)
    c2p = math.sqrt(a2p * a2p + b2 * b2)
    h1p = math.atan2(b1, a1p) * deg
    h2p = math.atan2(b2, a2p) * deg
    if h1p < 0:
        h1p += 360
    if h2p < 0:
        h2p += 360
    dlp = l2 - l1
    dcp = c2p - c1p
    dhp = 0
    if c1p * c2p:
        dhp = h2p - h1p
        if dhp > 180:
            dhp -= 360
        elif dhp < -180:
            dhp += 360
    dhp_val = 2 * math.sqrt(c1p * c2p) * math.sin((dhp / 2) * rad)
    lbp = (l1 + l2) / 2
    cbp = (c1p + c2p) / 2
    if c1p * c2p == 0:
        hbp = h1p + h2p
    else:
        hbp = h1p + h2p
        if abs(h1p - h2p) > 180:
            hbp += 360 if h1p + h2p < 360 else -360
        hbp /= 2
    t = (
        1
        - 0.17 * math.cos((hbp - 30) * rad)
        + 0.24 * math.cos((2 * hbp) * rad)
        + 0.32 * math.cos((3 * hbp + 6) * rad)
        - 0.20 * math.cos((4 * hbp - 63) * rad)
    )
    dtheta = 30 * math.exp(-(((hbp - 275) / 25) ** 2))
    rc = 2 * math.sqrt((cbp**7) / (cbp**7 + 25**7)) if cbp else 0
    sl = 1 + (0.015 * ((lbp - 50) ** 2)) / math.sqrt(20 + ((lbp - 50) ** 2))
    sc = 1 + 0.045 * cbp
    sh = 1 + 0.015 * cbp * t
    rt = -math.sin((2 * dtheta) * rad) * rc
    return math.sqrt((dlp / sl) ** 2 + (dcp / sc) ** 2 + (dhp_val / sh) ** 2 + rt * (dcp / sc) * (dhp_val / sh))


def percentile(vals, p):
    vals = sorted(vals)
    idx = max(0, min(len(vals) - 1, int((len(vals) - 1) * p)))
    return vals[idx]


def median(vals):
    vals = sorted(vals)
    mid = len(vals) // 2
    if len(vals) % 2:
        return vals[mid]
    return (vals[mid - 1] + vals[mid]) / 2


def mean(vals):
    return sum(vals) / max(1, len(vals))


def rgb_hex(rgb):
    return "#" + "".join(f"{max(0, min(255, round(v))):02X}" for v in rgb)


def name_from_url(url):
    stem = Path(urllib.parse.urlparse(url).path).stem
    m = re.match(r"^(\d{4})(?:[_-](.+))?$", stem)
    if not m:
        return None, None
    code, raw = m.group(1), m.group(2)
    if not raw:
        return code, None
    words = re.sub(r"[-_]+", " ", raw).strip()
    return code, " ".join(w.capitalize() for w in words.split())


def parse_page(app, url):
    html = fetch(url).decode("utf-8", "ignore")
    urls = set(re.findall(r"https://www\.alcantara\.com/wp-content/uploads/[^\"'<> ]+?\.jpg", html))
    items = []
    for img_url in urls:
        code, name = name_from_url(img_url)
        if not code:
            continue
        items.append({"code": code, "name": name, "app": app, "url": img_url})
    return items


def cached_image(url):
    CACHE.mkdir(parents=True, exist_ok=True)
    suffix = Path(urllib.parse.urlparse(url).path).suffix or ".jpg"
    path = CACHE / (hashlib.sha1(url.encode()).hexdigest() + suffix)
    if not path.exists():
        path.write_bytes(fetch(url, timeout=16))
    return path


def sample_image(path):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    crop = img.crop((int(w * 0.08), int(h * 0.08), int(w * 0.92), int(h * 0.92)))
    max_side = 180
    if max(crop.size) > max_side:
        crop.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    pixels = []
    for r, g, b in crop.getdata():
        lab = rgb_to_lab(r, g, b)
        pixels.append({"rgb": [r, g, b], "lab": lab, "l": lab[0]})
    if len(pixels) < 12:
        return None
    lo = percentile([p["l"] for p in pixels], 0.08)
    hi = percentile([p["l"] for p in pixels], 0.92)
    light_trimmed = [p for p in pixels if lo <= p["l"] <= hi]
    med_rgb = [median([p["rgb"][i] for p in light_trimmed]) for i in range(3)]
    base_lab = rgb_to_lab(*med_rgb)
    ds = sorted(ciede2000(p["lab"], base_lab) for p in light_trimmed)
    max_d = percentile(ds, 0.86)
    trimmed = [p for p in light_trimmed if ciede2000(p["lab"], base_lab) <= max_d]
    med_rgb = [median([p["rgb"][i] for p in trimmed]) for i in range(3)]
    avg_rgb = [mean([p["rgb"][i] for p in trimmed]) for i in range(3)]
    dom_rgb = dominant_rgb(trimmed)
    anchors = [
        {"label": "official median", "rgb": [round(x) for x in med_rgb], "lab": rgb_to_lab(*med_rgb), "hex": rgb_hex(med_rgb)},
        {"label": "official trimmed mean", "rgb": [round(x) for x in avg_rgb], "lab": rgb_to_lab(*avg_rgb), "hex": rgb_hex(avg_rgb)},
        {"label": "official dominant", "rgb": [round(x) for x in dom_rgb], "lab": rgb_to_lab(*dom_rgb), "hex": rgb_hex(dom_rgb)},
    ]
    spread = median([ciede2000(p["lab"], anchors[0]["lab"]) for p in trimmed])
    return {"anchors": anchors, "spread": round(spread, 2), "pixels": len(trimmed)}


def dominant_rgb(samples):
    if len(samples) < 3:
        return [mean([p["rgb"][i] for p in samples]) for i in range(3)]
    ordered = sorted(samples, key=lambda p: p["l"])
    centers = [
        ordered[int(len(ordered) * 0.2)]["lab"][:],
        ordered[int(len(ordered) * 0.5)]["lab"][:],
        ordered[int(len(ordered) * 0.8)]["lab"][:],
    ]
    groups = [[], [], []]
    for _ in range(8):
        groups = [[], [], []]
        for p in samples:
            distances = [sum((p["lab"][i] - c[i]) ** 2 for i in range(3)) for c in centers]
            groups[distances.index(min(distances))].append(p)
        for i, group in enumerate(groups):
            if group:
                centers[i] = [mean([p["lab"][j] for p in group]) for j in range(3)]
    group = max(groups, key=len)
    return [mean([p["rgb"][i] for p in group]) for i in range(3)]


def load_existing():
    text = (DESKTOP / "chrome-extension-unzipped" / "colors-data.js").read_text()
    payload = text.split("=", 1)[1].rstrip(";\n")
    return {item["code"]: item for item in json.loads(payload)}


def main():
    existing = load_existing()
    by_code = {}
    for app, page in PAGES.items():
        for item in parse_page(app, page):
            rec = by_code.setdefault(
                item["code"],
                {
                    "code": item["code"],
                    "name": None,
                    "apps": set(),
                    "urls": set(),
                    "profiles": [],
                },
            )
            rec["apps"].add(item["app"])
            rec["urls"].add(item["url"])
            if item["name"] and not rec["name"]:
                rec["name"] = item["name"]
    total_urls = sum(len(rec["urls"]) for rec in by_code.values())
    done_urls = 0
    print(f"official codes={len(by_code)} swatch_urls={total_urls}", flush=True)
    for code, rec in by_code.items():
        old = existing.get(code)
        if old:
            rec["name"] = old.get("name") or rec["name"]
            rec["rs"] = old.get("rs", False)
            rec["rsn"] = old.get("rsn", [])
        else:
            rec["rs"] = False
            rec["rsn"] = []
        for url in sorted(rec["urls"]):
            done_urls += 1
            print(f"[{done_urls}/{total_urls}] {code} {url}", flush=True)
            try:
                profile = sample_image(cached_image(url))
            except Exception as exc:
                print(f"skip {code}: {exc}", flush=True)
                continue
            if not profile:
                continue
            profile["source"] = url
            rec["profiles"].append(profile)

    out = []
    for code in sorted(by_code):
        rec = by_code[code]
        anchors = []
        spreads = []
        for profile in rec["profiles"]:
            anchors.extend(profile["anchors"])
            spreads.append(profile["spread"])
        # Deduplicate identical-ish anchors to keep the extension light.
        deduped = []
        seen = set()
        for anchor in anchors:
            key = tuple(round(x) for x in anchor["rgb"])
            if key in seen:
                continue
            seen.add(key)
            deduped.append(anchor)
        display_hex = deduped[0]["hex"] if deduped else (existing.get(code, {}).get("hex") or "#777777")
        display_lab = deduped[0]["lab"] if deduped else (existing.get(code, {}).get("lab") or [50, 0, 0])
        out.append(
            {
                "code": code,
                "name": rec["name"],
                "hex": display_hex,
                "lab": display_lab,
                "apps": sorted(rec["apps"]),
                "rs": rec["rs"],
                "rsn": rec["rsn"],
                "profileAnchors": deduped,
                "profileSpread": round(mean(spreads), 2) if spreads else None,
                "profileSources": len(rec["profiles"]),
            }
        )

    OUT.write_text("window.ALCANTARA_COLOR_PROFILES=" + json.dumps(out, separators=(",", ":")) + ";\n")
    print(f"wrote {OUT}")
    print(f"codes={len(out)} anchors={sum(len(x['profileAnchors']) for x in out)}")
    missing = sorted(set(by_code) - set(existing))
    if missing:
        print("new codes:", ",".join(missing))


if __name__ == "__main__":
    main()
