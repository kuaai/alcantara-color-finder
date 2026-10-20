# Alcantara Color Finder

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-Manifest_v3-orange.svg)](chrome-extension/)
[![Dataset](https://img.shields.io/badge/Dataset-172_Colors-green.svg)](data/colors.json)
[![Maintained by Racesio](https://img.shields.io/badge/Maintained_by-Racesio.com-red.svg)](https://racesio.com)

An open-source color identification tool, Chrome extension, and structured dataset for **Alcantara® suede materials and fabrics**. 

Designed and developed by [Racesio](https://racesio.com) — specialists in custom [Alcantara automotive accessories](https://racesio.com/collections/alcantara-accessories), steering wheel wraps, headrest pillows, and interior upgrades.

---

## 🚀 Live Demo

- **Online Web Tool**: [https://racesio.com/pages/alcantara-color-finder](https://racesio.com/pages/alcantara-color-finder)
- **Official Brand Store**: [https://racesio.com](https://racesio.com)

---

## 💡 Why This Project Exists

Alcantara fabric uses an idiosyncratic **4-digit numbering and naming system** (e.g., *Burgundy 2916*, *Dark Grey 9002*, *Milano 4978*, *Teal 7586*). In automotive interior restorations, custom steering wheel wraps, seat reupholstery, and bespoke gear, users frequently encounter problems:

1. **Subtle shade differences**: 3 to 4 near-identical shades of dark grey or sky blue look virtually indistinguishable on digital displays.
2. **Missing code references**: Buyers see a steering wheel or pillow in a photo, but don't know which official 4-digit Alcantara code matches it.
3. **RGB pickers fail on fabrics**: Simple RGB Euclidean distance matches poorly to human visual perception, especially with suede and microfiber textures that shift appearance under different lighting.

**Alcantara Color Finder** bridges this gap by extracting color swatches, mapping them to CIELAB coordinates, and matching them via the **CIEDE2000 color difference formula** to give confidence-rated candidate matches.

---

## ✨ Features

- **Chrome Extension (Manifest V3)**:
  - **Area Box Selection**: Drag to select any swatch area or product photo on any webpage.
  - **Texture-Aware Sampling**: Gathers median, trimmed mean, and dominant color anchors across the selection.
  - **100% Local Processing**: All color calculations, canvas sampling, and matching run locally inside the browser. No images or logs are transmitted to external servers.
- **Standalone Web Tool**:
  - Drag & drop image upload or native **EyeDropper API** screen color picking.
  - Interactive canvas selection box.
  - Instant top-5 closest color matches with official names, 4-digit codes, HEX chips, and confidence ratings.
- **Structured 172-Color Dataset**:
  - Complete JSON database covering Automotive, Interior / Nautical / Aviation, Fashion, and Consumer Electronics lines.
  - Cross-referenced with commercial names and [Racesio product links](https://racesio.com) for physical verification.

---

## 📦 Repository Structure

```
alcantara-color-finder/
├── chrome-extension/         # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── background.js         # Service worker
│   ├── popup.html / popup.js # Extension popup trigger
│   ├── picker.html / picker.js # Area-picker analysis interface
│   ├── select-area.js        # Webpage drag-to-select content script
│   ├── colors-data.js        # Bundled color database
│   └── colors-profile-data.js# Multi-anchor swatch profiles
├── web-tool/                 # Web tool files
│   ├── index.html            # Interactive canvas tool
│   ├── app.js                # Core matching & UI logic
│   └── colors-data.js        # Color database
├── standalone/               # Single-file HTML zero-dependency distribution
│   └── index.html
├── data/                     # Clean structured data
│   ├── colors.json           # 172 Alcantara colors (HEX, RGB, CIELAB, applications)
│   └── README.md             # Dataset documentation
├── scripts/                  # Data collection & profile extraction scripts
│   └── build_material_profiles.py
└── assets/                   # Screenshots and icons
```

---

## 🛠️ Installation & Usage

### 1. Using the Chrome Extension
1. Clone this repository or download it as a ZIP:
   ```bash
   git clone https://github.com/kuaai/alcantara-color-finder.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the `chrome-extension/` directory.
5. Click the extension icon on any webpage showing Alcantara fabric, drag a selection box over the material, and review the closest matches.

### 2. Using the Web Tool
- Simply open `web-tool/index.html` or `standalone/index.html` in any modern web browser.
- Or use the live production version hosted at [racesio.com/pages/alcantara-color-finder](https://racesio.com/pages/alcantara-color-finder).

---

## 🔬 Color Science: How Matching Works

Fabric textures like Alcantara exhibit micro-shading, directional pile, and compression highlights. Matching cannot rely on a single RGB pixel. The tool uses a multi-stage approach:

1. **Noise-Filtered Pixel Collection**: Samples all pixels within the selected bounding box, discarding extreme edge artifacts or outlier highlights.
2. **Anchor Extraction**:
   - Central median sRGB
   - Robust trimmed mean sRGB
   - Dominant cluster center
3. **sRGB to CIELAB Transformation**: Converts sRGB channels into CIE $L^*a^*b^*$ space under a D65 standard illuminant.
4. **CIEDE2000 Distance Calculation**: Computes the perceptual delta $E_{00}$ against pre-computed profiles of all 172 official Alcantara swatches.
5. **Confidence Rating**: Converts delta $E_{00}$ into a user-friendly confidence score ($0-100\%$) penalized by texture variance.

---

## 🤝 Maintained by Racesio

This project is open-sourced and maintained by [Racesio®](https://racesio.com). 

If you are looking for custom genuine Alcantara products for your vehicle, check out our collections:
- [Alcantara Accessories](https://racesio.com/collections/alcantara-accessories)
- [Alcantara Headrest Pillows](https://racesio.com/products/alcantara-car-headrest-pillow)
- [Custom Car Interior Products](https://racesio.com)

---

## ⚖️ Legal & Trademark Disclaimer

- **Alcantara®** is a registered trademark of **Alcantara S.p.A.**
- This project is an independent community open-source tool developed by [Racesio](https://racesio.com) and is **not affiliated with, authorized by, sponsored by, or endorsed by Alcantara S.p.A.**
- Display and camera calibration introduce slight variance. Color identifications are close approximations; checking against physical sample swatches is always recommended for automotive upholstery matching.

## 📄 License

Released under the [MIT License](LICENSE).
