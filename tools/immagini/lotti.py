r"""lotti.py - prepara i lotti da dare ad Antigravity e raccoglie le immagini generate.

    python tools\immagini\lotti.py crea 2 12 55            # scrive tools\immagini\lavoro\lotti\lotto_<ora>.md con i prompt di quelle Sure
    python tools\immagini\lotti.py crea 1-10                # intervalli ammessi
    python tools\immagini\lotti.py raccogli <da_quando>     # copia in lavoro\grezze le immagini sura_NNN nuove della cartella di Antigravity
    python tools\immagini\lotti.py tavola                   # tavola di controllo con tutte le immagini grezze (lavoro\tavola.jpg)

«crea» stampa il percorso del file: va passato ad Antigravity (MCP `antigravity`, parametro promptFile; nel testo: sotto-agente
`image-generator`, niente run_command). «raccogli» prende un'ora (secondi Unix, come `date +%s`) e per ogni Sura tiene il file più
recente (le versioni _v2 vengono dopo). I prompt vengono da soggetti.json (scritto da genera_dati.py).
"""
import json
import shutil
import sys
import time
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent.parent
LAVORO = RADICE / "tools" / "immagini" / "lavoro"
BRAIN = Path.home() / ".gemini" / "antigravity-cli" / "brain"


def numeri(args):
    out = []
    for a in args:
        if "-" in a:
            x, y = a.split("-")
            out += list(range(int(x), int(y) + 1))
        else:
            out.append(int(a))
    return out


def crea(args):
    dati = json.loads((RADICE / "tools" / "immagini" / "soggetti.json").read_text(encoding="utf-8"))
    ns = numeri(args)
    (LAVORO / "lotti").mkdir(parents=True, exist_ok=True)
    f = LAVORO / "lotti" / f"lotto_{time.strftime('%H%M%S')}.md"
    righe = [
        "Usa il sotto-agente integrato `image-generator`. NON usare `run_command`. Non usare fal, Picsart, Google Cloud o script con chiavi API.",
        f"Genera {len(ns)} immagini quadrate (1:1), UNA PER VOLTA, in ordine, aspettando che il sotto-agente finisca ciascuna prima di passare alla successiva.",
        "Per ognuna usa ESATTAMENTE il prompt indicato (non riassumerlo, non cambiare lo stile) e il nome file indicato.",
        "Se un'immagine contiene testo, lettere, persone o un bordo/oggetto attorno all'opera, rigenerala una sola volta (nome `_v2`).",
        "Alla fine elenca, uno per riga, nome file e percorso completo di ogni immagine salvata.",
        "",
    ]
    for n in ns:
        righe += [f"## Immagine {n}: nome file `sura_{n:03d}`", dati[str(n)]["prompt"], ""]
    f.write_text("\n".join(righe), encoding="utf-8")
    print(f)


def raccogli(args):
    da = float(args[0])
    migliori = {}
    for p in BRAIN.glob("*/sura_*"):
        if p.suffix.lower() not in (".jpg", ".jpeg", ".png") or p.stat().st_mtime < da:
            continue
        try:
            n = int(p.name.split("_")[1])
        except (IndexError, ValueError):
            continue
        if n not in migliori or p.stat().st_mtime > migliori[n].stat().st_mtime:
            migliori[n] = p
    (LAVORO / "grezze").mkdir(parents=True, exist_ok=True)
    for n, p in sorted(migliori.items()):
        shutil.copy2(p, LAVORO / "grezze" / f"sura_{n:03d}{p.suffix.lower()}")
        print(f"Sura {n:3d} <- {p.name}")
    print(f"{len(migliori)} immagini raccolte")


def tavola(_):
    from PIL import Image, ImageDraw
    files = sorted((LAVORO / "grezze").glob("sura_*.*"))
    if not files:
        sys.exit("nessuna immagine in lavoro\\grezze")
    lato, col = 200, 10
    righe = (len(files) + col - 1) // col
    T = Image.new("RGB", (col * lato, righe * lato), (30, 30, 30))
    for i, p in enumerate(files):
        im = Image.open(p).convert("RGB").resize((lato, lato), Image.LANCZOS)
        d = ImageDraw.Draw(im)
        d.rectangle((0, 0, 34, 18), fill=(0, 0, 0))
        d.text((4, 3), p.stem.split("_")[1], fill=(255, 255, 255))
        T.paste(im, ((i % col) * lato, (i // col) * lato))
    out = LAVORO / "tavola.jpg"
    T.save(out, quality=85)
    print(out, f"({len(files)} immagini)")


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in ("crea", "raccogli", "tavola"):
        sys.exit(__doc__)
    {"crea": crea, "raccogli": raccogli, "tavola": tavola}[sys.argv[1]](sys.argv[2:])
