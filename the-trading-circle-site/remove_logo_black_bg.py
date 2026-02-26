"""
Remove solid black background from logo.png so the logo sits on transparent.
Only pixels that are nearly pure black (R,G,B all below threshold) become transparent.
Logo (gold/white) is left unchanged. Run from the-trading-circle-site folder:

  pip install Pillow
  python remove_logo_black_bg.py
"""
try:
    from PIL import Image
except ImportError:
    print("Install Pillow first: pip install Pillow")
    exit(1)

import os

LOGO_PATH = os.path.join(os.path.dirname(__file__), "img", "logo.png")
# Only remove pixels that are clearly background black (not dark gold)
THRESHOLD = 25

def main():
    if not os.path.isfile(LOGO_PATH):
        print("Logo not found at:", LOGO_PATH)
        return
    img = Image.open(LOGO_PATH).convert("RGBA")
    w, h = img.size
    data = img.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = data[x, y]
            if r <= THRESHOLD and g <= THRESHOLD and b <= THRESHOLD:
                data[x, y] = (0, 0, 0, 0)
    img.save(LOGO_PATH, "PNG")
    print("Done. Black background removed from img/logo.png")

if __name__ == "__main__":
    main()
