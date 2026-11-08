r"""prepara.py - trasforma le immagini generate in quelle del sito.

    python tools\immagini\prepara.py                 # tutte le immagini grezze in tools\immagini\lavoro\grezze
    python tools\immagini\prepara.py 2 12 55         # solo queste Sure
    python tools\immagini\prepara.py --margine 6     # toglie il 6% su ogni lato (bordo del libro o sfondo)

Cerca in tools/immagini/lavoro/grezze i file chiamati sura_NNN.(png|jpg|jpeg|webp), li ritaglia a quadrato dal centro e scrive
  img/sure/NNN.webp      480 x 480  (scheda del lettore)
  img/sure/t/NNN.webp    104 x 104  (miniature nelle liste, a 2x per gli schermi retina)
Serve Pillow (Python di sistema). I file grezzi non vanno nel repository (vedi .gitignore).
"""
import sys
from pathlib import Path
from PIL import Image

RADICE = Path(__file__).resolve().parent.parent.parent
GREZZE = RADICE / "tools" / "immagini" / "lavoro" / "grezze"
USCITA = RADICE / "img" / "sure"


MARGINE = 0.0   # frazione da togliere su ogni lato (--margine 6 = 6%): serve se il generatore lascia il bordo del libro o lo sfondo


def quadrato(im):
    w, h = im.size
    lato = min(w, h)
    m = int(lato * MARGINE)
    return im.crop(((w - lato) // 2 + m, (h - lato) // 2 + m, (w - lato) // 2 + lato - m, (h - lato) // 2 + lato - m))


def main():
    global MARGINE
    args = sys.argv[1:]
    if "--margine" in args:
        i = args.index("--margine")
        MARGINE = float(args[i + 1]) / 100
        del args[i:i + 2]
    solo = {int(a) for a in args if a.isdigit()}
    (USCITA / "t").mkdir(parents=True, exist_ok=True)
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
        fatte += 1
        print(f"Sura {n:3d}: {(USCITA / nome).stat().st_size // 1024} KB + miniatura {(USCITA / 't' / nome).stat().st_size // 1024} KB")
    print(f"{fatte} immagini preparate in {USCITA}")


if __name__ == "__main__":
    main()
