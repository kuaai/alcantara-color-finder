# Alcantara® Color Dataset

Structured color database containing 172 Alcantara® color swatches and codes extracted and sampled across automotive, interior, fashion, and consumer electronics applications.

## Schema

Each item in `colors.json` follows this format:

```json
{
  "code": "2916",
  "official_name": "Burgundy",
  "rgb": [147, 62, 80],
  "hex": "#933E50",
  "lab": [38.25, 37.59, 7.18],
  "applications": [
    "automotive"
  ],
  "racesio_available": true,
  "racesio_names": [
    "Burgundy"
  ],
  "racesio_product_handles": [
    "alcantara-car-headrest-pillow",
    "alcantara-steering-wheel-cover"
  ]
}
```

### Fields
- `code`: 4-digit Alcantara official color code (e.g., `2916`, `9002`, `4978`).
- `official_name`: Color shade name when published officially or by distributors.
- `rgb`: Median sRGB channel values [R, G, B] sampled from official swatches.
- `hex`: 6-character hexadecimal color representation.
- `lab`: CIELAB color space coordinates `[L*, a*, b*]` for perceptual color comparison.
- `applications`: Array of official categories (`automotive`, `interior`, `fashion`, `electronics`).
- `racesio_available`: Boolean indicating whether [Racesio](https://racesio.com) stocks automotive interior accessories in this shade.
- `racesio_names`: Common commercial naming variants for consumer reference.
- `racesio_product_handles`: Related product handles available on [racesio.com](https://racesio.com).

## Disclaimer

All color codes and original swatch representations are referenced from publicly accessible color charts on alcantara.com. This dataset is maintained as an open-source reference by [Racesio](https://racesio.com) and is not certified or officially authorized by Alcantara S.p.A.
