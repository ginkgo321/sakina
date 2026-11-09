r"""prepara.py - trasforma le immagini generate in quelle del sito.

    python tools\immagini\prepara.py                 # tutte le immagini grezze in tools\immagini\lavoro\grezze
    python tools\immagini\prepara.py 2 12 55         # solo queste Sure
    python tools\immagini\prepara.py --margine 2     # toglie in più il 2% su ogni lato (dopo il ritaglio automatico della carta bianca)

Cerca in tools/immagini/lavoro/grezze i file chiamati sura_NNN.(png|jpg|jpeg|webp), toglie la carta bianca attorno, li ritaglia a quadrato dal centro e scrive
  img/sure/NNN.webp      480 x 480  (scheda del lettore)
  img/sure/t/NNN.webp    104 x 104  (miniature nelle liste, a 2x per gli schermi retina)
  img/sure/art/NNN.jpg   512 x 512  JPEG (immagine sulla schermata di blocco e nel centro di controllo: Media Session)
Serve Pillow (Python di sistema). I file grezzi non vanno nel repository (vedi .gitignore).
"""
import sys
from pathlib import Path
from PIL import Image

RADICE = Path(__file__).resolve().parent.parent.parent
GREZZE = RADICE / "tools" / "immagini" / "lavoro" / "grezze"
USCITA = RADICE / "img" / "sure"


MARGINE = 0.0   # margine in più da togliere su ogni lato (--margine 2 = 2%), dopo il ritaglio automatico del bordo di carta


def bordo_carta(im, soglia=222):
    """Toglie la carta bianca attorno all'opera: scorre dai quattro lati finché le righe sono quasi bianche."""
    from PIL import ImageStat
    g = im.convert("L").resize((256, 256), Image.BILINEAR)
    def chiara(box):
        return ImageStat.Stat(g.crop(box)).mean[0] > soglia
    t = 0
    while t < 60 and chiara((0, t, 256, t + 1)): t += 1
    b = 256
    while b > 196 and chiara((0, b - 1, 256, b)): b -= 1
    l = 0
    while l < 60 and chiara((l, 0, l + 1, 256)): l += 1
    r = 256
    while r > 196 and chiara((r - 1, 0, r, 256)): r -= 1
    k = im.size[0] / 256
    return int(l * k), int(t * k), int(r * k), int(b * k)


def quadrato(im):
    x0, y0, x1, y1 = bordo_carta(im)
    lato = min(x1 - x0, y1 - y0)
    m = int(lato * (0.01 + MARGINE))
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    h = lato // 2 - m
    return im.crop((cx - h, cy - h, cx + h, cy + h))


def main():
    global MARGINE
    args = sys.argv[1:]
    if "--margine" in args:
        i = args.index("--margine")
        MARGINE = float(args[i + 1]) / 100
        del args[i:i + 2]
    solo = {int(a) for a in args if a.isdigit()}
    (USCITA / "t").mkdir(parents=True, exist_ok=True)
    (USCITA / "art").mkdir(parents=True, exist_ok=True)
    fatte = 0
    for p in sorted(GREZZE.glob("sura_*.*")):
        try:
            n = int(p.stem.split("_")[1])
        except (IndexError, ValueError):
            continue
        if solo and n not in solo:
            continue
        im = quadrato(Image.open(p).convert("RGB"))
        nome = f"{n:03d}.webp"
        im.resize((480, 480), Image.LANCZOS).save(USCITA / nome, "WEBP", quality=80, method=6)
        im.resize((104, 104), Image.LANCZOS).save(USCITA / "t" / nome, "WEBP", quality=78, method=6)
        im.resize((512, 512), Image.LANCZOS).save(USCITA / "art" / f"{n:03d}.jpg", "JPEG", quality=82, optimize=True, progressive=True)
        fatte += 1
        print(f"Sura {n:3d}: {(USCITA / nome).stat().st_size // 1024} KB + miniatura {(USCITA / 't' / nome).stat().st_size // 1024} KB")
    print(f"{fatte} immagini preparate in {USCITA}")


if __name__ == "__main__":
    main()
