"""
Run this script from the ROOT of your repository:
    python fix_white_icons.py

It will find every *-white.svg file inside docs/icons/ and replace
all known dark fill colors with #ffffff so they render white on GitHub dark mode.
"""

import os
import re

ICONS_DIR = os.path.join("docs", "icons")

# All dark fill values Flaticon commonly uses
DARK_FILLS = [
    "#000000",
    "#000",
    "#1a1a1a",
    "#1A1A1A",
    "#212121",
    "#2d2d2d",
    "#2D2D2D",
    "#333333",
    "#333",
    "#3d3d3d",
    "#3D3D3D",
    "#404040",
]

def fix_svg(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    original = content

    # Replace fill="<dark>" attributes
    for dark in DARK_FILLS:
        content = content.replace(f'fill="{dark}"', 'fill="#ffffff"')

    # Replace fill:<dark> inside style attributes
    for dark in DARK_FILLS:
        content = content.replace(f'fill:{dark}', 'fill:#ffffff')
        content = content.replace(f'fill:{dark.lower()}', 'fill:#ffffff')

    # Replace stop-color (for gradient-based SVGs)
    for dark in DARK_FILLS:
        content = content.replace(f'stop-color="{dark}"', 'stop-color="#ffffff"')

    # If SVG has no fill attribute at all, add fill="#ffffff" to the root <svg> tag
    if 'fill=' not in content:
        content = re.sub(r'(<svg\b)', r'\1 fill="#ffffff"', content, count=1)

    if content != original:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  ✔ Fixed: {os.path.basename(filepath)}")
    else:
        print(f"  ⚠ No changes needed (check manually): {os.path.basename(filepath)}")

def main():
    if not os.path.isdir(ICONS_DIR):
        print(f"ERROR: Could not find '{ICONS_DIR}' folder.")
        print("Make sure you run this script from the ROOT of your repository.")
        return

    white_svgs = [
        f for f in os.listdir(ICONS_DIR)
        if f.endswith("-white.svg")
    ]

    if not white_svgs:
        print(f"No *-white.svg files found in '{ICONS_DIR}'.")
        return

    print(f"Found {len(white_svgs)} white SVG file(s) in '{ICONS_DIR}':\n")
    for filename in sorted(white_svgs):
        fix_svg(os.path.join(ICONS_DIR, filename))

    print(f"\nDone! Push the updated files to GitHub and hard-refresh (Ctrl+Shift+R).")

if __name__ == "__main__":
    main()
