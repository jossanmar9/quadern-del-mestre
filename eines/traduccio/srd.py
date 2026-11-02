#!/usr/bin/env python3
"""Eines per a traduir el compendi SRD 5.2.1 del castellà al valencià.

  python3 eines/traduccio/srd.py extrau  CARPETA     trau les frases úniques en trossos (CARPETA/in/NNN.json)
  python3 eines/traduccio/srd.py munta   CARPETA     munta src/srd/srd-va.json.gz amb les traduccions (CARPETA/out/NNN.json)
  python3 eines/traduccio/srd.py valida  IN OUT      comprova que un tros traduït té la mateixa forma que l'original

Les claus que no són text (tipus de bloc, claus internes) no es tradueixen. Les frases que només tenen
números o símbols es copien tal qual. Sense dependències.
"""
import gzip
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src" / "srd" / "srd-es.json.gz"
DST = ROOT / "src" / "srd" / "srd-va.json.gz"
SKIP_KEYS = {"t", "clave", "sup"}
CHUNK_CHARS = 15000
HAS_LETTERS = re.compile(r"[A-Za-zÀ-ÿ]{2,}")


def strings(o, out, key=None):
    if isinstance(o, str):
        if key not in SKIP_KEYS:
            out.append(o)
    elif isinstance(o, list):
        for x in o:
            strings(x, out, key)
    elif isinstance(o, dict):
        for k, v in o.items():
            strings(v, out, k)


def replace(o, tr, key=None):
    if isinstance(o, str):
        return tr.get(o, o) if key not in SKIP_KEYS else o
    if isinstance(o, list):
        return [replace(x, tr, key) for x in o]
    if isinstance(o, dict):
        return {k: replace(v, tr, k) for k, v in o.items()}
    return o


def load():
    return json.load(gzip.open(SRC, "rt", encoding="utf-8"))


def all_strings(d):
    out = []
    for e in d["entradas"]:
        strings(e["e"], out)
    strings(d["nombres"], out)
    out.append(d["atribucion"])
    seen, uniq = set(), []
    for s in out:
        if s not in seen and HAS_LETTERS.search(s):
            seen.add(s)
            uniq.append(s)
    return uniq


def extrau(folder):
    d = load()
    uniq = all_strings(d)
    # Les entrades llargues primer a cada tros no importa; s'agrupen en l'ordre del compendi (context proper)
    chunks, cur, size = [], [], 0
    for s in uniq:
        if cur and size + len(s) > CHUNK_CHARS:
            chunks.append(cur)
            cur, size = [], 0
        cur.append(s)
        size += len(s)
    if cur:
        chunks.append(cur)
    (folder / "in").mkdir(parents=True, exist_ok=True)
    (folder / "out").mkdir(parents=True, exist_ok=True)
    for i, ch in enumerate(chunks, 1):
        (folder / "in" / f"{i:03}.json").write_text(json.dumps({"s": ch}, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"{len(uniq)} frases úniques en {len(chunks)} trossos ({sum(len(s) for s in uniq):,} caràcters)")


def valida(inp, out, quiet=False):
    a = json.loads(Path(inp).read_text(encoding="utf-8"))["s"]
    try:
        b = json.loads(Path(out).read_text(encoding="utf-8"))["s"]
    except Exception as e:  # noqa: BLE001
        return [f"JSON no vàlid: {e}"]
    errs = []
    if len(a) != len(b):
        return [f"té {len(b)} frases i n'hi ha d'haver {len(a)}"]
    for i, (x, y) in enumerate(zip(a, b)):
        if not isinstance(y, str) or not y.strip():
            errs.append(f"#{i}: buida")
            continue
        tx, ty = re.findall(r"</?\w+>", x), re.findall(r"</?\w+>", y)
        if sorted(tx) != sorted(ty):
            errs.append(f"#{i}: les etiquetes HTML no coincideixen: {x[:60]!r}")
        nx, ny = re.findall(r"\d+(?:[.,]\d+)?", x), re.findall(r"\d+(?:[.,]\d+)?", y)
        if sorted(nx) != sorted(ny) and len(nx) < 40:
            errs.append(f"#{i}: els números no coincideixen ({' '.join(nx)} / {' '.join(ny)}): {x[:60]!r}")
        if re.search(r"[ñ¿¡]|(?:^|\s)(?:y|los|las|una vez|puede|hasta|también|daño|cuando|está|pero)\b", y):
            errs.append(f"#{i}: sembla que queda castellà: {y[:80]!r}")
    return errs


def munta(folder):
    d = load()
    uniq = all_strings(d)
    tr = {}
    for f in sorted((folder / "in").glob("*.json")):
        o = folder / "out" / f.name
        if not o.exists():
            raise SystemExit(f"Falta la traducció de {f.name}")
        a = json.loads(f.read_text(encoding="utf-8"))["s"]
        b = json.loads(o.read_text(encoding="utf-8"))["s"]
        if len(a) != len(b):
            raise SystemExit(f"{f.name}: no té les mateixes frases")
        tr.update(zip(a, b))
    missing = [s for s in uniq if s not in tr]
    if missing:
        raise SystemExit(f"Falten {len(missing)} frases")
    out = {"version": d["version"], "nombres": replace(d["nombres"], tr), "atribucion": tr[d["atribucion"]],
           "entradas": [{**e, "e": replace(e["e"], tr)} for e in d["entradas"]]}
    for k, v in d.items():
        out.setdefault(k, v)
    raw = json.dumps(out, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    DST.write_bytes(gzip.compress(raw, 9, mtime=0))
    print(f"Fet: {DST.relative_to(ROOT)} ({DST.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "extrau":
        extrau(Path(sys.argv[2]))
    elif cmd == "munta":
        munta(Path(sys.argv[2]))
    elif cmd == "valida":
        errs = valida(sys.argv[2], sys.argv[3])
        print("\n".join(errs[:60]) if errs else "Correcte")
        sys.exit(1 if errs else 0)
    else:
        print(__doc__)
