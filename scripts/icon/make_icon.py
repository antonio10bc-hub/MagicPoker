"""
--- ICONO DE LA APP: el busto del Rey sobre rojo ---
Uso: python3 scripts/icon/make_icon.py   (necesita numpy y Pillow)

Fondo bermellón a sangre con el centro encendido, el busto del Rey (cabeza y hombros,
cortado por abajo) en silueta negra, centrado, con los ojos crema encendidos, y grano de
impresión. Cada tamaño se pinta a 4× con el Rey a escala entera y se reduce por bloques,
así los píxeles del Rey quedan nítidos y el fondo, suave.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BLACK, CREAM, ORANGE, DEEP = (11, 13, 12), (237, 235, 224), (255, 74, 28), (120, 18, 8)

# El Rey de la carta, sin cetro y simétrico (17 de ancho, centro en la columna 8)
LEFT = ['....o...o', '....oo.oo', '....ooooo', '....ooooo', '.....oeoo', '.....oooo', '....ooooo', '....ooooo',
        '.....oooo', '..ooooooo', '.oooooooo', 'ooooooooo']
BUST = [r + r[-2::-1] for r in LEFT]
BUST += [BUST[-1]] * 4  # el busto sigue hasta el borde de abajo


def render(size, scale, top_pad=None, seed=1):
    """Icono de `size` px; el Rey a `scale` px por píxel, pegado abajo y centrado"""
    m = 4
    S, k = size * m, scale * m
    f = S / 512  # radios de brillo, proporcionales
    yy, xx = np.mgrid[0:S, 0:S]
    t = np.clip(np.hypot(xx - S / 2, yy - S * 0.42) / (S * 0.78), 0, 1) ** 1.3
    bg = np.array(ORANGE)[None, None] * (1 - t[..., None]) + np.array(DEEP)[None, None] * t[..., None]
    img = Image.fromarray(bg.astype(np.uint8), 'RGB').convert('RGBA')

    w, h = len(BUST[0]) * k, len(BUST) * k
    ox, oy = (S - w) // 2, S - h
    if top_pad is not None:  # con margen arriba (icono enmascarable): se sube lo justo
        oy = min(oy, int(top_pad * S))

    def mask(ch):
        mk = Image.new('L', (S, S), 0)
        d = ImageDraw.Draw(mk)
        for y, r in enumerate(BUST):
            for x, c in enumerate(r):
                if c in ch:
                    d.rectangle([ox + x * k, oy + y * k, ox + (x + 1) * k - 1, oy + (y + 1) * k - 1], fill=255)
        return mk

    def layer(color, alpha):
        lay = Image.new('RGBA', (S, S), color + (255,))
        lay.putalpha(alpha)
        return lay

    def glow(mk, color, r, gain):
        return layer(color, mk.filter(ImageFilter.GaussianBlur(r * f)).point(lambda v: min(255, int(v * gain))))

    body, eyes = mask('o'), mask('e')
    img = Image.alpha_composite(img, glow(body, BLACK, 22, 0.55))
    img = Image.alpha_composite(img, layer(BLACK, body))
    img = Image.alpha_composite(img, glow(eyes, CREAM, 14, 2.5))
    img = Image.alpha_composite(img, layer(CREAM, eyes))
    img = img.resize((size, size), Image.BOX)
    # Grano de impresión
    a = np.array(img).astype(np.int16)
    a[..., :3] = np.clip(a[..., :3] + np.random.default_rng(seed).integers(-9, 10, (size, size, 1)), 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA').convert('RGB')


OUTPUTS = [
    # (archivo, tamaño, escala del Rey, margen arriba para el enmascarable)
    ('public/icons/icon-512.png', 512, 26, None),
    ('public/icons/maskable-512.png', 512, 20, None),
    ('public/icons/icon-192.png', 192, 10, None),
    ('app/apple-icon.png', 180, 10, None),
    ('app/icon.png', 64, 4, None),
    ('desktop/build/icon.png', 512, 26, None),
]

if __name__ == '__main__':
    for path, size, scale, pad in OUTPUTS:
        render(size, scale, pad).save(os.path.join(ROOT, path), optimize=True)
        print(path)
