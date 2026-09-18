#!/usr/bin/env python3
"""Generate Lifeline PWA icons (blood drop on a red gradient tile)."""
import math
from PIL import Image, ImageDraw, ImageFilter

OUT = "assets/icons"


def drop_mask(size, cx, cy, radius):
    """Classic teardrop: circle bottom + two tangent lines to the top tip."""
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    tip_y = cy - radius * 1.85
    # circle body
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=255)
    # triangle to the tip, slightly narrower than the tangent for a soft point
    half = radius * 0.86
    d.polygon([(cx, tip_y), (cx - half, cy - radius * 0.18), (cx + half, cy - radius * 0.18)], fill=255)
    return mask


def rounded_tile(size, radius_ratio=0.24):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255)
    return mask


def gradient(size, top=(217, 33, 66), bottom=(107, 11, 24)):
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        t = y / max(1, size - 1)
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        for x in range(size):
            px[x, y] = (r, g, b)
    return img


def highlight(size):
    """Soft top-left sheen."""
    layer = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(layer)
    d.ellipse([-size * 0.5, -size * 0.7, size * 0.9, size * 0.5], fill=90)
    return layer.filter(ImageFilter.GaussianBlur(size * 0.12))


def build(size, path, maskable=False):
    scale = 4
    S = size * scale
    base = gradient(S)

    # sheen
    sheen = highlight(S)
    base.putalpha(255)
    base = base.convert("RGBA")
    sheen_rgba = Image.new("RGBA", (S, S), (255, 255, 255, 0))
    sheen_rgba.putalpha(sheen)
    base = Image.alpha_composite(base, sheen_rgba)

    # drop
    radius = S * (0.30 if maskable else 0.24)
    cx, cy = S / 2, S * (0.56 if maskable else 0.55)
    dm = drop_mask(S, cx, cy, radius).filter(ImageFilter.GaussianBlur(S * 0.004))
    drop = Image.new("RGBA", (S, S), (255, 250, 250, 0))
    drop.putalpha(dm)
    base = Image.alpha_composite(base, drop)

    # inner gloss on the drop
    gloss_m = Image.new("L", (S, S), 0)
    ImageDraw.Draw(gloss_m).ellipse(
        [cx - radius * 0.42, cy - radius * 0.72, cx - radius * 0.02, cy - radius * 0.28], fill=120
    )
    gloss_m = gloss_m.filter(ImageFilter.GaussianBlur(S * 0.012))
    gloss = Image.new("RGBA", (S, S), (255, 255, 255, 0))
    gloss.putalpha(gloss_m)
    base = Image.alpha_composite(base, gloss)

    # mask tiles
    tile = rounded_tile(S, 0.5 if maskable else 0.24)
    out = Image.new("RGBA", (S, S), (251, 247, 244, 255) if not maskable else (0, 0, 0, 0))
    if maskable:
        out = Image.new("RGBA", (S, S), (160, 12, 34, 255))
        out = Image.alpha_composite(out, base)
    else:
        out.paste(base, (0, 0), tile)

    out = out.resize((size, size), Image.LANCZOS)
    out.save(path, "PNG", optimize=True)
    print("wrote", path, out.size)


if __name__ == "__main__":
    build(192, f"{OUT}/icon-192.png")
    build(512, f"{OUT}/icon-512.png")
    build(512, f"{OUT}/icon-maskable-512.png", maskable=True)
    build(180, f"{OUT}/apple-touch-icon.png")
    build(32, f"{OUT}/favicon-32.png")
