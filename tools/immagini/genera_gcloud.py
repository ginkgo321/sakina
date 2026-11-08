r"""genera_gcloud.py - genera le immagini delle Sure con la chiave Google Cloud (passo 2 della regola per le immagini).

    python tools\immagini\genera_gcloud.py 55            # una Sura
    python tools\immagini\genera_gcloud.py 3-114         # un intervallo (salta quelle già in lavoro\grezze)
    python tools\immagini\genera_gcloud.py 3-114 --forza # rifà anche quelle già presenti

Si usa SOLO quando Antigravity ha finito la quota del modello di immagini (HTTP 429): vedi AGENTS.md. Usa
multimedia_pool.generate_image (Vertex AI gemini-3.1-flash-image, poi gemini-2.5-flash-image): ritenta sugli errori temporanei,
poi si ferma. Il blocco di sicurezza (250 €, 24 gennaio 2027) è dentro gemini_pool. Due immagini alla volta (con quattro la chiave risponde 429 e molte falliscono).
I prompt vengono da soggetti.json (scritto da genera_dati.py). Le immagini finiscono in tools/immagini/lavoro/grezze/sura_NNN.png.
"""
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.append(r"C:\Users\df\.config\gemini")
from multimedia_pool import generate_image  # noqa: E402

RADICE = Path(__file__).resolve().parent.parent.parent
GREZZE = RADICE / "tools" / "immagini" / "lavoro" / "grezze"


def numeri(args):
    out = []
    for a in args:
        if "-" in a:
            x, y = a.split("-")
            out += list(range(int(x), int(y) + 1))
        else:
            out.append(int(a))
    return out


def una(n, prompt):
    dest = GREZZE / f"sura_{n:03d}.png"
    t = time.time()
    try:
        generate_image(prompt, aspect_ratio="1:1", output_path=str(dest))
    except Exception as e:  # il blocco di sicurezza o un errore della chiave fermano tutto: lo si vede nel registro
        return n, False, f"{type(e).__name__}: {str(e)[:160]}"
    return n, dest.exists(), f"{time.time() - t:.0f} s"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    forza = "--forza" in sys.argv
    if not args:
        sys.exit(__doc__)
    dati = json.loads((RADICE / "tools" / "immagini" / "soggetti.json").read_text(encoding="utf-8"))
    GREZZE.mkdir(parents=True, exist_ok=True)
    da_fare = [n for n in numeri(args) if forza or not list(GREZZE.glob(f"sura_{n:03d}.*"))]
    print(f"{len(da_fare)} immagini da generare", flush=True)
    ko = 0
    with ThreadPoolExecutor(max_workers=2) as ex:
        for n, ok, info in ex.map(lambda n: una(n, dati[str(n)]["prompt"]), da_fare):
            ko += 0 if ok else 1
            print(f"Sura {n:3d}: {'ok' if ok else 'ERRORE'}  {info}", flush=True)
    print(f"finito: {len(da_fare) - ko} ok, {ko} errori", flush=True)


if __name__ == "__main__":
    main()
